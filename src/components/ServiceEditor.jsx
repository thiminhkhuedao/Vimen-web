// src/components/ServiceEditor.jsx

import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { T } from "../styles/tokens";
import { useTranslation } from "../i18n/index.js";
import {
  getServices, createService, updateService, deleteService,
  swapServiceOrder,
} from "../lib/db";
import PhotoUpload from "./PhotoUpload";
import {
  Card, Btn, Field, FieldRow, Input, Textarea, Toggle,
  Modal, ConfirmModal, FormActions, Empty, SectionTitle,
} from "./UI";
import { formatCurrency } from "../lib/currency.js";

const fmt = n => `€${Number(n||0).toLocaleString("en-GB",{minimumFractionDigits:2})}`;

const EMPTY_FORM = { name:"", price:"", duration_min:"", description:"", image_url:null, deposit_enabled:false, deposit_type:"fixed", deposit_amount:"" };

export default function ServiceEditor({ profile }) {
  const fmt = n => formatCurrency(n, profile?.currency);
  const { t } = useTranslation();
  const [services, setServices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null); // null | "add" | service obj (edit)
  const [delId,    setDelId]    = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const fld = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await getServices(profile.id);
    setServices(data ?? []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  function openAdd()  { setForm(EMPTY_FORM); setModal("add"); }
  function openEdit(s) {
    setForm({
      name: s.name, price: String(s.price ?? ""), duration_min: s.duration_min ? String(s.duration_min) : "",
      description: s.description ?? "", image_url: s.image_url ?? null,
      deposit_enabled: s.deposit_enabled ?? false,
      deposit_type: s.deposit_type ?? "fixed",
      deposit_amount: s.deposit_amount != null ? String(s.deposit_amount) : "",
    });
    setModal(s);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name || !form.price) { toast.error(t("booking.services.nameAndPriceRequired")); return; }
    if (form.deposit_enabled && (!form.deposit_amount || parseFloat(form.deposit_amount) <= 0)) {
      toast.error(t("booking.services.depositAmountRequired"));
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      price: parseFloat(form.price) || 0,
      duration_min: form.duration_min ? parseInt(form.duration_min, 10) : null,
      description: form.description || "",
      image_url: form.image_url || null,
      deposit_enabled: form.deposit_enabled,
      deposit_type: form.deposit_enabled ? form.deposit_type : null,
      deposit_amount: form.deposit_enabled ? parseFloat(form.deposit_amount) || 0 : null,
    };

    if (modal === "add") {
      const nextOrder = services.length ? Math.max(...services.map(s => s.sort_order)) + 1 : 0;
      const { data, error } = await createService(profile.id, { ...payload, sort_order: nextOrder });
      setSaving(false);
      if (error) { toast.error(t("booking.services.addFailed")); return; }
      setServices(prev => [...prev, data]);
      toast.success(t("booking.services.addedToast"));
    } else {
      const { data, error } = await updateService(modal.id, payload);
      setSaving(false);
      if (error) { toast.error(t("booking.services.updateFailed")); return; }
      setServices(prev => prev.map(s => s.id === modal.id ? data : s));
      toast.success(t("booking.services.updatedToast"));
    }
    setModal(null);
  }

  async function handleDelete() {
    const { error } = await deleteService(delId);
    if (error) { toast.error(t("booking.services.deleteFailed")); return; }
    setServices(prev => prev.filter(s => s.id !== delId));
    setDelId(null);
    toast.success(t("booking.services.deletedToast"));
  }

  async function toggleActive(s) {
    const { data, error } = await updateService(s.id, { active: !s.active });
    if (error) { toast.error(t("booking.services.updateFailed")); return; }
    setServices(prev => prev.map(x => x.id === s.id ? data : x));
  }

  async function move(s, direction) {
    const sorted = [...services].sort((a,b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(x => x.id === s.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    const { error } = await swapServiceOrder(s, other);
    if (error) { toast.error(t("booking.services.reorderFailed")); return; }
    load();
  }

  const sortedServices = [...services].sort((a,b) => a.sort_order - b.sort_order);

  return (
    <Card>
      <SectionTitle action={<Btn size="sm" onClick={openAdd}>+ {t("booking.services.addService")}</Btn>}>
        {t("booking.services.title")}
      </SectionTitle>
      <p style={{ fontSize:13, color:T.muted, marginBottom:16, lineHeight:1.6 }}>
        {t("booking.services.subtitle")}
      </p>

      {loading ? (
        <div style={{ textAlign:"center", padding:32, color:T.muted, fontSize:13 }}>{t("booking.services.loading")}</div>
      ) : sortedServices.length === 0 ? (
        <Empty icon="🧾" message={t("booking.services.noneYet")}
          action={<Btn size="sm" onClick={openAdd}>+ {t("booking.services.addFirst")}</Btn>}/>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {sortedServices.map((s, idx) => (
            <div key={s.id} style={{
              display:"flex", alignItems:"center", gap:14,
              border:`1px solid ${T.border}`, borderRadius:T.r.md, padding:"12px 14px",
              opacity: s.active ? 1 : 0.55,
            }}>
              {s.image_url ? (
                <img src={s.image_url} alt={s.name}
                  style={{ width:52, height:52, borderRadius:T.r.sm, objectFit:"cover", flexShrink:0 }}/>
              ) : (
                <div style={{ width:52, height:52, borderRadius:T.r.sm, background:T.surface2, flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🧾</div>
              )}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{s.name}</div>
                <div style={{ fontSize:12, color:T.muted, marginTop:2 }}>
                  {fmt(s.price)}
                  {s.duration_min ? ` · ${s.duration_min} ${t("booking.services.minutesShort")}` : ""}
                  {!s.active ? ` · ${t("booking.services.hiddenLabel")}` : ""}
                  {s.deposit_enabled ? ` · ${t("booking.services.depositBadge", { amount: s.deposit_type === "percent" ? `${s.deposit_amount}%` : fmt(s.deposit_amount) })}` : ""}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                <Btn size="sm" variant="ghost" disabled={idx===0} onClick={()=>move(s,"up")}>↑</Btn>
                <Btn size="sm" variant="ghost" disabled={idx===sortedServices.length-1} onClick={()=>move(s,"down")}>↓</Btn>
                <Toggle on={s.active} onChange={()=>toggleActive(s)}/>
                <Btn size="sm" variant="ghost" onClick={()=>openEdit(s)}>{t("common.edit")}</Btn>
                <Btn size="sm" variant="danger" onClick={()=>setDelId(s.id)}>✕</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / edit modal */}
      {modal && (
        <Modal title={modal==="add" ? t("booking.services.addService") : t("booking.services.editService")} onClose={()=>setModal(null)}>
          <form onSubmit={handleSave}>
            <Field label={t("booking.services.nameLabel")}>
              <Input value={form.name} onChange={fld("name")} placeholder={t("booking.services.namePlaceholder")} autoFocus/>
            </Field>
            <FieldRow>
              <Field label={t("booking.services.priceLabel")} flex="1">
                <Input type="number" min="0" step="0.01" value={form.price} onChange={fld("price")} placeholder="0.00"/>
              </Field>
              <Field label={t("booking.services.durationLabel")} flex="1">
                <Input type="number" min="0" step="5" value={form.duration_min} onChange={fld("duration_min")} placeholder="60"/>
              </Field>
            </FieldRow>
            <Field label={t("booking.services.descriptionLabel")}>
              <Textarea value={form.description} onChange={fld("description")} placeholder={t("booking.services.descriptionPlaceholder")}/>
            </Field>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{t("booking.services.depositEnabled")}</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{t("booking.services.depositEnabledSub")}</div>
              </div>
              <Toggle on={form.deposit_enabled} onChange={v => setForm(p => ({ ...p, deposit_enabled: v }))} />
            </div>

            {form.deposit_enabled && (
              <FieldRow>
                <Field label={t("booking.services.depositTypeLabel")} flex="1">
                  <select
                    value={form.deposit_type}
                    onChange={e => setForm(p => ({ ...p, deposit_type: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 14, background: T.surface, color: T.text }}
                  >
                    <option value="fixed">{t("booking.services.depositTypeFixed")}</option>
                    <option value="percent">{t("booking.services.depositTypePercent")}</option>
                  </select>
                </Field>
                <Field
                  label={form.deposit_type === "percent" ? t("booking.services.depositAmountPercentLabel") : t("booking.services.depositAmountFixedLabel")}
                  flex="1"
                >
                  <Input
                    type="number" min="0"
                    step={form.deposit_type === "percent" ? "1" : "0.01"}
                    max={form.deposit_type === "percent" ? "100" : undefined}
                    value={form.deposit_amount}
                    onChange={fld("deposit_amount")}
                    placeholder={form.deposit_type === "percent" ? "20" : "50.00"}
                  />
                </Field>
              </FieldRow>
            )}

            <Field label={t("booking.services.photoLabel")}>
              <PhotoUpload
                profileId={profile.id}
                folder="services"
                value={form.image_url}
                onChange={url => setForm(p => ({ ...p, image_url: url }))}
                hintText={t("booking.services.uploadHint")}
                uploadingText={t("booking.services.uploading")}
                failedText={t("booking.services.uploadFailed")}
              />
            </Field>
            <FormActions onCancel={()=>setModal(null)}
              submitLabel={modal==="add" ? t("booking.services.addService") : t("common.saveChanges")} loading={saving}/>
          </form>
        </Modal>
      )}

      {/* Delete confirm */}
      {delId && (
        <ConfirmModal title={t("booking.services.deleteConfirmTitle")}
          message={t("booking.services.deleteConfirmMessage")}
          confirmLabel={t("common.delete")} onConfirm={handleDelete} onClose={()=>setDelId(null)}/>
      )}
    </Card>
  );
}

