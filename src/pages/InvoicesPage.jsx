// src/pages/InvoicesPage.jsx
import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "@clerk/clerk-react";
import { T } from "../styles/tokens";
import {
  getInvoices, createInvoice, markInvoicePaid, deleteInvoice,
} from "../lib/db";
import { createPaymentLink } from "../lib/stripe";
import { supabase } from "../lib/supabase";
import { sendInvoiceEmail } from "../lib/notifications";
import { jsPDF } from "jspdf";
import { useTranslation } from "../i18n/index.js";
import {
  PageShell, Card, Btn, Badge, Table, TD,
  Modal, ConfirmModal, Field, FieldRow, FormActions,
  Tabs, Empty, MetricCard, Toggle,
} from "../components/UI";
import UpgradeModal from "../components/UpgradeModal"; // ✅ Import de la modale d'upgrade
import { formatCurrency } from "../lib/currency.js";
import { getPaymentTermsLabel } from "../lib/paymentTerms.js";

const fmtDate = d => { try { return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); } catch { return d||""; } };

// ── Limite du plan Free ────────────────────────────────
// TEMPORAIREMENT DÉSACTIVÉE — pas de moyen de passer Pro pour l'instant
// (pas de Stripe/SIRET actif). Passer à `true` pour réactiver à la fois
// le blocage ET le compteur "x/10 factures".
const INVOICE_LIMIT_ENABLED = false;
const FREE_INVOICE_LIMIT = 10;

// ── Skeleton loader ────────────────────────────────────
function InvoiceSkeleton() {
  return (
    <>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      {[1,2,3,4].map(i => (
        <tr key={i}>
          {[70,90,70,70,60,50,80].map((w,j) => (
            <td key={j} style={{ padding:"14px 16px", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:w, height:12, borderRadius:4, background:"#E5E3DE", animation:"pulse 1.4s ease-in-out infinite" }}/>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Safe clipboard ─────────────────────────────────────
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  }
}

// ── Inline field error ─────────────────────────────────
function FieldError({ message }) {
  if (!message) return null;
  return <div style={{ fontSize:12, color:"#EF4444", marginTop:4, lineHeight:1.4 }}>{message}</div>;
}

export default function InvoicesPage({ profile, onUpgradeClick }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const fmt = n => formatCurrency(n, profile?.currency);

  const [invoices,   setInvoices]   = useState([]);
  const [clients,    setClients]    = useState([]);
  const [jobs,       setJobs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(null);
  const [filter,     setFilter]     = useState("all");
  const [modal,      setModal]      = useState(null);
  const [delId,      setDelId]      = useState(null);
  const [busy,       setBusy]       = useState(false);
  const [form,       setForm]       = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [showUpgradeModal, setShowUpgradeModal] = useState(false); // ✅ State pour la modale d'upgrade
  const [sendOptionsInv, setSendOptionsInv] = useState(null); // facture en attente de confirmation d'envoi
  const [sendOptions, setSendOptions] = useState({ includeIban: true, includeStripeLink: true });

  const fld = k => e => { setForm(p=>({...p,[k]:e.target.value})); setFormErrors(p=>({...p,[k]:""})); };

  // Gestion des limites du plan Free pour les factures
  const isPro = profile?.plan === "pro";
  const totalInvoicesCount = invoices.length;
  const isInvoiceLimitReached =
    INVOICE_LIMIT_ENABLED && !isPro && totalInvoicesCount >= FREE_INVOICE_LIMIT;
  // Le compteur n'apparaît que si la limite est réellement active
  const showInvoiceCounter = INVOICE_LIMIT_ENABLED && !isPro;

  // ── Coordonnées bancaires ──────────────────────────
  // Elles sont chiffrées dans `profiles` : on lit la vue déchiffrée
  // (comme la Edge Function) et on retombe sur `profile` en secours.
  const [bankDetails, setBankDetails] = useState(null);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles_decrypted")
        .select("bank_name, sort_code, account_number, iban, bic, bank_account_holder")
        .eq("id", profile.id)
        .maybeSingle();
      if (error) console.error("[InvoicesPage] bank details load error:", error.message);
      if (!cancelled) setBankDetails(data ?? null);
    })();
    return () => { cancelled = true; };
  }, [profile?.id]);

  // On n'affiche JAMAIS une valeur encore chiffrée ou vide
  const cleanBank = v => (typeof v === "string" && v.trim() !== "" && !v.startsWith("enc:v1:")) ? v : null;
  const bank = {
    bank_name:           cleanBank(bankDetails?.bank_name)           ?? cleanBank(profile?.bank_name),
    sort_code:           cleanBank(bankDetails?.sort_code)           ?? cleanBank(profile?.sort_code),
    account_number:      cleanBank(bankDetails?.account_number)      ?? cleanBank(profile?.account_number),
    iban:                cleanBank(bankDetails?.iban)                ?? cleanBank(profile?.iban),
    bic:                 cleanBank(bankDetails?.bic)                 ?? cleanBank(profile?.bic),
    bank_account_holder: cleanBank(bankDetails?.bank_account_holder) ?? cleanBank(profile?.bank_account_holder),
  };
  const hasBank = Object.values(bank).some(Boolean);
  const fmtIban = s => s.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
  const holderLabel = profile?.language === "fr" ? "Titulaire :" : "Account holder:";

  // Lignes de coordonnées bancaires (PDF, aperçu, copier)
  const bankTextLines = () => [
    bank.bank_account_holder && `${holderLabel} ${bank.bank_account_holder}`,
    bank.iban                && `IBAN: ${fmtIban(bank.iban)}`,
    bank.bic                 && `BIC/SWIFT: ${bank.bic}`,
    bank.bank_name           && `${t("invoices.bankLabel")} ${bank.bank_name}`,
    bank.sort_code           && `${t("invoices.sortCodeLabel")} ${bank.sort_code}`,
    bank.account_number      && `${t("invoices.accountLabel")} ${bank.account_number}`,
  ].filter(Boolean);

  // Fusionne une ligne renvoyée par Supabase dans l'état local SANS perdre
  // les relations (client, job) : un simple .update()/.insert() + .select()
  // ne renvoie pas les jointures, donc on garde celles déjà en mémoire.
  const mergeInvoice = (local, fresh, fallback = {}) => ({
    ...local,
    ...fresh,
    client: fresh?.client ?? local?.client ?? fallback.client ?? null,
    job:    fresh?.job    ?? local?.job    ?? fallback.job    ?? null,
  });

  // ── Load invoices ──────────────────────────────────
  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await getInvoices(profile.id);
      if (error) throw error;
      setInvoices(data ?? []);
    } catch (err) {
      console.error("[InvoicesPage] load error:", err);
      setLoadError(t("invoices.loadError") || "Failed to load invoices. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [profile?.id, t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    import("../lib/db").then(async ({ getClients, getJobs }) => {
      const [{ data: c }, { data: j }] = await Promise.all([
        getClients(profile.id),
        getJobs(profile.id),
      ]);
      setClients(c ?? []);
      setJobs(j ?? []);
    });
  }, [profile?.id]);

  // ── Computed ───────────────────────────────────────
  // Copie avant tri : .sort() modifie le tableau en place, et avec le filtre
  // "all" on mutait directement le state React.
  const filtered    = [...(filter === "all" ? invoices : invoices.filter(i => i.status === filter))]
                        .sort((a,b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const paid        = invoices.filter(i=>i.status==="paid").reduce((s,i)=>s+Number(i.amount),0);
  const outstanding = invoices.filter(i=>i.status==="unpaid").reduce((s,i)=>s+Number(i.amount),0);
  const isOverdue   = inv => inv.status==="unpaid" && inv.due_date && new Date(inv.due_date) < new Date();
  const previewInv  = modal && modal!=="add" ? invoices.find(i=>i.id===modal) : null;

  // ── Handlers & Limite ─────────────────────────────
  function handleOpenCreateInvoice() {
    if (isInvoiceLimitReached) {
      setShowUpgradeModal(true);
      return;
    }
    const noInvoice = jobs.filter(j=>j.status==="completed" && !invoices.find(i=>i.job_id===j.id));
    const job = noInvoice[0];
    setForm({ client_id:job?.client_id??clients[0]?.id??"", job_id:job?.id??"", amount:job?.amount??"", due_date:"" });
    setFormErrors({});
    setModal("add");
  }

  function validateForm() {
    const errs = {};
    if (!form.client_id) errs.client_id = t("invoices.errorSelectClient") || "Please select a client.";
    if (!form.amount || Number(form.amount) <= 0) errs.amount = t("invoices.errorAmount") || "Please enter a valid amount.";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function saveInvoice(e) {
    e.preventDefault();
    if (!validateForm()) return;
    setBusy(true);

    const client = clients.find(c => c.id === form.client_id) ?? null;
    const job    = jobs.find(j => j.id === form.job_id) ?? null;

    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id:tempId, invoice_number:"...", client_id:form.client_id, job_id:form.job_id || null,
      amount:parseFloat(form.amount), status:"unpaid", due_date:form.due_date||null,
      created_at:new Date().toISOString(),
      client, job,
    };
    setInvoices(prev => [optimistic, ...prev]);
    setModal(null);
    try {
      const { data, error } = await createInvoice(profile.id, {
        client_id: form.client_id,
        job_id:    form.job_id || null,
        amount:    parseFloat(form.amount),
        due_date:  form.due_date || null,
        status:    "unpaid",
      });
      if (error) throw error;
      // On garde client / job (non renvoyés par l'insert)
      setInvoices(prev => prev.map(i => i.id===tempId ? mergeInvoice(i, data, { client, job }) : i));
      toast.success(t("invoices.createdToast"));

      // Envoi automatique dès la création, si le client a un email —
      // plus besoin de cliquer "Envoyer" séparément.
      if (client?.email && data) {
        const result = await sendInvoiceEmail(data.id);
        if (result.success) {
          const { data: updated } = await supabase
            .from("invoices")
            .update({ reminder_count: 1, last_reminder_sent_at: new Date().toISOString() })
            .eq("id", data.id)
            .select()
            .single();
          if (updated) setInvoices(prev => prev.map(i => i.id === data.id ? mergeInvoice(i, updated, { client, job }) : i));
          toast.success(t("invoices.emailedToast", { email: client.email }));
        }
      }
    } catch (err) {
      console.error("[InvoicesPage] create invoice error:", err);
      setInvoices(prev => prev.filter(i => i.id!==tempId));
      toast.error(t("invoices.createFailed") || "Failed to create invoice. Please try again.");
      setModal("add");
    }
    setBusy(false);
  }

  // ── PDF export ───────────────────────────────────────
  function handleDownloadPdf(inv) {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 48;
    let y = 56;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(230, 90, 30);
    doc.text("Vimen", marginX, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    y += 20;
    doc.text(`${profile?.name ?? ""}${profile?.trade ? " · " + profile.trade : ""}`, marginX, y);
    if (profile?.email) { y += 14; doc.text(profile.email, marginX, y); }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text(inv.invoice_number ?? "", 547, 56, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(
      `${t("invoices.issuedLabel")} ${fmtDate(inv.created_at)}`,
      547, 74, { align: "right" }
    );
    if (inv.due_date) {
      doc.text(`${t("invoices.dueLabel")} ${fmtDate(inv.due_date)}`, 547, 88, { align: "right" });
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(inv.status === "paid" ? 34 : 200, inv.status === "paid" ? 140 : 120, inv.status === "paid" ? 60 : 30);
    doc.text(
      inv.status === "paid" ? t("invoices.status.paid") : t("invoices.status.unpaid"),
      547, 104, { align: "right" }
    );

    y = 140;
    doc.setDrawColor(225, 220, 210);
    doc.line(marginX, y, 547, y);

    y += 24;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(t("invoices.billTo").toUpperCase(), marginX, y);
    y += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(inv.client?.name ?? "", marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    if (inv.client?.email) { y += 14; doc.text(inv.client.email, marginX, y); }
    if (inv.client?.address) { y += 14; doc.text(inv.client.address, marginX, y); }

    y += 32;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(t("invoices.descriptionCol").toUpperCase(), marginX, y);
    doc.text(t("invoices.amountCol").toUpperCase(), 547, y, { align: "right" });
    y += 8;
    doc.setDrawColor(225, 220, 210);
    doc.line(marginX, y, 547, y);

    y += 22;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(inv.job?.title || t("invoices.servicesRendered"), marginX, y);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(inv.amount), 547, y, { align: "right" });

    y += 16;
    doc.setDrawColor(20, 20, 20);
    doc.line(marginX, y, 547, y);

    y += 26;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text(t("invoices.totalDue"), marginX, y);
    doc.setTextColor(inv.status === "paid" ? 34 : 230, inv.status === "paid" ? 140 : 90, inv.status === "paid" ? 60 : 30);
    doc.text(fmt(inv.amount), 547, y, { align: "right" });

    if (hasBank) {
      y += 34;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 130, 60);
      doc.text(t("invoices.bankTransferTitle"), marginX, y);
      doc.setFont("helvetica", "normal");
      bankTextLines().forEach(line => { y += 14; doc.text(line, marginX, y); });
      y += 14;
      doc.text(`${t("invoices.referenceLabel")} ${inv.invoice_number}`, marginX, y);
    }

    y += 34;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `${t("invoices.referenceLabel")} ${inv.invoice_number} · ${getPaymentTermsLabel(profile?.payment_terms, t)}`,
      marginX, y
    );
    if (profile?.invoice_notes) { y += 14; doc.text(profile.invoice_notes, marginX, y, { maxWidth: 499 }); }

    doc.save(`${inv.invoice_number || "invoice"}.pdf`);
  }

  // ── Mark paid ──────────────────────────────────────
  async function handleMarkPaid(id) {
    setInvoices(prev => prev.map(i => i.id===id ? {...i, status:"paid"} : i));
    try {
      const { data, error } = await markInvoicePaid(id);
      if (error) throw error;
      // FIX : on fusionne au lieu de remplacer. `data` ne contient pas les
      // jointures (client, job), donc l'ancien code effaçait le nom du client.
      setInvoices(prev => prev.map(i => i.id===id ? mergeInvoice(i, data) : i));
      toast.success(t("invoices.markedPaidToast"));
    } catch (err) {
      console.error("[InvoicesPage] mark paid error:", err);
      setInvoices(prev => prev.map(i => i.id===id ? {...i, status:"unpaid"} : i));
      toast.error(t("invoices.markPaidFailed") || "Failed to mark as paid. Please try again.");
    }
    setModal(null);
  }

  // ── Send email ─────────────────────────────────────
  function openSendConfirm(inv) {
    if (!inv.client?.email) {
      toast.error(t("invoices.noClientEmail") || "This client has no email address.");
      return;
    }
    setSendOptions({
      includeIban: profile?.show_iban_on_documents ?? true,
      includeStripeLink: profile?.show_stripe_link_on_documents ?? true,
    });
    setSendOptionsInv(inv);
  }

  async function handleSendEmail(inv) {
    if (!inv.client?.email) {
      toast.error(t("invoices.noClientEmail") || "This client has no email address.");
      return;
    }
    setBusy(true);
    try {
      const result = await sendInvoiceEmail(inv.id, false, sendOptions);
      if (result.success) {
        toast.success(t("invoices.emailedToast",{email:inv.client.email}));
      } else {
        console.error("[InvoicesPage] send email failed:", result.error);
        toast.error(t("invoices.emailFailedToast") || "Email failed to send.");
      }
    } catch (err) {
      console.error("[InvoicesPage] send email error:", err);
      toast.error(t("invoices.emailFailedToast") || "Email failed to send.");
    }
    setBusy(false);
    setSendOptionsInv(null);
  }

  // ── Stripe payment link ────────────────────────────
  async function handleStripeLink(inv) {
    setBusy(true);
    try {
      const token = await getToken();
      const result = await createPaymentLink(inv.id, token);
      if (!result) throw new Error("No result from Stripe");
      setInvoices(prev => prev.map(i =>
        i.id === inv.id ? { ...i, stripe_payment_link_url:result.url, stripe_payment_link_id:result.id } : i
      ));
      toast.success(t("invoices.paymentLinkCreated"));
    } catch (err) {
      console.error("[InvoicesPage] Stripe payment link error:", err);
      toast.error(t("invoices.paymentLinkFailed") || "Failed to create payment link. Check your Stripe connection.");
    }
    setBusy(false);
  }

  // ── Copy bank details ──────────────────────────────
  async function handleCopyBankDetails(inv) {
    const lines = [
      ...bankTextLines(),
      `${t("invoices.referenceLabel")} ${inv.invoice_number}`,
    ].filter(Boolean).join("\n");
    const ok = await copyToClipboard(lines);
    if (ok) toast.success(t("invoices.bankDetailsCopied"));
    else    toast.error(t("invoices.copyFailedManual") || "Could not copy. Please copy manually.");
  }

  // ── Delete ─────────────────────────────────────────
  async function handleDelete() {
    const prev = invoices.find(i => i.id===delId);
    if (!prev) { setDelId(null); setModal(null); return; }
    setInvoices(p => p.filter(i => i.id!==delId));
    setDelId(null);
    setModal(null);
    try {
      const { error } = await deleteInvoice(prev.id);
      if (error) throw error;
      toast.success(t("invoices.deletedToast"));
    } catch (err) {
      console.error("[InvoicesPage] delete invoice error:", err);
      setInvoices(p => [prev, ...p]);
      toast.error(t("invoices.deleteFailed") || "Failed to delete invoice.");
    }
  }

  const iStyle = {
    width:"100%", padding:"10px 12px", borderRadius:T.r.md,
    border:`1px solid ${T.borderMed}`, fontSize:14,
    background:T.surface, color:T.text,
    boxSizing:"border-box", fontFamily:"inherit",
  };

  return (
    <PageShell 
      title={t("nav.invoices")} 
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Compteur visible uniquement si la limite Free est active */}
          {showInvoiceCounter && (
            <span style={{ fontSize: 13, color: isInvoiceLimitReached ? T.amber : T.muted, fontWeight: 600 }}>
              {totalInvoicesCount}/{FREE_INVOICE_LIMIT} factures
            </span>
          )}
          <Btn size="sm" onClick={handleOpenCreateInvoice}>+ {t("invoices.newInvoice")}</Btn>
        </div>
      }
    >

      {/* ✅ Modale de limitation d'upgrade */}
      {showUpgradeModal && (
        <UpgradeModal 
          onClose={() => setShowUpgradeModal(false)} 
          onUpgrade={() => {
            setShowUpgradeModal(false);
            if (onUpgradeClick) onUpgradeClick();
          }} 
        />
      )}

      {/* Create modal */}
      {modal === "add" && (
        <Modal title={t("invoices.createInvoiceTitle")} onClose={() => setModal(null)}>
          <form onSubmit={saveInvoice}>
            <Field label={t("invoices.clientLabel")}>
              <select style={{ ...iStyle, borderColor:formErrors.client_id?"#EF4444":undefined }} value={form.client_id}
                onChange={e => { fld("client_id")(e); setForm(p=>({...p,client_id:e.target.value,job_id:""})); }}>
                <option value="">{t("invoices.selectClient")}</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <FieldError message={formErrors.client_id}/>
            </Field>
            <Field label={t("invoices.linkedJobLabel")}>
              <select style={iStyle} value={form.job_id}
                onChange={e => { const job=jobs.find(j=>j.id===e.target.value); setForm(p=>({...p,job_id:e.target.value,amount:job?.amount?String(job.amount):p.amount})); }}>
                <option value="">{t("invoices.noneOption")}</option>
                {jobs.filter(j=>j.client_id===form.client_id||j.client?.id===form.client_id).map(j =>
                  <option key={j.id} value={j.id}>{j.title} · {fmtDate(j.date)}</option>
                )}
              </select>
            </Field>
            <FieldRow>
              <Field label={t("invoices.amountLabel")} flex="1">
                <input type="number" style={{ ...iStyle, borderColor:formErrors.amount?"#EF4444":undefined }}
                  value={form.amount} onChange={fld("amount")} placeholder="0.00" min="0" step="0.01"/>
                <FieldError message={formErrors.amount}/>
              </Field>
              <Field label={t("invoices.dueDateLabel")} flex="1">
                <input type="date" style={iStyle} value={form.due_date} onChange={fld("due_date")}/>
              </Field>
            </FieldRow>
            <FormActions onCancel={() => setModal(null)} submitLabel={t("invoices.newInvoice")} loading={busy}/>
          </form>
        </Modal>
      )}

      {/* Invoice preview modal */}
      {previewInv && (
        <Modal title={previewInv.invoice_number} onClose={() => setModal(null)} width={560}>
          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            {previewInv.status==="unpaid" && <>
              <Btn size="sm" onClick={() => openSendConfirm(previewInv)} disabled={busy}>
                {busy ? t("invoices.sending") : t("invoices.sendEmail")}
              </Btn>
              {!previewInv.stripe_payment_link_url
                ? <Btn size="sm" variant="ghost" disabled title={t("payments.comingSoon")}>
                    {t("payments.comingSoon")}
                  </Btn>
                : <a href={previewInv.stripe_payment_link_url} target="_blank" rel="noopener noreferrer">
                    <Btn size="sm" variant="success">{t("invoices.openPaymentLink")} </Btn>
                  </a>
              }
              <Btn size="sm" variant="success" onClick={() => handleMarkPaid(previewInv.id)}>
                {t("invoices.markAsPaid")}
              </Btn>
              {hasBank && (
                <Btn size="sm" variant="ghost" onClick={() => handleCopyBankDetails(previewInv)}>
                  {t("invoices.copyBankDetails")}
                </Btn>
              )}
            </>}
            <Btn size="sm" variant="ghost" onClick={() => handleDownloadPdf(previewInv)}>
              {t("invoices.downloadPdf")}
            </Btn>
            <Btn size="sm" variant="danger" style={{marginLeft:"auto"}} onClick={() => setDelId(previewInv.id)}>
              {t("common.delete")}
            </Btn>
          </div>

          <div style={{border:`1px solid ${T.border}`,borderRadius:T.r.lg,padding:28}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:24}}>
              <div>
                <div style={{fontSize:26,fontWeight:900,color:T.brand,letterSpacing:-1.5}}>Vimen</div>
                <div style={{fontSize:13,color:T.muted}}>{profile.name} · {profile.trade}</div>
                <div style={{fontSize:12,color:T.muted}}>{profile.email}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:20,fontWeight:800}}>{previewInv.invoice_number}</div>
                <div style={{fontSize:12,color:T.muted}}>{t("invoices.issuedLabel")} {fmtDate(previewInv.created_at)}</div>
                {previewInv.due_date && <div style={{fontSize:12,color:T.muted}}>{t("invoices.dueLabel")} {fmtDate(previewInv.due_date)}</div>}
                <div style={{marginTop:6}}>
                  <Badge color={previewInv.status==="paid"?"green":"amber"}>
                    {previewInv.status==="paid" ? t("invoices.status.paid") : t("invoices.status.unpaid")}
                  </Badge>
                </div>
              </div>
            </div>

            <div style={{background:T.surface2,borderRadius:T.r.md,padding:"12px 16px",marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>{t("invoices.billTo")}</div>
              <div style={{fontWeight:700}}>{previewInv.client?.name}</div>
              <div style={{fontSize:13,color:T.muted}}>{previewInv.client?.email}</div>
              <div style={{fontSize:13,color:T.muted}}>{previewInv.client?.address}</div>
            </div>

            <table style={{width:"100%",borderCollapse:"collapse",marginBottom:16}}>
              <thead><tr>
                <th style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.5px",padding:"8px 0",borderBottom:`1px solid ${T.border}`,textAlign:"left"}}>{t("invoices.descriptionCol")}</th>
                <th style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.5px",padding:"8px 0",borderBottom:`1px solid ${T.border}`,textAlign:"right"}}>{t("invoices.amountCol")}</th>
              </tr></thead>
              <tbody><tr>
                <td style={{padding:"14px 0",borderBottom:`1px solid ${T.border}`,fontSize:14}}>{previewInv.job?.title||t("invoices.servicesRendered")}</td>
                <td style={{padding:"14px 0",borderBottom:`1px solid ${T.border}`,fontSize:14,fontWeight:700,textAlign:"right"}}>{fmt(previewInv.amount)}</td>
              </tr></tbody>
            </table>

            <div style={{display:"flex",justifyContent:"space-between",fontSize:20,fontWeight:800,paddingTop:14,borderTop:`2px solid ${T.text}`}}>
              <span>{t("invoices.totalDue")}</span>
              <span style={{color:previewInv.status==="paid"?T.green:T.brand}}>{fmt(previewInv.amount)}</span>
            </div>

            {previewInv.stripe_payment_link_url && (
              <div style={{marginTop:14,padding:"10px 14px",background:T.blueBg,borderRadius:T.r.md,fontSize:13,color:T.blue}}>
                {t("invoices.payOnline")}{" "}
                <a href={previewInv.stripe_payment_link_url} target="_blank" rel="noopener noreferrer" style={{color:T.blue,fontWeight:600}}>
                  {previewInv.stripe_payment_link_url}
                </a>
              </div>
            )}

            {hasBank && (
              <div style={{marginTop:14,padding:"12px 14px",background:T.greenBg,borderRadius:T.r.md,fontSize:13,color:T.green}}>
                <div style={{fontWeight:700,marginBottom:4}}>{t("invoices.bankTransferTitle")}</div>
                {bankTextLines().map(line => <div key={line}>{line}</div>)}
                <div style={{marginTop:2}}>{t("invoices.referenceLabel")} {previewInv.invoice_number}</div>
              </div>
            )}

            <div style={{marginTop:14,fontSize:12,color:T.muted,borderTop:`1px solid ${T.border}`,paddingTop:12}}>
              <div>{t("invoices.referenceLabel")} {previewInv.invoice_number} · {getPaymentTermsLabel(profile.payment_terms, t)}</div>
              {profile.invoice_notes && <div style={{marginTop:6}}>{profile.invoice_notes}</div>}
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {delId && (
        <ConfirmModal title={t("invoices.deleteConfirmTitle")} message={t("invoices.deleteConfirmMessage")}
          confirmLabel={t("common.delete")} onConfirm={handleDelete} onClose={() => setDelId(null)}/>
      )}

      {/* Send email confirm — choix IBAN / lien Stripe pour cet envoi */}
      {sendOptionsInv && (
        <Modal title={t("invoices.sendOptionsModal.title")} onClose={() => setSendOptionsInv(null)} width={440}>
          <p style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>
            {t("invoices.sendOptionsModal.intro", { email: sendOptionsInv.client?.email ?? "" })}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{t("invoices.sendOptionsModal.includeIban")}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{t("invoices.sendOptionsModal.includeIbanSub")}</div>
            </div>
            <Toggle on={sendOptions.includeIban} onChange={v => setSendOptions(p => ({ ...p, includeIban: v }))} />
          </div>
          <FormActions>
            <Btn variant="ghost" onClick={() => setSendOptionsInv(null)}>{t("common.cancel")}</Btn>
            <Btn onClick={() => handleSendEmail(sendOptionsInv)} disabled={busy}>
              {busy ? t("invoices.sending") : t("invoices.sendOptionsModal.confirmBtn")}
            </Btn>
          </FormActions>
        </Modal>
      )}

      {/* Metrics */}
      <div style={{display:"flex",gap:12,marginBottom:16}}>
        <MetricCard label={t("invoices.totalPaid")}       value={fmt(paid)}          sub={t("invoices.invoicesCount",{count:invoices.filter(i=>i.status==="paid").length})} accent/>
        <MetricCard label={t("invoices.outstandingLabel")} value={fmt(outstanding)}   sub={t("invoices.unpaidCount",{count:invoices.filter(i=>i.status==="unpaid").length})}/>
        <MetricCard label={t("invoices.totalInvoiced")}   value={fmt(paid+outstanding)} sub={t("invoices.allTime")}/>
      </div>

      {/* Filter tabs */}
      <Tabs tabs={[["all",t("invoices.tabAll")],["unpaid",t("invoices.tabUnpaid")],["paid",t("invoices.tabPaid")]]} active={filter} onChange={setFilter}/>

      {/* Load error */}
      {loadError && (
        <div style={{ background:"#FEF2F2", border:"1px solid #FCA5A5", borderRadius:T.r.lg, padding:"14px 20px", marginBottom:16 }}>
          <div style={{ fontWeight:700, color:"#DC2626", marginBottom:4 }}>{t("invoices.loadErrorTitle") || "Could not load invoices"}</div>
          <div style={{ fontSize:13, color:"#6B7280" }}>{loadError}</div>
          <Btn size="sm" variant="ghost" style={{ marginTop:10 }} onClick={load}>{t("common.retry") || "Try again"}</Btn>
        </div>
      )}

      {/* Table */}
      <Card style={{padding:0,overflow:"hidden"}}>
        {loading ? (
          <table style={{width:"100%",borderCollapse:"collapse"}}><tbody><InvoiceSkeleton/></tbody></table>
        ) : filtered.length === 0 ? (
          <Empty message={t("invoices.noneYet")} action={<Btn size="sm" onClick={handleOpenCreateInvoice}>+ {t("invoices.createFirst")}</Btn>}/>
        ) : (
          <Table headers={[t("invoices.colInvoice"),t("invoices.colClient"),t("invoices.colIssued"),t("invoices.colDue"),t("invoices.colAmount"),t("invoices.colStatus"),""]}>
            {filtered.map(inv => {
              const ov = isOverdue(inv);
              return (
                <tr key={inv.id}>
                  <TD style={{fontWeight:700,color:T.brand,cursor:"pointer"}} onClick={() => setModal(inv.id)}>{inv.invoice_number}</TD>
                  <TD>{inv.client?.name ?? ""}</TD>
                  <TD>{fmtDate(inv.created_at)}</TD>
                  <TD>{inv.due_date ? fmtDate(inv.due_date) : ""}</TD>
                  <TD style={{fontWeight:700}}>{fmt(inv.amount)}</TD>
                  <TD>
                    <Badge color={ov?"red":inv.status==="paid"?"green":"amber"}>
                      {ov ? t("invoices.status.overdue") : inv.status==="paid" ? t("invoices.status.paid") : t("invoices.status.unpaid")}
                    </Badge>
                  </TD>
                  <TD>
                    <div style={{display:"flex",gap:6}}>
                      <Btn size="sm" variant="ghost" onClick={() => setModal(inv.id)}>{t("invoices.viewButton")}</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => handleDownloadPdf(inv)}>{t("invoices.downloadPdf")}</Btn>
                      {inv.status==="unpaid" && (
                        <Btn size="sm" variant="success" onClick={() => handleMarkPaid(inv.id)}>{t("invoices.paidButton")}</Btn>
                      )}
                    </div>
                  </TD>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </PageShell>
  );
}