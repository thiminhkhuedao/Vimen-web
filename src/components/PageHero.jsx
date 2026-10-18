// src/components/PageHero.jsx
//
// Deux blocs partagés par les pages publiques (À propos, FAQ, Contact, pages légales,
// bas de la page d'accueil) pour reprendre le style du hero de la page d'accueil :
//   <PageHero title sub />  — bandeau arrondi, coucher de soleil, titre centré
//   <CtaBand title sub cta onClick | href />  — bandeau d'appel à l'action en fin de page
// À utiliser avec <PublicLayout hero> (le bandeau gère lui-même la place sous la barre flottante).

import { Link } from "react-router-dom";

const CSS = `
.ph{position:relative;margin:0;border-radius:0;overflow:hidden;color:#fff;isolation:isolate;
  background:radial-gradient(ellipse 120% 90% at 50% 112%,#FFD9A0 0%,#FFB45E 14%,#E8500A 38%,#6B2A52 68%,#140A2A 100%)}
.ph::after{content:"";position:absolute;inset:0;z-index:-1;background:url(/images/hero-bg.jpg) center bottom/cover no-repeat}
.ph svg{position:absolute;left:0;bottom:0;width:100%;height:46%;z-index:-1}
.ph-inner{max-width:860px;margin:0 auto;padding:150px 28px 96px;text-align:center}
.ph h1{font-family:'Archivo Black',sans-serif;font-size:clamp(34px,6vw,72px);line-height:1.04;letter-spacing:-0.03em;margin:0 0 18px;text-shadow:0 6px 36px rgba(0,0,0,.3)}
.ph p{font-size:clamp(15px,1.6vw,19px);color:rgba(255,255,255,.88);max-width:34em;line-height:1.6;margin:0 auto}
.cb{margin:0;border-radius:0;padding:96px 28px;text-align:center;color:#fff;
  background:radial-gradient(ellipse 120% 120% at 50% 130%,#FFB45E 0%,#E8500A 32%,#6B2A52 66%,#140A2A 100%)}
.cb h2{font-family:'Archivo Black',sans-serif;font-size:clamp(28px,4.4vw,52px);line-height:1.05;letter-spacing:-0.03em;margin:0 auto 16px;max-width:15em}
.cb p{color:rgba(255,255,255,.86);max-width:30em;margin:0 auto 30px;line-height:1.6}
.cb-btn{display:inline-block;font:inherit;font-weight:700;font-size:15px;padding:15px 32px;border-radius:999px;border:none;cursor:pointer;background:#fff;color:#1A0E22;text-decoration:none}
`;

export default function PageHero({ title, sub }) {
  return (
    <header className="ph">
      <style>{CSS}</style>
      <svg viewBox="0 0 1600 300" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,150 C200,90 340,140 520,100 C700,60 840,150 1020,110 C1200,70 1380,140 1600,100 L1600,300 L0,300 Z" fill="#46183F" />
        <path d="M0,230 C240,180 400,250 640,205 C860,165 1000,250 1220,215 C1380,190 1500,235 1600,215 L1600,300 L0,300 Z" fill="#1A0E22" />
      </svg>
      <div className="ph-inner">
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
    </header>
  );
}

export function CtaBand({ title, sub, cta, onClick, href }) {
  return (
    <section className="cb">
      <style>{CSS}</style>
      <h2>{title}</h2>
      {sub ? <p>{sub}</p> : null}
      {href ? (
        <Link to={href} className="cb-btn">{cta}</Link>
      ) : (
        <button type="button" className="cb-btn" onClick={onClick}>{cta}</button>
      )}
    </section>
  );
}