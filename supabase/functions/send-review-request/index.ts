// supabase/functions/send-review-request/index.ts
//
// Envoie une demande d'avis Google par EMAIL uniquement, à l'adresse
// enregistrée du client. Appelée automatiquement quand une intervention
// est marquée comme terminée (voir JobsPage.jsx -> handleComplete), et
// aussi manuellement depuis ReviewsPage ("Demander un avis").
//
// Pas de SMS ici : Vimen fonctionne uniquement par email pour ce type
// de notification.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const {
      toEmail,       // client email address (required)
      clientName,
      profileName,   // tradesperson / business name
      jobTitle,
      googleUrl,     // link to leave a Google review
    } = await req.json();

    if (!toEmail) {
      return new Response(JSON.stringify({ error: "Missing client email address" }), {
        status: 400,
        headers: CORS,
      });
    }
    if (!googleUrl) {
      return new Response(JSON.stringify({ error: "Missing Google review link" }), {
        status: 400,
        headers: CORS,
      });
    }

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
    <p style="font-size:15px;margin-bottom:20px">Hi ${clientName ?? "there"},</p>
    <p style="font-size:14px;color:#555;line-height:1.6;margin-bottom:8px">
      Thanks for choosing <strong>${profileName ?? "us"}</strong>${jobTitle ? ` for "${jobTitle}"` : ""}.
      If you were happy with the work, a quick Google review would mean a lot.
    </p>
    <div class="stars">★★★★★</div>
    <a class="cta-btn" href="${googleUrl}">Leave a Google review →</a>
    <p style="font-size:13px;color:#888;line-height:1.6">
      It only takes a minute, and it really helps ${profileName ?? "us"} grow.
    </p>
  </div>
  <div class="footer">Sent via <a href="https://vimen.app" style="color:#E8500A;text-decoration:none">Vimen</a></div>
</div>
</body>
</html>`;

    const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "reviews@vimen.app";
    const FROM_NAME  = Deno.env.get("FROM_NAME")  ?? "Vimen";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${profileName ?? FROM_NAME} via ${FROM_NAME} <${FROM_EMAIL}>`,
        to: [toEmail],
        subject: `How did we do${profileName ? `, from ${profileName}` : ""}?`,
        html,
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.message ?? "Resend API error");

    return new Response(JSON.stringify({ success: true, id: result.id }), { headers: CORS });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-review-request error:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: CORS });
  }
});