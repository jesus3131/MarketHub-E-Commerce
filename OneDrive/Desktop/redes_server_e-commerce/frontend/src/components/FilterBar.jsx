import React, { useState, useRef, useEffect } from 'react';

export default function FilterBar({ categories, selectedCategoryId, onCategorySelect, priceMin, priceMax, sortBy, onSortChange, onPriceChange, onClearFilters }) {
  const [expanded, setExpanded] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const scrollRef = useRef(null);
  const displayCats = showAllCategories ? categories : categories.slice(0, 6);
  const hasActiveFilters = selectedCategoryId || priceMin || priceMax || sortBy !== 'popular';

  useEffect(() => {
    if (selectedCategoryId && scrollRef.current) {
      const btn = scrollRef.current.querySelector(`[data-cat-id="${selectedCategoryId}"]`);
      if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedCategoryId]);

  return (
    <section className="max-w-container-max mx-auto px-margin-desktop py-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-500 text-xl">filter_list</span>
                <span className="font-semibold text-sm text-gray-700">Filtros</span>
              </div>
              {hasActiveFilters && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs text-amber-600 font-medium">Filtros activos</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {hasActiveFilters && (
                <button onClick={onClearFilters}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">close</span>
                  Limpiar
                </button>
              )}
              <button onClick={() => setExpanded(!expanded)}
                className="md:hidden text-gray-500 hover:text-gray-700 transition-colors">
                <span className="material-symbols-outlined">{expanded ? 'expand_less' : 'expand_more'}</span>
              </button>
            </div>
          </div>

          <div className={`space-y-4 ${expanded ? 'block' : 'hidden'} md:block`}>
            <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin -mx-1 px-1">
              <button onClick={() => { onCategorySelect(null); setShowAllCategories(false); }}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                  !selectedCategoryId
                    ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
                }`}>
                Todos
              </button>
              {displayCats.map(cat => (
                <button key={cat.id} data-cat-id={cat.id} onClick={() => onCategorySelect(selectedCategoryId === cat.id ? null : cat.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all border whitespace-nowrap ${
                    selectedCategoryId === cat.id
                      ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
                  }`}>
                  {cat.name}
                </button>
              ))}
              {categories.length > 6 && (
                <button onClick={() => setShowAllCategories(!showAllCategories)}
                  className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-all whitespace-nowrap">
                  {showAllCategories ? 'Mostrar menos' : `+${categories.length - 6}`}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Precio</span>
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">$</span>
                    <input type="number" placeholder="Mín" value={priceMin} onChange={e => onPriceChange(e.target.value, priceMax)}
                      className="w-24 pl-7 pr-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 outline-none transition focus:border-gray-900 focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <span className="text-gray-300 text-sm">—</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">$</span>
                    <input type="number" placeholder="Máx" value={priceMax} onChange={e => onPriceChange(priceMin, e.target.value)}
                      className="w-24 pl-7 pr-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 outline-none transition focus:border-gray-900 focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ordenar</span>
                <select value={sortBy} onChange={e => onSortChange(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 outline-none transition focus:border-gray-900 focus:bg-white cursor-pointer">
                  <option value="popular">Más populares</option>
                  <option value="price-asc">Menor precio</option>
                  <option value="price-desc">Mayor precio</option>
                  <option value="name">Nombre A-Z</option>
                  <option value="newest">Más nuevos</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
