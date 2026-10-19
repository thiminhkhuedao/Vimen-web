import { useState } from "react";
import { T } from "../styles/publicTokens.js";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "../i18n/index.js";

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

function Footer({ t }) {
  const links = [
    ["/about", t("home.nav.about")],
    ["/faq", t("home.nav.faq")],
    ["/contact", t("home.nav.contact")],
    ["/privacy", t("home.nav.privacy") || "Privacy"],
    ["/terms", t("home.nav.terms") || "Terms"],
    ["/mentions-legales", t("home.nav.legal") || "Mentions Légales"],
  ];

  return (
    <footer style={{ background: "#140A06", color: "#fff", padding: "48px 0" }}>
      <div style={{ ...WRAP, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 24 }}>
        <Logo size={30} />
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
          {links.map(([to, label]) => (
            <Link key={to} to={to} style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", fontWeight: 500, textDecoration: "none" }}>
              {label}
            </Link>
          ))}
        </div>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, margin: 0 }}>{t("home.footer.copyright")}</p>
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
      <Footer t={t} />
    </div>
  );
}