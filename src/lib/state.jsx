// src/lib/state.jsx

import { createContext, useContext } from "react";

export const uid   = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
export const today = () => new Date().toISOString().slice(0, 10);

export const SEED = {
  user: {
    id: "demo-profile-id", clerk_id: "demo",
    name: "Jake Morrison", trade: "Electrician",
    email: "jake@jmelectrical.co.uk", phone: "07712 345678",
    bio: "Fully qualified electrician with 12 years experience. Domestic & commercial. 18th edition certified.",
    hourly_rate: 65, bank_name: "Barclays Business",
    sort_code: "20-12-34", account_number: "12345678",
    payment_terms: "14", invoice_notes: "VAT not registered.",
    booking_slug: "jakemorrison", plan: "pro",
    notif_email_booking: true, notif_sms_paid: false,
    notif_weekly_digest: true, notif_overdue_reminder: true,
  },
  clients: [
    { id: "c1", profile_id:"demo-profile-id", name: "Sarah Mitchell", email: "sarah@mitchellhome.co.uk", phone: "07891 234567", address: "14 Elm Street, Brighton",  notes: "Prefers mornings" },
    { id: "c2", profile_id:"demo-profile-id", name: "Roberts & Co",   email: "accounts@robertsco.com",   phone: "01273 445566", address: "Unit 4, Trade Park, Hove", notes: "Invoice to accounts@" },
    { id: "c3", profile_id:"demo-profile-id", name: "David Chen",     email: "d.chen@gmail.com",         phone: "07654 321098", address: "8 Park Lane, Lewes",       notes: "" },
    { id: "c4", profile_id:"demo-profile-id", name: "Emma Lawson",    email: "emma@lawsonhome.co.uk",    phone: "07900 123456", address: "22 Maple Ave, Worthing",   notes: "" },
  ],
  jobs: [
    { id: "j1", profile_id:"demo-profile-id", client_id:"c1", title:"Consumer unit replacement", date:"2026-05-20", time:"09:00", duration:3, status:"scheduled", notes:"Full board 18th edition", amount:480 },
    { id: "j2", profile_id:"demo-profile-id", client_id:"c2", title:"Office rewire phase 2",     date:"2026-05-22", time:"08:00", duration:8, status:"scheduled", notes:"2nd floor",               amount:1200 },
    { id: "j3", profile_id:"demo-profile-id", client_id:"c4", title:"Full rewire quote",          date:"2026-05-25", time:"10:00", duration:1, status:"scheduled", notes:"Survey only",             amount:0 },
    { id: "j4", profile_id:"demo-profile-id", client_id:"c3", title:"EV charger installation",    date:"2026-05-14", time:"10:00", duration:4, status:"completed", notes:"7kW pod point",           amount:550 },
    { id: "j5", profile_id:"demo-profile-id", client_id:"c1", title:"Fault finding & repair",     date:"2026-05-10", time:"14:00", duration:2, status:"completed", notes:"Tripping ring main",      amount:190 },
    { id: "j6", profile_id:"demo-profile-id", client_id:"c2", title:"Office rewire phase 1",      date:"2026-04-18", time:"08:00", duration:8, status:"completed", notes:"Ground floor complete",   amount:1100 },
  ],
  invoices: [
    { id:"i1", profile_id:"demo-profile-id", client_id:"c2", job_id:"j6", invoice_number:"INV-001", created_at:"2026-04-18", due_date:"2026-05-02", amount:1100, status:"paid",   stripe_payment_link_url:null, client:{name:"Roberts & Co",email:"accounts@robertsco.com",address:"Unit 4, Trade Park, Hove"}, job:{title:"Office rewire phase 1"} },
    { id:"i2", profile_id:"demo-profile-id", client_id:"c3", job_id:"j4", invoice_number:"INV-002", created_at:"2026-05-14", due_date:"2026-05-28", amount:550,  status:"paid",   stripe_payment_link_url:null, client:{name:"David Chen",    email:"d.chen@gmail.com",         address:"8 Park Lane, Lewes"},       job:{title:"EV charger installation"} },
    { id:"i3", profile_id:"demo-profile-id", client_id:"c1", job_id:"j5", invoice_number:"INV-003", created_at:"2026-05-10", due_date:"2026-05-24", amount:190,  status:"unpaid", stripe_payment_link_url:null, client:{name:"Sarah Mitchell",email:"sarah@mitchellhome.co.uk",address:"14 Elm Street, Brighton"},  job:{title:"Fault finding & repair"} },
  ],
  booking_requests: [
    { id:"b1", profile_id:"demo-profile-id", customer_name:"Emma Lawson",  customer_email:"emma@lawsonhome.co.uk", customer_phone:"07900 123456", preferred_date:"2026-05-25", notes:"Full rewire 3-bed semi.", status:"accepted", created_at:"2026-05-15T09:22:00Z" },
    { id:"b2", profile_id:"demo-profile-id", customer_name:"Tom Richards", customer_email:"tom@gmail.com",         customer_phone:"07811 998877", preferred_date:"2026-05-28", notes:"EV charger Tesla.",       status:"pending",  created_at:"2026-05-16T14:05:00Z" },
    { id:"b3", profile_id:"demo-profile-id", customer_name:"Nina Patel",   customer_email:"nina@patel.co.uk",      customer_phone:"07733 112233", preferred_date:"2026-06-02", notes:"EICR for rental.",        status:"pending",  created_at:"2026-05-17T08:30:00Z" },
  ],
  marketplace_listings: [
    { id:"m1", type:"demand",      title:"Electrician needed — full rewire in Brighton", description:"3-bed Victorian needs full rewire. NICEIC registered please.", trade:"Electrician", location:"Brighton (BN1)", budget:4500, status:"active", urgent:false, contact_name:"Helen Park",    contact_email:"helen@park.co.uk",   contact_phone:"07811 222333", contact_method:"both",  views:14, created_at:"2026-05-15T10:00:00Z" },
    { id:"m2", type:"recruitment", title:"Hiring qualified electrician — Rouen",         description:"Growing firm needs 18th edition electrician. Regular domestic and commercial jobs.", trade:"Electrician", location:"Rouen (76)", contract_type:"Subcontracting", salary_range:"€200–250/day", experience_req:"3+ years", status:"active", urgent:true, contact_name:"Marc Dupont",   contact_email:"marc@mdelectrique.fr", contact_phone:"+33 6 12 34 56 78", contact_method:"phone", views:31, created_at:"2026-05-14T08:30:00Z" },
    { id:"m3", type:"sale",        title:"Plumbing business for sale — Normandy",        description:"15-year-old firm, strong client base, 2 vans included. Owner retiring. 3 months handover.", trade:"Plumber", location:"Caen (14)", business_type:"Plumbing firm", budget:85000, annual_revenue:220000, employees:3, status:"active", urgent:false, contact_name:"Pierre Martin",  contact_email:"pierre@martin.fr",    contact_phone:"+33 6 98 76 54 32", contact_method:"both",  views:52, created_at:"2026-05-12T14:00:00Z" },
    { id:"m4", type:"demand",      title:"Plasterer needed — new build in Hove",         description:"New-build 4-bed needs all plastering. Walls and ceilings, ~180m². Flexible start.", trade:"Plasterer", location:"Hove (BN3)", budget:6800, work_start_date:"2026-06-15", status:"active", urgent:false, contact_name:"James Webb",    contact_email:"james@gmail.com",     contact_phone:"", contact_method:"email", views:7, created_at:"2026-05-17T11:00:00Z" },
    { id:"m5", type:"recruitment", title:"Plumber wanted — commercial CDI — Paris",       description:"Experienced plumber for commercial CDI. Projects across Île-de-France.", trade:"Plumber", location:"Paris (75)", contract_type:"CDI", salary_range:"€38k–€42k/year", experience_req:"5+ years commercial", status:"active", urgent:false, contact_name:"Sophie Bernard", contact_email:"rh@bernard.fr",       contact_phone:"", contact_method:"email", views:18, created_at:"2026-05-16T09:00:00Z" },
  ],
  payment_transactions: [
    { id:"t1", profile_id:"demo-profile-id", invoice_id:"i1", client_id:"c2", stripe_payment_intent_id:"pi_demo1", gross_amount:1100, stripe_fee:15.60, platform_fee:22.00, net_amount:1062.40, status:"completed", client_name:"Roberts & Co",   description:"Office rewire phase 1",    paid_at:"2026-04-20T14:32:00Z", created_at:"2026-04-20T14:32:00Z" },
    { id:"t2", profile_id:"demo-profile-id", invoice_id:"i2", client_id:"c3", stripe_payment_intent_id:"pi_demo2", gross_amount:550,  stripe_fee:7.90,  platform_fee:11.00, net_amount:531.10,  status:"completed", client_name:"David Chen",     description:"EV charger installation",   paid_at:"2026-05-16T09:11:00Z", created_at:"2026-05-16T09:11:00Z" },
    { id:"t3", profile_id:"demo-profile-id", invoice_id:null, client_id:"c2", stripe_payment_intent_id:"pi_demo3", gross_amount:1200, stripe_fee:17.00, platform_fee:24.00, net_amount:1159.00, status:"completed", client_name:"Roberts & Co",   description:"Office rewire phase 2",    paid_at:"2026-05-23T11:45:00Z", created_at:"2026-05-23T11:45:00Z" },
    { id:"t4", profile_id:"demo-profile-id", invoice_id:null, client_id:"c1", stripe_payment_intent_id:"pi_demo4", gross_amount:480,  stripe_fee:6.92,  platform_fee:9.60,  net_amount:463.48,  status:"pending",   client_name:"Sarah Mitchell", description:"Consumer unit replacement", paid_at:null,                   created_at:"2026-05-24T08:00:00Z" },
  ],
  payouts: [
    { id:"po1", profile_id:"demo-profile-id", stripe_payout_id:"po_demo1", amount:1062.40, transaction_count:1, status:"paid",       arrival_date:"2026-04-25", bank_last4:"5678", created_at:"2026-04-23T00:00:00Z" },
    { id:"po2", profile_id:"demo-profile-id", stripe_payout_id:"po_demo2", amount:531.10,  transaction_count:1, status:"paid",       arrival_date:"2026-05-20", bank_last4:"5678", created_at:"2026-05-18T00:00:00Z" },
    { id:"po3", profile_id:"demo-profile-id", stripe_payout_id:"po_demo3", amount:1159.00, transaction_count:1, status:"in_transit", arrival_date:"2026-05-28", bank_last4:"5678", created_at:"2026-05-26T00:00:00Z" },
  ],
  quotes: [
    { id:"q1", profile_id:"demo-profile-id", client_id:"c1", quote_number:"QUO-001", title:"Full consumer unit replacement + EV charger", status:"accepted", valid_until:"2026-06-01", line_items:[ {description:"Consumer unit (18th edition)",type:"material",quantity:1,unit_price:180,total:180}, {description:"EV charger unit (7kW)",type:"material",quantity:1,unit_price:320,total:320}, {description:"Labour — installation",type:"labour",quantity:8,unit_price:65,total:520} ], subtotal:1020, vat_rate:0, vat_amount:0, total:1020, margin_pct:28, signed_at:"2026-05-08T14:22:00Z", signed_by:"Sarah Mitchell", job_id:"j1", created_at:"2026-05-06T10:00:00Z" },
    { id:"q2", profile_id:"demo-profile-id", client_id:"c4", quote_number:"QUO-002", title:"Full rewire — 4-bedroom house", status:"sent",     valid_until:"2026-06-10", line_items:[ {description:"Cable & materials",type:"material",quantity:1,unit_price:850,total:850}, {description:"Labour — 3 days",type:"labour",quantity:24,unit_price:65,total:1560}, {description:"NICEIC inspection & certificate",type:"other",quantity:1,unit_price:180,total:180} ], subtotal:2590, vat_rate:0, vat_amount:0, total:2590, margin_pct:32, signed_at:null, job_id:null, created_at:"2026-05-17T09:00:00Z" },
    { id:"q3", profile_id:"demo-profile-id", client_id:"c3", quote_number:"QUO-003", title:"EV charger installation",                         status:"converted", valid_until:"2026-05-20", line_items:[ {description:"7kW pod point charger",type:"material",quantity:1,unit_price:320,total:320}, {description:"Labour — installation",type:"labour",quantity:4,unit_price:65,total:260} ], subtotal:580, vat_rate:0, vat_amount:0, total:580, margin_pct:18, signed_at:"2026-05-12T11:30:00Z", signed_by:"David Chen", job_id:"j4", created_at:"2026-05-10T08:00:00Z" },
  ],
  certifications: [
    { id:"cert1", profile_id:"demo-profile-id", name:"18th Edition Wiring Regulations", issuing_body:"NICEIC", cert_number:"NIC-2024-18E-77821", issued_date:"2024-01-15", expiry_date:"2027-01-15", status:"active" },
    { id:"cert2", profile_id:"demo-profile-id", name:"NICEIC Approved Contractor",       issuing_body:"NICEIC", cert_number:"NIC-AC-55234",          issued_date:"2023-06-01", expiry_date:"2026-06-01", status:"active" },
    { id:"cert3", profile_id:"demo-profile-id", name:"EV Charging Installation (City & Guilds 2919)", issuing_body:"City & Guilds", cert_number:"CG-2919-34891", issued_date:"2022-09-01", expiry_date:"2025-09-01", status:"expired" },
    { id:"cert4", profile_id:"demo-profile-id", name:"IPAF Powered Access Licence",      issuing_body:"IPAF",   cert_number:"IPAF-UK-88234",          issued_date:"2025-03-01", expiry_date:"2027-03-01", status:"active" },
  ],
  reviews: [
    { id:"r1", profile_id:"demo-profile-id", job_id:"j6", client_id:"c2", client_name:"Roberts & Co",   rating:5, title:"Excellent work, professional team", body:"Jake and his team rewired our entire office ground floor with minimal disruption to our business. Clean, fast, professional. Highly recommend.", verified:true, google_review_clicked:true,  created_at:"2026-04-22T10:00:00Z" },
    { id:"r2", profile_id:"demo-profile-id", job_id:"j4", client_id:"c3", client_name:"David Chen",     rating:5, title:"EV charger installed perfectly",    body:"Turned up on time, did the job in half a day, talked me through everything. Price was exactly as quoted. Will definitely use again.", verified:true, google_review_clicked:true,  created_at:"2026-05-15T14:30:00Z" },
    { id:"r3", profile_id:"demo-profile-id", job_id:"j5", client_id:"c1", client_name:"Sarah Mitchell", rating:4, title:"Sorted our electrical fault quickly", body:"Came out same day which was great. Found the fault within an hour. A bit pricey but peace of mind is worth it.", verified:true, google_review_clicked:false, created_at:"2026-05-11T09:15:00Z" },
  ],
  referrals: [
    { id:"ref1", referrer_id:"demo-profile-id", referral_code:"TRD-JK8921", referred_email:"pete.larkin@plumber.co.uk", referred_name:"Pete Larkin",  status:"rewarded", reward_months:2, rewarded_at:"2026-03-15T00:00:00Z", created_at:"2026-03-01T00:00:00Z" },
    { id:"ref2", referrer_id:"demo-profile-id", referral_code:"TRD-JK8922", referred_email:"sandra.r@srpluming.com",    referred_name:"Sandra Reeves", status:"signed_up", reward_months:2, rewarded_at:null,                   created_at:"2026-05-10T00:00:00Z" },
    { id:"ref3", referrer_id:"demo-profile-id", referral_code:"TRD-JK8923", referred_email:"",                          referred_name:"",              status:"pending",   reward_months:2, rewarded_at:null,                   created_at:"2026-05-20T00:00:00Z" },
  ],
};

export function reducer(state, { type, payload }) {
  switch (type) {
    case "ADD_CLIENT":     return { ...state, clients: [...state.clients, payload] };
    case "UPDATE_CLIENT":  return { ...state, clients: state.clients.map(c => c.id===payload.id?{...c,...payload}:c) };
    case "DELETE_CLIENT":  return { ...state, clients: state.clients.filter(c => c.id!==payload) };
    case "ADD_JOB":        return { ...state, jobs: [...state.jobs, payload] };
    case "UPDATE_JOB":     return { ...state, jobs: state.jobs.map(j => j.id===payload.id?{...j,...payload}:j) };
    case "COMPLETE_JOB":   return { ...state, jobs: state.jobs.map(j => j.id===payload?{...j,status:"completed"}:j) };
    case "DELETE_JOB":     return { ...state, jobs: state.jobs.filter(j => j.id!==payload) };
    case "ADD_INVOICE":    return { ...state, invoices: [...state.invoices, payload] };
    case "MARK_PAID":      return { ...state, invoices: state.invoices.map(i => i.id===payload?{...i,status:"paid"}:i) };
    case "DELETE_INVOICE": return { ...state, invoices: state.invoices.filter(i => i.id!==payload) };
    case "UPDATE_BOOKING": return { ...state, booking_requests: state.booking_requests.map(b => b.id===payload.id?{...b,...payload}:b) };
    case "ADD_BOOKING":    return { ...state, booking_requests: [payload,...state.booking_requests] };
    case "ADD_LISTING":    return { ...state, marketplace_listings: [payload,...state.marketplace_listings] };
    case "CLOSE_LISTING":  return { ...state, marketplace_listings: state.marketplace_listings.map(l => l.id===payload?{...l,status:"closed"}:l) };
    case "DELETE_LISTING": return { ...state, marketplace_listings: state.marketplace_listings.filter(l => l.id!==payload) };
    case "UPDATE_USER":       return { ...state, user: {...state.user,...payload} };
    case "ADD_TRANSACTION":   return { ...state, payment_transactions: [payload,...state.payment_transactions] };
    case "UPDATE_TRANSACTION":return { ...state, payment_transactions: state.payment_transactions.map(t=>t.id===payload.id?{...t,...payload}:t) };
    case "ADD_PAYOUT":        return { ...state, payouts: [payload,...state.payouts] };
    case "UPDATE_PAYOUT":     return { ...state, payouts: state.payouts.map(p=>p.id===payload.id?{...p,...payload}:p) };
    // quotes
    case "ADD_QUOTE":         return { ...state, quotes: [payload,...state.quotes] };
    case "UPDATE_QUOTE":      return { ...state, quotes: state.quotes.map(q=>q.id===payload.id?{...q,...payload}:q) };
    case "DELETE_QUOTE":      return { ...state, quotes: state.quotes.filter(q=>q.id!==payload) };
    // certifications
    case "ADD_CERT":          return { ...state, certifications: [...state.certifications, payload] };
    case "UPDATE_CERT":       return { ...state, certifications: state.certifications.map(c=>c.id===payload.id?{...c,...payload}:c) };
    case "DELETE_CERT":       return { ...state, certifications: state.certifications.filter(c=>c.id!==payload) };
    // reviews
    case "ADD_REVIEW":        return { ...state, reviews: [payload,...state.reviews] };
    case "UPDATE_REVIEW":     return { ...state, reviews: state.reviews.map(r=>r.id===payload.id?{...r,...payload}:r) };
    // referrals
    case "ADD_REFERRAL":      return { ...state, referrals: [payload,...state.referrals] };
    case "UPDATE_REFERRAL":   return { ...state, referrals: state.referrals.map(r=>r.id===payload.id?{...r,...payload}:r) };
    default: return state;
  }
}

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);
