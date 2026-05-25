import React, { useState, useEffect, useCallback, useRef } from 'react';

import AdminCarousel from './components/AdminCarousel.jsx';
import AdminReports from './components/AdminReports.jsx';
import AdminInventory from './components/AdminInventory.jsx';
import AdminDiscounts from './components/AdminDiscounts.jsx';
import CatalogPage from './components/CatalogPage.jsx';
import NewHeader from './components/NewHeader.jsx';
import ConsumerHomepage from './components/ConsumerHomepage.jsx';
import ProductDetailPage from './components/ProductDetailPage.jsx';
import CheckoutPage from './components/CheckoutPage.jsx';

const API = '';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home');
  const [adminTab, setAdminTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [cart, setCart] = useState([]);
  const [carouselSlides, setCarouselSlides] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [notificationList, setNotificationList] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [activityEntries, setActivityEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [navCategories, setNavCategories] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [checkoutData, setCheckoutData] = useState(null);

  useEffect(() => {
    let token = localStorage.getItem('token');
    let userId = localStorage.getItem('userId');
    const email = localStorage.getItem('email');
    const role = localStorage.getItem('role');
    if (token && userId) {
      setUser({ token, userId, email, role });
      const saved = localStorage.getItem(`cart_${userId}`);
      if (saved) try { setCart(JSON.parse(saved)); } catch {}
    }
    loadProducts();
    loadCarousel();
    loadPromotions();
  }, []);

  const addToast = (text, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const showMessage = (text, type = 'info') => {
    addToast(text, type);
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const requireAuth = (action) => {
    if (user) return true;
    setPendingAction(() => action);
    setShowAuth(true);
    return false;
  };

  // ─── AUTH ───
  const handleLogin = async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data.userId);
    localStorage.setItem('email', data.email);
    localStorage.setItem('role', data.role || 'user');
    setUser({ token: data.token, userId: data.userId, email: data.email, role: data.role || 'user' });
    const saved = localStorage.getItem(`cart_${data.userId}`);
    if (saved) try { setCart(JSON.parse(saved)); } catch {}
    setMessage(null);
    setShowAuth(false);
    addToast(`¡Bienvenido, ${data.email}!`, 'success');
    if (pendingAction) {
      const action = pendingAction;
      setPendingAction(null);
      setTimeout(() => action(), 300);
    }
  };

  const handleRegister = async (email, password) => {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
  };

  const handleLogout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('userId');
    localStorage.removeItem('email'); localStorage.removeItem('role');
    setUser(null); setProducts([]); setOrders([]);
    setCart([]); setNotificationList([]); setMessage(null);
    addToast('Sesión cerrada correctamente', 'info');
  };

  // ─── DATA LOADING ───
  const loadProducts = useCallback(async (categoryId = selectedCategoryId, searchText = searchQuery) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchText) params.set('search', searchText);
      if (categoryId) params.set('category_id', categoryId);
      const url = `${API}/products${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : (data.products || []));
    } catch {
      addToast('Error al cargar productos', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryId, searchQuery]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API}/orders/user/${user.userId}`, { headers: { 'Authorization': `Bearer ${user.token}` } });
      const data = await res.json(); if (res.ok) setOrders(data);
    } catch { addToast('Error al cargar órdenes', 'error'); }
  }, [user]);

  const loadCarousel = useCallback(async () => {
    try {
      const isAdmin = user?.role === 'admin';
      const url = isAdmin ? `${API}/carousel/all` : `${API}/carousel`;
      const res = await fetch(url, isAdmin ? { headers: { 'Authorization': `Bearer ${user?.token}` } } : {});
      setCarouselSlides(await res.json());
    } catch {}
  }, [user]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API}/notifications/user/${user.userId}`, { headers: { 'Authorization': `Bearer ${user.token}` } });
      if (res.ok) setNotificationList(await res.json());
    } catch {}
  }, [user]);

  const loadPromotions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/promotions`);
      if (res.ok) {
        const data = await res.json();
        setPromotions(Array.isArray(data) ? data : []);
      }
    } catch {}
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/dashboard`, { headers: { 'Authorization': `Bearer ${user?.token}` } });
      if (res.ok) setDashboardStats(await res.json());
    } catch {}
  }, [user]);

  const loadActivities = useCallback(async () => {
    try {
      const res = await fetch(`${API}/activities`, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      });
      if (res.ok) { const data = await res.json(); setActivityEntries(data.entries || []); }
    } catch {}
  }, [user]);

  useEffect(() => {
    if (user) { loadProducts(); loadOrders(); loadCarousel(); loadNotifications(); }
  }, [user, loadProducts, loadOrders, loadCarousel, loadNotifications]);

  useEffect(() => {
    fetch(`${API}/categories`)
      .then(r => r.json())
      .then(data => {
        const cats = Array.isArray(data) ? data : (data.categories || []);
        setNavCategories(cats);
      })
      .catch(() => {});
  }, []);

  // ─── CART ───
  const saveCart = (newCart) => {
    setCart(newCart);
    if (user) localStorage.setItem(`cart_${user.userId}`, JSON.stringify(newCart));
  };

  const addToCart = (product) => {
    if (!requireAuth(() => addToCart(product))) {
      addToast('Debes iniciar sesión para agregar al carrito', 'warning');
      return;
    }
    const existing = cart.find(i => i.productId === product.id);
    if (existing) {
      saveCart(cart.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      saveCart([...cart, { productId: product.id, name: product.name, price: product.price, image_url: product.image_url, quantity: 1 }]);
    }
    addToast(`${product.name} agregado al carrito`, 'success');
  };

  const removeFromCart = (productId) => {
    saveCart(cart.filter(i => i.productId !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) { removeFromCart(productId); return; }
    saveCart(cart.map(i => i.productId === productId ? { ...i, quantity } : i));
  };

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0);

  const handleCheckout = () => {
    if (!requireAuth(null)) {
      addToast('Debes iniciar sesión para pagar', 'warning');
      return;
    }
    setView('checkout');
  };

  const handlePlaceOrder = async (shippingInfo) => {
    if (!user) return;
    try {
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({
          items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
          shipping: shippingInfo
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addToast(`Orden #${data.id} creada exitosamente`, 'success');
      saveCart([]); loadProducts(); loadOrders(); loadNotifications();
      setView('orders');
    } catch (err) { addToast(err.message, 'error'); }
  };

  // ─── PRODUCT DETAIL ───
  const handleViewProduct = (product) => {
    setSelectedProduct(product);
    setView('product-detail');
  };

  const handleBackFromProduct = (relatedProduct) => {
    if (relatedProduct && relatedProduct.id) {
      setSelectedProduct(relatedProduct);
    } else {
      setView('home');
    }
  };

  // ─── BUY ───
  const handleBuy = async (productId) => {
    if (!requireAuth(() => handleBuy(productId))) {
      addToast('Debes iniciar sesión para comprar', 'warning');
      return;
    }
    try {
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({ items: [{ productId, quantity: 1 }] })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addToast(`Orden #${data.id} creada exitosamente`, 'success');
      loadProducts(); loadOrders(); loadNotifications();
    } catch (err) { addToast(err.message, 'error'); }
  };

  const apiToken = user?.token;

  return (
    <div>
      <NewHeader
        user={user}
        cartCount={cartCount}
        notificationCount={notificationList.length}
        currentView={view}
        selectedCategoryId={selectedCategoryId}
        onCartClick={() => {
          if (user) setView('cart');
          else { requireAuth(null); addToast('Inicia sesión para ver tu carrito', 'warning'); }
        }}
        onNotificationsClick={() => {
          if (!requireAuth(null)) { addToast('Inicia sesión para ver notificaciones', 'warning'); return; }
          setView('notifications'); loadNotifications();
        }}
        onHomeClick={() => { setView('home'); setSelectedCategoryId(null); setSearchQuery(''); loadProducts(null, ''); }}
        onAdminClick={() => {
          if (!user) { requireAuth(null); addToast('Inicia sesión como administrador', 'warning'); return; }
          setView('admin'); setAdminTab('dashboard'); loadProducts(); loadDashboard(); loadActivities();
        }}
        searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearch={() => { setSelectedCategoryId(null); loadProducts(null, searchQuery); }}
        onLoginClick={() => setShowAuth(true)}
        onLogoutClick={handleLogout}
        categories={navCategories}
        onCategorySelect={(catId) => { setSelectedCategoryId(catId); setView('home'); loadProducts(catId, searchQuery); }}
      />
      {message && (
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: 'var(--space-sm) var(--space-lg)' }}>
          <div className={`message message-${message.type}`}>{message.text}</div>
        </div>
      )}
      <ToastContainer toasts={toasts} />
      {showAuth && (
        <AuthModal
          onLogin={handleLogin}
          onRegister={handleRegister}
          onClose={() => { setShowAuth(false); setPendingAction(null); }}
        />
      )}
      <main className="main-content">
        {view === 'catálogo' ? (
          <CatalogPage
            products={products}
            categories={navCategories}
            onBuy={handleBuy}
            onAddToCart={addToCart}
            onViewProduct={handleViewProduct}
            onViewOrders={() => {
              if (!requireAuth(null)) { addToast('Inicia sesión para ver tus órdenes', 'warning'); return; }
              setView('orders'); loadOrders();
            }}
            orders={orders}
          />
        ) : view === 'cart' && user ? (
          <CartView cart={cart} cartTotal={cartTotal} onUpdateQuantity={updateQuantity} onRemove={removeFromCart} onCheckout={handleCheckout} onContinue={() => setView('home')} />
        ) : view === 'orders' && user ? (
          <OrdersSection orders={orders} />
        ) : view === 'admin' && user?.role === 'admin' ? (
          <AdminDashboard
            products={products} token={apiToken} user={user}
            onProductChange={() => { loadProducts(); loadOrders(); }}
            showMessage={showMessage}
            adminTab={adminTab} setAdminTab={setAdminTab}
            orders={orders} loadOrders={loadOrders}
            dashboardStats={dashboardStats} loadDashboard={loadDashboard}
            activityEntries={activityEntries} loadActivities={loadActivities}
            carouselSlides={carouselSlides} loadCarousel={loadCarousel}
            onPromotionsChange={loadPromotions}
          />
        ) : view === 'notifications' && user ? (
          <NotificationCenter notifications={notificationList} userId={user.userId} token={apiToken} onRefresh={loadNotifications} />
        ) : view === 'product-detail' ? (
          <ProductDetailPage
            product={selectedProduct}
            onAddToCart={addToCart}
            onBuy={handleBuy}
            onBack={handleBackFromProduct}
            allProducts={products}
            loading={loading}
          />
        ) : view === 'checkout' && user ? (
          <CheckoutPage
            cart={cart}
            cartTotal={cartTotal}
            user={user}
            onPlaceOrder={handlePlaceOrder}
            onBack={() => setView('cart')}
          />
        ) : (
          <ConsumerHomepage
            products={products}
            onBuy={handleBuy} onAddToCart={addToCart}
            loading={loading} orders={orders}
            carouselSlides={carouselSlides}
            promotions={promotions}
            selectedCategoryId={selectedCategoryId}
            onCategorySelect={(catId) => { setSelectedCategoryId(catId); loadProducts(catId); }}
            categories={navCategories}
            onShowCatalog={() => setView('catálogo')}
            onViewOrders={() => {
              if (!requireAuth(null)) { addToast('Inicia sesión para ver tus órdenes', 'warning'); return; }
              setView('orders'); loadOrders();
            }}
            onViewProduct={handleViewProduct}
          />
        )}
      </main>
      <BottomNav view={view} onViewChange={setView} user={user} cartCount={cartCount} onLoginClick={() => setShowAuth(true)} />
    </div>
  );
}

// ─── AUTH MODAL ───
function AuthModal({ onLogin, onRegister, onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (!email || !password) { setError('Todos los campos son obligatorios'); return; }
    if (!isLogin && password !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }
    if (!isLogin && password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    setLoading(true);
    try {
      if (isLogin) await onLogin(email, password);
      else { await onRegister(email, password); setSuccess('¡Registro exitoso! Ahora puedes iniciar sesión.'); setIsLogin(true); setPassword(''); setConfirmPassword(''); }
    } catch (err) {
      const msg = err.message || 'Error de conexión';
      if (msg.includes('Invalid credentials') || msg.includes('invalid')) setError('Correo o contraseña incorrectos');
      else if (msg.includes('already exists') || msg.includes('registered')) setError('Este correo ya está registrado');
      else setError(msg);
    }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="auth-modal-brand">
          <div className="auth-brand-logo">MarketHub</div>
          <h2 className="headline-md" style={{ marginTop: 8 }}>{isLogin ? '¡Bienvenido de vuelta!' : 'Únete a MarketHub'}</h2>
          <p className="body-sm" style={{ color: 'var(--color-on-surface-variant)', marginTop: 4 }}>
            {isLogin
              ? 'Ingresa tus datos para acceder a tu cuenta'
              : 'Crea una cuenta y comienza a comprar'}
          </p>
        </div>
        <div className="auth-tabs">
          <button className={`auth-tab ${isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}>Iniciar Sesión</button>
          <button className={`auth-tab ${!isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}>Registrarse</button>
        </div>
        {error && (
          <div className="auth-alert auth-alert-error">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="auth-alert auth-alert-success">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
            <span>{success}</span>
          </div>
        )}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="modal-email">Correo electrónico</label>
            <input id="modal-email" className="form-input" type="email" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="modal-password">Contraseña</label>
            <input id="modal-password" className="form-input" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {!isLogin && (
            <div className="form-field">
              <label htmlFor="modal-confirm">Confirmar contraseña</label>
              <input id="modal-confirm" className="form-input" type="password" placeholder="Repite tu contraseña" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
          )}
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Procesando...' : isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </button>
          </div>
          <p className="body-sm" style={{ textAlign: 'center', marginTop: 16, color: 'var(--color-on-surface-variant)' }}>
            {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <button type="button" className="auth-switch-btn" onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}>
              {isLogin ? 'Regístrate aquí' : 'Inicia sesión'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

// ─── TOAST CONTAINER ───
function ToastContainer({ toasts }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="material-symbols-outlined toast-icon">
            {t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : t.type === 'warning' ? 'warning' : 'info'}
          </span>
          <span className="toast-text">{t.text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── CART VIEW ───
function CartView({ cart, cartTotal, onUpdateQuantity, onRemove, onCheckout, onContinue }) {
  if (cart.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 64, color: 'var(--color-outline)', marginBottom: 'var(--space-md)' }}>shopping_cart</span>
        <h2 className="headline-lg">Tu carrito está vacío</h2>
        <p style={{ color: 'var(--color-on-surface-variant)', margin: 'var(--space-md) 0 var(--space-lg)' }}>Agrega productos para empezar a comprar</p>
        <button className="btn-primary" style={{ width: 'auto', display: 'inline-flex' }} onClick={onContinue}>Seguir Comprando</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 className="headline-lg" style={{ marginBottom: 'var(--space-lg)' }}>Carrito de Compras ({cart.length} productos)</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {cart.map(item => (
          <div key={item.productId} style={{ display: 'flex', gap: 'var(--space-md)', padding: 'var(--space-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ width: 80, height: 80, borderRadius: 'var(--radius-md)', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {item.image_url ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--color-outline)' }}>shopping_bag</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{item.name}</h4>
              <p style={{ fontSize: 14, color: 'var(--color-on-surface-variant)', marginBottom: 8 }}>${parseFloat(item.price).toFixed(2)} c/u</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <button className="btn-secondary" style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }} onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}>−</button>
                <span style={{ fontSize: 16, fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{item.quantity}</span>
                <button className="btn-secondary" style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }} onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}>+</button>
                <span style={{ marginLeft: 'auto', fontSize: 18, fontWeight: 700 }}>${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                <button style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: 4 }} onClick={() => onRemove(item.productId)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <span style={{ fontSize: 14, color: 'var(--color-on-surface-variant)' }}>Total</span>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-headline)' }}>${cartTotal.toFixed(2)}</div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <button className="btn-secondary" style={{ width: 'auto' }} onClick={onContinue}>Seguir Comprando</button>
          <button className="btn-primary" style={{ width: 'auto' }} onClick={onCheckout}>Pagar Ahora</button>
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCT CARD ───
function ProductCard({ product, onBuy, onAddToCart }) {
  return (
    <div className="product-card">
      <div className="product-card-image" style={{ padding: 0, overflow: 'hidden' }}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span className="material-symbols-outlined placeholder-icon">shopping_bag</span>
        )}
      </div>
      <div className="product-card-body">
        <div className="product-card-price">
          <span className="price">${parseFloat(product.price).toFixed(2)}</span>
        </div>
        <p className="product-card-name">{product.name}</p>
        {product.description && <p style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-sm)' }}>{product.description.substring(0, 60)}</p>}
        <div className="product-card-footer">
          <span className="product-card-stock">{product.stock > 0 ? `${product.stock} disponibles` : 'Agotado'}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-buy" disabled={product.stock < 1} onClick={() => onAddToCart(product)} style={{ fontSize: 12, padding: '4px 8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add_shopping_cart</span>
            </button>
            <button className="btn-buy" disabled={product.stock < 1} onClick={() => onBuy(product.id)}>Comprar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ORDERS ───
function OrdersSection({ orders, compact, onViewAll }) {
  const displayOrders = compact ? orders.slice(0, 3) : orders;

  if (orders.length === 0) {
    return (
      <div className="orders-section">
        <h2 className="headline-md" style={{ marginBottom: 16 }}>Mis Órdenes</h2>
        <div className="empty-state"><span className="material-symbols-outlined">receipt_long</span><p className="body-md">No tienes órdenes aún</p></div>
      </div>
    );
  }

  return (
    <div className={compact ? 'orders-section' : ''} style={!compact ? { marginTop: 0 } : undefined}>
      <div className="section-header">
        <h2 className="headline-md">{compact ? 'Órdenes Recientes' : 'Historial de Órdenes'}</h2>
        {compact && onViewAll && <button onClick={onViewAll} style={{ background: 'none', border: 'none', color: 'var(--color-tertiary)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Ver todas</button>}
      </div>
      <table className="orders-table">
        <thead>
          <tr>
            <th># Orden</th>
            <th>Fecha</th>
            <th>Productos</th>
            <th>Total</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {displayOrders.map(o => (
            <tr key={o.id}>
              <td style={{ fontWeight: 600 }}>#{typeof o.id === 'string' ? o.id.substring(0, 8) : o.id}</td>
              <td>{new Date(o.created_at).toLocaleDateString()}</td>
              <td style={{ fontSize: 13 }}>{o.details ? o.details.map(d => d.name || `#${d.productId?.substring?.(0, 6) || d.productId}`).join(', ') : `${o.items?.[0]?.name || ''}`}</td>
              <td>${parseFloat(o.total).toFixed(2)}</td>
              <td><span className={`status-badge status-${o.status}`}>{o.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── ADMIN DASHBOARD ───
function AdminDashboard({ products, token, user, onProductChange, showMessage, adminTab, setAdminTab, orders, loadOrders, dashboardStats, loadDashboard, activityEntries, loadActivities, carouselSlides, loadCarousel, onPromotionsChange }) {
  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="admin-sidebar-brand-section">
          <div className="admin-sidebar-brand">MarketHub Admin</div>
          <div className="admin-sidebar-role">System Administrator</div>
        </div>
        <div className="admin-sidebar-section" style={{ flex: 1, overflowY: 'auto' }}>
            {[ 
            { key: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
            { key: 'inventory', icon: 'inventory_2', label: 'Inventario' },
            { key: 'discounts', icon: 'sell', label: 'Descuentos' },
            { key: 'carousel', icon: 'view_carousel', label: 'Carrusel' },
            { key: 'activity', icon: 'history', label: 'Actividad' },
            { key: 'orders', icon: 'receipt_long', label: 'Órdenes' },
            { key: 'reports', icon: 'bar_chart', label: 'Reportes' },
          ].map(item => (
            <button key={item.key} className={`dashboard-nav-item ${adminTab === item.key ? 'active' : ''}`} onClick={() => { setAdminTab(item.key); if (item.key === 'orders') loadOrders(); if (item.key === 'dashboard') loadDashboard(); if (item.key === 'activity') loadActivities(); }}>
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
        <div className="admin-sidebar-footer">
          <button className="dashboard-nav-item" onClick={() => { setAdminTab('settings'); }}>
            <span className="material-symbols-outlined">settings</span>Configuración
          </button>
          <button className="dashboard-nav-item" onClick={() => { handleLogoutWrapper(); }}>
            <span className="material-symbols-outlined">logout</span>Cerrar Sesión
          </button>
        </div>
      </aside>
      <div className="dashboard-main">
        {adminTab === 'dashboard' && <AdminOverview stats={dashboardStats} />}
        {adminTab === 'inventory' && <AdminInventory token={token} onProductChange={onProductChange} showMessage={showMessage} />}
        {adminTab === 'discounts' && <AdminDiscounts token={token} showMessage={showMessage} onPromotionsChange={onPromotionsChange} />}
        {adminTab === 'carousel' && <AdminCarousel token={token} onRefresh={loadCarousel} showMessage={showMessage} />}
        {adminTab === 'activity' && <AdminActivity entries={activityEntries} />}
        {adminTab === 'orders' && <OrdersSection orders={orders} />}
        {adminTab === 'reports' && <AdminReports token={token} showMessage={showMessage} />}
        {adminTab === 'settings' && <AdminSettings user={user} />}
      </div>
    </div>
  );
}

function handleLogoutWrapper() {
  localStorage.removeItem('token'); localStorage.removeItem('userId');
  localStorage.removeItem('email'); localStorage.removeItem('role');
  window.location.reload();
}

function AdminOverview({ stats }) {
  if (!stats) return <div className="loading-container"><div className="spinner" /><span>Cargando dashboard...</span></div>;

  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <div>
          <h1 className="headline-lg" style={{ fontFamily: 'var(--font-headline)' }}>Command Center</h1>
          <p style={{ color: 'var(--color-on-surface-variant)', opacity: 0.7 }}>Real-time ecosystem overview</p>
        </div>
      </header>
      <div className="stats-grid">
        <div className="stat-card hover-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
            <div className="icon-bg tertiary"><span className="material-symbols-outlined" style={{ fontSize: 20 }}>payments</span></div>
            <span className="stat-trend up">+12.5% <span className="material-symbols-outlined" style={{ fontSize: 14 }}>trending_up</span></span>
          </div>
          <div className="stat-card-label">Ventas Totales</div>
          <div className="stat-card-value">${parseFloat(stats.revenue || 0).toFixed(2)}</div>
        </div>
        <div className="stat-card hover-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
            <div className="icon-bg secondary"><span className="material-symbols-outlined" style={{ fontSize: 20 }}>shopping_bag</span></div>
            <span className="stat-trend up">+5.2% <span className="material-symbols-outlined" style={{ fontSize: 14 }}>trending_up</span></span>
          </div>
          <div className="stat-card-label">Órdenes</div>
          <div className="stat-card-value">{stats.orderCount || 0}</div>
        </div>
        <div className="stat-card hover-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
            <div className="icon-bg primary"><span className="material-symbols-outlined" style={{ fontSize: 20 }}>group</span></div>
            <span className="stat-trend up">+8% <span className="material-symbols-outlined" style={{ fontSize: 14 }}>trending_up</span></span>
          </div>
          <div className="stat-card-label">Usuarios</div>
          <div className="stat-card-value">{stats.userCount || 0}</div>
        </div>
        <div className="stat-card hover-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
            <div className="icon-bg surface"><span className="material-symbols-outlined" style={{ fontSize: 20 }}>inventory</span></div>
            <span className="stat-trend" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.5 }}>Total</span>
          </div>
          <div className="stat-card-label">Productos</div>
          <div className="stat-card-value">{stats.productCount || 0}</div>
        </div>
      </div>

      {stats.recentOrders && stats.recentOrders.length > 0 && (
        <div className="dashboard-section">
          <div className="dashboard-section-header">
            <h3 style={{ fontFamily: 'var(--font-headline)' }}>Órdenes Recientes</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="activity-log-table">
              <thead><tr><th>#</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
              <tbody>
                {stats.recentOrders.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>#{typeof o.id === 'string' ? o.id.substring(0, 8) : o.id}</td>
                    <td style={{ fontSize: 14 }}>{o.user_email}</td>
                    <td style={{ fontWeight: 500 }}>${parseFloat(o.total).toFixed(2)}</td>
                    <td><span className={`action-badge ${o.status === 'confirmed' ? 'success' : o.status === 'cancelled' ? 'canceled' : 'processing'}`}>{o.status}</span></td>
                    <td style={{ fontSize: 13, color: 'var(--color-on-surface-variant)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats.topProducts && stats.topProducts.length > 0 && (
        <div className="dashboard-section">
          <div className="dashboard-section-header">
            <h3 style={{ fontFamily: 'var(--font-headline)' }}>Productos Más Vendidos</h3>
          </div>
          <div style={{ padding: 'var(--space-lg)' }}>
            {stats.topProducts.map((p, i) => (
              <div key={i} style={{ marginBottom: 'var(--space-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>{p.sold} vendidos</span>
                </div>
                <div className="progress-bar"><div className="progress-fill secondary" style={{ width: `${Math.min(100, (parseInt(p.sold) || 0) * 20)}%` }}></div></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function AdminActivity({ entries }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <div>
          <h2 className="headline-md" style={{ fontFamily: 'var(--font-headline)' }}>Registro de Actividad</h2>
          <p style={{ color: 'var(--color-on-surface-variant)' }}>Historial de acciones administrativas</p>
        </div>
        <a href={`${API}/reports/csv/activities`} className="btn-primary" style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>download</span>CSV
        </a>
      </div>
      {entries.length === 0 ? (
        <div className="empty-state"><span className="material-symbols-outlined">history</span><p className="body-md">Sin actividad registrada aún</p></div>
      ) : (
        <div className="dashboard-section">
          <div style={{ overflowX: 'auto' }}>
            <table className="activity-log-table">
              <thead><tr><th>Fecha/Hora</th><th>Usuario</th><th>Acción</th><th>Descripción</th><th>IP</th></tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td><div style={{ fontSize: 13 }}>{new Date(e.created_at).toLocaleString()}</div></td>
                    <td><span style={{ fontWeight: 600, fontSize: 14 }}>{e.user_name}</span></td>
                    <td><span className={`action-badge ${e.action}`}>{e.action}</span></td>
                    <td style={{ fontSize: 14 }}>{e.description}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--color-on-surface-variant)' }}>{e.ip_address}</td>
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

function BarChart({ data, dataKey, labelKey, color, height = 200 }) {
  if (!data || !data.length) return <div className="empty-state" style={{ height }}><span className="material-symbols-outlined">bar_chart</span><p>Sin datos</p></div>;
  const max = Math.max(...data.map(d => parseFloat(d[dataKey]) || 0));
  if (max === 0) return <div className="empty-state" style={{ height }}><span className="material-symbols-outlined">bar_chart</span><p>Sin datos</p></div>;
  const barWidth = Math.min(60, Math.max(20, (100 / data.length) - 2));
  return (
    <div className="chart-area" style={{ height: height + 40 }}>
      <div className="chart-grid">
        {[0, 0.25, 0.5, 0.75, 1].map(i => <div key={i} className="chart-grid-line" style={{ opacity: 0.08 }} />)}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', width: '100%', height, padding: '0 4px', position: 'relative' }}>
        {data.map((d, i) => {
          const pct = (parseFloat(d[dataKey]) || 0) / max;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: barWidth + 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-on-surface-variant)', marginBottom: 2 }}>{parseFloat(d[dataKey]).toFixed(0)}</div>
              <div style={{ width: barWidth, height: Math.max(4, pct * height), background: color || 'var(--color-tertiary)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s', minHeight: 4 }} />
              <div style={{ fontSize: 9, color: 'var(--color-on-surface-variant)', marginTop: 4, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: barWidth + 16 }}>{d[labelKey]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DonutChart({ data, nameKey, valueKey, size = 200 }) {
  if (!data || !data.length) return <div className="empty-state" style={{ height: size }}><span className="material-symbols-outlined">pie_chart</span><p>Sin datos</p></div>;
  const total = data.reduce((s, d) => s + (parseFloat(d[valueKey]) || 0), 0);
  if (total === 0) return <div className="empty-state" style={{ height: size }}><span className="material-symbols-outlined">pie_chart</span><p>Sin datos</p></div>;
  const colors = ['#005bc0', '#53589f', '#6a5f00', '#10b981', '#ba1a1a', '#d97706', '#8b5cf6', '#ec4899'];
  let cumPct = 0;
  const slices = data.map((d, i) => {
    const pct = (parseFloat(d[valueKey]) || 0) / total;
    const startAngle = cumPct * 360;
    cumPct += pct;
    return { ...d, pct, startAngle, endAngle: cumPct * 360, color: colors[i % colors.length] };
  });
  const cx = size / 2, cy = size / 2, r = size * 0.35;
  const toRad = (deg) => (deg - 90) * Math.PI / 180;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => {
          const x1 = cx + r * Math.cos(toRad(s.startAngle));
          const y1 = cy + r * Math.sin(toRad(s.startAngle));
          const x2 = cx + r * Math.cos(toRad(s.endAngle));
          const y2 = cy + r * Math.sin(toRad(s.endAngle));
          const large = s.pct > 0.5 ? 1 : 0;
          return (
            <path key={i}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
              fill={s.color} stroke="#fff" strokeWidth="2" />
          );
        })}
        <circle cx={cx} cy={cy} r={r * 0.55} fill="var(--color-surface)" />
        <text x={cx} y={cy - 5} textAnchor="middle" style={{ fontSize: 20, fontWeight: 700, fill: 'var(--color-on-surface)' }}>{total.toFixed(0)}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }}>Total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 500 }}>{s[nameKey]}</span>
            <span style={{ color: 'var(--color-on-surface-variant)' }}>({(s.pct * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminSettings({ user }) {
  return (
    <div>
      <h2 className="headline-md" style={{ fontFamily: 'var(--font-headline)', marginBottom: 24 }}>Configuración</h2>
      <div className="dashboard-section">
        <div style={{ padding: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-secondary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700 }}>{user.email.charAt(0).toUpperCase()}</div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>{user.email}</h3>
              <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 14 }}>Rol: <span className="action-badge sync" style={{ textTransform: 'none' }}>{user.role}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NOTIFICATIONS ───
function NotificationCenter({ notifications, userId, token, onRefresh }) {
  const [filter, setFilter] = useState('all');

  const markRead = async (id) => {
    try { await fetch(`${API}/notifications/${id}/read`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }); onRefresh(); } catch {}
  };

  const markAllRead = async () => {
    try { await fetch(`${API}/notifications/read-all/${userId}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }); onRefresh(); } catch {}
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const filtered = filter === 'all' ? notifications : filter === 'unread' ? notifications.filter(n => !n.read) : notifications.filter(n => n.type === filter);

  return (
    <div className="notification-center">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="headline-md" style={{ fontFamily: 'var(--font-headline)' }}>Centro de Notificaciones</h2>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--color-tertiary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Marcar todas leídas
          </button>
        )}
      </div>
      <div className="notification-filters">
        {[
          { key: 'all', label: 'Todas' },
          { key: 'unread', label: `No leídas (${unreadCount})` },
          { key: 'order', label: 'Órdenes' },
          { key: 'promo', label: 'Promociones' },
          { key: 'info', label: 'Info' }
        ].map(f => (
          <button key={f.key} className={`notification-filter ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      <div className="notification-list">
        {filtered.length === 0 ? (
          <div className="empty-state"><span className="material-symbols-outlined">notifications_off</span><p className="body-md">No hay notificaciones</p></div>
        ) : (
          filtered.map(n => (
            <div key={n.id} className={`notification-card ${!n.read ? 'unread' : ''}`} onClick={() => !n.read && markRead(n.id)}>
              <div className={`notification-avatar ${n.type}`}>
                <span className="material-symbols-outlined">{n.type === 'order' ? 'receipt' : n.type === 'promo' ? 'local_offer' : 'info'}</span>
              </div>
              <div className="notification-body">
                <div className="notification-title">{n.title}</div>
                <div className="notification-text">{n.message}</div>
                {!n.read && (
                  <button className="notification-mark-read" onClick={(e) => { e.stopPropagation(); markRead(n.id); }}>Marcar como leída</button>
                )}
              </div>
              <div className="notification-time">{n.created_at ? timeAgo(new Date(n.created_at)) : ''}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function timeAgo(date) {
  const sec = Math.floor((Date.now() - date) / 1000);
  if (sec < 60) return 'Ahora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `Hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Hace ${hr} h`;
  const days = Math.floor(hr / 24);
  return `Hace ${days} día${days > 1 ? 's' : ''}`;
}

// ─── BOTTOM NAV ───
function BottomNav({ view, onViewChange, user, cartCount, onLoginClick }) {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        <button className={`bottom-nav-item ${view === 'home' ? 'active' : ''}`} onClick={() => onViewChange('home')}>
          <span className="material-symbols-outlined">home</span><span>Inicio</span>
        </button>
        <button className={`bottom-nav-item ${view === 'cart' ? 'active' : ''}`} onClick={() => onViewChange('cart')}>
          <span className="material-symbols-outlined" style={{ position: 'relative' }}>shopping_cart</span>
          <span>Carrito{cartCount > 0 ? ` (${cartCount})` : ''}</span>
        </button>
        <button className={`bottom-nav-item ${view === 'orders' ? 'active' : ''}`} onClick={() => onViewChange('orders')}>
          <span className="material-symbols-outlined">receipt_long</span><span>Órdenes</span>
        </button>
        <button className={`bottom-nav-item ${view === 'notifications' ? 'active' : ''}`} onClick={() => onViewChange('notifications')}>
          <span className="material-symbols-outlined">notifications</span><span>Notif.</span>
        </button>
        {user?.role === 'admin' && (
          <button className={`bottom-nav-item ${view === 'admin' ? 'active' : ''}`} onClick={() => onViewChange('admin')}>
            <span className="material-symbols-outlined">admin_panel_settings</span><span>Admin</span>
          </button>
        )}
        {user ? (
          <button className="bottom-nav-item" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('userId'); localStorage.removeItem('email'); localStorage.removeItem('role'); window.location.reload(); }}>
            <span className="material-symbols-outlined">logout</span><span>Salir</span>
          </button>
        ) : (
          <button className={`bottom-nav-item`} onClick={onLoginClick}>
            <span className="material-symbols-outlined">login</span><span>Ingresar</span>
          </button>
        )}
      </div>
    </nav>
  );
}

export default App;
