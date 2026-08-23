import { useState } from "react";
import { T } from "../styles/tokens";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n/index.js";

const S = {
  wrap: {
    maxWidth: 1160,
    margin: "0 auto",
    padding: "0 28px",
  },
  brandLogo: {
    fontFamily: "'Archivo Black', sans-serif",
    fontSize: 18,
    letterSpacing: -0.5,
    color: T.text,
    textDecoration: "none",
  },
};

function LangSwitch({ lang, setLanguage, languages = [] }) {
  return (
    <div
      role="group"
      aria-label="Language selector"
      style={{
        display: "flex",
        gap: 2,
        background: T.surface2 || T.border,
        borderRadius: T.r?.full || 999,
        padding: 2,
      }}
    >
      {languages.map((l) => {
        const isActive = lang === l.code;

        return (
          <button
            key={l.code}
            type="button"
            onClick={() => setLanguage?.(l.code)}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "5px 10px",
              borderRadius: T.r?.full || 999,
              fontSize: 12,
              fontWeight: 700,
              background: isActive ? T.surface : "transparent",
              color: isActive ? T.text : T.hint,
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { to: "/pricing", label: t("home.nav.pricing") },
    { to: "/about", label: t("home.nav.about") },
    { to: "/faq", label: t("home.nav.faq") },
    { to: "/contact", label: t("home.nav.contact") },
  ];

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <style>{`
        @media (max-width: 860px) {
          .vimen-public-nav-links { display: none !important; }
          .vimen-public-nav-right { display: none !important; }
          .vimen-public-hamburger { display: flex !important; }
        }
        @media (min-width: 861px) {
          .vimen-public-mobile-panel { display: none !important; }
        }
      `}</style>

      <div
        style={{
          ...S.wrap,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <Link to="/" style={S.brandLogo}>
            Vimen
          </Link>

          <div className="vimen-public-nav-links" style={{ display: "flex", gap: 24 }}>
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                style={{
                  fontSize: 14,
                  color: T.muted,
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="vimen-public-nav-right" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <LangSwitch
            lang={lang}
            setLanguage={setLanguage}
            languages={languages}
          />

          <button
            type="button"
            onClick={onSignIn}
            style={{
              background: "none",
              border: "none",
              color: T.muted,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              padding: "8px 4px",
            }}
          >
            {t("home.nav.signIn")}
          </button>

          <button
            type="button"
            onClick={onSignUp}
            style={{
              background: T.brand,
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: T.r?.md || 6,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t("home.nav.startFree")}
          </button>
        </div>

        {/* Bouton hamburger, visible seulement sous 860px (voir media query) */}
        <button
          type="button"
          className="vimen-public-hamburger"
          onClick={() => setMobileOpen((o) => !o)}
          style={{
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            border: `1px solid ${T.border}`,
            borderRadius: T.r?.md || 6,
            background: "none",
            color: T.text,
            cursor: "pointer",
            fontSize: 18,
          }}
          aria-label="Menu"
        >
          {mobileOpen ? "×" : "☰"}
        </button>
      </div>

      {/* Panneau mobile déroulant : liens, langue, connexion */}
      <div
        className="vimen-public-mobile-panel"
        style={{
          display: mobileOpen ? "flex" : "none",
          flexDirection: "column",
          gap: 4,
          padding: "8px 20px 20px",
          borderTop: `1px solid ${T.border}`,
          background: T.surface,
        }}
      >
        {navLinks.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            onClick={() => setMobileOpen(false)}
            style={{
              fontSize: 15,
              color: T.text,
              textDecoration: "none",
              fontWeight: 600,
              padding: "10px 0",
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            {l.label}
          </Link>
        ))}

        <div style={{ display: "flex", justifyContent: "center", margin: "14px 0" }}>
          <LangSwitch lang={lang} setLanguage={setLanguage} languages={languages} />
        </div>

        <button
          type="button"
          onClick={() => { setMobileOpen(false); onSignIn(); }}
          style={{
            width: "100%",
            padding: "12px",
            border: `1px solid ${T.border}`,
            borderRadius: T.r?.md || 6,
            background: "none",
            color: T.text,
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            marginBottom: 8,
          }}
        >
          {t("home.nav.signIn")}
        </button>

        <button
          type="button"
          onClick={() => { setMobileOpen(false); onSignUp(); }}
          style={{
            width: "100%",
            padding: "12px",
            border: "none",
            borderRadius: T.r?.md || 6,
            background: T.brand,
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {t("home.nav.startFree")}
        </button>
      </div>
    </nav>
  );
}

function Footer({ t }) {
  return (
    <footer
      style={{
        borderTop: `1px solid ${T.border}`,
        padding: "40px 0",
      }}
    >
      <div
        style={{
          ...S.wrap,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        <Link to="/" style={{ ...S.brandLogo, fontSize: 15 }}>
          Vimen
        </Link>

        <div
          style={{
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/pricing"
            style={{
              fontSize: 13,
              color: T.hint,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("home.nav.pricing")}
          </Link>

          <Link
            to="/about"
            style={{
              fontSize: 13,
              color: T.hint,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("home.nav.about")}
          </Link>

          <Link
            to="/faq"
            style={{
              fontSize: 13,
              color: T.hint,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("home.nav.faq")}
          </Link>

          <Link
            to="/contact"
            style={{
              fontSize: 13,
              color: T.hint,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("home.nav.contact")}
          </Link>

          <Link
            to="/privacy"
            style={{
              fontSize: 13,
              color: T.hint,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("home.nav.privacy") || "Privacy"}
          </Link>

          <Link
            to="/terms"
            style={{
              fontSize: 13,
              color: T.hint,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("home.nav.terms") || "Terms"}
          </Link>

          <Link
            to="/mentions-legales"
            style={{
              fontSize: 13,
              color: T.hint,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("home.nav.legal") || "Mentions Légales"}
          </Link>
        </div>

        <p style={{ color: T.hint, fontSize: 13, margin: 0 }}>
          {t("home.footer.copyright")}
        </p>
      </div>
    </footer>
  );
}

export default function PublicLayout({
  children,
  onSignIn,
  onSignUp,
}) {
  const { t, lang, setLanguage, languages } = useTranslation();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.surface,
        color: T.text,
        fontFamily: "'Inter', sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <NavBar
        onSignIn={onSignIn}
        onSignUp={onSignUp}
        t={t}
        lang={lang}
        setLanguage={setLanguage}
        languages={languages}
      />

      {children}

      <Footer t={t} />
    </div>
  );
}