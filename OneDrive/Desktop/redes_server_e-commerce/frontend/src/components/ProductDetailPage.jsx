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
    for (let i = 0; i < quantity; i++) {
      onAddToCart(product);
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuy = () => {
    onBuy(product.id);
  };

  if (loading || !product) {
    return (
      <div className="max-w-container-max mx-auto px-margin-desktop py-stack-lg">
        <div className="animate-pulse">
          <div className="h-6 w-24 bg-surface-container-high rounded mb-8" />
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="aspect-square bg-surface-container-high rounded-2xl" />
            <div className="space-y-4">
              <div className="h-4 w-20 bg-surface-container-high rounded" />
              <div className="h-8 w-3/4 bg-surface-container-high rounded" />
              <div className="h-6 w-1/4 bg-surface-container-high rounded" />
              <div className="h-20 w-full bg-surface-container-high rounded" />
              <div className="h-10 w-40 bg-surface-container-high rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-container-max mx-auto px-margin-desktop py-stack-lg">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors mb-6 group"
      >
        <span className="material-symbols-outlined text-[20px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
        <span className="text-sm font-semibold">Volver</span>
      </button>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative">
          <div className="aspect-square rounded-2xl bg-surface-container-low overflow-hidden border border-outline-variant">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-outline-variant">
                <span className="material-symbols-outlined text-[80px]">image</span>
              </div>
            )}
          </div>
          {product.stock <= 0 && (
            <div className="absolute top-4 left-4 bg-error text-on-error px-3 py-1.5 rounded-lg text-sm font-bold">Agotado</div>
          )}
          {product.stock > 0 && product.stock <= (product.min_stock || 5) && (
            <div className="absolute top-4 left-4 bg-error text-on-error px-3 py-1.5 rounded-lg text-sm font-bold">
              Últimas {product.stock} unidades
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {product.category_name && (
            <span className="text-xs font-semibold uppercase tracking-widest text-tertiary">{product.category_name}</span>
          )}

          <h1 className="font-headline-lg text-headline-lg text-on-surface leading-tight">{product.name}</h1>

          <div className="flex items-center gap-1 text-[#FFD700]">
            {[1,2,3,4,5].map(i => (
              <span key={i} className={`material-symbols-outlined text-[18px] ${i <= 4 ? '' : 'opacity-30'}`}
                style={{ fontVariationSettings: `'FILL' ${i <= 4 ? 1 : 0}` }}>star</span>
            ))}
            <span className="text-on-surface-variant text-sm ml-2">(4.0)</span>
          </div>

          <div className="text-price-lg font-price-lg text-on-surface">${parseFloat(product.price).toFixed(2)}</div>

          {product.description && (
            <p className="text-body-md text-on-surface-variant leading-relaxed">{product.description}</p>
          )}

          <div className="flex items-center gap-4 py-3 border-y border-outline-variant">
            <span className="text-sm font-semibold text-on-surface">Cantidad:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={product.stock < 1}
                className="w-9 h-9 rounded-lg border border-outline-variant bg-surface flex items-center justify-center hover:bg-surface-container-high transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">remove</span>
              </button>
              <span className="w-10 text-center font-semibold text-lg">{quantity}</span>
              <button
                onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                disabled={quantity >= product.stock || product.stock < 1}
                className="w-9 h-9 rounded-lg border border-outline-variant bg-surface flex items-center justify-center hover:bg-surface-container-high transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
              </button>
            </div>
            {product.stock > 0 && (
              <span className="text-sm text-on-surface-variant ml-2">{product.stock} disponibles</span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAddToCart}
              disabled={product.stock < 1}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                added
                  ? 'bg-success-green text-white'
                  : 'border-2 border-secondary text-secondary hover:bg-secondary hover:text-on-secondary'
              } disabled:opacity-50`}
            >
              <span className="material-symbols-outlined text-[20px]">{added ? 'check' : 'add_shopping_cart'}</span>
              {added ? 'Agregado' : 'Agregar al Carrito'}
            </button>
            <button
              onClick={handleBuy}
              disabled={product.stock < 1}
              className="flex-1 bg-secondary text-on-secondary px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Comprar Ahora
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm text-on-surface-variant pt-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">inventory</span>
              {product.stock > 0 ? 'En stock' : 'Agotado'}
            </div>
            {product.category_name && (
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">category</span>
                {product.category_name}
              </div>
            )}
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="mt-16">
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-6">Productos Relacionados</h2>
          <div className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map(rp => (
              <div key={rp.id} onClick={() => onBack(rp)} className="group bg-surface border border-outline-variant rounded-xl overflow-hidden hover:shadow-lg transition-all cursor-pointer">
                <div className="aspect-square bg-surface-container-low overflow-hidden">
                  {rp.image_url ? (
                    <img src={rp.image_url} alt={rp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-outline-variant">
                      <span className="material-symbols-outlined text-[40px]">image</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-on-surface text-sm line-clamp-2">{rp.name}</h3>
                  <div className="mt-2 font-bold text-on-surface">${parseFloat(rp.price).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
