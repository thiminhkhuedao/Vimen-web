// supabase/functions/send-invoice-reminders/index.ts
//
// Appelée quotidiennement par pg_cron (voir sql/012_invoice_reminders_cron.sql).
// Cherche les factures "unpaid" et déclenche un rappel via send-invoice-email
// (qui relit lui-même tout le contenu depuis la base — voir sa doc) si :
//   - le pro n'a pas désactivé les rappels (profiles.notif_overdue_reminder)
//   - le dernier envoi date d'au moins reminder_frequency_days (défaut 7)
//   - reminder_count < reminder_max_count (défaut 5, comme dans Paramètres)
//
// reminder_count compte TOUS les emails envoyés pour la facture, y compris l'envoi
// initial (InvoicesPage.jsx le met à 1 à la création).
//
// Appelée avec : { dryRun?: true } — dryRun liste ce qui serait envoyé, sans rien envoyer.
//
// Deploy:  supabase functions deploy send-invoice-reminders --no-verify-jwt
// Secrets: CRON_SECRET (même valeur que dans le job pg_cron et que send-invoice-email),
//          SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (déjà présents par défaut)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const DAY_MS = 86_400_000;
// Marge pour que « tous les 7 jours » ne devienne pas 8 jours à cause de quelques secondes d'écart.
const TOLERANCE_MS = 2 * 60 * 60 * 1000;
const MAX_PER_RUN = 100;
const SEND_DELAY_MS = 600; // Resend limite le débit

// Même valeur par défaut que le champ « Nombre max de rappels » de Paramètres.
// Mets Infinity ici pour retrouver l'ancien comportement (illimité par défaut).
const DEFAULT_MAX_REMINDERS = 5;

// true = ne relancer que les factures dont l'échéance est dépassée.
// false (comportement actuel) = relancer toute facture impayée, échue ou non.
const ONLY_OVERDUE = false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface InvoiceProfile {
  plan: string | null;
  notif_overdue_reminder: boolean | null;
  reminder_frequency_days: number | null;
  reminder_max_count: number | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  status: string;
  reminder_count: number | null;
  last_reminder_sent_at: string | null;
  client: { email: string | null } | null;
  profile: InvoiceProfile | null;
}

Deno.serve(async (req) => {
  // Protège la fonction : seul le job cron (qui connaît le secret) peut l'appeler.
  // Si CRON_SECRET n'est pas défini, on refuse tout (sinon "Bearer undefined" passerait).
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!CRON_SECRET || !safeEqual(authHeader, `Bearer ${CRON_SECRET}`)) {
    return json({ error: "Non autorisé" }, 401);
  }

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = body?.dryRun === true;
  } catch { /* corps vide : mode normal */ }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let query = admin
    .from("invoices")
    .select(`
      id, invoice_number, status, reminder_count, last_reminder_sent_at,
      client:clients ( email ),
      profile:profiles ( plan, notif_overdue_reminder, reminder_frequency_days, reminder_max_count )
    `)
    .eq("status", "unpaid")
    .limit(500);

  if (ONLY_OVERDUE) {
    query = query.lt("due_date", new Date().toISOString().slice(0, 10));
  }

  const { data: invoices, error } = await query.returns<InvoiceRow[]>();

  if (error) {
    return json({ error: error.message }, 500);
  }

  let sentCount = 0;
  let skipped = 0;
  const errors: string[] = [];
  const details: Record<string, unknown>[] = [];

  for (const invoice of invoices ?? []) {
    if (sentCount >= MAX_PER_RUN) break; // le reste sera traité demain

    const profile = invoice.profile;
    if (!profile || !invoice.client?.email) { skipped++; continue; }

    // Le pro a désactivé les rappels dans Paramètres (null = activé, comme l'affiche Paramètres).
    if (profile.notif_overdue_reminder === false) { skipped++; continue; }

    // TEMPORAIREMENT DÉSACTIVÉ — plus de distinction Free/Pro tant que
    // l'abonnement Pro est inatteignable (pas de Stripe/SIRET actif).
    // Pour réactiver la distinction plan Free/Pro, remettre :
    //   const maxReminders = profile.plan === "pro"
    //     ? (profile.reminder_max_count && profile.reminder_max_count > 0 ? profile.reminder_max_count : Infinity)
    //     : Math.min(profile.reminder_max_count ?? 5, 5);
    const maxReminders = profile.reminder_max_count && profile.reminder_max_count > 0
      ? profile.reminder_max_count
      : DEFAULT_MAX_REMINDERS;
    const frequencyDays = profile.reminder_frequency_days ?? 7;
    const count = invoice.reminder_count ?? 0;

    if (count >= maxReminders) { skipped++; continue; }

    const lastSent = invoice.last_reminder_sent_at ? new Date(invoice.last_reminder_sent_at) : null;
    const dueForReminder =
      !lastSent || Date.now() - lastSent.getTime() >= frequencyDays * DAY_MS - TOLERANCE_MS;

    if (!dueForReminder) { skipped++; continue; }

    if (dryRun) {
      sentCount++;
      details.push({ invoice: invoice.invoice_number, to: invoice.client.email, reminderNumber: count + 1 });
      continue;
    }

    // On « réserve » la facture AVANT d'envoyer : si le cron se déclenche deux fois,
    // la 2e exécution ne retrouve plus le même reminder_count et saute la facture.
    let claim = admin
      .from("invoices")
      .update({ reminder_count: count + 1, last_reminder_sent_at: new Date().toISOString() })
      .eq("id", invoice.id)
      .eq("status", "unpaid");
    claim = invoice.reminder_count === null
      ? claim.is("reminder_count", null)
      : claim.eq("reminder_count", invoice.reminder_count);
    const { data: claimed, error: claimErr } = await claim.select("id");
    if (claimErr || !claimed?.length) { skipped++; continue; }

    // send-invoice-email relit lui-même tout le contenu depuis la base à
    // partir du seul invoiceId — on ne lui envoie aucune donnée d'affichage.
    let ok = false;
    let failure = "";
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-invoice-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CRON_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invoiceId: invoice.id, reminder: true }),
      });
      ok = res.ok;
      if (!ok) failure = await res.text();
    } catch (err) {
      failure = err instanceof Error ? err.message : String(err);
    }

    if (ok) {
      sentCount++;
      details.push({ invoice: invoice.invoice_number, to: invoice.client.email, reminderNumber: count + 1 });
      await sleep(SEND_DELAY_MS);
    } else {
      errors.push(`Facture ${invoice.invoice_number}: ${failure}`);
      // On remet les compteurs d'origine pour réessayer à la prochaine exécution.
      await admin
        .from("invoices")
        .update({
          reminder_count: invoice.reminder_count,
          last_reminder_sent_at: invoice.last_reminder_sent_at,
        })
        .eq("id", invoice.id);
    }
  }

  console.log(`send-invoice-reminders: sent=${sentCount} skipped=${skipped} errors=${errors.length} dryRun=${dryRun}`);
  return json({ sent: sentCount, skipped, errors, dryRun, details });
});