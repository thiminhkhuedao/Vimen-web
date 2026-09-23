/* ══════════════════════════════════════════════════════
  src/pages/ReviewsPage.jsx (Cleaned: No Icons/Emojis)
══════════════════════════════════════════════════════ */

import { useState } from "react";
import { useTranslation } from "../i18n/index.js";
import { toast } from "react-hot-toast";
import { T } from "../styles/tokens";
import { uid } from "../lib/state";
import { supabase } from "../lib/supabase";
import ReportButton from "../components/ReportButton";
import {
  PageShell, Card, Btn, Badge, Empty,
  Modal, Field, FormActions, SectionTitle, Divider,
} from "../components/UI";
import { formatCurrency } from "../lib/currency.js";

const fmtDate = d => { 
  try { 
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); 
  } catch { 
    return "—"; 
  }
};

const INPUT_STYLE = { 
  width: "100%", 
  padding: "10px 12px", 
  borderRadius: T.r.md, 
  border: `1px solid ${T.borderMed}`, 
  fontSize: 14, 
  background: T.surface, 
  color: T.text, 
  boxSizing: "border-box", 
  fontFamily: "inherit" 
};

function Stars({ rating, size = 16 }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ fontSize: size, color: n <= rating ? "#F59E0B" : "#E5E3DE" }}>★</span>
      ))}
    </div>
  );
}

export default function ReviewsPage({ state, dispatch, profile }) {
  const { t } = useTranslation();
  const fmt = n => formatCurrency(n, profile?.currency);
  const [modal, setModal] = useState(null); 
  const [selJob, setSelJob] = useState("");
  const [form, setForm] = useState({ client_name: "", client_email: "", client_phone: "", rating: 5, title: "", body: "" });
  
  const fld = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const reviews = state?.reviews ?? [];
  const jobs = (state?.jobs ?? []).filter(j => j.status === "completed");
  const clients = state?.clients ?? [];

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "—";
  const googleClicks = reviews.filter(r => r.google_review_clicked).length;
  const verified = reviews.filter(r => r.verified).length;

  const getClient = id => clients.find(c => c.id === id);

  const googleUrl = profile?.extra_fields?.google_place_id
    ? `https://g.page/r/${profile.extra_fields.google_place_id}/review`
    : `https://www.google.com/search?q=${encodeURIComponent((profile?.name || "") + " " + (profile?.trade || ""))}`;

  async function sendRequest() {
    const job = jobs.find(j => j.id === selJob);
    if (!job) { 
      toast.error(t("reviews.toast.selectCompletedJob") || "Veuillez sélectionner une intervention"); 
      return; 
    }

    const cl = getClient(job.client_id);

    if (!cl?.email) {
      toast.error(t("reviews.toast.noContactInfo") || "Le client n'a aucune adresse email enregistrée.");
      return;
    }

    const tid = toast.loading(t("reviews.toast.sendingRequest") || "Envoi de la demande...");

    try {
      const { error } = await supabase.functions.invoke("send-review-request", {
        body: { jobId: job.id },
      });

      if (error) throw error;

      toast.dismiss(tid);
      toast.success(t("reviews.toast.requestSent", { name: cl?.name ?? "" }) || "Demande envoyée !");
      setModal(null);

    } catch (err) {
      toast.dismiss(tid);
      console.warn("[Review Request Edge Function failed]:", err);
      toast.error(t("reviews.toast.requestFailed") || "Échec de l'envoi. Merci de réessayer.");
    }
  }

  function addManual(e) {
    e.preventDefault();
    if (!form.client_name || !form.rating) { 
      toast.error(t("reviews.toast.nameRatingRequired")); 
      return; 
    }
    dispatch({ 
      type: "ADD_REVIEW", 
      payload: {
        id: uid(), 
        profile_id: profile?.id,
        job_id: null, 
        client_id: null,
        client_name: form.client_name,
        client_email: form.client_email,
        rating: Number(form.rating),
        title: form.title,
        body: form.body,
        verified: true,
        google_review_clicked: false,
        created_at: new Date().toISOString(),
      }
    });
    toast.success(t("reviews.toast.reviewAdded"));
    setModal(null);
    setForm({ client_name: "", client_email: "", client_phone: "", rating: 5, title: "", body: "" });
  }

  return (
    <PageShell 
      title={t("reviews.title")}
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="ghost" size="sm" onClick={() => setModal("add_manual")}>{t("reviews.addManuallyBtn")}</Btn>
          <Btn size="sm" onClick={() => setModal("request")}>{t("reviews.requestReviewBtn")}</Btn>
        </div>
      }
    >
      {modal === "request" && (
        <Modal title={t("reviews.requestModal.title")} onClose={() => setModal(null)} width={440}>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 16, lineHeight: 1.6 }}>
            {t("reviews.requestModal.intro")}
          </div>
          <Field label={t("reviews.requestModal.completedJobLabel")} htmlFor="review-job-select">
            <select id="review-job-select" style={INPUT_STYLE} value={selJob} onChange={e => setSelJob(e.target.value)}>
              <option value="">{t("reviews.requestModal.selectJobPlaceholder")}</option>
              {jobs.map(j => {
                const cl = getClient(j.client_id);
                return <option key={j.id} value={j.id}>{j.title} — {cl?.name ?? "?"}</option>;
              })}
            </select>
          </Field>
          {selJob && (() => {
            const job = jobs.find(j => j.id === selJob);
            const cl = getClient(job?.client_id);
            const hasContact = Boolean(cl?.email);
            return (
              <>
                <div style={{ background: T.surface2, borderRadius: T.r.md, padding: "12px 14px", marginBottom: 14, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{t("reviews.requestModal.emailPreviewTitle")}</div>
                  <div style={{ color: T.muted, fontStyle: "italic", lineHeight: 1.6 }}>
                    {t("reviews.requestModal.emailTemplate", {
                      clientName: cl?.name ?? t("reviews.fallback.clientBracket"),
                      jobTitle: job?.title ?? t("reviews.fallback.work"),
                      profileName: profile?.name,
                    })}
                  </div>
                </div>

                <div style={{ fontSize: 12, marginBottom: 14, color: hasContact ? T.green : T.red }}>
                  {cl?.email ? `Email : ${cl.email}` : t("reviews.requestModal.noEmailWarning")}
                </div>
              </>
            );
          })()}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
            <Btn variant="ghost" onClick={() => setModal(null)}>{t("reviews.requestModal.cancel")}</Btn>
            <Btn onClick={sendRequest}>{t("reviews.requestModal.sendEmailBtn")}</Btn>
          </div>
        </Modal>
      )}

      {modal === "add_manual" && (
        <Modal title={t("reviews.manualModal.title")} onClose={() => setModal(null)}>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 14 }}>
            {t("reviews.manualModal.intro")}
          </div>
          <form onSubmit={addManual}>
            <Field label={t("reviews.manualModal.clientNameLabel")} htmlFor="manual-client-name">
              <input id="manual-client-name" style={INPUT_STYLE} value={form.client_name} onChange={fld("client_name")} placeholder={t("reviews.manualModal.clientNamePlaceholder")} autoFocus />
            </Field>
            <Field label={t("reviews.manualModal.ratingLabel")}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <span key={n} onClick={() => setForm(p => ({ ...p, rating: n }))}
                    style={{ fontSize: 28, cursor: "pointer", color: n <= form.rating ? "#F59E0B" : "#E5E3DE" }}>★</span>
                ))}
                <span style={{ fontSize: 13, color: T.muted, marginLeft: 4 }}>
                  {t("reviews.manualModal.ratingDisplay", { rating: form.rating, total: 5 })}
                </span>
              </div>
            </Field>
            <Field label={t("reviews.manualModal.reviewTitleLabel")} htmlFor="manual-review-title">
              <input id="manual-review-title" style={INPUT_STYLE} value={form.title} onChange={fld("title")} placeholder={t("reviews.manualModal.reviewTitlePlaceholder")} />
            </Field>
            <Field label={t("reviews.manualModal.reviewTextLabel")} htmlFor="manual-review-body">
              <textarea id="manual-review-body" style={{ ...INPUT_STYLE, height: 80, resize: "vertical" }} value={form.body} onChange={fld("body")} placeholder={t("reviews.manualModal.reviewTextPlaceholder")} />
            </Field>
            <FormActions onCancel={() => setModal(null)} submitLabel={t("reviews.manualModal.addReviewBtn")} />
          </form>
        </Modal>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div style={{ background: T.surface, borderRadius: T.r.lg, border: `1px solid ${T.border}`, padding: "20px 24px", display: "flex", alignItems: "center", gap: 20, flex: 1 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 52, fontWeight: 900, color: T.text, letterSpacing: -2, lineHeight: 1 }}>{avgRating}</div>
            <Stars rating={Math.round(Number(avgRating) || 0)} size={18} />
            <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{t("reviews.stats.reviewsCount", { count: reviews.length })}</div>
          </div>
          <div style={{ flex: 1 }}>
            {[5, 4, 3, 2, 1].map(star => {
              const count = reviews.filter(r => r.rating === star).length;
              const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: T.muted, width: 8 }}>{star}</span>
                  <span style={{ color: "#F59E0B", fontSize: 12 }}>★</span>
                  <div style={{ flex: 1, height: 6, background: T.surface3, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "#F59E0B", borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, color: T.muted, width: 16 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          {[
            { label: t("reviews.metrics.verifiedReviews"), val: verified, sub: t("reviews.metrics.onYourProfile") },
            { label: t("reviews.metrics.googleClicks"), val: googleClicks, sub: t("reviews.metrics.tappedGoogleLink") },
            { label: t("reviews.metrics.jobsWithNoReview"), val: jobs.length - reviews.length, sub: t("reviews.metrics.couldRequestReview") },
          ].map(m => (
            <div key={m.label} style={{ background: T.surface, borderRadius: T.r.lg, border: `1px solid ${T.border}`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{m.val}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>{m.label}</div>
                <div style={{ fontSize: 12, color: T.muted }}>{m.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: T.blueBg, border: `1px solid ${T.blue}30`, borderRadius: T.r.lg, padding: "14px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700, color: T.blue, marginBottom: 2 }}>{t("reviews.googleCta.title")}</div>
          <div style={{ fontSize: 13, color: T.muted }}>{t("reviews.googleCta.description")}</div>
        </div>
        <Btn variant="ghost" size="sm" onClick={() => window.open("https://business.google.com", "_blank")}>{t("reviews.googleCta.openBtn")}</Btn>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {reviews.length === 0 ? (
          <Empty message={t("reviews.list.empty")} action={<Btn size="sm" onClick={() => setModal("request")}>{t("reviews.list.requestFirst")}</Btn>} />
        ) : (
          reviews.map(r => (
            <div key={r.id} style={{ padding: "18px 24px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: T.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                    {(r.client_name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.client_name}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{fmtDate(r.created_at)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Stars rating={r.rating} size={15} />
                  {r.verified && <Badge color="green">{t("reviews.list.verifiedBadge")}</Badge>}
                  {r.google_review_clicked && <Badge color="blue">{t("reviews.list.onGoogleBadge")}</Badge>}
                </div>
              </div>
              {r.title && <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{r.title}</div>}
              {r.body && <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.7 }}>{r.body}</div>}
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 14 }}>
                {!r.google_review_clicked && (
                  <Btn 
                    size="sm" 
                    variant="ghost"
                    onClick={() => { 
                      dispatch({ type: "UPDATE_REVIEW", payload: { id: r.id, google_review_clicked: true } }); 
                      toast.success(t("reviews.toast.markedPushedToGoogle")); 
                    }}
                  >
                    {t("reviews.list.askClientToPostBtn")}
                  </Btn>
                )}
                <ReportButton contentType="review" contentId={r.id} ownerProfileId={profile?.id} />
              </div>
            </div>
          ))
        )}
      </Card>
    </PageShell>
  );
}