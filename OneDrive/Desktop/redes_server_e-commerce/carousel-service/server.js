const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3005;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.use(cors());
app.use(express.json({ limit: '20mb' }));

const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'));
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `carousel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test((file.mimetype || '').split('/')[1]);
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
  } catch (err) { console.error('Log error:', err.message); }
}

async function optimizeImage(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .resize(1920, 800, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toFile(outputPath);
    return true;
  } catch (err) {
    console.error('Image optimization error:', err);
    return false;
  }
}

// ─── GET carousel items (public - active only) ───
app.get('/carousel', async (req, res) => {
  try {
    const now = new Date();
    const result = await pool.query(`
      SELECT ci.*, 
        COALESCE(
          json_agg(
            json_build_object('id', cii.id, 'image_url', cii.image_url, 'alt_text', cii.alt_text, 'sort_order', cii.sort_order)
            ORDER BY cii.sort_order
          ) FILTER (WHERE cii.id IS NOT NULL),
          '[]'
        ) AS images
      FROM carousel_items ci
      LEFT JOIN carousel_item_images cii ON cii.carousel_item_id = ci.id
      WHERE ci.is_active = true
        AND (ci.start_date IS NULL OR ci.start_date <= $1)
        AND (ci.end_date IS NULL OR ci.end_date >= $1)
      GROUP BY ci.id
      ORDER BY ci.order_index
    `, [now]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get carousel error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── GET all carousel items (admin) ───
app.get('/carousel/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ci.*, 
        COALESCE(
          json_agg(
            json_build_object('id', cii.id, 'image_url', cii.image_url, 'alt_text', cii.alt_text, 'sort_order', cii.sort_order)
            ORDER BY cii.sort_order
          ) FILTER (WHERE cii.id IS NOT NULL),
          '[]'
        ) AS images
      FROM carousel_items ci
      LEFT JOIN carousel_item_images cii ON cii.carousel_item_id = ci.id
      GROUP BY ci.id
      ORDER BY ci.order_index
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get all carousel error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── GET single carousel item ───
app.get('/carousel/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Check auth optionally
    let isAdmin = false;
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      try {
        const user = jwt.verify(header.split(' ')[1], JWT_SECRET);
        isAdmin = user.role === 'admin';
      } catch {}
    }
    const result = await pool.query(`
      SELECT ci.*, 
        COALESCE(
          json_agg(
            json_build_object('id', cii.id, 'image_url', cii.image_url, 'alt_text', cii.alt_text, 'sort_order', cii.sort_order)
            ORDER BY cii.sort_order
          ) FILTER (WHERE cii.id IS NOT NULL),
          '[]'
        ) AS images
      FROM carousel_items ci
      LEFT JOIN carousel_item_images cii ON cii.carousel_item_id = ci.id
      WHERE ci.id = $1
      GROUP BY ci.id
    `, [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Item no encontrado' });
    const item = result.rows[0];
    if (!item.is_active && !isAdmin)
      return res.status(404).json({ error: 'Item no encontrado' });
    res.json(item);
  } catch (err) {
    console.error('Get carousel item error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── Upload image ───
app.post('/carousel/upload', authMiddleware, adminMiddleware, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Error al subir imagen' });
    if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });

    const originalPath = req.file.path;
    const ext = path.extname(originalPath);
    const optimizedPath = originalPath.replace(ext, '.webp');

    const optimized = await optimizeImage(originalPath, optimizedPath);
    if (optimized) {
      fs.unlinkSync(originalPath);
      const url = `/uploads/${path.basename(optimizedPath)}`;
      await logActivity(req.user.userId, req.user.email, 'admin', 'upload_image', `Subió imagen carrusel: ${req.file.originalname}`, 'carousel', '', req.ip);
      return res.json({ url, optimized: true });
    }

    const url = `/uploads/${req.file.filename}`;
    await logActivity(req.user.userId, req.user.email, 'admin', 'upload_image', `Subió imagen carrusel: ${req.file.originalname}`, 'carousel', '', req.ip);
    res.json({ url, optimized: false });
  });
});

// ─── CREATE carousel item ───
app.post('/carousel', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, description, image_url, button_text, redirect_url, is_active, order_index, start_date, end_date } = req.body;
    const result = await pool.query(
      `INSERT INTO carousel_items (title, description, image_url, button_text, redirect_url, is_active, order_index, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [title || '', description || '', image_url || '', button_text || 'Saber Más', redirect_url || '#', is_active !== false, order_index || 0, start_date || null, end_date || null]
    );
    const item = result.rows[0];
    await logActivity(req.user.userId, req.user.email, 'admin', 'create', `Creó carrusel: ${item.title}`, 'carousel', item.id, req.ip);
    res.status(201).json(item);
  } catch (err) {
    console.error('Create carousel error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── UPDATE carousel item ───
app.put('/carousel/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, image_url, button_text, redirect_url, is_active, order_index, start_date, end_date } = req.body;
    const result = await pool.query(
      `UPDATE carousel_items SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        image_url = COALESCE($3, image_url),
        button_text = COALESCE($4, button_text),
        redirect_url = COALESCE($5, redirect_url),
        is_active = COALESCE($6, is_active),
        order_index = COALESCE($7, order_index),
        start_date = $8,
        end_date = $9,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [title, description, image_url, button_text, redirect_url, is_active, order_index, start_date || null, end_date || null, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Item no encontrado' });
    const item = result.rows[0];
    await logActivity(req.user.userId, req.user.email, 'admin', 'update', `Actualizó carrusel: ${item.title}`, 'carousel', id, req.ip);
    res.json(item);
  } catch (err) {
    console.error('Update carousel error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── DELETE carousel item ───
app.delete('/carousel/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await pool.query('SELECT title, image_url FROM carousel_items WHERE id = $1', [id]);
    if (item.rows.length === 0)
      return res.status(404).json({ error: 'Item no encontrado' });

    const images = await pool.query('SELECT image_url FROM carousel_item_images WHERE carousel_item_id = $1', [id]);
    for (const img of images.rows) {
      const imgPath = path.join(uploadDir, path.basename(img.image_url));
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await pool.query('DELETE FROM carousel_items WHERE id = $1 RETURNING id', [id]);
    if (item.rows[0]?.image_url) {
      const imgPath = path.join(uploadDir, path.basename(item.rows[0].image_url));
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await logActivity(req.user.userId, req.user.email, 'admin', 'delete', `Eliminó carrusel: ${item.rows[0]?.title || id}`, 'carousel', id, req.ip);
    res.json({ message: 'Item eliminado', id });
  } catch (err) {
    console.error('Delete carousel error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── TOGGLE active status ───
app.patch('/carousel/:id/toggle', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE carousel_items SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, title, is_active`,
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Item no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Toggle carousel error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── REORDER (batch update order_index) ───
app.put('/carousel/reorder/batch', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Se requiere array de items' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of items) {
        await client.query(
          'UPDATE carousel_items SET order_index = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [item.order_index, item.id]
        );
      }
      await client.query('COMMIT');
      res.json({ message: 'Orden actualizado', count: items.length });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Reorder carousel error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── CAROUSEL IMAGES (sub-item images) ───

app.get('/carousel/:id/images', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, image_url, alt_text, sort_order FROM carousel_item_images WHERE carousel_item_id = $1 ORDER BY sort_order',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get images error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/carousel/:id/images', authMiddleware, adminMiddleware, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Error al subir imagen' });
    if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });

    const { id } = req.params;
    const { alt_text } = req.body;

    const originalPath = req.file.path;
    const ext = path.extname(originalPath);
    const optimizedPath = originalPath.replace(ext, '.webp');
    let url = `/uploads/${req.file.filename}`;

    const optimized = await optimizeImage(originalPath, optimizedPath);
    if (optimized) {
      fs.unlinkSync(originalPath);
      url = `/uploads/${path.basename(optimizedPath)}`;
    }

    try {
      const result = await pool.query(
        `INSERT INTO carousel_item_images (carousel_item_id, image_url, alt_text, sort_order)
         VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM carousel_item_images WHERE carousel_item_id = $1))
         RETURNING id, image_url, alt_text, sort_order`,
        [id, url, alt_text || '']
      );
      res.status(201).json(result.rows[0]);
    } catch (dbErr) {
      console.error('Save image error:', dbErr);
      res.status(500).json({ error: 'Error al guardar imagen' });
    }
  });
});

app.put('/carousel/:itemId/images/:imageId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { itemId, imageId } = req.params;
    const { alt_text, sort_order } = req.body;
    const result = await pool.query(
      `UPDATE carousel_item_images SET alt_text = COALESCE($1, alt_text), sort_order = COALESCE($2, sort_order)
       WHERE id = $3 AND carousel_item_id = $4 RETURNING id, image_url, alt_text, sort_order`,
      [alt_text, sort_order, imageId, itemId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Imagen no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update image error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.delete('/carousel/:itemId/images/:imageId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { itemId, imageId } = req.params;
    const img = await pool.query('SELECT image_url FROM carousel_item_images WHERE id = $1 AND carousel_item_id = $2', [imageId, itemId]);
    if (img.rows.length === 0)
      return res.status(404).json({ error: 'Imagen no encontrada' });

    await pool.query('DELETE FROM carousel_item_images WHERE id = $1', [imageId]);

    if (img.rows[0]?.image_url) {
      const imgPath = path.join(uploadDir, path.basename(img.rows[0].image_url));
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    res.json({ message: 'Imagen eliminada', id: imageId });
  } catch (err) {
    console.error('Delete image error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── Health check ───
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'carousel-service', version: '2.0.0' }));

app.listen(PORT, () => {
  console.log(`Carousel service running on port ${PORT}`);
});
