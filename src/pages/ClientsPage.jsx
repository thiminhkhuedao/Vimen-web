// src/pages/ClientsPage.jsx
import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { T } from "../styles/tokens";
import { getClients, getJobs, getInvoices, createClient, updateClient, deleteClient } from "../lib/db";
import { useTranslation } from "../i18n/index.js";
import {
  PageShell, Card, Btn, Badge, Avatar,
  Table, TD, Modal, ConfirmModal,
  Field, FieldRow, FormActions, SectionTitle, InfoRow, Empty,
  Skeleton, Spinner, ErrorBox
} from "../components/UI";
import { ErrorBoundary } from "../components/ErrorBoundary";
import UpgradeModal from "../components/UpgradeModal";
import { formatCurrency } from "../lib/currency.js";

const fmtDate = d => { 
  try { 
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); 
  } catch { 
    return d || "—"; 
  }
};

const iStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.15)", fontSize: 14,
  background: "#fff", color: "#131211",
  boxSizing: "border-box", fontFamily: "inherit",
};

const AV_COLORS = ["#E8500A", "#1A7F4B", "#7C3AED", "#0369A1", "#B45309", "#BE185D", "#0F766E", "#C2410C"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[0-9\s().-]{6,20}$/;

const isValidEmail = v => !v || EMAIL_RE.test(v.trim());
const isValidPhone = v => !v || PHONE_RE.test(v.trim());

const errInputStyle = { ...iStyle, border: "1px solid #DC2626" };
const errTextStyle = { fontSize: 12, color: "#DC2626", marginTop: 4 };

export default function ClientsPage({ profile, onUpgradeClick }) {
  const { t } = useTranslation();
  const fmt = n => formatCurrency(n, profile?.currency);

  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // null | "add" | "edit"
  const [delId, setDelId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({});
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const fld = k => e => {
    setForm(p => ({ ...p, [k]: e.target.value }));
    setFieldErrors(p => (p[k] ? { ...p, [k]: null } : p));
  };

  // TEMPORAIREMENT DÉSACTIVÉ — pas de moyen de passer Pro pour l'instant
  // (pas de Stripe/SIRET actif), donc cette limite bloquerait tout le
  // monde indéfiniment. Remettre `!isPro && clientsCount >= 5` pour la
  // réactiver une fois l'abonnement Pro de retour.
  const isPro = profile?.plan === "pro";
  const clientsCount = clients.length;
  const isClientLimitReached = false;

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: c, error: cErr }, { data: j, error: jErr }, { data: i, error: iErr }] = await Promise.all([
        getClients(profile.id),
        getJobs(profile.id),
        getInvoices(profile.id),
      ]);

      if (cErr || jErr || iErr) {
        throw new Error(cErr?.message || jErr?.message || iErr?.message || "Failed to load clients data");
      }

      setClients(c ?? []);
      setJobs(j ?? []);
      setInvoices(i ?? []);
    } catch (err) {
      console.error("[ClientsPage] load error:", err);
      setError({
        what: t("clients.loadErrorWhat", "Failed to load clients list"),
        why: t("clients.loadErrorWhy", "Could not fetch clients from the server."),
        nextAction: t("clients.loadErrorNext", "Please check your network connection and try again."),
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.id, t]);

  useEffect(() => { load(); }, [load]);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );
  const selClient = clients.find(c => c.id === selected);
  const clientJobs = selClient ? jobs.filter(j => (j.client_id ?? j.client?.id) === selected) : [];
  const clientInvoices = selClient ? invoices.filter(i => (i.client_id ?? i.client?.id) === selected) : [];
  const clientRevenue = clientInvoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);

  function handleOpenAddClient() {
    if (isClientLimitReached) {
      setShowUpgradeModal(true);
      return;
    }
    setForm({ name: "", email: "", phone: "", address: "", notes: "" });
    setFieldErrors({});
    setModal("add");
  }

  function openEdit(c) { 
    setForm({ ...c }); 
    setFieldErrors({});
    setModal("edit"); 
  }

  async function save(e) {
    e.preventDefault();
    if (!form.name) { 
      toast.error(t("clients.nameRequired")); 
      return; 
    }

    const errors = {};
    if (!isValidEmail(form.email)) {
      errors.email = t("clients.invalidEmail", "Please enter a valid email address");
    }
    if (!isValidPhone(form.phone)) {
      errors.phone = t("clients.invalidPhone", "Please enter a valid phone number");
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error(t("clients.fixFieldsError", "Please fix the highlighted fields"));
      return;
    }
    setFieldErrors({});

    setBusy(true);
    if (modal === "add") {
      const { data, error } = await createClient(profile.id, form);
      if (error) { 
        console.error("[ClientsPage] add client error:", error);
        toast.error(t("clients.addFailed")); 
        setBusy(false); 
        return; 
      }
      setClients(prev => [...prev, data]);
      toast.success(t("clients.addedToast"));
    } else {
      const { data, error } = await updateClient(form.id, {
        name: form.name, email: form.email, phone: form.phone,
        address: form.address, notes: form.notes,
      });
      if (error) { 
        console.error("[ClientsPage] update client error:", error);
        toast.error(t("clients.updateFailed")); 
        setBusy(false); 
        return; 
      }
      setClients(prev => prev.map(c => c.id === form.id ? data : c));
      toast.success(t("clients.updatedToast"));
    }
    setBusy(false);
    setModal(null);
  }

  async function handleDelete() {
    const { error } = await deleteClient(delId);
    if (error) { 
      console.error("[ClientsPage] delete client error:", error);
      toast.error(t("clients.deleteFailed")); 
      return; 
    }
    setClients(prev => prev.filter(c => c.id !== delId));
    if (selected === delId) setSelected(null);
    setDelId(null);
    toast.success(t("clients.deletedToast"));
  }

  return (
    <PageShell 
      title={t("nav.clients")} 
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Compteur "X/5 clients" caché en même temps que la limite —
              remettre `!isPro &&` pour le réafficher :
          {!isPro && (
            <span style={{ fontSize: 13, color: isClientLimitReached ? T.amber : T.muted, fontWeight: 600 }}>
              {clientsCount}/5 clients
            </span>
          )} */}
          <Btn size="sm" onClick={handleOpenAddClient}>+ {t("clients.addClient")}</Btn>
        </div>
      }
    >
      <ErrorBoundary>
        {/* Upgrade Modal */}
        {showUpgradeModal && (
          <UpgradeModal 
            onClose={() => setShowUpgradeModal(false)} 
            onUpgrade={() => {
              setShowUpgradeModal(false);
              if (onUpgradeClick) onUpgradeClick();
            }} 
          />
        )}

        {/* Add / Edit modal */}
        {(modal === "add" || modal === "edit") && (
          <Modal title={modal === "add" ? t("clients.addClient") : t("clients.editClient")} onClose={() => setModal(null)}>
            <form onSubmit={save}>
              <Field label={t("clients.fullNameCompany")}>
                <input style={iStyle} value={form.name || ""} onChange={fld("name")}
                  placeholder="Sarah Mitchell" autoFocus />
              </Field>
              <FieldRow>
                <Field label={t("clients.emailLabel")} flex="1">
                  <input type="email" style={fieldErrors.email ? errInputStyle : iStyle}
                    value={form.email || ""} onChange={fld("email")}
                    aria-invalid={!!fieldErrors.email} />
                  {fieldErrors.email && <div style={errTextStyle}>{fieldErrors.email}</div>}
                </Field>
                <Field label={t("clients.phoneLabel")} flex="1">
                  <input style={fieldErrors.phone ? errInputStyle : iStyle}
                    value={form.phone || ""} onChange={fld("phone")}
                    aria-invalid={!!fieldErrors.phone} />
                  {fieldErrors.phone && <div style={errTextStyle}>{fieldErrors.phone}</div>}
                </Field>
              </FieldRow>
              <Field label={t("clients.addressLabel")}>
                <input style={iStyle} value={form.address || ""} onChange={fld("address")} />
              </Field>
              <Field label={t("clients.notesLabel")}>
                <textarea style={{ ...iStyle, height: 60, resize: "vertical" }}
                  value={form.notes || ""} onChange={fld("notes")} />
              </Field>
              <FormActions onCancel={() => setModal(null)}
                submitLabel={busy ? <Spinner size={16} color="#FFF" /> : (modal === "add" ? t("clients.addClient") : t("common.saveChanges"))} loading={busy} />
            </form>
          </Modal>
        )}

        {/* Delete confirm */}
        {delId && (
          <ConfirmModal title={t("clients.deleteConfirmTitle")}
            message={t("clients.deleteConfirmMessage")}
            confirmLabel={t("clients.deleteClientButton")} onConfirm={handleDelete} onClose={() => setDelId(null)} />
        )}

        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 320px" : "1fr", gap: 16 }}>
          {/* Client list */}
          <div>
            <input style={{ ...iStyle, marginBottom: 14 }}
              placeholder={t("clients.searchPlaceholder")} value={search}
              onChange={e => setSearch(e.target.value)} />

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

            {!loading && !error && filtered.length === 0 && (
              <Card>
                <Empty icon="👥" message={t("clients.noneYet")}
                  action={<Btn size="sm" onClick={handleOpenAddClient}>+ {t("clients.addFirst")}</Btn>} />
              </Card>
            )}

            {!loading && !error && filtered.length > 0 && (
              <Card style={{ padding: 0, overflow: "hidden" }}>
                <Table headers={[t("clients.colClient"), t("clients.colContact"), t("clients.colJobs"), t("clients.colRevenue"), ""]}>
                  {filtered.map((c, idx) => {
                    const jobCount = jobs.filter(j => (j.client_id ?? j.client?.id) === c.id).length;
                    const revenue = invoices.filter(i => (i.client_id ?? i.client?.id) === c.id && i.status === "paid")
                                            .reduce((s, i) => s + Number(i.amount), 0);
                    return (
                      <tr key={c.id}
                        onClick={() => setSelected(c.id === selected ? null : c.id)}
                        style={{
                          cursor: "pointer",
                          background: c.id === selected ? T.brandLight : "transparent",
                          transition: "background 0.12s"
                        }}>
                        <TD>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: "50%",
                              background: AV_COLORS[idx % AV_COLORS.length], color: "#fff",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: 700, flexShrink: 0
                            }}>
                              {(c.name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                            </div>
                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                          </div>
                        </TD>
                        <TD>
                          <div style={{ fontSize: 13 }}>{c.email}</div>
                          <div style={{ fontSize: 12, color: T.muted }}>{c.phone}</div>
                        </TD>
                        <TD>{jobCount}</TD>
                        <TD style={{ fontWeight: 700 }}>{fmt(revenue)}</TD>
                        <TD>
                          <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                            <Btn size="sm" variant="ghost" onClick={() => openEdit(c)}>{t("common.edit")}</Btn>
                            <Btn size="sm" variant="danger" onClick={() => setDelId(c.id)}>✕</Btn>
                          </div>
                        </TD>
                      </tr>
                    );
                  })}
                </Table>
              </Card>
            )}
          </div>

          {/* Detail panel */}
          {selClient && (
            <div>
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                  <Avatar name={selClient.name} size={48} index={clients.indexOf(selClient)} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{selClient.name}</div>
                    <div style={{ fontSize: 13, color: T.muted }}>
                      {t("clients.jobsAndEarned", { count: clientJobs.length, earned: fmt(clientRevenue) })}
                    </div>
                  </div>
                </div>
                <InfoRow value={selClient.email} />
                <InfoRow value={selClient.phone} />
                <InfoRow value={selClient.address} />
                <InfoRow value={selClient.notes} />
                <div style={{ marginTop: 14 }}>
                  <Btn size="sm" variant="ghost" fullWidth onClick={() => openEdit(selClient)}>
                    {t("clients.editClient")}
                  </Btn>
                </div>
              </Card>

              <Card>
                <SectionTitle>{t("clients.jobHistory")}</SectionTitle>
                {clientJobs.length === 0
                  ? <div style={{ fontSize: 13, color: T.muted }}>{t("clients.noJobsYet")}</div>
                  : clientJobs.map(j => (
                      <div key={j.id} style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center", padding: "9px 0",
                        borderBottom: `1px solid ${T.border}`, fontSize: 13
                      }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{j.title}</div>
                          <div style={{ color: T.muted }}>{fmtDate(j.date)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {j.amount > 0 && <div style={{ fontWeight: 700 }}>{fmt(j.amount)}</div>}
                          <Badge color={j.status === "completed" ? "green" : "amber"}>{j.status}</Badge>
                        </div>
                      </div>
                    ))
                }
              </Card>

              <Card>
                <SectionTitle>{t("clients.invoicesTitle")}</SectionTitle>
                {clientInvoices.length === 0
                  ? <div style={{ fontSize: 13, color: T.muted }}>{t("clients.noInvoicesYet")}</div>
                  : clientInvoices.map(i => (
                      <div key={i.id} style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center", padding: "9px 0",
                        borderBottom: `1px solid ${T.border}`, fontSize: 13
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, color: T.brand }}>{i.invoice_number}</div>
                          <div style={{ color: T.muted }}>{fmtDate(i.created_at)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700 }}>{fmt(i.amount)}</div>
                          <Badge color={i.status === "paid" ? "green" : "amber"}>{i.status}</Badge>
                        </div>
                      </div>
                    ))
                }
              </Card>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </PageShell>
  );
}