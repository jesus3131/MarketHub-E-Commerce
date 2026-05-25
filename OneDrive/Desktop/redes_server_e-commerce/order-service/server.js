const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3003;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.use(cors());
app.use(express.json());

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Se requieren permisos de administrador' });
  next();
}

async function createNotification(userId, type, title, message, data) {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)',
      [userId, type, title, message, JSON.stringify(data || {})]
    );
  } catch (err) { console.error('Create notification error:', err); }
}

async function logActivity(userId, userName, userRole, action, description, targetType, targetId, ip) {
  try {
    await pool.query(
      'INSERT INTO activity_logs (user_id, user_name, user_role, action, description, target_type, target_id, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [userId, userName || '', userRole || '', action, description, targetType, targetId || '', ip || '']
    );
  } catch (err) { console.error('Log activity error:', err); }
}

app.post('/orders', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: 'Se requiere al menos un producto en la orden' });

    const userId = req.user.userId;
    await client.query('BEGIN');

    let total = 0;
    const productNames = [];
    for (const item of items) {
      const prod = await client.query(
        'SELECT price, stock, name, image_url FROM products WHERE id = $1 FOR UPDATE',
        [item.productId]
      );
      if (prod.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Producto ${item.productId} no encontrado` });
      }
      if (prod.rows[0].stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Stock insuficiente para ${prod.rows[0].name}. Disponible: ${prod.rows[0].stock}`
        });
      }
      total += parseFloat(prod.rows[0].price) * item.quantity;
      productNames.push({ name: prod.rows[0].name, qty: item.quantity, image_url: prod.rows[0].image_url });
    }

    const orderResult = await client.query(
      'INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING id, user_id, total, status, created_at',
      [userId, total, 'confirmed']
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      const prod = await client.query('SELECT price, name, image_url FROM products WHERE id = $1', [item.productId]);
      await client.query(
        'INSERT INTO order_details (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [order.id, item.productId, item.quantity, prod.rows[0].price]
      );
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.productId]);
    }

    await client.query('COMMIT');

    await createNotification(userId, 'order', `Orden #${order.id} confirmada`,
      `Tu orden de ${items.length} producto(s) por $${parseFloat(total).toFixed(2)} ha sido confirmada.`,
      { orderId: order.id, total, items: productNames });

    res.status(201).json({ ...order, items: productNames });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
});

app.get('/orders/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (String(userId) !== String(req.user.userId) && req.user.role !== 'admin')
      return res.status(403).json({ error: 'No tienes permiso para ver estas órdenes' });
    const orders = await pool.query(
      `SELECT o.id, o.user_id, o.total, o.status, o.created_at,
              json_agg(
                json_build_object(
                  'productId', od.product_id,
                  'quantity', od.quantity,
                  'price', od.price
                )
              ) AS details
       FROM orders o
       JOIN order_details od ON od.order_id = o.id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [userId]
    );
    const enriched = [];
    for (const order of orders.rows) {
      const ids = order.details.map(d => d.productId);
      if (ids.length > 0) {
        const prods = await pool.query('SELECT id, name, image_url FROM products WHERE id = ANY($1)', [ids]);
        const prodMap = {};
        prods.rows.forEach(p => { prodMap[p.id] = p; });
        order.details = order.details.map(d => ({ ...d, name: prodMap[d.productId]?.name, image_url: prodMap[d.productId]?.image_url }));
      }
      enriched.push(order);
    }
    res.json(enriched);
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/orders/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const orders = await pool.query(
      `SELECT o.id, o.user_id, o.total, o.status, o.created_at,
              u.email AS user_email
       FROM orders o
       JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC LIMIT 100`
    );
    res.json(orders.rows);
  } catch (err) {
    console.error('Get all orders error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.put('/orders/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(status))
      return res.status(400).json({ error: `Estado inválido. Valores: ${allowed.join(', ')}` });
    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, user_id, total, status, created_at',
      [status, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Orden no encontrada' });

    const order = result.rows[0];
    await createNotification(order.user_id, 'order', `Orden #${order.id} ${status}`,
      `El estado de tu orden #${order.id} ha cambiado a: ${status}.`, { orderId: order.id, status });
    logActivity(req.user.userId, req.user.email, 'admin', 'update', `Actualizó orden #${id} a ${status}`, 'order', id, req.ip);

    res.json(order);
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'order-service', version: '1.0.0' }));

app.listen(PORT, () => {
  console.log(`Order service running on port ${PORT}`);
});
