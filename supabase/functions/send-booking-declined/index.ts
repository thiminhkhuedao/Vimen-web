/**
 * Supabase Edge Function: send-booking-declined
 *
 * Appelée par le pro (JWT Clerk) APRÈS avoir refusé une demande de réservation
 * (voir BookingPage.jsx -> confirmDecline()). Prévient le client par email, avec un
 * message facultatif écrit par le pro et un lien vers sa page de réservation.
 *
 * Sécurité :
 *   - le profil est déduit du jeton Clerk vérifié, jamais fourni par l'appelant ;
 *   - la demande doit appartenir à ce profil ET avoir déjà le statut « declined » ;
 *   - un seul email par demande (colonne decline_email_sent_at) : pas de renvoi en boucle ;
 *   - tout texte saisi par un utilisateur est échappé avant d'entrer dans le HTML.
 *
 * Appelée avec : { bookingRequestId, message? }
 * Renvoie :      { success: true, emailSent, alreadySent? } ou { error }
 *
 * Deploy:   supabase functions deploy send-booking-declined --no-verify-jwt
 * Secrets:  RESEND_API_KEY, APP_URL, CLERK_SECRET_KEY (déjà définis pour les autres fonctions)
 * SQL:      sql/017_decline_email_sent.sql (colonne decline_email_sent_at)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyToken } from "https://esm.sh/@clerk/backend@1";
import { corsHeaders, handleCors, readJsonWithLimit } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLERK_SECRET_KEY = Deno.env.get("CLERK_SECRET_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "bookings@vimen.app";
const APP_URL = Deno.env.get("APP_URL") ?? "https://vimen.app";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );

const safeFromName = (s: unknown): string =>
  String(s ?? "").replace(/[<>"\r\n]/g, "").trim() || "Vimen";

async function getVerifiedProfileId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Token de session manquant");
  if (!CLERK_SECRET_KEY) throw new Error("CLERK_SECRET_KEY non configuré côté serveur");

  const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
  const { data: profile, error } = await supabase
    .from("profiles").select("id").eq("clerk_id", payload.sub).single();
  if (error || !profile) throw new Error("Profil introuvable");
  return profile.id;
}

const STRINGS = {
  fr: {
    locale: "fr-FR",
    subject: "À propos de votre demande de réservation",
    greeting: (n: string) => `Bonjour ${n},`,
    body: (pro: string, service: string | null, slot: string) =>
      `Malheureusement, ${pro} ne peut pas donner suite à votre demande de réservation${service ? ` pour <strong>${service}</strong>` : ""}${slot ? ` (${slot})` : ""}.`,
    messageFrom: (pro: string) => `Message de ${pro} :`,
    other: "Vous pouvez choisir un autre créneau qui vous convient :",
    cta: "Choisir un autre créneau",
    reply: "Vous pouvez aussi répondre directement à cet email.",
    at: "à",
    sentVia: "Envoyé via",
  },
  en: {
    locale: "en-GB",
    subject: "About your booking request",
    greeting: (n: string) => `Hello ${n},`,
    body: (pro: string, service: string | null, slot: string) =>
      `Unfortunately, ${pro} is unable to accept your booking request${service ? ` for <strong>${service}</strong>` : ""}${slot ? ` (${slot})` : ""}.`,
    messageFrom: (pro: string) => `Message from ${pro}:`,
    other: "You are welcome to pick another time that suits you:",
    cta: "Choose another time",
    reply: "You can also reply directly to this email.",
    at: "at",
    sentVia: "Sent via",
  },
} as const;

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const callerProfileId = await getVerifiedProfileId(req);

    const { data: bodyRaw, error: sizeError } = await readJsonWithLimit(req, 10 * 1024);
    if (sizeError) return json({ error: sizeError }, sizeError === "payload_too_large" ? 413 : 400);
    const { bookingRequestId, message } = bodyRaw as { bookingRequestId?: unknown; message?: unknown };
    if (typeof bookingRequestId !== "string" || !bookingRequestId) {
      return json({ error: "bookingRequestId requis" }, 400);
    }
    // Message facultatif : 500 caractères maximum, sans caractères de contrôle
    // (on garde les retours à la ligne et les tabulations, on retire les autres caractères de contrôle)
    const personalMessage = typeof message === "string"
      ? Array.from(message)
          .filter((ch) => {
            const code = ch.charCodeAt(0);
            return code >= 32 || code === 9 || code === 10 || code === 13;
          })
          .join("")
          .trim()
          .slice(0, 500)
      : "";

    const { data: booking, error: bErr } = await supabase
      .from("booking_requests")
      .select("id, profile_id, status, customer_name, customer_email, preferred_date, preferred_time, decline_email_sent_at, service:services(name)")
      .eq("id", bookingRequestId)
      .single();

    if (bErr || !booking) return json({ error: "Réservation introuvable" }, 404);
    if (booking.profile_id !== callerProfileId) return json({ error: "Réservation introuvable" }, 404);
    if (booking.status !== "declined") return json({ error: "Cette demande n'est pas refusée" }, 400);
    if (!booking.customer_email) return json({ error: "Ce client n'a pas d'adresse email" }, 400);
    if (booking.decline_email_sent_at) return json({ success: true, emailSent: true, alreadySent: true });

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email, booking_slug, language")
      .eq("id", callerProfileId)
      .single();

    // On « réserve » l'envoi avant de partir : deux clics rapides ne produisent qu'un seul email.
    const nowIso = new Date().toISOString();
    const { data: claimed } = await supabase
      .from("booking_requests")
      .update({ decline_email_sent_at: nowIso })
      .eq("id", bookingRequestId)
      .is("decline_email_sent_at", null)
      .select("id");
    if (!claimed?.length) return json({ success: true, emailSent: true, alreadySent: true });

    if (!RESEND_API_KEY) {
      console.error("send-booking-declined: RESEND_API_KEY non configuré, email non envoyé");
      await supabase.from("booking_requests").update({ decline_email_sent_at: null }).eq("id", bookingRequestId);
      return json({ success: true, emailSent: false });
    }

    const lang = profile?.language === "en" ? "en" : "fr";
    const s = STRINGS[lang];
    const proName = esc(profile?.name ?? (lang === "en" ? "your provider" : "votre prestataire"));
    const serviceName = (booking.service as { name?: string } | null)?.name ?? null;

    let slot = "";
    if (booking.preferred_date) {
      try {
        const d = new Date(booking.preferred_date).toLocaleDateString(s.locale, { weekday: "long", day: "numeric", month: "long" });
        const t = booking.preferred_time ? String(booking.preferred_time).slice(0, 5) : "";
        slot = t ? `${d} ${s.at} ${t}` : d;
      } catch { /* date illisible : on n'affiche pas de créneau */ }
    }

    const bookingUrl = profile?.booking_slug ? `${APP_URL}/b/${encodeURIComponent(profile.booking_slug)}` : null;

    const messageBlock = personalMessage
      ? `<div style="background:#f8f7f5;border-left:4px solid #E8500A;border-radius:6px;padding:14px 18px;margin:20px 0;font-size:14px;line-height:1.7">
           <div style="font-size:12px;font-weight:700;color:#999;margin-bottom:6px">${s.messageFrom(proName)}</div>
           ${esc(personalMessage).replace(/\n/g, "<br/>")}
         </div>`
      : "";

    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f4f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#131211">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e3de">
    <div style="background:#E8500A;padding:20px 32px"><div style="color:#fff;font-size:20px;font-weight:900">Vimen</div></div>
    <div style="padding:36px">
      <p style="font-size:15px;margin:0 0 16px">${s.greeting(esc(booking.customer_name))}</p>
      <p style="font-size:14px;color:#555;line-height:1.6;margin:0">${s.body(proName, serviceName ? esc(serviceName) : null, esc(slot))}</p>
      ${messageBlock}
      ${bookingUrl ? `<p style="font-size:14px;color:#555;line-height:1.6;margin:20px 0 0">${s.other}</p>
      <a href="${esc(bookingUrl)}" style="display:block;background:#E8500A;color:#fff;text-decoration:none;padding:15px 28px;border-radius:10px;font-size:16px;font-weight:700;text-align:center;margin:16px 0 6px">${s.cta}</a>` : ""}
      ${profile?.email ? `<p style="font-size:12px;color:#999;margin:18px 0 0">${s.reply}</p>` : ""}
    </div>
    <div style="text-align:center;padding:18px;font-size:12px;color:#aaa;border-top:1px solid #eee">${s.sentVia} <a href="https://vimen.app" style="color:#E8500A;text-decoration:none">Vimen</a></div>
  </div>
</body></html>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${safeFromName(profile?.name)} <${FROM_EMAIL}>`,
        to: [booking.customer_email],
        ...(profile?.email ? { reply_to: profile.email } : {}),
        subject: s.subject,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.json().catch(() => ({}));
      console.error("send-booking-declined: Resend error", errBody);
      // On libère la réservation pour permettre un nouvel essai
      await supabase.from("booking_requests").update({ decline_email_sent_at: null }).eq("id", bookingRequestId);
      return json({ success: true, emailSent: false });
    }

    return json({ success: true, emailSent: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-booking-declined error:", msg);
    return json({ error: msg }, 500);
  }
});