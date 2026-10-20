// src/components/TradesMosaic.jsx
//
// Mosaïque de 4 photos de métiers (accueil). Les images sont lues dans /images/ ;
// tant qu'un fichier n'existe pas, la tuile affiche un dégradé chaud (rien ne casse).

import { useTranslation } from "../i18n/index.js";

const COPY = {
  en: {
    title: "Made for people who sell their time and work with their hands.",
    // Pour ajouter un métier : mets sa photo dans public/images/ et ajoute une ligne [nom, nom-du-fichier-sans-.jpg]
    tiles: [["Electricians", "trade-electrician"], ["Hairdressers", "trade-hair"]],
  },
  fr: {
    title: "Conçu pour celles et ceux qui vendent leur temps et travaillent de leurs mains.",
    tiles: [["Électriciens", "trade-electrician"], ["Coiffeurs et coiffeuses", "trade-hair"]],
  },
};

const CSS = `
.tm{padding:96px 0}
.tm-wrap{max-width:1160px;margin:0 auto;padding:0 28px}
.tm h2{font-family:'Archivo Black',sans-serif;font-size:clamp(26px,3.8vw,44px);line-height:1.08;letter-spacing:-0.03em;max-width:16em;margin:0 0 40px;color:#FBF1E6}
.tm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
.tm-tile{position:relative;border-radius:28px;overflow:hidden;aspect-ratio:16/10;display:flex;align-items:flex-end;
  background-size:cover;background-position:center;border:1px solid rgba(255,255,255,.1)}
.tm-tile span{margin:16px;padding:8px 18px;border-radius:999px;font-weight:600;font-size:15px;color:#fff;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
`;

export default function TradesMosaic() {
  const { lang } = useTranslation();
  const c = COPY[lang] || COPY.fr;

  return (
    <section className="tm">
      <style>{CSS}</style>
      <div className="tm-wrap">
        <h2>{c.title}</h2>
        <div className="tm-grid">
          {c.tiles.map(([label, file]) => (
            <div
              key={file}
              className="tm-tile"
              role="img"
              aria-label={label}
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(27,14,9,0) 45%, rgba(27,14,9,.8) 100%), url(/images/${file}.jpg), linear-gradient(150deg, #8A3412, #2A0F08)`,
              }}
            >
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}