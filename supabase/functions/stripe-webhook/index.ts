/**
 * Supabase Edge Function: stripe-webhook
 *
 * This is the most important backend function in the whole app (use for later).
 *
 * Deploy:
 *   supabase functions deploy stripe-webhook
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""  
);

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";


const MAX_BODY_BYTES = 256 * 1024; 

const STRIPE_FEE_RATE   = 0.014;
const STRIPE_FEE_FIXED  = 0.20;

interface StripeEvent {
  type: string;
  data: { object: Record<string, unknown> };
}

function calculateFees(grossAmount: number) {
  const stripeFee    = Math.round((grossAmount * STRIPE_FEE_RATE + STRIPE_FEE_FIXED) * 100) / 100;
  const netAmount    = Math.round((grossAmount - stripeFee) * 100) / 100;
  return { stripeFee, netAmount };
}


async function readTextWithLimit(req: Request, maxBytes: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}


function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map(part => part.split("=") as [string, string])
  );
  const timestamp = parts.t;
  const expectedSig = parts.v1;
  if (!timestamp || !expectedSig) return false;

  // Reject anything older than 5 minutes — prevents replay attacks
  // with a captured/leaked signed payload.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) {
    console.error("Webhook timestamp too old — possible replay attempt");
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const computedSig = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(computedSig, expectedSig);
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const rawBody = await readTextWithLimit(req, MAX_BODY_BYTES);
  if (rawBody === null) {
    return new Response("Payload too large", { status: 413 });
  }

  const isValid = await verifyStripeSignature(rawBody, signature, WEBHOOK_SECRET);
  if (!isValid) {
    console.error("Webhook signature verification failed");
    return new Response("Invalid signature", { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  console.log(`[webhook] ${event.type}`);

  try {
    switch (event.type) {

      // ── Client paid an invoice, or a booking deposit ──
      case "payment_intent.succeeded": {
        const pi = event.data.object as {
          id: string;
          amount: number;
          latest_charge?: string;
          metadata?: {
            invoice_id?: string;
            booking_request_id?: string;
            profile_id?: string;
            client_name?: string;
          };
        };

        const invoiceId = pi.metadata?.invoice_id;
        const bookingRequestId = pi.metadata?.booking_request_id;
        const profileId = pi.metadata?.profile_id;

        if (!profileId || (!invoiceId && !bookingRequestId)) {
          console.warn("payment_intent.succeeded: missing metadata", pi.id);
          break;
        }

        const grossAmount = pi.amount / 100; // Stripe stores in pence
        const { stripeFee, netAmount } = calculateFees(grossAmount);

        // ── Acompte de réservation ──
        if (bookingRequestId) {
          await supabase.from("booking_requests")
            .update({ deposit_paid: true, deposit_paid_at: new Date().toISOString() })
            .eq("id", bookingRequestId);

          await supabase.from("payment_transactions").insert({
            profile_id:               profileId,
            booking_request_id:      bookingRequestId,
            stripe_payment_intent_id: pi.id,
            stripe_charge_id:         pi.latest_charge,
            gross_amount:             grossAmount,
            stripe_fee:               stripeFee,
            net_amount:               netAmount,
            status:                   "completed",
            description:              "Booking deposit",
            client_name:              pi.metadata?.client_name ?? "",
            paid_at:                  new Date().toISOString(),
          });

          console.log(`✓ Booking deposit recorded: £${grossAmount} (Stripe fee: £${stripeFee}, net: £${netAmount})`);
          break;
        }

        // ── Facture ──
        const { data: invoice } = await supabase
          .from("invoices")
          .select("*, client:clients(id,name,email)")
          .eq("id", invoiceId)
          .single();

        await supabase.from("payment_transactions").insert({
          profile_id:               profileId,
          invoice_id:               invoiceId,
          client_id:                invoice?.client_id,
          stripe_payment_intent_id: pi.id,
          stripe_charge_id:         pi.latest_charge,
          gross_amount:             grossAmount,
          stripe_fee:               stripeFee,
          net_amount:               netAmount,
          status:                   "completed",
          description:              invoice?.job?.title ?? "Trade services",
          client_name:              invoice?.client?.name ?? pi.metadata?.client_name ?? "",
          client_email:             invoice?.client?.email ?? "",
          paid_at:                  new Date().toISOString(),
        });

        await supabase.from("invoices")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", invoiceId);

        console.log(`✓ Payment recorded: £${grossAmount} (Stripe fee: £${stripeFee}, net: £${netAmount})`);
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as { id: string; metadata?: { invoice_id?: string } };
        const invoiceId = pi.metadata?.invoice_id;
        if (invoiceId) {
          await supabase.from("payment_transactions")
            .update({ status: "failed" })
            .eq("stripe_payment_intent_id", pi.id);
        }
        break;
      }

      case "payout.paid": {
        const payout = event.data.object as { id: string; arrival_date: number };
        await supabase.from("payouts")
          .update({ status: "paid", arrival_date: new Date(payout.arrival_date * 1000).toISOString().slice(0, 10) })
          .eq("stripe_payout_id", payout.id);
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as { id: string };
        await supabase.from("payouts")
          .update({ status: "failed" })
          .eq("stripe_payout_id", payout.id);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as { id: string };
        await supabase.from("payment_transactions")
          .update({ status: "refunded" })
          .eq("stripe_charge_id", charge.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error handling ${event.type}:`, message);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});