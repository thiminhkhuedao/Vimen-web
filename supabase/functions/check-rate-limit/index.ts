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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant (normalement injectés automatiquement par Supabase)");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface RateLimit {
  windowSec: number;
  maxByIp: number;
  maxByIdentifier: number | null;
}

// Limites par action : { fenêtre en secondes, nombre max de tentatives }
const LIMITS: Record<string, RateLimit> = {
  login:            { windowSec: 5 * 60,  maxByIp: 20, maxByIdentifier: 5 },
  signup:           { windowSec: 60 * 60, maxByIp: 5,  maxByIdentifier: 1 },
  password_reset:   { windowSec: 15 * 60, maxByIp: 10, maxByIdentifier: 3 },
  contact_form:     { windowSec: 60 * 60, maxByIp: 5,  maxByIdentifier: null },
  booking_request:  { windowSec: 60 * 60, maxByIp: 10, maxByIdentifier: null },
  search:           { windowSec: 60,      maxByIp: 60, maxByIdentifier: null }, // anti-scraping
  profile_view:     { windowSec: 60,      maxByIp: 90, maxByIdentifier: null }, // anti-scraping
};

interface RateLimitRequestBody {
  action?: unknown;
  identifier?: unknown;
  turnstileToken?: unknown;
  honeypot?: unknown;
}

async function countEvents(bucketKey: string, windowSec: number): Promise<number> {
  const since = new Date(Date.now() - windowSec * 1000).toISOString();
  const { count, error } = await supabase
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("bucket_key", bucketKey)
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

async function recordEvent(bucketKey: string, action: string): Promise<void> {
  await supabase.from("rate_limit_events").insert({ bucket_key: bucketKey, action });
}

interface TurnstileResult {
  ok: boolean;
  codes: string[];     // codes d'erreur renvoyés par Cloudflare (ex. "timeout-or-duplicate"), pour les journaux
  hostname?: string;
}

async function verifyTurnstile(token: string | undefined, ip: string): Promise<TurnstileResult> {
  if (!token) return { ok: false, codes: ["missing-token"] };
  if (!TURNSTILE_SECRET_KEY) return { ok: false, codes: ["missing-secret-on-server"] }; // pas de secret configuré -> refuse par défaut, jamais par accident

  const params = new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token });
  // L'IP est facultative : on ne l'envoie que si elle a l'air valide (pas « unknown », pas de port ni de texte).
  if (/^[0-9a-fA-F:.]{3,45}$/.test(ip) && ip !== "unknown") params.set("remoteip", ip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const data = await res.json();
    return {
      ok: data.success === true,
      codes: Array.isArray(data["error-codes"]) ? data["error-codes"] : [],
      hostname: typeof data.hostname === "string" ? data.hostname : undefined,
    };
  } catch (err) {
    return { ok: false, codes: ["siteverify-unreachable: " + (err instanceof Error ? err.message : String(err))] };
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json({ allowed: false, reason: "method_not_allowed" }, 405);
  }

  try {
    const body: RateLimitRequestBody = await req.json();

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
      const captcha = await verifyTurnstile(turnstileToken, ip);
      if (!captcha.ok) {
        // Le détail n'est PAS renvoyé au client (rien à apprendre à un bot) : il va dans les journaux de la fonction.
        console.error("check-rate-limit: Turnstile refusé", JSON.stringify({ action, codes: captcha.codes, hostname: captcha.hostname ?? null }));
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
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return json({ allowed: false, reason: "server_error" }, 500);
  }
});