import React, { useState } from 'react';

const PAYMENT_METHODS = [
  { id: 'card', label: 'Tarjeta de Crédito/Débito', icon: 'credit_card' },
  { id: 'transfer', label: 'Transferencia Bancaria', icon: 'account_balance' },
  { id: 'cash', label: 'Pago contra entrega', icon: 'payments' },
];

export default function CheckoutPage({ cart, cartTotal, user, onPlaceOrder, onBack }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: user?.email || '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    notes: '',
    paymentMethod: 'card',
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onPlaceOrder({
        shipping: {
          fullName: form.fullName, email: form.email, phone: form.phone,
          address: form.address, city: form.city, state: form.state,
          zip: form.zip, notes: form.notes,
        },
        paymentMethod: form.paymentMethod,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canContinueStep1 = form.fullName && form.address && form.city && form.phone;
  const canContinueStep2 = form.paymentMethod;

  if (cart.length === 0) {
    return (
      <div className="checkout-page">
        <div className="empty-state-animated">
          <span className="material-symbols-outlined">shopping_cart</span>
          <h3>Tu carrito está vacío</h3>
          <p>Agrega productos antes de pagar</p>
          <button onClick={onBack} className="btn-primary" style={{ width: 'auto', display: 'inline-flex' }}>Volver a la tienda</button>
        </div>
      </div>
    );
  }

  const stepStatus = (num) => {
    if (step > num) return 'completed';
    if (step === num) return 'active';
    return 'pending';
  };

  return (
    <div className="checkout-page animate-fade-in-up">
      <button onClick={() => step > 1 ? setStep(step - 1) : onBack()} className="checkout-back">
        <span className="material-symbols-outlined">arrow_back</span>
        {step > 1 ? 'Volver al paso anterior' : 'Volver al carrito'}
      </button>

      <div className="checkout-progress">
        {[
          { num: 1, label: 'Envío' },
          { num: 2, label: 'Pago' },
          { num: 3, label: 'Revisar' },
        ].map((s, i) => (
          <React.Fragment key={s.num}>
            <div className="checkout-step">
              <div className={`checkout-step-number ${stepStatus(s.num)}`}>
                {step > s.num ? (
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>
                ) : s.num}
              </div>
              <span className={`checkout-step-label ${stepStatus(s.num)}`}>{s.label}</span>
            </div>
            {i < 2 && <div className={`checkout-progress-line ${stepStatus(s.num)}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="checkout-layout">
        <div>
          {step === 1 && (
            <div className="checkout-form-section animate-fade-in-up">
              <h2 className="checkout-form-title">Información de Envío</h2>
              <div className="checkout-form-grid">
                <div className="full-width">
                  <label className="checkout-field-label">Nombre Completo *</label>
                  <input className="checkout-field-input" value={form.fullName} onChange={e => update('fullName', e.target.value)} placeholder="Juan Pérez" />
                </div>
                <div>
                  <label className="checkout-field-label">Email *</label>
                  <input className="checkout-field-input" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="correo@ejemplo.com" />
                </div>
                <div>
                  <label className="checkout-field-label">Teléfono *</label>
                  <input className="checkout-field-input" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+52 55 1234 5678" />
                </div>
                <div className="full-width">
                  <label className="checkout-field-label">Dirección *</label>
                  <input className="checkout-field-input" value={form.address} onChange={e => update('address', e.target.value)} placeholder="Calle y número, Colonia" />
                </div>
                <div>
                  <label className="checkout-field-label">Ciudad *</label>
                  <input className="checkout-field-input" value={form.city} onChange={e => update('city', e.target.value)} placeholder="Ciudad" />
                </div>
                <div>
                  <label className="checkout-field-label">Estado</label>
                  <input className="checkout-field-input" value={form.state} onChange={e => update('state', e.target.value)} placeholder="Estado" />
                </div>
                <div>
                  <label className="checkout-field-label">Código Postal</label>
                  <input className="checkout-field-input" value={form.zip} onChange={e => update('zip', e.target.value)} placeholder="12345" />
                </div>
                <div>
                  <label className="checkout-field-label">Notas del pedido</label>
                  <input className="checkout-field-input" value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Instrucciones especiales" />
                </div>
              </div>
              <div className="checkout-nav">
                <div />
                <button onClick={() => setStep(2)} disabled={!canContinueStep1} className="btn-primary" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  Continuar al Pago
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="checkout-form-section animate-fade-in-up">
              <h2 className="checkout-form-title">Método de Pago</h2>
              <div className="payment-methods">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => update('paymentMethod', m.id)}
                    className={`payment-method-btn ${form.paymentMethod === m.id ? 'selected' : ''}`}
                  >
                    <span className={`material-symbols-outlined payment-method-icon ${form.paymentMethod === m.id ? 'selected' : 'default'}`}>
                      {m.icon}
                    </span>
                    <span className="payment-method-label">{m.label}</span>
                    {form.paymentMethod === m.id && (
                      <span className="material-symbols-outlined payment-method-check">check_circle</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="checkout-nav">
                <button onClick={() => setStep(1)} className="btn-secondary" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
                  Regresar
                </button>
                <button onClick={() => setStep(3)} disabled={!canContinueStep2} className="btn-primary" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  Revisar Pedido
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="checkout-form-section animate-fade-in-up">
              <h2 className="checkout-form-title">Revisar tu Pedido</h2>

              <div className="review-section-title">Dirección de Envío</div>
              <div className="review-card">
                <p className="name">{form.fullName}</p>
                <p>{form.address}</p>
                <p>{form.city}{form.state ? `, ${form.state}` : ''} {form.zip}</p>
                <p>{form.phone}</p>
                <p style={{ color: 'var(--color-on-surface-variant)' }}>{form.email}</p>
                {form.notes && <p className="note">Nota: {form.notes}</p>}
              </div>

              <div className="review-section-title">Método de Pago</div>
              <div className="review-card review-payment">
                <span className="material-symbols-outlined review-payment-icon">
                  {PAYMENT_METHODS.find(m => m.id === form.paymentMethod)?.icon}
                </span>
                <span className="payment-method-label">{PAYMENT_METHODS.find(m => m.id === form.paymentMethod)?.label}</span>
              </div>

              <div className="review-section-title">Productos</div>
              {cart.map(item => (
                <div key={item.productId} className="review-product-item">
                  <div className="review-product-thumb">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} />
                    ) : (
                      <div className="placeholder">
                        <span className="material-symbols-outlined">shopping_bag</span>
                      </div>
                    )}
                  </div>
                  <div className="review-product-info">
                    <p className="review-product-name">{item.name}</p>
                    <p className="review-product-detail">${parseFloat(item.price).toFixed(2)} x {item.quantity}</p>
                  </div>
                  <span className="review-product-total">${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                </div>
              ))}

              <div className="checkout-nav">
                <button onClick={() => setStep(2)} className="btn-secondary" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
                  Regresar
                </button>
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {submitting ? 'Procesando...' : `Confirmar Pedido — $${cartTotal.toFixed(2)}`}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="checkout-summary">
          <div className="checkout-summary-card">
            <h3 className="checkout-summary-title">Resumen</h3>
            <div className="checkout-summary-row">
              <span className="checkout-summary-label">Subtotal ({cart.length} producto{cart.length !== 1 ? 's' : ''})</span>
              <span className="checkout-summary-value">${cartTotal.toFixed(2)}</span>
            </div>
            <div className="checkout-summary-row">
              <span className="checkout-summary-label">Envío</span>
              <span className="checkout-summary-value free">Gratis</span>
            </div>
            <div className="checkout-summary-total">
              <span className="checkout-summary-total-label">Total</span>
              <span className="checkout-summary-total-value">${cartTotal.toFixed(2)}</span>
            </div>

            <div className="checkout-summary-items">
              {cart.map(item => (
                <div key={item.productId} className="checkout-summary-item">
                  <div className="checkout-summary-item-thumb">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} />
                    ) : (
                      <div className="placeholder">
                        <span className="material-symbols-outlined">shopping_bag</span>
                      </div>
                    )}
                  </div>
                  <span className="checkout-summary-item-name">{item.name}</span>
                  <span className="checkout-summary-item-qty">x{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
