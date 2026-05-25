const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3004;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/reports/ws' });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '5mb' }));

// ─── Cache en memoria ───
const cache = {
  data: null,
  timestamp: 0,
  ttl: 30000 // 30 segundos
};

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
  if (!req.user || req.user.role !== 'admin')
    return res.status(403).json({ error: 'Se requieren permisos de administrador' });
  next();
}

// ─── WebSocket: notificaciones en tiempo real ───
const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// ─── Consultas internas (el frontend NO accede directamente) ───
async function getDashboardData() {
  const now = Date.now();
  if (cache.data && (now - cache.timestamp) < cache.ttl) return cache.data;

  const totalRevenue = await pool.query(`SELECT COALESCE(SUM(total),0)::NUMERIC(10,2) AS revenue FROM orders WHERE status='confirmed'`);
  const totalOrders = await pool.query(`SELECT COUNT(*)::int AS count FROM orders`);
  const totalProducts = await pool.query(`SELECT COUNT(*)::int AS count FROM products WHERE is_active = true`);
  const totalUsers = await pool.query(`SELECT COUNT(*)::int AS count FROM users`);
  const ordersByStatus = await pool.query(`SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status`);
  const lowStockCount = await pool.query(`SELECT COUNT(*)::int AS count FROM products WHERE stock > 0 AND stock <= min_stock AND is_active = true`);
  const outOfStockCount = await pool.query(`SELECT COUNT(*)::int AS count FROM products WHERE stock <= 0 AND is_active = true`);

  const recentOrders = await pool.query(`
    SELECT o.id, o.total, o.status, o.created_at, u.email AS user_email,
      COALESCE((SELECT json_agg(json_build_object('name', p.name, 'quantity', od.quantity))
                FROM order_details od JOIN products p ON p.id = od.product_id WHERE od.order_id = o.id), '[]') AS items
    FROM orders o JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC LIMIT 5
  `);

  const topProducts = await pool.query(`
    SELECT p.name, p.image_url, COALESCE(SUM(od.quantity),0)::int AS sold,
           COALESCE(SUM(od.quantity * od.price),0)::NUMERIC(10,2) AS revenue
    FROM order_details od JOIN products p ON p.id = od.product_id
    JOIN orders o ON o.id = od.order_id WHERE o.status = 'confirmed'
    GROUP BY p.id ORDER BY revenue DESC LIMIT 5
  `);

  const monthlySales = await pool.query(`
    SELECT TO_CHAR(o.created_at, 'YYYY-MM') AS month,
           COUNT(o.id)::int AS total_orders,
           SUM(o.total)::NUMERIC(10,2) AS total_revenue
    FROM orders o WHERE o.status = 'confirmed'
    GROUP BY month ORDER BY month DESC LIMIT 12
  `);

  const dailyRevenue = await pool.query(`
    SELECT DATE(o.created_at) AS date,
           COUNT(o.id)::int AS orders,
           SUM(o.total)::NUMERIC(10,2) AS revenue
    FROM orders o WHERE o.status = 'confirmed' AND o.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(o.created_at) ORDER BY date DESC
  `);

  const conversionRate = await pool.query(`
    SELECT COUNT(DISTINCT o.user_id)::int AS total_users,
           COUNT(DISTINCT CASE WHEN o.status = 'confirmed' THEN o.user_id END)::int AS converted_users,
           ROUND(COUNT(DISTINCT CASE WHEN o.status = 'confirmed' THEN o.user_id END)::NUMERIC / NULLIF(COUNT(DISTINCT o.user_id), 0) * 100, 2)::NUMERIC(5,2) AS conversion_rate
    FROM orders o
  `);

  const avgOrderValue = await pool.query(`
    SELECT ROUND(AVG(o.total), 2)::NUMERIC(10,2) AS avg_value,
           MAX(o.total)::NUMERIC(10,2) AS max_value
    FROM orders o WHERE o.status = 'confirmed'
  `);

  const inventoryValue = await pool.query(`SELECT COALESCE(SUM(price * stock), 0)::NUMERIC(10,2) AS value FROM products WHERE is_active = true`);

  const recentActivities = await pool.query(
    `SELECT id, user_name, action, description, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 10`
  );

  const newUsers = await pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE created_at >= NOW() - INTERVAL '7 days'`);

  const data = {
    revenue: totalRevenue.rows[0].revenue,
    orderCount: totalOrders.rows[0].count,
    productCount: totalProducts.rows[0].count,
    userCount: totalUsers.rows[0].count,
    ordersByStatus: ordersByStatus.rows,
    recentOrders: recentOrders.rows,
    topProducts: topProducts.rows,
    monthlySales: monthlySales.rows,
    dailyRevenue: dailyRevenue.rows,
    lowStockCount: lowStockCount.rows[0].count,
    outOfStockCount: outOfStockCount.rows[0].count,
    conversionRate: conversionRate.rows[0],
    avgOrderValue: avgOrderValue.rows[0],
    inventoryValue: inventoryValue.rows[0].value,
    recentActivities: recentActivities.rows,
    newUsersLastWeek: newUsers.rows[0].count
  };

  cache.data = data;
  cache.timestamp = now;
  return data;
}

async function getStatsData() {
  const monthly = await pool.query(`
    SELECT TO_CHAR(o.created_at, 'YYYY-MM') AS month,
           COUNT(o.id)::int AS total_orders,
           SUM(o.total)::NUMERIC(10,2) AS total_revenue
    FROM orders o WHERE o.status = 'confirmed'
    GROUP BY month ORDER BY month
  `);

  const categorySales = await pool.query(`
    SELECT COALESCE(p.category, 'Sin categoría') AS category,
           COUNT(od.id)::int AS items_sold,
           SUM(od.quantity * od.price)::NUMERIC(10,2) AS revenue
    FROM order_details od JOIN products p ON p.id = od.product_id
    JOIN orders o ON o.id = od.order_id WHERE o.status = 'confirmed'
    GROUP BY p.category ORDER BY revenue DESC
  `);

  const statusDist = await pool.query(`SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status`);

  const topProducts = await pool.query(`
    SELECT p.name, p.price, p.image_url,
           SUM(od.quantity)::int AS units_sold,
           SUM(od.quantity * od.price)::NUMERIC(10,2) AS revenue
    FROM order_details od JOIN products p ON p.id = od.product_id
    JOIN orders o ON o.id = od.order_id WHERE o.status = 'confirmed'
    GROUP BY p.id, p.name, p.price, p.image_url
    ORDER BY revenue DESC LIMIT 10
  `);

  const last30Days = await pool.query(`
    SELECT DATE(o.created_at) AS date,
           COUNT(o.id)::int AS orders,
           SUM(o.total)::NUMERIC(10,2) AS revenue
    FROM orders o WHERE o.status = 'confirmed' AND o.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(o.created_at) ORDER BY date DESC
  `);

  const newUsers = await pool.query(`
    SELECT DATE(created_at) AS date, COUNT(*)::int AS count
    FROM users WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at) ORDER BY date DESC
  `);

  return {
    monthly: monthly.rows,
    categorySales: categorySales.rows,
    statusDist: statusDist.rows,
    topProducts: topProducts.rows,
    last30Days: last30Days.rows,
    newUsers: newUsers.rows
  };
}

// ─── ENDPOINT ÚNICO: dashboard (frontend consume automáticamente) ───
app.get('/api/dashboard', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const data = await getDashboardData();
    res.json(data);
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
});

// ─── ENDPOINT ÚNICO: stats (frontend consume automáticamente) ───
app.get('/api/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const data = await getStatsData();
    res.json(data);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// ─── ENDPOINT ÚNICO: trends (frontend consume automáticamente) ───
app.get('/api/trends', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const conversionRate = await pool.query(`
      SELECT COUNT(DISTINCT o.user_id)::int AS total_users,
             COUNT(DISTINCT CASE WHEN o.status = 'confirmed' THEN o.user_id END)::int AS converted_users,
             ROUND(COUNT(DISTINCT CASE WHEN o.status = 'confirmed' THEN o.user_id END)::NUMERIC / NULLIF(COUNT(DISTINCT o.user_id), 0) * 100, 2)::NUMERIC(5,2) AS conversion_rate
      FROM orders o
    `);
    const avgOrderValue = await pool.query(`
      SELECT ROUND(AVG(o.total), 2)::NUMERIC(10,2) AS avg_value,
             MAX(o.total)::NUMERIC(10,2) AS max_value,
             MIN(o.total)::NUMERIC(10,2) AS min_value
      FROM orders o WHERE o.status = 'confirmed'
    `);
    const weeklyTrend = await pool.query(`
      SELECT DATE_TRUNC('week', o.created_at)::DATE AS week,
             COUNT(o.id)::int AS orders,
             SUM(o.total)::NUMERIC(10,2) AS revenue
      FROM orders o WHERE o.status = 'confirmed' AND o.created_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY DATE_TRUNC('week', o.created_at) ORDER BY week DESC
    `);
    res.json({
      conversionRate: conversionRate.rows[0],
      avgOrderValue: avgOrderValue.rows[0],
      weeklyTrend: weeklyTrend.rows
    });
  } catch (err) {
    console.error('Trends error:', err);
    res.status(500).json({ error: 'Error al obtener tendencias' });
  }
});

// ─── EXPORT CSV ──────────────────────────────────────────
app.get('/api/export/csv/:type', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { type } = req.params;
    let data, filename, fields;

    if (type === 'sales') {
      data = await pool.query(`
        SELECT o.id AS order_id, u.email AS user_email, o.total, o.status, o.created_at
        FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC
      `);
      filename = 'ventas.csv';
      fields = ['order_id', 'user_email', 'total', 'status', 'created_at'];
    } else if (type === 'products') {
      data = await pool.query(`
        SELECT p.name, p.sku, p.price, p.stock, p.min_stock, p.category,
               COALESCE(SUM(od.quantity),0) AS units_sold,
               COALESCE(SUM(od.quantity * od.price),0)::NUMERIC(10,2) AS revenue
        FROM products p LEFT JOIN order_details od ON od.product_id = p.id
        LEFT JOIN orders o ON o.id = od.order_id AND o.status = 'confirmed'
        GROUP BY p.id ORDER BY revenue DESC
      `);
      filename = 'productos.csv';
      fields = ['name', 'sku', 'price', 'stock', 'min_stock', 'category', 'units_sold', 'revenue'];
    } else if (type === 'activities') {
      data = await pool.query(`
        SELECT user_name, user_role, action, description, target_type, target_id, ip_address, created_at
        FROM activity_logs ORDER BY created_at DESC
      `);
      filename = 'actividades.csv';
      fields = ['user_name', 'user_role', 'action', 'description', 'target_type', 'target_id', 'ip_address', 'created_at'];
    } else if (type === 'orders') {
      data = await pool.query(`
        SELECT o.id, u.email AS user, o.total, o.status, o.created_at,
               (SELECT COUNT(*) FROM order_details WHERE order_id = o.id) AS items_count
        FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC
      `);
      filename = 'ordenes.csv';
      fields = ['id', 'user', 'total', 'status', 'created_at', 'items_count'];
    } else {
      return res.status(400).json({ error: 'Tipo no válido. Tipos: sales, products, activities, orders' });
    }

    const parser = new Parser({ fields });
    const csv = parser.parse(data.rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({ error: 'Error al exportar CSV' });
  }
});

// ─── EXPORT EXCEL ────────────────────────────────────────
app.get('/api/export/excel/:type', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { type } = req.params;
    let data, filename;

    if (type === 'sales') {
      data = await pool.query(`
        SELECT o.id AS order_id, u.email AS user_email, o.total, o.status, o.created_at
        FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC
      `);
      filename = 'ventas.xlsx';
    } else if (type === 'products') {
      data = await pool.query(`
        SELECT p.name, p.sku, p.price, p.stock, p.min_stock, p.category,
               COALESCE(SUM(od.quantity),0) AS units_sold,
               COALESCE(SUM(od.quantity * od.price),0)::NUMERIC(10,2) AS revenue
        FROM products p LEFT JOIN order_details od ON od.product_id = p.id
        LEFT JOIN orders o ON o.id = od.order_id AND o.status = 'confirmed'
        GROUP BY p.id ORDER BY revenue DESC
      `);
      filename = 'productos.xlsx';
    } else if (type === 'dashboard') {
      const dashboard = await getDashboardData();
      const workbook = new ExcelJS.Workbook();
      const summarySheet = workbook.addWorksheet('Resumen');
      summarySheet.columns = [
        { header: 'Métrica', key: 'metric', width: 25 },
        { header: 'Valor', key: 'value', width: 20 }
      ];
      summarySheet.addRows([
        { metric: 'Ingresos Totales', value: `$${dashboard.revenue}` },
        { metric: 'Órdenes Totales', value: dashboard.orderCount },
        { metric: 'Productos', value: dashboard.productCount },
        { metric: 'Usuarios', value: dashboard.userCount },
        { metric: 'Stock Bajo', value: dashboard.lowStockCount },
        { metric: 'Agotados', value: dashboard.outOfStockCount },
        { metric: 'Valor Inventario', value: `$${dashboard.inventoryValue}` },
        { metric: 'Tasa Conversión', value: `${dashboard.conversionRate?.conversion_rate || 0}%` },
        { metric: 'Valor Promedio Orden', value: `$${dashboard.avgOrderValue?.avg_value || 0}` }
      ]);

      const salesSheet = workbook.addWorksheet('Ventas Mensuales');
      salesSheet.columns = [
        { header: 'Mes', key: 'month', width: 15 },
        { header: 'Órdenes', key: 'orders', width: 15 },
        { header: 'Ingresos', key: 'revenue', width: 20 }
      ];
      if (dashboard.monthlySales) salesSheet.addRows(dashboard.monthlySales);

      const productsSheet = workbook.addWorksheet('Top Productos');
      productsSheet.columns = [
        { header: 'Producto', key: 'name', width: 30 },
        { header: 'Vendidos', key: 'sold', width: 15 },
        { header: 'Ingresos', key: 'revenue', width: 20 }
      ];
      if (dashboard.topProducts) productsSheet.addRows(dashboard.topProducts);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="dashboard.xlsx"`);
      await workbook.xlsx.write(res);
      return res.end();
    } else {
      return res.status(400).json({ error: 'Tipo no válido. Tipos: sales, products, dashboard' });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(type);
    const rows = data.rows;
    if (rows.length > 0) {
      sheet.columns = Object.keys(rows[0]).map(k => ({ header: k, key: k, width: 20 }));
      sheet.addRows(rows);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export Excel error:', err);
    res.status(500).json({ error: 'Error al exportar Excel' });
  }
});

// ─── EXPORT PDF ──────────────────────────────────────────
app.get('/api/export/pdf/:type', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { type } = req.params;
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-reporte.pdf"`);
    doc.pipe(res);

    doc.fontSize(22).font('Helvetica-Bold').text('MarketHub - Reporte', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(`Generado: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    if (type === 'dashboard') {
      const data = await getDashboardData();
      doc.fontSize(16).font('Helvetica-Bold').text('Resumen General');
      doc.moveDown(0.5);
      const metrics = [
        ['Ingresos Totales', `$${data.revenue}`],
        ['Órdenes', String(data.orderCount)],
        ['Productos', String(data.productCount)],
        ['Usuarios', String(data.userCount)],
        ['Stock Bajo', String(data.lowStockCount)],
        ['Valor Inventario', `$${data.inventoryValue}`]
      ];
      metrics.forEach(([k, v]) => {
        doc.fontSize(11).font('Helvetica').text(`${k}: `, { continued: true }).font('Helvetica-Bold').text(v);
      });
      doc.moveDown();

      if (data.topProducts?.length) {
        doc.fontSize(14).font('Helvetica-Bold').text('Top Productos');
        data.topProducts.forEach((p, i) => {
          doc.fontSize(10).font('Helvetica').text(`${i + 1}. ${p.name} - ${p.sold} vendidos - $${p.revenue}`);
        });
      }
    } else if (type === 'sales') {
      const data = await pool.query(`
        SELECT o.id, u.email AS user, o.total, o.status, o.created_at
        FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 50
      `);
      doc.fontSize(14).font('Helvetica-Bold').text('Ventas Recientes');
      doc.moveDown(0.5);
      data.rows.forEach((r) => {
        doc.fontSize(9).font('Helvetica')
          .text(`#${r.id} | ${r.user} | $${r.total} | ${r.status} | ${new Date(r.created_at).toLocaleDateString()}`);
      });
    } else {
      doc.fontSize(12).text(`Reporte: ${type}`);
    }

    doc.end();
  } catch (err) {
    console.error('Export PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Error al exportar PDF' });
  }
});

// ─── IMPORT CSV ──────────────────────────────────────────
app.post('/api/import/csv', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const csvText = typeof req.body === 'string' ? req.body : '';
    if (!csvText.trim()) return res.status(400).json({ error: 'CSV vacío' });

    const lines = csvText.trim().split('\n');
    if (!lines.length) return res.status(400).json({ error: 'Sin datos en CSV' });

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
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
      rows.push(row);
    }

    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `import_${Date.now()}.csv`;
    fs.writeFileSync(path.join(dir, filename), csvText);

    res.json({
      message: `CSV importado: ${rows.length} filas, ${headers.length} columnas`,
      filename,
      headers,
      preview: rows.slice(0, 5),
      total: rows.length
    });
  } catch (err) {
    console.error('CSV upload error:', err);
    res.status(500).json({ error: 'Error al procesar CSV' });
  }
});

// ─── REPORTS WITH FILTERS ────────────────────────────
// ─── Sales by category (with optional date range) ───
app.get('/api/reports/sales-by-category', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let whereClause = "o.status = 'confirmed'";
    const params = [];
    if (startDate) { params.push(startDate); whereClause += ` AND o.created_at >= $${params.length}::DATE`; }
    if (endDate) { params.push(endDate); whereClause += ` AND o.created_at <= $${params.length}::DATE + INTERVAL '1 day'`; }

    const result = await pool.query(`
      SELECT c.id AS category_id, c.name AS category,
             COUNT(od.id)::int AS items_sold,
             COUNT(DISTINCT o.id)::int AS order_count,
             SUM(od.quantity * od.price)::NUMERIC(10,2) AS revenue,
             COUNT(DISTINCT p.id)::int AS product_count
      FROM order_details od
      JOIN products p ON p.id = od.product_id
      JOIN orders o ON o.id = od.order_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${whereClause}
      GROUP BY c.id, c.name ORDER BY revenue DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Sales by category error:', err);
    res.status(500).json({ error: 'Error al obtener ventas por categoría' });
  }
});

// ─── Product performance ───
app.get('/api/reports/product-performance', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, categoryId, limit } = req.query;
    let whereClause = "o.status = 'confirmed'";
    const params = [];
    let paramIdx = 1;
    if (startDate) { params.push(startDate); whereClause += ` AND o.created_at >= $${paramIdx++}::DATE`; }
    if (endDate) { params.push(endDate); whereClause += ` AND o.created_at <= $${paramIdx++}::DATE + INTERVAL '1 day'`; }
    if (categoryId) { params.push(categoryId); whereClause += ` AND p.category_id = $${paramIdx++}`; }

    const result = await pool.query(`
      SELECT p.id, p.name, p.price, p.stock, p.image_url, p.category,
             c.name AS category_name,
             COALESCE(SUM(od.quantity), 0)::int AS units_sold,
             COALESCE(SUM(od.quantity * od.price), 0)::NUMERIC(10,2) AS revenue,
             COUNT(DISTINCT o.id)::int AS order_count
      FROM products p
      LEFT JOIN order_details od ON od.product_id = p.id
      LEFT JOIN orders o ON o.id = od.order_id AND (${whereClause} OR o.id IS NULL)
      LEFT JOIN categories c ON c.id = p.category_id
      GROUP BY p.id, p.name, p.price, p.stock, p.image_url, p.category, c.name
      ORDER BY revenue DESC${limit ? ` LIMIT ${parseInt(limit)}` : ''}
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Product performance error:', err);
    res.status(500).json({ error: 'Error al obtener rendimiento de productos' });
  }
});

// ─── Trend data with date range ───
app.get('/api/reports/trends', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, granularity = 'day' } = req.query;
    let whereClause = "o.status = 'confirmed'";
    const params = [];
    let paramIdx = 1;
    if (startDate) { params.push(startDate); whereClause += ` AND o.created_at >= $${paramIdx++}::DATE`; }
    if (endDate) { params.push(endDate); whereClause += ` AND o.created_at <= $${paramIdx++}::DATE + INTERVAL '1 day'`; }

    const groupExpr = granularity === 'week' ? "DATE_TRUNC('week', o.created_at)::DATE"
      : granularity === 'month' ? "DATE_TRUNC('month', o.created_at)::DATE"
      : "DATE(o.created_at)";

    const result = await pool.query(`
      SELECT ${groupExpr} AS date,
             COUNT(o.id)::int AS orders,
             COUNT(DISTINCT o.user_id)::int AS unique_customers,
             SUM(o.total)::NUMERIC(10,2) AS revenue,
             ROUND(AVG(o.total), 2)::NUMERIC(10,2) AS avg_order_value
      FROM orders o
      WHERE ${whereClause}
      GROUP BY ${groupExpr} ORDER BY date
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Trends report error:', err);
    res.status(500).json({ error: 'Error al obtener tendencias' });
  }
});

// ─── Order status distribution ───
app.get('/api/reports/order-status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let whereClause = '1=1';
    const params = [];
    if (startDate) { params.push(startDate); whereClause += ` AND created_at >= $${params.length}::DATE`; }
    if (endDate) { params.push(endDate); whereClause += ` AND created_at <= $${params.length}::DATE + INTERVAL '1 day'`; }

    const result = await pool.query(`
      SELECT status, COUNT(*)::int AS count, SUM(total)::NUMERIC(10,2) AS total_revenue
      FROM orders WHERE ${whereClause}
      GROUP BY status ORDER BY count DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Order status error:', err);
    res.status(500).json({ error: 'Error al obtener distribución de órdenes' });
  }
});

// ─── Summary metrics (with date range) ───
app.get('/api/reports/summary', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let whereClause = "o.status = 'confirmed'";
    const params = [];
    let paramIdx = 1;
    if (startDate) { params.push(startDate); whereClause += ` AND o.created_at >= $${paramIdx++}::DATE`; }
    if (endDate) { params.push(endDate); whereClause += ` AND o.created_at <= $${paramIdx++}::DATE + INTERVAL '1 day'`; }

    const revenue = await pool.query(`
      SELECT COALESCE(SUM(o.total),0)::NUMERIC(10,2) AS total_revenue,
             COUNT(o.id)::int AS total_orders,
             COUNT(DISTINCT o.user_id)::int AS total_customers,
             ROUND(AVG(o.total), 2)::NUMERIC(10,2) AS avg_order_value
      FROM orders o WHERE ${whereClause}
    `, params);

    res.json(revenue.rows[0]);
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

// ─── REFRESH CACHE ───────────────────────────────────────
app.post('/api/cache/refresh', authMiddleware, adminMiddleware, async (req, res) => {
  cache.data = null;
  cache.timestamp = 0;
  const data = await getDashboardData();
  broadcast({ type: 'cache_refresh', timestamp: new Date().toISOString() });
  res.json({ message: 'Caché renovado', timestamp: new Date().toISOString() });
});

// ─── HEALTH ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'report-service', version: '2.0.0' }));

// ─── REFRESH periódico (cada 30 segundos) ───
setInterval(async () => {
  try {
    cache.data = null;
    cache.timestamp = 0;
    const data = await getDashboardData();
    broadcast({ type: 'auto_update', data });
  } catch (e) {
    console.error('Auto-refresh error:', e.message);
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`Report service running on port ${PORT} (WebSocket: /reports/ws)`);
});
