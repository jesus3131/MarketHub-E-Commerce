import React, { useState, useEffect, useRef } from 'react';

const API = '';

const SORT_OPTIONS = [
  { value: 'p.created_at', label: 'Fecha creación' },
  { value: 'p.name', label: 'Nombre' },
  { value: 'p.price', label: 'Precio' },
  { value: 'p.stock', label: 'Stock' }
];

export default function AdminInventory({ token, onProductChange, showMessage }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showMovements, setShowMovements] = useState(false);
  const [movements, setMovements] = useState([]);
  const [movementProduct, setMovementProduct] = useState(null);
  const [summary, setSummary] = useState(null);
  const fileRef = useRef(null);
  const csvFileRef = useRef(null);

  const [form, setForm] = useState({
    name: '', description: '', price: '', stock: '', min_stock: 5,
    sku: '', image_url: '', category: '', category_id: ''
  });

  const [filters, setFilters] = useState({
    search: '', category: '', category_id: '', stock_status: '', price_min: '', price_max: '',
    sort_by: 'p.created_at', sort_dir: 'desc', page: 1, limit: 20
  });

  const resetForm = () => setForm({
    name: '', description: '', price: '', stock: '', min_stock: 5,
    sku: '', image_url: '', category: '', category_id: ''
  });

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await fetch(`${API}/products?${params}`);
      const data = await res.json();
      setProducts(data.products || []);
      if (data.pagination) setPagination(data.pagination);
    } catch { showMessage?.('Error al cargar productos', 'error'); }
    finally { setLoading(false); }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch(`${API}/categories`);
      setCategories(await res.json());
    } catch {}
  };

  const loadSummary = async () => {
    try {
      const res = await fetch(`${API}/inventory/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSummary(await res.json());
    } catch {}
  };

  useEffect(() => { loadProducts(); loadCategories(); loadSummary(); }, []);

  useEffect(() => { loadProducts(); }, [filters]);

  const handleImageUpload = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('image', file);
      const res = await fetch(`${API}/products/upload`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd
      });
      const data = await res.json();
      if (res.ok) { setForm(prev => ({ ...prev, image_url: data.url })); showMessage?.('Imagen subida', 'success'); }
      else throw new Error(data.error);
    } catch (err) { showMessage?.(err.message, 'error'); }
    finally { setUploading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const isNew = !editingId;
      const url = isNew ? `${API}/products` : `${API}/products/${editingId}`;
      const method = isNew ? 'POST' : 'PUT';
      const body = {
        name: form.name, description: form.description,
        price: parseFloat(form.price), stock: parseInt(form.stock),
        min_stock: parseInt(form.min_stock), sku: form.sku,
        image_url: form.image_url, category: form.category,
        category_id: form.category_id || null
      };
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMessage?.(isNew ? 'Producto creado' : 'Producto actualizado', 'success');
      resetForm(); setEditingId(null); setShowForm(false);
      onProductChange?.(); loadProducts(); loadSummary();
    } catch (err) { showMessage?.(err.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      const res = await fetch(`${API}/products/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json()).error);
      showMessage?.('Producto eliminado', 'success');
      onProductChange?.(); loadProducts(); loadSummary();
    } catch (err) { showMessage?.(err.message, 'error'); }
  };

  const startEdit = (product) => {
    setEditingId(product.id); setShowForm(true);
    setForm({
      name: product.name, description: product.description || '',
      price: product.price, stock: product.stock, min_stock: product.min_stock || 5,
      sku: product.sku || '', image_url: product.image_url || '',
      category: product.category || '', category_id: product.category_id || ''
    });
  };

  const handleQuickStock = async (product, quantity, type) => {
    try {
      const res = await fetch(`${API}/products/${product.id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ quantity: Math.abs(quantity), type })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showMessage?.(`Stock actualizado: ${product.name}`, 'success');
      loadProducts(); loadSummary();
    } catch (err) { showMessage?.(err.message, 'error'); }
  };

  const viewMovements = async (product) => {
    setMovementProduct(product);
    try {
      const res = await fetch(`${API}/inventory/movements?product_id=${product.id}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMovements(data.movements || []);
      setShowMovements(true);
    } catch { showMessage?.('Error al cargar movimientos', 'error'); }
  };

  const handleExportCsv = async () => {
    try {
      const res = await fetch(`${API}/products/export/csv`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'productos.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { showMessage?.(err.message, 'error'); }
  };

  const handleImportCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await fetch(`${API}/products/import/csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ csv: text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMessage?.(`Importados ${data.imported} productos${data.errors?.length ? `, ${data.errors.length} errores` : ''}`, 'success');
      loadProducts(); loadSummary();
    } catch (err) { showMessage?.(err.message, 'error'); }
    e.target.value = '';
  };

  const handlePageChange = (page) => setFilters(prev => ({ ...prev, page }));

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="headline-md" style={{ fontFamily: 'var(--font-headline)' }}>Inventario</h2>
          <p style={{ color: 'var(--color-on-surface-variant)' }}>{pagination.total} productos · {summary?.totalStock || 0} unidades</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="file" ref={csvFileRef} accept=".csv" style={{ display: 'none' }} onChange={handleImportCsv} />
          <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => csvFileRef.current?.click()}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload</span> Importar CSV
          </button>
          <button className="btn-secondary" style={{ width: 'auto' }} onClick={handleExportCsv}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span> Exportar CSV
          </button>
          <button className="btn-primary" style={{ width: 'auto' }} onClick={() => { setShowForm(true); setEditingId(null); resetForm(); }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Nuevo Producto
          </button>
        </div>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
          <div className="stat-card" style={{ padding: 'var(--space-md)' }}>
            <div className="stat-card-label">Valor Inventario</div>
            <div className="stat-card-value" style={{ fontSize: 20 }}>${parseFloat(summary.totalValue || 0).toLocaleString('es', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="stat-card" style={{ padding: 'var(--space-md)' }}>
            <div className="stat-card-label">Stock Bajo</div>
            <div className="stat-card-value" style={{ fontSize: 20, color: 'var(--color-error)' }}>{summary.lowStock || 0}</div>
          </div>
          <div className="stat-card" style={{ padding: 'var(--space-md)' }}>
            <div className="stat-card-label">Agotados</div>
            <div className="stat-card-value" style={{ fontSize: 20, color: 'var(--color-error)' }}>{summary.outOfStock || 0}</div>
          </div>
          <div className="stat-card" style={{ padding: 'var(--space-md)' }}>
            <div className="stat-card-label">Total Stock</div>
            <div className="stat-card-value" style={{ fontSize: 20 }}>{summary.totalStock || 0}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
        <input type="text" className="form-input" placeholder="Buscar por nombre, SKU..."
          value={filters.search} onChange={e => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
          style={{ flex: 1, minWidth: 200 }} />

        <select value={filters.category_id} onChange={e => setFilters(prev => ({ ...prev, category_id: e.target.value, page: 1 }))}
          style={{ padding: '8px 12px', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={filters.stock_status} onChange={e => setFilters(prev => ({ ...prev, stock_status: e.target.value, page: 1 }))}
          style={{ padding: '8px 12px', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
          <option value="">Todo stock</option>
          <option value="in">Disponible</option>
          <option value="low">Stock bajo</option>
          <option value="out">Agotado</option>
        </select>

        <select value={filters.sort_by} onChange={e => setFilters(prev => ({ ...prev, sort_by: e.target.value }))}
          style={{ padding: '8px 12px', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
          onClick={() => setFilters(prev => ({ ...prev, sort_dir: prev.sort_dir === 'asc' ? 'desc' : 'asc' }))}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            {filters.sort_dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
          </span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave}
          style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24, padding: 'var(--space-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
            <div className="form-field">
              <label>Nombre</label>
              <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Nombre del producto" />
            </div>
            <div className="form-field">
              <label>Precio</label>
              <input className="form-input" type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Stock</label>
              <input className="form-input" type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Stock Mínimo</label>
              <input className="form-input" type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-field">
              <label>SKU</label>
              <input className="form-input" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="Código SKU" />
            </div>
            <div className="form-field">
              <label>Categoría (texto)</label>
              <input className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ej: Electrónica" />
            </div>
            <div className="form-field">
              <label>Categoría (jerárquica)</label>
              <select className="form-input" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-field">
            <label>Descripción</label>
            <textarea className="form-input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Imagen</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleImageUpload(e.target.files[0]); }} />
              <button type="button" className="btn-secondary" style={{ width: 'auto' }} onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? 'Subiendo...' : 'Subir Imagen'}
              </button>
              {form.image_url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={form.image_url} alt="preview" style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', objectFit: 'cover' }} />
                  <button type="button" style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: 12 }}
                    onClick={() => setForm({ ...form, image_url: '' })}>Quitar</button>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn-primary" style={{ width: 'auto' }}>{editingId ? 'Guardar Cambios' : 'Crear Producto'}</button>
            <button type="button" className="btn-secondary" style={{ width: 'auto' }}
              onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}>Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="loading-container"><div className="spinner" /><span>Cargando productos...</span></div>
      ) : products.length === 0 ? (
        <div className="empty-state"><span className="material-symbols-outlined">inventory_2</span><p>No hay productos con estos filtros</p></div>
      ) : (
        <div className="dashboard-section">
          <div style={{ overflowX: 'auto' }}>
            <table className="campaign-table">
              <thead>
                <tr>
                  <th>Imagen</th>
                  <th>Nombre / SKU</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Estado</th>
                  <th style={{ width: 240 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {p.image_url ? <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-outline)' }}>shopping_bag</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{p.sku ? `SKU: ${p.sku}` : 'Sin SKU'}</div>
                    </td>
                    <td><span className="action-badge category" style={{ textTransform: 'none' }}>{p.category_name || p.category || '—'}</span></td>
                    <td style={{ fontWeight: 500 }}>${parseFloat(p.price).toFixed(2)}</td>
                    <td>
                      <span style={{ color: p.stock <= 0 ? 'var(--color-error)' : p.stock <= (p.min_stock || 5) ? 'var(--color-warning, #d97706)' : 'inherit', fontWeight: 600 }}>
                        {p.stock}
                      </span>
                    </td>
                    <td>
                      <span className={`campaign-status ${p.stock_status === 'in' ? 'active' : p.stock_status === 'low' ? 'scheduled' : 'draft'}`}>
                        {p.stock_status === 'in' ? 'Disponible' : p.stock_status === 'low' ? 'Stock Bajo' : 'Agotado'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="btn-secondary" style={{ width: 'auto', padding: '4px 8px', fontSize: 11 }} onClick={() => startEdit(p)}>Editar</button>
                        <button className="btn-secondary" style={{ width: 'auto', padding: '4px 8px', fontSize: 11 }}
                          onClick={() => handleQuickStock(p, 1, 'entry')}>+1</button>
                        <button className="btn-secondary" style={{ width: 'auto', padding: '4px 8px', fontSize: 11 }}
                          onClick={() => p.stock > 0 && handleQuickStock(p, 1, 'exit')}>-1</button>
                        <button className="btn-secondary" style={{ width: 'auto', padding: '4px 8px', fontSize: 11 }}
                          onClick={() => viewMovements(p)}>Mov.</button>
                        <button className="btn-logout" style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)', padding: '4px 8px', fontSize: 11 }}
                          onClick={() => handleDelete(p.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-info">
                {pagination.total} productos · Página {pagination.page} de {pagination.totalPages}
              </div>
              <div className="pagination-controls">
                <button className="pagination-btn" disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}>‹</button>
                {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                  const start = Math.max(1, pagination.page - 2);
                  const page = start + i;
                  if (page > pagination.totalPages) return null;
                  return (
                    <button key={page} className={`pagination-btn ${page === pagination.page ? 'active' : ''}`}
                      onClick={() => handlePageChange(page)}>{page}</button>
                  );
                })}
                <button className="pagination-btn" disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}>›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showMovements && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowMovements(false)}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', maxWidth: 700, width: '90%', maxHeight: '80vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h3 style={{ fontFamily: 'var(--font-headline)' }}>Movimientos: {movementProduct?.name}</h3>
              <button onClick={() => setShowMovements(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            {movements.length === 0 ? (
              <p>Sin movimientos registrados</p>
            ) : (
              <table className="campaign-table" style={{ fontSize: 13 }}>
                <thead><tr><th>Tipo</th><th>Cantidad</th><th>Stock Anterior</th><th>Stock Nuevo</th><th>Notas</th><th>Fecha</th></tr></thead>
                <tbody>
                  {movements.map(m => (
                    <tr key={m.id}>
                      <td><span className={`action-badge ${m.movement_type}`}>{m.movement_type}</span></td>
                      <td style={{ fontWeight: 600 }}>{m.quantity}</td>
                      <td>{m.stock_before}</td>
                      <td>{m.stock_after}</td>
                      <td style={{ fontSize: 12, maxWidth: 150 }}>{m.notes || '-'}</td>
                      <td style={{ fontSize: 12 }}>{new Date(m.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
