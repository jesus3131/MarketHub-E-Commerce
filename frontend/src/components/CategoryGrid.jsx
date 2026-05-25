import React from 'react';

const categoryIcons = {
  'Electrónica': 'devices',
  'Moda': 'checkroom',
  'Hogar': 'chair',
  'Belleza': 'spa',
  'Deportes': 'sports_soccer',
  'Libros': 'menu_book',
  'Juguetes': 'toys',
  'Mascotas': 'pets',
};

const accentColors = [
  { container: 'bg-secondary-container', onContainer: 'text-on-secondary-container' },
  { container: 'bg-tertiary-container', onContainer: 'text-on-tertiary-container' },
  { container: 'bg-primary-container', onContainer: 'text-on-primary-container' },
  { container: 'bg-error-container', onContainer: 'text-on-error-container' },
];

export default function CategoryGrid({ categories, onCategorySelect }) {
  const displayCats = categories.slice(0, 4);

  return (
    <section className="max-w-container-max mx-auto px-margin-desktop py-stack-lg">
      <div className="flex items-center justify-between mb-stack-md">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Categorías Destacadas</h2>
        <a className="text-tertiary font-label-md hover:underline" href="#">Ver todas</a>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
        {displayCats.map((cat, i) => {
          const color = accentColors[i % accentColors.length];
          return (
            <button key={cat.id} type="button" onClick={() => onCategorySelect(cat.id)}
              className="group cursor-pointer bg-surface-container-lowest p-6 rounded-xl border border-outline-variant flex flex-col items-center gap-4 hover:shadow-md hover:border-primary transition-all"
            >
              <div className={`w-16 h-16 rounded-full ${color.container} flex items-center justify-center ${color.onContainer} group-hover:scale-110 transition-transform`}>
                <span className="material-symbols-outlined text-[32px]">{categoryIcons[cat.name] || 'category'}</span>
              </div>
              <span className="font-headline-md text-on-surface">{cat.name}</span>
              <span className="text-[12px] text-on-surface-variant">{cat.description?.substring(0, 30) || 'Productos destacados'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
