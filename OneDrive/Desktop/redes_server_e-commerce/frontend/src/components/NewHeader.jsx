import React, { useEffect, useRef, useState } from 'react';

export default function NewHeader({
  user, cartCount, notificationCount, currentView, selectedCategoryId,
  onCartClick, onNotificationsClick, onHomeClick, onAdminClick,
  onLogoutClick, searchQuery, onSearchChange, onSearch, onLoginClick,
  categories, onCategorySelect,
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const userName = user?.email?.split('@')[0] || 'Mi cuenta';
  const initial = user?.email ? user.email.charAt(0).toUpperCase() : 'M';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-surface-container-high shadow-sm">
      <div className="max-w-container-max mx-auto px-margin-desktop py-4 flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <button type="button" onClick={onHomeClick} className="text-2xl font-extrabold tracking-tight text-on-surface hover:text-secondary transition-colors">
              MarketHub
            </button>
            <span className="hidden md:inline-flex items-center gap-2 rounded-full bg-secondary-container/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
              <span className="material-symbols-outlined text-[16px]">local_mall</span>
              Compra inteligente
            </span>
          </div>

          <div className="flex flex-1 min-w-0 items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
                placeholder="Buscar productos, marcas o categorías..."
                className="w-full rounded-full border border-outline-variant bg-surface-container-lowest py-3 pl-12 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
              />
            </div>
            <button type="button" className="rounded-full bg-surface-container-lowest p-3 text-on-surface shadow-sm hover:bg-surface-container transition-colors" onClick={onCartClick}>
              <span className="material-symbols-outlined text-[22px]">shopping_cart</span>
              {cartCount > 0 && (
                <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-on-secondary text-[10px] font-semibold">{cartCount > 99 ? '99+' : cartCount}</span>
              )}
            </button>
            <button type="button" className="rounded-full bg-surface-container-lowest p-3 text-on-surface shadow-sm hover:bg-surface-container transition-colors" onClick={onNotificationsClick}>
              <span className="material-symbols-outlined text-[22px]">notifications</span>
            </button>
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button type="button" onClick={() => setShowUserMenu(prev => !prev)} className="flex items-center gap-3 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-2 shadow-sm hover:bg-surface-container transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container font-bold">{initial}</div>
                  <span className="hidden sm:inline-flex font-semibold text-on-surface">{userName}</span>
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 top-[calc(100%+10px)] w-72 rounded-[28px] border border-outline-variant bg-surface-container-lowest p-3 shadow-2xl z-50">
                    <div className="rounded-3xl bg-surface-container px-4 py-4">
                      <div className="text-sm font-semibold text-on-surface">{user.email}</div>
                      <div className="text-xs text-on-surface-variant">{user.role === 'admin' ? 'Administrador' : 'Cliente'}</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {user.role === 'admin' && (
                        <button type="button" onClick={() => { setShowUserMenu(false); onAdminClick(); }} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-on-surface transition hover:bg-surface-container">
                          <span className="material-symbols-outlined text-[20px] text-secondary">dashboard</span>
                          Panel administrativo
                        </button>
                      )}
                      <button type="button" onClick={() => { setShowUserMenu(false); onHomeClick(); }} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-on-surface transition hover:bg-surface-container">
                        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">home</span>
                        Volver al inicio
                      </button>
                      <button type="button" onClick={() => { setShowUserMenu(false); onLogoutClick(); }} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-error transition hover:bg-error-container">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button type="button" onClick={onLoginClick} className="rounded-full bg-secondary text-on-secondary px-5 py-3 text-sm font-semibold hover:opacity-95 transition-opacity shadow-sm">
                Iniciar sesión
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-surface-container-high py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onHomeClick} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${currentView === 'home' && !selectedCategoryId ? 'bg-secondary text-on-secondary shadow-sm' : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'}`}>
              Inicio
            </button>
            <button type="button" onClick={() => onCategorySelect(null)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${currentView === 'home' && selectedCategoryId ? 'bg-secondary text-on-secondary shadow-sm' : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'}`}>
              Todas las categorías
            </button>
            <button type="button" onClick={() => onCategorySelect(categories?.[0]?.id)} className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors">
              Destacados
            </button>
            <button type="button" onClick={onAdminClick} className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors">
              Panel
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 overflow-x-auto hide-scrollbar py-1">
            {categories.map(cat => (
              <button key={cat.id} type="button" onClick={() => onCategorySelect(cat.id)} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${selectedCategoryId === cat.id ? 'bg-secondary text-on-secondary border-secondary shadow-sm' : 'bg-white text-on-surface border-surface-container-high hover:bg-surface-container'}`}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
