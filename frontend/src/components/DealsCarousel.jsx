import React, { useMemo, useState, useEffect } from 'react';

function parseStoredArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

function CountdownTimer({ endDate }) {
  const [remaining, setRemaining] = useState({});

  useEffect(() => {
    if (!endDate) return;
    const update = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) return setRemaining({ expired: true });
      setRemaining({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  if (!endDate || remaining.expired) return null;
  return (
    <div className="flex items-center gap-2">
      {['days','hours','minutes','seconds'].map(k => (
        <div key={k} className="flex flex-col items-center">
          <div className="bg-black/20 text-white rounded-lg w-10 h-10 flex items-center justify-center text-lg font-bold tabular-nums">
            {String(remaining[k] ?? 0).padStart(2, '0')}
          </div>
          <span className="text-[10px] text-white/70 uppercase mt-1">{k === 'days' ? 'días' : k === 'hours' ? 'hrs' : k === 'minutes' ? 'min' : 'seg'}</span>
        </div>
      ))}
    </div>
  );
}

export default function DealsCarousel({ promotions, categories, products, onCategorySelect, onShowCatalog }) {
  const [activeTab, setActiveTab] = useState(0);

  const activePromotions = useMemo(() => {
    const categoryNameToId = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
    const productNameToId = new Map(products.map(p => [p.name.toLowerCase(), p.id]));

    return promotions
      .filter(p => p.status === 'active')
      .map(p => {
        const categoryIds = parseStoredArray(p.category_ids).map(v => {
          if (typeof v === 'number') return v;
          const n = Number(v);
          if (!isNaN(n) && String(v).trim() !== '') return n;
          return categoryNameToId.get(String(v).toLowerCase()) ?? null;
        }).filter(v => v !== null);

        const productIds = parseStoredArray(p.product_ids).map(v => {
          if (typeof v === 'number') return v;
          const n = Number(v);
          if (!isNaN(n) && String(v).trim() !== '') return n;
          return productNameToId.get(String(v).toLowerCase()) ?? null;
        }).filter(v => v !== null);

        const matchedProducts = products.filter(pr => productIds.includes(pr.id));
        return { ...p, categoryIds, productIds, matchedProducts };
      })
      .slice(0, 6);
  }, [categories, products, promotions]);

  const current = activePromotions[activeTab] || null;
  const discountColors = ['from-violet-600 to-indigo-700', 'from-emerald-600 to-teal-700', 'from-amber-600 to-orange-700', 'from-rose-600 to-red-700', 'from-sky-600 to-blue-700', 'from-fuchsia-600 to-purple-700'];

  if (activePromotions.length === 0) return null;

  return (
    <section className="max-w-container-max mx-auto px-margin-desktop py-stack-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">Ofertas del Día</h2>
            <div className="absolute -bottom-1 left-0 w-1/3 h-1 bg-gradient-to-r from-yellow-400 to-transparent rounded-full" />
          </div>
          <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
            {activePromotions.length} activas
          </div>
        </div>
        {activePromotions.length > 1 && (
          <div className="flex gap-2">
            {activePromotions.map((_, i) => (
              <button key={i} onClick={() => setActiveTab(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === activeTab ? 'w-8 bg-gray-900' : 'bg-gray-300 hover:bg-gray-400'}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        <div className="md:col-span-2 relative rounded-2xl overflow-hidden bg-gradient-to-br ${discountColors[activeTab % discountColors.length]} shadow-xl" style={{ backgroundImage: `linear-gradient(135deg, ${current ? ['#7c3aed','#4338ca','#059669','#0d9488','#d97706','#ea580c','#e11d48','#2563eb','#7c3aed','#9333ea'][activeTab % 10] : '#7c3aed'}, ${current ? ['#4338ca','#1e40af','#047857','#0f766e','#b45309','#c2410c','#be123c','#1d4ed8','#4338ca','#6b21a8'][activeTab % 10] : '#4338ca'})` }}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative p-8 flex flex-col justify-between h-full min-h-[280px]">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-semibold mb-4">
                <span className="material-symbols-outlined text-lg">local_offer</span>
                {current.discount_percent}% de descuento
              </div>
              <h3 className="text-3xl font-bold text-white mb-3 leading-tight">{current.name}</h3>
              <p className="text-white/80 text-sm leading-relaxed max-w-md">{current.description || 'Aprovecha esta oferta por tiempo limitado.'}</p>
            </div>
            <div className="mt-6 space-y-4">
              {current.end_date && (
                <div>
                  <p className="text-white/70 text-xs uppercase tracking-wider mb-2 font-semibold">La oferta termina en</p>
                  <CountdownTimer endDate={current.end_date} />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { if (current.categoryIds.length > 0) onCategorySelect?.(current.categoryIds[0]); else onShowCatalog?.(); }}
                  className="inline-flex items-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-xl font-bold text-sm hover:shadow-lg hover:scale-[1.02] transition-all active:scale-95">
                  Explorar oferta
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </button>
                <button onClick={onShowCatalog}
                  className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white border border-white/20 px-6 py-3 rounded-xl font-semibold text-sm hover:bg-white/20 transition-all">
                  Ver catálogo
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-3 space-y-3">
          {activePromotions.map((promo, i) => (
            <button key={promo.id} onClick={() => setActiveTab(i)}
              className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
                i === activeTab
                  ? 'border-gray-900 bg-gray-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 bg-gradient-to-br ${discountColors[i % discountColors.length]}`}>
                {promo.discount_percent}%
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm truncate">{promo.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {promo.matchedProducts.length > 0 ? `${promo.matchedProducts.length} productos` : 'Aplica en toda la tienda'}
                  {promo.end_date ? ` · Hasta ${new Date(promo.end_date).toLocaleDateString()}` : ''}
                </div>
              </div>
              <div className="text-2xl font-black text-gray-900 tabular-nums">{promo.discount_percent}%</div>
              {i === activeTab && (
                <div className="w-2 h-2 rounded-full bg-gray-900 flex-shrink-0" />
              )}
            </button>
          ))}
          {activePromotions.length > 3 && (
            <button onClick={onShowCatalog}
              className="w-full text-center py-3 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors border border-dashed border-gray-300 rounded-xl hover:border-gray-400">
              Ver todas las ofertas
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
