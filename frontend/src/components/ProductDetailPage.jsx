import React, { useState, useMemo } from 'react';

export default function ProductDetailPage({ product, onAddToCart, onBuy, onBack, allProducts, loading }) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const relatedProducts = useMemo(() => {
    if (!allProducts || !product) return [];
    return allProducts
      .filter(p => p.id !== product.id && (p.category_id === product.category_id || !product.category_id))
      .slice(0, 4);
  }, [allProducts, product]);

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) onAddToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (loading || !product) {
    return (
      <div className="product-detail-page">
        <div className="skeleton skeleton-text skeleton-text-sm mb-6" />
        <div className="product-detail-grid">
          <div className="skeleton skeleton-image rounded-2xl" />
          <div className="space-y-4">
            <div className="skeleton skeleton-text skeleton-text-sm" />
            <div className="skeleton skeleton-text skeleton-text-lg" />
            <div className="skeleton skeleton-text" style={{ width: '30%' }} />
            <div className="skeleton skeleton-text" style={{ width: '100%' }} />
            <div className="skeleton skeleton-text" style={{ width: '100%' }} />
            <div className="skeleton skeleton-text" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="product-detail-page animate-fade-in-up">
      <button onClick={onBack} className="product-detail-back">
        <span className="material-symbols-outlined">arrow_back</span>
        Volver
      </button>

      <div className="product-detail-grid">
        <div className="product-detail-image-wrapper">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} />
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--color-outline-variant)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 80 }}>image</span>
            </div>
          )}
          {product.stock <= 0 && <span className="product-detail-badge out">Agotado</span>}
          {product.stock > 0 && product.stock <= (product.min_stock || 5) && (
            <span className="product-detail-badge low">Últimas {product.stock}</span>
          )}
        </div>

        <div className="product-detail-info">
          {product.category_name && (
            <span className="product-detail-category">{product.category_name}</span>
          )}

          <h1 className="product-detail-title">{product.name}</h1>

          <div className="product-detail-rating">
            {[1,2,3,4,5].map(i => (
              <span key={i} className={`material-symbols-outlined ${i <= 4 ? 'filled' : 'empty'}`}>star</span>
            ))}
            <span className="count">(4.0)</span>
          </div>

          <div className="product-detail-price">${parseFloat(product.price).toFixed(2)}</div>

          {product.description && (
            <p className="product-detail-description">{product.description}</p>
          )}

          <div className="product-detail-quantity-row">
            <span className="product-detail-quantity-label">Cantidad:</span>
            <div className="qty-selector">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={product.stock < 1}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>remove</span>
              </button>
              <span className="qty-value">{quantity}</span>
              <button onClick={() => setQuantity(q => Math.min(product.stock, q + 1))} disabled={quantity >= product.stock || product.stock < 1}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              </button>
            </div>
            {product.stock > 0 && (
              <span className="product-detail-stock">{product.stock} disponibles</span>
            )}
          </div>

          <div className="product-detail-actions">
            <button
              onClick={handleAddToCart}
              disabled={product.stock < 1}
              className={`product-detail-cart-btn ${added ? 'added' : ''}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{added ? 'check' : 'add_shopping_cart'}</span>
              {added ? 'Agregado' : 'Agregar al Carrito'}
            </button>
            <button onClick={handleBuy} disabled={product.stock < 1} className="product-detail-buy-btn">
              Comprar Ahora
            </button>
          </div>

          <div className="product-detail-meta">
            <div className="product-detail-meta-item">
              <span className="material-symbols-outlined">inventory</span>
              {product.stock > 0 ? 'En stock' : 'Agotado'}
            </div>
            {product.category_name && (
              <div className="product-detail-meta-item">
                <span className="material-symbols-outlined">category</span>
                {product.category_name}
              </div>
            )}
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="related-products-section">
          <h2 className="related-products-title">Productos Relacionados</h2>
          <div className="related-products-grid">
            {relatedProducts.map(rp => (
              <div key={rp.id} onClick={() => onBack(rp)} className="related-product-card">
                <div className="related-product-image">
                  {rp.image_url ? (
                    <img src={rp.image_url} alt={rp.name} />
                  ) : (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--color-outline-variant)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 40 }}>image</span>
                    </div>
                  )}
                </div>
                <div className="related-product-body">
                  <h3 className="related-product-name">{rp.name}</h3>
                  <div className="related-product-price">${parseFloat(rp.price).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
