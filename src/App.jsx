// src/App.jsx — Complete app with ALL pages wired (Icons & Emojis Removed)
import { useState, useEffect, useReducer, useCallback } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { Toaster, toast as hotToast } from "react-hot-toast";
import Sidebar        from "./components/Sidebar";
import { ToastStack }   from "./components/UI";
import CookieConsent   from "./components/CookieConsent";
import Honeypot, { isBotSubmission } from "./components/Honeypot";
import Turnstile       from "./components/Turnstile";
import {  useSignIn,  useSignUp,  useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { setClerkTokenGetter, supabase } from "./lib/supabase";
import { useTranslation, setLanguagePersister } from "./i18n/index.js";

// Marketing / logged-out
import HomePage         from "./pages/HomePage";
// import PricingPage      from "./pages/PricingPage"; // désactivé temporairement — pas de Stripe/SIRET pour l'instant, tout est gratuit
import AboutPage        from "./pages/AboutPage.jsx";
import ContactPage      from "./pages/ContactPage.jsx";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage.jsx";
import TermsOfServicePage from "./pages/TermsOfServicePage.jsx";
import MentionsLegalesPage from "./pages/MentionsLegalesPage.jsx";
import FaqPage          from "./pages/FaqPage.jsx";

// Core pages
import DashboardPage    from "./pages/DashboardPage";
import JobsPage         from "./pages/JobsPage";
import ClientsPage      from "./pages/ClientsPage";
import InvoicesPage     from "./pages/InvoicesPage";
import BookingPage      from "./pages/BookingPage";
import SettingsPage     from "./pages/SettingsPage";
import MarketplacePage  from "./pages/MarketplacePage";

// Feature pages
import QuotesPage         from "./pages/QuotesPage";
import ReviewsPage        from "./pages/ReviewsPage";
import CertificationsPage from "./pages/CertificationsPage";
import ReferralsPage      from "./pages/ReferralsPage";
import PaymentsPage       from "./pages/PaymentsPage";

import { SEED, reducer, AppCtx } from "./lib/state.jsx";
import { useAppData } from "./hooks/useAppData.js";
import { T } from "./styles/tokens";
import "./styles/globals.css";

/* ── Toast hook ─────────────────────────────────────── */
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((text, type = "success") => {
    const id = Math.random().toString(36).slice(2);
    
    if (type === "error") {
      hotToast.error(text, { duration: 4000 });
    } else {
      hotToast.success(text, { duration: 4000 });
    }

    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(m => m.id !== id)), 4000);
  }, []);
  return { toasts, addToast };
}

/* ── Auth page ──────────────────────────────────────── */
// Labels et exemples traduits via auth.categories.<id>.label / .examples
// dans en.js / fr.js — ne jamais mettre de texte en dur ici.
const CATEGORIES = [
  { id:"trades",    vertical:"trades" },
  { id:"beauty",    vertical:"beauty" },
  { id:"food",      vertical:"other" },
  { id:"health",    vertical:"professional" },
  { id:"legal",     vertical:"professional" },
  { id:"education", vertical:"professional" },
  { id:"creative",  vertical:"other" },
  { id:"tech",      vertical:"professional" },
  { id:"events",    vertical:"other" },
  { id:"home",      vertical:"trades" },
];

function getPasswordStrength(password) {
  if (!password) return { score:0, label:"", color:"" };
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label:"Weak",   color:"#EF4444" };
  if (score <= 2) return { score, label:"Fair",   color:"#F59E0B" };
  if (score <= 3) return { score, label:"Good",   color:"#3B82F6" };
  return              { score, label:"Strong", color:"#10B981" };
}

// Rate limiting réel, côté serveur (voir supabase/functions/check-rate-limit).
// L'ancienne version en mémoire JS était remise à zéro à chaque refresh de
// page — un bot scripté n'a même pas besoin de la contourner, elle ne
// protège de rien. Celle-ci interroge la table rate_limit_events côté
// Supabase, qui persiste peu importe ce que fait le navigateur.
async function checkRateLimitServer(action, identifier) {
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-rate-limit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, identifier }),
    });
    const data = await res.json();
    if (!data.allowed) {
      if (data.reason === "rate_limited_identifier" || data.reason === "rate_limited_ip") {
        return "rate_limited";
      }
      return "generic";
    }
    return null;
  } catch {
    // Si l'appel réseau échoue, on laisse passer plutôt que de bloquer
    // tout le monde à cause d'un problème d'infra — le serveur reste de
    // toute façon protégé par Clerk côté auth.
    return null;
  }
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.03z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"/>
    </svg>
  );
}

function AuthPage({ initialMode = "login" }) {
  const [mode,     setMode]     = useState(initialMode);
  const [email,    setEmail]    = useState("");
  const [pass,     setPass]     = useState("");
  const [showPass, setShowPass] = useState(false);
  const [name,     setName]     = useState("");
  const [username, setUsername] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [loading,  setLoading]  = useState(false);
  const [step,     setStep]     = useState("form");
  const [code,     setCode]     = useState("");
  const [error,    setError]    = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPass,   setNewPass]   = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [captchaToken, setCaptchaToken] = useState(null);

  const { signIn, setActive: setActiveSignIn } = useSignIn();
  const { signUp, setActive: setActiveSignUp } = useSignUp();
  const { t, lang, setLanguage, languages } = useTranslation();

  const strength = getPasswordStrength(pass);
  const resetStrength = getPasswordStrength(newPass);
  const inp = { width:"100%", padding:"11px 14px", borderRadius:8, border:`1px solid ${T.borderMed}`, fontSize:15, background:T.surface, color:T.text, boxSizing:"border-box", fontFamily:"inherit", marginBottom:0 };

  async function handleGoogleAuth() {
    setError("");
    try {
      // signIn.authenticateWithRedirect gère aussi bien la connexion que
      // l'inscription — Clerk bascule automatiquement vers signUp si ce
      // compte Google n'existe pas encore.
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err) {
      setError(err?.errors?.[0]?.longMessage || err?.message || "Google sign-in failed");
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (mode === "signup" && isBotSubmission(honeypot)) {
      // Bot détecté via le honeypot : on rejette silencieusement, sans
      // donner d'indice — pas la peine de faire l'appel réseau au-delà.
      return;
    }
    const rateLimitReason = await checkRateLimitServer(mode === "signup" ? "signup" : "login", email.trim());
    if (rateLimitReason) {
      setError(rateLimitReason === "rate_limited"
        ? (t("auth.error.tooManyAttempts") || "Too many attempts. Please wait a few minutes before trying again.")
        : (t("auth.error.genericRetry") || "Something went wrong. Please try again."));
      return;
    }
    if (mode==="signup" && strength.score < 2) { setError(t("auth.error.weakPassword") || "Password is too weak — use at least 8 characters with a mix of letters and numbers."); return; }
    if (mode==="signup" && !agreedToTerms) { setError(t("auth.error.mustAgreeTerms") || "Please accept the Privacy Policy to continue."); return; }
    if (mode==="signup" && !captchaToken) { setError(t("auth.error.captchaMissing") || "Please complete the verification challenge."); return; }
    setLoading(true);
    try {
      if (mode === "signup") {
        const [firstName, ...rest] = name.trim().split(" ");
        await signUp.create({ emailAddress:email, password:pass, username, firstName:firstName||undefined, lastName:rest.join(" ")||undefined });
        await signUp.prepareEmailAddressVerification({ strategy:"email_code" });
        setStep("verify"); setLoading(false); return;
      } else {
        const result = await signIn.create({ identifier:email, password:pass });
        if (result.status === "complete") { await setActiveSignIn({ session:result.createdSessionId }); }
      }
    } catch (err) {
      const msg = err.errors?.[0]?.longMessage || err.message || "Something went wrong";
      setError(msg);
    }
    setLoading(false);
  }

  async function verifyCode(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") { await setActiveSignUp({ session:result.createdSessionId }); window.location.reload(); }
      else if (result.status === "missing_requirements") { setError(`Almost there — still missing: ${result.missingFields?.join(", ")||"some required fields"}.`); }
      else { setError(`Unexpected status: ${result.status}. Please try again.`); }
    } catch (err) { setError(err?.errors?.[0]?.longMessage || err?.message || "Invalid code"); }
    setLoading(false);
  }

  async function requestPasswordReset(e) {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError(t("auth.forgot.emailRequired") || "Enter your email first."); return; }
    setLoading(true);
    try {
      await signIn.create({ identifier: email.trim(), strategy: "reset_password_email_code" });
      setStep("forgot-verify");
    } catch (err) {
      setError(err?.errors?.[0]?.longMessage || err?.message || "Something went wrong");
    }
    setLoading(false);
  }

  async function submitPasswordReset(e) {
    e.preventDefault();
    setError("");
    if (resetStrength.score < 2) { setError(t("auth.error.weakPassword") || "Password is too weak — use at least 8 characters with a mix of letters and numbers."); return; }
    setLoading(true);
    try {
      // Étape 1 : vérifie le code seul → statut "needs_new_password"
      const firstFactor = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: resetCode,
      });
      if (firstFactor.status !== "needs_new_password") {
        setError(`Unexpected status: ${firstFactor.status}. Please try again.`);
        setLoading(false);
        return;
      }

      // Étape 2 : fixe le nouveau mot de passe — signOutOfOtherSessions
      // n'existe QUE sur resetPassword(), pas sur attemptFirstFactor().
      const result = await signIn.resetPassword({
        password: newPass,
        signOutOfOtherSessions: true,
      });
      if (result.status === "complete") {
        await setActiveSignIn({ session: result.createdSessionId });
        window.location.reload();
      } else {
        setError(`Unexpected status: ${result.status}. Please try again.`);
      }
    } catch (err) {
      setError(err?.errors?.[0]?.longMessage || err?.message || "Invalid or expired code");
    }
    setLoading(false);
  }

  if (step === "forgot") return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:420, maxWidth:"100%", background:T.surface, borderRadius:T.r.xl, padding:"52px 48px", boxShadow:T.shadow.xl }}>
        <h3 style={{ fontSize:22, fontWeight:800, marginBottom:8, letterSpacing:-0.5, textAlign:"center" }}>{t("auth.forgot.title") || "Reset your password"}</h3>
        <p style={{ fontSize:14, color:T.muted, marginBottom:28, textAlign:"center", lineHeight:1.6 }}>
          {t("auth.forgot.subtitle") || "Enter your email and we'll send you a reset code."}
        </p>
        <form onSubmit={requestPasswordReset} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoFocus/>
          {error && <div style={{ fontSize:13, color:"#EF4444", background:"#FEF2F2", padding:"10px 14px", borderRadius:8 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ padding:"14px", borderRadius:8, background:T.brand, color:"#fff", border:"none", fontWeight:700, fontSize:15, cursor:loading?"not-allowed":"pointer", opacity:loading?0.6:1 }}>
            {loading ? (t("auth.forgot.sending") || "Sending…") : (t("auth.forgot.submit") || "Send reset code")}
          </button>
          <button type="button" onClick={()=>{ setStep("form"); setError(""); }}
            style={{ background:"none", border:"none", color:T.muted, fontSize:13, cursor:"pointer", textDecoration:"underline" }}>
            {t("auth.verify.back") || "← Back to sign in"}
          </button>
        </form>
      </div>
    </div>
  );

  if (step === "forgot-verify") return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:420, maxWidth:"100%", background:T.surface, borderRadius:T.r.xl, padding:"52px 48px", boxShadow:T.shadow.xl }}>
        <h3 style={{ fontSize:22, fontWeight:800, marginBottom:8, letterSpacing:-0.5, textAlign:"center" }}>{t("auth.forgot.verifyTitle") || "Check your email"}</h3>
        <p style={{ fontSize:14, color:T.muted, marginBottom:28, textAlign:"center", lineHeight:1.6 }}>
          {t("auth.forgot.verifySubtitle") || "Enter the code we sent to"} <strong>{email}</strong> {t("auth.forgot.andNewPassword") || "and choose a new password."}
        </p>
        <form onSubmit={submitPasswordReset} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <input style={{ ...inp, fontSize:22, fontWeight:800, letterSpacing:6, textAlign:"center" }}
            value={resetCode} onChange={e=>setResetCode(e.target.value.replace(/\D/g,"").slice(0,6))}
            placeholder="000000" maxLength={6} autoFocus inputMode="numeric"/>

          <div>
            <input style={inp} type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder={t("auth.forgot.newPasswordPlaceholder") || "New password"}/>
            {newPass.length>0 && (
              <div style={{ marginTop:8 }}>
                <div style={{ display:"flex", gap:4, marginBottom:4 }}>
                  {[1,2,3,4].map(i=>(
                    <div key={i} style={{ flex:1, height:3, borderRadius:2, background:i<=resetStrength.score?resetStrength.color:T.border, transition:"background .2s" }}/>
                  ))}
                </div>
                <div style={{ fontSize:12, color:resetStrength.color, fontWeight:600 }}>{resetStrength.label}</div>
              </div>
            )}
          </div>

          {error && <div style={{ fontSize:13, color:"#EF4444", background:"#FEF2F2", padding:"10px 14px", borderRadius:8 }}>{error}</div>}
          <button type="submit" disabled={loading || resetCode.length!==6 || !newPass}
            style={{ padding:"14px", borderRadius:8, background:T.brand, color:"#fff", border:"none", fontWeight:700, fontSize:15, cursor:(loading||resetCode.length!==6||!newPass)?"not-allowed":"pointer", opacity:(loading||resetCode.length!==6||!newPass)?0.6:1 }}>
            {loading ? (t("auth.forgot.resetting") || "Resetting…") : (t("auth.forgot.submitNew") || "Set new password →")}
          </button>
          <button type="button" onClick={()=>{ setStep("form"); setError(""); setResetCode(""); setNewPass(""); }}
            style={{ background:"none", border:"none", color:T.muted, fontSize:13, cursor:"pointer", textDecoration:"underline" }}>
            {t("auth.verify.back") || "← Back to sign in"}
          </button>
        </form>
      </div>
    </div>
  );

  if (step === "verify") return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:20, position:"relative" }}>
      {/* Sélecteur de langue */}
      <div style={{ position:"absolute", top: 20, right: 28, zIndex: 100, display: "flex", gap: 2, background: T.border, borderRadius: 999, padding: 2 }}>
        {languages?.map((l) => {
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
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                background: isActive ? T.surface : "transparent",
                color: isActive ? T.text : T.muted,
              }}
            >
              {l.code?.toUpperCase()}
            </button>
          );
        })}
      </div>

      <div style={{ width:420, maxWidth:"100%", background:T.surface, borderRadius:T.r.xl, padding:"52px 48px", boxShadow:T.shadow.xl }}>
        <h3 style={{ fontSize:22, fontWeight:800, marginBottom:8, letterSpacing:-0.5, textAlign:"center" }}>{t("auth.verify.title") || "Check your email"}</h3>
        <p style={{ fontSize:14, color:T.muted, marginBottom:28, textAlign:"center", lineHeight:1.6 }}>
          {t("auth.verify.subtitle") || "We sent a 6-digit code to"} <strong>{email}</strong>.
        </p>
        <form onSubmit={verifyCode} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <input style={{ ...inp, fontSize:28, fontWeight:800, letterSpacing:8, textAlign:"center" }}
            value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}
            placeholder="000000" maxLength={6} autoFocus inputMode="numeric"/>
          {error && <div style={{ fontSize:13, color:"#EF4444", background:"#FEF2F2", padding:"10px 14px", borderRadius:8 }}>{error}</div>}
          <button type="submit" disabled={loading||code.length!==6}
            style={{ padding:"14px", borderRadius:8, background:T.brand, color:"#fff", border:"none", fontWeight:700, fontSize:15, cursor:loading||code.length!==6?"not-allowed":"pointer", opacity:loading||code.length!==6?0.6:1 }}>
            {loading ? (t("auth.verify.verifying") || "Verifying…") : (t("auth.verify.submit") || "Verify email →")}
          </button>
          <button type="button" onClick={()=>{ setStep("form"); setError(""); }}
            style={{ background:"none", border:"none", color:T.muted, fontSize:13, cursor:"pointer", textDecoration:"underline" }}>
            {t("auth.verify.back") || "← Back to sign up"}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:20, position:"relative" }}>
      {/* Sélecteur de langue */}
      <div style={{ position:"absolute", top: 20, right: 28, zIndex: 100, display: "flex", gap: 2, background: T.border, borderRadius: 999, padding: 2 }}>
        {languages?.map((l) => {
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
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                background: isActive ? T.surface : "transparent",
                color: isActive ? T.text : T.muted,
              }}
            >
              {l.code?.toUpperCase()}
            </button>
          );
        })}
      </div>

      <style>{`
        @media (max-width: 720px) {
          .vimen-auth-shell { flex-direction: column !important; width: 100% !important; }
          .vimen-auth-left  { display: none !important; }
          .vimen-auth-right { width: 100% !important; padding: 32px 24px !important; }
        }
      `}</style>
      <div className="vimen-auth-shell" style={{ display:"flex", width:900, maxWidth:"100%", borderRadius:T.r.xl, overflow:"hidden", boxShadow:T.shadow.xl }}>
        {/* Left brand panel */}
        <div className="vimen-auth-left" style={{ flex:1, background:"#0F0E0D", padding:"52px 48px", display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:22, fontWeight:900, color:T.brand, marginBottom:48, letterSpacing:-0.5 }}>Vimen</div>
            <h2 style={{ fontSize:34, fontWeight:900, color:"#fff", letterSpacing:-1.5, lineHeight:1.15, marginBottom:16 }}>
              {t("auth.brand.headlineLine1") || "Booking and"}<br/>{t("auth.brand.headlineLine2") || "billing for"}<br/><span style={{ color:T.brand }}>{t("auth.brand.headlineHighlight") || "every profession"}</span>
            </h2>
            <p style={{ fontSize:15, color:"rgba(255,255,255,0.5)", lineHeight:1.7 }}>
              {t("auth.brand.sub") || "Trades, beauty & wellness, or professional services — quotes, appointments, invoices and payments, all in one place."}
            </p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {[
              t("auth.brand.feature1") || "Clients book their own appointments",
              t("auth.brand.feature2") || "Invoice and get paid",
              t("auth.brand.feature3") || "Vimen Pay",
              t("auth.brand.feature4") || "Automatic review requests",
              t("auth.brand.feature5") || "Your data stays yours"
            ].map((text) => (
              <div key={text} style={{ display:"flex", alignItems:"center", gap:12, fontSize:14, color:"rgba(255,255,255,0.55)" }}>
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* Right form */}
        <div className="vimen-auth-right" style={{
          width: 440,
          background: T.surface,
          padding: "48px 44px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          overflowY: "auto",
          maxHeight: "100vh",
          boxSizing: "border-box",
        }}>
          <h3 style={{ fontSize:22, fontWeight:800, marginBottom:6, letterSpacing:-0.5 }}>
            {mode==="login" ? (t("auth.form.loginTitle") || "Welcome back") : (t("auth.form.signupTitle") || "Create account")}
          </h3>
          <p style={{ fontSize:14, color:T.muted, marginBottom:24 }}>
            {mode==="login" ? (t("auth.form.loginSub") || "Sign in to your Vimen account") : (t("auth.form.signupSub") || "Start for free — no card needed")}
          </p>

          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            style={{
              width:"100%", padding:"11px 14px", borderRadius:8,
              border:`1px solid ${T.borderMed}`, background:T.surface, color:T.text,
              fontSize:14, fontWeight:600, cursor:loading?"not-allowed":"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:10,
              fontFamily:"inherit", marginBottom:16, opacity:loading?0.6:1,
            }}
          >
            <GoogleIcon />
            {t("auth.form.continueGoogle") || "Continue with Google"}
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <div style={{ flex:1, height:1, background:T.border }} />
            <span style={{ fontSize:12, color:T.muted, fontWeight:600 }}>{t("auth.form.orDivider") || "OR"}</span>
            <div style={{ flex:1, height:1, background:T.border }} />
          </div>

          <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {mode==="signup" && <>
              <div>
                <label style={{ fontSize:13, fontWeight:500, color:T.muted, display:"block", marginBottom:6 }}>{t("auth.form.nameLabel") || "Full name"}</label>
                <input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="Jake Morrison" autoFocus/>
              </div>
              <div>
                <label style={{ fontSize:13, fontWeight:500, color:T.muted, display:"block", marginBottom:6 }}>{t("auth.form.usernameLabel") || "Username"}</label>
                <input style={inp} value={username} onChange={e=>setUsername(e.target.value.replace(/\s/g,""))} placeholder="jakemorrison"/>
              </div>
              <div>
                <label style={{ fontSize:13, fontWeight:500, color:T.muted, display:"block", marginBottom:8 }}>{t("auth.form.categoryLabel") || "What do you do?"}</label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  {CATEGORIES.map(cat=>(
                    <button key={cat.id} type="button" onClick={()=>setCategory(cat)}
                      style={{ padding:"9px 11px", borderRadius:8, border:`1.5px solid ${category.id===cat.id?T.brand:T.border}`, background:category.id===cat.id?T.brandLight:"transparent", cursor:"pointer", textAlign:"left", fontFamily:"inherit", transition:"all .15s" }}>
                      <div style={{ fontSize:12, fontWeight:700, color:category.id===cat.id?T.brand:T.text }}>{t(`auth.categories.${cat.id}.label`)}</div>
                      <div style={{ fontSize:10, color:T.muted, marginTop:2, lineHeight:1.3 }}>{t(`auth.categories.${cat.id}.examples`)}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>}

            <div>
              <label style={{ fontSize:13, fontWeight:500, color:T.muted, display:"block", marginBottom:6 }}>{t("auth.form.emailLabel") || "Email"}</label>
              <input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoFocus={mode==="login"}/>
            </div>

            <div>
              <label style={{ fontSize:13, fontWeight:500, color:T.muted, display:"block", marginBottom:6 }}>
                {t("auth.form.passwordLabel") || "Password"} {mode==="signup" && <span style={{ fontWeight:400 }}>{t("auth.form.passwordHint") || "— min. 8 characters"}</span>}
              </label>
              <div style={{ position:"relative" }}>
                <input style={{ ...inp, paddingRight:60 }} type={showPass?"text":"password"}
                  value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"/>
                <button type="button" onClick={()=>setShowPass(s=>!s)}
                  style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:12, fontWeight:600 }}>
                  {showPass ? (t("auth.form.hidePass") || "Hide") : (t("auth.form.showPass") || "Show")}
                </button>
              </div>
              {mode==="login" && (
                <div style={{ textAlign:"right", marginTop:6 }}>
                  <span
                    onClick={()=>{ setStep("forgot"); setError(""); }}
                    style={{ fontSize:12, color:T.muted, cursor:"pointer", textDecoration:"underline" }}
                  >
                    {t("auth.form.forgotPassword") || "Forgot password?"}
                  </span>
                </div>
              )}
              {mode==="signup" && pass.length>0 && (
                <div style={{ marginTop:8 }}>
                  <div style={{ display:"flex", gap:4, marginBottom:4 }}>
                    {[1,2,3,4].map(i=>(
                      <div key={i} style={{ flex:1, height:3, borderRadius:2, background:i<=strength.score?strength.color:T.border, transition:"background .2s" }}/>
                    ))}
                  </div>
                  <div style={{ fontSize:12, color:strength.color, fontWeight:600 }}>{strength.label}</div>
                </div>
              )}
            </div>

            {mode==="signup" && (
              <label style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:13, color:T.muted, cursor:"pointer", lineHeight:1.5 }}>
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={e=>setAgreedToTerms(e.target.checked)}
                  style={{ marginTop:2, flexShrink:0 }}
                />
                <span>
                  {t("auth.form.agreeTermsPrefix") || "I agree to Vimen's"}{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color:T.text, fontWeight:600, textDecoration:"underline" }}>
                    {t("auth.form.privacyLink") || "Privacy Policy"}
                  </a>
                  {" "}{t("auth.form.andWord") || "and"}{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color:T.text, fontWeight:600, textDecoration:"underline" }}>
                    {t("auth.form.termsLink") || "Terms of Service"}
                  </a>
                </span>
              </label>
            )}

            {mode==="signup" && (
              <>
                <Honeypot value={honeypot} onChange={setHoneypot} />
                <Turnstile onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
              </>
            )}

            {error && <div style={{ fontSize:13, color:"#EF4444", background:"#FEF2F2", padding:"10px 14px", borderRadius:8, lineHeight:1.5 }}>{error}</div>}

            <button disabled={loading || (mode==="signup" && (!agreedToTerms || !captchaToken))}
              style={{ padding:"12px", borderRadius:8, background:T.brand, color:"#fff", border:"none", fontSize:15, fontWeight:700, cursor:(loading||(mode==="signup"&&(!agreedToTerms||!captchaToken)))?"not-allowed":"pointer", opacity:(loading||(mode==="signup"&&(!agreedToTerms||!captchaToken)))?0.7:1, marginTop:4 }}>
              {loading ? (t("auth.form.loading") || "Please wait…") : mode==="login" ? (t("auth.form.submitLogin") || "Sign in →") : (t("auth.form.submitSignup") || "Create account →")}
            </button>
          </form>

          <div style={{ height:1, background:T.border, margin:"20px 0" }}/>
          <div style={{ textAlign:"center", fontSize:14, color:T.muted }}>
            {mode==="login" ? (t("auth.form.noAccount") || "No account? ") : (t("auth.form.hasAccount") || "Already signed up? ")}
            <span style={{ color:T.brand, cursor:"pointer", fontWeight:700 }}
              onClick={()=>{ setMode(m=>m==="login"?"signup":"login"); setError(""); }}>
              {mode==="login" ? (t("auth.form.gotoSignup") || "Sign up free") : (t("auth.form.gotoLogin") || "Sign in")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main app shell ─────────────────────────────────── */
function AppShell() {
  const [page, setPage] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { toasts, addToast } = useToasts();
  const { profile, data, setData, loading, error, refresh, saveProfile, setProfile } = useAppData();
  const { signOut } = useClerk();

  // Câble le changement de langue (navbar/settings) pour qu'il se
  // sauvegarde aussi côté serveur (profiles.language) — utilisé pour
  // générer les emails (factures, devis...) dans la bonne langue.
  // Sans ça, le sélecteur ne changeait que l'affichage local, jamais
  // ce que le serveur envoyait.
  useEffect(() => {
    if (!profile?.id) return;
    setLanguagePersister((newLang) => saveProfile({ ...profile, language: newLang }));
    return () => setLanguagePersister(null);
  }, [profile?.id, saveProfile]);

  const state = {
    user:              profile ?? SEED.user,
    jobs:              data?.jobs            ?? [],
    clients:           data?.clients         ?? [],
    invoices:          data?.invoices        ?? [],
    quotes:            data?.quotes          ?? [],
    booking_requests:  data?.booking_requests ?? [],
    transactions:      data?.transactions    ?? [],
    payouts:           data?.payouts         ?? [],
    reviews:           data?.reviews         ?? [],
    certifications:    data?.certifications  ?? [],
    referrals:         data?.referrals       ?? [],
    listings:          data?.listings        ?? [],
  };

  function dispatch(action) {
    const { type, payload } = action;
    if (type === "UPDATE_USER") {
      saveProfile(payload);
      return;
    }
    setData(prev => {
      if (!prev) return prev;
      switch (type) {
        case "ADD_JOB":
          return { ...prev, jobs: [...prev.jobs, payload] };
        case "ADD_QUOTE":
          return { ...prev, quotes: [payload, ...(prev.quotes || [])] };
        case "UPDATE_QUOTE":
          return { ...prev, quotes: (prev.quotes || []).map(q => q.id === payload.id ? { ...q, ...payload } : q) };
        case "DELETE_QUOTE":
          return { ...prev, quotes: (prev.quotes || []).filter(q => q.id !== payload) };
        case "ADD_CERT":
          return { ...prev, certifications: [...prev.certifications, payload] };
        case "UPDATE_CERT":
          return { ...prev, certifications: prev.certifications.map(c => c.id===payload.id ? {...c,...payload} : c) };
        case "DELETE_CERT":
          return { ...prev, certifications: prev.certifications.filter(c => c.id!==payload) };
        case "ADD_REVIEW":
          return { ...prev, reviews: [payload, ...prev.reviews] };
        case "ADD_REFERRAL":
          return { ...prev, referrals: [...prev.referrals, payload] };
        default:
          return prev;
      }
    });
  }

  if (loading) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:T.bg }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:15, color:T.muted }}>Loading your workspace…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:T.bg, padding:20 }}>
        <div style={{ background:T.surface, padding:32, borderRadius:T.r.xl, boxShadow:T.shadow.xl, maxWidth:450, textAlign:"center" }}>
          <h3 style={{ fontSize:18, fontWeight:700, color:"#EF4444", marginBottom:8 }}>Failed to load workspace</h3>
          <p style={{ fontSize:14, color:T.muted, marginBottom:20 }}>{error.message || JSON.stringify(error)}</p>
          <button onClick={() => window.location.reload()} style={{ padding:"10px 20px", background:T.brand, color:"#fff", border:"none", borderRadius:8, fontWeight:600, cursor:"pointer" }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const pageProps = { profile:state.user, setPage, state, dispatch, toast:addToast, refresh, setProfile };

  const PAGES = {
    dashboard:      <DashboardPage      {...pageProps}/>,
    jobs:           <JobsPage           {...pageProps}/>,
    clients:        <ClientsPage        {...pageProps}/>,
    invoices:       <InvoicesPage       {...pageProps}/>,
    booking:        <BookingPage        {...pageProps}/>,
    marketplace:    <MarketplacePage    {...pageProps}/>,
    payments:       <PaymentsPage       {...pageProps}/>,
    quotes:         <QuotesPage         {...pageProps}/>,
    reviews:        <ReviewsPage        {...pageProps}/>,
    certifications: <CertificationsPage {...pageProps}/>,
    referrals:      <ReferralsPage      {...pageProps}/>,
    settings:       <SettingsPage       {...pageProps}/>,
  };

  return (
    <AppCtx.Provider value={{ state, dispatch, toast:addToast, refresh }}>
      <Toaster 
        position="top-center" 
        toastOptions={{ 
          duration: 4000, 
          style: { background: '#333', color: '#fff', fontSize: '14px', borderRadius: '8px' } 
        }} 
      />
      <div style={{ display:"flex", minHeight:"100vh" }}>
        <style>{`
          .vimen-mobile-nav-toggle { display: none; }
          .vimen-content-area { }
          @media (max-width: 860px) {
            .vimen-mobile-nav-toggle { display: flex !important; }
            .vimen-content-area { padding-top: 56px !important; }
          }
        `}</style>
        <Sidebar
          page={page} setPage={setPage}
          profile={state.user}
          onSignOut={() => signOut()}
          pendingBookings={state.booking_requests?.filter(b=>b.status==="pending").length ?? 0}
          pendingQuotes={state.quotes?.filter(q=>q.status==="sent").length ?? 0}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />
        <div className="vimen-content-area" style={{ flex:1, overflow:"auto", minWidth:0, background:T.bg }}>
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="vimen-mobile-nav-toggle"
            style={{
              position:"fixed", top:14, left:14, zIndex:100,
              alignItems:"center", justifyContent:"center",
              width:38, height:38, borderRadius:T.r.md,
              border:`1px solid ${T.border}`, background:T.surface,
              color:T.text, cursor:"pointer", fontSize:18,
              boxShadow:T.shadow.sm,
            }}
            aria-label="Menu"
          >
            ☰
          </button>
          {PAGES[page] || PAGES.dashboard}
        </div>
      </div>
      <ToastStack messages={toasts}/>
    </AppCtx.Provider>
  );
}

/* ── Demo mode shell (no Clerk key configured) ─────── */
function DemoAppShell() {
  const [page, setPage] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { toasts, addToast } = useToasts();
  const [demoState, demoDispatch] = useReducer(reducer, SEED);

  const pageProps = {
    profile: demoState.user, setPage, state: demoState, dispatch: demoDispatch,
    toast: addToast, refresh: () => {}, setProfile: () => {},
  };

  const PAGES = {
    dashboard:      <DashboardPage      {...pageProps}/>,
    jobs:           <JobsPage           {...pageProps}/>,
    clients:        <ClientsPage        {...pageProps}/>,
    invoices:       <InvoicesPage       {...pageProps}/>,
    booking:        <BookingPage        {...pageProps}/>,
    marketplace:    <MarketplacePage    {...pageProps}/>,
    payments:       <PaymentsPage       {...pageProps}/>,
    quotes:         <QuotesPage         {...pageProps}/>,
    reviews:        <ReviewsPage        {...pageProps}/>,
    certifications: <CertificationsPage {...pageProps}/>,
    referrals:      <ReferralsPage      {...pageProps}/>,
    settings:       <SettingsPage       {...pageProps}/>,
  };

  return (
    <AppCtx.Provider value={{ state: demoState, dispatch: demoDispatch, toast: addToast, refresh: () => {} }}>
      <Toaster 
        position="top-center" 
        toastOptions={{ 
          duration: 4000, 
          style: { background: '#333', color: '#fff', fontSize: '14px', borderRadius: '8px' } 
        }} 
      />
      <div style={{ display:"flex", minHeight:"100vh" }}>
        <style>{`
          .vimen-mobile-nav-toggle { display: none; }
          .vimen-content-area { }
          @media (max-width: 860px) {
            .vimen-mobile-nav-toggle { display: flex !important; }
            .vimen-content-area { padding-top: 56px !important; }
          }
        `}</style>
        <Sidebar
          page={page} setPage={setPage}
          profile={demoState.user}
          onSignOut={() => window.location.reload()}
          pendingBookings={demoState.booking_requests?.filter(b=>b.status==="pending").length ?? 0}
          pendingQuotes={demoState.quotes?.filter(q=>q.status==="sent").length ?? 0}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />
        <div className="vimen-content-area" style={{ flex:1, overflow:"auto", minWidth:0, background:T.bg }}>
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="vimen-mobile-nav-toggle"
            style={{
              position:"fixed", top:14, left:14, zIndex:100,
              alignItems:"center", justifyContent:"center",
              width:38, height:38, borderRadius:T.r.md,
              border:`1px solid ${T.border}`, background:T.surface,
              color:T.text, cursor:"pointer", fontSize:18,
              boxShadow:T.shadow.sm,
            }}
            aria-label="Menu"
          >
            ☰
          </button>
          {PAGES[page] || PAGES.dashboard}
        </div>
      </div>
      <ToastStack messages={toasts}/>
    </AppCtx.Provider>
  );
}

/* ── Clerk-gated app (real auth) ────────────────────── */
function ClerkGatedApp() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    setClerkTokenGetter(() => getToken());
  }, [getToken]);

  const wantsSignup   = searchParams.get("signup") === "1";
  const hasAuthIntent = searchParams.has("signup") || searchParams.has("login");
  const initialMode   = wantsSignup ? "signup" : "login";

  if (!isLoaded) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>Loading…</div>;

  if (!isSignedIn && !hasAuthIntent) {
    const publicPageProps = {
      onSignIn: () => navigate("/?login=1", { replace: false }),
      onSignUp: () => navigate("/?signup=1", { replace: false }),
    };

    switch (location.pathname) {
      // "/pricing" désactivé temporairement — retiré du switch, tombe sur
      // "default" (homepage) tant qu'on n'a pas de Stripe/SIRET actif.
      case "/about":
        return <AboutPage {...publicPageProps} />;
      case "/contact":
        return <ContactPage {...publicPageProps} />;
      case "/privacy":
        return <PrivacyPolicyPage {...publicPageProps} />;
      case "/terms":
        return <TermsOfServicePage {...publicPageProps} />;
      case "/mentions-legales":
        return <MentionsLegalesPage {...publicPageProps} />;;
      case "/faq":
        return <FaqPage {...publicPageProps} />;
      default:
        return <HomePage {...publicPageProps} />;
    }
  }

  if (!isSignedIn)
    return <AuthPage initialMode={initialMode}/>;

  return <AppShell />;
}

/* ── Root ───────────────────────────────────────────── */
export default function App({ useClerk: hasClerkKey = false }) {
  return (
    <>
      {hasClerkKey ? <ClerkGatedApp /> : <DemoAppShell />}
      <CookieConsent />
    </>
  );
}