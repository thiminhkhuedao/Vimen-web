import { useState } from "react";
import { useTranslation } from "../i18n/index.js";
import { toast } from "react-hot-toast";
import { copyToClipboard } from "../lib/clipboard";
import { T } from "../styles/tokens";
import { supabase } from "../lib/supabase";
import { rewardReferral } from "../lib/referralRewards";
import {
  PageShell, Card, Btn, Badge, Table, TD,
  Modal, Field, SectionTitle, Empty, MetricCard, Divider,
} from "../components/UI";
import { formatCurrency } from "../lib/currency.js";

const fmtDate = d => { 
  try { 
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); 
  } catch { 
    return ""; 
  }
};

const STATUS_COLOR = { 
  pending: "gray", 
  signed_up: "blue", 
  qualified: "amber", 
  rewarded: "green" 
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

export default function ReferralsPage({ state, dispatch, profile }) {
  const { t } = useTranslation();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });
  const [copied, setCopied] = useState(false);

  const referrals = state?.referrals ?? [];
  const rewarded = referrals.filter(r => r.status === "rewarded").length;
  const pending = referrals.filter(r => r.status === "pending").length;
  const monthsFree = rewarded * 2;

  // Stable personal referral link
  const myCode = `TRD-${(profile?.name || "USER").replace(/\s/g, "").slice(0, 4).toUpperCase()}${profile?.id?.slice(0, 4)?.toUpperCase() || "0000"}`;
  const referralUrl = `https://Vimen.app/signup?ref=${myCode}`;

  async function copyLink() {
    const ok = await copyToClipboard(referralUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t("referrals.toast.linkCopied"));
    } else {
      toast.error(t("referrals.toast.copyFailedManual"));
    }
  }

  async function sendReferral(e) {
    e.preventDefault();
    if (!form.email) { 
      toast.error(t("referrals.toast.emailRequired")); 
      return; 
    }

    const tid = toast.loading(t("referrals.toast.sendingInvite"));
    const code = `TRD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // 1. Insert into Supabase
    const { data, error } = await supabase
      .from("referrals")
      .insert({
        referrer_id: profile.id,
        referral_code: code,
        referred_email: form.email,
        referred_name: form.name || null,
        status: "pending",
        reward_months: 2,
        rewarded_at: null,
      })
      .select()
      .single();

    if (error) {
      console.error("[ReferralsPage] save referral error:", error);
      toast.dismiss(tid);
      toast.error(t("referrals.toast.saveFailed"));
      return;
    }

    // 2. Dispatch secure invitation email request via Edge Function
    let emailSent = false;
    try {
      const { error: fnError } = await supabase.functions.invoke("send-referral-email", {
        body: {
          to: form.email,
          referredName: form.name,
          referrerName: profile.name,
          referralCode: code,
          referralUrl: referralUrl,
        },
      });

      if (fnError) throw fnError;
      emailSent = true;
    } catch (emailErr) {
      console.warn("[referral] Edge function delivery error:", emailErr);
    }

    // 3. Update local state & provide fallback if function failed
    dispatch({ type: "ADD_REFERRAL", payload: data });
    toast.dismiss(tid);

    if (emailSent) {
      toast.success(t("referrals.toast.referralSent", { email: form.email }));
    } else {
      // Fallback: Trigger client mail protocol if Edge Function fails
      const subject = encodeURIComponent(`Invitation from ${profile?.name || "a friend"}`);
      const body = encodeURIComponent(`Hi ${form.name || ""},\n\nUse my referral link to sign up: ${referralUrl}`);
      window.open(`mailto:${form.email}?subject=${subject}&body=${body}`, "_blank");
      toast.success("Saved to database! Opening email app to complete delivery...");
    }

    setForm({ name: "", email: "" });
    setModal(false);
  }

  async function qualify(r) {
    if (!profile?.id) return;
    const tid = toast.loading(t("referrals.toast.applyingReward"));
    const result = await rewardReferral(r.id, profile.id, r.referred_email);
    toast.dismiss(tid);

    if (result.success) {
      dispatch({ 
        type: "UPDATE_REFERRAL", 
        payload: { ...r, status: "rewarded", rewarded_at: new Date().toISOString() } 
      });
      toast.success(t("referrals.toast.rewardSuccess"));
    } else if (result.reason === "referred_not_found") {
      toast.error(t("referrals.toast.userNotFound"));
    } else {
      toast.error(t("referrals.toast.rewardFailed"));
    }
  }

  return (
    <PageShell 
      title={t("referrals.title")}
      action={<Btn size="sm" onClick={() => setModal(true)}>{t("referrals.referSomeoneBtn")}</Btn>}
    >
      {modal && (
        <Modal title={t("referrals.modal.title")} onClose={() => setModal(false)} width={420}>
          <p style={{ fontSize: 13, color: T.muted, marginBottom: 18, lineHeight: 1.6 }}>
            {t("referrals.modal.intro")}
          </p>
          <form onSubmit={sendReferral}>
            <Field label={t("referrals.modal.theirNameLabel")} htmlFor="referral-name">
              <input 
                id="referral-name"
                style={INPUT_STYLE} 
                value={form.name} 
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
                placeholder={t("referrals.modal.namePlaceholder")} 
                autoFocus
              />
            </Field>
            <Field label={t("referrals.modal.theirEmailLabel")} htmlFor="referral-email">
              <input 
                id="referral-email"
                type="email" 
                style={INPUT_STYLE} 
                value={form.email} 
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} 
                placeholder={t("referrals.modal.emailPlaceholder")}
              />
            </Field>
            <div style={{ background: T.brandLight, borderRadius: T.r.md, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: T.brand, lineHeight: 1.6 }}>
              {t("referrals.modal.giftNote")}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
              <Btn variant="ghost" onClick={() => setModal(false)}>{t("referrals.modal.cancel")}</Btn>
              <Btn type="submit">{t("referrals.modal.send")}</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Metrics */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <MetricCard label={t("referrals.metrics.successfulReferrals")} value={rewarded} sub={t("referrals.metrics.totalSent", { count: referrals.length })} accent />
        <MetricCard label={t("referrals.metrics.monthsProEarned")} value={monthsFree} sub={t("referrals.metrics.appliedToAccount")} />
        <MetricCard label={t("referrals.metrics.pending")} value={pending} sub={t("referrals.metrics.waitingToSignUp")} />
        <MetricCard label={t("referrals.metrics.yourReferralCode")} value={myCode} sub={t("referrals.metrics.shareThisLink")} />
      </div>

      {/* Shareable Link Card */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>{t("referrals.linkCard.title")}</SectionTitle>
        <p style={{ fontSize: 13, color: T.muted, marginBottom: 14, lineHeight: 1.6 }}>
          {t("referrals.linkCard.description")}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, padding: "10px 14px", borderRadius: T.r.md, background: T.surface2, border: `1px solid ${T.border}`, fontSize: 13, color: T.muted, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {referralUrl}
          </div>
          <Btn onClick={copyLink} variant={copied ? "success" : "primary"}>
            {copied ? t("referrals.linkCard.copied") : t("referrals.linkCard.copyLink")}
          </Btn>
        </div>

        <Divider />

        {/* Social Sharing Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { 
              key: "whatsapp", 
              label: "WhatsApp", 
              onClick: () => window.open(`https://wa.me/?text=${encodeURIComponent(t("referrals.shareMessages.whatsapp", { name: profile?.name || "Someone", url: referralUrl }))}`, "_blank") 
            },
            { 
              key: "facebook", 
              label: "Facebook", 
              onClick: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`, "_blank") 
            },
            { 
              key: "email",    
              label: "Email",    
              onClick: () => window.open(`mailto:?subject=${encodeURIComponent(t("referrals.shareMessages.emailSubject", { name: profile?.name || "Someone" }))}&body=${encodeURIComponent(t("referrals.shareMessages.emailBody", { url: referralUrl }))}`, "_blank") 
            },
          ].map(b => (
            <Btn key={b.key} variant="ghost" size="sm" onClick={b.onClick}>{b.label}</Btn>
          ))}
        </div>
      </Card>

      {/* Onboarding Overview */}
      <Card style={{ marginBottom: 16, background: T.surface2, border: "none" }}>
        <SectionTitle>{t("referrals.howItWorks.title")}</SectionTitle>
        {["1", "2", "3", "4"].map(num => (
          <div key={num} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
              {num}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{t(`referrals.howItWorks.step${num}.title`)}</div>
              <div style={{ fontSize: 13, color: T.muted }}>{t(`referrals.howItWorks.step${num}.desc`)}</div>
            </div>
          </div>
        ))}
      </Card>

      {/* Referrals List */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px 0" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{t("referrals.table.title")}</div>
        </div>
        {referrals.length === 0 ? (
          <Empty 
            message={t("referrals.table.empty")}
            action={<Btn size="sm" onClick={() => setModal(true)}>{t("referrals.table.referFirst")}</Btn>}
          />
        ) : (
          <Table headers={[
            t("referrals.table.headers.name"), 
            t("referrals.table.headers.email"), 
            t("referrals.table.headers.code"),
            t("referrals.table.headers.status"), 
            t("referrals.table.headers.reward"), 
            t("referrals.table.headers.sent"),
          ]}>
            {referrals.map(r => (
              <tr key={r.id}>
                <TD style={{ fontWeight: 500 }}>{r.referred_name || ""}</TD>
                <TD style={{ color: T.muted }}>{r.referred_email || ""}</TD>
                <TD><code style={{ fontSize: 12, background: T.surface2, padding: "2px 8px", borderRadius: 4 }}>{r.referral_code}</code></TD>
                <TD>
                  <div>
                    <Badge color={STATUS_COLOR[r.status] || "gray"}>{t(`referrals.status.${r.status}`)}</Badge>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{t(`referrals.statusDesc.${r.status}`)}</div>
                  </div>
                </TD>
                <TD style={{ fontWeight: 600, color: r.status === "rewarded" ? T.green : T.muted }}>
                  {r.status === "rewarded" ? (
                    t("referrals.table.rewardEarned")
                  ) : (r.status === "signed_up" || r.status === "qualified") ? (
                    <Btn size="sm" variant="success" onClick={() => qualify(r)}>
                      {t("referrals.table.applyReward")}
                    </Btn>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD style={{ color: T.muted }}>{fmtDate(r.created_at)}</TD>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </PageShell>
  );
}