/**
 * Supabase Edge Function: send-booking-confirmation
 *
 * Appelée par le pro (JWT Clerk) juste après avoir accepté une demande de
 * réservation (voir BookingPage.jsx -> respond()). Ne fait JAMAIS confiance
 * à un montant fourni par l'appelant : le service et son éventuelle
 * configuration d'acompte sont relus depuis la base, jamais construits
 * côté client.
 *
 * Si le service lié a un acompte configuré (deposit_enabled) ET que le pro
 * a un compte Stripe connecté, on crée un lien de paiement Stripe DIRECTEMENT
 * sur son compte connecté (en-tête Stripe-Account) — l'argent va chez le pro,
 * jamais chez Vimen, exactement comme pour les factures.
 *
 * Si le pro n'a pas connecté Stripe, on envoie quand même l'email de
 * confirmation, sans lien de paiement, et on le signale dans la réponse pour
 * que l'interface puisse le prévenir.
 *
 * Appelée avec : { bookingRequestId }
 * Renvoie :      { success: true, depositRequired, depositLinkCreated } ou { error }
 *
 * Deploy:   supabase functions deploy send-booking-confirmation
 * Secrets:  STRIPE_SECRET_KEY, RESEND_API_KEY, APP_URL, CLERK_SECRET_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyToken } from "https://esm.sh/@clerk/backend@1";
import { corsHeaders, handleCors, readJsonWithLimit } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLERK_SECRET_KEY = Deno.env.get("CLERK_SECRET_KEY");
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "bookings@vimen.app";
const APP_URL = Deno.env.get("APP_URL") ?? "https://vimen.app";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function getVerifiedProfileId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Token de session manquant");
  if (!CLERK_SECRET_KEY) throw new Error("CLERK_SECRET_KEY non configuré côté serveur");

  const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
  const clerkId = payload.sub;

  const { data: profile, error } = await supabase
    .from("profiles").select("id").eq("clerk_id", clerkId).single();
  if (error || !profile) throw new Error("Profil introuvable");
  return profile.id;
}

function toStripeParams(obj: unknown, prefix = ""): [string, string][] {
  const pairs: [string, string][] = [];
  if (obj === null || obj === undefined) return pairs;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => pairs.push(...toStripeParams(item, `${prefix}[${i}]`)));
    return pairs;
  }
  if (typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      pairs.push(...toStripeParams(value, prefix ? `${prefix}[${key}]` : key));
    }
    return pairs;
  }
  pairs.push([prefix, String(obj)]);
  return pairs;
}

async function stripeRequest(path: string, body: Record<string, unknown>, connectedAccountId: string) {
  const params = new URLSearchParams(toStripeParams(body));
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Stripe-Account": connectedAccountId, // charge directe sur le compte du pro, jamais sur celui de Vimen
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe API error (${res.status})`);
  return json;
}

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

    const { data: bodyRaw, error: sizeError } = await readJsonWithLimit(req, 5 * 1024);
    if (sizeError) return json({ error: sizeError }, sizeError === "payload_too_large" ? 413 : 400);
    const { bookingRequestId } = bodyRaw as { bookingRequestId?: unknown };
    if (typeof bookingRequestId !== "string" || !bookingRequestId) {
      return json({ error: "bookingRequestId requis" }, 400);
    }

    const { data: booking, error: bErr } = await supabase
      .from("booking_requests")
      .select("*, service:services(name, price, deposit_enabled, deposit_type, deposit_amount)")
      .eq("id", bookingRequestId)
      .single();

    if (bErr || !booking) return json({ error: "Réservation introuvable" }, 404);
    if (booking.profile_id !== callerProfileId) return json({ error: "Réservation introuvable" }, 404);
    if (!booking.customer_email) return json({ error: "Ce client n'a pas d'adresse email" }, 400);

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, trade, stripe_account_id")
      .eq("id", callerProfileId)
      .single();

    const service = booking.service;
    const depositEnabled = Boolean(service?.deposit_enabled);
    let depositAmount: number | null = null;
    let depositLinkUrl: string | null = null;
    let depositLinkCreated = false;
    let stripeNotConnected = false;

    if (depositEnabled) {
      const basePrice = Number(booking.quoted_price ?? service?.price ?? 0);
      depositAmount = service.deposit_type === "percent"
        ? Math.round(basePrice * (Number(service.deposit_amount) / 100) * 100) / 100
        : Number(service.deposit_amount);

      if (profile?.stripe_account_id && depositAmount > 0) {
        const amountPence = Math.round(depositAmount * 100);
        const link = await stripeRequest("payment_links", {
          line_items: [{
            price_data: {
              currency: "eur",
              product_data: {
                name: `Acompte — ${service.name}`,
                description: `Acompte pour votre réservation avec ${profile?.name ?? ""}`,
              },
              unit_amount: amountPence,
            },
            quantity: 1,
          }],
          after_completion: {
            type: "redirect",
            redirect: { url: `${APP_URL}/booking-confirmed?booking=${bookingRequestId}` },
          },
          metadata: {
            booking_request_id: bookingRequestId,
            profile_id: callerProfileId,
            client_name: booking.customer_name ?? "",
            client_email: booking.customer_email ?? "",
          },
        }, profile.stripe_account_id);

        depositLinkUrl = link.url;
        depositLinkCreated = true;

        await supabase.from("booking_requests").update({
          deposit_amount: depositAmount,
          stripe_payment_link_url: link.url,
          stripe_payment_link_id: link.id,
        }).eq("id", bookingRequestId);
      } else if (!profile?.stripe_account_id) {
        stripeNotConnected = true;
      }
    }

    const dateLabel = booking.preferred_date
      ? new Date(booking.preferred_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
      : "";

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f4f1;color:#131211}
  .wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e3de}
  .top{background:#E8500A;padding:20px 32px}
  .logo{color:#fff;font-size:20px;font-weight:900;letter-spacing:-0.5px}
  .body{padding:36px}
  .detail{background:#f8f7f5;border-radius:10px;padding:16px 18px;margin:20px 0;font-size:14px;line-height:1.8}
  .cta-btn{display:block;background:#E8500A;color:#fff;text-decoration:none;padding:15px 28px;border-radius:10px;font-size:16px;font-weight:700;text-align:center;margin:22px 0 6px}
  .footer{text-align:center;padding:18px;font-size:12px;color:#aaa;border-top:1px solid #eee}
</style></head>
<body>
<div class="wrap">
  <div class="top"><div class="logo">Vimen</div></div>
  <div class="body">
    <p style="font-size:15px;margin-bottom:16px">Bonjour ${booking.customer_name ?? ""},</p>
    <p style="font-size:14px;color:#555;line-height:1.6">
      Bonne nouvelle : ${profile?.name ?? "votre prestataire"} a confirmé votre réservation${service?.name ? ` pour <strong>${service.name}</strong>` : ""}.
    </p>
    <div class="detail">
      ${dateLabel ? `<div><b>Date :</b> ${dateLabel}</div>` : ""}
      ${depositAmount ? `<div><b>Acompte demandé :</b> ${depositAmount.toFixed(2)} €</div>` : ""}
    </div>
    ${depositLinkUrl ? `<a class="cta-btn" href="${depositLinkUrl}">Régler l'acompte de ${depositAmount?.toFixed(2)} €</a>
    <p style="font-size:12px;color:#999;text-align:center">Paiement sécurisé par carte via Stripe.</p>` : ""}
  </div>
  <div class="footer">Envoyé via <a href="https://vimen.app" style="color:#E8500A;text-decoration:none">Vimen</a></div>
</div>
</body></html>`;

    if (RESEND_API_KEY) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${profile?.name ?? "Vimen"} <${FROM_EMAIL}>`,
          to: [booking.customer_email],
          subject: `Réservation confirmée${service?.name ? ` — ${service.name}` : ""}`,
          html,
        }),
      });
      if (!emailRes.ok) {
        const errBody = await emailRes.json().catch(() => ({}));
        console.error("send-booking-confirmation: Resend error", errBody);
      }
    }

    return json({
      success: true,
      depositRequired: depositEnabled,
      depositLinkCreated,
      stripeNotConnected,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-booking-confirmation error:", message);
    return json({ error: message }, 500);
  }
});