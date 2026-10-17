/* ══════════════════════════════════════════════════════
  src/pages/PublicBookingPage.jsx (corrigé)
══════════════════════════════════════════════════════ */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useTranslation } from "../i18n/index.js";
import { supabase } from "../lib/supabase";
import { getVerticalColor } from "../lib/professions.js";
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

// Traduction avec texte de secours : si la clé n'existe pas encore dans les
// fichiers de langue, on affiche le texte anglais au lieu de la clé brute.
function useTf() {
  const { t } = useTranslation();
  return useCallback(
    (key, fallback, vars) => {
      const value = t(key, vars);
      return value && value !== key ? value : fallback;
    },
    [t]
  );
}

// ── CONSTANTS & STYLES ─────────────────────────────────
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 Mo

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
function Avatar({ name, src, size = 64 }) {
  const [failed, setFailed] = useState(false);

  const initials = useMemo(() => {
    return (name || "?")
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [name]);

  // Si l'URL change (nouvelle photo), on retente le chargement.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => {
          console.warn("Avatar introuvable ou inaccessible :", src);
          setFailed(true);
        }}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

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
// Si l'URL d'une photo de service est en 404, on affiche un bloc neutre
// plutôt que l'icône d'image cassée du navigateur.
function SafeImage({ src, alt, style, fallbackIcon = "photo" }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

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
// Page publique : un écran blanc sans explication serait le pire résultat.
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

// ── Error state: règle en 3 parties (quoi / pourquoi / que faire) ─
// `error` peut être une chaîne (messages de checkRateLimit) ou { what, why }.
function ErrorNotice({ error, action, actionLabel, onAction }) {
  if (!error) return null;
  const what = typeof error === "string" ? error : error.what;
  const why = typeof error === "string" ? null : error.why;
  return (
    <div role="alert" style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: THEME.radius.md, padding: "12px 16px" }}>
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

// ── Success: toast discret ────────────────────────────────────────
// `onDone` doit être stable (useCallback) sinon le minuteur repart à chaque rendu.
function DiscreteToast({ message, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <div role="status" style={{
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
        // Numéro réel de l'étape dans le flux : 1/2/3 avec services, 2/3 sans.
        const stepNumber = hasServices ? i + 1 : i + 2;
        const isActive = current === stepNumber;
        const isDone = current > stepNumber;

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
                {isDone ? "\u2713" : i + 1}
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
  const locale = lang === "fr" ? "fr-FR" : "en-GB";

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

  // On ne remonte pas avant le mois en cours.
  const canGoPrev = year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth());

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
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

      // Aujourd'hui : on masque les créneaux déjà passés.
      const now = new Date();
      const isToday = dateStr === `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const nowMins = now.getHours() * 60 + now.getMinutes();

      return dayAvail
        .flatMap((a) => generateSlots(a.start_time.slice(0, 5), a.end_time.slice(0, 5), duration))
        .filter((slot) => !blockedSet.has(`${dateStr} ${slot}`))
        .filter((slot) => {
          if (!isToday) return true;
          const [h, m] = slot.split(":").map(Number);
          return h * 60 + m > nowMins;
        })
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
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={!canGoPrev}
          aria-label="Previous month"
          style={{ background: "none", border: `1px solid ${THEME.border}`, borderRadius: THEME.radius.md, width: 34, height: 34, cursor: canGoPrev ? "pointer" : "not-allowed", opacity: canGoPrev ? 1 : 0.4, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          &larr;
        </button>
        <div style={{ fontWeight: 700, fontSize: 16, textTransform: "capitalize" }}>
          {new Date(year, month, 1).toLocaleDateString(locale, { month: "long", year: "numeric" })}
        </div>
        <button
          type="button"
          onClick={handleNextMonth}
          aria-label="Next month"
          style={{ background: "none", border: `1px solid ${THEME.border}`, borderRadius: THEME.radius.md, width: 34, height: 34, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          &rarr;
        </button>
      </div>

      {/* Weekday Labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "10px 16px 4px" }}>
        {DAYS.map((d, i) => (
          <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: THEME.muted, paddingBottom: 8, textTransform: "capitalize" }}>
            {new Date(2024, 0, 7 + i).toLocaleDateString(locale, { weekday: "short" })}
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
              type="button"
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
            {selectedDateObj?.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
          </div>
          {activeDaySlots.length === 0 ? (
            <div style={{ fontSize: 13, color: THEME.muted }}>{tr("publicBooking.noSlotsThisDay")}</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {activeDaySlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
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
      type="button"
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
        fontFamily: "inherit",
      }}
    >
      {service.image_url && (
        <div style={{ height: 140, overflow: "hidden" }}>
          <SafeImage src={service.image_url} alt={service.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} fallbackIcon="photo" />
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
  const tf = useTf();
  const fileInputRef = useRef(null);
  const previewRef = useRef(null); // URL locale (blob:) à libérer
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showToast, setShowToast] = useState(false);

  const hideToast = useCallback(() => setShowToast(false), []);

  const releasePreview = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
  };

  // Libère l'URL locale quand le composant disparaît.
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  // Aperçu local, ou à défaut l'image déjà envoyée (ex. depuis l'étape 1).
  const shown = preview || value || null;

  const handleFile = async (file) => {
    if (!file) return;
    setUploadError(null);

    if (!file.type.startsWith("image/")) {
      setUploadError({
        what: tf("publicBooking.uploadNotImageWhat", "This file isn't an image"),
        why: tf("publicBooking.uploadNotImageWhy", "Choose a JPG, PNG or WebP photo."),
      });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError({
        what: tf("publicBooking.uploadTooLargeWhat", "This photo is too large"),
        why: tf("publicBooking.uploadTooLargeWhy", "Choose a photo under 8 MB."),
      });
      return;
    }

    releasePreview();
    const localUrl = URL.createObjectURL(file);
    previewRef.current = localUrl;
    setPreview(localUrl);
    setUploading(true);

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    // Doit rester sous "requests/" — c'est le seul chemin autorisé par la
    // policy storage "booking_attachments_public_insert" (voir
    // sql/009_scope_booking_attachments.sql). Un autre préfixe fera
    // échouer l'upload avec une erreur RLS.
    const path = `requests/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    try {
      const { error } = await supabase.storage.from("booking-attachments").upload(path, file, { cacheControl: "3600" });
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from("booking-attachments").getPublicUrl(path);
      onChange(publicUrl);
      setShowToast(true);
    } catch {
      releasePreview();
      setPreview(null);
      setUploadError({
        what: tf("publicBooking.uploadErrorWhat", "Couldn't upload your photo"),
        why: tf("publicBooking.uploadErrorWhy", "This can happen with a slow connection or a file that's too large. Try a smaller image, or continue without one."),
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    releasePreview();
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
          border: `2px dashed ${shown ? THEME.brand : THEME.border}`,
          borderRadius: THEME.radius.lg,
          padding: shown ? "0" : "24px 16px",
          textAlign: "center",
          cursor: "pointer",
          background: shown ? "transparent" : THEME.bg,
          overflow: "hidden",
        }}
      >
        {uploading ? (
          <div style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <Spinner />
            <span style={{ fontSize: 14, color: THEME.muted }}>{tr("publicBooking.uploading")}</span>
          </div>
        ) : shown ? (
          <div style={{ position: "relative" }}>
            <img src={shown} alt="preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} />
            <button
              type="button"
              onClick={handleClear}
              aria-label="Remove photo"
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            handleFile(e.target.files[0]);
            e.target.value = ""; // permet de rechoisir le même fichier
          }}
        />
      </div>

      {uploadError && (
        <div style={{ marginTop: 10 }}>
          <ErrorNotice error={uploadError} action actionLabel={tr("publicBooking.tryAgain")} onAction={() => { setUploadError(null); fileInputRef.current?.click(); }} />
        </div>
      )}
      {showToast && <DiscreteToast message={tr("publicBooking.photoUploaded")} onDone={hideToast} />}
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────
function PublicBookingPageInner() {
  const { t: tr, lang, setLanguage, languages } = useTranslation();
  const tf = useTf();
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
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
    custom_description: "",
  });

  const [clientImage, setClientImage] = useState(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [captchaToken, setCaptchaToken] = useState(null);
  const [formError, setFormError] = useState(""); // string OU { what, why } — voir ErrorNotice
  const [fieldErrors, setFieldErrors] = useState({});

  // Évite qu'une réponse lente d'un ancien slug écrase la page courante.
  const loadRequestId = useRef(0);

  const fmt = useCallback((n) => formatCurrency(n, profile?.currency), [profile?.currency]);
  const updateFormField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [key]: null }));
  };

  // Charge le profil public + disponibilités
  async function loadData() {
    const requestId = ++loadRequestId.current;
    const isStale = () => requestId !== loadRequestId.current;

    setStatus("loading");
    try {
      const { data: prof, error } = await supabase
        .from("public_profiles")
        .select("id, name, trade, bio, hourly_rate, booking_slug, extra_fields, plan, currency, language, avatar_url")
        .eq("booking_slug", slug)
        .single();

      if (isStale()) return;

      if (error) {
        // PGRST116 = .single() n'a trouvé aucune ligne = vraie 404.
        // Tout le reste (réseau, 500, timeout) peut être réessayé.
        if (error.code === "PGRST116") { setStatus("notfound"); return; }
        console.error("public_profiles :", error);
        setStatus("error");
        return;
      }
      if (!prof) { setStatus("notfound"); return; }

      setProfile(prof);

      // Par défaut, la page affiche la langue du compte du pro — mais si ce
      // visiteur a déjà choisi une langue ici auparavant (ou via le
      // sélecteur), on respecte son choix.
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

      if (isStale()) return;

      const fetchedServices = svcs ?? [];
      setServices(fetchedServices);
      setAvailability(avail ?? []);
      setBlocked(blk ?? []);
      setStep(fetchedServices.length > 0 ? 1 : 2);
      setStatus("found");
    } catch (err) {
      if (isStale()) return;
      console.error("loadData :", err);
      setStatus("error");
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Détecte si le visiteur connecté est le pro propriétaire de cette page
  // (ex : il teste son propre lien de réservation).
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
        .maybeSingle();

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
    if (sending) return; // évite le double envoi
    if (isOwner) return; // On ne prend pas de rdv avec soi-même.
    if (isBotSubmission(honeypot)) return; // Bot détecté, rejet silencieux.
    if (!validateContactFields()) return;
    if (!selDate || !selTime) {
      setFormError({ what: tr("publicBooking.errors.pickDateWhat"), why: tr("publicBooking.errors.pickDateWhy") });
      return;
    }
    if (!captchaToken) {
      setFormError(tf("publicBooking.errors.captchaRequired", "Please complete the verification challenge."));
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

    const chosenService = services.find((s) => s.id === selSvc);
    const combinedInstructions = custom
      ? [form.custom_description, form.client_instructions].filter(Boolean).join(" — ")
      : form.client_instructions;
    const payload = {
      profile_id: profile.id,
      customer_name: form.customer_name.trim(),
      customer_email: form.customer_email.trim(),
      customer_phone: form.customer_phone || null,
      preferred_date: selDate,
      notes: `${selTime} — ${combinedInstructions || ""}`.trim(),
      service_id: selSvc || null,
      client_image_url: clientImage || null,
      client_instructions: combinedInstructions || null,
      quoted_price: custom && form.quoted_price ? parseFloat(form.quoted_price) : chosenService?.price ?? null,
      status: "pending",
    };

    try {
      const { error } = await supabase.from("booking_requests").insert(payload);
      setSending(false);

      if (error) {
        console.error("booking_requests insert :", error);
        setFormError({
          what: tf("publicBooking.sendErrorWhat", "Couldn't send your request"),
          why: tf("publicBooking.sendErrorWhy", "This is usually a temporary connection issue — your details weren't lost. Try sending again."),
        });
        return;
      }

      setDone(true);
    } catch {
      setSending(false);
      setFormError({
        what: tf("publicBooking.sendErrorWhat", "Couldn't send your request"),
        why: tf("publicBooking.sendErrorNetworkWhy", "Check your connection and try again — nothing was lost."),
      });
    }
  };

  // État : chargement, introuvable, erreur
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

  if (status === "notfound" || !profile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: THEME.bg, padding: 20 }}>
        <div style={{ textAlign: "center" }}>
          <h2>{tr("publicBooking.pageNotFound")}</h2>
        </div>
      </div>
    );
  }

  // Données dérivées du profil
  const certs = Array.isArray(profile.extra_fields?.certifications) ? profile.extra_fields.certifications : [];
  // TEMPORAIREMENT DÉSACTIVÉ — pas de moyen de passer Pro pour l'instant
  // (pas de Stripe/SIRET actif). Pour réactiver la limite :
  // const visibleCertifications = profile.plan === "pro" ? certs : certs.slice(0, 2);
  const visibleCertifications = certs;

  const verticalColor = getVerticalColor(profile.trade);
  const hasServices = services.length > 0;
  const selectedService = services.find((s) => s.id === selSvc);

  // Vue succès
  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: THEME.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 420, width: "100%", background: THEME.surface, borderRadius: THEME.radius.xl, padding: "48px 40px", boxShadow: THEME.shadow, textAlign: "center" }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>{tr("publicBooking.requestSentTitle")}</h2>
          <p style={{ fontSize: 15, color: THEME.muted, lineHeight: 1.7, marginBottom: 16 }}>
            {selDate && selTime
              ? tr("publicBooking.requestSentBodySlot", {
                  name: profile.name,
                  slot: `${selTime} ${new Date(selDate + "T00:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}`,
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

  // Vue principale en plusieurs étapes
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
              {languages.map((l) => (
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
            <span>{tr("publicBooking.ownerPreviewNotice")}</span>
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
          <Avatar name={profile.name} size={56} src={profile.avatar_url} />
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
                  currency={profile.currency}
                  onClick={() => {
                    setSelSvc(svc.id);
                    setCustom(false);
                    // La durée change les créneaux : on repart d'une sélection propre.
                    setSelDate(null);
                    setSelTime(null);
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setCustom(true);
                setSelSvc(null);
                setSelDate(null);
                setSelTime(null);
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

            {custom && (
              <div style={{ marginBottom: 20, marginTop: -8 }}>
                <textarea
                  placeholder={tr("publicBooking.customDescriptionPlaceholder")}
                  rows={3}
                  value={form.custom_description}
                  onChange={updateFormField("custom_description")}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: THEME.radius.md,
                    border: `1px solid ${THEME.border}`,
                    fontFamily: "inherit",
                    fontSize: 14,
                    resize: "vertical",
                    marginBottom: 12,
                    boxSizing: "border-box",
                  }}
                />
                <ImageUpload
                  value={clientImage}
                  onChange={setClientImage}
                  label={tr("publicBooking.attachPhotoLabel")}
                  hint={tr("publicBooking.attachPhotoHint")}
                />
              </div>
            )}

            <button
              type="button"
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
                  type="button"
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
                type="button"
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
                    {selectedService.deposit_type === "percent"
                      ? tr("publicBooking.depositOnConfirmPercent", { percent: selectedService.deposit_amount, amount: fmt(selectedService.price * selectedService.deposit_amount / 100) })
                      : tr("publicBooking.depositOnConfirmFixed", { amount: fmt(selectedService.deposit_amount) })}
                  </div>
                )}
                {selDate && selTime && (
                  <div style={{ fontSize: 13, color: THEME.muted }}>
                    {new Date(selDate + "T00:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })} {tr("publicBooking.atTime")} {selTime}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setStep(2)} style={{ fontSize: 12, color: THEME.brand, background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>
                {tr("publicBooking.changeBtn")}
              </button>
            </div>

            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{tr("publicBooking.yourDetailsTitle")}</div>
            <div style={{ fontSize: 13, color: THEME.muted, marginBottom: 16 }}>{tr("publicBooking.yourDetailsSub", { name: profile.name })}</div>

            <div style={{ background: THEME.surface, borderRadius: THEME.radius.xl, border: `1px solid ${THEME.border}`, padding: "24px", marginBottom: 16, boxShadow: THEME.shadow, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: THEME.muted, marginBottom: 6 }}>{tr("publicBooking.nameLabel")}</label>
                <input type="text" autoComplete="name" placeholder={tr("publicBooking.namePlaceholder")} value={form.customer_name} onChange={updateFormField("customer_name")} style={{ ...inputStyle, ...(fieldErrors.customer_name ? { borderColor: "#DC2626" } : {}) }} />
                {fieldErrors.customer_name && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 5 }}>{fieldErrors.customer_name}</div>}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: THEME.muted, marginBottom: 6 }}>{tr("publicBooking.emailLabel")}</label>
                <input type="email" autoComplete="email" placeholder={tr("publicBooking.emailPlaceholder")} value={form.customer_email} onChange={updateFormField("customer_email")} style={{ ...inputStyle, ...(fieldErrors.customer_email ? { borderColor: "#DC2626" } : {}) }} />
                {fieldErrors.customer_email && <div style={{ fontSize: 12, color: "#DC2626", marginTop: 5 }}>{fieldErrors.customer_email}</div>}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: THEME.muted, marginBottom: 6 }}>{tr("publicBooking.phoneLabel")}</label>
                <input type="tel" autoComplete="tel" placeholder={tr("publicBooking.phonePlaceholder")} value={form.customer_phone} onChange={updateFormField("customer_phone")} style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: THEME.muted, marginBottom: 6 }}>{tr("publicBooking.notesLabel")}</label>
                <textarea placeholder={tr("publicBooking.notesPlaceholder")} rows={3} value={form.client_instructions} onChange={updateFormField("client_instructions")} style={{ ...inputStyle, resize: "vertical" }} />
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
                title={isOwner ? tf("publicBooking.cannotBookSelf", "You can't book with yourself") : undefined}
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