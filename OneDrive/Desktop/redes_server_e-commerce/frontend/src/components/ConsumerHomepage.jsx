import React, { useMemo, useState } from 'react';
import HeroCarousel from './HeroCarousel.jsx';
import FilterBar from './FilterBar.jsx';
import CategoryGrid from './CategoryGrid.jsx';
import DealsCarousel from './DealsCarousel.jsx';
import TrustSection from './TrustSection.jsx';
import FooterSection from './FooterSection.jsx';

function ProductCard({ product, onBuy, onAddToCart, onViewProduct }) {
  return (
    <article onClick={() => onViewProduct?.(product)} className="group bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden hover:shadow-xl transition-all cursor-pointer flex flex-col">
      <div className="relative aspect-square bg-surface-container-low overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="flex h-full items-center justify-center text-outline-variant">
            <span className="material-symbols-outlined text-[54px]">image</span>
          </div>
        )}
        {product.stock <= 0 ? (
          <span className="absolute top-3 left-3 bg-error text-on-error px-2 py-1 rounded text-[12px] font-bold">Agotado</span>
        ) : product.stock <= (product.min_stock || 5) ? (
          <span className="absolute top-3 left-3 bg-error text-on-error px-2 py-1 rounded text-[12px] font-bold">Stock Bajo</span>
        ) : (
          <span className="absolute top-3 left-3 bg-success-green text-on-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase shadow-sm">Disponible</span>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); onAddToCart(product); }} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 text-on-surface-variant flex items-center justify-center hover:text-primary transition-colors shadow-sm">
          <span className="material-symbols-outlined text-[20px]">favorite</span>
        </button>
      </div>
      <div className="p-4 flex-1 flex flex-col gap-2">
        {product.category_name && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-tertiary">{product.category_name}</span>
        )}
        <h3 className="font-headline-md text-body-md text-on-surface line-clamp-2">{product.name}</h3>
        <div className="flex items-center gap-1 text-[#FFD700]">
          <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
          <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
          <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
          <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
          <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 0" }}>star</span>
          <span className="text-on-surface-variant text-[12px] ml-1">({product.stock})</span>
        </div>
        <p className="text-[12px] text-on-surface-variant line-clamp-2">{product.description || 'Producto destacado del catálogo.'}</p>
        <div className="mt-auto flex items-baseline gap-2">
          <span className="text-price-lg font-price-lg text-on-surface">${parseFloat(product.price).toFixed(2)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); onAddToCart(product); }} disabled={product.stock < 1}
            className="flex items-center justify-center gap-1 border border-outline-variant text-on-surface px-3 py-2 rounded-lg text-sm font-semibold hover:bg-surface-variant transition-colors disabled:opacity-50">
            <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onBuy(product.id); }} disabled={product.stock < 1}
            className="bg-primary text-on-primary px-3 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            Comprar
          </button>
        </div>
      </div>
    </article>
  );
}

export default function ConsumerHomepage({
  products, promotions, onBuy, onAddToCart, loading, orders, carouselSlides,
  selectedCategoryId, onCategorySelect, categories, onShowCatalog, onViewOrders,
  onViewProduct,
}) {
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sortBy, setSortBy] = useState('popular');

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (selectedCategoryId) result = result.filter(p => p.category_id === selectedCategoryId);
    if (priceMin !== '') result = result.filter(p => parseFloat(p.price) >= parseFloat(priceMin));
    if (priceMax !== '') result = result.filter(p => parseFloat(p.price) <= parseFloat(priceMax));
    switch (sortBy) {
      case 'price-asc': result.sort((a, b) => parseFloat(a.price) - parseFloat(b.price)); break;
      case 'price-desc': result.sort((a, b) => parseFloat(b.price) - parseFloat(a.price)); break;
      case 'name': result.sort((a, b) => a.name?.localeCompare(b.name)); break;
      case 'newest': result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)); break;
      default: break;
    }
    return result;
  }, [priceMax, priceMin, products, selectedCategoryId, sortBy]);

  const clearFilters = () => {
    setPriceMin(''); setPriceMax(''); setSortBy('popular'); onCategorySelect(null);
  };

  const displayedProducts = filteredProducts.slice(0, 8);
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const heroCategories = categories?.slice(0, 4) || [];

  return (
    <main className="bg-background text-on-surface font-body-md">
      <section className="bg-surface-container-highest py-stack-2xl">
        <div className="max-w-container-max mx-auto px-margin-desktop grid gap-8 lg:grid-cols-[1.2fr_0.8fr] items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary-container/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-secondary">
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              Ofertas seleccionadas
            </span>
            <h1 className="font-display-lg text-display-lg lg:text-[4rem] leading-tight text-on-surface">Tu mercado online renovado con estilo.</h1>
            <p className="max-w-2xl text-body-lg text-on-surface-variant">Descubre lo mejor de MarketHub: banners con promociones reales, categorías destacadas y un menú de navegación rápida pensado para tu experiencia de compra.</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={onShowCatalog} className="inline-flex items-center justify-center rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-on-secondary shadow-lg transition hover:opacity-95">
                Explorar catálogo
              </button>
              <button type="button" onClick={() => onCategorySelect(heroCategories[0]?.id)} className="inline-flex items-center justify-center rounded-full border border-outline-variant bg-white px-6 py-3 text-sm font-semibold text-on-surface shadow-sm transition hover:bg-surface-container">
                Ver categorías
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-outline-variant bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-on-surface">Entrega rápida</h3>
                <p className="mt-2 text-sm text-on-surface-variant">Recibe tus pedidos sin demoras con envío seleccionado.</p>
              </div>
              <div className="rounded-3xl border border-outline-variant bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-on-surface">Ofertas exclusivas</h3>
                <p className="mt-2 text-sm text-on-surface-variant">Promociones directas desde nuestro backend en tiempo real.</p>
              </div>
              <div className="rounded-3xl border border-outline-variant bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-on-surface">Soporte 24/7</h3>
                <p className="mt-2 text-sm text-on-surface-variant">Atención rápida para resolver dudas y cambios.</p>
              </div>
              <div className="rounded-3xl border border-outline-variant bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-on-surface">Compra segura</h3>
                <p className="mt-2 text-sm text-on-surface-variant">Pagos y pedidos protegidos en todo momento.</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-[32px] overflow-hidden border border-surface-container-highest bg-white shadow-2xl">
              <HeroCarousel slides={carouselSlides} onCtaClick={() => {
                const target = document.querySelector('[data-section="catalog-filters"]');
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {heroCategories.map(cat => (
                <button key={cat.id} type="button" onClick={() => onCategorySelect(cat.id)} className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-5 text-left text-on-surface transition hover:border-secondary hover:bg-white">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Categoría</p>
                  <h3 className="mt-2 text-lg font-semibold">{cat.name}</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">{cat.description?.substring(0, 50) || 'Explora productos destacados.'}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-container-max mx-auto px-margin-desktop py-stack-lg">
        <div className="grid gap-3 sm:grid-cols-4">
          <button type="button" onClick={onShowCatalog} className="rounded-3xl border border-outline-variant bg-white px-5 py-4 text-left shadow-sm transition hover:border-secondary hover:bg-surface-container">
            <span className="material-symbols-outlined text-secondary">local_offer</span>
            <h3 className="mt-3 font-semibold text-on-surface">Ofertas instantáneas</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Las mejores promociones en un clic.</p>
          </button>
          <button type="button" onClick={() => onCategorySelect(heroCategories[0]?.id)} className="rounded-3xl border border-outline-variant bg-white px-5 py-4 text-left shadow-sm transition hover:border-secondary hover:bg-surface-container">
            <span className="material-symbols-outlined text-secondary">category</span>
            <h3 className="mt-3 font-semibold text-on-surface">Navegar por categorías</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Encuentra lo que necesitas con rapidez.</p>
          </button>
          <button type="button" onClick={() => onCategorySelect(selectedCategoryId)} className="rounded-3xl border border-outline-variant bg-white px-5 py-4 text-left shadow-sm transition hover:border-secondary hover:bg-surface-container">
            <span className="material-symbols-outlined text-secondary">trending_up</span>
            <h3 className="mt-3 font-semibold text-on-surface">Tendencias</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Productos que otros clientes están comprando.</p>
          </button>
          <button type="button" onClick={onShowCatalog} className="rounded-3xl border border-outline-variant bg-white px-5 py-4 text-left shadow-sm transition hover:border-secondary hover:bg-surface-container">
            <span className="material-symbols-outlined text-secondary">star</span>
            <h3 className="mt-3 font-semibold text-on-surface">Selección premium</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Productos curados para tus mejores decisiones.</p>
          </button>
        </div>
      </section>

      <div data-section="catalog-filters">
        <FilterBar
          categories={categories} selectedCategoryId={selectedCategoryId}
          onCategorySelect={onCategorySelect} priceMin={priceMin} priceMax={priceMax}
          sortBy={sortBy} onSortChange={setSortBy}
          onPriceChange={(min, max) => { setPriceMin(min); setPriceMax(max); }}
          onClearFilters={clearFilters}
        />
      </div>

      {!selectedCategoryId && <CategoryGrid categories={categories} onCategorySelect={onCategorySelect} />}

      <DealsCarousel promotions={promotions} categories={categories} products={products} onCategorySelect={onCategorySelect} onShowCatalog={onShowCatalog} />

      <section className="max-w-container-max mx-auto px-margin-desktop py-stack-lg">
        <div className="flex items-center justify-between mb-stack-lg">
          <h2 className="font-headline-lg text-headline-lg text-on-surface">
            {selectedCategory ? selectedCategory.name : 'Productos Destacados'}
          </h2>
          <span className="text-on-surface-variant text-sm">{filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-outline-variant border-t-secondary" />
            <span className="mt-4 text-sm text-on-surface-variant">Cargando productos...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-20 text-center">
            <span className="material-symbols-outlined text-[58px] text-outline-variant">inventory_2</span>
            <h3 className="mt-4 text-xl font-semibold text-on-surface">No hay coincidencias con los filtros actuales</h3>
            <p className="mt-2 text-sm text-on-surface-variant">Ajusta el rango de precio o vuelve a todas las categorías para seguir explorando.</p>
            <button type="button" onClick={clearFilters} className="mt-6 rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-on-secondary shadow-lg transition hover:opacity-95">
              Reiniciar filtros
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
              {displayedProducts.map(product => (
                <ProductCard key={product.id} product={product} onBuy={onBuy} onAddToCart={onAddToCart} onViewProduct={onViewProduct} />
              ))}
            </div>
            {filteredProducts.length > displayedProducts.length && (
              <div className="mt-8 text-center">
                <button type="button" onClick={onShowCatalog} className="rounded-full border border-outline-variant bg-surface-container-lowest px-6 py-3 text-sm font-semibold text-on-surface hover:bg-surface-variant transition-colors shadow-sm">
                  Ver catálogo completo ({filteredProducts.length} productos)
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {orders?.length > 0 && (
        <section className="max-w-container-max mx-auto px-margin-desktop pb-stack-lg">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-headline-md text-headline-md text-on-surface">Tus órdenes recientes</h3>
              <button type="button" onClick={onViewOrders} className="text-tertiary font-label-md hover:underline">
                Ver historial
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {orders.slice(0, 3).map(order => (
                <div key={order.id} className="rounded-lg bg-surface-container-low p-4">
                  <div className="text-sm font-semibold text-on-surface">Orden #{typeof order.id === 'string' ? order.id.substring(0, 8) : order.id}</div>
                  <div className="mt-2 text-sm text-on-surface-variant">{new Date(order.created_at).toLocaleDateString()}</div>
                  <div className="mt-4 text-lg font-bold text-on-surface">${parseFloat(order.total).toFixed(2)}</div>
                  <div className="mt-2 inline-flex rounded-full bg-secondary-container px-3 py-1 text-xs font-semibold text-on-secondary-container">{order.status}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <TrustSection />
      <FooterSection />
    </main>
  );
}
