// supabase/functions/send-review-request/index.ts
//
// Envoie une demande d'avis Google par EMAIL uniquement, à l'adresse
// enregistrée du client. Appelée automatiquement quand une intervention
// est marquée comme terminée (voir JobsPage.jsx -> autoSendReviewRequest),
// et aussi manuellement depuis ReviewsPage ("Demander un avis").
//
// Ne prend qu'un jobId — le client, le nom du pro et son lien Google sont
// relus ici depuis la base, jamais fournis par le navigateur, pour qu'il
// soit impossible de faire envoyer un faux email "de la part" d'un autre
// pro à n'importe quelle adresse.
//
// Pas de SMS ici : Vimen fonctionne uniquement par email pour ce type
// de notification.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyToken } from "https://esm.sh/@clerk/backend@1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLERK_SECRET_KEY = Deno.env.get("CLERK_SECRET_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "reviews@vimen.app";
const FROM_NAME  = Deno.env.get("FROM_NAME")  ?? "Vimen";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
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

type JobWithClient = {
  title: string | null;
  profile_id: string;
  client: { name: string | null; email: string | null } | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: CORS });

  try {
    const callerProfileId = await getVerifiedProfileId(req);

    const { jobId } = await req.json();
    if (typeof jobId !== "string" || !jobId) {
      return json({ error: "jobId requis" }, 400);
    }

    const { data: job, error: jErr } = await supabase
      .from("jobs")
      .select("title, profile_id, client:clients(name,email)")
      .eq("id", jobId)
      .single<JobWithClient>();

    if (jErr || !job) return json({ error: "Intervention introuvable" }, 404);
    if (job.profile_id !== callerProfileId) return json({ error: "Intervention introuvable" }, 404);
    if (!job.client?.email) return json({ error: "Ce client n'a pas d'adresse email" }, 400);

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, trade, extra_fields")
      .eq("id", callerProfileId)
      .single();

    const placeId = profile?.extra_fields?.google_place_id;
    const googleUrl = placeId
      ? `https://g.page/r/${placeId}/review`
      : `https://www.google.com/search?q=${encodeURIComponent((profile?.name || "") + " " + (profile?.trade || ""))}`;

    const clientName = job.client.name ?? "there";
    const profileName = profile?.name ?? "us";
    const jobTitle = job.title ?? "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f4f1;color:#131211}
  .wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e3de}
  .top{background:#E8500A;padding:20px 32px}
  .logo{color:#fff;font-size:20px;font-weight:900;letter-spacing:-0.5px}
  .body{padding:36px 36px 28px}
  .stars{font-size:26px;color:#F59E0B;letter-spacing:4px;margin-bottom:20px}
  .cta-btn{display:block;background:#E8500A;color:#fff;text-decoration:none;padding:15px 28px;border-radius:10px;font-size:16px;font-weight:700;text-align:center;margin:24px 0 20px}
  .footer{text-align:center;padding:18px;font-size:12px;color:#aaa;border-top:1px solid #eee}
</style>
</head>
<body>
<div class="wrap">
  <div class="top"><div class="logo">Vimen</div></div>
  <div class="body">
    <p style="font-size:15px;margin-bottom:20px">Hi ${clientName},</p>
    <p style="font-size:14px;color:#555;line-height:1.6;margin-bottom:8px">
      Thanks for choosing <strong>${profileName}</strong>${jobTitle ? ` for "${jobTitle}"` : ""}.
      If you were happy with the work, a quick Google review would mean a lot.
    </p>
    <div class="stars">★★★★★</div>
    <a class="cta-btn" href="${googleUrl}">Leave a Google review →</a>
    <p style="font-size:13px;color:#888;line-height:1.6">
      It only takes a minute, and it really helps ${profileName} grow.
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
        from: `${profileName} via ${FROM_NAME} <${FROM_EMAIL}>`,
        to: [job.client.email],
        subject: `How did we do${profileName ? `, from ${profileName}` : ""}?`,
        html,
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.message ?? "Resend API error");

    return json({ success: true, id: result.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-review-request error:", message);
    return json({ error: message }, 500);
  }
});