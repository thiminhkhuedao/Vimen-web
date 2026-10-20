import { useState } from "react";
import { T } from "../styles/publicTokens.js";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "../i18n/index.js";
import { SOCIALS, CONTACT_EMAIL } from "../lib/links.js";

const WRAP = { maxWidth: 1160, margin: "0 auto", padding: "0 28px" };

function Logo({ size = 28, color = "#fff" }) {
  return (
    <Link to="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", color }}>
      <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
        <rect width="512" height="512" rx="113" fill="#E8500A" />
        <polygon points="283,94 319,96 274,214 354,214 217,416 235,282 157,282" fill="#fff" />
      </svg>
      <span style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 17, letterSpacing: -0.5 }}>Vimen</span>
    </Link>
  );
}

function LangSwitch({ lang, setLanguage, languages = [] }) {
  return (
    <div role="group" aria-label="Language selector" style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.12)", borderRadius: 999, padding: 2 }}>
      {languages.map((l) => {
        const active = lang === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => setLanguage?.(l.code)}
            style={{
              border: "none", cursor: "pointer", padding: "5px 10px", borderRadius: 999,
              fontSize: 12, fontWeight: 700, fontFamily: "inherit",
              background: active ? "#fff" : "transparent",
              color: active ? "#2A1208" : "rgba(255,255,255,0.75)",
            }}
          >
            {l.code?.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

function NavBar({ onSignIn, onSignUp, t, lang, setLanguage, languages }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const links = [
    { to: "/about", label: t("home.nav.about") },
    { to: "/faq", label: t("home.nav.faq") },
    { to: "/contact", label: t("home.nav.contact") },
  ];

  return (
    <nav
      style={{
        position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 50,
        width: "min(1100px, calc(100% - 24px))",
        background: "rgba(30, 14, 8, 0.55)",
        backdropFilter: "blur(16px) saturate(140%)", WebkitBackdropFilter: "blur(16px) saturate(140%)",
        border: "1px solid rgba(255,255,255,0.16)", borderRadius: open ? 28 : 999,
        boxShadow: "0 12px 40px rgba(0,0,0,0.25)", color: "#fff",
      }}
    >
      <style>{`
        .pl-link{font-size:14px;font-weight:500;color:rgba(255,255,255,.72);text-decoration:none;padding:8px 14px;border-radius:999px;transition:background .15s,color .15s}
        .pl-link:hover{color:#fff;background:rgba(255,255,255,.1)}
        .pl-link.on{color:#fff;background:rgba(255,255,255,.16)}
        @media (max-width: 860px){.pl-desktop{display:none !important}.pl-burger{display:flex !important}}
        @media (min-width: 861px){.pl-panel{display:none !important}}
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 58, padding: "0 10px 0 20px" }}>
        <Logo />

        <div className="pl-desktop" style={{ display: "flex", gap: 4 }}>
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={`pl-link${pathname === l.to ? " on" : ""}`}>{l.label}</Link>
          ))}
        </div>

        <div className="pl-desktop" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <LangSwitch lang={lang} setLanguage={setLanguage} languages={languages} />
          <button type="button" onClick={onSignIn} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "8px 8px", fontFamily: "inherit" }}>
            {t("home.nav.signIn")}
          </button>
          <button type="button" onClick={onSignUp} style={{ background: T.brand, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t("home.nav.startFree")}
          </button>
        </div>

        <button
          type="button"
          className="pl-burger"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={open}
          style={{ display: "none", alignItems: "center", justifyContent: "center", width: 40, height: 40, border: "none", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer", fontSize: 18 }}
        >
          {open ? "×" : "☰"}
        </button>
      </div>

      <div className="pl-panel" style={{ display: open ? "flex" : "none", flexDirection: "column", gap: 4, padding: "4px 20px 20px" }}>
        {links.map((l) => (
          <Link key={l.to} to={l.to} onClick={() => setOpen(false)} style={{ fontSize: 16, color: "#fff", textDecoration: "none", fontWeight: 600, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.14)" }}>
            {l.label}
          </Link>
        ))}
        <div style={{ display: "flex", justifyContent: "center", margin: "14px 0" }}>
          <LangSwitch lang={lang} setLanguage={setLanguage} languages={languages} />
        </div>
        <button type="button" onClick={() => { setOpen(false); onSignIn(); }} style={{ padding: 12, border: "1px solid rgba(255,255,255,0.3)", borderRadius: 999, background: "none", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", marginBottom: 8, fontFamily: "inherit" }}>
          {t("home.nav.signIn")}
        </button>
        <button type="button" onClick={() => { setOpen(false); onSignUp(); }} style={{ padding: 12, border: "none", borderRadius: 999, background: T.brand, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          {t("home.nav.startFree")}
        </button>
      </div>
    </nav>
  );
}

const ICONS = {
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".7" fill="currentColor" /></>,
  tiktok: <><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 3c.3 2.6 2 4.4 5 4.6" /></>,
  x: <path d="M4 4l16 16M20 4L4 20" />,
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  linkedin: <><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></>,
};

const FOOTER_COPY = {
  en: { tagline: "Bookings, quotes and invoices for service professionals.", pages: "Pages", contactTitle: "Contact us", contactText: "A question or some feedback? Write to us.", contactBtn: "Contact us", follow: "Follow us" },
  fr: { tagline: "Réservations, devis et factures pour les professionnels de services.", pages: "Pages", contactTitle: "Nous contacter", contactText: "Une question ou un retour ? Écris-nous.", contactBtn: "Nous contacter", follow: "Suivez-nous" },
};

function Footer({ t, lang }) {
  const c = FOOTER_COPY[lang] || FOOTER_COPY.fr;
  const links = [
    ["/about", t("home.nav.about")],
    ["/faq", t("home.nav.faq")],
    ["/contact", t("home.nav.contact")],
    ["/privacy", t("home.nav.privacy") || "Privacy"],
    ["/terms", t("home.nav.terms") || "Terms"],
    ["/mentions-legales", t("home.nav.legal") || "Mentions Légales"],
  ];
  const heading = { fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 14px" };

  return (
    <footer style={{ background: "#140A06", color: "#fff", padding: "64px 0 32px" }}>
      <style>{`
        .pl-soc{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;color:#fff;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);transition:background .15s,border-color .15s}
        .pl-soc:hover{background:#E8500A;border-color:#E8500A}
        .pl-flink{font-size:14px;color:rgba(255,255,255,.7);text-decoration:none}
        .pl-flink:hover{color:#fff;text-decoration:underline}
      `}</style>
      <div style={{ ...WRAP, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 40 }}>
        <div>
          <Logo size={32} />
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, margin: "16px 0 20px", maxWidth: 280 }}>{c.tagline}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }} aria-label={c.follow}>
            {SOCIALS.map((s) => (
              <a key={s.id} className="pl-soc" href={s.href || "#"} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[s.id]}</svg>
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 style={heading}>{c.pages}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {links.map(([to, label]) => (
              <Link key={to} to={to} className="pl-flink">{label}</Link>
            ))}
          </div>
        </div>

        <div>
          <h3 style={heading}>{c.contactTitle}</h3>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, margin: "0 0 14px" }}>{c.contactText}</p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="pl-flink" style={{ display: "block", marginBottom: 16 }}>{CONTACT_EMAIL}</a>
          <Link to="/contact" style={{ display: "inline-block", background: "#E8500A", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 14, padding: "12px 24px", borderRadius: 999 }}>
            {c.contactBtn}
          </Link>
        </div>
      </div>

      <div style={{ ...WRAP, marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: 0 }}>{t("home.footer.copyright")}</p>
      </div>
    </footer>
  );
}

// `hero` : passe-le à true sur une page qui commence par un grand hero plein écran
// (HomePage). Sinon on laisse de la place sous la barre flottante.
export default function PublicLayout({ children, onSignIn, onSignUp, hero = false }) {
  const { t, lang, setLanguage, languages } = useTranslation();

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Inter', sans-serif", WebkitFontSmoothing: "antialiased" }}>
      <NavBar onSignIn={onSignIn} onSignUp={onSignUp} t={t} lang={lang} setLanguage={setLanguage} languages={languages} />
      <div style={{ paddingTop: hero ? 0 : 56 }}>{children}</div>
      <Footer t={t} lang={lang} />
    </div>
  );
}