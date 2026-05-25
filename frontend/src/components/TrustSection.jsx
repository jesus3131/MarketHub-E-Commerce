import React from 'react';

export default function TrustSection() {
  return (
    <section className="max-w-container-max mx-auto px-margin-desktop py-stack-lg border-y border-outline-variant">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[40px]">payments</span>
          </div>
          <div>
            <h4 className="font-label-md text-on-surface">Métodos de Pago</h4>
            <p className="text-[12px] text-on-surface-variant">Paga con tarjeta de crédito, débito o transferencia bancaria de forma segura.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[40px]">shield</span>
          </div>
          <div>
            <h4 className="font-label-md text-on-surface">Compra Segura</h4>
            <p className="text-[12px] text-on-surface-variant">Tus datos están protegidos con los más altos estándares de encriptación SSL.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[40px]">local_shipping</span>
          </div>
          <div>
            <h4 className="font-label-md text-on-surface">Envío Rápido</h4>
            <p className="text-[12px] text-on-surface-variant">Entregas nacionales en menos de 48 horas para productos seleccionados.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
