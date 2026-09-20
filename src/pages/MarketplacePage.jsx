import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "../i18n/index.js";
import { toast } from "react-hot-toast";
import { T } from "../styles/tokens";
import {
  getListings, getMyListings, createListing,
  closeListing, deleteListing, expressInterest, incrementViews,
} from "../lib/db";
import {
  PageShell, Card, Btn, Badge, Modal, ConfirmModal, Field, FieldRow,
  FormActions, Empty, Skeleton, Spinner, ErrorBox
} from "../components/UI";
import PhotoUpload from "../components/PhotoUpload";
import ReportButton from "../components/ReportButton";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { formatCurrency } from "../lib/currency.js";
import { ALL_PROFESSIONS, VERTICALS, getVerticalForProfession, getVerticalLabel, getProfessionLabel } from "../lib/professions.js";

/* ── constants ──────────────────────────────────────── */

const TYPE_IDS = ["all", "demand", "sale", "recruitment", "materials"];
const TYPE_TAB_ICONS = { all: "", demand: "", sale: "", recruitment: "", materials: "" };

const CONTRACT_TYPES = ["Subcontracting", "CDI", "CDD", "Interim", "Apprenticeship", "Other"];
const MATERIAL_CATEGORIES = ["Electrical", "Plumbing", "General", "Safety", "Tools", "Other"];
const MATERIAL_CONDITIONS = ["New", "Like new", "Used", "For parts"];
const CONDITION_KEY = { "New": "new", "Like new": "likeNew", "Used": "used", "For parts": "forParts" };

const fmtDate = (d, locale = "en-GB") => { 
  try { 
    return new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }); 
  } catch { 
    return ""; 
  }
};

const timeAgo = (d, t, locale = "en-GB") => {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return t("marketplace.time.today");
  if (days === 1) return t("marketplace.time.yesterday");
  if (days < 7) return t("marketplace.time.daysAgo", { count: days });
  if (days < 30) return t("marketplace.time.weeksAgo", { count: Math.floor(days / 7) });
  return fmtDate(d, locale);
};

const iStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.15)", fontSize: 14,
  background: "#fff", color: "#131211",
  boxSizing: "border-box", fontFamily: "inherit",
};

const tagStyle = {
  fontSize: 12, padding: "2px 8px", borderRadius: 4,
  background: T.surface2, color: T.muted, fontWeight: 500
};

function TypeBadge({ type }) {
  const { t } = useTranslation();
  const colors = {
    demand: "blue",
    sale: "amber",
    recruitment: "green",
    materials: "purple",
  };
  return (
    <Badge color={colors[type] || "gray"}>
      {t(`marketplace.types.${type}`)}
    </Badge>
  );
}

/* ══════════════════════════════════════════════════════
  MAIN COMPONENT
══════════════════════════════════════════════════════ */
export default function MarketplacePage({ profile }) {
  const { t, lang } = useTranslation();
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  const fmt = n => formatCurrency(n, profile?.currency);
  const [listings, setListings] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [view, setView] = useState("browse"); // browse | mine
  const [modal, setModal] = useState(null); // null | "post" | "interest"
  const [activeListing, setActiveListing] = useState(null); // annonce actuellement ouverte (détail / intérêt)
  const [delId, setDelId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterTrade, setFilterTrade] = useState("All trades");
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 24;

  // Load listings
  const load = useCallback(async (targetPage = 0) => {
    setLoading(true);
    setError(null);
    try {
      const filters = {
        type: activeTab !== "all" ? activeTab : undefined,
        trade: filterTrade !== "All trades" ? filterTrade : undefined,
        urgent: filterUrgent || undefined,
      };
      const { data, error: err } = await getListings(filters, targetPage, PAGE_SIZE);
      if (err) throw err;
      setListings((prev) => (targetPage === 0 ? (data ?? []) : [...prev, ...(data ?? [])]));
      setHasMore((data ?? []).length === PAGE_SIZE);
      setPage(targetPage);
    } catch (err) {
      console.error("[MarketplacePage] load listings error:", err);
      setError({
        what: t("marketplace.loadErrorWhat", "Failed to load marketplace listings"),
        why: t("marketplace.loadErrorWhy", "Could not fetch data from the server."),
        nextAction: t("marketplace.loadErrorNext", "Please check your connection and try again."),
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, filterTrade, filterUrgent, t]);

  const loadMoreListings = () => load(page + 1);

  const loadMine = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data, error: err } = await getMyListings(profile.id);
      if (err) throw err;
      setMyListings(data ?? []);
    } catch (err) {
      console.error("[MarketplacePage] load my listings error:", err);
      toast.error(t("marketplace.toast.failedLoadMine"));
    }
  }, [profile?.id, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (view === "mine") loadMine(); }, [view, loadMine]);

  // Filter by search text client-side
  const displayed = listings.filter(l =>
    !search ||
    l.title?.toLowerCase().includes(search.toLowerCase()) ||
    l.description?.toLowerCase().includes(search.toLowerCase()) ||
    l.location?.toLowerCase().includes(search.toLowerCase()) ||
    l.trade?.toLowerCase().includes(search.toLowerCase())
  );

  // Open listing detail + increment views
  function openDetail(listing) {
    setActiveListing(listing);
    incrementViews(listing.id);
  }

  // Close listing
  async function handleClose(id) {
    const { error: err } = await closeListing(id);
    if (err) {
      toast.error(t("marketplace.toast.failedClose"));
      return;
    }
    setMyListings(prev => prev.map(l => l.id === id ? { ...l, status: "closed" } : l));
    toast.success(t("marketplace.toast.listingClosed"));
  }

  // Delete listing
  async function handleDelete() {
    const { error: err } = await deleteListing(delId);
    if (err) {
      toast.error(t("marketplace.toast.failedDelete"));
      return;
    }
    setMyListings(prev => prev.filter(l => l.id !== delId));
    setListings(prev => prev.filter(l => l.id !== delId));
    setDelId(null);
    toast.success(t("marketplace.toast.listingDeleted"));
  }

  // After posting a new listing (Synchronisation serveur forcée)
  async function onPosted(newListing) {
    if (newListing) {
      setListings(prev => [newListing, ...prev]);
      setMyListings(prev => [newListing, ...prev]);
    }
    setModal(null);
    toast.success(t("marketplace.toast.listingPosted"));
    await load();
    if (profile?.id) await loadMine();
  }

  // After expressing interest
  function onInterestSent() {
    setModal(null);
    setActiveListing(null);
    toast.success(t("marketplace.toast.interestSent"));
  }

  const detailListing = activeListing;

  return (
    <PageShell 
      title={t("marketplace.title")}
      action={
        <div style={{ display: "flex", gap: 10 }}>
          {view === "browse"
            ? <Btn size="sm" variant="ghost" onClick={() => setView("mine")}>{t("marketplace.myListingsBtn")}</Btn>
            : <Btn size="sm" variant="ghost" onClick={() => setView("browse")}>{t("marketplace.browseBtn")}</Btn>
          }
          <Btn size="sm" onClick={() => setModal("post")}>{t("marketplace.postListingBtn")}</Btn>
        </div>
      }
    >
      <ErrorBoundary>
        {/* ── Post modal ── */}
        {modal === "post" && (
          <PostModal
            profile={profile}
            onClose={() => setModal(null)}
            onPosted={onPosted}
          />
        )}

        {/* ── Interest modal ── */}
        {modal === "interest" && detailListing && (
          <InterestModal
            listing={detailListing}
            profile={profile}
            onClose={() => setModal(null)}
            onSent={onInterestSent}
          />
        )}

        {/* ── Detail modal ── */}
        {detailListing && modal !== "interest" && (
          <ListingDetailModal
            listing={detailListing}
            profile={profile}
            fmt={fmt}
            onClose={() => { setActiveListing(null); setModal(null); }}
            onInterest={() => setModal("interest")}
          />
        )}

        {/* ── Delete confirm ── */}
        {delId && (
          <ConfirmModal 
            title={t("marketplace.deleteConfirm.title")}
            message={t("marketplace.deleteConfirm.message")}
            confirmLabel={t("marketplace.deleteConfirm.confirmLabel")} 
            onConfirm={handleDelete} 
            onClose={() => setDelId(null)}
          />
        )}

        {/* ════ BROWSE VIEW ════ */}
        {view === "browse" && (
          <>
            {/* Type tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {TYPE_IDS.map(id => (
                <button 
                  key={id} 
                  type="button" 
                  onClick={() => setActiveTab(id)} 
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 16px", borderRadius: T.r.md, border: "none",
                    fontSize: 14, fontWeight: activeTab === id ? 700 : 400, cursor: "pointer",
                    background: activeTab === id ? T.brand : T.surface,
                    color: activeTab === id ? "#fff" : T.muted,
                    boxShadow: activeTab === id ? T.shadow.md : T.shadow.sm,
                    transition: "all 0.15s",
                  }}
                >
                  <span>{TYPE_TAB_ICONS[id]}</span>{t(`marketplace.types.${id}`)}
                </button>
              ))}
            </div>

            {/* Filters row */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
              <input 
                style={{ ...iStyle, flex: 1, minWidth: 180 }}
                placeholder={t("marketplace.searchPlaceholder")}
                value={search} 
                onChange={e => setSearch(e.target.value)}
              />
              <select 
                style={{ ...iStyle, width: "auto" }}
                value={filterTrade} 
                onChange={e => setFilterTrade(e.target.value)}
              >
                <option value="All trades">{t("marketplace.allProfessions")}</option>
                {Object.values(VERTICALS).filter(v => v.id !== "other").map(v => (
                  <optgroup key={v.id} label={`${v.icon} ${getVerticalLabel(v, t)}`}>
                    {v.professions.map(p => <option key={p} value={p}>{getProfessionLabel(p, t)}</option>)}
                  </optgroup>
                ))}
              </select>
              <label style={{
                display: "flex", alignItems: "center", gap: 8, fontSize: 14,
                color: T.muted, cursor: "pointer", whiteSpace: "nowrap"
              }}>
                <input 
                  type="checkbox" 
                  checked={filterUrgent}
                  onChange={e => setFilterUrgent(e.target.checked)}
                />
                {t("marketplace.urgentOnly")}
              </label>
              <div style={{ fontSize: 13, color: T.muted, whiteSpace: "nowrap" }}>
                {t("marketplace.listingCount", { count: displayed.length })}
              </div>
            </div>

            {/* Stats bar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { label: t("marketplace.stats.activeDemands"), val: listings.filter(l => l.type === "demand").length, icon: "" },
                { label: t("marketplace.stats.businessesForSale"), val: listings.filter(l => l.type === "sale").length, icon: "" },
                { label: t("marketplace.stats.recruitmentPosts"), val: listings.filter(l => l.type === "recruitment").length, icon: "" },
                { label: t("marketplace.stats.materialsForSale"), val: listings.filter(l => l.type === "materials").length, icon: "" },
              ].map(s => (
                <div key={s.label} style={{
                  flex: "1 1 160px", background: T.surface, borderRadius: T.r.lg,
                  padding: "14px 18px", border: `1px solid ${T.border}`,
                  boxShadow: T.shadow.sm,
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: T.muted,
                    textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6
                  }}>
                    {s.icon} {s.label}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: T.text }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Listings grid */}
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
                <Card><Skeleton height={180} /></Card>
                <Card><Skeleton height={180} /></Card>
                <Card><Skeleton height={180} /></Card>
              </div>
            ) : error ? (
              <ErrorBox
                what={error.what}
                why={error.why}
                nextAction={error.nextAction}
                onRetry={load}
              />
            ) : displayed.length === 0 ? (
              <Empty 
                icon="" 
                message={t("marketplace.emptyBrowse")}
                action={<Btn size="sm" onClick={() => setModal("post")}>{t("marketplace.postFirstOne")}</Btn>}
              />
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
                  {displayed.map(l => (
                    <ListingCard 
                      key={l.id} 
                      listing={l} 
                      fmt={fmt}
                      onClick={() => openDetail(l)}
                    />
                  ))}
                </div>
                {hasMore && !search && (
                  <div style={{ textAlign: "center", marginTop: 24 }}>
                    <Btn size="sm" variant="secondary" onClick={loadMoreListings} disabled={loading}>
                      {loading ? t("marketplace.loadingMore", "Chargement...") : t("marketplace.loadMore", "Charger plus")}
                    </Btn>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ════ MY LISTINGS VIEW ════ */}
        {view === "mine" && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: T.text }}>
              {t("marketplace.yourListings", { count: myListings.length })}
            </div>
            {myListings.length === 0 ? (
              <Empty 
                icon="" 
                message={t("marketplace.emptyMine")}
                action={<Btn size="sm" onClick={() => setModal("post")}>{t("marketplace.postFirstListing")}</Btn>}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {myListings.map(l => (
                  <Card key={l.id} style={{ marginBottom: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <TypeBadge type={l.type} />
                          {l.urgent && <Badge color="red">{t("marketplace.urgent")}</Badge>}
                          <Badge color={l.status === "active" ? "green" : "gray"}>
                            {t(`marketplace.status.${l.status}`)}
                          </Badge>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{l.title}</div>
                        <div style={{ fontSize: 13, color: T.muted }}>
                          {l.location} · {getProfessionLabel(l.trade, t)} · {timeAgo(l.created_at, t, locale)}
                          {l.views > 0 && <span> · {t("marketplace.viewsCount", { count: l.views })}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginLeft: 16, flexShrink: 0 }}>
                        {l.status === "active" && (
                          <Btn size="sm" variant="ghost" onClick={() => handleClose(l.id)}>
                            {t("marketplace.close")}
                          </Btn>
                        )}
                        <Btn size="sm" variant="danger" onClick={() => setDelId(l.id)}>X</Btn>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </ErrorBoundary>
    </PageShell>
  );
}

/* ══════════════════════════════════════════════════════
  LISTING CARD
══════════════════════════════════════════════════════ */
function ListingCard({ listing: l, fmt, onClick }) {
  const { t, lang } = useTranslation();
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  const thumb = l.photos?.[0];

  return (
    <div 
      onClick={onClick} 
      style={{
        background: T.surface, borderRadius: T.r.lg,
        border: `1px solid ${T.border}`, overflow: "hidden",
        cursor: "pointer", boxShadow: T.shadow.sm,
        transition: "all 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = T.shadow.md}
      onMouseLeave={e => e.currentTarget.style.boxShadow = T.shadow.sm}
    >
      {/* Photo (materials listings only, when provided) */}
      {thumb && (
        <div style={{
          width: "100%", height: 160, background: `#f3f4f6 url(${thumb}) center/cover no-repeat`,
        }}/>
      )}

      <div style={{ padding: "18px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <TypeBadge type={l.type} />
            {l.urgent && <Badge color="red">{t("marketplace.urgent")}</Badge>}
            {l.condition && (
              <Badge color="gray">
                {t(`marketplace.materialConditions.${CONDITION_KEY[l.condition] || l.condition}`)}
              </Badge>
            )}
          </div>
          {l.views > 0 && <span style={{ fontSize: 11, color: T.hint }}>{l.views}</span>}
        </div>

        {/* Title */}
        <div style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 6, lineHeight: 1.3 }}>
          {l.title}
        </div>

        {/* Description */}
        <div style={{
          fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 12,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden"
        }}>
          {l.description}
        </div>

        {/* Tags row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {l.category && <span style={tagStyle}>{t(`marketplace.materialCategories.${l.category}`)}</span>}
          {l.trade && (
            <span style={tagStyle}>
              {getVerticalForProfession(l.trade)?.icon} {getProfessionLabel(l.trade, t)}
            </span>
          )}
          {l.location && <span style={tagStyle}>{l.location}</span>}
          {l.contract_type && <span style={tagStyle}>{t(`marketplace.contractTypes.${l.contract_type}`)}</span>}
          {l.quantity > 1 && <span style={tagStyle}>× {l.quantity}</span>}
          {l.work_start_date && (
            <span style={tagStyle}>{t("marketplace.fromDate", { date: fmtDate(l.work_start_date, locale) })}</span>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          paddingTop: 12, borderTop: `1px solid ${T.border}`
        }}>
          <div>
            {l.budget && (
              <span style={{ fontWeight: 800, fontSize: 16, color: T.brand }}>
                {fmt(l.budget)}
                {l.type === "demand" ? ` ${t("marketplace.card.budgetSuffixDemand")}` : l.type === "sale" ? ` ${t("marketplace.card.budgetSuffixSale")}` : ""}
              </span>
            )}
            {l.salary_range && <span style={{ fontWeight: 700, fontSize: 14, color: T.brand }}>{l.salary_range}</span>}
            {l.annual_revenue && (
              <span style={{ fontSize: 12, color: T.muted, marginLeft: 8 }}>
                {t("marketplace.card.revenueShort")}: {fmt(l.annual_revenue)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: T.hint }}>{timeAgo(l.created_at, t, locale)}</div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
  LISTING DETAIL MODAL
══════════════════════════════════════════════════════ */
function ListingDetailModal({ listing: l, profile, fmt, onClose, onInterest }) {
  const { t, lang } = useTranslation();
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  const isOwn = profile && (l.profile_id === profile.id || l.profile_id === profile.clerk_id);

  return (
    <Modal title="" onClose={onClose} width={580}>
      {/* Type + urgent badge */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <TypeBadge type={l.type} />
        {l.urgent && <Badge color="red">{t("marketplace.urgent")}</Badge>}
        {l.views > 0 && (
          <span style={{ fontSize: 12, color: T.hint, marginLeft: "auto" }}>
            {t("marketplace.viewsCount", { count: l.views })}
          </span>
        )}
      </div>

      {/* Photo gallery (materials listings) */}
      {l.photos?.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
          {l.photos.map((url, i) => (
            <img 
              key={i} 
              src={url} 
              alt={`${l.title} ${t("marketplace.photoAlt")} ${i + 1}`}
              style={{ width: 140, height: 140, objectFit: "cover", borderRadius: T.r.md, flexShrink: 0 }}
            />
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, marginBottom: 8 }}>{l.title}</h2>

      {/* Location + trade + date */}
      <div style={{ display: "flex", gap: 12, fontSize: 13, color: T.muted, marginBottom: 16, flexWrap: "wrap" }}>
        {l.location && <span>{l.location}</span>}
        {l.trade && (
          <span>{getVerticalForProfession(l.trade)?.icon} {getProfessionLabel(l.trade, t)}</span>
        )}
        <span>{timeAgo(l.created_at, t, locale)}</span>
      </div>

      {/* Description */}
      <div style={{
        fontSize: 14, color: T.text, lineHeight: 1.7, marginBottom: 20, whiteSpace: "pre-wrap"
      }}>
        {l.description}
      </div>

      {/* Details grid */}
      <div style={{ background: T.surface2, borderRadius: T.r.md, padding: "14px 18px", marginBottom: 20 }}>
        <DetailGrid listing={l} fmt={fmt} />
      </div>

      {/* Contact info (shown only to logged-in users or if public) */}
      {l.contact_name && (
        <div style={{
          background: T.brandLight, borderRadius: T.r.md,
          padding: "14px 18px", marginBottom: 20, border: `1px solid ${T.brand}20`
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>{t("marketplace.detail.contact")}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{l.contact_name}</div>
          {l.contact_email && l.contact_method !== "phone" && (
            <div style={{ fontSize: 13, color: T.muted }}>{l.contact_email}</div>
          )}
          {l.contact_phone && l.contact_method !== "email" && (
            <div style={{ fontSize: 13, color: T.muted }}>{l.contact_phone}</div>
          )}
        </div>
      )}

      {/* CTA */}
      {!isOwn && (
        <div style={{ display: "flex", gap: 10 }}>
          <Btn fullWidth size="lg" style={{ justifyContent: "center" }} onClick={onInterest}>
            {t("marketplace.detail.interestedBtn")}
          </Btn>
          {l.contact_phone && l.contact_method !== "email" && (
            <a href={`tel:${l.contact_phone}`} style={{ textDecoration: "none" }}>
              <Btn variant="ghost" size="lg">{t("marketplace.detail.call")}</Btn>
            </a>
          )}
        </div>
      )}
      {isOwn && (
        <div style={{ fontSize: 13, color: T.muted, textAlign: "center", padding: 8 }}>
          {t("marketplace.detail.thisIsYourListing")}
        </div>
      )}

      {!isOwn && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <ReportButton contentType="marketplace_listing" contentId={l.id} ownerProfileId={l.profile_id} />
        </div>
      )}
    </Modal>
  );
}

function DetailGrid({ listing: l, fmt }) {
  const { t, lang } = useTranslation();
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  const rows = [];
  if (l.type === "demand") {
    if (l.budget) rows.push([t("marketplace.detail.fields.budget"), fmt(l.budget)]);
    if (l.work_start_date) rows.push([t("marketplace.detail.fields.startDate"), fmtDate(l.work_start_date, locale)]);
  }
  if (l.type === "sale") {
    if (l.business_type) rows.push([t("marketplace.detail.fields.businessType"), l.business_type]);
    if (l.budget) rows.push([t("marketplace.detail.fields.askingPrice"), fmt(l.budget)]);
    if (l.annual_revenue) rows.push([t("marketplace.detail.fields.annualRevenue"), fmt(l.annual_revenue)]);
    if (l.employees) rows.push([t("marketplace.detail.fields.employees"), l.employees]);
  }
  if (l.type === "recruitment") {
    if (l.contract_type) rows.push([t("marketplace.detail.fields.contract"), t(`marketplace.contractTypes.${l.contract_type}`)]);
    if (l.salary_range) rows.push([t("marketplace.detail.fields.salaryRate"), l.salary_range]);
    if (l.experience_req) rows.push([t("marketplace.detail.fields.experience"), l.experience_req]);
  }
  if (l.type === "materials") {
    if (l.category) rows.push([t("marketplace.detail.fields.category"), t(`marketplace.materialCategories.${l.category}`)]);
    if (l.condition) rows.push([t("marketplace.detail.fields.condition"), t(`marketplace.materialConditions.${CONDITION_KEY[l.condition] || l.condition}`)]);
    if (l.budget) rows.push([t("marketplace.detail.fields.price"), fmt(l.budget)]);
    if (l.quantity) rows.push([t("marketplace.detail.fields.quantity"), l.quantity]);
  }
  if (!rows.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: T.muted,
            textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 2
          }}>{label}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
  POST LISTING MODAL
══════════════════════════════════════════════════════ */
function PostModal({ profile, onClose, onPosted }) {
  const { t } = useTranslation();
  const [type, setType] = useState("demand");
  const [step, setStep] = useState(1); // 1=type, 2=details, 3=contact
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", trade: "All trades", location: "",
    urgent: false, budget: "", work_start_date: "",
    business_type: "", annual_revenue: "", employees: "",
    contract_type: "Subcontracting", experience_req: "", salary_range: "",
    // materials-specific
    category: MATERIAL_CATEGORIES[0], condition: MATERIAL_CONDITIONS[0], quantity: "1",
    photo_url_1: null, photo_url_2: null, photo_url_3: null,
    contact_name: profile?.name || "",
    contact_email: profile?.email || "",
    contact_phone: profile?.phone || "",
    contact_method: "both",
  });
  const fld = k => e => setForm(p => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.title || !form.description || !form.location) {
      toast.error(t("marketplace.toast.requiredTitleDescLocation")); 
      return;
    }
    if (!form.contact_name || !form.contact_email) {
      toast.error(t("marketplace.toast.requiredContact")); 
      return;
    }
    setBusy(true);
    const payload = {
      type,
      title: form.title,
      description: form.description,
      trade: form.trade,
      location: form.location,
      urgent: form.urgent,
      budget: form.budget ? parseFloat(form.budget) : null,
      contact_name: form.contact_name,
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
      contact_method: form.contact_method,
      // type-specific
      ...(type === "demand" && {
        work_start_date: form.work_start_date || null,
      }),
      ...(type === "sale" && {
        business_type: form.business_type,
        annual_revenue: form.annual_revenue ? parseFloat(form.annual_revenue) : null,
        employees: form.employees ? parseInt(form.employees, 10) : null,
      }),
      ...(type === "recruitment" && {
        contract_type: form.contract_type,
        experience_req: form.experience_req,
        salary_range: form.salary_range,
      }),
      ...(type === "materials" && {
        category: form.category,
        condition: form.condition,
        quantity: form.quantity ? parseInt(form.quantity, 10) : 1,
        photos: [form.photo_url_1, form.photo_url_2, form.photo_url_3].filter(Boolean),
      }),
    };

    const userId = profile?.id || profile?.clerk_id;
    const { data, error } = await createListing(userId, payload);
    setBusy(false);
    if (error) { 
      console.error("[MarketplacePage] create listing error:", error);
      toast.error(t("marketplace.toast.failedPost")); 
      return; 
    }
    onPosted(data);
  }

  const TypeBtn = ({ id, icon }) => (
    <button 
      type="button" 
      onClick={() => setType(id)} 
      style={{
        padding: 16, borderRadius: T.r.lg, cursor: "pointer",
        border: type === id ? `2px solid ${T.brand}` : `1px solid ${T.border}`,
        background: type === id ? T.brandLight : T.surface,
        textAlign: "left", transition: "all 0.15s",
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: type === id ? T.brand : T.text }}>
        {t(`marketplace.post.typeCards.${id}.label`)}
      </div>
      <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.4 }}>
        {t(`marketplace.post.typeCards.${id}.desc`)}
      </div>
    </button>
  );

  return (
    <Modal title={t("marketplace.post.modalTitle")} onClose={onClose} width={560}>
      <form onSubmit={submit}>
        {/* Step 1 choose type */}
        {step === 1 && (
          <>
            <div style={{ fontSize: 14, color: T.muted, marginBottom: 16 }}>
              {t("marketplace.post.step1Prompt")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <TypeBtn id="demand" icon="" />
              <TypeBtn id="sale" icon="" />
              <TypeBtn id="recruitment" icon="" />
              <TypeBtn id="materials" icon="" />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn onClick={() => setStep(2)}>{t("marketplace.post.next")}</Btn>
            </div>
          </>
        )}

        {/* Step 2 listing details */}
        {step === 2 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <TypeBadge type={type} />
              <span style={{ fontSize: 13, color: T.muted }}>{t("marketplace.post.step2Of3")}</span>
            </div>

            <Field label={t("marketplace.post.fields.titleLabel")}>
              <input 
                style={iStyle} 
                value={form.title} 
                onChange={fld("title")} 
                autoFocus
                placeholder={t(`marketplace.post.fields.titlePlaceholders.${type}`)}
              />
            </Field>

            <Field label={t("marketplace.post.fields.descriptionLabel")}>
              <textarea 
                style={{ ...iStyle, height: 100, resize: "vertical" }}
                value={form.description} 
                onChange={fld("description")}
                placeholder={t("marketplace.post.fields.descriptionPlaceholder")}
              />
            </Field>

            <FieldRow>
              <Field label={t("marketplace.post.fields.professionLabel")} flex="1">
                <select style={iStyle} value={form.trade} onChange={fld("trade")}>
                  <option value="All trades">{t("marketplace.allProfessions")}</option>
                  {Object.values(VERTICALS).filter(v => v.id !== "other").map(v => (
                    <optgroup key={v.id} label={`${v.icon} ${getVerticalLabel(v, t)}`}>
                      {v.professions.map(p => <option key={p} value={p}>{getProfessionLabel(p, t)}</option>)}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label={t("marketplace.post.fields.locationLabel")} flex="1">
                <input 
                  style={iStyle} 
                  value={form.location} 
                  onChange={fld("location")}
                  placeholder={t("marketplace.post.fields.locationPlaceholder")}
                />
              </Field>
            </FieldRow>

            {/* Demand-specific */}
            {type === "demand" && (
              <FieldRow>
                <Field label={t("marketplace.post.fields.budgetLabel")} flex="1">
                  <input type="number" style={iStyle} value={form.budget} onChange={fld("budget")} min="0" />
                </Field>
                <Field label={t("marketplace.post.fields.startDateLabel")} flex="1">
                  <input type="date" style={iStyle} value={form.work_start_date} onChange={fld("work_start_date")} />
                </Field>
              </FieldRow>
            )}

            {/* Sale-specific */}
            {type === "sale" && (
              <>
                <FieldRow>
                  <Field label={t("marketplace.post.fields.businessTypeLabel")} flex="1">
                    <input 
                      style={iStyle} 
                      value={form.business_type} 
                      onChange={fld("business_type")}
                      placeholder={t("marketplace.post.fields.businessTypePlaceholder")}
                    />
                  </Field>
                  <Field label={t("marketplace.post.fields.askingPriceLabel")} flex="1">
                    <input type="number" style={iStyle} value={form.budget} onChange={fld("budget")} min="0" />
                  </Field>
                </FieldRow>
                <FieldRow>
                  <Field label={t("marketplace.post.fields.annualRevenueLabel")} flex="1">
                    <input type="number" style={iStyle} value={form.annual_revenue} onChange={fld("annual_revenue")} min="0" />
                  </Field>
                  <Field label={t("marketplace.post.fields.employeesLabel")} flex="1">
                    <input type="number" style={iStyle} value={form.employees} onChange={fld("employees")} min="0" />
                  </Field>
                </FieldRow>
              </>
            )}

            {/* Recruitment-specific */}
            {type === "recruitment" && (
              <>
                <FieldRow>
                  <Field label={t("marketplace.post.fields.contractTypeLabel")} flex="1">
                    <select style={iStyle} value={form.contract_type} onChange={fld("contract_type")}>
                      {CONTRACT_TYPES.map(ct => (
                        <option key={ct} value={ct}>{t(`marketplace.contractTypes.${ct}`)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("marketplace.post.fields.salaryRangeLabel")} flex="1">
                    <input 
                      style={iStyle} 
                      value={form.salary_range} 
                      onChange={fld("salary_range")}
                      placeholder={t("marketplace.post.fields.salaryRangePlaceholder")}
                    />
                  </Field>
                </FieldRow>
                <Field label={t("marketplace.post.fields.experienceLabel")}>
                  <input 
                    style={iStyle} 
                    value={form.experience_req} 
                    onChange={fld("experience_req")}
                    placeholder={t("marketplace.post.fields.experiencePlaceholder")}
                  />
                </Field>
              </>
            )}

            {/* Materials-specific */}
            {type === "materials" && (
              <>
                <FieldRow>
                  <Field label={t("marketplace.post.fields.categoryLabel")} flex="1">
                    <select style={iStyle} value={form.category} onChange={fld("category")}>
                      {MATERIAL_CATEGORIES.map(c => (
                        <option key={c} value={c}>{t(`marketplace.materialCategories.${c}`)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("marketplace.post.fields.conditionLabel")} flex="1">
                    <select style={iStyle} value={form.condition} onChange={fld("condition")}>
                      {MATERIAL_CONDITIONS.map(c => (
                        <option key={c} value={c}>{t(`marketplace.materialConditions.${CONDITION_KEY[c]}`)}</option>
                      ))}
                    </select>
                  </Field>
                </FieldRow>
                <FieldRow>
                  <Field label={t("marketplace.post.fields.priceLabel")} flex="1">
                    <input type="number" style={iStyle} value={form.budget} onChange={fld("budget")} min="0" />
                  </Field>
                  <Field label={t("marketplace.post.fields.quantityLabel")} flex="1">
                    <input type="number" style={iStyle} value={form.quantity} onChange={fld("quantity")} min="1" />
                  </Field>
                </FieldRow>
                <Field label={t("marketplace.post.fields.photosLabel")}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <PhotoUpload
                      profileId={profile?.id || profile?.clerk_id}
                      folder="marketplace"
                      value={form.photo_url_1}
                      onChange={url => setForm(p => ({ ...p, photo_url_1: url }))}
                      hintText={t("marketplace.post.fields.photoUploadHint")}
                      uploadingText={t("marketplace.post.fields.photoUploading")}
                      failedText={t("marketplace.post.fields.photoUploadFailed")}
                    />
                    {(form.photo_url_1 || form.photo_url_2) && (
                      <PhotoUpload
                        profileId={profile?.id || profile?.clerk_id}
                        folder="marketplace"
                        value={form.photo_url_2}
                        onChange={url => setForm(p => ({ ...p, photo_url_2: url }))}
                        hintText={t("marketplace.post.fields.photoUploadHintOptional")}
                        uploadingText={t("marketplace.post.fields.photoUploading")}
                        failedText={t("marketplace.post.fields.photoUploadFailed")}
                      />
                    )}
                    {(form.photo_url_2 || form.photo_url_3) && (
                      <PhotoUpload
                        profileId={profile?.id || profile?.clerk_id}
                        folder="marketplace"
                        value={form.photo_url_3}
                        onChange={url => setForm(p => ({ ...p, photo_url_3: url }))}
                        hintText={t("marketplace.post.fields.photoUploadHintOptional")}
                        uploadingText={t("marketplace.post.fields.photoUploading")}
                        failedText={t("marketplace.post.fields.photoUploadFailed")}
                      />
                    )}
                  </div>
                </Field>
              </>
            )}

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, cursor: "pointer", marginBottom: 4 }}>
              <input 
                type="checkbox" 
                checked={form.urgent} 
                onChange={fld("urgent")}
                style={{ width: 16, height: 16 }}
              />
              <span>{t("marketplace.post.markUrgent")}</span>
            </label>

            <div style={{
              display: "flex", gap: 10, justifyContent: "space-between",
              marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}`
            }}>
              <Btn variant="ghost" onClick={() => setStep(1)}>{t("marketplace.post.back")}</Btn>
              <Btn onClick={() => setStep(3)}>{t("marketplace.post.next")}</Btn>
            </div>
          </>
        )}

        {/* Step 3 contact details */}
        {step === 3 && (
          <>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 18 }}>
              {t("marketplace.post.step3Of3")}
            </div>

            <Field label={t("marketplace.post.contact.yourName")}>
              <input style={iStyle} value={form.contact_name} onChange={fld("contact_name")} />
            </Field>
            <FieldRow>
              <Field label={t("marketplace.post.contact.email")} flex="1">
                <input type="email" style={iStyle} value={form.contact_email} onChange={fld("contact_email")} />
              </Field>
              <Field label={t("marketplace.post.contact.phone")} flex="1">
                <input 
                  style={iStyle} 
                  value={form.contact_phone} 
                  onChange={fld("contact_phone")}
                  placeholder={t("marketplace.post.contact.phonePlaceholder")}
                />
              </Field>
            </FieldRow>
            <Field label={t("marketplace.post.contact.preferredMethod")}>
              <select style={iStyle} value={form.contact_method} onChange={fld("contact_method")}>
                <option value="both">{t("marketplace.post.contact.methodOptions.both")}</option>
                <option value="email">{t("marketplace.post.contact.methodOptions.email")}</option>
                <option value="phone">{t("marketplace.post.contact.methodOptions.phone")}</option>
              </select>
            </Field>

            <div style={{
              background: T.surface2, borderRadius: T.r.md,
              padding: "12px 16px", fontSize: 13, color: T.muted, marginBottom: 4, lineHeight: 1.6
            }}>
              {t("marketplace.post.contact.privacyNote")}
            </div>

            <div style={{
              display: "flex", gap: 10, justifyContent: "space-between",
              marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}`
            }}>
              <Btn variant="ghost" onClick={() => setStep(2)}>{t("marketplace.post.back")}</Btn>
              <Btn type="submit" disabled={busy}>
                {busy ? <Spinner size={16} color="#FFF" /> : t("marketplace.post.postBtn")}
              </Btn>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

export function InterestModal({ listing, profile, onClose, onSent }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: profile?.name ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
    message: "",
  });

  const fld = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error(t("marketplace.toast.requiredInterestFields"));
      return;
    }

    setBusy(true);
    const { error } = await expressInterest(listing.id, {
      profile_id: profile?.id || profile?.clerk_id,
      ...form,
    });
    setBusy(false);

    if (error) {
      toast.error(t("marketplace.toast.failedInterest"));
      return;
    }

    onSent();
  }

  return (
    <Modal
      title={`${t("marketplace.interest.title")} ${
        listing?.title ? `— "${listing.title}"` : ""
      }`}
      onClose={onClose}
      width={520}
    >
      <form onSubmit={submit}>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 16, lineHeight: 1.5 }}>
          {t("marketplace.interest.prompt")}
        </div>

        <Field label={t("marketplace.interest.fields.name")}>
          <input
            style={iStyle}
            value={form.name}
            onChange={fld("name")}
            placeholder={t("marketplace.interest.placeholders.name")}
            autoFocus
          />
        </Field>

        <FieldRow>
          <Field label={t("marketplace.interest.fields.email")} flex="1">
            <input
              type="email"
              style={iStyle}
              value={form.email}
              onChange={fld("email")}
              placeholder={t("marketplace.interest.placeholders.email")}
            />
          </Field>
          <Field label={t("marketplace.interest.fields.phone")} flex="1">
            <input
              style={iStyle}
              value={form.phone}
              onChange={fld("phone")}
              placeholder={t("marketplace.interest.placeholders.phone")}
            />
          </Field>
        </FieldRow>

        <Field label={t("marketplace.interest.fields.message")}>
          <textarea
            style={{ ...iStyle, height: 110, resize: "vertical" }}
            value={form.message}
            onChange={fld("message")}
            placeholder={t("marketplace.interest.placeholders.message")}
          />
        </Field>

        <FormActions
          onCancel={onClose}
          submitLabel={busy ? <Spinner size={16} color="#FFF" /> : t("marketplace.interest.sendBtn")}
          loading={busy}
        />
      </form>
    </Modal>
  );
}