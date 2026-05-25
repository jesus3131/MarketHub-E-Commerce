import React, { useState } from 'react';

export default function FooterSection() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = () => {
    if (!email || !email.includes('@')) return;
    setSubscribed(true);
    setEmail('');
    setTimeout(() => setSubscribed(false), 3000);
  };

  return (
    <footer className="bg-surface-container-lowest border-t border-outline-variant pt-16 pb-8">
      <div className="max-w-container-max mx-auto px-margin-desktop">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter mb-16">
          <div className="space-y-6">
            <span className="text-headline-md font-headline-md font-bold text-primary">MarketHub</span>
            <p className="text-body-md text-on-surface-variant">La plataforma líder en tecnología y estilo de vida, ofreciendo productos de alta gama con la mejor experiencia de usuario.</p>
            <div className="flex gap-4">
              <a className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all" href="#"><span className="material-symbols-outlined text-[20px]">public</span></a>
              <a className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all" href="#"><span className="material-symbols-outlined text-[20px]">chat</span></a>
              <a className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all" href="#"><span className="material-symbols-outlined text-[20px]">video_library</span></a>
            </div>
          </div>
          <div>
            <h5 className="font-label-md text-on-surface mb-6">Corporativo</h5>
            <ul className="space-y-3 text-on-surface-variant font-body-md">
              <li><a className="hover:text-primary hover:underline transition-all" href="#">Sobre Nosotros</a></li>
              <li><a className="hover:text-primary hover:underline transition-all" href="#">Nuestras Tiendas</a></li>
              <li><a className="hover:text-primary hover:underline transition-all" href="#">Trabaja con Nosotros</a></li>
              <li><a className="hover:text-primary hover:underline transition-all" href="#">Blog de Innovación</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-label-md text-on-surface mb-6">Soporte</h5>
            <ul className="space-y-3 text-on-surface-variant font-body-md">
              <li><a className="hover:text-primary hover:underline transition-all" href="#">Centro de Ayuda</a></li>
              <li><a className="hover:text-primary hover:underline transition-all" href="#">Política de Envíos</a></li>
              <li><a className="hover:text-primary hover:underline transition-all" href="#">Términos de Servicio</a></li>
              <li><a className="hover:text-primary hover:underline transition-all" href="#">Privacidad y Cookies</a></li>
            </ul>
          </div>
          <div className="space-y-6">
            <h5 className="font-label-md text-on-surface">Boletín Informativo</h5>
            <p className="text-body-md text-on-surface-variant">Suscríbete para recibir ofertas exclusivas y novedades tecnológicas.</p>
            <div className="flex gap-2">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSubscribe(); }} placeholder="Tu email" className="flex-1 bg-surface-variant border-none rounded-lg px-4 focus:ring-1 focus:ring-primary text-body-md" />
              <button type="button" onClick={handleSubscribe} className="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md hover:opacity-90 transition-opacity">{subscribed ? 'Listo' : 'OK'}</button>
            </div>
            {subscribed && <p className="text-sm text-success-green">Suscripción registrada correctamente.</p>}
          </div>
        </div>
        <div className="pt-8 border-t border-outline-variant flex flex-col md:flex-row justify-between items-center gap-4 text-on-surface-variant text-[14px]">
          <span>© 2026 MarketHub. Todos los derechos reservados.</span>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">language</span>
              Español (ES)
            </span>
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">attach_money</span>
              USD
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
