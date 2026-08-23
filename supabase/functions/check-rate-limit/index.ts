// supabase/functions/check-rate-limit/index.ts
//
// Edge Function unique et réutilisable pour :
// 1. Rate limiting server-side (par IP, et par IP+identifiant si fourni)
// 2. Vérification server-side du token Turnstile (le check client ne suffit
//    jamais — un bot peut appeler ton endpoint sans jamais charger le widget)
//
// Appelée AVANT toute action sensible : login, signup, contact form,
// booking request, reset password.
//
// Déploiement :
//   supabase functions deploy check-rate-limit
//   supabase secrets set TURNSTILE_SECRET_KEY=xxxx   (Secret Key, PAS la Site Key)
//
// Appel depuis le front (exemple) :
//   const res = await fetch(`${SUPABASE_URL}/functions/v1/check-rate-limit`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       action: "login",
//       identifier: email,          // optionnel, ex: email pour un login
//       turnstileToken: captchaToken, // optionnel, requis pour signup/contact/booking
//       honeypot: honeypotValue,      // optionnel
//     }),
//   });
//   const { allowed, reason } = await res.json();
//   if (!allowed) { /* bloque, affiche reason */ }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Limites par action : { fenêtre en secondes, nombre max de tentatives }
const LIMITS = {
  login:            { windowSec: 5 * 60,  maxByIp: 20, maxByIdentifier: 5 },
  signup:           { windowSec: 60 * 60, maxByIp: 5,  maxByIdentifier: 1 },
  password_reset:   { windowSec: 15 * 60, maxByIp: 10, maxByIdentifier: 3 },
  contact_form:     { windowSec: 60 * 60, maxByIp: 5,  maxByIdentifier: null },
  booking_request:  { windowSec: 60 * 60, maxByIp: 10, maxByIdentifier: null },
  search:           { windowSec: 60,      maxByIp: 60, maxByIdentifier: null }, // anti-scraping
  profile_view:     { windowSec: 60,      maxByIp: 90, maxByIdentifier: null }, // anti-scraping
};

async function countEvents(bucketKey, windowSec) {
  const since = new Date(Date.now() - windowSec * 1000).toISOString();
  const { count, error } = await supabase
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("bucket_key", bucketKey)
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

async function recordEvent(bucketKey, action) {
  await supabase.from("rate_limit_events").insert({ bucket_key: bucketKey, action });
}

async function verifyTurnstile(token, ip) {
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: ip,
    }),
  });
  const data = await res.json();
  return data.success === true;
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json({ allowed: false, reason: "method_not_allowed" }, 405);
  }

  try {
    const body = await req.json();

    // Validation stricte : chaque champ doit être du bon type ou absent,
    // jamais faire confiance à ce que le client prétend envoyer.
    const { action, identifier, turnstileToken, honeypot } = body;
    if (typeof action !== "string") {
      return json({ allowed: false, reason: "invalid_action" }, 400);
    }
    if (identifier !== undefined && (typeof identifier !== "string" || identifier.length > 320)) {
      return json({ allowed: false, reason: "invalid_identifier" }, 400);
    }
    if (turnstileToken !== undefined && typeof turnstileToken !== "string") {
      return json({ allowed: false, reason: "invalid_turnstile_token" }, 400);
    }
    if (honeypot !== undefined && typeof honeypot !== "string") {
      return json({ allowed: false, reason: "invalid_honeypot" }, 400);
    }

    const limits = LIMITS[action];
    if (!limits) {
      return json({ allowed: false, reason: "unknown_action" }, 400);
    }

    // Honeypot rempli -> bot détecté, on rejette immédiatement sans même
    // consommer de quota (pas la peine de logguer une vraie tentative)
    if (honeypot && honeypot.trim().length > 0) {
      return json({ allowed: false, reason: "bot_detected" }, 200);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // Actions qui exigent un CAPTCHA vérifié server-side
    const requiresCaptcha = ["signup", "contact_form", "booking_request"].includes(action);
    if (requiresCaptcha) {
      const captchaOk = await verifyTurnstile(turnstileToken, ip);
      if (!captchaOk) {
        return json({ allowed: false, reason: "captcha_failed" }, 200);
      }
    }

    // Rate limit par IP
    const ipBucket = `${action}:${ip}`;
    const ipCount = await countEvents(ipBucket, limits.windowSec);
    if (ipCount >= limits.maxByIp) {
      return json({ allowed: false, reason: "rate_limited_ip" }, 200);
    }

    // Rate limit par identifiant (email pour login/signup) si applicable
    if (identifier && limits.maxByIdentifier) {
      const idBucket = `${action}:id:${identifier.toLowerCase()}`;
      const idCount = await countEvents(idBucket, limits.windowSec);
      if (idCount >= limits.maxByIdentifier) {
        return json({ allowed: false, reason: "rate_limited_identifier" }, 200);
      }
      await recordEvent(idBucket, action);
    }

    await recordEvent(ipBucket, action);

    return json({ allowed: true }, 200);
  } catch (err) {
    console.error(err);
    return json({ allowed: false, reason: "server_error" }, 500);
  }
});