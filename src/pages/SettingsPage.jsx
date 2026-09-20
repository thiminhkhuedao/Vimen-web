// src/pages/SettingsPage.jsx

import { useState, useEffect, useContext, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { toast } from "react-hot-toast";
import { updateProfile, uploadImage, getStripeConnectUrl } from "../lib/db";
import { T } from "../styles/tokens";
import {
  PageShell, Card, Btn, Badge, Avatar,
  Field, FieldRow, Divider, Toggle,
} from "../components/UI";
import { CURRENCY_SYMBOLS } from "../lib/currency.js";
import { VERTICALS, getVerticalForProfession, getProfileFields, getVerticalLabel, getProfessionLabel } from "../lib/professions.js";
import { useTranslation, LANGUAGES } from "../i18n/index.js";
import { AppCtx } from "../lib/state.jsx";
import PrivacyControls from "../components/PrivacyControls.jsx";
import SecuritySettings from "../components/SecuritySettings.jsx";

const INPUT_STYLE = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: T.r.md,
  border: `1px solid ${T.borderMed}`,
  fontSize: 14,
  background: T.surface,
  color: T.text,
  boxSizing: "border-box",
  fontFamily: "inherit",
};

export default function SettingsPage({ profile, setProfile, dispatch }) {
  const { t, lang, setLanguage } = useTranslation();
  const { getToken } = useAuth();
  const context = useContext(AppCtx);
  
  const activeDispatch = dispatch || context?.dispatch;
  const refresh = context?.refresh;

  const [tab, setTab] = useState("account");
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);

  async function handleAvatarFile(file) {
    if (!file) return;
    const targetId = profile?.id || profile?.clerk_id;
    if (!targetId) {
      toast.error(t("settings.avatarNoProfile") || "Profil non chargé, réessaie dans un instant.");
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    try {
      const { data: publicUrl, error } = await uploadImage(targetId, file, "avatars");
      if (error) throw error;
      setForm(p => ({ ...p, avatar_url: publicUrl }));
      setSelectedFile(null);
    } catch (err) {
      console.error("[Settings avatar upload failed]:", err);
      toast.error(t("settings.avatarUploadFailed") || "Échec de l'envoi de la photo, réessaie.");
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
    }
  }

  const [form, setForm] = useState({
    name: profile?.name ?? "",
    trade: profile?.trade ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
    bio: profile?.bio ?? "",
    hourly_rate: profile?.hourly_rate ?? "",
    currency: profile?.currency ?? "EUR",
    bank_name: profile?.bank_name ?? "",
    sort_code: profile?.sort_code ?? "",
    account_number: profile?.account_number ?? "",
    payment_terms: profile?.payment_terms ?? "14 days",
    invoice_notes: profile?.invoice_notes ?? "",
    booking_slug: profile?.booking_slug ?? "",
    google_review_url: profile?.google_review_url ?? "",
    notif_email_booking: profile?.notif_email_booking ?? true,
    notif_weekly_digest: profile?.notif_weekly_digest ?? true,
    notif_overdue_reminder: profile?.notif_overdue_reminder ?? true,
    show_iban_on_documents: profile?.show_iban_on_documents ?? true,
    show_stripe_link_on_documents: profile?.show_stripe_link_on_documents ?? true,
    reminder_frequency_days: profile?.reminder_frequency_days ?? 7,
    reminder_max_count: profile?.reminder_max_count ?? 5,
    extra_fields: profile?.extra_fields ?? {},
    avatar_url: profile?.avatar_url ?? "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? "",
        trade: profile.trade ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        bio: profile.bio ?? "",
        hourly_rate: profile.hourly_rate ?? "",
        currency: profile.currency ?? "EUR",
        bank_name: profile.bank_name ?? "",
        sort_code: profile.sort_code ?? "",
        account_number: profile.account_number ?? "",
        payment_terms: profile.payment_terms ?? "14 days",
        invoice_notes: profile.invoice_notes ?? "",
        booking_slug: profile.booking_slug ?? "",
        google_review_url: profile.google_review_url ?? "",
        notif_email_booking: profile.notif_email_booking ?? true,
        notif_weekly_digest: profile.notif_weekly_digest ?? true,
        notif_overdue_reminder: profile.notif_overdue_reminder ?? true,
        show_iban_on_documents: profile.show_iban_on_documents ?? true,
        show_stripe_link_on_documents: profile.show_stripe_link_on_documents ?? true,
        reminder_frequency_days: profile.reminder_frequency_days ?? 7,
        reminder_max_count: profile.reminder_max_count ?? 5,
        extra_fields: profile.extra_fields ?? {},
        avatar_url: profile.avatar_url ?? "",
      });
    }
  }, [profile]);

  /* ── RETOUR DE L'ONBOARDING STRIPE (Account Links) ─── */
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("tab") === "payment" && urlParams.get("stripe_return") === "1") {
      (async () => {
        if (refresh) await refresh();
        toast.success("Statut Stripe mis à jour.");
        window.history.replaceState({}, document.title, window.location.pathname + "?tab=payment");
      })();
    }
  }, [refresh]);

  const fields = getProfileFields(form.trade, t);

  const fld = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const tog = k => v => setForm(p => ({ ...p, [k]: v }));
  const exFld = key => val =>
    setForm(p => ({
      ...p,
      extra_fields: { ...(p.extra_fields || {}), [key]: val },
    }));

  async function save() {
    const targetId = profile?.id || profile?.clerk_id;
    setSaving(true);

    try {
      const avatarUrl = form.avatar_url;

      const payload = {
        name: form.name,
        trade: form.trade,
        email: form.email,
        phone: form.phone,
        bio: form.bio,
        hourly_rate: form.hourly_rate,
        currency: form.currency,
        bank_name: form.bank_name,
        sort_code: form.sort_code,
        account_number: form.account_number,
        payment_terms: form.payment_terms,
        invoice_notes: form.invoice_notes,
        booking_slug: form.booking_slug,
        google_review_url: form.google_review_url,
        notif_email_booking: form.notif_email_booking,
        notif_weekly_digest: form.notif_weekly_digest,
        notif_overdue_reminder: form.notif_overdue_reminder,
        show_iban_on_documents: form.show_iban_on_documents,
        show_stripe_link_on_documents: form.show_stripe_link_on_documents,
        reminder_frequency_days: form.reminder_frequency_days,
        reminder_max_count: form.reminder_max_count,
        extra_fields: form.extra_fields,
        avatar_url: avatarUrl,
      };

      let updatedProfile = { ...profile, ...form, avatar_url: avatarUrl };

      if (targetId) {
        const { data, error } = await updateProfile(targetId, payload);
        if (error) {
          // Avant : on loggait juste un warn et on continuait comme si de rien n'était,
          // ce qui affichait "Modifications enregistrées !" alors que rien n'était en base.
          throw error;
        }
        if (data) updatedProfile = data;
      } else {
        console.warn("[Settings save] targetId manquant (profile?.id / profile?.clerk_id) — rien à sauvegarder en base.");
      }

      if (typeof setProfile === "function") {
        setProfile(updatedProfile);
      }

      if (typeof activeDispatch === "function") {
        activeDispatch({ type: "UPDATE_USER", payload: updatedProfile });
      }

      if (typeof refresh === "function") {
        await refresh();
      }

      setSelectedFile(null);
      setAvatarPreview(null);

      toast.success(t("settings.successSave") || "Modifications enregistrées !");
    } catch (err) {
      console.error("[Settings save error detailed]:", err);
      toast.error(t("settings.errorSave") || "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  /* ── PREMIER ENDROIT STRIPE CONNECT (Onglet Payment) ── */
  async function handleConnectStripe() {
    const returnUrl = `${window.location.origin}/settings?tab=payment&stripe_return=1`;

    toast.loading(t("settings.redirectingStripe") || "Redirection vers Stripe...");
    try {
      const token = await getToken();
      const { data, error } = await getStripeConnectUrl(token, returnUrl);
      if (error || !data?.url) throw new Error(error?.message || "URL Stripe manquante");
      toast.dismiss();
      window.location.href = data.url;
    } catch (err) {
      toast.dismiss();
      toast.error(t("settings.stripeConnectError") || "Impossible de démarrer la connexion Stripe. Réessaie dans un instant ou contacte le support si ça persiste.");
      console.error("[Stripe Connect Error]:", err);
    }
  }

  /* handleUpgradeStripe — retirée en même temps que l'onglet "plan"
     (voir note plus bas). Plus aucun bouton ne l'appelle actuellement.
     Code d'origine conservé ici pour réactivation :

  async function handleUpgradeStripe() {
    const userId = profile?.id || profile?.clerk_id;
    try {
      toast.loading(t("settings.redirectingStripe") || "Redirection vers Stripe...");
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email: form.email }),
      });
      
      const data = await res.json();
      toast.dismiss();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "URL Checkout introuvable.");
      }
    } catch (err) {
      toast.dismiss();
      toast.error("Impossible d'initialiser la redirection Stripe.");
      console.error("[Stripe checkout error]:", err);
    }
  }
  */

  const TabBtn = ({ id, label }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{
        padding: "9px 20px",
        border: "none",
        borderBottom: tab === id ? `2px solid ${T.brand}` : "2px solid transparent",
        background: "transparent",
        color: tab === id ? T.brand : T.muted,
        fontSize: 14,
        fontWeight: tab === id ? 700 : 400,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  const SettingRow = ({ label, sub, k }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 0",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      <Toggle on={form[k]} onChange={tog(k)} aria-label={label} />
    </div>
  );

  const TERMS_OPTIONS = [
    t("settings.termsImmediate"),
    t("settings.terms7"),
    t("settings.terms14"),
    t("settings.terms30"),
  ];

  return (
    <PageShell title={t("settings.title")}>
      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, marginBottom: 24 }}>
        <TabBtn id="account" label={t("settings.account")} />
        <TabBtn id="payment" label={t("settings.payment")} />
        <TabBtn id="notifs" label={t("settings.notifications")} />
        {/* Onglet "plan" retiré temporairement — pas de Stripe/SIRET actif,
            tout est gratuit pour l'instant. Remettre la ligne ci-dessous
            (+ le bloc de rendu correspondant) pour le réactiver :
            <TabBtn id="plan" label={t("settings.plan")} /> */}
        <TabBtn id="language" label={t("settings.language")} />
        <TabBtn id="privacy" label={t("settings.privacy") || "Confidentialité & Sécurité"} />
      </div>

      <div style={{ maxWidth: 540 }}>
        {tab === "account" && (
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 24,
                paddingBottom: 20,
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <div style={{ position: "relative" }}>
                <Avatar name={form.name || "?"} size={56} src={avatarPreview || form.avatar_url} />
                {avatarUploading && (
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    background: "rgba(0,0,0,0.45)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 10, fontWeight: 700,
                  }}>
                    …
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  title={t("settings.changePhoto")}
                  style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    border: `2px solid ${T.surface}`,
                    background: T.brand,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    cursor: avatarUploading ? "default" : "pointer",
                    padding: 0,
                  }}
                >
                  ✎
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    handleAvatarFile(file);
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{form.name || t("settings.yourName")}</div>
                <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>{form.trade}</div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: T.brand,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: avatarUploading ? "default" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {avatarUploading ? (t("settings.uploadingPhoto") || "Envoi...") : t("settings.changePhoto")}
                  </button>
                  {(avatarPreview || form.avatar_url) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setAvatarPreview(null);
                        setForm(p => ({ ...p, avatar_url: "" }));
                        if (avatarInputRef.current) avatarInputRef.current.value = "";
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: T.muted,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {t("settings.removePhoto")}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <FieldRow>
              <Field label={t("settings.fullName")} htmlFor="account-name" flex="1">
                <input id="account-name" style={INPUT_STYLE} value={form.name} onChange={fld("name")} />
              </Field>
              <Field label={t("settings.profession")} htmlFor="account-trade" flex="1">
                <select id="account-trade" style={INPUT_STYLE} value={form.trade} onChange={fld("trade")}>
                  {Object.values(VERTICALS)
                    .filter(v => v.id !== "other")
                    .map(v => (
                      <optgroup key={v.id} label={`${v.icon}  ${getVerticalLabel(v, t)}`}>
                        {v.professions.map(p => (
                          <option key={p} value={p}>
                            {getProfessionLabel(p, t)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  <option value="Other">{getProfessionLabel("Other", t)}</option>
                </select>
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label={t("settings.email")} htmlFor="account-email" flex="1">
                <input id="account-email" type="email" style={INPUT_STYLE} value={form.email} onChange={fld("email")} />
              </Field>
              <Field label={t("settings.phone")} htmlFor="account-phone" flex="1">
                <input id="account-phone" style={INPUT_STYLE} value={form.phone} onChange={fld("phone")} />
              </Field>
            </FieldRow>

            <Field label={t("settings.bio")} htmlFor="account-bio">
              <textarea
                id="account-bio"
                style={{ ...INPUT_STYLE, height: 80, resize: "vertical" }}
                value={form.bio}
                onChange={fld("bio")}
                placeholder={t("settings.bioPlaceholder")}
              />
            </Field>

            <FieldRow>
              <Field label={t("settings.hourlyRate")} htmlFor="account-hourly-rate" flex="1">
                <input
                  id="account-hourly-rate"
                  type="number"
                  style={INPUT_STYLE}
                  value={form.hourly_rate}
                  onChange={fld("hourly_rate")}
                  min="0"
                />
              </Field>
              <Field label={t("settings.bookingSlug")} htmlFor="account-booking-slug" flex="1">
                <input
                  id="account-booking-slug"
                  style={INPUT_STYLE}
                  value={form.booking_slug}
                  onChange={fld("booking_slug")}
                  placeholder="yourname"
                />
              </Field>
            </FieldRow>

            <Field label={t("settings.googleReviewUrl")} htmlFor="account-google-review-url">
              <input
                id="account-google-review-url"
                style={INPUT_STYLE}
                value={form.google_review_url}
                onChange={fld("google_review_url")}
                placeholder={t("settings.googleReviewUrlPlaceholder")}
              />
            </Field>

            <Divider />

            {fields.length > 0 && (
              <>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  {t("settings.verticalDetails", { vertical: getVerticalForProfession(form.trade).label })}
                </div>
                <p style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>{t("settings.verticalSub")}</p>
                {fields.map(field => (
                  <VerticalField
                    key={field.key}
                    field={field}
                    value={form.extra_fields?.[field.key]}
                    onChange={exFld(field.key)}
                    t={t}
                  />
                ))}
                <Divider />
              </>
            )}

            <Btn onClick={save} disabled={saving}>
              {saving ? t("common.saving") : t("settings.saveAccount")}
            </Btn>
          </Card>
        )}

        {tab === "payment" && (
          <Card>
            {/* Déplacé depuis l'ancien onglet "plan" lors du retrait
                temporaire de l'abonnement Pro — Stripe Connect reste actif */}
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t("settings.stripeConnectTitle")}</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>{t("settings.stripeConnectSub")}</div>
            <Btn variant="ghost" size="sm" onClick={handleConnectStripe}>
              {t("settings.connectStripe") || "Connecter mon compte Stripe"}
            </Btn>

            <Divider />

            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t("settings.currencyTitle")}</div>
            <Field label={t("settings.currencyLabel")} htmlFor="payment-currency">
              <select id="payment-currency" style={INPUT_STYLE} value={form.currency} onChange={fld("currency")}>
                {Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => (
                  <option key={code} value={code}>
                    {code} ({symbol.trim()})
                  </option>
                ))}
              </select>
            </Field>

            <Divider />
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t("settings.bankDetails")}</div>
            <Field label={t("settings.bankName")} htmlFor="payment-bank-name">
              <input
                id="payment-bank-name"
                style={INPUT_STYLE}
                value={form.bank_name}
                onChange={fld("bank_name")}
                placeholder="Barclays Business"
              />
            </Field>
            <FieldRow>
              <Field label={t("settings.sortCode")} htmlFor="payment-sort-code" flex="1">
                <input
                  id="payment-sort-code"
                  style={INPUT_STYLE}
                  value={form.sort_code}
                  onChange={fld("sort_code")}
                  placeholder="20-12-34"
                />
              </Field>
              <Field label={t("settings.accountNumber")} htmlFor="payment-account-number" flex="1">
                <input
                  id="payment-account-number"
                  style={INPUT_STYLE}
                  value={form.account_number}
                  onChange={fld("account_number")}
                  placeholder="12345678"
                />
              </Field>
            </FieldRow>

            <Divider />
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t("settings.documentVisibility.title")}</div>
            <p style={{ fontSize: 13, color: T.muted, marginBottom: 4 }}>{t("settings.documentVisibility.sub")}</p>
            <SettingRow
              label={t("settings.documentVisibility.showIban")}
              sub={t("settings.documentVisibility.showIbanSub")}
              k="show_iban_on_documents"
            />
            <SettingRow
              label={t("settings.documentVisibility.showStripe")}
              sub={t("settings.documentVisibility.showStripeSub")}
              k="show_stripe_link_on_documents"
            />

            <Divider />
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t("settings.invoiceDefaults")}</div>
            <Field label={t("settings.paymentTerms")} htmlFor="payment-terms">
              <select id="payment-terms" style={INPUT_STYLE} value={form.payment_terms} onChange={fld("payment_terms")}>
                {TERMS_OPTIONS.map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("settings.invoiceNotes")} htmlFor="payment-invoice-notes">
              <textarea
                id="payment-invoice-notes"
                style={{ ...INPUT_STYLE, height: 72, resize: "vertical" }}
                value={form.invoice_notes}
                onChange={fld("invoice_notes")}
                placeholder={t("settings.invoiceNotesPlaceholder")}
              />
            </Field>

            <Divider />
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{t("settings.stripeTitle")}</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 14 }}>{t("settings.stripeDesc")}</div>
            
            <Btn variant="ghost" onClick={handleConnectStripe}>
              {t("settings.connectStripe")}
            </Btn>

            <Divider />
            <Btn onClick={save} disabled={saving}>
              {saving ? t("common.saving") : t("settings.savePayment")}
            </Btn>
          </Card>
        )}

        {tab === "notifs" && (
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t("settings.notifTitle")}</div>
            <SettingRow label={t("settings.notifEmail")} sub={t("settings.notifEmailSub")} k="notif_email_booking" />
            <SettingRow label={t("settings.notifDigest")} sub={t("settings.notifDigestSub")} k="notif_weekly_digest" />
            <SettingRow label={t("settings.notifOverdue")} sub={t("settings.notifOverdueSub")} k="notif_overdue_reminder" />
            {form.notif_overdue_reminder && (
              <div style={{ display: "flex", gap: 14, marginTop: 4, marginBottom: 8, paddingLeft: 4 }}>
                <Field label={t("settings.reminderFrequency") || "Rappeler tous les"} htmlFor="reminder_frequency_days">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      id="reminder_frequency_days"
                      type="number"
                      min={1}
                      max={30}
                      style={{ ...INPUT_STYLE, width: 80 }}
                      value={form.reminder_frequency_days}
                      onChange={e => setForm(p => ({ ...p, reminder_frequency_days: Math.max(1, Number(e.target.value) || 1) }))}
                    />
                    <span style={{ fontSize: 13, color: T.muted }}>{t("settings.days") || "jours"}</span>
                  </div>
                </Field>
                <Field label={t("settings.reminderMaxCount") || "Nombre max de rappels"} htmlFor="reminder_max_count">
                  <input
                    id="reminder_max_count"
                    type="number"
                    min={1}
                    max={5}
                    style={{ ...INPUT_STYLE, width: 80 }}
                    value={form.reminder_max_count}
                    onChange={e => setForm(p => ({ ...p, reminder_max_count: Math.min(5, Math.max(1, Number(e.target.value) || 1)) }))}
                  />
                </Field>
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <Btn onClick={save} disabled={saving}>
                {saving ? t("common.saving") : t("settings.savePreferences")}
              </Btn>
            </div>
          </Card>
        )}

        {/*
          Onglet "plan" (abonnement Free/Pro via Stripe Checkout) retiré
          temporairement — pas de Stripe/SIRET actif pour ça, tout est
          gratuit pour l'instant. La carte "Connexion Stripe Connect"
          qui vivait ici a été déplacée dans l'onglet "payment" ci-dessus
          (Stripe Connect reste actif, c'est un système différent).

          Pour réactiver : remettre le TabBtn "plan" plus haut, et
          recoller ici le bloc {tab === "plan" && (...)} d'origine
          (disponible dans l'historique de conversation si besoin).
        */}

        {tab === "language" && (
          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{t("settings.languageTitle")}</div>
            <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>{t("settings.languageSub")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLanguage(l.code)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    borderRadius: T.r.lg,
                    border: `2px solid ${lang === l.code ? T.brand : T.border}`,
                    background: lang === l.code ? T.brandLight : T.surface,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: lang === l.code ? T.brand : T.text }}>
                      {l.nativeLabel}
                    </div>
                    <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>{l.label}</div>
                  </div>
                  {lang === l.code && <span style={{ fontSize: 18, color: T.brand }}>✓</span>}
                </button>
              ))}
            </div>
          </Card>
        )}

        {tab === "privacy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Card>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                {t("settings.securityTitle") || "Sécurité du compte"}
              </div>
              <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>
                {t("settings.securitySub") || "Active la double authentification et gère les appareils connectés à ton compte."}
              </p>
              <SecuritySettings />
            </Card>

            <Card>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                {t("settings.privacyTitle") || "Tes données personnelles"}
              </div>
              <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>
                {t("settings.privacySub") || "Exporte une copie de tes données, ou supprime définitivement ton compte."}
              </p>
              <PrivacyControls />
            </Card>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function VerticalField({ field, value, onChange, t }) {
  const fieldId = `vfield-${field.key}`;

  if (field.type === "boolean") {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <input
          id={fieldId}
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
          style={{ marginTop: 3, width: 16, height: 16, accentColor: T.brand }}
        />
        <div>
          <label htmlFor={fieldId} style={{ fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
            {field.label}
          </label>
          {field.helpText && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{field.helpText}</div>}
        </div>
      </div>
    );
  }

  if (field.type === "list") {
    const items = Array.isArray(value) ? value : [];
    const addItem = () => onChange([...items, {}]);
    const removeItem = idx => onChange(items.filter((_, i) => i !== idx));
    const updateItem = (idx, key, val) =>
      onChange(items.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));

    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.muted, marginBottom: 8 }}>{field.label}</div>
        {items.map((item, idx) => (
          <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-end" }}>
            {field.itemFields.map(itf => (
              <div key={itf.key} style={{ flex: 1 }}>
                <input
                  style={INPUT_STYLE}
                  value={item[itf.key] ?? ""}
                  placeholder={itf.placeholder}
                  aria-label={`${field.label} item ${idx + 1} ${itf.key}`}
                  onChange={e => updateItem(idx, itf.key, e.target.value)}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => removeItem(idx)}
              aria-label={`Remove item ${idx + 1}`}
              style={{ border: "none", background: "none", color: T.muted, cursor: "pointer", fontSize: 18, padding: "0 6px" }}
            >
              ×
            </button>
          </div>
        ))}
        <Btn variant="ghost" size="sm" onClick={addItem}>
          + {t("common.add")} {field.label.toLowerCase().replace(/s$/, "")}
        </Btn>
      </div>
    );
  }

  return (
    <Field label={field.label} htmlFor={fieldId}>
      <input
        id={fieldId}
        style={INPUT_STYLE}
        value={value ?? ""}
        placeholder={field.placeholder}
        onChange={e => onChange(e.target.value)}
      />
    </Field>
  );
}