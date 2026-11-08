/**
 * Supabase Edge Function: stripe-connect
 *
 * SÉCURITÉ — IDOR corrigé 
 * Deploy:
 *   supabase functions deploy stripe-connect
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

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

async function stripeRequest(method: "GET" | "POST", path: string, body?: Record<string, unknown>) {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const opts: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${secretKey}` },
  };
  if (body) {
    opts.headers = { ...opts.headers, "Content-Type": "application/x-www-form-urlencoded" };
    opts.body = new URLSearchParams(toStripeParams(body)).toString();
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe API error (${res.status})`);
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: CORS });
    }

    const { returnUrl } = await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: myProfile, error: profileErr } = await userClient
      .from("profiles")
      .select("id, email, stripe_account_id")
      .single();

    if (profileErr || !myProfile) {
      return new Response(JSON.stringify({ error: "Profil introuvable" }), { status: 403, headers: CORS });
    }

    const profileId = myProfile.id; // dérivé du JWT 
    let accountId = myProfile.stripe_account_id;

    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // First time connecting — create a new Express connected account.
    if (!accountId) {
      const account = await stripeRequest("POST", "accounts", {
        type: "express",
        email: myProfile.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers:     { requested: true },
        },
      });
      accountId = account.id;

      await supabaseAdmin
        .from("profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", profileId);
    }

    
    const accountLink = await stripeRequest("POST", "account_links", {
      account:     accountId,
      refresh_url: returnUrl,
      return_url:  returnUrl,
      type:        "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url }), { headers: CORS });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("stripe-connect error:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: CORS });
  }
});