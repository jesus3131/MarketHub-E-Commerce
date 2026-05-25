-- Migration: New tables for Carousel, Inventory, Reports modules
-- Ejecutar en PostgreSQL 18

BEGIN;

-- ============================================================
-- 1. EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. NUEVAS TABLAS PARA CARRUSEL (carousel_items)
-- ============================================================
-- Reemplaza a carousel_slides + carousel_images con diseño profesional
CREATE TABLE IF NOT EXISTS carousel_items (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    button_text VARCHAR(100) DEFAULT 'Saber Más',
    redirect_url VARCHAR(500) DEFAULT '#',
    is_active BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    start_date TIMESTAMP DEFAULT NULL,
    end_date TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_carousel_items_active ON carousel_items(is_active);
CREATE INDEX IF NOT EXISTS idx_carousel_items_order ON carousel_items(order_index);
CREATE INDEX IF NOT EXISTS idx_carousel_items_dates ON carousel_items(start_date, end_date);

-- Tabla para múltiples imágenes por ítem de carrusel
CREATE TABLE IF NOT EXISTS carousel_item_images (
    id SERIAL PRIMARY KEY,
    carousel_item_id INTEGER NOT NULL REFERENCES carousel_items(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text VARCHAR(255) DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_carousel_item_images_item ON carousel_item_images(carousel_item_id);

-- ============================================================
-- 3. CATEGORÍAS (con jerarquía)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
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

-- ============================================================
-- 4. PRODUCT VARIANTES
-- ============================================================
CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
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

-- ============================================================
-- 5. INVENTORY MOVEMENTS (historial de movimientos)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('entry', 'exit', 'adjustment', 'sale', 'return', 'transfer')),
    quantity INTEGER NOT NULL,
    stock_before INTEGER NOT NULL DEFAULT 0,
    stock_after INTEGER NOT NULL DEFAULT 0,
    reference_type VARCHAR(100) DEFAULT '',
    reference_id VARCHAR(255) DEFAULT '',
    notes TEXT DEFAULT '',
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_user ON inventory_movements(user_id);

-- ============================================================
-- 6. MEJORAS A TABLAS EXISTENTES
-- ============================================================

-- Agregar columna category a products (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'category'
    ) THEN
        ALTER TABLE products ADD COLUMN category VARCHAR(255) DEFAULT '';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'description'
    ) THEN
        ALTER TABLE products ADD COLUMN description TEXT DEFAULT '';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE products ADD COLUMN image_url TEXT DEFAULT '';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'sku'
    ) THEN
        ALTER TABLE products ADD COLUMN sku VARCHAR(100) DEFAULT '';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'min_stock'
    ) THEN
        ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 5;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE products ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'category_id'
    ) THEN
        ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Agregar columna role a users (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'name'
    ) THEN
        ALTER TABLE users ADD COLUMN name VARCHAR(255) DEFAULT '';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Agregar category_id a carousel_items (opcional, para vincular a categorías)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carousel_items' AND column_name = 'category_id'
    ) THEN
        ALTER TABLE carousel_items ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- 7. ÍNDICES ADICIONALES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_order_details_order ON order_details(order_id);
CREATE INDEX IF NOT EXISTS idx_order_details_product ON order_details(product_id);

-- ============================================================
-- 8. DATOS INICIALES (categorías)
-- ============================================================
INSERT INTO categories (name, slug, description, icon, sort_order)
VALUES 
    ('Electrónica', 'electronica', 'Productos electrónicos y gadgets', 'laptop', 1),
    ('Moda', 'moda', 'Ropa y accesorios', 'checkroom', 2),
    ('Hogar', 'hogar', 'Artículos para el hogar', 'chair', 3),
    ('Deportes', 'deportes', 'Equipamiento deportivo', 'sports_soccer', 4),
    ('Libros', 'libros', 'Libros y material educativo', 'menu_book', 5),
    ('Juguetes', 'juguetes', 'Juguetes y entretenimiento', 'toys', 6)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 9. PROMOTIONS / DESCUENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS promotions (
    id SERIAL PRIMARY KEY,
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

-- Seed data for promotions
INSERT INTO promotions (name, description, discount_percent, status, category_ids, product_ids, start_date, end_date, usage_count, impact)
VALUES
    ('Venta de Verano 2024', 'Descuento global del 25% aplicado a toda la tienda excepto Outlet.', 25, 'active', '["Electrónica","Hogar"]', '[]', '2024-06-01', '2024-08-31', 1240, 'Alto'),
    ('Cupón Bienvenida', 'Código: WELCOME10 para primeros compradores en App.', 10, 'active', '[]', '[]', NULL, NULL, 45800, 'Medio'),
    ('Flash Tech Monday', 'Promoción limitada a portátiles y periféricos gaming.', 50, 'inactive', '["Electrónica"]', '[]', '2024-05-01', '2024-05-31', 12, 'Crítico')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. VISTA PARA REPORTES
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
-- 11. ACTUALIZAR CARRUSEL EXISTENTE (migrar datos)
-- ============================================================
INSERT INTO carousel_items (title, description, button_text, redirect_url, is_active, order_index)
SELECT 
    COALESCE(title, ''),
    COALESCE(subtitle, ''),
    COALESCE(cta_text, 'Saber Más'),
    COALESCE(cta_link, '#'),
    active,
    sort_order
FROM carousel_slides
ON CONFLICT DO NOTHING;

-- Migrar imágenes existentes
INSERT INTO carousel_item_images (carousel_item_id, image_url, sort_order)
SELECT 
    ci.id,
    COALESCE(cs.image_url, ''),
    0
FROM carousel_slides cs
JOIN carousel_items ci ON ci.title = cs.title
WHERE cs.image_url != '' AND cs.image_url IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
