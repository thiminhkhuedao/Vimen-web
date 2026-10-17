/**
 * Supabase Edge Function: send-weekly-digest
 *
 * Déclenchée UNE FOIS PAR SEMAINE (lundi matin) par pg_cron — voir
 * sql/013_weekly_digest.sql. Comme send-invoice-reminders, elle n'est pas appelée
 * par un utilisateur : elle est protégée par un secret partagé (x-cron-secret).
 *
 * Envoie à chaque pro qui n'a pas désactivé « résumé hebdomadaire »
 * (profiles.notif_weekly_digest) un email récapitulatif :
 *   - demandes de réservation reçues ces 7 derniers jours + demandes en attente de réponse ;
 *   - factures émises ces 7 derniers jours ;
 *   - factures impayées (dont en retard).
 * Si rien n'est à signaler, aucun email n'est envoyé.
 *
 * Appelée avec : { dryRun?: true } — dryRun liste ce qui serait envoyé, sans rien envoyer.
 * Renvoie :      { sent, skipped, failed, dryRun, details }
 *
 * Deploy:   supabase functions deploy send-weekly-digest --no-verify-jwt
 * Secrets:  CRON_SECRET, RESEND_API_KEY, FROM_EMAIL, APP_URL (déjà définis pour les autres fonctions)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "bookings@vimen.app";
const APP_URL = Deno.env.get("APP_URL") ?? "https://vimen.app";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
// Un digest déjà envoyé il y a moins de 6 jours n'est pas renvoyé (protège d'un double déclenchement).
const MIN_GAP_MS = 6 * DAY_MS;
const CHUNK = 25; // profils traités par lot (évite les requêtes trop volumineuses)
const MAX_PER_RUN = 150;
const SEND_DELAY_MS = 600; // Resend limite le débit

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );

const safeFromName = (s: unknown): string =>
  String(s ?? "").replace(/[<>"\r\n]/g, "").trim() || "Vimen";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function formatMoney(amount: number, currency: string, lang: string): string {
  try {
    return new Intl.NumberFormat(lang === "en" ? "en-GB" : "fr-FR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

type Stats = {
  newRequests: number;
  pendingRequests: number;
  invoicesCreated: number;
  invoicesCreatedTotal: number;
  unpaidCount: number;
  unpaidTotal: number;
  overdueCount: number;
  overdueTotal: number;
};

const hasActivity = (s: Stats) =>
  s.newRequests > 0 || s.pendingRequests > 0 || s.invoicesCreated > 0 || s.unpaidCount > 0;

function buildEmail(profile: Row, s: Stats) {
  const lang = profile.language === "en" ? "en" : "fr";
  const currency = profile.currency || "EUR";
  const money = (n: number) => formatMoney(n, currency, lang);

  const t = lang === "en"
    ? {
        subject: "Your weekly summary on Vimen",
        hello: `Hello ${esc(profile.name ?? "")},`,
        intro: "Here is what happened over the last 7 days.",
        bookings: "Bookings",
        newReq: (n: number) => `${n} new booking request${n > 1 ? "s" : ""} this week`,
        pending: (n: number) => `${n} request${n > 1 ? "s" : ""} waiting for your answer`,
        noReq: "No new booking requests this week",
        invoices: "Invoices",
        created: (n: number, total: string) => `${n} invoice${n > 1 ? "s" : ""} issued this week (${total})`,
        noInv: "No invoice issued this week",
        unpaid: (n: number, total: string) => `${n} unpaid invoice${n > 1 ? "s" : ""} (${total})`,
        overdue: (n: number, total: string) => `of which ${n} overdue (${total})`,
        cta: "Open Vimen",
        footer: "You can turn this summary off in Settings → Notifications.",
      }
    : {
        subject: "Ton résumé de la semaine sur Vimen",
        hello: `Bonjour ${esc(profile.name ?? "")},`,
        intro: "Voici ce qui s'est passé ces 7 derniers jours.",
        bookings: "Réservations",
        newReq: (n: number) => `${n} nouvelle${n > 1 ? "s" : ""} demande${n > 1 ? "s" : ""} de réservation cette semaine`,
        pending: (n: number) => `${n} demande${n > 1 ? "s" : ""} en attente de ta réponse`,
        noReq: "Aucune nouvelle demande de réservation cette semaine",
        invoices: "Factures",
        created: (n: number, total: string) => `${n} facture${n > 1 ? "s" : ""} émise${n > 1 ? "s" : ""} cette semaine (${total})`,
        noInv: "Aucune facture émise cette semaine",
        unpaid: (n: number, total: string) => `${n} facture${n > 1 ? "s" : ""} impayée${n > 1 ? "s" : ""} (${total})`,
        overdue: (n: number, total: string) => `dont ${n} en retard (${total})`,
        cta: "Ouvrir Vimen",
        footer: "Tu peux désactiver ce résumé dans Paramètres → Notifications.",
      };

  const line = (text: string, strong = false) =>
    `<div style="font-size:14px;line-height:1.7;color:${strong ? "#131211" : "#555"};${strong ? "font-weight:700;" : ""}">${esc(text)}</div>`;

  const bookingLines = [
    s.newRequests > 0 ? line(t.newReq(s.newRequests), true) : line(t.noReq),
    s.pendingRequests > 0 ? line(t.pending(s.pendingRequests), true) : "",
  ].join("");

  const invoiceLines = [
    s.invoicesCreated > 0 ? line(t.created(s.invoicesCreated, money(s.invoicesCreatedTotal))) : line(t.noInv),
    s.unpaidCount > 0 ? line(t.unpaid(s.unpaidCount, money(s.unpaidTotal)), true) : "",
    s.overdueCount > 0 ? line(t.overdue(s.overdueCount, money(s.overdueTotal))) : "",
  ].join("");

  const card = (title: string, body: string) =>
    `<div style="background:#f8f7f5;border-radius:10px;padding:14px 18px;margin:14px 0">
      <div style="font-size:12px;font-weight:800;color:#E8500A;letter-spacing:.4px;margin-bottom:6px">${esc(title)}</div>
      ${body}
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f4f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#131211">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e3de">
    <div style="background:#E8500A;padding:20px 32px"><div style="color:#fff;font-size:20px;font-weight:900">Vimen</div></div>
    <div style="padding:32px">
      <p style="font-size:15px;margin:0 0 6px">${t.hello}</p>
      <p style="font-size:14px;color:#555;margin:0 0 8px">${t.intro}</p>
      ${card(t.bookings, bookingLines)}
      ${card(t.invoices, invoiceLines)}
      <a href="${esc(APP_URL)}" style="display:block;background:#E8500A;color:#fff;text-decoration:none;padding:14px 26px;border-radius:10px;font-size:15px;font-weight:700;text-align:center;margin:22px 0 6px">${t.cta}</a>
    </div>
    <div style="text-align:center;padding:16px;font-size:12px;color:#aaa;border-top:1px solid #eee">${t.footer}</div>
  </div>
</body></html>`;

  return { subject: t.subject, html };
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${safeFromName("Vimen")} <${FROM_EMAIL}>`, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Resend ${res.status}: ${JSON.stringify(err)}`);
  }
}

const emptyStats = (): Stats => ({
  newRequests: 0, pendingRequests: 0,
  invoicesCreated: 0, invoicesCreatedTotal: 0,
  unpaidCount: 0, unpaidTotal: 0, overdueCount: 0, overdueTotal: 0,
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!CRON_SECRET || !safeEqual(req.headers.get("x-cron-secret") ?? "", CRON_SECRET)) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!RESEND_API_KEY) {
    console.error("send-weekly-digest: RESEND_API_KEY non configuré");
    return json({ error: "RESEND_API_KEY non configuré" }, 500);
  }

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = body?.dryRun === true;
  } catch { /* corps vide : mode normal */ }

  try {
    const now = Date.now();
    const sinceIso = new Date(now - WEEK_MS).toISOString();
    const gapThresholdIso = new Date(now - MIN_GAP_MS).toISOString();
    const todayStr = new Date(now).toISOString().slice(0, 10);

    // 1) Pros qui reçoivent le résumé (null = activé, comme l'affiche Paramètres par défaut)
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, name, email, language, currency, notif_weekly_digest, last_digest_sent_at")
      .or("notif_weekly_digest.is.null,notif_weekly_digest.eq.true")
      .not("email", "is", null)
      .limit(1000);
    if (pErr) throw pErr;

    let sent = 0, skipped = 0, failed = 0;
    const details: Record<string, unknown>[] = [];

    const list = profiles ?? [];
    for (let i = 0; i < list.length; i += CHUNK) {
      if (sent >= MAX_PER_RUN) break;

      const chunk = list.slice(i, i + CHUNK);
      const ids = chunk.map((p) => p.id);

      // 2) Données du lot, en 3 requêtes
      const [weekReq, pendingReq, inv] = await Promise.all([
        supabase.from("booking_requests").select("profile_id").in("profile_id", ids).gte("created_at", sinceIso),
        supabase.from("booking_requests").select("profile_id").in("profile_id", ids).eq("status", "pending"),
        supabase
          .from("invoices")
          .select("profile_id, status, amount, due_date, created_at")
          .in("profile_id", ids)
          .or(`status.eq.unpaid,created_at.gte.${sinceIso}`),
      ]);
      if (weekReq.error) throw weekReq.error;
      if (pendingReq.error) throw pendingReq.error;
      if (inv.error) throw inv.error;

      const stats = new Map<string, Stats>(ids.map((id) => [id, emptyStats()]));

      for (const r of weekReq.data ?? []) stats.get(r.profile_id)!.newRequests++;
      for (const r of pendingReq.data ?? []) stats.get(r.profile_id)!.pendingRequests++;
      for (const r of inv.data ?? []) {
        const s = stats.get(r.profile_id);
        if (!s) continue;
        const amount = Number(r.amount) || 0;
        if (r.created_at && r.created_at >= sinceIso) {
          s.invoicesCreated++;
          s.invoicesCreatedTotal += amount;
        }
        if (r.status === "unpaid") {
          s.unpaidCount++;
          s.unpaidTotal += amount;
          if (r.due_date && r.due_date < todayStr) {
            s.overdueCount++;
            s.overdueTotal += amount;
          }
        }
      }

      // 3) Un email par pro
      for (const p of chunk) {
        if (sent >= MAX_PER_RUN) break;

        const s = stats.get(p.id)!;
        if (!hasActivity(s)) { skipped++; continue; }

        const last = p.last_digest_sent_at ? Date.parse(p.last_digest_sent_at) : 0;
        if (last && now - last < MIN_GAP_MS) { skipped++; continue; }

        if (dryRun) {
          sent++;
          details.push({ to: p.email, stats: s });
          continue;
        }

        // On « réserve » le profil AVANT d'envoyer : un double déclenchement du cron ne renvoie rien.
        const nowIso = new Date().toISOString();
        const { data: claimed, error: claimErr } = await supabase
          .from("profiles")
          .update({ last_digest_sent_at: nowIso })
          .eq("id", p.id)
          .or(`last_digest_sent_at.is.null,last_digest_sent_at.lt.${gapThresholdIso}`)
          .select("id");
        if (claimErr || !claimed?.length) { skipped++; continue; }

        try {
          const { subject, html } = buildEmail(p, s);
          await sendEmail(p.email, subject, html);
          sent++;
          details.push({ to: p.email });
          await sleep(SEND_DELAY_MS);
        } catch (err) {
          failed++;
          console.error("send-weekly-digest: échec d'envoi", p.id, err instanceof Error ? err.message : err);
          // On remet l'ancienne valeur pour réessayer à la prochaine exécution.
          await supabase.from("profiles").update({ last_digest_sent_at: p.last_digest_sent_at ?? null }).eq("id", p.id);
        }
      }
    }

    console.log(`send-weekly-digest: sent=${sent} skipped=${skipped} failed=${failed} dryRun=${dryRun}`);
    return json({ sent, skipped, failed, dryRun, details });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-weekly-digest error:", message);
    return json({ error: message }, 500);
  }
});