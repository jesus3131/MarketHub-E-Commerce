import React, { useState, useMemo, useEffect } from 'react';

const API = '';

export default function CatalogPage({ products: allProducts = [], categories: propCategories, onBuy, onAddToCart, onViewProduct, onViewOrders, orders }) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [sortBy, setSortBy] = useState('popular');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState(propCategories || []);

  useEffect(() => {
    if (propCategories && propCategories.length > 0) {
      setCategories(propCategories);
      return;
    }
    fetch(`${API}/categories`)
      .then(r => r.json())
      .then(data => {
        const cats = Array.isArray(data) ? data : (data.categories || []);
        setCategories(cats);
      })
      .catch(() => {});
  }, [propCategories]);

  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    if (selectedCategoryId) {
      result = result.filter(p => {
        const match = p.category_id === selectedCategoryId;
        return match;
      });
    }

    if (priceMin !== '') {
      result = result.filter(p => parseFloat(p.price) >= parseFloat(priceMin));
    }
    if (priceMax !== '') {
      result = result.filter(p => parseFloat(p.price) <= parseFloat(priceMax));
    }

    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        break;
      case 'price-desc':
        result.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        break;
      case 'name':
        result.sort((a, b) => a.name?.localeCompare(b.name));
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        break;
      default:
        break;
    }

    return result;
  }, [allProducts, selectedCategoryId, sortBy, priceMin, priceMax]);

  const selectedCategory = selectedCategoryId
    ? categories.find(c => c.id === selectedCategoryId)
    : null;

  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <h2 className="catalog-title">{selectedCategory ? selectedCategory.name : 'Todos los Productos'}</h2>
        <span className="catalog-count">{filteredProducts.length} productos</span>
      </div>

      <div className="catalog-controls">
        <div className="category-tabs-wrapper">
          <button
            className={`category-tab ${!selectedCategoryId ? 'active' : ''}`}
            onClick={() => setSelectedCategoryId(null)}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`category-tab ${selectedCategoryId === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategoryId(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="catalog-actions">
          <button
            className="filter-toggle-btn"
            onClick={() => setShowFilters(!showFilters)}
          >
            <span className="material-symbols-outlined">filter_list</span>
            Filtros
          </button>
          <select
            className="sort-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="popular">Más populares</option>
            <option value="price-asc">Precio: menor a mayor</option>
            <option value="price-desc">Precio: mayor a menor</option>
            <option value="name">Nombre</option>
            <option value="newest">Novedades</option>
          </select>
        </div>
      </div>

      <div className="catalog-content">
        {showFilters && (
          <aside className="catalog-sidebar">
            <h3 className="sidebar-title">Filtros</h3>

            <div className="filter-section">
              <h4 className="filter-label">Categorías</h4>
              <div className="filter-options">
                <button
                  className={`filter-chip ${!selectedCategoryId ? 'active' : ''}`}
                  onClick={() => setSelectedCategoryId(null)}
                >
                  Todas
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    className={`filter-chip ${selectedCategoryId === cat.id ? 'active' : ''}`}
                    onClick={() => setSelectedCategoryId(cat.id)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-section">
              <h4 className="filter-label">Rango de Precio</h4>
              <div className="price-range">
                <input
                  type="number"
                  className="price-input"
                  placeholder="Min"
                  value={priceMin}
                  onChange={e => setPriceMin(e.target.value)}
                  min="0"
                />
                <span className="price-separator">—</span>
                <input
                  type="number"
                  className="price-input"
                  placeholder="Max"
                  value={priceMax}
                  onChange={e => setPriceMax(e.target.value)}
                  min="0"
                />
              </div>
              <button
                className="price-apply-btn"
                onClick={() => { }}
              >
                Aplicar
              </button>
            </div>
          </aside>
        )}

        <div className={`product-grid-catalog ${showFilters ? 'with-sidebar' : ''}`}>
          {filteredProducts.length === 0 ? (
            <div className="catalog-empty">
              <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>inventory_2</span>
              <p>No hay productos en esta categoría</p>
            </div>
          ) : (
            filteredProducts.map(p => (
              <div key={p.id} className="catalog-product-card" style={{ cursor: 'pointer' }} onClick={() => onViewProduct?.(p)}>
                <div className="catalog-product-image">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} />
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: 36, opacity: 0.2 }}>shopping_bag</span>
                  )}
                  {p.stock <= 0 && <span className="product-badge out">Agotado</span>}
                  {p.stock > 0 && p.stock <= (p.min_stock || 5) && <span className="product-badge low">Stock bajo</span>}
                </div>
                <div className="catalog-product-body" onClick={e => e.stopPropagation()}>
                  {p.category_name && <span className="catalog-product-category">{p.category_name}</span>}
                  <h3 className="catalog-product-name" onClick={(e) => { e.stopPropagation(); onViewProduct?.(p); }}>{p.name}</h3>
                  {p.description && (
                    <p className="catalog-product-desc">{p.description.substring(0, 80)}{p.description.length > 80 ? '...' : ''}</p>
                  )}
                  <div className="catalog-product-footer">
                    <span className="catalog-product-price">${parseFloat(p.price).toFixed(2)}</span>
                    <div className="catalog-product-actions">
                      <button
                        className="btn-icon"
                        disabled={p.stock < 1}
                        onClick={(e) => { e.stopPropagation(); onAddToCart(p); }}
                        title="Agregar al carrito"
                      >
                        <span className="material-symbols-outlined">add_shopping_cart</span>
                      </button>
                      <button
                        className="btn-buy"
                        disabled={p.stock < 1}
                        onClick={(e) => { e.stopPropagation(); onBuy(p.id); }}
                      >
                        Comprar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {orders && orders.length > 0 && (
        <div className="catalog-orders-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
            <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: 18 }}>Mis Órdenes</h3>
            <button className="btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }} onClick={onViewOrders}>
              Ver todas
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="activity-log-table" style={{ fontSize: 13 }}>
              <thead><tr><th>#</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
              <tbody>
                {orders.slice(0, 3).map(o => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>#{typeof o.id === 'string' ? o.id.substring(0, 8) : o.id}</td>
                    <td style={{ fontWeight: 500 }}>${parseFloat(o.total).toFixed(2)}</td>
                    <td><span className={`action-badge ${o.status === 'confirmed' ? 'success' : o.status === 'cancelled' ? 'canceled' : 'processing'}`}>{o.status}</span></td>
                    <td style={{ fontSize: 12 }}>{new Date(o.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}