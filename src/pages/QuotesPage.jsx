// src/pages/QuotesPage.jsx

import { useState, useEffect } from "react";
import { useTranslation } from "../i18n/index.js";
import { toast } from "react-hot-toast";
import { T } from "../styles/tokens";
import { uid, today } from "../lib/state";
import {
  PageShell, Card, Btn, Badge, Table, TD,
  Modal, ConfirmModal, Field, FieldRow,
  FormActions, Tabs, Empty,
} from "../components/UI";
import { formatCurrency } from "../lib/currency.js";

// 1. IMPORT DES FONCTIONS BDD
import { 
  createQuote, 
  updateQuote, 
  deleteQuote, 
  createJob 
} from "../lib/db.js";
import { sendQuoteEmail } from "../lib/notifications.js";

const fmtDate = d => { try { return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); } catch { return "—"; }};
const iStyle  = { width:"100%",padding:"10px 12px",borderRadius:T.r.md,border:`1px solid ${T.borderMed}`,fontSize:14,background:T.surface,color:T.text,boxSizing:"border-box",fontFamily:"inherit" };

const STATUS_COLOR = { draft:"gray", sent:"blue", viewed:"amber", accepted:"green", declined:"red", converted:"green" };
const LINE_TYPES   = ["labour","material","other"];

function calcTotals(lineItems, vatRate=0) {
  const subtotal   = lineItems.reduce((s,l) => s + (Number(l.quantity||0)*Number(l.unit_price||0)), 0);
  const vat_amount = Math.round(subtotal * (vatRate/100) * 100)/100;
  const total      = subtotal + vat_amount;
  const matCost    = lineItems.filter(l=>l.type==="material").reduce((s,l)=>s+(Number(l.quantity||0)*Number(l.unit_price||0)),0);
  const margin_pct = total > 0 ? Math.round(((total-matCost)/total)*100) : 0;
  return { subtotal: Math.round(subtotal*100)/100, vat_amount, total: Math.round(total*100)/100, margin_pct };
}

export default function QuotesPage({ state, dispatch, profile, refresh, isLoading = false, error = null, onRetry }) {
  const { t: tr } = useTranslation();
  const fmt = n => formatCurrency(n, profile?.currency);
  
  // Utilisation directe des devis depuis le state global de Supabase
  const quotesList = state?.quotes ?? [];

  const [tab,      setTab]      = useState("active");
  const [modal,    setModal]    = useState(null); 
  const [delId,    setDelId]    = useState(null);
  const [form,     setForm]     = useState({});
  const [lines,    setLines]    = useState([]);
  const [signName, setSignName] = useState("");
  const [busy,     setBusy]     = useState(false);
  const fld = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const clients  = state?.clients ?? [];
  const active   = quotesList.filter(q=>["draft","sent","viewed","accepted"].includes(q.status));
  const archived = quotesList.filter(q=>["declined","converted"].includes(q.status));
  const current  = tab==="active" ? active : archived;

  function addLine() {
    setLines(prev=>[...prev,{id:uid(),description:"",type:"labour",quantity:"1",unit_price:"",total:0}]);
  }
  function removeLine(id) { setLines(prev=>prev.filter(l=>l.id!==id)); }
  function updateLine(id,key,val) {
    setLines(prev=>prev.map(l=>{
      if(l.id!==id) return l;
      const updated = {...l,[key]:val};
      updated.total = Math.round(Number(updated.quantity||0)*Number(updated.unit_price||0)*100)/100;
      return updated;
    }));
  }

  function openAdd() {
    setForm({ client_id:clients[0]?.id||"", title:"", notes:"", valid_until:"", vat_rate:"0" });
    setLines([{id:uid(),description:"",type:"labour",quantity:"1",unit_price:"",total:0}]);
    setModal("add");
  }
  function openEdit(q) {
    setForm({ id:q.id, client_id:q.client_id, title:q.title, notes:q.notes||"", valid_until:q.valid_until||"", vat_rate:String(q.vat_rate||0), status:q.status });
    setLines((q.line_items||[]).map(l=>({...l,id:uid(),quantity:String(l.quantity),unit_price:String(l.unit_price)})));
    setModal("edit");
  }
  function openPreview(q) { setForm(q); setModal("preview"); }

  // 2. ENREGISTREMENT ET MODIFICATION DANS SUPABASE
  async function save() {
    if (!form.title || !form.client_id) { toast.error(tr("quotes.toast.titleClientRequired")); return; }
    setBusy(true);
    try {
      const vatRateNum = Number(form.vat_rate || 0);
      const totals = calcTotals(lines, vatRateNum);
      const line_items = lines.map(l => ({
        description: l.description,
        type: l.type,
        quantity: Number(l.quantity || 0),
        unit_price: Number(l.unit_price || 0),
        total: l.total
      }));

      if (modal === "add") {
        const payload = {
          ...form,
          ...totals,
          vat_rate: vatRateNum,
          line_items,
          status: "draft",
          signed_at: null,
          job_id: null,
        };
        
        const { error } = await createQuote(profile.id, payload);
        if (error) throw error;
        toast.success(tr("quotes.toast.quoteCreated"));
      } else {
        const payload = {
          client_id: form.client_id,
          title: form.title,
          notes: form.notes,
          valid_until: form.valid_until,
          vat_rate: vatRateNum,
          ...totals,
          line_items,
        };
        
        const { error } = await updateQuote(form.id, payload);
        if (error) throw error;
        toast.success(tr("quotes.toast.quoteUpdated"));
      }
      
      if (refresh) await refresh(); // Rechargement des données fraîches
      setModal(null);
    } catch (err) {
      console.error("[QuotesPage] save error:", err);
      toast.error(tr("quotes.toast.errorSaving"));
    } finally {
      setBusy(false);
    }
  }

  // 3. MISE À JOUR DE LESTATUT
  async function markSent(id) {
    setBusy(true);
    try {
      const { error } = await updateQuote(id, { status: "sent" });
      if (error) throw error;
      if (refresh) await refresh();
      toast.success(tr("quotes.toast.markedAsSent"));
    } catch (err) {
      console.error("[QuotesPage] mark sent error:", err);
      toast.error(tr("quotes.toast.errorUpdating"));
    } finally {
      setBusy(false);
    }
  }

  // 3.5 ENVOI PAR EMAIL AU CLIENT (avec lien de consultation/signature)
  async function handleSendEmail(q) {
    const client = getClient(q.client_id);
    if (!client?.email) {
      toast.error(tr("quotes.toast.clientNoEmail") || "Ce client n'a pas d'adresse email renseignée");
      return;
    }
    setBusy(true);
    try {
      const result = await sendQuoteEmail(q.id);
      if (!result.success) throw new Error(result.error);

      const { error } = await updateQuote(q.id, { status: "sent" });
      if (error) throw error;

      if (refresh) await refresh();
      toast.success(tr("quotes.toast.quoteEmailSent", { name: client.name }) || `Devis envoyé à ${client.name}`);
    } catch (err) {
      console.error("[QuotesPage] send email error:", err);
      toast.error(tr("quotes.toast.errorSendingEmail") || "Échec de l'envoi, réessaie");
    } finally {
      setBusy(false);
    }
  }


  async function handleSign() {
    if (!signName.trim()) { toast.error(tr("quotes.toast.enterClientName")); return; }
    setBusy(true);
    try {
      const updateData = { status: "accepted", signed_at: new Date().toISOString(), signed_by: signName };
      const { error } = await updateQuote(form.id, updateData);
      if (error) throw error;
      if (refresh) await refresh();
      setModal(null);
      toast.success(tr("quotes.toast.quoteSignedBy", { name: signName }));
    } catch (err) {
      console.error("[QuotesPage] sign error:", err);
      toast.error(tr("quotes.toast.errorSigning"));
    } finally {
      setBusy(false);
    }
  }

  // 5. CONVERSION EN CHANTIER (JOB)
  async function convertToJob(q) {
    setBusy(true);
    try {
      // 1. Créer le job
      const { data: newJob, error: jobErr } = await createJob(profile.id, {
        client_id: q.client_id,
        title: q.title,
        date: today(),
        time: "09:00",
        duration: 4,
        status: "scheduled",
        notes: `From quote ${q.quote_number}`,
        amount: q.total
      });
      if (jobErr) throw jobErr;

      // 2. Mettre à jour le devis en "converted" avec la référence du job
      const { error: quoteErr } = await updateQuote(q.id, { status: "converted", job_id: newJob.id });
      if (quoteErr) throw quoteErr;

      if (refresh) await refresh();
      toast.success(tr("quotes.toast.convertedToJob"));
    } catch (err) {
      console.error("[QuotesPage] convert to job error:", err);
      toast.error(tr("quotes.toast.errorConverting"));
    } finally {
      setBusy(false);
    }
  }

  // 6. SUPPRESSION
  async function handleDelete() {
    if (!delId) return;
    setBusy(true);
    try {
      const { error } = await deleteQuote(delId);
      if (error) throw error;
      if (refresh) await refresh();
      setDelId(null);
      toast.success(tr("quotes.toast.quoteDeleted"));
    } catch (err) {
      console.error("[QuotesPage] delete error:", err);
      toast.error(tr("quotes.toast.errorDeleting"));
    } finally {
      setBusy(false);
    }
  }

  const getClient = id => clients.find(c=>c.id===id);
  const previewQ  = modal==="preview"||modal==="sign" ? form : null;

  return (
    <PageShell title={tr("quotes.title")} action={<Btn size="sm" onClick={openAdd} disabled={isLoading || busy}>{tr("quotes.newQuoteBtn")}</Btn>}>

      {error && (
        <div style={{ background: T.redBg || "#fee2e2", border: `1px solid ${T.red || "#ef4444"}`, borderRadius: T.r.md, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: T.red || "#dc2626", fontSize: 14 }}>
            <strong>{tr("common.error")}:</strong> {typeof error === "string" ? error : tr("quotes.errorLoading")}
          </div>
          {onRetry && (
            <Btn size="sm" variant="danger" onClick={onRetry} disabled={busy}>
              {tr("common.retry")}
            </Btn>
          )}
        </div>
      )}

      {(modal==="add"||modal==="edit") && (
        <Modal title={modal==="add"?tr("quotes.modal.newTitle"):tr("quotes.modal.editTitle")} onClose={()=>!busy && setModal(null)} width={620}>
          <div style={{ maxHeight: "calc(85vh - 120px)", overflowY: "auto", paddingRight: 6 }}>
            <form onSubmit={e=>{e.preventDefault();save();}}>
              <FieldRow>
                <Field label={tr("quotes.fields.client")} flex="1">
                  <select style={iStyle} value={form.client_id} onChange={fld("client_id")} disabled={busy}>
                    {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label={tr("quotes.fields.validUntil")} flex="1">
                  <input type="date" style={iStyle} value={form.valid_until} onChange={fld("valid_until")} disabled={busy}/>
                </Field>
              </FieldRow>
              <Field label={tr("quotes.fields.quoteTitle")}>
                <input style={iStyle} value={form.title} onChange={fld("title")} placeholder={tr("quotes.fields.quoteTitlePlaceholder")} autoFocus disabled={busy}/>
              </Field>

              <div style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <label style={{ fontSize:13, fontWeight:500, color:T.muted }}>{tr("quotes.lineItems.label")}</label>
                  <Btn size="sm" variant="ghost" onClick={addLine} disabled={busy}>{tr("quotes.lineItems.addLine")}</Btn>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"2fr 80px 1fr 90px 32px", gap:6, marginBottom:6 }}>
                  {[
                    tr("quotes.lineItems.headers.description"),
                    tr("quotes.lineItems.headers.type"),
                    tr("quotes.lineItems.headers.qtyPrice"),
                    tr("quotes.lineItems.headers.total"),
                    "",
                  ].map(h=>(
                    <div key={h} style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.5px" }}>{h}</div>
                  ))}
                </div>

                {lines.map(l=>(
                  <div key={l.id} style={{ display:"grid", gridTemplateColumns:"2fr 80px 1fr 90px 32px", gap:6, marginBottom:6, alignItems:"center" }}>
                    <input style={{...iStyle,padding:"7px 10px"}} value={l.description} onChange={e=>updateLine(l.id,"description",e.target.value)} placeholder={tr("quotes.lineItems.descriptionPlaceholder")} disabled={busy}/>
                    <select style={{...iStyle,padding:"7px 8px"}} value={l.type} onChange={e=>updateLine(l.id,"type",e.target.value)} disabled={busy}>
                      {LINE_TYPES.map(t=><option key={t} value={t}>{tr(`quotes.lineTypes.${t}`)}</option>)}
                    </select>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
                      <input type="number" style={{...iStyle,padding:"7px 8px"}} value={l.quantity} onChange={e=>updateLine(l.id,"quantity",e.target.value)} placeholder={tr("quotes.lineItems.qtyPlaceholder")} min="0" step="0.5" disabled={busy}/>
                      <input type="number" style={{...iStyle,padding:"7px 8px"}} value={l.unit_price} onChange={e=>updateLine(l.id,"unit_price",e.target.value)} placeholder={tr("quotes.lineItems.unitPricePlaceholder")} min="0" disabled={busy}/>
                    </div>
                    <div style={{ fontSize:14, fontWeight:600, textAlign:"right" }}>{fmt(l.total)}</div>
                    <button type="button" onClick={()=>removeLine(l.id)} disabled={busy} style={{ background:"none", border:"none", cursor:busy?"not-allowed":"pointer", color:T.hint, fontSize:18, lineHeight:1 }}>×</button>
                  </div>
                ))}

                {lines.length>0 && (
                  <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:10, marginTop:6 }}>
                    {(() => {
                      const t = calcTotals(lines, Number(form.vat_rate||0));
                      return (
                        <>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                            <span style={{ color:T.muted }}>{tr("quotes.totals.subtotal")}</span><span style={{ fontWeight:600 }}>{fmt(t.subtotal)}</span>
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:8 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <span style={{ color:T.muted }}>{tr("quotes.totals.vat")}</span>
                              <input type="number" style={{...iStyle,width:56,padding:"3px 8px",fontSize:13}} value={form.vat_rate} onChange={fld("vat_rate")} min="0" max="100" disabled={busy}/>
                              <span style={{ color:T.muted, fontSize:12 }}>%</span>
                            </div>
                            <span style={{ fontWeight:600 }}>{fmt(t.vat_amount)}</span>
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:16, fontWeight:800, borderTop:`1px solid ${T.border}`, paddingTop:8 }}>
                            <span>{tr("quotes.totals.total")}</span><span style={{ color:T.brand }}>{fmt(t.total)}</span>
                          </div>
                          <div style={{ fontSize:12, color:T.muted, marginTop:4 }}>
                            {tr("quotes.totals.estMargin")} <strong style={{ color:t.margin_pct>20?T.green:T.amber }}>{t.margin_pct}%</strong>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              <Field label={tr("quotes.fields.notesForClient")}>
                <textarea style={{...iStyle,height:60,resize:"vertical"}} value={form.notes} onChange={fld("notes")} placeholder={tr("quotes.fields.notesPlaceholder")} disabled={busy}/>
              </Field>
              <FormActions onCancel={()=>setModal(null)} submitLabel={busy ? tr("common.saving") : (modal==="add"?tr("quotes.actions.createQuote"):tr("quotes.actions.saveChanges"))} disabled={busy}/>
            </form>
          </div>
        </Modal>
      )}

      {(modal==="preview"||modal==="sign") && previewQ && (() => {
        const cl = getClient(previewQ.client_id);
        return (
          <Modal title={previewQ.quote_number} onClose={()=>!busy && setModal(null)} width={580}>
            <div style={{ maxHeight: "calc(85vh - 80px)", overflowY: "auto", paddingRight: 6 }}>
              <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
                {previewQ.status==="draft" && <Btn size="sm" disabled={busy} onClick={()=>{ markSent(previewQ.id); setModal(null); }}> {tr("quotes.preview.markAsSent")}</Btn>}
                {["draft","sent","viewed"].includes(previewQ.status) && getClient(previewQ.client_id)?.email && (
                  <Btn size="sm" variant="ghost" disabled={busy} onClick={()=>handleSendEmail(previewQ)}>
                    {tr("quotes.preview.sendEmail") || "Envoyer par email"}
                  </Btn>
                )}
                {["draft","sent","viewed"].includes(previewQ.status) && <Btn size="sm" variant="success" disabled={busy} onClick={()=>{ setSignName(""); setModal("sign"); }}> {tr("quotes.preview.clientSign")}</Btn>}
                {previewQ.status==="accepted" && !previewQ.job_id && <Btn size="sm" disabled={busy} onClick={()=>{ convertToJob(previewQ); setModal(null); }}>{tr("quotes.preview.convertToJob")}</Btn>}
              </div>

              {modal==="sign" && (
                <div style={{ background:T.brandLight, borderRadius:T.r.md, padding:"14px 16px", marginBottom:16 }}>
                  <div style={{ fontWeight:700, marginBottom:8 }}>{tr("quotes.preview.signature.title")}</div>
                  <Field label={tr("quotes.preview.signature.fullNameLabel")}>
                    <input style={iStyle} value={signName} onChange={e=>setSignName(e.target.value)} placeholder="Sarah Mitchell" autoFocus disabled={busy}/>
                  </Field>
                  <p style={{ fontSize:12, color:T.muted, marginBottom:10 }}>{tr("quotes.preview.signature.confirmText")}</p>
                  <Btn onClick={handleSign} disabled={busy}> {busy ? tr("common.signing") : tr("quotes.preview.signature.signBtn")}</Btn>
                </div>
              )}

              <div style={{ border:`1px solid ${T.border}`, borderRadius:T.r.lg, padding:24 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
                  <div>
                    <div style={{ fontSize:24, fontWeight:900, color:T.brand, letterSpacing:-1 }}>Vimen</div>
                    <div style={{ fontSize:13, color:T.muted }}>{profile?.name} · {profile?.trade}</div>
                    <div style={{ fontSize:12, color:T.muted }}>{profile?.email}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:18, fontWeight:800 }}>{previewQ.quote_number}</div>
                    <div style={{ fontSize:12, color:T.muted }}>{tr("quotes.preview.issued", { date: fmtDate(previewQ.created_at) })}</div>
                    {previewQ.valid_until && <div style={{ fontSize:12, color:T.muted }}>{tr("quotes.preview.validUntil", { date: fmtDate(previewQ.valid_until) })}</div>}
                    <div style={{ marginTop:4 }}><Badge color={STATUS_COLOR[previewQ.status]||"gray"}>{tr(`quotes.status.${previewQ.status}`)}</Badge></div>
                  </div>
                </div>

                <div style={{ background:T.surface2, borderRadius:T.r.md, padding:"12px 16px", marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>{tr("quotes.preview.preparedFor")}</div>
                  <div style={{ fontWeight:700 }}>{cl?.name}</div>
                  <div style={{ fontSize:13, color:T.muted }}>{cl?.email} · {cl?.address}</div>
                </div>

                <div style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>{previewQ.title}</div>

                <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:16 }}>
                  <thead><tr>
                    <th style={{ textAlign:"left", fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", padding:"6px 0", borderBottom:`1px solid ${T.border}` }}>{tr("quotes.preview.table.description")}</th>
                    <th style={{ textAlign:"center", fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", padding:"6px 0", borderBottom:`1px solid ${T.border}` }}>{tr("quotes.preview.table.type")}</th>
                    <th style={{ textAlign:"right", fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", padding:"6px 0", borderBottom:`1px solid ${T.border}` }}>{tr("quotes.preview.table.qty")}</th>
                    <th style={{ textAlign:"right", fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", padding:"6px 0", borderBottom:`1px solid ${T.border}` }}>{tr("quotes.preview.table.unit")}</th>
                    <th style={{ textAlign:"right", fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", padding:"6px 0", borderBottom:`1px solid ${T.border}` }}>{tr("quotes.preview.table.total")}</th>
                  </tr></thead>
                  <tbody>
                    {(previewQ.line_items||[]).map((l,i)=>(
                      <tr key={i}>
                        <td style={{ padding:"10px 0", borderBottom:`1px solid ${T.border}`, fontSize:14 }}>{l.description}</td>
                        <td style={{ padding:"10px 0", borderBottom:`1px solid ${T.border}`, textAlign:"center" }}><Badge color={l.type==="labour"?"amber":l.type==="material"?"blue":"gray"}>{tr(`quotes.lineTypes.${l.type}`)}</Badge></td>
                        <td style={{ padding:"10px 0", borderBottom:`1px solid ${T.border}`, textAlign:"right", fontSize:14, color:T.muted }}>{l.quantity}</td>
                        <td style={{ padding:"10px 0", borderBottom:`1px solid ${T.border}`, textAlign:"right", fontSize:14, color:T.muted }}>{fmt(l.unit_price)}</td>
                        <td style={{ padding:"10px 0", borderBottom:`1px solid ${T.border}`, textAlign:"right", fontSize:14, fontWeight:600 }}>{fmt(l.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, marginBottom:16 }}>
                  <div style={{ display:"flex", gap:24, fontSize:14 }}><span style={{ color:T.muted }}>{tr("quotes.totals.subtotal")}</span><span style={{ fontWeight:600 }}>{fmt(previewQ.subtotal)}</span></div>
                  {previewQ.vat_rate>0 && <div style={{ display:"flex", gap:24, fontSize:14 }}><span style={{ color:T.muted }}>{tr("quotes.preview.vatLine", { rate: previewQ.vat_rate })}</span><span style={{ fontWeight:600 }}>{fmt(previewQ.vat_amount)}</span></div>}
                  <div style={{ display:"flex", gap:24, fontSize:18, fontWeight:800, borderTop:`2px solid ${T.text}`, paddingTop:8 }}><span>{tr("quotes.totals.total")}</span><span style={{ color:T.brand }}>{fmt(previewQ.total)}</span></div>
                </div>

                {previewQ.notes && <div style={{ fontSize:13, color:T.muted, lineHeight:1.6, marginBottom:12 }}>{previewQ.notes}</div>}

                {previewQ.signed_at && (
                  <div style={{ background:T.greenBg, borderRadius:T.r.md, padding:"10px 14px", fontSize:13 }}>
                    ✓ {tr("quotes.preview.acceptedBy", { name: previewQ.signed_by, date: fmtDate(previewQ.signed_at) })}
                  </div>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}

      {delId && <ConfirmModal title={tr("quotes.deleteConfirm.title")} message={tr("quotes.deleteConfirm.message")} onConfirm={handleDelete} onClose={()=>!busy && setDelId(null)} disabled={busy}/>}

      <div style={{ display:"flex", gap:12, marginBottom:16 }}>
        {isLoading ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} style={{ flex:1, background:T.surface, borderRadius:T.r.lg, border:`1px solid ${T.border}`, padding:"14px 16px", opacity:0.6 }}>
              <div style={{ height: 11, width: "60%", background: T.border, borderRadius: 4, marginBottom: 10 }} />
              <div style={{ height: 22, width: "40%", background: T.border, borderRadius: 4, marginBottom: 8 }} />
              <div style={{ height: 12, width: "70%", background: T.border, borderRadius: 4 }} />
            </div>
          ))
        ) : (
          [
            { label:tr("quotes.stats.totalQuotedValue"), val:fmt(quotesList.reduce((s,q)=>s+Number(q.total||0),0)), sub:tr("quotes.stats.quotesCount", { count: quotesList.length }) },
            { label:tr("quotes.stats.acceptedValue"),    val:fmt(quotesList.filter(q=>["accepted","converted"].includes(q.status)).reduce((s,q)=>s+Number(q.total||0),0)), sub:tr("quotes.stats.won") },
            { label:tr("quotes.stats.pending"),          val:quotesList.filter(q=>["draft","sent","viewed"].includes(q.status)).length, sub:tr("quotes.stats.awaitingResponse") },
            { label:tr("quotes.stats.conversionRate"),   val:quotesList.length>0?`${Math.round((quotesList.filter(q=>["accepted","converted"].includes(q.status)).length/quotesList.length)*100)}%`:"—", sub:tr("quotes.stats.acceptedOverTotal") },
          ].map(m=>(
            <div key={m.label} style={{ flex:1, background:T.surface, borderRadius:T.r.lg, border:`1px solid ${T.border}`, padding:"14px 16px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6 }}>{m.label}</div>
              <div style={{ fontSize:22, fontWeight:800 }}>{m.val}</div>
              <div style={{ fontSize:12, color:T.muted, marginTop:3 }}>{m.sub}</div>
            </div>
          ))
        )}
      </div>

      <Tabs tabs={[["active",tr("quotes.tabs.active"),active.length],["archived",tr("quotes.tabs.archived"),archived.length]]} active={tab} onChange={setTab}/>

      <Card style={{ padding:0, overflow:"hidden" }}>
        {isLoading ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: T.muted }}>
            <div style={{ fontSize: 14 }}>{tr("common.loading") || "Loading quotes..."}</div>
          </div>
        ) : current.length===0 ? (
          <Empty message={tr("quotes.empty")} action={<Btn size="sm" onClick={openAdd}>{tr("quotes.createFirst")}</Btn>}/>
        ) : (
          <Table headers={[
            tr("quotes.table.headers.quoteNumber"), tr("quotes.table.headers.client"), tr("quotes.table.headers.title"),
            tr("quotes.table.headers.total"), tr("quotes.table.headers.margin"), tr("quotes.table.headers.status"), "",
          ]}>
            {current.map(q=>{
              const cl = getClient(q.client_id);
              return (
                <tr key={q.id}>
                  <TD style={{ fontWeight:700, color:T.brand, cursor:"pointer" }} onClick={()=>openPreview(q)}>{q.quote_number}</TD>
                  <TD>{cl?.name||"—"}</TD>
                  <TD style={{ maxWidth:200 }}><div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{q.title}</div></TD>
                  <TD style={{ fontWeight:700 }}>{fmt(q.total)}</TD>
                  <TD><span style={{ color:q.margin_pct>25?T.green:T.amber, fontWeight:600 }}>{q.margin_pct}%</span></TD>
                  <TD><Badge color={STATUS_COLOR[q.status]||"gray"}>{tr(`quotes.status.${q.status}`)}</Badge></TD>
                  <TD>
                    <div style={{ display:"flex", gap:6 }}>
                      <Btn size="sm" variant="ghost" onClick={()=>openPreview(q)} disabled={busy}>{tr("quotes.row.view")}</Btn>
                      {q.status==="draft" && <Btn size="sm" variant="ghost" onClick={()=>openEdit(q)} disabled={busy}>{tr("quotes.row.edit")}</Btn>}
                      {["draft","sent","viewed"].includes(q.status) && getClient(q.client_id)?.email && (
                        <Btn size="sm" variant="ghost" onClick={()=>handleSendEmail(q)} disabled={busy}>
                          {tr("quotes.row.email") || "Email"}
                        </Btn>
                      )}
                      {q.status==="accepted" && !q.job_id && <Btn size="sm" variant="success" onClick={()=>convertToJob(q)} disabled={busy}>{tr("quotes.row.toJob")}</Btn>}
                      <Btn size="sm" variant="danger" onClick={()=>setDelId(q.id)} disabled={busy}>✕</Btn>
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