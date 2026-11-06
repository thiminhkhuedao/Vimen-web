// supabase/functions/send-invoice-reminders/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET       = Deno.env.get("CRON_SECRET")!;

interface InvoiceProfile {
  plan: string | null;
  reminder_frequency_days: number | null;
  reminder_max_count: number | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  status: string;
  reminder_count: number;
  last_reminder_sent_at: string | null;
  client_email_present: boolean; 
  profile: InvoiceProfile | null;
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: invoices, error } = await admin
    .from("invoices")
    .select(`
      id, invoice_number, status, reminder_count, last_reminder_sent_at,
      client:clients ( email ),
      profile:profiles ( plan, reminder_frequency_days, reminder_max_count )
    `)
    .eq("status", "unpaid")
    .lt("reminder_count", 999) 
    .returns<(InvoiceRow & { client: { email: string | null } | null })[]>();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sentCount = 0;
  const errors: string[] = [];

  for (const invoice of invoices ?? []) {
    const profile = invoice.profile;
    if (!profile) continue;
    if (!invoice.client?.email) continue;

    // TEMPORAIREMENT DÉSACTIVÉ — plus de distinction Free/Pro tant que
    // l'abonnement Pro est inatteignable (pas de Stripe/SIRET actif).
    // Illimité pour tout le monde, sauf si le pro a lui-même réglé un
    // plafond personnalisé dans Settings (reminder_max_count).
    const maxReminders = profile.reminder_max_count && profile.reminder_max_count > 0
      ? profile.reminder_max_count
      : Infinity;
    const frequencyDays = profile.reminder_frequency_days ?? 7;

    if (invoice.reminder_count >= maxReminders) continue;

    const lastSent = invoice.last_reminder_sent_at ? new Date(invoice.last_reminder_sent_at) : null;
    const dueForReminder =
      !lastSent || Date.now() - lastSent.getTime() >= frequencyDays * 24 * 60 * 60 * 1000;

    if (!dueForReminder) continue;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-invoice-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ invoiceId: invoice.id, reminder: true }),
    });

    if (res.ok) {
      await admin
        .from("invoices")
        .update({
          reminder_count: invoice.reminder_count + 1,
          last_reminder_sent_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);
      sentCount++;
    } else {
      errors.push(`Facture ${invoice.invoice_number}: ${await res.text()}`);
    }
  }

  return new Response(JSON.stringify({ sent: sentCount, errors }), {
    headers: { "Content-Type": "application/json" },
  });
});