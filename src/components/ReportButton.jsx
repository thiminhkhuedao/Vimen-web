// src/components/ReportButton.jsx
//
// Bouton "Signaler" réutilisable — conformité DSA (mécanisme de
// notice-and-action). À poser sur n'importe quel contenu généré par un
// utilisateur et visible publiquement (avis, annonce marketplace...).
// Fonctionne pour un visiteur non connecté (pas besoin de compte pour
// signaler).
//
// Usage :
//   <ReportButton contentType="review" contentId={review.id} ownerProfileId={review.profile_id} />
//   <ReportButton contentType="marketplace_listing" contentId={listing.id} ownerProfileId={listing.profile_id} />

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useTranslation } from "../i18n/index.js";

const REASONS = [
  { value: "illegal", labelKey: "report.reasons.illegal", fallback: "Illegal content" },
  { value: "fake", labelKey: "report.reasons.fake", fallback: "Fake / misleading" },
  { value: "harassment", labelKey: "report.reasons.harassment", fallback: "Harassment or abuse" },
  { value: "spam", labelKey: "report.reasons.spam", fallback: "Spam" },
  { value: "other", labelKey: "report.reasons.other", fallback: "Other" },
];

export default function ReportButton({ contentType, contentId, ownerProfileId, style }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!reason) {
      setError(t("report.reasonRequired") || "Please select a reason.");
      return;
    }
    setSending(true);
    setError("");
    const { error: insertError } = await supabase.from("content_reports").insert({
      content_type: contentType,
      content_id: contentId,
      owner_profile_id: ownerProfileId,
      reason,
      details: details.trim() || null,
      reporter_email: email.trim() || null,
    });
    setSending(false);
    if (insertError) {
      setError(t("report.failed") || "Something went wrong. Please try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <span style={{ fontSize: 12, color: "#1A7F4B", fontWeight: 600, ...style }}>
        {t("report.thanks") || "Thanks, we'll review this."}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: "#8A8780", textDecoration: "underline",
          padding: 0, fontFamily: "inherit", ...style,
        }}
      >
        {t("report.button") || "Report"}
      </button>

      {open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 16, padding: 28, width: 420, maxWidth: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800 }}>
              {t("report.title") || "Report this content"}
            </h3>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "#6B6B66" }}>
              {t("report.subtitle") || "Let us know what's wrong. We'll review it as soon as possible."}
            </p>

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E5E0", fontSize: 14, fontFamily: "inherit" }}
              >
                <option value="">{t("report.selectReason") || "Select a reason…"}</option>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {t(r.labelKey) || r.fallback}
                  </option>
                ))}
              </select>

              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={t("report.detailsPlaceholder") || "Additional details (optional)"}
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E5E0", fontSize: 14, height: 80, resize: "vertical", fontFamily: "inherit" }}
              />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("report.emailPlaceholder") || "Your email (optional, in case we need more info)"}
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E5E0", fontSize: 14, fontFamily: "inherit" }}
              />

              {error && <p style={{ margin: 0, fontSize: 13, color: "#DC2626" }}>{error}</p>}

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #E5E5E0", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
                >
                  {t("common.cancel") || "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#131211", color: "#fff", fontWeight: 700, fontSize: 14, cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1 }}
                >
                  {sending ? (t("report.sending") || "Sending…") : (t("report.submit") || "Submit report")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}