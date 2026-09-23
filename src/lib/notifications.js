// src/lib/notifications.js

import { supabase } from "./supabase";

/* ── helpers ─────────────────────────────────────── */
const invoke = async (fn, body) => {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error || data?.error) {
    const msg = error?.message ?? data?.error;
    console.error(`[notifications] ${fn}:`, msg);
    return { success: false, error: msg };
  }
  return { success: true, ...data };
};

/* ══════════════════════════════════════════════════
   PUSH (Expo push service, mobile app only)
══════════════════════════════════════════════════ */

/**
 * Sends a push notification to a profile's registered device.
 * Safe to call from anywhere, including the public (unauthenticated)
 * booking page — the Edge Function looks up the push token itself
 * server-side rather than trusting the caller to supply it. If the
 * profile has no device registered (web-only, or push not granted),
 * this is a harmless no-op.
 *
 * @param {string} profileId
 * @param {string} title
 * @param {string} body
 * @param {object} [data]  - optional extra payload (e.g. { screen: "booking" })
 */
export async function sendPushNotification(profileId, title, body, data) {
  return invoke("send-push", { profileId, title, body, data });
}

/* ══════════════════════════════════════════════════
   EMAIL (Resend)
══════════════════════════════════════════════════ */

/**
 * Sends a full branded invoice email to the client.
 *
 * SÉCURITÉ : ne prend plus qu'un invoiceId — tout le contenu (client,
 * montant, coordonnées bancaires...) est relu depuis la base côté
 * serveur, jamais construit ici. Empêche qu'un appel direct à la
 * fonction (hors UI) puisse envoyer un email de facture falsifié.
 *
 * @param {string} invoiceId
 * @param {boolean} [reminder=false] - true pour un email de rappel
 */
export async function sendInvoiceEmail(invoiceId, reminder = false, options = {}) {
  if (!invoiceId) {
    return { success: false, error: "Missing invoice id" };
  }
  return invoke("send-invoice-email", {
    invoiceId,
    reminder,
    includeIban: options.includeIban ?? true,
    includeStripeLink: options.includeStripeLink ?? true,
  });
}

/**
 * Sends a quote to the client by email, with a link to view and sign
 * it online (no account needed on their end). All content (amount,
 * client, trade details) is re-read server-side from quoteId — nothing
 * here is trusted as-is.
 *
 * @param {string} quoteId
 */
export async function sendQuoteEmail(quoteId) {
  if (!quoteId) {
    return { success: false, error: "Missing quote id" };
  }
  return invoke("send-quote-email", { quoteId });
}

/* ══════════════════════════════════════════════════
   SMS (Twilio)
══════════════════════════════════════════════════ */

/**
 * Sends a job reminder SMS to the client (call this the day before).
 *
 * @param {object} job       - job row
 * @param {object} client    - client row (must have .phone)
 * @param {object} profile   - tradesperson profile
 */
export async function sendJobReminderSMS(job, client, profile) {
  if (!client?.phone) {
    return { success: false, error: "Client has no phone number" };
  }
  return invoke("send-sms", {
    type: "job_reminder",
    to:   client.phone,
    data: {
      clientName: client.name,
      tradeName:  profile.name,
      date: new Date(job.date).toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long",
      }),
      time:     job.time,
      jobTitle: job.title,
    },
  });
}

/**
 * Notifies the tradesperson via SMS when an invoice is paid.
 *
 * @param {object} invoice  - invoice row with .client joined
 * @param {object} profile  - tradesperson profile (needs .phone)
 */
export async function sendInvoicePaidSMS(invoice, profile) {
  if (!profile?.phone) {
    return { success: false, error: "Profile has no phone number" };
  }
  return invoke("send-sms", {
    type: "invoice_paid",
    to:   profile.phone,
    data: {
      invoiceNumber: invoice.invoice_number,
      amount:        invoice.amount,
      clientName:    invoice.client?.name ?? "your client",
    },
  });
}

/**
 * Notifies the tradesperson when a new booking request arrives.
 *
 * @param {object} booking  - booking_request row
 * @param {object} profile  - tradesperson profile (needs .phone)
 */
export async function sendNewBookingSMS(booking, profile) {
  if (!profile?.phone) {
    return { success: false, error: "Profile has no phone number" };
  }
  return invoke("send-sms", {
    type: "new_booking",
    to:   profile.phone,
    data: {
      customerName:  booking.customer_name,
      preferredDate: booking.preferred_date
        ? new Date(booking.preferred_date).toLocaleDateString("en-GB", {
            day: "numeric", month: "long",
          })
        : null,
    },
  });
}

/**
 * Same as sendNewBookingSMS, but callable from the PUBLIC (anonymous)
 * booking page — passes profileId instead of a phone number, so the
 * visitor's browser never needs read access to the professional's
 * phone. The Edge Function looks it up itself server-side. See the
 * "Recipient resolution" note at the top of send-sms/index.ts.
 *
 * @param {object} booking   - { customer_name, preferred_date }
 * @param {string} profileId
 */
export async function sendNewBookingSMSPublic(booking, profileId) {
  return invoke("send-sms", {
    type: "new_booking",
    profileId,
    data: {
      customerName:  booking.customer_name,
      preferredDate: booking.preferred_date
        ? new Date(booking.preferred_date).toLocaleDateString("en-GB", {
            day: "numeric", month: "long",
          })
        : null,
    },
  });
}

/**
 * Sends a review-request SMS to the client after a completed job,
 * asking them to leave a Google review.
 *
 * @param {object} client   - client row (must have .phone)
 * @param {object} job      - job row (for the job title in the message)
 * @param {object} profile  - tradesperson profile (needs .google_review_url)
 */
export async function sendReviewRequestSMS(client, job, profile) {
  if (!client?.phone) {
    return { success: false, error: "Client has no phone number" };
  }
  if (!profile?.google_review_url) {
    return { success: false, error: "No Google review link configured — add one in Settings" };
  }
  return invoke("send-sms", {
    type: "review_request",
    to:   client.phone,
    data: {
      clientName: client.name,
      jobTitle:   job?.title ?? "the work",
      googleUrl:  profile.google_review_url,
      tradeName:  profile.name,
    },
  });
}

/**
 * Notifies the tradesperson when an invoice goes overdue.
 *
 * @param {object} invoice  - invoice row with .client joined
 * @param {object} profile  - tradesperson profile (needs .phone)
 */
export async function sendOverdueSMS(invoice, profile) {
  if (!profile?.phone) {
    return { success: false, error: "Profile has no phone number" };
  }
  return invoke("send-sms", {
    type: "overdue_invoice",
    to:   profile.phone,
    data: {
      invoiceNumber: invoice.invoice_number,
      amount:        invoice.amount,
      clientName:    invoice.client?.name ?? "your client",
    },
  });
}