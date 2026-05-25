import React, { useCallback, useEffect, useMemo, useState } from 'react';

const API = '';

function parseStoredArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

function normalizeReferenceIds(values, byName) {
  return values.map(v => {
    if (typeof v === 'number') return v;
    const numeric = Number(v);
    if (!Number.isNaN(numeric) && String(v).trim() !== '') return numeric;
    return byName.get(String(v).toLowerCase()) ?? null;
  }).filter(v => v !== null);
}

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return 'Sin fecha límite';
  if (!startDate) return `Hasta ${endDate}`;
  return `${startDate} a ${endDate || 'sin cierre'}`;
}

export default function AdminDiscounts({ token, showMessage, onPromotionsChange }) {
  const [promotions, setPromotions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [formTab, setFormTab] = useState('basic');
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    name: '', description: '', discount_percent: 10,
    status: 'active', category_ids: [], product_ids: [],
    start_date: '', end_date: ''
  });

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);
  const categoryNameToId = useMemo(() => new Map(categories.map(c => [c.name.toLowerCase(), c.id])), [categories]);
  const productNameToId = useMemo(() => new Map(allProducts.map(p => [p.name.toLowerCase(), p.id])), [allProducts]);
  const categoryById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const productById = useMemo(() => new Map(allProducts.map(p => [p.id, p])), [allProducts]);

  const loadPromotions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/promotions`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPromotions(Array.isArray(data) ? data : []);
    } catch { showMessage?.('No se pudieron cargar las promociones.', 'error'); }
  }, [showMessage]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API}/categories`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch { showMessage?.('No se pudieron cargar las categorías.', 'error'); }
  }, [showMessage]);

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/products/all`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAllProducts(Array.isArray(data) ? data : []);
    } catch { showMessage?.('No se pudieron cargar los productos.', 'error'); }
  }, [showMessage]);

  const loadActivities = useCallback(async () => {
    try {
      const res = await fetch(`${API}/activities?limit=8`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setActivities(data.entries || []);
    } catch {}
  }, [token]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPromotions(), loadCategories(), loadProducts(), loadActivities()]).finally(() => setLoading(false));
  }, [loadActivities, loadCategories, loadProducts, loadPromotions]);

  const resetForm = useCallback(() => {
    setEditingId(null); setShowForm(false); setFormTab('basic'); setErrors({}); setProductSearch('');
    setForm({ name: '', description: '', discount_percent: 10, status: 'active', category_ids: [], product_ids: [], start_date: '', end_date: '' });
  }, []);

  const openNewForm = () => { resetForm(); setShowForm(true); };

  const toggleCategory = (id) => {
    setForm(prev => ({
      ...prev,
      category_ids: prev.category_ids.includes(id) ? prev.category_ids.filter(c => c !== id) : [...prev.category_ids, id]
    }));
  };

  const toggleProduct = (id) => {
    setForm(prev => ({
      ...prev,
      product_ids: prev.product_ids.includes(id) ? prev.product_ids.filter(p => p !== id) : [...prev.product_ids, id]
    }));
  };

  const handleSave = async () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'El nombre es obligatorio';
    const percent = Number(form.discount_percent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) newErrors.discount_percent = 'Debe estar entre 1% y 100%';
    if (form.start_date && form.end_date && form.start_date > form.end_date) newErrors.end_date = 'La fecha final debe ser posterior a la de inicio';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) { setFormTab('basic'); return; }

    setSaving(true);
    try {
      const body = {
        name: form.name.trim(), description: form.description.trim(),
        discount_percent: percent, status: form.status,
        category_ids: form.category_ids, product_ids: form.product_ids,
        start_date: form.start_date || null, end_date: form.end_date || null
      };
      const url = editingId ? `${API}/promotions/${editingId}` : `${API}/promotions`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la promoción.');
      showMessage?.(editingId ? 'Promoción actualizada correctamente.' : 'Promoción creada correctamente.', 'success');
      resetForm();
      await Promise.all([loadPromotions(), loadActivities()]);
      onPromotionsChange?.();
    } catch (error) {
      showMessage?.(error.message || 'No se pudo guardar la promoción.', 'error');
    } finally { setSaving(false); }
  };

  const togglePromotion = async (id) => {
    try {
      const res = await fetch(`${API}/promotions/${id}/toggle`, { method: 'PATCH', headers });
      if (!res.ok) throw new Error();
      await Promise.all([loadPromotions(), loadActivities()]);
      onPromotionsChange?.();
    } catch { showMessage?.('No se pudo cambiar el estado de la promoción.', 'error'); }
  };

  const deletePromotion = async (id) => {
    if (!window.confirm('¿Deseas eliminar esta promoción?')) return;
    try {
      const res = await fetch(`${API}/promotions/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error();
      showMessage?.('Promoción eliminada correctamente.', 'success');
      await Promise.all([loadPromotions(), loadActivities()]);
      onPromotionsChange?.();
      if (editingId === id) resetForm();
    } catch { showMessage?.('No se pudo eliminar la promoción.', 'error'); }
  };

  const editPromotion = (promotion) => {
    setEditingId(promotion.id);
    setForm({
      name: promotion.name || '', description: promotion.description || '',
      discount_percent: Number(promotion.discount_percent) || 0,
      status: promotion.status === 'inactive' ? 'inactive' : 'active',
      category_ids: promotion.normalizedCategoryIds || [],
      product_ids: promotion.normalizedProductIds || [],
      start_date: promotion.start_date ? String(promotion.start_date).slice(0, 10) : '',
      end_date: promotion.end_date ? String(promotion.end_date).slice(0, 10) : ''
    });
    setProductSearch(''); setErrors({}); setFormTab('basic'); setShowForm(true);
  };

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return allProducts.slice(0, 18);
    return allProducts.filter(p => p.name?.toLowerCase().includes(q)).slice(0, 18);
  }, [allProducts, productSearch]);

  const promotionCards = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return promotions.map(p => {
      const normalizedCategoryIds = normalizeReferenceIds(parseStoredArray(p.category_ids), categoryNameToId);
      const normalizedProductIds = normalizeReferenceIds(parseStoredArray(p.product_ids), productNameToId);
      const categoryNames = normalizedCategoryIds.map(id => categoryById.get(id)?.name).filter(Boolean);
      const products = normalizedProductIds.map(id => productById.get(id)).filter(Boolean);
      const isScheduled = p.status === 'active' && p.start_date && p.start_date > today;
      return { ...p, normalizedCategoryIds, normalizedProductIds, categoryNames, products, isScheduled };
    });
  }, [categoryById, categoryNameToId, productById, productNameToId, promotions]);

  const activeCount = promotionCards.filter(p => p.status === 'active' && !p.isScheduled).length;
  const scheduledCount = promotionCards.filter(p => p.isScheduled).length;
  const inactiveCount = promotionCards.filter(p => p.status !== 'active').length;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200 border-t-gray-900" />
          <span className="text-sm font-medium">Cargando promociones...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Módulo de descuentos</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900 tracking-tight">Promociones</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">Administra campañas de descuento con categorías y productos específicos.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={openNewForm} className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 shadow-sm">
            <span className="flex items-center gap-2"><span className="material-symbols-outlined text-lg">add</span>Nueva promoción</span>
          </button>
          <button onClick={() => Promise.all([loadPromotions(), loadActivities()])}
            className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900 bg-white">
            <span className="flex items-center gap-2"><span className="material-symbols-outlined text-lg">refresh</span>Actualizar</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Activas" value={activeCount} detail="Promociones vigentes que ya se pueden aplicar" tone="emerald" />
        <SummaryCard label="Programadas" value={scheduledCount} detail="Campañas con fecha futura y configuración lista" tone="amber" />
        <SummaryCard label="Inactivas" value={inactiveCount} detail="Promociones guardadas pero fuera de operación" tone="gray" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[480px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {!showForm ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-gray-400">sell</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Crear nueva promoción</h3>
              <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">Configura el descuento, selecciona categorías o productos y define las fechas de vigencia.</p>
              <button onClick={openNewForm} className="mt-6 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800">
                Abrir formulario
              </button>
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="flex flex-col h-full">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Editar promoción' : 'Crear promoción'}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Completa los datos de la campaña</p>
                </div>
                <button type="button" onClick={resetForm}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors">
                  Cerrar
                </button>
              </div>

              <div className="flex border-b border-gray-100">
                {[
                  { key: 'basic', label: 'Datos básicos', icon: 'edit_note' },
                  { key: 'scope', label: 'Alcance', icon: 'category' },
                  { key: 'products', label: 'Productos', icon: 'inventory_2' },
                ].map(tab => (
                  <button key={tab.key} type="button" onClick={() => setFormTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${
                      formTab === tab.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}>
                    <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {formTab === 'basic' && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Título de la promoción</label>
                      <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                        placeholder="Ej: Fin de semana tech"
                        className={`w-full rounded-xl border px-4 py-3 text-sm text-gray-700 outline-none transition bg-gray-50 focus:bg-white ${
                          errors.name ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-gray-900'
                        }`} />
                      {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Descripción</label>
                      <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                        rows={3} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-gray-900 focus:bg-white"
                        placeholder="Describe brevemente la promoción" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Descuento (%)</label>
                        <div className="relative">
                          <input type="number" min="1" max="100" value={form.discount_percent}
                            onChange={e => setForm({...form, discount_percent: e.target.value})}
                            className={`w-full rounded-xl border px-4 py-3 pr-10 text-sm text-gray-700 outline-none transition bg-gray-50 focus:bg-white ${
                              errors.discount_percent ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-gray-900'
                            }`} />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">%</span>
                        </div>
                        {errors.discount_percent && <p className="text-xs text-red-500 mt-1">{errors.discount_percent}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Estado</label>
                        <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-gray-900 focus:bg-white">
                          <option value="active">Activa</option>
                          <option value="inactive">Inactiva</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Fecha de inicio</label>
                        <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-gray-900 focus:bg-white" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Fecha final</label>
                        <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})}
                          className={`w-full rounded-xl border px-4 py-3 text-sm text-gray-700 outline-none transition bg-gray-50 focus:bg-white ${
                            errors.end_date ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-gray-900'
                          }`} />
                        {errors.end_date && <p className="text-xs text-red-500 mt-1">{errors.end_date}</p>}
                      </div>
                    </div>
                  </>
                )}

                {formTab === 'scope' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Categorías aplicables</label>
                    {categories.length === 0 ? (
                      <p className="text-sm text-gray-500">No hay categorías disponibles.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {categories.map(cat => {
                          const selected = form.category_ids.includes(cat.id);
                          return (
                            <button key={cat.id} type="button" onClick={() => toggleCategory(cat.id)}
                              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all border ${
                                selected
                                  ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
                              }`}>
                              {selected && <span className="mr-1.5">✓</span>}
                              {cat.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-3">Selecciona las categorías donde aplicará el descuento. Si no seleccionas ninguna, aplica a toda la tienda.</p>
                  </div>
                )}

                {formTab === 'products' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Productos específicos</label>
                    <div className="relative mb-4">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <span className="material-symbols-outlined text-lg">search</span>
                      </span>
                      <input type="search" value={productSearch} onChange={e => setProductSearch(e.target.value)}
                        placeholder="Buscar producto por nombre..."
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-3 text-sm text-gray-700 outline-none transition focus:border-gray-900 focus:bg-white" />
                    </div>
                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1 rounded-xl border border-gray-100 bg-gray-50 p-2">
                      {form.product_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 px-2 pt-2 pb-3 border-b border-gray-100">
                          {form.product_ids.map(pid => {
                            const prod = productById.get(pid);
                            return prod ? (
                              <span key={pid} className="inline-flex items-center gap-1 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-full">
                                {prod.name}
                                <button type="button" onClick={() => toggleProduct(pid)} className="ml-1 hover:text-gray-300">&times;</button>
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                      {filteredProducts.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-6">No se encontraron productos.</p>
                      ) : (
                        filteredProducts.map(prod => {
                          const selected = form.product_ids.includes(prod.id);
                          return (
                            <label key={prod.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all border ${
                                selected ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-100 hover:border-gray-300'
                              }`}>
                              <input type="checkbox" checked={selected} onChange={() => toggleProduct(prod.id)}
                                className="hidden" />
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                selected ? 'bg-white border-white' : 'bg-white border-gray-300'
                              }`}>
                                {selected && <span className="text-gray-900 text-xs font-bold">✓</span>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{prod.name}</div>
                                <div className={`text-xs mt-0.5 ${selected ? 'text-white/70' : 'text-gray-400'}`}>
                                  {prod.category_name || prod.category || 'Sin categoría'} · ${parseFloat(prod.price).toFixed(2)}
                                </div>
                              </div>
                              <div className={`text-right flex-shrink-0 ${selected ? 'text-white/80' : 'text-gray-400'}`}>
                                <div className="text-sm font-semibold">${parseFloat(prod.price).toFixed(2)}</div>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">Selecciona productos individuales para la promoción. Si no seleccionas ninguno, aplica a los productos de las categorías elegidas o a toda la tienda.</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 p-5 border-t border-gray-100 bg-gray-50">
                <div className="flex-1 min-w-0">
                  {form.discount_percent > 0 && form.name && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-sm font-bold">{form.discount_percent}%</div>
                      <div className="truncate">
                        <div className="text-sm font-medium text-gray-900 truncate">{form.name}</div>
                        <div className="text-xs text-gray-500">{form.category_ids.length > 0 ? `${form.category_ids.length} categorías` : 'Toda la tienda'} · {form.product_ids.length > 0 ? `${form.product_ids.length} productos` : 'Sin productos específicos'}</div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button type="button" onClick={resetForm}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900 bg-white">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving}
                    className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                    {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>

        <section className="space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Promociones registradas</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{promotionCards.length} promociones en total</p>
                </div>
                <div className="flex items-center gap-4">
                  {['active','scheduled','inactive'].map(status => {
                    const count = status === 'active' ? activeCount : status === 'scheduled' ? scheduledCount : inactiveCount;
                    const colors = status === 'active' ? 'bg-emerald-100 text-emerald-700' : status === 'scheduled' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600';
                    return count > 0 ? <span key={status} className={`text-xs font-semibold px-3 py-1 rounded-full ${colors}`}>{status === 'active' ? 'Activas' : status === 'scheduled' ? 'Programadas' : 'Inactivas'}: {count}</span> : null;
                  })}
                </div>
              </div>
            </div>

            {promotionCards.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl text-gray-300">local_offer</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Aún no hay promociones</h3>
                <p className="mt-2 text-sm text-gray-500">Crea tu primera promoción usando el formulario lateral.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {promotionCards.map(promotion => (
                  <div key={promotion.id} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={promotion.status} isScheduled={promotion.isScheduled} />
                          <span className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-700">{promotion.discount_percent}% OFF</span>
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">{promotion.name}</h3>
                          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{promotion.description || 'Sin descripción adicional.'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-lg text-gray-600">
                            <span className="material-symbols-outlined text-sm">category</span>
                            {promotion.categoryNames.length > 0 ? promotion.categoryNames.join(', ') : 'Toda la tienda'}
                          </span>
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-lg text-gray-600">
                            <span className="material-symbols-outlined text-sm">inventory_2</span>
                            {promotion.products.length > 0 ? `${promotion.products.length} productos` : 'Aplicación general'}
                          </span>
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-lg text-gray-600">
                            <span className="material-symbols-outlined text-sm">calendar_today</span>
                            {formatDateRange(promotion.start_date, promotion.end_date)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                        <button onClick={() => editPromotion(promotion)}
                          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900">
                          Editar
                        </button>
                        <button onClick={() => togglePromotion(promotion.id)}
                          className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                            promotion.status === 'active'
                              ? 'border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300'
                          }`}>
                          {promotion.status === 'active' ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => deletePromotion(promotion.id)}
                          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Actividad reciente</h2>
              <p className="text-sm text-gray-500 mt-0.5">Últimos cambios en promociones</p>
            </div>
            <div className="p-5">
              {activities.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No hay actividad registrada.</p>
              ) : (
                <div className="space-y-3">
                  {activities.slice(0, 6).map((a, i) => (
                    <div key={a.id || i} className="flex items-start gap-3">
                      <div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        a.action === 'delete' ? 'bg-red-500' : a.action === 'create' ? 'bg-emerald-500' : 'bg-gray-400'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-700"><span className="font-semibold">{a.user_name || 'Admin'}</span> {a.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status, isScheduled }) {
  const config = status === 'active'
    ? isScheduled
      ? { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Programada' }
      : { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Activa' }
    : { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Inactiva' };
  return <span className={`${config.bg} ${config.text} px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider`}>{config.label}</span>;
}

function SummaryCard({ label, value, detail, tone }) {
  const tones = { emerald: 'bg-emerald-50 text-emerald-800', amber: 'bg-amber-50 text-amber-800', gray: 'bg-gray-100 text-gray-700' };
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${tones[tone] || tones.gray}`}>{label}</div>
      <div className="mt-3 text-3xl font-bold text-gray-900 tabular-nums">{value}</div>
      <p className="mt-2 text-sm leading-5 text-gray-500">{detail}</p>
    </div>
  );
}
