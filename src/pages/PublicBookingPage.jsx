/* ══════════════════════════════════════════════════════
  src/pages/PublicBookingPage.jsx (Cleaned: No Icons/Emojis)
══════════════════════════════════════════════════════ */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useTranslation } from "../i18n/index.js";
import { supabase } from "../lib/supabase";
import { getTerms, getVerticalColor, getVerticalForProfession } from "../lib/professions.js";
import { formatCurrency } from "../lib/currency.js";
import Honeypot, { isBotSubmission } from "../components/Honeypot.jsx";
import Turnstile from "../components/Turnstile.jsx";
import { checkRateLimit } from "../lib/security.js";

// Le formulaire public est aussi accessible sans ClerkProvider (mode démo,
// voir main.jsx). useUser() plante s'il n'y a pas de <ClerkProvider> au-dessus,
// donc on l'appelle défensivement pour ne jamais casser la page pour un vrai
// client anonyme.
function useOptionalClerkUser() {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useUser();
  } catch {
    return { user: null, isLoaded: true };
  }
}

// ── CONSTANTS & STYLES ─────────────────────────────────
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const THEME = {
  brand: "#E8500A",
  brandLight: "#FFF0EB",
  surface: "#FFFFFF",
  bg: "#FAF9F6",
  border: "rgba(0,0,0,0.09)",
  muted: "#6B6460",
  text: "#14171F",
  green: "#059669",
  greenBg: "#D1FAE5",
  radius: { sm: 6, md: 10, lg: 16, xl: 22 },
  shadow: "0 2px 20px rgba(0,0,0,0.07)",
};

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: THEME.radius.md,
  border: `1px solid ${THEME.border}`,
  fontSize: 15,
  background: THEME.surface,
  color: THEME.text,
  boxSizing: "border-box",
  fontFamily: "inherit",
};

// ── UTILS ──────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

function generateSlots(startTime, endTime, durationMins) {
  const slots = [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  
  let currentMins = sh * 60 + sm;
  const endMins = eh * 60 + em;

  while (currentMins + durationMins <= endMins) {
    slots.push(`${pad(Math.floor(currentMins / 60))}:${pad(currentMins % 60)}`);
    currentMins += durationMins;
  }
  return slots;
}

// ── UI ELEMENTS ────────────────────────────────────────
function Avatar({ name, size = 64 }) {
  const initials = useMemo(() => {
    return (name || "?")
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [name]);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: THEME.brand,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.35,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: `3px solid ${THEME.border}`,
          borderTopColor: THEME.brand,
          animation: "spin 0.65s linear infinite",
        }}
      />
    </>
  );
}

// ── Graceful degradation: SafeImage ──────────────────────────────
// If a service photo's URL 404s or fails to load, falls back to a
// plain icon block instead of the browser's default broken-image glyph.
function SafeImage({ src, alt, style, fallbackIcon = "photo" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div style={{ ...style, background: THEME.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: THEME.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {fallbackIcon}
      </div>
    );
  }
  return <img src={src} alt={alt} style={style} onError={() => setFailed(true)} />;
}

// ── Graceful degradation: local ErrorBoundary ────────────────────
// Public, anonymous-visitor-facing page — a blank white screen with no
// explanation is the worst outcome if something throws mid-render.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error("PublicBookingPage crashed:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: THEME.bg, padding: 20 }}>
          <div style={{ textAlign: "center", maxWidth: 360 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 14, color: THEME.muted, marginBottom: 20 }}>
              This page hit an unexpected error. Reloading usually fixes it.
            </p>
            <button onClick={() => window.location.reload()}
              style={{ background: THEME.brand, color: "#fff", border: "none", padding: "10px 20px", borderRadius: THEME.radius.md, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Loading: skeleton screen ─────────────────────────────────────
function SkeletonBlock({ width = "100%", height = 16, style }) {
  return (
    <>
      <style>{`@keyframes skPulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
      <div style={{ width, height, borderRadius: 6, background: THEME.border, animation: "skPulse 1.4s ease-in-out infinite", ...style }} />
    </>
  );
}
function PageSkeleton() {
  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, padding: "28px 20px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ background: THEME.surface, borderRadius: THEME.radius.xl, border: `1px solid ${THEME.border}`, padding: "22px 26px", marginBottom: 20, display: "flex", gap: 16, alignItems: "center" }}>
          <SkeletonBlock width={56} height={56} style={{ borderRadius: "50%" }} />
          <div style={{ flex: 1 }}>
            <SkeletonBlock width="40%" height={18} style={{ marginBottom: 8 }} />
            <SkeletonBlock width="55%" height={13} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
          <SkeletonBlock height={140} style={{ borderRadius: THEME.radius.lg }} />
          <SkeletonBlock height={140} style={{ borderRadius: THEME.radius.lg }} />
        </div>
      </div>
    </div>
  );
}

// ── Error state: 3-part rule (what / why / what to do) ───────────
// `error` can be a plain string (kept for backwards compatibility with
// messages coming straight from checkRateLimit) or a { what, why } object.
function ErrorNotice({ error, action, actionLabel, onAction }) {
  if (!error) return null;
  const what = typeof error === "string" ? error : error.what;
  const why  = typeof error === "string" ? null : error.why;
  return (
    <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: THEME.radius.md, padding: "12px 16px" }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#B91C1C", marginBottom: why ? 4 : 0 }}>{what}</div>
      {why && <div style={{ fontSize: 12, color: "#991B1B", marginBottom: action ? 10 : 0, lineHeight: 1.5 }}>{why}</div>}
      {action && (
        <button type="button" onClick={onAction}
          style={{ background: "#fff", border: "1px solid #FECACA", color: "#B91C1C", padding: "7px 14px", borderRadius: THEME.radius.sm, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: why ? 0 : 8 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ── Success: discrete toast ───────────────────────────────────────
// Non-blocking, bottom-right, auto-dismisses. No new dependency.
function DiscreteToast({ message, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 200,
      background: THEME.text, color: "#fff", padding: "10px 16px", borderRadius: THEME.radius.md,
      fontSize: 13, fontWeight: 700, boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
    }}>
      {message}
    </div>
  );
}

function Steps({ current, hasServices }) {
  const { t: tr } = useTranslation();
  const steps = hasServices
    ? [tr("publicBooking.stepService"), tr("publicBooking.stepDateTime"), tr("publicBooking.stepDetails")]
    : [tr("publicBooking.stepDateTime"), tr("publicBooking.stepDetails")];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
      {steps.map((label, i) => {
        const stepIdx = i + (hasServices ? 1 : 2);
        const isActive = current === stepIdx || (!hasServices && current === stepIdx + 1);
        const isDone = current > stepIdx || (!hasServices && current > stepIdx + 1);

        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  background: isDone ? THEME.green : isActive ? THEME.brand : THEME.border,
                  color: isDone || isActive ? "#fff" : THEME.muted,
                  flexShrink: 0,
                }}
              >
                {isDone ? "" : i + 1}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: isActive ? THEME.brand : THEME.muted,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: THEME.border, margin: "0 8px 20px" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── CALENDAR ───────────────────────────────────────────
function Calendar({ availability, blockedSlots, selectedService, onSelectSlot, selectedDate, selectedTime }) {
  const { t: tr, lang } = useTranslation();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [year, setYear] = useState(() => today.getFullYear());
  const [month, setMonth] = useState(() => today.getMonth());

  const duration = selectedService?.duration_min || 60;
  const availDays = useMemo(() => new Set((availability || []).map((a) => a.day_of_week)), [availability]);
  const blockedSet = useMemo(() => new Set((blockedSlots || []).map((b) => `${b.slot_date} ${b.slot_time.slice(0, 5)}`)), [blockedSlots]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysCount = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const getSlotsForDate = useCallback(
    (date) => {
      const dow = date.getDay();
      const dayAvail = (availability || []).filter((a) => a.day_of_week === dow);
      if (!dayAvail.length) return [];

      const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

      return dayAvail
        .flatMap((a) => generateSlots(a.start_time.slice(0, 5), a.end_time.slice(0, 5), duration))
        .filter((slot) => !blockedSet.has(`${dateStr} ${slot}`))
        .filter((slot, idx, arr) => arr.indexOf(slot) === idx)
        .sort();
    },
    [availability, duration, blockedSet]
  );

  const gridCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysCount; d++) cells.push(d);
    return cells;
  }, [firstDay, daysCount]);

  const selectedDateObj = selectedDate ? new Date(selectedDate + "T00:00:00") : null;
  const activeDaySlots = selectedDateObj ? getSlotsForDate(selectedDateObj) : [];

  return (
    <div style={{ background: THEME.surface, borderRadius: THEME.radius.xl, border: `1px solid ${THEME.border}`, overflow: "hidden", boxShadow: THEME.shadow }}>
      {/* Month Navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${THEME.border}` }}>
        <button onClick={handlePrevMonth} style={{ background: "none", border: `1px solid ${THEME.border}`, borderRadius: THEME.radius.md, width: 34, height: 34, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
          &larr;
        </button>
        <div style={{ fontWeight: 700, fontSize: 16, textTransform: "capitalize" }}>
          {new Date(year, month, 1).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric" })}
        </div>
        <button onClick={handleNextMonth} style={{ background: "none", border: `1px solid ${THEME.border}`, borderRadius: THEME.radius.md, width: 34, height: 34, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
          &rarr;
        </button>
      </div>

      {/* Weekday Labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "10px 16px 4px" }}>
        {DAYS.map((d, i) => (
          <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: THEME.muted, paddingBottom: 8, textTransform: "capitalize" }}>
            {new Date(2024, 0, 7 + i).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "short" })}
          </div>
        ))}
      </div>

      {/* Day Cells Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, padding: "0 16px 16px" }}>
        {gridCells.map((dayNum, idx) => {
          if (!dayNum) return <div key={`empty-${idx}`} />;

          const cellDate = new Date(year, month, dayNum);
          cellDate.setHours(0, 0, 0, 0);

          const isPast = cellDate < today;
          const dow = cellDate.getDay();
          const hasAvail = availDays.has(dow) && !isPast;
          const slots = hasAvail ? getSlotsForDate(cellDate) : [];
          const hasSlots = slots.length > 0;

          const dateStr = `${year}-${pad(month + 1)}-${pad(dayNum)}`;
          const isSelected = selectedDate === dateStr;
          const isToday = cellDate.getTime() === today.getTime();

          return (
            <button
              key={dayNum}
              onClick={hasSlots ? () => onSelectSlot(dateStr, null) : undefined}
              disabled={!hasSlots}
              style={{
                aspectRatio: "1",
                borderRadius: THEME.radius.md,
                border: "none",
                fontWeight: isToday || isSelected ? 700 : 400,
                fontSize: 14,
                cursor: hasSlots ? "pointer" : "default",
                background: isSelected ? THEME.brand : isToday ? THEME.brandLight : "transparent",
                color: isSelected ? "#fff" : isPast || !hasSlots ? "#D0CCC8" : THEME.text,
                position: "relative",
              }}
            >
              {dayNum}
              {hasSlots && !isSelected && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 4,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: THEME.brand,
                    display: "block",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Time Slot Selector */}
      {selectedDate && (
        <div style={{ borderTop: `1px solid ${THEME.border}`, padding: "16px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: THEME.muted }}>
            {selectedDateObj?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          {activeDaySlots.length === 0 ? (
            <div style={{ fontSize: 13, color: THEME.muted }}>{tr("publicBooking.noSlotsThisDay")}</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {activeDaySlots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => onSelectSlot(selectedDate, slot)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: THEME.radius.md,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: `1.5px solid ${selectedTime === slot ? THEME.brand : THEME.border}`,
                    background: selectedTime === slot ? THEME.brand : "transparent",
                    color: selectedTime === slot ? "#fff" : THEME.text,
                    transition: "all .15s",
                  }}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SERVICE CARD ───────────────────────────────────────
function ServiceCard({ service, selected, onClick, currency }) {
  const { t: tr } = useTranslation();
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        border: "none",
        cursor: "pointer",
        borderRadius: THEME.radius.lg,
        overflow: "hidden",
        outline: selected ? `2.5px solid ${THEME.brand}` : `1.5px solid ${THEME.border}`,
        background: selected ? THEME.brandLight : THEME.surface,
        transition: "outline .15s, background .15s",
      }}
    >
      {service.image_url && (
        <div style={{ height: 140, overflow: "hidden" }}>
          <SafeImage src={service.image_url} alt={service.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} fallbackIcon="photo"/>
        </div>
      )}
      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: THEME.text }}>{service.name}</div>
          <div style={{ fontWeight: 800, fontSize: 14, color: THEME.brand, flexShrink: 0 }}>
            {formatCurrency(service.price, currency)}
          </div>
        </div>
        {service.duration_min && (
          <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>
            {service.duration_min < 60 ? `${service.duration_min} min` : `${Math.floor(service.duration_min / 60)}h${service.duration_min % 60 > 0 ? ` ${service.duration_min % 60}min` : ""}`}
          </div>
        )}
        {service.description && (
          <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4, lineHeight: 1.5 }}>{service.description}</div>
        )}
        {service.deposit_enabled && (
          <div style={{ fontSize: 12, fontWeight: 600, color: THEME.brand, marginTop: 6 }}>
            {service.deposit_type === "percent"
              ? tr("publicBooking.depositRequiredPercent", { percent: service.deposit_amount, amount: formatCurrency(service.price * service.deposit_amount / 100, currency) })
              : tr("publicBooking.depositRequiredFixed", { amount: formatCurrency(service.deposit_amount, currency) })}
          </div>
        )}
        {selected && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: THEME.brand }}>{tr("publicBooking.selectedLabel")}</div>}
      </div>
    </button>
  );
}

// ── IMAGE UPLOAD ───────────────────────────────────────
function ImageUpload({ value, onChange, label, hint }) {
  const { t: tr } = useTranslation();
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showToast, setShowToast] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;

    setUploadError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    const ext = file.name.split(".").pop();
    // Doit rester sous "requests/" — c'est le seul chemin autorisé par la
    // policy storage "booking_attachments_public_insert" (voir
    // sql/009_scope_booking_attachments.sql). Un autre préfixe fera
    // échouer l'upload avec une erreur RLS.
    const path = `requests/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from("booking-attachments").upload(path, file, { cacheControl: "3600" });
    setUploading(false);

    if (error) {
      setUploadError({
        what: "Couldn't upload your photo",
        why: "This can happen with a slow connection or a file that's too large. Try a smaller image, or continue without one.",
      });
      setPreview(null);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("booking-attachments").getPublicUrl(path);
    onChange(publicUrl);
    setShowToast(true);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setPreview(null);
    onChange(null);
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: THEME.muted, marginBottom: 6 }}>{label}</div>
      {hint && <div style={{ fontSize: 12, color: THEME.muted, marginBottom: 8, lineHeight: 1.5 }}>{hint}</div>}

      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files[0]);
        }}
        style={{
          border: `2px dashed ${preview ? THEME.brand : THEME.border}`,
          borderRadius: THEME.radius.lg,
          padding: preview ? "0" : "24px 16px",
          textAlign: "center",
          cursor: "pointer",
          background: preview ? "transparent" : THEME.bg,
          overflow: "hidden",
        }}
      >
        {uploading ? (
          <div style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <Spinner />
            <span style={{ fontSize: 14, color: THEME.muted }}>{tr("publicBooking.uploading")}</span>
          </div>
        ) : preview ? (
          <div style={{ position: "relative" }}>
            <img src={preview} alt="preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover" }} />
            <button
              type="button"
              onClick={handleClear}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: 26,
                height: 26,
                cursor: "pointer",
                fontSize: 15,
              }}
            >
              x
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: THEME.text }}>{tr("publicBooking.dropImage")}</div>
            <div style={{ fontSize: 11, color: THEME.muted, marginTop: 2 }}>{tr("publicBooking.imageFormats")}</div>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
      </div>

      {uploadError && (
        <div style={{ marginTop: 10 }}>
          <ErrorNotice error={uploadError} action actionLabel={tr("publicBooking.tryAgain")} onAction={() => { setUploadError(null); fileInputRef.current?.click(); }} />
        </div>
      )}
      {showToast && <DiscreteToast message={tr("publicBooking.photoUploaded")} onDone={() => setShowToast(false)} />}
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────
function PublicBookingPageInner() {
  const { t: tr, lang, setLanguage, languages } = useTranslation();
  const { slug } = useParams();
  const { user } = useOptionalClerkUser();

  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | found | notfound | error
  const [isOwner, setIsOwner] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [step, setStep] = useState(1);
  const [selSvc, setSelSvc] = useState(null);
  const [custom, setCustom] = useState(false);
  const [selDate, setSelDate] = useState(null);
  const [selTime, setSelTime] = useState(null);

  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    client_instructions: "",
    quoted_price: "",
  });

  const [clientImage, setClientImage] = useState(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [captchaToken, setCaptchaToken] = useState(null);
  const [formError, setFormError] = useState(""); // string OR { what, why } — see ErrorNotice
  const [fieldErrors, setFieldErrors] = useState({});

  const fmt = useCallback((n) => formatCurrency(n, profile?.currency), [profile?.currency]);
  const updateFormField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [key]: null }));
  };

  // Load profile and availability data
  async function loadData() {
    setStatus("loading");
    try {
      const { data: prof, error } = await supabase
        .from("public_profiles")
        .select("id, name, trade, bio, hourly_rate, booking_slug, extra_fields, plan, currency, language")
        .eq("booking_slug", slug)
        .single();

      if (error) {
        // PGRST116 = .single() found zero rows = a genuine 404 (this
        // booking page doesn't exist). Anything else — network failure,
        // 500, timeout — is retry-able and shouldn't look like a 404.
        if (error.code === "PGRST116") { setStatus("notfound"); return; }
        setStatus("error");
        return;
      }
      if (!prof) { setStatus("notfound"); return; }

      setProfile(prof);

      // Par défaut, la page affiche la langue du compte du pro — mais si ce
      // visiteur a déjà choisi une langue ici auparavant (ou via le
      // sélecteur), on respecte son choix plutôt que d'écraser sa préférence
      // à chaque visite.
      try {
        const hasVisitorChoice = typeof localStorage !== "undefined" && localStorage.getItem("Vimen_language");
        if (!hasVisitorChoice && prof.language && prof.language !== lang) {
          setLanguage(prof.language);
        }
      } catch { /* localStorage indisponible — pas bloquant */ }

      const [{ data: svcs }, { data: avail }, { data: blk }] = await Promise.all([
        supabase.from("services").select("*").eq("profile_id", prof.id).eq("active", true).order("sort_order"),
        supabase.from("availability").select("*").eq("profile_id", prof.id),
        supabase.from("blocked_slots").select("*").eq("profile_id", prof.id),
      ]);

      const fetchedServices = svcs ?? [];
      setServices(fetchedServices);
      setAvailability(avail ?? []);
      setBlocked(blk ?? []);
      setStep(fetchedServices.length > 0 ? 1 : 2);
      setStatus("found");
    } catch {
      // Network-level failure (fetch rejected outright) — also retry-able.
      setStatus("error");
    }
  }

  useEffect(() => {
    let isCancelled = false;
    (async () => {
      await loadData();
      if (isCancelled) return;
    })();
    return () => { isCancelled = true; };
  }, [slug]);

  // Détecte si le visiteur connecté est le pro propriétaire de cette page
  // (ex: il teste/prévisualise son propre lien de réservation).
  useEffect(() => {
    let isCancelled = false;

    if (!user) {
      setIsOwner(false);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("booking_slug")
        .eq("clerk_id", user.id)
        .single();

      if (!isCancelled) setIsOwner(data?.booking_slug === slug);
    })();

    return () => {
      isCancelled = true;
    };
  }, [user, slug]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible (permissions navigateur) — pas bloquant.
    }
  };

  const handleSlotSelect = (date, time) => {
    setSelDate(date);
    setSelTime(time);
    setFormError("");
  };

  function validateContactFields() {
    const errors = {};
    if (!form.customer_name.trim()) errors.customer_name = tr("publicBooking.errors.nameRequired");
    if (!form.customer_email.trim()) {
      errors.customer_email = tr("publicBooking.errors.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email.trim())) {
      errors.customer_email = tr("publicBooking.errors.emailInvalid");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (isOwner) return; // On ne prend pas de rdv avec soi-même.
    if (isBotSubmission(honeypot)) return; // Bot détecté, rejet silencieux.
    if (!validateContactFields()) return;
    if (!selDate || !selTime) {
      setFormError({ what: tr("publicBooking.errors.pickDateWhat"), why: tr("publicBooking.errors.pickDateWhy") });
      return;
    }
    if (!captchaToken) {
      setFormError("Please complete the verification challenge.");
      return;
    }

    setSending(true);

    const rateLimitMsg = await checkRateLimit("booking_request", {
      identifier: form.customer_email.trim(),
      turnstileToken: captchaToken,
      honeypot,
    });
    if (rateLimitMsg) {
      setSending(false);
      setFormError(rateLimitMsg);
      return;
    }

    const selectedService = services.find((s) => s.id === selSvc);
    const payload = {
      profile_id: profile.id,
      customer_name: form.customer_name,
      customer_email: form.customer_email,
      customer_phone: form.customer_phone || null,
      preferred_date: selDate,
      notes: `${selTime} — ${form.client_instructions || ""}`.trim(),
      service_id: selSvc || null,
      client_image_url: clientImage || null,
      client_instructions: form.client_instructions || null,
      quoted_price: custom && form.quoted_price ? parseFloat(form.quoted_price) : selectedService?.price ?? null,
      status: "pending",
    };

    try {
      const { error } = await supabase.from("booking_requests").insert(payload);
      setSending(false);

      if (error) {
        setFormError({
          what: "Couldn't send your request",
          why: "This is usually a temporary connection issue — your details weren't lost. Try sending again.",
        });
        return;
      }

      setDone(true);
    } catch {
      setSending(false);
      setFormError({ what: "Couldn't send your request", why: "Check your connection and try again — nothing was lost." });
    }
  };

  // State checks: Loading, Not Found, Error
  if (status === "loading") return <PageSkeleton />;

  if (status === "error") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: THEME.bg, padding: 20 }}>
        <div style={{ maxWidth: 380, width: "100%" }}>
          <ErrorNotice
            error={{ what: tr("publicBooking.loadErrorWhat"), why: tr("publicBooking.loadErrorWhy") }}
            action
            actionLabel={tr("publicBooking.tryAgain")}
            onAction={loadData}
          />
        </div>
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: THEME.bg, padding: 20 }}>
        <div style={{ textAlign: "center" }}>
          <h2>{tr("publicBooking.pageNotFound")}</h2>
        </div>
      </div>
    );
  }

  // Profile data derivations
  const certs = profile?.extra_fields?.certifications || [];
  const isPro = profile?.plan === "pro";
  // TEMPORAIREMENT DÉSACTIVÉ — pas de moyen de passer Pro pour l'instant
  // (pas de Stripe/SIRET actif), donc cette limite cacherait des
  // certifications indéfiniment. Remettre `isPro ? certs : certs.slice(0, 2)`
  // pour la réactiver une fois l'abonnement Pro de retour.
  const visibleCertifications = certs;

  const vertical = getVerticalForProfession(profile.trade);
  const verticalColor = getVerticalColor(profile.trade);
  const hasServices = services.length > 0;
  const selectedService = services.find((s) => s.id === selSvc);

  // Success view
  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: THEME.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 420, width: "100%", background: THEME.surface, borderRadius: THEME.radius.xl, padding: "48px 40px", boxShadow: THEME.shadow, textAlign: "center" }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>{tr("publicBooking.requestSentTitle")}</h2>
          <p style={{ fontSize: 15, color: THEME.muted, lineHeight: 1.7, marginBottom: 16 }}>
            {selDate && selTime
              ? tr("publicBooking.requestSentBodySlot", {
                  name: profile.name,
                  slot: `${selTime} ${new Date(selDate + "T00:00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long" })}`,
                })
              : tr("publicBooking.requestSentBodyGeneric", { name: profile.name })}
          </p>
          {selectedService && (
            <div style={{ background: THEME.brandLight, borderRadius: THEME.radius.md, padding: "12px 16px", marginBottom: 16, fontSize: 14 }}>
              <strong>{selectedService.name}</strong> — {fmt(selectedService.price)}
              {selectedService.deposit_enabled && (
                <div style={{ fontSize: 12, color: THEME.brand, marginTop: 4 }}>
                  {selectedService.deposit_type === "percent"
                    ? tr("publicBooking.depositOnConfirmPercent", { percent: selectedService.deposit_amount, amount: fmt(selectedService.price * selectedService.deposit_amount / 100) })
                    : tr("publicBooking.depositOnConfirmFixed", { amount: fmt(selectedService.deposit_amount) })}
                </div>
              )}
            </div>
          )}
          <div style={{ fontSize: 13, color: THEME.muted }}>
            {tr("publicBooking.confirmationSentTo")} <strong>{form.customer_email}</strong>
          </div>
        </div>
      </div>
    );
  }

  // Main multi-step booking view
  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, fontFamily: "'Inter',sans-serif", WebkitFontSmoothing: "antialiased" }}>
      {/* Top Bar Navigation */}
      <div style={{ background: THEME.surface, borderBottom: `1px solid ${THEME.border}` }}>
        <div style={{ maxWidth: 720, margin: "0 auto", height: 56, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ fontSize: 15, fontWeight: 900, color: THEME.brand, textDecoration: "none" }}>
            Vimen
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", border: `1px solid ${THEME.border}`, borderRadius: 100, padding: 2 }}>
              {languages.map(l => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLanguage(l.code)}
                  style={{
                    border: "none",
                    background: lang === l.code ? THEME.brand : "transparent",
                    color: lang === l.code ? "#fff" : THEME.muted,
                    borderRadius: 100,
                    padding: "3px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {l.code.toUpperCase()}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 13, color: THEME.muted }}>{profile.name}</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
        {/* Owner preview notice */}
        {isOwner && (
          <div
            style={{
              background: "#FEF3C7",
              border: "1px solid #F59E0B",
              borderRadius: THEME.radius.lg,
              padding: "12px 16px",
              marginBottom: 20,
              fontSize: 13,
              color: "#92400E",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>
              {tr("publicBooking.ownerPreviewNotice")}
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                flexShrink: 0,
                padding: "6px 12px",
                borderRadius: THEME.radius.sm,
                border: "1px solid #F59E0B",
                background: "transparent",
                color: "#92400E",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {linkCopied ? tr("publicBooking.copiedLabel") : tr("publicBooking.copyLinkBtn")}
            </button>
          </div>
        )}

        {/* Profile Card Header */}
        <div style={{ background: THEME.surface, borderRadius: THEME.radius.xl, border: `1px solid ${THEME.border}`, padding: "22px 26px", marginBottom: 20, boxShadow: THEME.shadow, display: "flex", gap: 16, alignItems: "center" }}>
          <Avatar name={profile.name} size={56} />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5, margin: 0 }}>{profile.name}</h1>
            <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ background: verticalColor.bg, color: verticalColor.text, borderRadius: 100, padding: "3px 12px", fontSize: 13, fontWeight: 700 }}>
                {profile.trade}
              </span>
              {profile.bio && <span style={{ fontSize: 13, color: THEME.muted }}>{profile.bio}</span>}
            </div>
            {visibleCertifications.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {visibleCertifications.map((cert, idx) => (
                  <span key={idx} style={{ fontSize: 11, background: THEME.bg, padding: "2px 8px", borderRadius: THEME.radius.sm, color: THEME.muted }}>
                    {cert}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Form Steps Bar */}
        <Steps current={step} hasServices={hasServices} />

        {/* STEP 1: SERVICE SELECTION */}
        {step === 1 && hasServices && (
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{tr("publicBooking.chooseServiceTitle")}</div>
            <div style={{ fontSize: 13, color: THEME.muted, marginBottom: 16 }}>{tr("publicBooking.chooseServiceSub")}</div>

            <div style={{ display: "grid", gridTemplateColumns: services.some((s) => s.image_url) ? "repeat(2,1fr)" : "1fr", gap: 12, marginBottom: 12 }}>
              {services.map((svc) => (
                <ServiceCard
                  key={svc.id}
                  service={svc}
                  selected={selSvc === svc.id}
                  currency={profile?.currency}
                  onClick={() => {
                    setSelSvc(svc.id);
                    setCustom(false);
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setCustom(true);
                setSelSvc(null);
              }}
              style={{
                width: "100%",
                padding: "14px 18px",
                textAlign: "left",
                cursor: "pointer",
                borderRadius: THEME.radius.lg,
                border: `1.5px dashed ${custom ? THEME.brand : THEME.border}`,
                background: custom ? THEME.brandLight : "transparent",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: custom ? THEME.brand : THEME.text }}>{tr("publicBooking.somethingElse")}</div>
                <div style={{ fontSize: 12, color: THEME.muted }}>{tr("publicBooking.somethingElseSub")}</div>
              </div>
              {custom && <span style={{ marginLeft: "auto", color: THEME.brand, fontWeight: 700 }}>{tr("publicBooking.selectedLabel")}</span>}
            </button>

            <button
              onClick={() => setStep(2)}
              disabled={!selSvc && !custom}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: THEME.radius.lg,
                border: "none",
                background: THEME.brand,
                color: "#fff",
                fontWeight: 800,
                fontSize: 15,
                cursor: !selSvc && !custom ? "not-allowed" : "pointer",
                opacity: !selSvc && !custom ? 0.5 : 1,
                fontFamily: "inherit",
              }}
            >
              {tr("publicBooking.continueBtn")}
            </button>
          </div>
        )}

        {/* STEP 2: DATE & TIME SELECTION */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{tr("publicBooking.pickDateTimeTitle")}</div>
            <div style={{ fontSize: 13, color: THEME.muted, marginBottom: 16 }}>
              {selectedService ? tr("publicBooking.slotsShownFor", { minutes: selectedService.duration_min }) : tr("publicBooking.choosePreferredSlot")}
            </div>

            {availability.length === 0 ? (
              <div style={{ background: THEME.surface, borderRadius: THEME.radius.xl, border: `1px solid ${THEME.border}`, padding: "32px 24px", textAlign: "center", color: THEME.muted, fontSize: 14 }}>
                {tr("publicBooking.noAvailabilitySet")}
                <br />
                {tr("publicBooking.contactDirectly")}
              </div>
            ) : (
              <Calendar
                availability={availability}
                blockedSlots={blocked}
                selectedService={selectedService}
                onSelectSlot={handleSlotSelect}
                selectedDate={selDate}
                selectedTime={selTime}
              />
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              {hasServices && (
                <button
                  onClick={() => setStep(1)}
                  style={{
                    flex: 1,
                    padding: "13px",
                    borderRadius: THEME.radius.lg,
                    border: `1px solid ${THEME.border}`,
                    background: THEME.surface,
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {tr("publicBooking.backBtn")}
                </button>
              )}
              <button
                onClick={() => setStep(3)}
                disabled={!selDate || !selTime}
                style={{
                  flex: 2,
                  padding: "13px",
                  borderRadius: THEME.radius.lg,
                  border: "none",
                  background: THEME.brand,
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: !selDate || !selTime ? "not-allowed" : "pointer",
                  opacity: !selDate || !selTime ? 0.5 : 1,
                  fontFamily: "inherit",
                }}
              >
                {tr("publicBooking.continueBtn")}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CONTACT & SUBMISSION */}
        {step === 3 && (
          <form onSubmit={handleSubmit}>
            {/* Summary Banner */}
            <div style={{ background: THEME.brandLight, borderRadius: THEME.radius.lg, padding: "14px 18px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                {selectedService && (
                  <div style={{ fontSize: 14, fontWeight: 700, color: THEME.brand }}>
                    {selectedService.name} — {fmt(selectedService.price)}
                  </div>
                )}
                {selectedService?.deposit_enabled && (
                  <div style={{ fontSize: 12, color: THEME.brand, marginTop: 2 }}>
                    Deposit required upon confirmation:{" "}
                    {selectedService.deposit_type === "percent"
                      ? `${selectedService.deposit_amount}% (${fmt(selectedService.price * selectedService.deposit_amount / 100)})`
                      : fmt(selectedService.deposit_amount)}
                  </div>
                )}
                {selDate && selTime && (
                  <div style={{ fontSize: 13, color: THEME.muted }}>
                    {new Date(selDate + "T00:00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long" })} {tr("publicBooking.atTime")} {selTime}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setStep(2)} style={{ fontSize: 12, color: THEME.brand, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                {tr("publicBooking.changeBtn")}
              </button>
            </div>

            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{tr("publicBooking.yourDetailsTitle")}</div>
            <div style={{ fontSize: 13, color: THEME.muted, marginBottom: 16 }}>{tr("publicBooking.yourDetailsSub", { name: profile.name })}</div>

            <div style={{ background: THEME.surface, borderRadius: THEME.radius.xl, border: `1px solid ${THEME.border}`, padding: "24px", marginBottom: 16, boxShadow: THEME.shadow, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: THEME.muted, marginBottom: 6 }}>{tr("publicBooking.nameLabel")}</label>
                <input type="text" placeholder="John Doe" value={form.customer_name} onChange={updateFormField("customer_name")} style={{ ...inputStyle, ...(fieldErrors.customer_name ? { borderColor: "#DC2626" } : {}) }} />
                {fieldErrors.customer_name && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 5 }}>{fieldErrors.customer_name}</div>}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: THEME.muted, marginBottom: 6 }}>{tr("publicBooking.emailLabel")}</label>
                <input type="email" placeholder="john@example.com" value={form.customer_email} onChange={updateFormField("customer_email")} style={{ ...inputStyle, ...(fieldErrors.customer_email ? { borderColor: "#DC2626" } : {}) }} />
                {fieldErrors.customer_email && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 5 }}>{fieldErrors.customer_email}</div>}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: THEME.muted, marginBottom: 6 }}>{tr("publicBooking.phoneLabel")}</label>
                <input type="tel" placeholder="+1 (555) 000-0000" value={form.customer_phone} onChange={updateFormField("customer_phone")} style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: THEME.muted, marginBottom: 6 }}>{tr("publicBooking.notesLabel")}</label>
                <textarea placeholder="Any specific details or gate codes..." rows={3} value={form.client_instructions} onChange={updateFormField("client_instructions")} style={{ ...inputStyle, resize: "vertical" }} />
              </div>

              <ImageUpload value={clientImage} onChange={setClientImage} label={tr("publicBooking.attachPhotoLabel")} hint={tr("publicBooking.attachPhotoHint")} />
            </div>

            <Honeypot value={honeypot} onChange={setHoneypot} />

            <div style={{ marginBottom: 16 }}>
              <Turnstile onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
            </div>

            {formError && (
              <div style={{ marginBottom: 16 }}>
                <ErrorNotice error={formError} />
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setStep(2)} style={{ flex: 1, padding: "13px", borderRadius: THEME.radius.lg, border: `1px solid ${THEME.border}`, background: THEME.surface, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                {tr("publicBooking.backBtn")}
              </button>
              <button
                type="submit"
                disabled={sending || isOwner || !captchaToken}
                title={isOwner ? "You can't book with yourself" : undefined}
                style={{
                  flex: 2,
                  padding: "13px",
                  borderRadius: THEME.radius.lg,
                  border: "none",
                  background: THEME.brand,
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: sending || isOwner || !captchaToken ? "not-allowed" : "pointer",
                  opacity: sending || isOwner || !captchaToken ? 0.5 : 1,
                  fontFamily: "inherit",
                }}
              >
                {isOwner ? tr("publicBooking.ownPageBtn") : sending ? tr("publicBooking.sendingRequestBtn") : tr("publicBooking.requestBookingBtn")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function PublicBookingPage() {
  return (
    <ErrorBoundary>
      <PublicBookingPageInner />
    </ErrorBoundary>
  );
}