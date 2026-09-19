// src/pages/JobsPage.jsx
import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { T } from "../styles/tokens";
import { getJobs, getClients, createJob, updateJob, completeJob, deleteJob, createInvoice } from "../lib/db";
import { sendInvoiceEmail } from "../lib/notifications";
import { supabase } from "../lib/supabase";
import { getTerms } from "../lib/professions.js";
import { useTranslation } from "../i18n/index.js";
import {
  PageShell, Card, Btn, Badge, Avatar,
  Table, TD, Modal, ConfirmModal,
  Field, FieldRow, FormActions, Tabs, Empty,
  Skeleton, Spinner, ErrorBox
} from "../components/UI";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { formatCurrency } from "../lib/currency.js";

const fmtDate = d => { 
  try { 
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); 
  } catch { 
    return d || "—"; 
  }
};
const today = () => new Date().toISOString().slice(0, 10);

const iStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.15)", fontSize: 14,
  background: "#fff", color: "#131211",
  boxSizing: "border-box", fontFamily: "inherit",
};

export default function JobsPage({ profile }) {
  const { t } = useTranslation();
  const fmt = n => formatCurrency(n, profile?.currency);
  const terms = getTerms(profile?.trade);
  
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("scheduled");
  const [modal, setModal] = useState(null);
  const [delId, setDelId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({});

  const fld = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: j, error: jErr }, { data: c, error: cErr }] = await Promise.all([
        getJobs(profile.id),
        getClients(profile.id),
      ]);

      if (jErr || cErr) {
        throw new Error(jErr?.message || cErr?.message || "Failed to load jobs data");
      }

      setJobs(j ?? []);
      setClients(c ?? []);
    } catch (err) {
      console.error("[JobsPage] load error:", err);
      setError({
        what: t("jobs.loadErrorWhat", "Failed to load jobs list"),
        why: t("jobs.loadErrorWhy", "Could not fetch data from the server."),
        nextAction: t("jobs.loadErrorNext", "Please check your connection and try again."),
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.id, t]);

  useEffect(() => { load(); }, [load]);

  const scheduled = jobs.filter(j => j.status === "scheduled").sort((a, b) => a.date?.localeCompare(b.date));
  const done = jobs.filter(j => j.status === "completed").sort((a, b) => b.date?.localeCompare(a.date));
  const current = tab === "scheduled" ? scheduled : done;

  function openAdd() {
    setForm({ 
      client_id: clients[0]?.id || "", title: "", date: today(),
      time: "09:00", duration: "2", amount: "", notes: "" 
    });
    setModal("add");
  }

  function openEdit(job) {
    setForm({ 
      ...job, 
      client_id: job.client_id ?? job.client?.id ?? "",
      duration: String(job.duration), 
      amount: String(job.amount) 
    });
    setModal("edit");
  }

  async function save(e) {
    e.preventDefault();
    if (!form.title || !form.date || !form.client_id) {
      toast.error(t("jobs.errorRequired")); 
      return;
    }
    setBusy(true);
    const payload = {
      client_id: form.client_id,
      title: form.title,
      date: form.date,
      time: form.time,
      duration: parseFloat(form.duration) || 1,
      amount: parseFloat(form.amount) || 0,
      notes: form.notes,
      status: "scheduled",
    };

    if (modal === "add") {
      const { data, error } = await createJob(profile.id, payload);
      if (error) { 
        toast.error(t("jobs.errorAdd")); 
        setBusy(false); 
        return; 
      }
      setJobs(prev => [data, ...prev]);
      toast.success(t("jobs.successAdd"));
    } else {
      const { data, error } = await updateJob(form.id, payload);
      if (error) { 
        toast.error(t("jobs.errorUpdate")); 
        setBusy(false); 
        return; 
      }
      setJobs(prev => prev.map(j => j.id === form.id ? data : j));
      toast.success(t("jobs.successUpdate"));
    }
    setBusy(false);
    setModal(null);
  }

  async function handleComplete(id) {
    const { data, error } = await completeJob(id);
    if (error) { 
      toast.error(t("jobs.errorComplete")); 
      return; 
    }
    setJobs(prev => prev.map(j => j.id === id ? data : j));
    toast.success(t("jobs.successComplete"));
    
    const job = jobs.find(j => j.id === id);
    const client = clients.find(c => c.id === (job?.client_id ?? job?.client?.id));

    // Job terminé → facture créée et envoyée automatiquement, sauf s'il en
    // existe déjà une pour ce job (évite les doublons).
    await autoCreateAndSendInvoice(data ?? job, client);

    // Demande d'avis envoyée automatiquement par email au client, s'il a
    // une adresse enregistrée.
    await autoSendReviewRequest(data ?? job, client);
  }

  async function autoSendReviewRequest(job, client) {
    if (!job || !client?.email) return;
    try {
      const googleUrl = profile?.extra_fields?.google_place_id
        ? `https://g.page/r/${profile.extra_fields.google_place_id}/review`
        : `https://www.google.com/search?q=${encodeURIComponent((profile?.name || "") + " " + (profile?.trade || ""))}`;

      await supabase.functions.invoke("send-review-request", {
        body: {
          toEmail: client.email,
          clientName: client.name,
          profileName: profile?.name,
          jobTitle: job?.title,
          googleUrl,
        },
      });
    } catch (err) {
      // Non-bloquant : on ne perturbe pas le flux si l'email d'avis échoue.
      console.warn("[Auto review request failed]:", err);
    }
  }

  async function autoCreateAndSendInvoice(job, client) {
    if (!job) return;
    try {
      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("job_id", job.id)
        .maybeSingle();
      if (existing) return; // déjà facturé, on ne duplique pas

      const { data: invoice, error: invErr } = await createInvoice(profile.id, {
        client_id: job.client_id ?? job.client?.id,
        job_id: job.id,
        amount: parseFloat(job.amount) || 0,
        due_date: null,
        status: "unpaid",
      });
      if (invErr) throw invErr;

      toast.success(t("jobs.invoiceAutoCreatedToast") || "Invoice created automatically");

      // Premier envoi automatique au client, s'il a une adresse email
      if (client?.email && invoice) {
        const result = await sendInvoiceEmail(invoice.id);
        if (result.success) {
          await supabase
            .from("invoices")
            .update({ reminder_count: 1, last_reminder_sent_at: new Date().toISOString() })
            .eq("id", invoice.id);
        }
      }
    } catch (err) {
      console.error("[Auto invoice creation failed]:", err);
      toast.error(t("jobs.invoiceAutoCreateFailedToast") || "Job completed, but the invoice could not be created automatically — add it manually.");
    }
  }

  async function handleDelete() {
    const { error } = await deleteJob(delId);
    if (error) { 
      toast.error(t("jobs.errorDelete")); 
      return; 
    }
    setJobs(prev => prev.filter(j => j.id !== delId));
    setDelId(null);
    toast.success(t("jobs.successDelete"));
  }

  const getClient = j => clients.find(c => c.id === (j.client_id ?? j.client?.id)) ?? j.client;

  return (
    <PageShell 
      title={terms.bookingPlural} 
      action={
        <Btn size="sm" onClick={openAdd}>
          + {t("common.new")} {terms.booking.toLowerCase()}
        </Btn>
      }
    >
      <ErrorBoundary>
        {(modal === "add" || modal === "edit") && (
          <Modal
            title={modal === "add"
              ? `${t("common.add")} ${terms.booking.toLowerCase()}`
              : `${t("common.edit")} ${terms.booking.toLowerCase()}`}
            onClose={() => setModal(null)}
          >
            <form onSubmit={save}>
              <Field label={t("jobs.client")}>
                <select style={iStyle} value={form.client_id} onChange={fld("client_id")}>
                  <option value="">{t("jobs.selectClient")}</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label={`${terms.booking} ${t("jobs.titleLabel")}`}>
                <input 
                  style={iStyle} 
                  value={form.title || ""} 
                  onChange={fld("title")}
                  placeholder="e.g. Consumer unit replacement" 
                  autoFocus
                />
              </Field>
              <FieldRow>
                <Field label={t("jobs.date")} flex="1">
                  <input type="date" style={iStyle} value={form.date || ""} onChange={fld("date")}/>
                </Field>
                <Field label={t("jobs.startTime")} flex="1">
                  <input type="time" style={iStyle} value={form.time || ""} onChange={fld("time")}/>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label={t("jobs.duration")} flex="1">
                  <input 
                    type="number" 
                    style={iStyle} 
                    value={form.duration || ""}
                    onChange={fld("duration")} 
                    min="0.5" 
                    step="0.5"
                  />
                </Field>
                <Field label={t("jobs.amount")} flex="1">
                  <input 
                    type="number" 
                    style={iStyle} 
                    value={form.amount || ""}
                    onChange={fld("amount")} 
                    placeholder="0.00" 
                    min="0" 
                    step="0.01"
                  />
                </Field>
              </FieldRow>
              <Field label={t("jobs.notes")}>
                <textarea 
                  style={{ ...iStyle, height: 72, resize: "vertical" }}
                  value={form.notes || ""} 
                  onChange={fld("notes")} 
                  placeholder={t("jobs.notesPlaceholder")}
                />
              </Field>
              <FormActions 
                onCancel={() => setModal(null)}
                submitLabel={busy ? <Spinner size={16} color="#FFF" /> : (
                  modal === "add"
                    ? `${t("common.add")} ${terms.booking.toLowerCase()}`
                    : t("common.save")
                )}
                loading={busy}
              />
            </form>
          </Modal>
        )}

        {delId && (
          <ConfirmModal
            title={`${t("common.delete")} ${terms.booking.toLowerCase()}?`}
            message={t("jobs.deleteWarning")}
            confirmLabel={`${t("common.delete")} ${terms.booking.toLowerCase()}`}
            onConfirm={handleDelete}
            onClose={() => setDelId(null)}
          />
        )}

        <Tabs
          tabs={[
            ["scheduled", t("jobs.scheduled", { count: scheduled.length }), scheduled.length],
            ["completed", t("jobs.completed", { count: done.length }), done.length],
          ]}
          active={tab} 
          onChange={setTab}
        />

        {loading && (
          <Card style={{ padding: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </div>
          </Card>
        )}

        {!loading && error && (
          <ErrorBox
            what={error.what}
            why={error.why}
            nextAction={error.nextAction}
            onRetry={load}
          />
        )}

        {!loading && !error && current.length === 0 && (
          <Card>
            <Empty
              icon="📅"
              message={tab === "scheduled" ? t("jobs.noUpcoming") : t("jobs.noCompleted")}
              action={tab === "scheduled" && <Btn size="sm" onClick={openAdd}>{t("jobs.addFirst")}</Btn>}
            />
          </Card>
        )}

        {!loading && !error && current.length > 0 && (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <Table headers={[
              t("jobs.date"), t("jobs.client"), terms.booking,
              t("jobs.durationShort"), t("jobs.amountShort"), "Status", ""
            ]}>
              {current.map(j => {
                const cl = getClient(j);
                return (
                  <tr key={j.id}>
                    <TD>
                      <div style={{ fontWeight: 600 }}>{fmtDate(j.date)}</div>
                      <div style={{ fontSize: 12, color: T.muted }}>{j.time}</div>
                    </TD>
                    <TD>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar name={cl?.name || "?"} size={28} />
                        <span style={{ fontWeight: 500 }}>{cl?.name || "—"}</span>
                      </div>
                    </TD>
                    <TD>
                      <div style={{ fontWeight: 500 }}>{j.title}</div>
                      {j.notes && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{j.notes}</div>}
                    </TD>
                    <TD>{j.duration}h</TD>
                    <TD style={{ fontWeight: 700 }}>
                      {j.amount > 0 ? fmt(j.amount) : <span style={{ color: T.hint }}>—</span>}
                    </TD>
                    <TD>
                      <Badge color={j.status === "scheduled" ? "amber" : "green"}>
                        {t(`jobs.status.${j.status}`)}
                      </Badge>
                    </TD>
                    <TD>
                      <div style={{ display: "flex", gap: 6 }}>
                        {j.status === "scheduled" && (
                          <Btn size="sm" variant="success" onClick={() => handleComplete(j.id)}>
                            {t("jobs.markDone")}
                          </Btn>
                        )}
                        <Btn size="sm" variant="ghost" onClick={() => openEdit(j)}>{t("common.edit")}</Btn>
                        <Btn size="sm" variant="danger" onClick={() => setDelId(j.id)}>✕</Btn>
                      </div>
                    </TD>
                  </tr>
                );
              })}
            </Table>
          </Card>
        )}
      </ErrorBoundary>
    </PageShell>
  );
}