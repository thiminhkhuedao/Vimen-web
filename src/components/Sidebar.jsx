// src/components/Sidebar.jsx — Complete sidebar with all nav items
import { T } from "../styles/tokens";
import { getVerticalForProfession, getTerms, getProfessionLabel } from "../lib/professions.js";
import { useTranslation } from "../i18n/index.js";
import { Avatar } from "./UI.jsx";

export default function Sidebar({ page, setPage, profile, onSignOut, pendingBookings=0, pendingQuotes=0, mobileOpen=false, onCloseMobile=()=>{} }) {
  const { t } = useTranslation();
  const terms = getTerms(profile?.trade, t);

  const NAV_SECTIONS = [
    {
      label: t("nav.core"),
      items: [
        { id:"dashboard",      label:t("nav.dashboard") },
        { id:"jobs",           label:terms.bookingPlural },
        { id:"quotes",         label:t("nav.quotes") },
        { id:"clients",        label:t("nav.clients") },
        { id:"invoices",       label:t("nav.invoices") },
        { id:"booking",        label:t("nav.booking")},
      ]
    },
    {
      label: t("nav.revenue"),
      items: [
        { id:"payments",       label:t("nav.payments") },
        { id:"marketplace",    label:t("nav.marketplace")},
      ]
    },
    {
      label: t("nav.growthSection"),
      items: [
        { id:"reviews",        label:t("nav.reviews") },
        { id:"referrals",      label:t("nav.referrals")},
        { id:"certifications", label:t("nav.certifications")},
      ]
    },
    {
      label: t("nav.account"),
      items: [
        { id:"settings",       label:t("nav.settings")},
      ]
    },
  ];

  const BADGES = { booking:pendingBookings, quotes:pendingQuotes };

  return (
    <>
      <style>{`
        @media (max-width: 860px) {
          .vimen-sidebar {
            position: fixed !important;
            left: 0;
            top: 0;
            transform: translateX(-100%);
            transition: transform 0.2s ease;
            z-index: 200;
            box-shadow: 2px 0 20px rgba(0,0,0,0.2);
          }
          .vimen-sidebar.vimen-sidebar-open { transform: translateX(0); }
          .vimen-sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.4);
            z-index: 150;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
          }
          .vimen-sidebar-backdrop.vimen-sidebar-backdrop-open {
            opacity: 1;
            pointer-events: auto;
          }
          .vimen-sidebar-close { display: flex !important; }
        }
      `}</style>

      {/* Fond assombri derrière le tiroir, cliquable pour fermer */}
      <div
        className={`vimen-sidebar-backdrop ${mobileOpen ? "vimen-sidebar-backdrop-open" : ""}`}
        style={{ display: "none" }}
        onClick={onCloseMobile}
      />

      <nav className={`vimen-sidebar ${mobileOpen ? "vimen-sidebar-open" : ""}`} style={{
        width:220, background:T.surface, borderRight:`1px solid ${T.border}`,
        display:"flex", flexDirection:"column", flexShrink:0,
        position:"sticky", top:0, height:"100vh", zIndex:50,
        overflowY:"auto",
      }}>
      {/* Logo */}
      <div style={{ padding:"18px 20px 14px", borderBottom:`1px solid ${T.border}`, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:20, fontWeight:900, color:T.brand, letterSpacing:-0.5 }}> Vimen</div>
          <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>
            {profile?.trade
              ? `${getVerticalForProfession(profile.trade).icon} ${getProfessionLabel(profile.trade, t)}`
              : t("nav.tagline")}
          </div>
        </div>
        {/* Bouton fermer, visible seulement sur mobile (voir media query ci-dessus) */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="vimen-sidebar-close"
          style={{
            display:"none", alignItems:"center", justifyContent:"center",
            width:28, height:28, borderRadius:T.r.md, border:"none",
            background:T.surface2, color:T.muted, cursor:"pointer", fontSize:16, flexShrink:0,
          }}
          aria-label={t("common.close")}
        >
          ×
        </button>
      </div>

      {/* Nav sections */}
      <div style={{ flex:1, padding:"8px 8px", overflowY:"auto" }}>
        {NAV_SECTIONS.map(section => (
          <div key={section.label} style={{ marginBottom:4 }}>
            <div style={{ fontSize:10, fontWeight:700, color:T.hint, textTransform:"uppercase", letterSpacing:"0.8px", padding:"8px 12px 4px" }}>
              {section.label}
            </div>
            {section.items.map(item => {
              const active = page === item.id;
              const badge  = BADGES[item.id];
              return (
                <button key={item.id} onClick={() => { setPage(item.id); onCloseMobile(); }} style={{
                  display:"flex", alignItems:"center", gap:9,
                  width:"100%", padding:"8px 12px", borderRadius:T.r.md,
                  cursor:"pointer", marginBottom:1, border:"none",
                  textAlign:"left",
                  background: active ? T.brandLight : "transparent",
                  color:      active ? T.brand : T.muted,
                  fontSize:13, fontWeight: active ? 700 : 400,
                  transition:"all 0.12s",
                }}>
                  <span style={{ fontSize:14, flexShrink:0, opacity: active ? 1 : 0.65 }}>{item.icon}</span>
                  <span style={{ flex:1 }}>{item.label}</span>
                  {badge > 0 && (
                    <span style={{ background:T.brand, color:"#fff", borderRadius:T.r.full, fontSize:10, fontWeight:800, padding:"1px 6px" }}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User area */}
      <div style={{ padding:"12px 14px", borderTop:`1px solid ${T.border}`, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
          {/* Photo de profil si elle existe, sinon les initiales (géré par Avatar) */}
          <Avatar name={profile?.name} size={32} src={profile?.avatar_url} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{profile?.name || "…"}</div>
          </div>
        </div>
        <button type="button" onClick={onSignOut} style={{ width:"100%", padding:"6px", borderRadius:T.r.md, background:T.surface2, color:T.muted, border:"none", cursor:"pointer", fontSize:12, fontWeight:500 }}>
          {t("common.signOut")}
        </button>
      </div>
    </nav>
    </>
  );
}