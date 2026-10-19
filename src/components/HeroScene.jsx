// src/components/HeroScene.jsx
//
// Hero plein écran : décor de coucher de soleil en couches (parallaxe à la souris)
// + une bande de cartes produit pleine largeur qui défile d'un bord à l'autre (pause au survol).
// Sans bibliothèque : CSS 3D uniquement. Les animations s'arrêtent si l'utilisateur
// a demandé « réduire les animations » dans son système.

import { useRef } from "react";
import { useTranslation } from "../i18n/index.js";

const COPY = {
  en: {
    title: "Let clients book while your hands are busy.",
    sub: "One link for bookings, quotes and invoices. Clients pick a time, and Vimen chases the unpaid invoices for you.",
    cta: "Start free",
    more: "See how it works",
    cards: [
      { k: "Booking", a: "Saturday, 14:30", b: "Balayage + cut", s: "Confirmed" },
      { k: "Quote Q-0231", a: "€1,480", b: "Rewire, 2-bed flat", s: "Accepted" },
      { k: "Friday", a: "10:30  13:00", b: "Times your clients see", s: "Open" },
      { k: "Invoice INV-005", a: "€145", b: "Training block", s: "Paid" },
      { k: "Reminder", a: "Sent today", b: "Invoice INV-006", s: "Automatic" },
    ],
  },
  fr: {
    title: "Laissez vos clients réserver pendant que vous travaillez.",
    sub: "Un seul lien pour les réservations, les devis et les factures. Vos clients choisissent un créneau, Vimen relance les impayés.",
    cta: "Commencer gratuitement",
    more: "Voir comment ça marche",
    cards: [
      { k: "Réservation", a: "Samedi, 14:30", b: "Balayage + coupe", s: "Confirmée" },
      { k: "Devis D-0231", a: "1 480 €", b: "Réfection électrique, T2", s: "Accepté" },
      { k: "Vendredi", a: "10:30  13:00", b: "Créneaux vus par vos clients", s: "Libre" },
      { k: "Facture INV-005", a: "145 €", b: "Forfait coaching", s: "Payée" },
      { k: "Relance", a: "Envoyée aujourd'hui", b: "Facture INV-006", s: "Automatique" },
    ],
  },
};

const CSS = `
.vh{position:relative;margin:0;border-radius:0;overflow:hidden;min-height:max(100vh,780px);background:#2A0F08;color:#fff;isolation:isolate}
.vh::after{content:"";position:absolute;left:0;right:0;bottom:0;height:min(42vh,340px);z-index:0;pointer-events:none;background:linear-gradient(180deg,rgba(27,14,9,0) 0%,rgba(27,14,9,.55) 45%,rgba(27,14,9,.92) 82%,#1B0E09 100%)}
.vh-bg{position:absolute;inset:0;z-index:-1}
.vh-layer{position:absolute;inset:-4%;width:108%;height:108%;transition:transform .25s ease-out;will-change:transform}
.vh-l0{transform:translate3d(calc(var(--mx,0)*-4px),calc(var(--my,0)*-3px),0)}
.vh-l1{transform:translate3d(calc(var(--mx,0)*-12px),calc(var(--my,0)*-6px),0)}
.vh-l2{transform:translate3d(calc(var(--mx,0)*-26px),calc(var(--my,0)*-10px),0)}
.vh-l3{transform:translate3d(calc(var(--mx,0)*-44px),calc(var(--my,0)*-16px),0)}
.vh-photo{position:absolute;inset:-3%;background:url(/images/hero-bg.jpg) center bottom/cover no-repeat;transition:transform .25s ease-out;transform:translate3d(calc(var(--mx,0)*-16px),calc(var(--my,0)*-7px),0)}
.vh-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(24,10,4,.55) 0%,rgba(24,10,4,0) 38%,rgba(24,10,4,.45) 100%)}
.vh-inner{position:relative;z-index:1;max-width:1160px;margin:0 auto;padding:150px 28px 40px}
.vh h1{font-family:'Archivo Black',sans-serif;font-size:clamp(40px,7.2vw,96px);line-height:1.02;letter-spacing:-0.03em;max-width:11em;margin:0 0 22px;text-shadow:0 6px 40px rgba(0,0,0,.35)}
.vh-sub{font-size:clamp(16px,1.7vw,20px);color:rgba(255,255,255,.86);max-width:32em;line-height:1.6;margin:0 0 32px}
.vh-ctas{display:flex;gap:12px;flex-wrap:wrap}
.vh-btn{font:inherit;font-weight:700;font-size:15px;padding:15px 28px;border-radius:999px;cursor:pointer;text-decoration:none;display:inline-block}
.vh-btn-solid{background:#fff;color:#1B0E09;border:none}
.vh-btn-glass{background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.35);backdrop-filter:blur(10px)}
.vh-stage{position:absolute;left:0;right:0;bottom:36px;z-index:1;overflow:hidden;padding:8px 0}
.vh-row{display:flex;gap:16px;width:max-content;animation:vh-slide 80s linear infinite}
.vh-stage:hover .vh-row{animation-play-state:paused}
@keyframes vh-slide{to{transform:translateX(-50%)}}
.vh-card{flex:0 0 auto;width:250px;height:152px;padding:16px 20px;border-radius:22px;display:flex;flex-direction:column;gap:2px;
  background:linear-gradient(160deg,rgba(255,255,255,.26),rgba(255,255,255,.07));border:1px solid rgba(255,255,255,.3);backdrop-filter:blur(12px);
  box-shadow:0 26px 50px rgba(0,0,0,.35)}
.vh-card small{font-size:14px;color:rgba(255,255,255,.75)}
.vh-card strong{font-family:'Archivo Black',sans-serif;font-size:24px;line-height:1.15;letter-spacing:-0.02em;margin-top:4px}
.vh-card span{font-size:14px;color:rgba(255,255,255,.85)}
.vh-card em{margin-top:auto;align-self:flex-start;font-style:normal;font-weight:700;font-size:13px;color:#2A1208;background:#FFD2B5;padding:4px 14px;border-radius:999px}
@media(max-width:700px){
  .vh-inner{padding-top:120px}
  .vh-stage{bottom:20px}
  .vh-card{width:204px;height:130px;padding:12px 16px}
  .vh-card strong{font-size:19px}
}
@media(prefers-reduced-motion:reduce){
  .vh-row{animation:none}
  .vh-layer{transition:none}
}
`;

export default function HeroScene({ onSignUp }) {
  const { lang } = useTranslation();
  const c = COPY[lang] || COPY.fr;
  const ref = useRef(null);

  // Parallaxe : on met à jour deux variables CSS, sans re-rendu React.
  const onMove = (e) => {
    if (!ref.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mx", (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
    ref.current.style.setProperty("--my", (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3));
  };

  const loop = (cards) =>
    [0, 1, 2, 3, 4, 5].flatMap((r) =>
      cards.map((card) => (
        <div className="vh-card" key={`${r}-${card.k}`}>
          <small>{card.k}</small>
          <strong>{card.a}</strong>
          <span>{card.b}</span>
          <em>{card.s}</em>
        </div>
      ))
    );

  return (
    <section className="vh" ref={ref} onMouseMove={onMove}>
      <style>{CSS}</style>

      <div className="vh-bg" aria-hidden="true">
        {/* Ciel et soleil */}
        <svg className="vh-layer vh-l0" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="vhSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2A0F08" />
              <stop offset=".38" stopColor="#8A3412" />
              <stop offset=".66" stopColor="#E8500A" />
              <stop offset=".86" stopColor="#FFB45E" />
              <stop offset="1" stopColor="#FFD9A0" />
            </linearGradient>
            <radialGradient id="vhSun" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#FFF3D6" stopOpacity=".95" />
              <stop offset=".35" stopColor="#FFC27A" stopOpacity=".55" />
              <stop offset="1" stopColor="#FF7A2A" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1600" height="900" fill="url(#vhSky)" />
          <circle cx="800" cy="560" r="360" fill="url(#vhSun)" />
          <g fill="#fff" opacity=".7">
            <circle cx="180" cy="120" r="2" /><circle cx="420" cy="70" r="1.6" /><circle cx="1180" cy="100" r="2" />
            <circle cx="1420" cy="170" r="1.6" /><circle cx="960" cy="60" r="1.4" /><circle cx="640" cy="150" r="1.4" />
          </g>
          <g fill="#FFE2C2" opacity=".28">
            <ellipse cx="300" cy="420" rx="220" ry="26" /><ellipse cx="1280" cy="380" rx="260" ry="30" />
            <ellipse cx="860" cy="330" rx="180" ry="20" />
          </g>
        </svg>
        {/* Trois lignes de crêtes, de la plus lointaine à la plus proche */}
        <svg className="vh-layer vh-l1" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          <path d="M0,560 C200,500 320,540 480,480 C640,420 760,500 900,470 C1060,430 1200,520 1340,480 C1460,450 1540,500 1600,490 L1600,900 L0,900 Z" fill="#7A3418" opacity=".92" />
        </svg>
        <svg className="vh-layer vh-l2" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          <path d="M0,650 C180,590 300,640 520,600 C700,560 820,660 1000,620 C1180,580 1360,650 1600,610 L1600,900 L0,900 Z" fill="#4A1D0E" />
        </svg>
        <svg className="vh-layer vh-l3" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          <path d="M0,770 C220,710 380,790 620,740 C820,700 960,790 1180,750 C1360,720 1500,780 1600,750 L1600,900 L0,900 Z" fill="#1B0E09" />
        </svg>
        {/* Photo de fond : si /images/hero-bg.jpg existe elle recouvre le décor dessiné */}
        <div className="vh-photo" />
        <div className="vh-shade" />
      </div>

      <div className="vh-inner">
        <h1>{c.title}</h1>
        <p className="vh-sub">{c.sub}</p>
        <div className="vh-ctas">
          <button type="button" className="vh-btn vh-btn-solid" onClick={onSignUp}>{c.cta}</button>
          <a className="vh-btn vh-btn-glass" href="#features">{c.more}</a>
        </div>

      </div>

      {/* Bande de cartes pleine largeur : défile d'un bord à l'autre de l'écran */}
      <div className="vh-stage" aria-hidden="true">
        <div className="vh-row">{loop(c.cards)}</div>
      </div>
    </section>
  );
}