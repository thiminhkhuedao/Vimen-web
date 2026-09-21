// src/pages/PaymentsPage.jsx

import { useState, useEffect } from "react";
import { useTranslation } from "../i18n/index.js";
import { toast } from "react-hot-toast";
import { useAuth } from "@clerk/clerk-react";
import { T } from "../styles/tokens";
import {
  PageShell, Card, Btn, Badge, Table, TD,
  MetricCard, SectionTitle, Empty,
} from "../components/UI";
import { formatCurrency } from "../lib/currency.js";
import { getStripeConnectUrl, updateProfile } from "../lib/db.js";

/* ── HELPERS & UTILITIES ─────────────────────────────── */

const fmtDate = d => { try { return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); } catch { return ""; }};
const fmtTime = d => { try { return new Date(d).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}); } catch { return ""; }};
const pct = (a,b) => b>0 ? `${((a/b)*100).toFixed(1)}%` : "";

const STATUS_BADGE = {
  completed: "green",
  pending: "amber",
  processing: "blue",
  failed: "red",
  refunded: "gray",
  paid: "green",
  in_transit: "blue",
};

// Safe Clipboard Fallback
const copyToClipboard = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
};

/* ── EXTRA UI PATTERNS ───────────────────────────────── */

// Progressive Disclosure: Accordion Component
const Accordion = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: T.r.md, marginBottom: 8, overflow: "hidden" }}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)} 
        style={{ width: "100%", padding: "12px 16px", textAlign: "left", background: T.surface, border: "none", cursor: "pointer", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", color: T.text }}
      >
        <span>{title}</span>
        <span>{isOpen ? "▲" : "▼"}</span>
      </button>
      {isOpen && <div style={{ padding: 16, background: T.surface2 }}>{children}</div>}
    </div>
  );
};

// Error State UX Rule
const StructuredError = ({ what, why, action, onRetry }) => (
  <div style={{ padding: 16, backgroundColor: T.redBg || "#fef2f2", border: `1px solid ${T.red || "#dc2626"}40`, borderRadius: T.r.md, color: T.red || "#dc2626", marginBottom: 20 }}>
    <strong style={{ display: "block", marginBottom: 4 }}>{what}</strong>
    <p style={{ margin: "4px 0 8px 0", fontSize: 13 }}>{why}</p>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <small style={{ fontSize: 12 }}>{action}</small>
      {onRetry && <Btn size="sm" variant="ghost" onClick={onRetry}>Réessayer</Btn>}
    </div>
  </div>
);

// Validation IBAN légère (mod-97) — juste pour attraper les fautes de frappe,
// pas une vérification bancaire complète.
const isValidIban = (raw) => {
  const iban = (raw || "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => (ch.charCodeAt(0) - 55).toString());
  let remainder = numeric;
  while (remainder.length > 2) {
    const chunk = remainder.slice(0, 9);
    remainder = (parseInt(chunk, 10) % 97) + remainder.slice(chunk.length);
  }
  return parseInt(remainder, 10) % 97 === 1;
};

const formatIbanDisplay = (raw) => (raw || "").replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
export default function PaymentsPage({ profile, state, dispatch, refresh }) {
  const { t: tr } = useTranslation();
  const { getToken } = useAuth();
  const fmt = n => formatCurrency(n, profile?.currency);
  const [tab, setTab] = useState("overview");
  
  // Au retour du parcours d'onboarding Stripe (voir returnUrl dans
  // handleStripeStandardConnect), on arrive sur ?tab=connect — on ouvre
  // le bon onglet et on rafraîchit le profil pour récupérer le statut
  // à jour (stripe_charges_enabled / stripe_payouts_enabled).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "connect") {
      setTab("connect");
      if (refresh) refresh();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [refresh]);
  
  // Local states for async management and error handling
  const [isLoading, setIsLoading] = useState(false);
  const [pageError, setPageError] = useState(null);

  // Formulaire RIB (IBAN/BIC) — alternative à Stripe pour les clients qui
  // préfèrent payer par virement.
  const [bankForm, setBankForm] = useState({
    bank_account_holder: profile?.bank_account_holder ?? profile?.name ?? "",
    iban: profile?.iban ?? "",
    bic: profile?.bic ?? "",
  });
  const [isSavingBank, setIsSavingBank] = useState(false);

  useEffect(() => {
    setBankForm({
      bank_account_holder: profile?.bank_account_holder ?? profile?.name ?? "",
      iban: profile?.iban ?? "",
      bic: profile?.bic ?? "",
    });
  }, [profile?.bank_account_holder, profile?.iban, profile?.bic, profile?.name]);

  const handleSaveBankDetails = async () => {
    const cleanIban = bankForm.iban.replace(/\s+/g, "").toUpperCase();
    if (cleanIban && !isValidIban(cleanIban)) {
      toast.error(tr("payments.bankTransfer.invalidIban") || "Cet IBAN ne semble pas valide, vérifie-le.");
      return;
    }
    setIsSavingBank(true);
    try {
      const targetId = profile?.id || profile?.clerk_id;
      const { error } = await updateProfile(targetId, {
        bank_account_holder: bankForm.bank_account_holder,
        iban: cleanIban,
        bic: bankForm.bic.trim().toUpperCase(),
      });
      if (error) throw error;
      if (refresh) await refresh();
      toast.success(tr("payments.bankTransfer.saved") || "Coordonnées bancaires enregistrées");
    } catch (err) {
      toast.error(tr("payments.bankTransfer.saveFailed") || "Échec de l'enregistrement, réessaie");
      console.error("[Bank details save error]:", err);
    } finally {
      setIsSavingBank(false);
    }
  };

  // Pull from state with Fallback
  const transactions = state?.payment_transactions ?? [];
  const payouts = state?.payouts ?? [];

  const completed = transactions.filter(t => t.status === "completed");
  
  // Stats
  const totalVolume = completed.reduce((s,t) => s + Number(t.gross_amount), 0);
  const totalEarned = completed.reduce((s,t) => s + Number(t.net_amount), 0);
  const totalStripeFee = completed.reduce((s,t) => s + Number(t.stripe_fee), 0);

  const paidOut = payouts.filter(p => p.status === "paid").reduce((s,p) => s + Number(p.amount), 0);
  const inTransit = payouts.filter(p => p.status === "in_transit").reduce((s,p) => s + Number(p.amount), 0);
  const balance = totalEarned - paidOut;

  // This month
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const thisMonth = completed.filter(t => t.paid_at && t.paid_at >= monthStart);
  const thisMonthVol = thisMonth.reduce((s,t) => s + Number(t.gross_amount), 0);

  const isConnected = Boolean(profile?.stripe_customer_id || profile?.stripe_account_id);

  /* ── STRIPE CONNECT (Express + Account Links) ──────── */
  const handleStripeStandardConnect = async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const returnUrl = `${window.location.origin}/payments?tab=connect`;
      const token = await getToken();
      const { data, error } = await getStripeConnectUrl(token, returnUrl);
      if (error || !data?.url) {
        throw new Error(error?.message || "URL Stripe manquante");
      }
      toast.success(tr("payments.connect.redirectingToast") || "Redirection vers Stripe...");
      window.location.href = data.url;
    } catch (err) {
      console.error("[PaymentsPage] Stripe connect error:", err);
      setIsLoading(false);
      setPageError({
        what: tr("payments.errors.connectFailedWhat") || "Impossible de démarrer la connexion Stripe",
        why: tr("payments.errors.connectFailedWhy") || "Le service de paiement est temporairement indisponible",
        action: tr("payments.errors.connectFailedAction") || "Vérifie ta connexion et réessaie",
      });
    }
  };

  const handleSyncAccount = async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      if (refresh) await refresh();
      toast.success(tr("payments.connect.syncSuccess") || "Synchronisation effectuée");
    } catch (err) {
      setPageError({
        what: tr("payments.errors.syncFailedWhat") || "Impossible de synchroniser le compte",
        why: tr("payments.errors.syncFailedWhy") || "Le service de paiement est temporairement indisponible",
        action: tr("payments.errors.syncFailedAction") || "Veuillez réessayer dans quelques instants"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyTransactionId = (id) => {
    copyToClipboard(id);
    toast.success(tr("payments.copied") || "Identifiant copié");
  };

  const TabBtn = ({ id, label }) => (
    <button 
      type="button" 
      onClick={() => setTab(id)} 
      style={{
        padding: "8px 20px", 
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

  return (
    <PageShell title={`${tr("payments.title")}`}>

      {pageError && (
        <StructuredError 
          what={pageError.what} 
          why={pageError.why} 
          action={pageError.action} 
          onRetry={handleSyncAccount}
        />
      )}

      {/* Tab navigation */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, marginBottom: 24 }}>
        <TabBtn id="overview" label={tr("payments.tabs.overview")} />
        <TabBtn id="transactions" label={tr("payments.tabs.transactions", { count: completed.length })} />
        <TabBtn id="payouts" label={tr("payments.tabs.payouts")} />
        <TabBtn id="connect" label={tr("payments.tabs.account")} />
      </div>

      {/* ── OVERVIEW ─────────────────────────────────── */}
      {tab === "overview" && (
        <>
          {!isConnected ? (
            <div style={{ 
              background: T.amberBg, 
              border: `1px solid ${T.amber}40`, 
              borderRadius: T.r.lg,
              padding: "16px 20px", 
              marginBottom: 20, 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center" 
            }}>
              <div>
                <div style={{ fontWeight: 700, color: T.amber, marginBottom: 4 }}>
                  {tr("payments.overview.notConnectedTitle")}
                </div>
                <div style={{ fontSize: 13, color: T.muted }}>
                  {tr("payments.overview.notConnectedDesc")}
                </div>
              </div>
              <Btn disabled title={tr("payments.comingSoon")}>{tr("payments.comingSoon")}</Btn>
            </div>
          ) : (
            <div style={{ 
              background: T.greenBg, 
              border: `1px solid ${T.green}30`, 
              borderRadius: T.r.lg,
              padding: "14px 20px", 
              marginBottom: 20, 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center" 
            }}>
              <div style={{ fontWeight: 600, color: T.green }}>
                {tr("payments.overview.connectedBanner")}
              </div>
              <Badge color="green">{tr("payments.status.connected")}</Badge>
            </div>
          )}

          {/* Key metrics */}
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <MetricCard 
              label={tr("payments.metrics.totalVolume")} 
              value={fmt(totalVolume)}
              sub={tr("payments.metrics.paymentsCount", { count: completed.length })} 
              accent
            />
            <MetricCard 
              label={tr("payments.metrics.yourEarnings")} 
              value={fmt(totalEarned)}
              sub={tr("payments.metrics.ofGross", { pct: pct(totalEarned, totalVolume) })} 
            />
            <MetricCard 
              label={tr("payments.metrics.thisMonth")} 
              value={fmt(thisMonthVol)}
              sub={tr("payments.metrics.paymentsCount", { count: thisMonth.length })} 
            />
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <MetricCard 
              label={tr("payments.metrics.availableBalance")} 
              value={fmt(balance)}
              sub={tr("payments.metrics.readyToPayOut")} 
            />
            <MetricCard 
              label={tr("payments.metrics.inTransitToBank")} 
              value={fmt(inTransit)}
              sub={tr("payments.metrics.arrivingSoon")} 
            />
            <MetricCard 
              label={tr("payments.metrics.totalPaidOut")} 
              value={fmt(paidOut)}
              sub={tr("payments.metrics.payoutsCount", { count: payouts.filter(p => p.status === "paid").length })} 
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            <Card>
              <SectionTitle action={
                <span 
                  style={{ fontSize: 12, color: T.brand, cursor: "pointer", fontWeight: 600 }}
                  onClick={() => setTab("transactions")}
                >
                  {tr("payments.overview.viewAll")}
                </span>
              }>
                {tr("payments.overview.recentPayments")}
              </SectionTitle>
              {completed.length === 0 ? (
                <Empty message={tr("payments.overview.emptyPayments")} />
              ) : (
                completed.slice(0, 5).map(t => (
                  <div key={t.id} style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    padding: "10px 0", 
                    borderBottom: `1px solid ${T.border}` 
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{t.client_name}</div>
                      <div style={{ fontSize: 12, color: T.muted }}>
                        {t.description} · {fmtDate(t.paid_at)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, color: T.green }}>{fmt(t.net_amount)}</div>
                      <div style={{ fontSize: 11, color: T.muted }}>
                        {tr("payments.overview.ofGrossAmount", { amount: fmt(t.gross_amount) })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </>
      )}

      {/* ── TRANSACTIONS ─────────────────────────────── */}
      {tab === "transactions" && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.md, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", marginBottom: 4 }}>
                {tr("payments.transactions.grossVolume")}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{fmt(totalVolume)}</div>
            </div>
            <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.md, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", marginBottom: 4 }}>
                {tr("payments.transactions.stripeFeesPaid")}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.muted }}>{fmt(totalStripeFee)}</div>
            </div>
            <div style={{ flex: 1, background: T.greenBg, border: `1px solid ${T.green}30`, borderRadius: T.r.md, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.green, textTransform: "uppercase", marginBottom: 4 }}>
                {tr("payments.transactions.netToYou")}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.green }}>{fmt(totalEarned)}</div>
            </div>
          </div>

          <Card style={{ padding: 0, overflow: "hidden" }}>
            {transactions.length === 0 ? (
              <Empty message={tr("payments.transactions.empty")} />
            ) : (
              <Table headers={[
                tr("payments.table.date"), 
                tr("payments.table.client"), 
                tr("payments.table.description"),
                tr("payments.table.gross"), 
                tr("payments.table.stripeFee"),
                tr("payments.table.youReceive"), 
                tr("payments.table.status"),
                tr("payments.table.actions") || "Actions"
              ]}>
                {transactions.map(t => (
                  <tr key={t.id}>
                    <TD>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{fmtDate(t.paid_at || t.created_at)}</div>
                      <div style={{ fontSize: 11, color: T.muted }}>{t.paid_at ? fmtTime(t.paid_at) : ""}</div>
                    </TD>
                    <TD style={{ fontWeight: 500 }}>{t.client_name || ""}</TD>
                    <TD style={{ color: T.muted, maxWidth: 160 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.description || ""}
                      </div>
                    </TD>
                    <TD style={{ fontWeight: 600 }}>{fmt(t.gross_amount)}</TD>
                    <TD style={{ color: T.muted }}>-{fmt(t.stripe_fee)}</TD>
                    <TD style={{ fontWeight: 700, color: T.green }}>{fmt(t.net_amount)}</TD>
                    <TD><Badge color={STATUS_BADGE[t.status] || "gray"}>{tr(`payments.status.${t.status}`)}</Badge></TD>
                    <TD>
                      <Btn size="sm" variant="ghost" onClick={() => handleCopyTransactionId(t.id)}>
                        {tr("actions.copy") || "Copier ID"}
                      </Btn>
                    </TD>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}

      {/* ── PAYOUTS ──────────────────────────────────── */}
      {tab === "payouts" && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <MetricCard label={tr("payments.payoutsTab.availableForPayout")} value={fmt(balance)} sub={tr("payments.payoutsTab.estimated")} accent />
            <MetricCard label={tr("payments.payoutsTab.inTransit")} value={fmt(inTransit)} sub={tr("payments.payoutsTab.expectedWithin2Days")} />
            <MetricCard label={tr("payments.payoutsTab.totalPaidOut")} value={fmt(paidOut)} sub={tr("payments.metrics.payoutsCount", { count: payouts.filter(p => p.status === "paid").length })} />
          </div>

          <Card style={{ marginBottom: 16, background: T.surface2, border: "none" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{tr("payments.payoutSchedule.title")}</div>
                <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
                  {tr("payments.payoutSchedule.description")}{" "}
                  <strong>{payouts[0]?.bank_last4 ?? "****"}</strong>.
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ padding: 0, overflow: "hidden" }}>
            {payouts.length === 0 ? (
              <Empty message={tr("payments.payoutsTab.empty")} />
            ) : (
              <Table headers={[
                tr("payments.table.dateInitiated"), 
                tr("payments.table.arrivalDate"), 
                tr("payments.table.amount"),
                tr("payments.table.transactions"), 
                tr("payments.table.bank"), 
                tr("payments.table.status"),
              ]}>
                {payouts.map(p => (
                  <tr key={p.id}>
                    <TD>{fmtDate(p.created_at)}</TD>
                    <TD style={{ fontWeight: 500 }}>
                      {p.arrival_date ? fmtDate(p.arrival_date) : ""}
                    </TD>
                    <TD style={{ fontWeight: 700 }}>{fmt(p.amount)}</TD>
                    <TD style={{ color: T.muted }}>{p.transaction_count}</TD>
                    <TD style={{ color: T.muted, fontFamily: "monospace" }}>
                      ••••{p.bank_last4 ?? "****"}
                    </TD>
                    <TD><Badge color={STATUS_BADGE[p.status] || "gray"}>{tr(`payments.status.${p.status}`)}</Badge></TD>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}

      {/* ── CONNECT / ACCOUNT ────────────────────────── */}
      {tab === "connect" && (
        <div style={{ maxWidth: 560 }}>
          <Card>
            <SectionTitle>{tr("payments.connect.stripeAccountTitle")}</SectionTitle>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "space-between",
              padding: "16px 0", 
              borderBottom: `1px solid ${T.border}` 
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ 
                  width: 44, 
                  height: 44, 
                  borderRadius: T.r.md,
                  background: "#635BFF", 
                  display: "flex", 
                  alignItems: "center",
                  justifyContent: "center", 
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 16, 
                  flexShrink: 0 
                }}>
                  S
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{tr("payments.connect.stripeConnect")}</div>
                  <div style={{ fontSize: 13, color: T.muted }}>
                    {isConnected
                      ? tr("payments.connect.connectedDesc")
                      : tr("payments.connect.notConnectedDesc")}
                  </div>
                </div>
              </div>
              <Badge color={isConnected ? "green" : "amber"}>
                {isConnected ? tr("payments.status.active") : tr("payments.status.notConnected")}
              </Badge>
            </div>

            {isConnected ? (
              <div style={{ paddingTop: 16 }}>
                <div style={{ fontSize: 13, color: T.muted, marginBottom: 14 }}>
                  {tr("payments.connect.connectedBody")}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn 
                    variant="ghost" 
                    size="sm"
                    onClick={() => window.open("https://dashboard.stripe.com", "_blank")}
                  >
                    {tr("payments.connect.openDashboard")}
                  </Btn>
                  <Btn 
                    size="sm" 
                    onClick={handleSyncAccount}
                    disabled={isLoading}
                  >
                    {isLoading ? tr("actions.loading") || "Chargement..." : tr("payments.connect.syncBtn") || "Synchroniser"}
                  </Btn>
                </div>
              </div>
            ) : (
              <div style={{ paddingTop: 16 }}>
                <div style={{ fontSize: 13, color: T.muted, marginBottom: 16, lineHeight: 1.6 }}>
                  {tr("payments.connect.notConnectedBody")}
                </div>
                <Btn disabled title={tr("payments.comingSoon")}>{tr("payments.comingSoon")}</Btn>
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>{tr("payments.bankTransfer.title") || "Coordonnées bancaires (RIB)"}</SectionTitle>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 18, lineHeight: 1.6 }}>
              {tr("payments.bankTransfer.desc") ||
                "Pas de compte Stripe ? Renseigne ton IBAN pour que tes clients puissent te payer par virement bancaire. Ces informations apparaîtront automatiquement sur tes factures envoyées par email."}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>
                  {tr("payments.bankTransfer.holderLabel") || "Titulaire du compte"}
                </label>
                <input
                  type="text"
                  value={bankForm.bank_account_holder}
                  onChange={(e) => setBankForm((f) => ({ ...f, bank_account_holder: e.target.value }))}
                  placeholder={tr("payments.bankTransfer.holderPlaceholder") || "ex. Jean Dupont"}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: T.r.md,
                    border: `1px solid ${T.border}`, fontSize: 14, boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>
                  IBAN
                </label>
                <input
                  type="text"
                  value={bankForm.iban}
                  onChange={(e) => setBankForm((f) => ({ ...f, iban: e.target.value }))}
                  placeholder="FR76 3000 6000 0112 3456 7890 189"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: T.r.md,
                    border: `1px solid ${T.border}`, fontSize: 14, fontFamily: "monospace",
                    letterSpacing: 0.5, boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>
                  BIC / SWIFT
                </label>
                <input
                  type="text"
                  value={bankForm.bic}
                  onChange={(e) => setBankForm((f) => ({ ...f, bic: e.target.value }))}
                  placeholder="AGRIFRPP123"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: T.r.md,
                    border: `1px solid ${T.border}`, fontSize: 14, fontFamily: "monospace",
                    letterSpacing: 0.5, boxSizing: "border-box", maxWidth: 220,
                  }}
                />
              </div>

              {profile?.iban && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: T.surface2, borderRadius: T.r.md, padding: "10px 14px", marginTop: 4,
                }}>
                  <div style={{ fontSize: 13, fontFamily: "monospace" }}>
                    {formatIbanDisplay(profile.iban)}
                  </div>
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={() => { copyToClipboard(profile.iban.replace(/\s+/g, "")); toast.success(tr("payments.copied") || "Copié"); }}
                  >
                    {tr("actions.copy") || "Copier"}
                  </Btn>
                </div>
              )}

              <div>
                <Btn onClick={handleSaveBankDetails} disabled={isSavingBank}>
                  {isSavingBank ? (tr("actions.loading") || "Enregistrement...") : (tr("actions.save") || "Enregistrer")}
                </Btn>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle>{tr("payments.howItWorks.title")}</SectionTitle>
            {["1", "2", "3", "4"].map(num => (
              <Accordion 
                key={num} 
                title={`${num}. ${tr(`payments.howItWorks.step${num}.title`)}`}
              >
                <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
                  {tr(`payments.howItWorks.step${num}.desc`)}
                </div>
              </Accordion>
            ))}
          </Card>
        </div>
      )}
    </PageShell>
  );
}