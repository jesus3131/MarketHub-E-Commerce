const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3002;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const isValidUUID = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'carousel-service', 'uploads'));
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext || '.png'}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeType = (file.mimetype || '').split('/')[1] || '';
    const mimeOk = allowed.test(mimeType);
    cb(extOk || mimeOk ? null : new Error('Solo imágenes (jpg, png, gif, webp)'), extOk || mimeOk);
  }
});

app.use('/uploads', express.static(uploadDir));

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Se requieren permisos de administrador' });
  next();
}

async function logActivity(userId, userName, userRole, action, description, targetType, targetId, ip) {
  try {
    await pool.query(
      `INSERT INTO activity_logs (user_id, user_name, user_role, action, description, target_type, target_id, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, userName || '', userRole || '', action, description, targetType, targetId || '', ip || '']
    );
  } catch (err) { console.error('Log activity error:', err); }
}

async function registerMovement(productId, variantId, type, quantity, stockBefore, stockAfter, referenceType, referenceId, notes, userId) {
  try {
    await pool.query(
      `INSERT INTO inventory_movements (product_id, variant_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, notes, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [productId, variantId || null, type, quantity, stockBefore, stockAfter, referenceType || '', referenceId || '', notes || '', userId || null]
    );
  } catch (err) { console.error('Register movement error:', err); }
}

async function checkLowStock(productId, userId) {
  try {
    const result = await pool.query(
      'SELECT name, stock, min_stock FROM products WHERE id = $1 AND stock <= min_stock AND is_active = true',
      [productId]
    );
    if (result.rows.length > 0) {
      const p = result.rows[0];
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'stock', 'Stock bajo', $2, $3)`,
        [userId || 'admin', `El producto "${p.name}" tiene stock bajo: ${p.stock} unidades (mín: ${p.min_stock})`,
         JSON.stringify({ productId, name: p.name, stock: p.stock, minStock: p.min_stock })]
      );
    }
  } catch (err) { console.error('Check low stock error:', err); }
}

// ─── CATEGORIES ────────────────────────────────────────────

app.get('/categories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, slug, description, parent_id, icon, image_url, sort_order, is_active FROM categories ORDER BY sort_order, name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.get('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    const subcats = await pool.query('SELECT id, name, slug FROM categories WHERE parent_id = $1 ORDER BY name', [id]);
    result.rows[0].subcategories = subcats.rows;
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get category error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/categories', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, slug, description, parent_id, icon, image_url, sort_order } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name y slug son requeridos' });
    const result = await pool.query(
      `INSERT INTO categories (name, slug, description, parent_id, icon, image_url, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, slug, description || '', parent_id || null, icon || '', image_url || '', sort_order || 0]
    );
    logActivity(req.user.userId, req.user.email, 'admin', 'create', `Creó categoría: ${name}`, 'category', result.rows[0].id, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create category error:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'El slug ya existe' });
    res.status(500).json({ error: 'Error interno' });
  }
});

app.put('/categories/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, parent_id, icon, image_url, sort_order, is_active } = req.body;
    const result = await pool.query(
      `UPDATE categories SET name = COALESCE($1, name), slug = COALESCE($2, slug),
        description = COALESCE($3, description), parent_id = $4, icon = COALESCE($5, icon),
        image_url = COALESCE($6, image_url), sort_order = COALESCE($7, sort_order),
        is_active = COALESCE($8, is_active), updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 RETURNING *`,
      [name, slug, description, parent_id || null, icon, image_url, sort_order, is_active, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.delete('/categories/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE products SET category_id = NULL WHERE category_id = $1', [id]);
    await pool.query('UPDATE categories SET parent_id = NULL WHERE parent_id = $1', [id]);
    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING name', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ message: 'Categoría eliminada' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── PRODUCTS ──────────────────────────────────────────────

app.get('/products', async (req, res) => {
  try {
    const { search, category, category_id, stock_status, price_min, price_max, sort_by, sort_dir, page, limit: pageSize } = req.query;
    let query = `
      SELECT p.id, p.name, p.description, p.price, p.stock, p.min_stock, p.sku,
             p.image_url, p.category, p.category_id, p.is_active, p.created_at, p.updated_at,
             c.name AS category_name,
             CASE WHEN p.stock <= 0 THEN 'out' WHEN p.stock <= p.min_stock THEN 'low' ELSE 'in' END AS stock_status
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
    `;
    let params = [];
    const conditions = ['1=1'];

    if (search) {
      conditions.push(`(p.name ILIKE $${params.length + 1} OR p.description ILIKE $${params.length + 1} OR p.sku ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (category) {
      conditions.push(`p.category = $${params.length + 1}`);
      params.push(category);
    }
    if (category_id) {
      conditions.push(`(p.category_id = $${params.length + 1} OR p.category_id IN (SELECT id FROM categories WHERE parent_id = $${params.length + 1}))`);
      params.push(category_id);
    }
    if (stock_status === 'low') conditions.push('p.stock > 0 AND p.stock <= p.min_stock');
    else if (stock_status === 'out') conditions.push('p.stock <= 0');
    else if (stock_status === 'in') conditions.push('p.stock > p.min_stock');
    if (price_min) { conditions.push(`p.price >= $${params.length + 1}`); params.push(parseFloat(price_min)); }
    if (price_max) { conditions.push(`p.price <= $${params.length + 1}`); params.push(parseFloat(price_max)); }

    query += ' WHERE ' + conditions.join(' AND ');

    const sortColumn = sort_by || 'p.created_at';
    const sortDirection = sort_dir === 'asc' ? 'ASC' : 'DESC';
    const allowedSort = { 'p.name': true, 'p.price': true, 'p.stock': true, 'p.created_at': true, 'p.updated_at': true };
    const safeSort = allowedSort[sortColumn] ? sortColumn : 'p.created_at';
    query += ` ORDER BY ${safeSort} ${sortDirection}`;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
    const offsetNum = (pageNum - 1) * limitNum;

    const countQuery = `SELECT COUNT(*) FROM products p ${query.includes('WHERE') ? query.substring(query.indexOf('WHERE'), query.indexOf('ORDER BY') > 0 ? query.indexOf('ORDER BY') : query.length) : ''}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitNum, offsetNum);

    const result = await pool.query(query, params);
    res.json({
      products: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.get('/products/all', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description, price, stock, min_stock, sku, image_url, category, category_id, is_active, created_at FROM products ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get all products error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.get('/products/low-stock', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, price, stock, min_stock, sku, image_url
       FROM products WHERE stock > 0 AND stock <= min_stock AND is_active = true
       ORDER BY (stock::float / NULLIF(min_stock, 0)) ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get low stock error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`, [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    const variants = await pool.query(
      'SELECT id, sku, name, price, stock, attributes, image_url, is_active, sort_order FROM product_variants WHERE product_id = $1 ORDER BY sort_order',
      [id]
    );
    result.rows[0].variants = variants.rows;
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/products/upload', authMiddleware, adminMiddleware, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Error al subir imagen' });
    if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });
    const url = `/uploads/${req.file.filename}`;
    logActivity(req.user.userId, req.user.email, 'admin', 'upload_image', `Subió imagen: ${req.file.filename}`, 'image', '', req.ip);
    res.json({ url });
  });
});

app.post('/products', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, description, price, stock, min_stock, sku, image_url, category, category_id } = req.body;
    if (!name || price === undefined || stock === undefined)
      return res.status(400).json({ error: 'name, price y stock son requeridos' });
    if (category_id !== undefined && category_id !== null && !isValidUUID(category_id)) {
      console.warn(`[POST /products] Invalid category_id received: "${category_id}" (type: ${typeof category_id})`);
    }
    const result = await pool.query(
      `INSERT INTO products (name, description, price, stock, min_stock, sku, image_url, category, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, description, price, stock, min_stock, sku, image_url, category, category_id, created_at`,
       [name, description || '', price, stock, min_stock || 5, sku || '', image_url || '', category || '', isValidUUID(category_id) ? category_id : null]
    );
    const product = result.rows[0];
    await registerMovement(product.id, null, 'entry', stock, 0, stock, 'initial', product.id, 'Inventario inicial', req.user.userId);
    logActivity(req.user.userId, req.user.email, 'admin', 'create', `Creó producto: ${name}`, 'product', product.id, req.ip);
    res.status(201).json(product);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.put('/products/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock, min_stock, sku, image_url, category, category_id, is_active } = req.body;
    if (category_id !== undefined && category_id !== null && !isValidUUID(category_id)) {
      console.warn(`[PUT /products/${id}] Invalid category_id received: "${category_id}" (type: ${typeof category_id})`);
    }

    const current = await pool.query('SELECT stock FROM products WHERE id = $1', [id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    const oldStock = parseInt(current.rows[0].stock);

    const result = await pool.query(
      `UPDATE products SET
        name = COALESCE($1, name), description = COALESCE($2, description),
        price = COALESCE($3, price), stock = COALESCE($4, stock),
        min_stock = COALESCE($5, min_stock), sku = COALESCE($6, sku),
        image_url = COALESCE($7, image_url), category = COALESCE($8, category),
        category_id = $9, is_active = COALESCE($10, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING id, name, description, price, stock, min_stock, sku, image_url, category, category_id, is_active, created_at`,
       [name, description, price, stock !== undefined ? parseInt(stock) : undefined,
        min_stock !== undefined ? parseInt(min_stock) : undefined, sku, image_url, category,
        isValidUUID(category_id) ? category_id : null, is_active, id]
    );

    const newStock = parseInt(result.rows[0].stock);
    if (stock !== undefined && newStock !== oldStock) {
      const diff = newStock - oldStock;
      const type = diff > 0 ? 'adjustment' : 'adjustment';
      await registerMovement(id, null, type, Math.abs(diff), oldStock, newStock, 'manual', id, `Ajuste de stock: ${diff > 0 ? '+' : ''}${diff}`, req.user.userId);
      await checkLowStock(id, req.user.userId);
    }

    logActivity(req.user.userId, req.user.email, 'admin', 'update', `Actualizó producto: ${result.rows[0].name}`, 'product', id, req.ip);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.patch('/products/:id/stock', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, type, notes } = req.body;
    if (!quantity || !type) return res.status(400).json({ error: 'quantity y type son requeridos' });

    const current = await pool.query('SELECT stock, name FROM products WHERE id = $1 FOR UPDATE', [id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });

    const oldStock = parseInt(current.rows[0].stock);
    let newStock = oldStock;
    if (type === 'entry' || type === 'return') newStock = oldStock + parseInt(quantity);
    else if (type === 'exit' || type === 'sale') {
      if (oldStock < parseInt(quantity)) return res.status(400).json({ error: 'Stock insuficiente' });
      newStock = oldStock - parseInt(quantity);
    } else if (type === 'adjustment') newStock = parseInt(quantity);

    await pool.query('UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStock, id]);
    await registerMovement(id, null, type, Math.abs(newStock - oldStock), oldStock, newStock, 'manual', id, notes || `Movimiento: ${type}`, req.user.userId);
    await checkLowStock(id);

    res.json({ id, oldStock, newStock, difference: newStock - oldStock, type });
  } catch (err) {
    console.error('Update stock error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.delete('/products/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const prod = await pool.query('SELECT name, image_url FROM products WHERE id = $1', [id]);
    await pool.query('DELETE FROM product_variants WHERE product_id = $1', [id]);
    await pool.query('DELETE FROM inventory_movements WHERE product_id = $1', [id]);
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    if (prod.rows[0]?.image_url) {
      const imgPath = path.join(uploadDir, path.basename(prod.rows[0].image_url));
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    logActivity(req.user.userId, req.user.email, 'admin', 'delete', `Eliminó producto: ${prod.rows[0]?.name || id}`, 'product', id, req.ip);
    res.json({ message: 'Producto eliminado', id });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── PRODUCT VARIANTS ─────────────────────────────────────

app.get('/products/:productId/variants', async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await pool.query(
      'SELECT id, sku, name, price, stock, attributes, image_url, is_active, sort_order FROM product_variants WHERE product_id = $1 ORDER BY sort_order',
      [productId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get variants error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/products/:productId/variants', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;
    const { sku, name, price, stock, attributes, image_url } = req.body;
    const result = await pool.query(
      `INSERT INTO product_variants (product_id, sku, name, price, stock, attributes, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [productId, sku || '', name || '', price || null, stock || 0, JSON.stringify(attributes || {}), image_url || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create variant error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.put('/products/:productId/variants/:variantId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { sku, name, price, stock, attributes, image_url, is_active } = req.body;
    const result = await pool.query(
      `UPDATE product_variants SET
        sku = COALESCE($1, sku), name = COALESCE($2, name),
        price = COALESCE($3, price), stock = COALESCE($4, stock),
        attributes = COALESCE($5, attributes), image_url = COALESCE($6, image_url),
        is_active = COALESCE($7, is_active)
       WHERE id = $8 AND product_id = $9 RETURNING *`,
      [sku, name, price, stock, attributes ? JSON.stringify(attributes) : undefined, image_url, is_active, variantId, productId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Variante no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update variant error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.delete('/products/:productId/variants/:variantId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const result = await pool.query('DELETE FROM product_variants WHERE id = $1 AND product_id = $2 RETURNING id', [variantId, productId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Variante no encontrada' });
    res.json({ message: 'Variante eliminada' });
  } catch (err) {
    console.error('Delete variant error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── INVENTORY MOVEMENTS ──────────────────────────────────

app.get('/inventory/movements', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { product_id, type, limit, offset } = req.query;
    let query = `
      SELECT im.*, p.name AS product_name, p.sku AS product_sku, u.email AS user_email
      FROM inventory_movements im
      LEFT JOIN products p ON p.id = im.product_id
      LEFT JOIN users u ON u.id = im.user_id
      WHERE 1=1
    `;
    let params = [];
    if (product_id) { query += ` AND im.product_id = $${params.length + 1}`; params.push(product_id); }
    if (type) { query += ` AND im.movement_type = $${params.length + 1}`; params.push(type); }
    query += ' ORDER BY im.created_at DESC';
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit) || 50, parseInt(offset) || 0);
    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM inventory_movements');
    res.json({ movements: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error('Get movements error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── INVENTORY SUMMARY ────────────────────────────────────

app.get('/inventory/summary', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalProducts = await pool.query('SELECT COUNT(*)::int AS count FROM products');
    const totalStock = await pool.query('SELECT COALESCE(SUM(stock), 0)::int AS total FROM products');
    const lowStock = await pool.query('SELECT COUNT(*)::int AS count FROM products WHERE stock > 0 AND stock <= min_stock AND is_active = true');
    const outOfStock = await pool.query('SELECT COUNT(*)::int AS count FROM products WHERE stock <= 0 AND is_active = true');
    const totalValue = await pool.query('SELECT COALESCE(SUM(price * stock), 0)::numeric(10,2) AS value FROM products WHERE is_active = true');
    const recentMovements = await pool.query(
      `SELECT im.*, p.name AS product_name FROM inventory_movements im
       LEFT JOIN products p ON p.id = im.product_id
       ORDER BY im.created_at DESC LIMIT 10`
    );
    res.json({
      totalProducts: totalProducts.rows[0].count,
      totalStock: totalStock.rows[0].total,
      lowStock: lowStock.rows[0].count,
      outOfStock: outOfStock.rows[0].count,
      totalValue: totalValue.rows[0].value,
      recentMovements: recentMovements.rows
    });
  } catch (err) {
    console.error('Inventory summary error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── CSV EXPORT ───────────────────────────────────────────

app.get('/products/export/csv', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.name, p.sku, p.price, p.stock, p.min_stock, p.category,
              c.name AS category_name, p.is_active, p.created_at
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.name`
    );
    const headers = ['name', 'sku', 'price', 'stock', 'min_stock', 'category', 'category_name', 'is_active', 'created_at'];
    let csv = headers.join(',') + '\n';
    for (const row of result.rows) {
      csv += headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const s = String(val);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
        return s;
      }).join(',') + '\n';
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="productos.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/products/import/csv', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv) return res.status(400).json({ error: 'CSV requerido' });
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return res.status(400).json({ error: 'CSV debe tener al menos 2 líneas' });
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    let imported = 0, errors = [];
    for (let i = 1; i < lines.length; i++) {
      try {
        const vals = [];
        let cur = '', inQ = false;
        for (const ch of lines[i]) {
          if (ch === '"') { inQ = !inQ; continue; }
          if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; continue; }
          cur += ch;
        }
        vals.push(cur.trim());
        const row = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
        if (!row.name) { errors.push(`Línea ${i}: name requerido`); continue; }
        await pool.query(
          `INSERT INTO products (name, description, price, stock, min_stock, sku, category)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET price = $3, stock = $4`,
          [row.name, row.description || '', parseFloat(row.price) || 0, parseInt(row.stock) || 0,
           parseInt(row.min_stock) || 5, row.sku || '', row.category || '']
        );
        imported++;
      } catch (e) {
        errors.push(`Línea ${i}: ${e.message}`);
      }
    }
    res.json({ imported, errors: errors.slice(0, 20), total: lines.length - 1 });
  } catch (err) {
    console.error('Import CSV error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── CART ─────────────────────────────────────────────────

app.get('/cart/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.userId !== userId) return res.status(403).json({ error: 'No autorizado' });
    const result = await pool.query('SELECT items FROM carts WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) return res.json({ items: [] });
    const items = result.rows[0].items;
    const ids = items.map(i => i.productId);
    if (ids.length === 0) return res.json({ items: [] });
    const products = await pool.query(
      'SELECT id, name, description, price, stock, image_url FROM products WHERE id = ANY($1)',
      [ids]
    );
    const productMap = {};
    products.rows.forEach(p => { productMap[p.id] = p; });
    const enriched = items.map(item => ({
      ...item,
      product: productMap[item.productId] || null
    }));
    res.json({ items: enriched });
  } catch (err) {
    console.error('Get cart error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.put('/cart/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.userId !== userId) return res.status(403).json({ error: 'No autorizado' });
    const { items } = req.body;
    await pool.query(
      'INSERT INTO carts (user_id, items) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO UPDATE SET items = $2::jsonb',
      [userId, JSON.stringify(items || [])]
    );
    res.json({ items: items || [] });
  } catch (err) {
    console.error('Update cart error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── ACTIVITY LOGS ───────────────────────────────────────

app.get('/activities', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const result = await pool.query(
      'SELECT id, user_name, user_role, action, description, target_type, target_id, ip_address, created_at FROM activity_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [parseInt(limit) || 50, parseInt(offset) || 0]
    );
    const count = await pool.query('SELECT COUNT(*) FROM activity_logs');
    res.json({ entries: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    console.error('Get activities error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── NOTIFICATIONS ───────────────────────────────────────

app.get('/notifications/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (String(userId) !== String(req.user.userId) && req.user.role !== 'admin')
      return res.status(403).json({ error: 'No tienes permiso para ver estas notificaciones' });
    const result = await pool.query(
      'SELECT id, user_id, type, title, message, data, read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.put('/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const n = await pool.query('SELECT user_id FROM notifications WHERE id = $1', [id]);
    if (n.rows.length === 0) return res.status(404).json({ error: 'Notificación no encontrada' });
    if (n.rows[0].user_id !== req.user.userId && req.user.role !== 'admin')
      return res.status(403).json({ error: 'No tienes permiso para modificar esta notificación' });
    await pool.query('UPDATE notifications SET read = true WHERE id = $1', [id]);
    res.json({ message: 'Notificación marcada como leída' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.put('/notifications/read-all/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (String(userId) !== String(req.user.userId) && req.user.role !== 'admin')
      return res.status(403).json({ error: 'No tienes permiso para modificar estas notificaciones' });
    await pool.query('UPDATE notifications SET read = true WHERE user_id = $1', [userId]);
    res.json({ message: 'Todas marcadas como leídas' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── STOCK ALERTS ────────────────────────────────────────

app.get('/alerts/low-stock', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, price, stock, min_stock, sku, image_url,
              (stock::float / NULLIF(min_stock, 0)) AS stock_ratio
       FROM products WHERE stock > 0 AND stock <= min_stock AND is_active = true
       ORDER BY stock_ratio ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get alerts error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── PROMOTIONS / DESCUENTOS ──────────────────────────────

app.get('/promotions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM promotions ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get promotions error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/promotions', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, description, discount_percent, status, category_ids, product_ids, start_date, end_date } = req.body;
    const normalizedName = String(name || '').trim();
    const normalizedDiscount = parseInt(discount_percent, 10);
    const normalizedStatus = status === 'inactive' ? 'inactive' : 'active';
    const normalizedCategoryIds = Array.isArray(category_ids) ? category_ids : [];
    const normalizedProductIds = Array.isArray(product_ids) ? product_ids : [];

    if (!normalizedName || Number.isNaN(normalizedDiscount)) {
      return res.status(400).json({ error: 'name y discount_percent son requeridos' });
    }
    if (normalizedDiscount < 1 || normalizedDiscount > 100) {
      return res.status(400).json({ error: 'discount_percent debe estar entre 1 y 100' });
    }
    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ error: 'start_date no puede ser posterior a end_date' });
    }
    const result = await pool.query(
      `INSERT INTO promotions (name, description, discount_percent, status, category_ids, product_ids, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [normalizedName, description || '', normalizedDiscount, normalizedStatus, JSON.stringify(normalizedCategoryIds), JSON.stringify(normalizedProductIds), start_date || null, end_date || null]
    );
    logActivity(req.user.userId, req.user.email, 'admin', 'create', `Creó promoción: ${normalizedName}`, 'promotion', result.rows[0].id, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create promotion error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.put('/promotions/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, discount_percent, status, category_ids, product_ids, start_date, end_date } = req.body;
    const normalizedName = String(name || '').trim();
    const normalizedDiscount = parseInt(discount_percent, 10);
    const normalizedStatus = status === 'inactive' ? 'inactive' : 'active';
    const normalizedCategoryIds = Array.isArray(category_ids) ? category_ids : [];
    const normalizedProductIds = Array.isArray(product_ids) ? product_ids : [];

    if (!normalizedName || Number.isNaN(normalizedDiscount)) {
      return res.status(400).json({ error: 'name y discount_percent son requeridos' });
    }
    if (normalizedDiscount < 1 || normalizedDiscount > 100) {
      return res.status(400).json({ error: 'discount_percent debe estar entre 1 y 100' });
    }
    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ error: 'start_date no puede ser posterior a end_date' });
    }

    const result = await pool.query(
      `UPDATE promotions SET
        name = $1, description = $2,
        discount_percent = $3, status = $4,
        category_ids = $5, product_ids = $6,
        start_date = $7, end_date = $8,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 RETURNING *`,
      [normalizedName, description || '', normalizedDiscount, normalizedStatus, JSON.stringify(normalizedCategoryIds), JSON.stringify(normalizedProductIds), start_date || null, end_date || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Promoción no encontrada' });
    logActivity(req.user.userId, req.user.email, 'admin', 'update', `Actualizó promoción: ${result.rows[0].name}`, 'promotion', id, req.ip);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update promotion error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.delete('/promotions/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const promo = await pool.query('SELECT name FROM promotions WHERE id = $1', [id]);
    const result = await pool.query('DELETE FROM promotions WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Promoción no encontrada' });
    logActivity(req.user.userId, req.user.email, 'admin', 'delete', `Eliminó promoción: ${promo.rows[0]?.name || id}`, 'promotion', id, req.ip);
    res.json({ message: 'Promoción eliminada', id });
  } catch (err) {
    console.error('Delete promotion error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.patch('/promotions/:id/toggle', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const current = await pool.query('SELECT status FROM promotions WHERE id = $1', [id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Promoción no encontrada' });
    const newStatus = current.rows[0].status === 'active' ? 'inactive' : 'active';
    const result = await pool.query(
      'UPDATE promotions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [newStatus, id]
    );
    logActivity(req.user.userId, req.user.email, 'admin', 'toggle', `Cambió estado de promoción "${result.rows[0].name}" a ${newStatus}`, 'promotion', id, req.ip);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Toggle promotion error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'product-service', version: '2.0.0' }));

app.listen(PORT, () => {
  console.log(`Product service running on port ${PORT}`);
});
