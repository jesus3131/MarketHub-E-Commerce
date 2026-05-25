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
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
          notes: form.notes,
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
      <div className="max-w-container-max mx-auto px-margin-desktop py-stack-lg text-center">
        <span className="material-symbols-outlined text-[64px] text-outline-variant">shopping_cart</span>
        <h2 className="headline-lg mt-4">Tu carrito está vacío</h2>
        <p className="text-on-surface-variant mt-2 mb-6">Agrega productos antes de pagar</p>
        <button onClick={onBack} className="btn-primary" style={{ width: 'auto', display: 'inline-flex' }}>Volver a la tienda</button>
      </div>
    );
  }

  return (
    <div className="max-w-container-max mx-auto px-margin-desktop py-stack-lg">
      <button
        onClick={() => step > 1 ? setStep(step - 1) : onBack()}
        className="inline-flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors mb-6 group"
      >
        <span className="material-symbols-outlined text-[20px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
        <span className="text-sm font-semibold">{step > 1 ? 'Volver al paso anterior' : 'Volver al carrito'}</span>
      </button>

      <div className="flex items-center gap-3 mb-8">
        {[
          { num: 1, label: 'Envío' },
          { num: 2, label: 'Pago' },
          { num: 3, label: 'Revisar' },
        ].map(s => (
          <React.Fragment key={s.num}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step >= s.num ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {step > s.num ? (
                  <span className="material-symbols-outlined text-[18px]">check</span>
                ) : s.num}
              </div>
              <span className={`text-sm font-semibold hidden sm:inline ${step >= s.num ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                {s.label}
              </span>
            </div>
            {s.num < 3 && <div className={`flex-1 h-px ${step > s.num ? 'bg-secondary' : 'bg-outline-variant'}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          {step === 1 && (
            <div className="bg-surface border border-outline-variant rounded-xl p-6">
              <h2 className="font-headline-md text-headline-md mb-6">Información de Envío</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-sm font-semibold text-on-surface mb-1.5 block">Nombre Completo *</label>
                  <input className="form-input" value={form.fullName} onChange={e => update('fullName', e.target.value)} placeholder="Juan Pérez" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-on-surface mb-1.5 block">Email *</label>
                  <input className="form-input" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="correo@ejemplo.com" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-on-surface mb-1.5 block">Teléfono *</label>
                  <input className="form-input" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+52 55 1234 5678" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-semibold text-on-surface mb-1.5 block">Dirección *</label>
                  <input className="form-input" value={form.address} onChange={e => update('address', e.target.value)} placeholder="Calle y número, Colonia" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-on-surface mb-1.5 block">Ciudad *</label>
                  <input className="form-input" value={form.city} onChange={e => update('city', e.target.value)} placeholder="Ciudad" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-on-surface mb-1.5 block">Estado</label>
                  <input className="form-input" value={form.state} onChange={e => update('state', e.target.value)} placeholder="Estado" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-on-surface mb-1.5 block">Código Postal</label>
                  <input className="form-input" value={form.zip} onChange={e => update('zip', e.target.value)} placeholder="12345" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-on-surface mb-1.5 block">Notas del pedido</label>
                  <input className="form-input" value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Instrucciones especiales" />
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!canContinueStep1}
                  className="btn-primary"
                  style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  Continuar al Pago
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-surface border border-outline-variant rounded-xl p-6">
              <h2 className="font-headline-md text-headline-md mb-6">Método de Pago</h2>
              <div className="space-y-3">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => update('paymentMethod', m.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                      form.paymentMethod === m.id
                        ? 'border-secondary bg-secondary/5'
                        : 'border-outline-variant bg-surface hover:border-secondary/50'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[28px] ${form.paymentMethod === m.id ? 'text-secondary' : 'text-outline'}`}>
                      {m.icon}
                    </span>
                    <span className="font-semibold text-on-surface">{m.label}</span>
                    {form.paymentMethod === m.id && (
                      <span className="ml-auto material-symbols-outlined text-secondary">check_circle</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-8 flex justify-between">
                <button onClick={() => setStep(1)} className="btn-secondary" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  Regresar
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!canContinueStep2}
                  className="btn-primary"
                  style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  Revisar Pedido
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-surface border border-outline-variant rounded-xl p-6">
              <h2 className="font-headline-md text-headline-md mb-6">Revisar tu Pedido</h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Dirección de Envío</h3>
                  <div className="bg-surface-container-low rounded-lg p-4 text-sm">
                    <p className="font-semibold">{form.fullName}</p>
                    <p>{form.address}</p>
                    <p>{form.city}{form.state ? `, ${form.state}` : ''} {form.zip}</p>
                    <p>{form.phone}</p>
                    <p className="text-on-surface-variant">{form.email}</p>
                    {form.notes && <p className="mt-2 italic text-on-surface-variant">Nota: {form.notes}</p>}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Método de Pago</h3>
                  <div className="bg-surface-container-low rounded-lg p-4 text-sm flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary">
                      {PAYMENT_METHODS.find(m => m.id === form.paymentMethod)?.icon}
                    </span>
                    <span className="font-semibold">{PAYMENT_METHODS.find(m => m.id === form.paymentMethod)?.label}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Productos</h3>
                  <div className="space-y-2">
                    {cart.map(item => (
                      <div key={item.productId} className="flex items-center gap-3 bg-surface-container-low rounded-lg p-3">
                        <div className="w-12 h-12 rounded-lg bg-surface-container overflow-hidden flex-shrink-0">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-outline">
                              <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{item.name}</p>
                          <p className="text-xs text-on-surface-variant">${parseFloat(item.price).toFixed(2)} x {item.quantity}</p>
                        </div>
                        <span className="font-semibold text-sm">${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <button onClick={() => setStep(2)} className="btn-secondary" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  Regresar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="btn-primary"
                  style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  {submitting ? (
                    <>Procesando...</>
                  ) : (
                    <>Confirmar Pedido — ${cartTotal.toFixed(2)}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-24 self-start">
          <div className="bg-surface border border-outline-variant rounded-xl p-6">
            <h3 className="font-headline-md text-headline-md mb-4">Resumen</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Subtotal ({cart.length} producto{cart.length !== 1 ? 's' : ''})</span>
                <span className="font-semibold">${cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Envío</span>
                <span className="text-success-green font-semibold">Gratis</span>
              </div>
              <div className="border-t border-outline-variant pt-3 flex justify-between text-base">
                <span className="font-bold">Total</span>
                <span className="font-bold text-price-lg">${cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              {cart.map(item => (
                <div key={item.productId} className="flex items-center gap-2 py-2 border-b border-outline-variant last:border-0">
                  <div className="w-8 h-8 rounded bg-surface-container overflow-hidden flex-shrink-0">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-outline">
                        <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{item.name}</p>
                  </div>
                  <span className="text-xs font-semibold">x{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
