// supabase/functions/send-quote-email/index.ts
//
// Envoi manuel d'un devis par email (bouton "Envoyer par email" dans
// QuotesPage). Ne prend qu'un quoteId — TOUT le contenu de l'email
// (montant, nom du client, coordonnées du pro) est relu ici depuis la
// base, jamais fourni par le navigateur, pour qu'il soit impossible
// d'usurper un autre pro ou de fabriquer un faux montant.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyToken } from "https://esm.sh/@clerk/backend@1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLERK_SECRET_KEY = Deno.env.get("CLERK_SECRET_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "quotes@vimen.app";
const FROM_NAME = Deno.env.get("FROM_NAME") ?? "Vimen";
const APP_URL = Deno.env.get("APP_URL") ?? "https://vimen.app";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£", EUR: "€", USD: "$", CAD: "C$", AUD: "A$", CHF: "CHF ",
};

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

type QuoteRow = Record<string, any> & {
  client: { name: string | null; email: string | null } | null;
  profile: { name: string | null; email: string | null; phone: string | null; currency: string | null } | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: CORS });

  try {
    const callerProfileId = await getVerifiedProfileId(req);

    const { quoteId } = await req.json();
    if (typeof quoteId !== "string" || !quoteId) {
      return json({ error: "quoteId requis" }, 400);
    }

    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*, client:clients(name,email), profile:profiles(name,email,phone,currency)")
      .eq("id", quoteId)
      .single<QuoteRow>();

    if (qErr || !quote) return json({ error: "Devis introuvable" }, 404);
    // Ne révèle jamais si le devis existe pour quelqu'un d'autre.
    if (quote.profile_id !== callerProfileId) return json({ error: "Devis introuvable" }, 404);
    if (!quote.client?.email) return json({ error: "Ce client n'a pas d'adresse email" }, 400);
    if (!quote.public_token) return json({ error: "Ce devis n'a pas de lien public" }, 400);

    const clientName = quote.client.name ?? "";
    const tradeName = quote.profile?.name ?? "";
    const tradeEmail = quote.profile?.email ?? "";
    const tradePhone = quote.profile?.phone ?? "";
    const currencyCode = quote.profile?.currency ?? "EUR";
    const quoteUrl = `${APP_URL}/quote/${quote.public_token}`;
    const validUntil = quote.valid_until
      ? new Date(quote.valid_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : null;

    const fmtMoney = (n: number) =>
      `${CURRENCY_SYMBOLS[currencyCode] ?? CURRENCY_SYMBOLS.EUR}${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f4f1;color:#131211}
  .wrap{max-width:580px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e3de}
  .top{background:#E8500A;padding:20px 32px}
  .logo{color:#fff;font-size:20px;font-weight:900;letter-spacing:-0.5px}
  .body{padding:36px 36px 28px}
  .quote-num{font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px}
  .quote-sub{font-size:13px;color:#888;margin-bottom:24px}
  .amount-box{background:#f7f6f3;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px}
  .amount-lbl{font-size:12px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}
  .amount-val{font-size:30px;font-weight:900;color:#E8500A;letter-spacing:-0.5px}
  .cta-btn{display:block;background:#E8500A;color:#fff;text-decoration:none;padding:15px 28px;border-radius:10px;font-size:16px;font-weight:700;text-align:center;margin:0 0 20px}
  .footer{text-align:center;padding:18px;font-size:12px;color:#aaa;border-top:1px solid #eee}
</style>
</head>
<body>
<div class="wrap">
  <div class="top"><div class="logo">⚡ Vimen</div></div>
  <div class="body">
    <p style="font-size:15px;margin-bottom:24px">Hi ${clientName},</p>
    <p style="font-size:14px;color:#555;margin-bottom:24px;line-height:1.6">
      <strong>${tradeName}</strong> has sent you a quote for your review.
      ${validUntil ? `This quote is valid until <strong>${validUntil}</strong>.` : ""}
    </p>

    <div class="quote-num">${quote.quote_number}</div>

    <div class="amount-box">
      <div class="amount-lbl">Quote total</div>
      <div class="amount-val">${fmtMoney(quote.total)}</div>
    </div>

    <a class="cta-btn" href="${quoteUrl}">View & sign quote →</a>

    <p style="font-size:13px;color:#888;line-height:1.6">
      You can review the full breakdown and sign online, no account needed.
      Questions? Reply to ${tradeEmail}${tradePhone ? ` or call ${tradePhone}` : ""}.
    </p>
  </div>
  <div class="footer">Sent via <a href="https://vimen.app" style="color:#E8500A;text-decoration:none">Vimen</a></div>
</div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${tradeName} via ${FROM_NAME} <${FROM_EMAIL}>`,
        to: [quote.client.email],
        subject: `Quote ${quote.quote_number} from ${tradeName} — ${fmtMoney(quote.total)}`,
        html,
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.message ?? "Resend API error");

    return json({ success: true, id: result.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-quote-email error:", message);
    return json({ error: message }, 500);
  }
});