import { useState } from "react";
import { T } from "../styles/tokens.js";
import { useTranslation } from "../i18n/index.js";
import { supabase } from "../lib/supabase.js";
import PublicLayout from "../components/PublicLayout.jsx";
import Honeypot, { isBotSubmission } from "../components/Honeypot.jsx";
import Turnstile from "../components/Turnstile.jsx";
import { checkRateLimit } from "../lib/security.js";

const S = {
  wrap: {
    maxWidth: 1160,
    margin: "0 auto",
    padding: "0 28px",
  },
};

const INPUT_STYLE = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: T.r?.md || 8,
  border: `1px solid ${T.border}`,
  fontSize: 14,
  background: T.surface,
  color: T.text,
  boxSizing: "border-box",
  fontFamily: "inherit",
};


export default function ContactPage({ onSignIn, onSignUp }) {
  const { t, lang, setLanguage, languages } = useTranslation();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [captchaToken, setCaptchaToken] = useState(null);

  const fld = k => e => {
    setForm(p => ({ ...p, [k]: e.target.value }));
    // On efface le message d'erreur dès que l'utilisateur recommence à
    // taper, pour ne pas laisser un vieux message bloqué à l'écran alors
    // que le formulaire est en fait correctement rempli.
    setStatus(s => (s === "invalid" || s === "error" ? "idle" : s));
  };

  async function submit(e) {
    e.preventDefault();

    // Bot détecté via le honeypot : rejet silencieux, pas d'appel réseau.
    if (isBotSubmission(honeypot)) return;

    // Basic validation
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setStatus("invalid");
      return;
    }

    if (!captchaToken) {
      setStatus("captcha_missing");
      return;
    }

    setStatus("sending");

    const rateLimitMsg = await checkRateLimit("contact_form", {
      identifier: form.email.trim(),
      turnstileToken: captchaToken,
      honeypot,
    });
    if (rateLimitMsg) {
      setErrorMsg(rateLimitMsg);
      setStatus("error");
      return;
    }

    try {
      const { error } = await supabase.functions.invoke("send-contact-email", { body: form });
      if (error) {
        throw error;
      }
      setStatus("sent");
    } catch (err) {
      console.error("[Contact submit error]", err);
      setErrorMsg("");
      setStatus("error");
    }
  }

    return (
  <PublicLayout
    onSignIn={onSignIn}
    onSignUp={onSignUp}
  >

      <header style={{ padding: "80px 0 40px", textAlign: "center" }}>
        <div style={S.wrap}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: T.hint,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            {t("contactPage.eyebrow")}
          </div>
          <h1
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: "clamp(32px, 5vw, 52px)",
              letterSpacing: -1.5,
              marginBottom: 20,
              marginTop: 0,
            }}
          >
            {t("contactPage.title")}
          </h1>
          <p style={{ fontSize: 17, color: T.muted, maxWidth: 480, margin: "0 auto", lineHeight: 1.65 }}>
            {t("contactPage.sub")}
          </p>
        </div>
      </header>

      <section style={{ padding: "20px 0 100px" }}>
        <div style={{ ...S.wrap, maxWidth: 520 }}>
          {status === "sent" ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                background: T.surface2 || T.surface,
                borderRadius: T.r?.lg || 16,
                padding: 40,
                textAlign: "center",
                border: `1px solid ${T.border}`,
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, marginTop: 0 }}>
                {t("contactPage.sentTitle")}
              </h2>
              <p style={{ fontSize: 14, color: T.muted, margin: 0 }}>{t("contactPage.sentSub")}</p>
            </div>
          ) : (
            <form
              onSubmit={submit}
              noValidate
              style={{
                background: T.surface2 || T.surface,
                borderRadius: T.r?.lg || 16,
                padding: 32,
                border: `1px solid ${T.border}`,
              }}
            >
              <div style={{ marginBottom: 18 }}>
                <label
                  htmlFor="contact-name"
                  style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: T.muted }}
                >
                  {t("contactPage.nameLabel")}
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  style={INPUT_STYLE}
                  value={form.name}
                  onChange={fld("name")}
                  placeholder={t("contactPage.namePlaceholder")}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label
                  htmlFor="contact-email"
                  style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: T.muted }}
                >
                  {t("contactPage.emailLabel")}
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  style={INPUT_STYLE}
                  value={form.email}
                  onChange={fld("email")}
                  placeholder={t("contactPage.emailPlaceholder")}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label
                  htmlFor="contact-message"
                  style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: T.muted }}
                >
                  {t("contactPage.messageLabel")}
                </label>
                <textarea
                  id="contact-message"
                  required
                  style={{ ...INPUT_STYLE, height: 120, resize: "vertical" }}
                  value={form.message}
                  onChange={fld("message")}
                  placeholder={t("contactPage.messagePlaceholder")}
                />
              </div>

              <Honeypot value={honeypot} onChange={setHoneypot} />

              <div style={{ marginBottom: 18 }}>
                <Turnstile onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
              </div>

              {status === "invalid" && (
                <p
                  id="contact-error"
                  role="alert"
                  style={{ fontSize: 13, color: T.red || "#dc2626", marginBottom: 16, marginTop: 0 }}
                >
                  {t("contactPage.invalid", "Please fill in all fields.")}
                </p>
              )}

              {status === "captcha_missing" && (
                <p
                  id="contact-error"
                  role="alert"
                  style={{ fontSize: 13, color: T.red || "#dc2626", marginBottom: 16, marginTop: 0 }}
                >
                  {t("contactPage.captchaMissing", "Please complete the verification challenge.")}
                </p>
              )}

              {status === "error" && (
                <p
                  id="contact-error"
                  role="alert"
                  style={{ fontSize: 13, color: T.red || "#dc2626", marginBottom: 16, marginTop: 0 }}
                >
                  {t("contactPage.error", "Something went wrong sending your message. Please try again or email us directly.")}
                  {errorMsg ? ` (${errorMsg})` : ""}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "sending" || !captchaToken}
                style={{
                  width: "100%",
                  padding: "13px 0",
                  borderRadius: T.r?.md || 8,
                  border: "none",
                  background: T.brand,
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: (status === "sending" || !captchaToken) ? "not-allowed" : "pointer",
                  opacity: (status === "sending" || !captchaToken) ? 0.6 : 1,
                  transition: "opacity 0.15s ease",
                }}
              >
                {status === "sending" ? t("contactPage.sending") : t("contactPage.send")}
              </button>
            </form>
          )}

          <p style={{ fontSize: 13, color: T.hint, textAlign: "center", marginTop: 24, marginBottom: 0 }}>
            {t("contactPage.emailAlternative")}{" "}
            <a href="mailto:contact.vimen@gmail.com" style={{ color: T.text, textDecoration: "underline" }}>
              contact.vimen@gmail.com
            </a>
          </p>
        </div>
      </section>

        </PublicLayout>
);
}