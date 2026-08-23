// src/lib/db.js

import { supabase } from "./supabase";
export { supabase };

/* ── helpers ─────────────────────────────────────── */
const handle = async (query) => {
  const { data, error } = await query;
  if (error) console.error("[db]", error.message);
  return { data, error };
};

/* ══════════════════════════════════════════════════
   PROFILES
══════════════════════════════════════════════════ */

export const getProfile = (clerkId) =>
  handle(supabase.from("profiles").select("*").eq("clerk_id", clerkId).single());

export const createProfile = (clerkId, { name, email, trade = "" }) => {
  const slug = name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "") +
               Math.floor(Math.random() * 900 + 100);
  return handle(
    supabase
      .from("profiles")
      .insert({ clerk_id: clerkId, name, email, trade, booking_slug: slug })
      .select()
      .single()
  );
};


/* ══════════════════════════════════════════════════
   CLIENTS
══════════════════════════════════════════════════ */

export const getClients = (profileId) =>
  handle(supabase.from("clients").select("*").eq("profile_id", profileId).order("name"));

export const createClient = (profileId, data) =>
  handle(
    supabase.from("clients").insert({ profile_id: profileId, ...data }).select().single()
  );

export const updateClient = (id, data) =>
  handle(supabase.from("clients").update(data).eq("id", id).select().single());

export const deleteClient = (id) =>
  handle(supabase.from("clients").delete().eq("id", id));

/* ══════════════════════════════════════════════════
   JOBS
══════════════════════════════════════════════════ */

export const getJobs = (profileId) =>
  handle(
    supabase
      .from("jobs")
      .select("*, client:clients(id,name,email,phone)")
      .eq("profile_id", profileId)
      .order("date", { ascending: false })
  );

export const createJob = (profileId, data) =>
  handle(
    supabase
      .from("jobs")
      .insert({ profile_id: profileId, ...data })
      .select("*, client:clients(id,name)")
      .single()
  );

export const updateJob = (id, data) =>
  handle(
    supabase
      .from("jobs")
      .update(data)
      .eq("id", id)
      .select("*, client:clients(id,name)")
      .single()
  );

export const completeJob = (id) => updateJob(id, { status: "completed" });

export const deleteJob = (id) =>
  handle(supabase.from("jobs").delete().eq("id", id));

/* ══════════════════════════════════════════════════
   INVOICES
══════════════════════════════════════════════════ */

export const getInvoices = (profileId) =>
  handle(
    supabase
      .from("invoices")
      .select("*, client:clients(id,name,email,address), job:jobs(id,title)")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
  );

export const createInvoice = async (profileId, data) => {
  // Auto-increment invoice number
  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);

  const invoice_number = `INV-${String((count ?? 0) + 1).padStart(3, "0")}`;

  return handle(
    supabase
      .from("invoices")
      .insert({ profile_id: profileId, invoice_number, ...data })
      .select("*, client:clients(id,name,email,address), job:jobs(id,title)")
      .single()
  );
};

export const markInvoicePaid = (id) =>
  handle(
    supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
  );

export const saveStripeLink = (id, { stripe_payment_link_id, stripe_payment_link_url }) =>
  handle(
    supabase
      .from("invoices")
      .update({ stripe_payment_link_id, stripe_payment_link_url })
      .eq("id", id)
      .select()
      .single()
  );

export const deleteInvoice = (id) =>
  handle(supabase.from("invoices").delete().eq("id", id));

/* ══════════════════════════════════════════════════
   BOOKING REQUESTS
══════════════════════════════════════════════════ */

export const getBookingRequests = (profileId) =>
  handle(
    supabase
      .from("booking_requests")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
  );

export const updateBookingStatus = (id, status) =>
  handle(
    supabase.from("booking_requests").update({ status }).eq("id", id).select().single()
  );

// Public — no auth required (RLS allows insert from anyone)
export const submitBookingRequest = (profileId, data) =>
  handle(
    supabase.from("booking_requests").insert({ profile_id: profileId, ...data }).select().single()
  );

// Fetch a public profile by slug (for the booking page).
// Queries the `public_profiles` VIEW, not the raw `profiles` table —
// the view exposes only booking-page-safe columns and is grant-ed to
// the anon role, since visitors hitting /b/:slug are not logged in.
export const getPublicProfile = (slug) =>
  handle(
    supabase
      .from("public_profiles")
      .select("id, name, trade, bio, hourly_rate, booking_slug, extra_fields")
      .eq("booking_slug", slug)
      .single()
  );

/* ══════════════════════════════════════════════════
   SERVICES
   Services shown on the professional's public booking page
   (Settings → Booking page → Services), each with an optional
   photo, price, and duration.
══════════════════════════════════════════════════ */

// Owner view — ALL services (active + inactive), for the editor.
export const getServices = (profileId) =>
  handle(
    supabase
      .from("services")
      .select("*")
      .eq("profile_id", profileId)
      .order("sort_order", { ascending: true })
  );

export const createService = (profileId, data) =>
  handle(
    supabase
      .from("services")
      .insert({ profile_id: profileId, ...data })
      .select()
      .single()
  );

export const updateService = (id, data) =>
  handle(
    supabase.from("services").update(data).eq("id", id).select().single()
  );

export const deleteService = (id) =>
  handle(supabase.from("services").delete().eq("id", id));

// Swap sort_order between two services (used for the up/down reorder
// buttons in the editor) — two updates, not atomic as a single query,
// but fine here since a rare double-click at worst just leaves the
// order momentarily inconsistent until the next load.
export const swapServiceOrder = async (a, b) => {
  const [r1, r2] = await Promise.all([
    supabase.from("services").update({ sort_order: b.sort_order }).eq("id", a.id),
    supabase.from("services").update({ sort_order: a.sort_order }).eq("id", b.id),
  ]);
  return { error: r1.error || r2.error || null };
};

// Upload a service photo to the shared "booking-attachments" bucket
// (same bucket the public booking page uses for client reference
// images). Returns the public URL to store in services.image_url.
// Generic upload to the shared "booking-attachments" bucket — used
// for service photos, marketplace listing photos, and anywhere else
// a profile needs to attach an image. `folder` namespaces the path
// (e.g. "services", "marketplace") purely for organisation in the
// bucket; it has no effect on permissions (the storage policies are
// bucket-wide, not path-based — see 004_services.sql).
export const uploadImage = async (profileId, file, folder = "uploads") => {
  const ext  = file.name.split(".").pop();
  const path = `${folder}/${profileId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from("booking-attachments")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (uploadErr) return { data: null, error: uploadErr };
  const { data: { publicUrl } } = supabase.storage
    .from("booking-attachments")
    .getPublicUrl(path);
  return { data: publicUrl, error: null };
};

// Back-compat wrapper — ServiceEditor.jsx already imports this name.
export const uploadServiceImage = (profileId, file) => uploadImage(profileId, file, "services");

/* ══════════════════════════════════════════════════
   MARKETPLACE
══════════════════════════════════════════════════ */

export const getListings = (filters = {}, page = 0, pageSize = 24) => {
  let q = supabase
    .from("marketplace_listings")
    .select("*, poster:profiles(name,trade,booking_slug)")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1); // pagination
    // obligatoire — sans .range(), un seul appel peut ramener TOUTES les
    // annonces d'un coup, ce qui permet d'aspirer toute la base facilement

  if (filters.type)     q = q.eq("type", filters.type);
  if (filters.trade && filters.trade !== "all") q = q.eq("trade", filters.trade);
  if (filters.location) q = q.ilike("location", `%${filters.location}%`);
  if (filters.urgent)   q = q.eq("urgent", true);

  return handle(q);
};

export const getMyListings = (profileId) =>
  handle(
    supabase
      .from("marketplace_listings")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
  );

export const createListing = (profileId, data) =>
  handle(
    supabase
      .from("marketplace_listings")
      .insert({ profile_id: profileId, ...data })
      .select()
      .single()
  );

export const updateListing = (id, data) =>
  handle(
    supabase
      .from("marketplace_listings")
      .update(data)
      .eq("id", id)
      .select()
      .single()
  );

export const closeListing = (id) =>
  updateListing(id, { status: "closed" });

export const deleteListing = (id) =>
  handle(supabase.from("marketplace_listings").delete().eq("id", id));

export const expressInterest = (listingId, data) =>
  handle(
    supabase
      .from("marketplace_interests")
      .insert({ listing_id: listingId, ...data })
      .select()
      .single()
  );

export const getInterestsForListing = (listingId) =>
  handle(
    supabase
      .from("marketplace_interests")
      .select("*")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false })
  );

export const incrementViews = (listingId) =>
  supabase.rpc("increment_listing_views", { listing_id: listingId });

/* ══════════════════════════════════════════════════
   Vimen PAY — Payment Transactions & Payouts
══════════════════════════════════════════════════ */

export const getTransactions = (profileId, filters = {}) => {
  let q = supabase
    .from("payment_transactions")
    .select("*, invoice:invoices(invoice_number), client:clients(name)")
    .eq("profile_id", profileId)
    .order("paid_at", { ascending: false });
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.from)   q = q.gte("paid_at", filters.from);
  if (filters.to)     q = q.lte("paid_at", filters.to);
  return handle(q);
};

export const getPayouts = (profileId) =>
  handle(
    supabase.from("payouts").select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
  );

export const getPaymentStats = async (profileId) => {
  const { data, error } = await supabase
    .from("payment_transactions")
    .select("gross_amount, stripe_fee, net_amount, status, paid_at")
    .eq("profile_id", profileId)
    .eq("status", "completed");
  if (error) return { data: null, error };

  const now       = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonth  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const thisMonth = (data ?? []).filter(t => t.paid_at >= monthStart);
  const prevMonth = (data ?? []).filter(t => t.paid_at >= lastMonth && t.paid_at < monthStart);

  const sum = (arr, key) => arr.reduce((s, t) => s + Number(t[key] ?? 0), 0);

  return {
    data: {
      totalVolume:      sum(data ?? [], "gross_amount"),
      totalEarned:      sum(data ?? [], "net_amount"),
      totalFeesPaid:    sum(data ?? [], "stripe_fee"),
      thisMonthVolume:  sum(thisMonth, "gross_amount"),
      thisMonthEarned:  sum(thisMonth, "net_amount"),
      prevMonthVolume:  sum(prevMonth, "gross_amount"),
      transactionCount: (data ?? []).length,
      avgTransactionValue: (data ?? []).length > 0
        ? sum(data ?? [], "gross_amount") / (data ?? []).length : 0,
    },
    error: null,
  };
};

// Connect Stripe account (returns OAuth URL)
export const getStripeConnectUrl = async (
  profileId,
  returnUrl = `${window.location.origin}/settings?tab=payment`
) => {
  const { data, error } = await supabase.functions.invoke("stripe-connect", {
    body: { profileId, returnUrl },
  });

  if (error) {
    // supabase.functions.invoke() ne met PAS le message JSON renvoyé par
    // la fonction (ex: "Profil introuvable", erreur Stripe...) dans
    // error.message — il faut aller le chercher dans error.context, sinon
    // on ne voit jamais que "Edge Function returned a non-2xx status code".
    try {
      const body = await error.context?.json?.();
      if (body?.error) error.message = body.error;
    } catch {
      // pas de JSON exploitable — on garde le message générique tel quel
    }
    console.error("[getStripeConnectUrl]", error.message, error);
  }

  return { data, error };
};

/* ══════════════════════════════════════════════════
   QUOTES
══════════════════════════════════════════════════ */
export const getQuotes = (profileId) =>
  handle(supabase.from("quotes").select("*, client:clients(id,name,email,address)").eq("profile_id", profileId).order("created_at", { ascending: false }));

export const createQuote = async (profileId, data) => {
  const { count } = await supabase.from("quotes").select("id", { count:"exact", head:true }).eq("profile_id", profileId);
  const quote_number = `QUO-${String((count??0)+1).padStart(3,"0")}`;
  return handle(supabase.from("quotes").insert({ profile_id:profileId, quote_number, ...data }).select("*, client:clients(id,name,email,address)").single());
};
export const updateQuote = (id, data) => handle(supabase.from("quotes").update(data).eq("id",id).select().single());
export const deleteQuote = (id) => handle(supabase.from("quotes").delete().eq("id",id));
export const signQuote   = (id, signedBy) => handle(supabase.from("quotes").update({ status:"accepted", signed_at: new Date().toISOString(), signed_by: signedBy }).eq("id",id).select().single());
export const convertQuoteToJob = (id, jobId) => handle(supabase.from("quotes").update({ status:"converted", job_id:jobId }).eq("id",id));

/* ══════════════════════════════════════════════════
   CERTIFICATIONS
══════════════════════════════════════════════════ */
export const getCertifications = (profileId) =>
  handle(supabase.from("certifications").select("*").eq("profile_id", profileId).order("expiry_date"));
export const createCertification = (profileId, data) =>
  handle(supabase.from("certifications").insert({ profile_id:profileId, ...data }).select().single());
export const updateCertification = (id, data) =>
  handle(supabase.from("certifications").update(data).eq("id",id).select().single());
export const deleteCertification = (id) =>
  handle(supabase.from("certifications").delete().eq("id",id));

/* ══════════════════════════════════════════════════
   REVIEWS
══════════════════════════════════════════════════ */
export const getReviews = (profileId) =>
  handle(supabase.from("reviews").select("*").eq("profile_id", profileId).order("created_at", { ascending:false }));
export const createReview = (data) =>
  handle(supabase.from("reviews").insert(data).select().single());
// Review request SMS now lives in notifications.js as
// sendReviewRequestSMS(client, job, profile) — it was previously
// defined here calling a Supabase function ("send-review-request")
// that never actually existed, so every call silently 404'd. Moved
// to notifications.js to match how every other SMS/email send
// (sendInvoiceEmail, sendNewBookingSMS, etc.) is organised.

/* ══════════════════════════════════════════════════
   REFERRALS
══════════════════════════════════════════════════ */
export const getReferrals = (profileId) =>
  handle(supabase.from("referrals").select("*").eq("referrer_id", profileId).order("created_at", { ascending:false }));
export const createReferral = (referrerId, email, name) => {
  const code = `TRD-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  return handle(supabase.from("referrals").insert({ referrer_id:referrerId, referral_code:code, referred_email:email, referred_name:name }).select().single());
};

export const updateProfile = async (identifier, data) => {
  // Détermine si on cherche par id interne ou par clerk_id
  const column = identifier.includes("-") ? "id" : "clerk_id";
  
  const { data: updatedData, error } = await supabase
    .from("profiles")
    .update(data)
    .eq(column, identifier) // Utilise la variable "column" au lieu d'une valeur en dur
    .select()
    .single();

  return { data: updatedData, error };
};