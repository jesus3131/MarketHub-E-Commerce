import React, { useCallback, useEffect, useMemo, useState } from 'react';

const resolveSlideImage = (slide) => {
  return slide.image_url
    || slide.image
    || slide.banner_url
    || slide.banner
    || slide.url
    || slide.images?.[0]?.image_url
    || slide.images?.[0]?.url
    || slide.images?.[0]?.banner_url
    || null;
};

const buildSlideItems = (slides = []) => {
  if (!Array.isArray(slides) || slides.length === 0) return [];

  return slides.flatMap((slide) => {
    const base = {
      badge: slide.category_name || slide.title || 'Destacado',
      title: slide.title || 'Nueva colección disponible',
      subtitle: slide.description || 'Descubre novedades seleccionadas para tu tienda.',
      cta: slide.button_text || 'Explorar',
      redirectUrl: slide.redirect_url || slide.redirectUrl || '#',
    };

    if (Array.isArray(slide.images) && slide.images.length > 0) {
      return slide.images
        .map((img) => ({
          ...base,
          img: img.image_url || img.url || img.banner_url || resolveSlideImage(slide),
        }))
        .filter((item) => item.img);
    }

    const imageUrl = resolveSlideImage(slide);
    return imageUrl ? [{ ...base, img: imageUrl }] : [];
  });
};

export default function HeroCarousel({ slides = [], onCtaClick }) {
  const items = useMemo(() => buildSlideItems(slides), [slides]);

  const [current, setCurrent] = useState(0);
  const total = items.length;

  const goTo = useCallback((index) => setCurrent(index), []);
  const prev = useCallback(() => setCurrent((value) => (value - 1 + total) % total), [total]);
  const next = useCallback(() => setCurrent((value) => (value + 1) % total), [total]);

  useEffect(() => {
    const timer = setInterval(() => setCurrent((value) => (value + 1) % total), 6000);
    return () => clearInterval(timer);
  }, [total]);

  if (items.length === 0) {
    return (
      <section className="relative w-full h-[420px] overflow-hidden bg-surface-container-high rounded-3xl border border-outline-variant flex items-center justify-center px-margin-desktop">
        <div className="max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-secondary mb-3">Carrusel de banners</p>
          <h2 className="font-headline-lg text-3xl text-on-surface">No hay banners activos en el carrusel</h2>
          <p className="mt-3 text-on-surface-variant">Agrega banners desde el panel de administración para que se muestren automáticamente en el inicio.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full h-[600px] overflow-hidden bg-surface-container-high rounded-3xl">
      <div className="flex h-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${current * 100}%)` }}>
        {items.map((slide, index) => (
          <div key={index} className="min-w-full h-full relative">
            <img src={slide.img} alt={slide.title} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 hero-gradient flex items-center">
              <div className="max-w-container-max mx-auto px-margin-desktop w-full">
                <div className="max-w-xl space-y-6">
                  <span className="inline-block px-3 py-1 bg-primary text-on-primary text-[12px] font-bold tracking-widest uppercase rounded">
                    {slide.badge}
                  </span>
                  <h2 className="font-display-lg text-display-lg text-on-surface leading-tight">{slide.title}</h2>
                  <p className="font-body-lg text-on-surface-variant">{slide.subtitle}</p>
                  <button
                    type="button"
                    onClick={() => onCtaClick?.(slide)}
                    className="bg-primary text-on-primary px-8 py-4 rounded-xl font-headline-md shadow-lg hover:opacity-90 transition-all transform active:scale-95"
                  >
                    {slide.cta}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button type="button" onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 border border-outline-variant text-on-surface flex items-center justify-center hover:bg-white shadow-md z-10">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button type="button" onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 border border-outline-variant text-on-surface flex items-center justify-center hover:bg-white shadow-md z-10">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-10">
            {items.map((_, index) => (
              <button key={index} type="button" onClick={() => goTo(index)}
                className={`w-3 h-3 rounded-full transition-all ${index === current ? 'bg-primary' : 'bg-outline-variant'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
