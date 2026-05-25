-- Inicialización de la base de datos para el ecosistema e-commerce
-- Crea tablas, extensiones y datos iniciales
-- NOTA: Esquema actualizado para usar UUIDs (compatible con PostgreSQL 15+)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. TABLAS BASE
-- ============================================================

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    name VARCHAR(255) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de categorías (con jerarquía)
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    icon VARCHAR(100) DEFAULT '',
    image_url TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);

-- Tabla de productos
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    min_stock INTEGER DEFAULT 5,
    sku VARCHAR(100) DEFAULT '',
    image_url TEXT DEFAULT '',
    category VARCHAR(255) DEFAULT '',
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Variantes de productos
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) DEFAULT '',
    name VARCHAR(255) NOT NULL DEFAULT '',
    price NUMERIC(10,2) DEFAULT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    attributes JSONB DEFAULT '{}',
    image_url TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);

-- Tabla de órdenes
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(created_at);

-- Detalles de orden
CREATE TABLE IF NOT EXISTS order_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_details_order ON order_details(order_id);
CREATE INDEX IF NOT EXISTS idx_order_details_product ON order_details(product_id);

-- ============================================================
-- 2. CARRUSEL (profesional con programación)
-- ============================================================

CREATE TABLE IF NOT EXISTS carousel_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    button_text VARCHAR(100) DEFAULT 'Saber Más',
    redirect_url VARCHAR(500) DEFAULT '#',
    is_active BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    start_date TIMESTAMP DEFAULT NULL,
    end_date TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_carousel_items_active ON carousel_items(is_active);
CREATE INDEX IF NOT EXISTS idx_carousel_items_order ON carousel_items(order_index);
CREATE INDEX IF NOT EXISTS idx_carousel_items_dates ON carousel_items(start_date, end_date);

CREATE TABLE IF NOT EXISTS carousel_item_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    carousel_item_id UUID NOT NULL REFERENCES carousel_items(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text VARCHAR(255) DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_carousel_item_images_item ON carousel_item_images(carousel_item_id);

-- Tablas legacy (mantenidas para compatibilidad)
CREATE TABLE IF NOT EXISTS carousel_slides (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    cta_text VARCHAR(100),
    cta_link VARCHAR(500),
    image_url TEXT,
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS carousel_images (
    id SERIAL PRIMARY KEY,
    slide_id INTEGER NOT NULL REFERENCES carousel_slides(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. INVENTARIO Y MOVIMIENTOS
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('entry', 'exit', 'adjustment', 'sale', 'return', 'transfer')),
    quantity INTEGER NOT NULL,
    stock_before INTEGER NOT NULL DEFAULT 0,
    stock_after INTEGER NOT NULL DEFAULT 0,
    reference_type VARCHAR(100) DEFAULT '',
    reference_id VARCHAR(255) DEFAULT '',
    notes TEXT DEFAULT '',
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_user ON inventory_movements(user_id);

-- ============================================================
-- 4. PROMOCIONES Y DESCUENTOS
-- ============================================================

CREATE TABLE IF NOT EXISTS promotions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    discount_percent INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    category_ids TEXT DEFAULT '[]',
    product_ids TEXT DEFAULT '[]',
    start_date DATE,
    end_date DATE,
    usage_count INTEGER DEFAULT 0,
    impact VARCHAR(20) DEFAULT 'Medio',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promotions_status ON promotions(status);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);

-- ============================================================
-- 5. CARRITO, LOGS, NOTIFICACIONES
-- ============================================================

CREATE TABLE IF NOT EXISTS carts (
    id SERIAL PRIMARY KEY,
    user_id UUID UNIQUE REFERENCES users(id),
    items JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    user_name VARCHAR(255),
    user_role VARCHAR(50),
    action VARCHAR(100),
    description TEXT,
    target_type VARCHAR(100),
    target_id VARCHAR(255),
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    data JSONB,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS generated_reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(100),
    data JSONB,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. VISTAS PARA REPORTES
-- ============================================================

CREATE OR REPLACE VIEW v_daily_sales AS
SELECT 
    DATE(o.created_at) AS sale_date,
    COUNT(o.id) AS order_count,
    SUM(o.total)::NUMERIC(10,2) AS total_revenue,
    COUNT(DISTINCT o.user_id) AS unique_customers
FROM orders o
WHERE o.status = 'confirmed'
GROUP BY DATE(o.created_at)
ORDER BY sale_date DESC;

CREATE OR REPLACE VIEW v_product_performance AS
SELECT 
    p.id,
    p.name,
    p.category,
    p.price,
    p.stock,
    p.min_stock,
    COALESCE(SUM(od.quantity), 0) AS units_sold,
    COALESCE(SUM(od.quantity * od.price), 0)::NUMERIC(10,2) AS total_revenue,
    COALESCE(COUNT(DISTINCT o.id), 0) AS order_count
FROM products p
LEFT JOIN order_details od ON od.product_id = p.id
LEFT JOIN orders o ON o.id = od.order_id AND o.status = 'confirmed'
GROUP BY p.id
ORDER BY total_revenue DESC;

-- ============================================================
-- 7. DATOS INICIALES
-- ============================================================

-- Contraseñas generadas con bcryptjs (compatibles con auth-service)
-- admin@ecommerce.com / admin123
-- cliente1@ecommerce.com / cliente123
-- cliente2@ecommerce.com / cliente456
-- NOTA: Los hashes de bcrypt varian segun el salt generado.
-- Si los usuarios seed no pueden iniciar sesion, genera nuevos hashes:
--   cd /opt/ecommerce/auth-service && node -e "const b=require('bcryptjs'),s=b.genSaltSync(10);console.log(b.hashSync('admin123',s));console.log(b.hashSync('cliente123',s));console.log(b.hashSync('cliente456',s));"
INSERT INTO users (email, password, role, name) VALUES
    ('admin@ecommerce.com', '$2a$10$tCgd8IRK/UsLA88Gm3woUe56ZBpRnYoYPXRRESXQ0N8PK7QkWu0pS', 'admin', 'Admin'),
    ('cliente1@ecommerce.com', '$2a$10$tCgd8IRK/UsLA88Gm3woUeInNQIpAyx.CmdigcOur6qTslziRuKVS', 'user', 'Cliente Uno'),
    ('cliente2@ecommerce.com', '$2a$10$tCgd8IRK/UsLA88Gm3woUeFofMaUWxuzg2HL3NLnfLsmopO9gWMVi', 'user', 'Cliente Dos')
ON CONFLICT (email) DO NOTHING;

-- Categorías
INSERT INTO categories (name, slug, description, icon, sort_order) VALUES
    ('Electrónica', 'electronica', 'Productos electrónicos y gadgets', 'laptop', 1),
    ('Moda', 'moda', 'Ropa y accesorios', 'checkroom', 2),
    ('Hogar', 'hogar', 'Artículos para el hogar', 'chair', 3),
    ('Deportes', 'deportes', 'Equipamiento deportivo', 'sports_soccer', 4),
    ('Libros', 'libros', 'Libros y material educativo', 'menu_book', 5),
    ('Juguetes', 'juguetes', 'Juguetes y entretenimiento', 'toys', 6)
ON CONFLICT (slug) DO NOTHING;

-- Productos
INSERT INTO products (name, description, price, stock, min_stock, sku, category) VALUES
    ('Laptop HP Pavilion 15', 'Laptop con procesador Intel Core i5, 8GB RAM, 256GB SSD', 899.99, 10, 3, 'LAP-HP-001', 'Electrónica'),
    ('Mouse Inalámbrico Logitech M720', 'Mouse ergonómico inalámbrico con conexión Bluetooth', 25.50, 50, 10, 'MOU-LOG-001', 'Electrónica'),
    ('Teclado Mecánico Redragon Kumara', 'Teclado mecánico RGB con switches Outemu Blue', 89.99, 30, 5, 'TEC-RED-001', 'Electrónica'),
    ('Monitor Samsung 27" IPS', 'Monitor 27 pulgadas IPS 4K UHD', 349.99, 15, 3, 'MON-SAM-001', 'Electrónica'),
    ('Audífonos Bluetooth Sony WH-1000XM5', 'Audífonos inalámbricos con cancelación de ruido activa', 59.99, 25, 5, 'AUD-SON-001', 'Electrónica'),
    ('Camiseta básica', 'Camiseta de algodón 100% en varios colores', 19.99, 100, 20, 'CAM-BAS-001', 'Moda'),
    ('Auriculares inalámbricos', 'Auriculares deportivos Bluetooth 5.0', 79.99, 25, 5, 'AUR-GEN-001', 'Electrónica'),
    ('Mochila urbana', 'Mochila impermeable con compartimento para laptop', 49.50, 40, 8, 'MOCH-URB-001', 'Moda'),
    ('Taza de cerámica', 'Taza de cerámica esmaltada 350ml', 9.90, 200, 30, 'TAZ-CER-001', 'Hogar')
ON CONFLICT DO NOTHING;
