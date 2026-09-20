// components/UI.jsx

import React, { useEffect, useState } from "react";
import { T } from "../styles/tokens";
import { useTranslation } from "../i18n/index.js";
import { formatUserError } from "../../utils/errorHandler";

/* ── 1. HELPERS & FORMATTERS ─────────────────────── */

export function formatPhoneNumber(val) {
  const digits = val.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export const PASSWORD_RULES = [
  { id: "len", labelKey: "auth.rules.length", test: (p) => p.length >= 8 },
  { id: "upper", labelKey: "auth.rules.uppercase", test: (p) => /[A-Z]/.test(p) },
  { id: "num", labelKey: "auth.rules.numberOrSpecial", test: (p) => /[\d\W]/.test(p) },
];

/* ── 2. SMART FORM INPUTS & BUTTONS ─────────────── */

export function SmartInput({
  label,
  value = "",
  onChange,
  onBlur,
  error,
  type = "text",
  maxLength,
  showCharCount = false,
  placeholder,
  required = false,
  style = {},
  ...props
}) {
  const [touched, setTouched] = useState(false);

  const handleBlur = (e) => {
    setTouched(true);
    if (onBlur) onBlur(e);
  };

  const isInvalid = touched && error;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        {label && (
          <label style={{ fontSize: 13, fontWeight: 500, color: T.muted }}>
            {label} {required && <span style={{ color: T.red }}>*</span>}
          </label>
        )}
        {showCharCount && maxLength && (
          <span style={{ fontSize: 11, color: value.length >= maxLength ? T.red : T.hint }}>
            {value.length}/{maxLength}
          </span>
        )}
      </div>

      <input
        type={type}
        value={value}
        onChange={onChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: T.r.md,
          border: `1px solid ${isInvalid ? T.red : T.borderMed}`,
          fontSize: 14,
          background: T.surface,
          color: T.text,
          boxSizing: "border-box",
          fontFamily: "inherit",
          outline: "none",
          transition: "border-color 0.15s",
          ...style,
        }}
        {...props}
      />

      {isInvalid && <InlineError message={error} />}
    </div>
  );
}

export function PasswordChecklist({ password = "" }) {
  const { t } = useTranslation();
  if (!password) return null;

  return (
    <div style={{ background: T.surface2, padding: "10px 12px", borderRadius: T.r.md, marginBottom: 14, border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.hint, textTransform: "uppercase", marginBottom: 6 }}>
        {t("auth.passwordRequirements")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {PASSWORD_RULES.map((rule) => {
          const passed = rule.test(password);
          return (
            <div key={rule.id} style={{ fontSize: 12, color: passed ? T.green : T.muted, display: "flex", alignItems: "center", gap: 6 }}>
              <span>{passed ? "[x]" : "[ ]"}</span>
              <span style={{ textDecoration: passed ? "line-through" : "none" }}>{t(rule.labelKey)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SmartSubmitButton({ missingFields = [], label, loading = false, disabled = false, onClick }) {
  const { t } = useTranslation();
  const isBlocked = disabled || missingFields.length > 0;

  return (
    <div style={{ width: "100%", marginTop: 10 }}>
      <Btn type="submit" onClick={onClick} disabled={isBlocked || loading} fullWidth size="lg">
        {loading ? t("common.processing") : label}
      </Btn>

      {missingFields.length > 0 && (
        <div style={{ fontSize: 12, color: T.hint, textAlign: "center", marginTop: 8 }}>
          {t("common.missing")}: <span style={{ fontWeight: 600, color: T.muted }}>{missingFields.join(", ")}</span>
        </div>
      )}
    </div>
  );
}

/* ── 3. BASE UI ATOMS ────────────────────────────── */

export function Btn({ variant = "primary", size = "md", onClick, children, style = {}, disabled = false, fullWidth = false, type = "button" }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6, borderRadius: T.r.md,
    fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
    border: "none", transition: "all 0.15s", opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap",
    ...(fullWidth && { width: "100%", justifyContent: "center" }),
    ...(size === "sm" && { padding: "6px 12px", fontSize: 13 }),
    ...(size === "md" && { padding: "9px 18px", fontSize: 14 }),
    ...(size === "lg" && { padding: "12px 24px", fontSize: 15 }),
  };
  const variants = {
    primary: { background: T.brand, color: "#fff" },
    ghost: { background: "transparent", color: T.text, border: `1px solid ${T.borderMed}` },
    danger: { background: T.redBg, color: T.red, border: `1px solid ${T.red}30` },
    success: { background: T.greenBg, color: T.green },
    white: { background: "#fff", color: T.brand },
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ ...base, ...(variants[variant] || variants.primary), ...style }}>
      {children}
    </button>
  );
}

export function Badge({ color = "gray", children }) {
  const colors = {
    green: [T.greenBg, T.green],
    amber: [T.amberBg, T.amber],
    red: [T.redBg, T.red],
    brand: [T.brandLight, T.brand],
    blue: [T.blueBg, T.blue],
    gray: [T.surface2, T.muted],
  };
  const [bg, fg] = colors[color] || colors.gray;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 10px",
      borderRadius: T.r.full, fontSize: 12, fontWeight: 600,
      background: bg, color: fg, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

const AV_COLORS = ["#E8500A", "#1A7F4B", "#7C3AED", "#0369A1", "#B45309", "#BE185D", "#0F766E", "#C2410C"];
export function Avatar({ name = "?", size = 36, index = 0, src = null }) {
  const [failed, setFailed] = useState(false);
  const letters = (name || "?").split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const color = AV_COLORS[index % AV_COLORS.length];

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.36, fontWeight: 700, flexShrink: 0,
    }}>{letters}</div>
  );
}

export function SafeImage({ src, alt, fallbackText = "?", style = {} }) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div style={{
        width: style.width || 40,
        height: style.height || 40,
        borderRadius: style.borderRadius || T.r.md || 8,
        background: T.surface2 || "#E2E8F0",
        color: T.muted || "#64748B",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 14,
        ...style
      }}>
        {fallbackText.charAt(0).toUpperCase()}
      </div>
    );
  }

  return <img src={src} alt={alt} onError={() => setFailed(true)} style={style} />;
}

/* ── 4. LAYOUT & CONTAINERS ──────────────────────── */

export function Card({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.surface, borderRadius: T.r.lg,
      border: `1px solid ${T.border}`,
      padding: "20px 24px", marginBottom: 16,
      boxShadow: T.shadow.sm, ...style,
    }}>{children}</div>
  );
}

export function PageShell({ title, action, children }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }} className="page-enter">
      <div style={{
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        padding: "15px 28px", display: "flex", alignItems: "center",
        justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20,
        boxShadow: T.shadow.sm,
      }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>{title}</h1>
        {action}
      </div>
      <div style={{ padding: "24px 28px", flex: 1 }}>{children}</div>
    </div>
  );
}

export function MetricCard({ label, value, sub, icon, accent = false }) {
  return (
    <div style={{
      background: T.surface, borderRadius: T.r.lg, flex: 1,
      border: `1px solid ${T.border}`, padding: "18px 20px",
      boxShadow: T.shadow.sm,
      ...(accent && { borderLeft: `3px solid ${T.brand}` }),
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.text, letterSpacing: "-0.5px" }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{sub}</div>}
        </div>
        {icon && <div style={{ fontSize: 22, opacity: 0.35 }}>{icon}</div>}
      </div>
    </div>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{children}</div>
      {action}
    </div>
  );
}

export function Divider({ style = {} }) {
  return <div style={{ height: 1, background: T.border, margin: "16px 0", ...style }} />;
}

export function Collapsible({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: T.r.md, marginBottom: 16, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%", padding: "12px 16px", background: T.surface2,
          border: "none", display: "flex", justifyContent: "space-between",
          alignItems: "center", cursor: "pointer", fontSize: 13, fontWeight: 600, color: T.text
        }}
      >
        <span>{title}</span>
        <span style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          v
        </span>
      </button>

      {isOpen && (
        <div style={{ padding: 16, background: T.surface, borderTop: `1px solid ${T.border}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ── 5. FORM STRUCTURE ───────────────────────────── */

export function Field({ label, children, flex }) {
  return (
    <div style={{ marginBottom: 14, ...(flex && { flex }) }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: T.muted, marginBottom: 6, display: "block" }}>{label}</label>
      {children}
    </div>
  );
}

export function FieldRow({ children }) {
  return <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{children}</div>;
}

const inputBase = {
  width: "100%", padding: "10px 12px", borderRadius: T.r.md,
  border: `1px solid ${T.borderMed}`, fontSize: 14,
  background: T.surface, color: T.text,
  boxSizing: "border-box", fontFamily: "inherit",
};

export const Input = ({ style = {}, ...p }) => <input style={{ ...inputBase, ...style }} {...p} />;
export const Select = ({ style = {}, children, ...p }) => <select style={{ ...inputBase, ...style }} {...p}>{children}</select>;
export const Textarea = ({ style = {}, ...p }) => <textarea style={{ ...inputBase, height: 80, resize: "vertical", ...style }} {...p} />;

export function FormActions({ onCancel, submitLabel, cancelLabel, savingLabel, loading = false }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
      <Btn variant="ghost" onClick={onCancel}>{cancelLabel ?? t("common.cancel")}</Btn>
      <Btn type="submit" disabled={loading}>{loading ? (savingLabel ?? t("common.saving")) : (submitLabel ?? t("common.save"))}</Btn>
    </div>
  );
}

export function SettingRow({ label, sub, on, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${T.border}` }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

export function Toggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)} style={{
      width: 40, height: 22, borderRadius: T.r.full,
      background: on ? T.brand : T.surface3,
      position: "relative", cursor: "pointer",
      transition: "background 0.2s", flexShrink: 0,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        background: "#fff", position: "absolute",
        top: 2, left: on ? 20 : 2, transition: "left 0.2s",
        boxShadow: T.shadow.sm,
      }} />
    </div>
  );
}

/* ── 6. TABLES & DATA DISPLAY ───────────────────── */

export function Table({ headers, children }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{headers.map(h => (
            <th key={h} style={{
              fontSize: 11, fontWeight: 700, color: T.muted,
              textTransform: "uppercase", letterSpacing: "0.6px",
              padding: "10px 16px", textAlign: "left",
              borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap",
            }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function TD({ children, style = {}, onClick }) {
  return (
    <td onClick={onClick} style={{
      fontSize: 14, color: T.text,
      padding: "13px 16px", borderBottom: `1px solid ${T.border}`,
      verticalAlign: "middle", ...style,
    }}>{children}</td>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, background: T.surface2, padding: 4, borderRadius: T.r.md, width: "fit-content", marginBottom: 16 }}>
      {tabs.map(([id, label, count]) => (
        <button key={id} onClick={() => onChange(id)} style={{
          padding: "7px 16px", borderRadius: T.r.sm, border: "none",
          fontSize: 14, fontWeight: active === id ? 700 : 400, cursor: "pointer",
          background: active === id ? T.surface : "transparent",
          color: active === id ? T.text : T.muted,
          boxShadow: active === id ? T.shadow.sm : "none",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {label}
          {count !== undefined && (
            <span style={{
              background: active === id ? T.brand : T.surface3,
              color: active === id ? "#fff" : T.muted,
              borderRadius: T.r.full, fontSize: 11,
              fontWeight: 700, padding: "1px 7px",
            }}>{count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function InfoRow({ icon, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 13, padding: "8px 0", borderBottom: `1px solid ${T.border}`, color: T.muted }}>
      <span>{icon}</span><span style={{ flex: 1 }}>{value}</span>
    </div>
  );
}

/* ── 7. MODALS & OVERLAYS ───────────────────────── */

export function Modal({ isOpen = true, title, children, onClose, width = 420 }) {
  if (isOpen === false) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#ffffff",
          borderRadius: 14,
          padding: "24px 28px",
          width: "100%",
          maxWidth: width,
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        {/* Title & Close Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text || "#131211" }}>
            {title || (isOpen ? "Sign In to Vimen" : "")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 20,
              cursor: "pointer",
              color: T.muted || "#6B7280",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, confirmLabel, onConfirm, onClose, danger = true }) {
  const { t } = useTranslation();
  return (
    <Modal title={title} onClose={onClose} width={360}>
      {message && <p style={{ color: T.muted, fontSize: 14, marginBottom: 20 }}>{message}</p>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>{t("common.cancel")}</Btn>
        <Btn variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel || t("common.delete")}</Btn>
      </div>
    </Modal>
  );
}

export function ErrorModal({ title, error, onClose, onRetry }) {
  const { t } = useTranslation();
  if (!error) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <div style={{
        background: T.surface || "#FFFFFF",
        borderRadius: T.r.xl || 16,
        padding: "24px 28px",
        maxWidth: 400,
        width: "100%",
        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
        textAlign: "center"
      }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px 0" }}>{title || t("errors.actionRequired")}</h3>
        <p style={{ fontSize: 14, color: T.muted || "#64748B", lineHeight: 1.5, marginBottom: 20 }}>
          {typeof error === "string" ? error : error.message || t("errors.general")}
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 18px", borderRadius: 8, border: `1px solid ${T.border || '#CBD5E1'}`,
              background: "transparent", fontWeight: 600, cursor: "pointer"
            }}
          >
            {t("common.dismiss")}
          </button>
          
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: "10px 18px", borderRadius: 8, border: "none",
                background: T.brand || "#007BFF", color: "#FFF", fontWeight: 600, cursor: "pointer"
              }}
            >
              {t("common.retry")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 8. LOADING & SKELETON STATES ────────────────── */

export function Spinner({ size = 20, color = T.brand }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid ${T.border}`, borderTopColor: color,
      animation: "spin 0.65s linear infinite",
      display: "inline-block"
    }} />
  );
}

export function Skeleton({ width = "100%", height = 16, borderRadius = T.r.sm, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius,
      background: `linear-gradient(90deg, ${T.surface2} 25%, ${T.border} 50%, ${T.surface2} 75%)`,
      backgroundSize: "200% 100%",
      animation: "skeletonPulse 1.5s infinite ease-in-out",
      ...style
    }} />
  );
}

export function CardSkeleton() {
  return (
    <div style={{
      background: T.surface, borderRadius: T.r.lg, border: `1px solid ${T.border}`,
      padding: 20, marginBottom: 16
    }}>
      <Skeleton width="40%" height={20} style={{ marginBottom: 12 }} />
      <Skeleton width="80%" height={14} style={{ marginBottom: 8 }} />
      <Skeleton width="60%" height={14} />
    </div>
  );
}

export function ProgressBar({ progress = 0, label }) {
  return (
    <div style={{ width: "100%", margin: "12px 0" }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, color: T.muted }}>
          <span>{label}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      )}
      <div style={{ width: "100%", height: 8, background: T.surface2, borderRadius: T.r.full, overflow: "hidden" }}>
        <div style={{
          width: `${Math.min(100, Math.max(0, progress))}%`,
          height: "100%", background: T.brand,
          transition: "width 0.3s ease-in-out"
        }} />
      </div>
    </div>
  );
}

/* ── 9. NOTIFICATIONS & TOASTS ───────────────────── */

export function ToastStack({ toasts = [], onDismiss }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 1000,
      display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none"
    }}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onDismiss) onDismiss(toast.id);
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const isError = toast.type === "error";

  return (
    <div style={{
      pointerEvents: "auto", padding: "12px 18px", borderRadius: T.r.md || 8,
      background: isError ? T.red || "#DC2626" : T.text || "#1E293B",
      color: "#FFFFFF", fontSize: 14, fontWeight: 500,
      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
      display: "flex", alignItems: "center", gap: 10,
      animation: "fadeIn 0.2s ease-out",
    }}>
      <span>{isError ? "[!]" : "[v]"}</span>
      <span>{toast.message}</span>
    </div>
  );
}

export function SuccessToast({ message, onDismiss, duration = 3000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onDismiss) onDismiss();
    }, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  if (!message) return null;

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 1000,
      padding: "12px 18px", borderRadius: T.r.md || 8,
      background: T.green || "#16A34A", color: "#FFFFFF",
      fontSize: 14, fontWeight: 600, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span>{message}</span>
    </div>
  );
}

/* ── 10. EMPTY, SUCCESS & ERROR STATES ──────────── */

export function Empty({ titleKey = "common.emptyTitle", messageKey = "common.emptyMessage", action }) {
  const { t } = useTranslation();
  return (
    <div style={{ textAlign: "center", padding: "52px 24px", color: T.muted }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>{t(titleKey)}</div>
      <div style={{ fontSize: 14, marginBottom: action ? 20 : 0, maxWidth: 360, margin: "0 auto 20px" }}>{t(messageKey)}</div>
      {action}
    </div>
  );
}

export function SuccessState({
  titleKey = "success.defaultTitle",
  messageKey = "success.defaultMessage",
  details,
  actionKey = "common.continue",
  onAction,
}) {
  const { t } = useTranslation();

  return (
    <div style={{ textAlign: "center", padding: "48px 24px", maxWidth: 440, margin: "0 auto" }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: T.greenBg || "#DCFCE7", color: T.green || "#15803D",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 20, marginBottom: 20,
      }}>
        OK
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 10px 0", color: T.text }}>
        {t(titleKey)}
      </h2>

      <p style={{ fontSize: 14, color: T.muted || "#64748B", marginBottom: 20, lineHeight: 1.6 }}>
        {t(messageKey)}
      </p>

      {details && (
        <div style={{
          background: T.surface2 || "#F8FAFC", borderRadius: T.r.md || 8,
          padding: 16, marginBottom: 24, border: `1px solid ${T.border || "#E2E8F0"}`,
          textAlign: "left",
        }}>
          {details}
        </div>
      )}

      {onAction && (
        <button
          onClick={onAction}
          style={{
            background: T.brand || "#007BFF", color: "#FFFFFF", border: "none",
            padding: "12px 24px", borderRadius: T.r.md || 8, fontWeight: 600,
            fontSize: 14, cursor: "pointer", width: "100%",
          }}
        >
          {t(actionKey)}
        </button>
      )}
    </div>
  );
}

export function InlineError({ message }) {
  if (!message) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, fontSize: 12,
      fontWeight: 600, color: T.red || "#DC2626", marginTop: 4,
      animation: "fadeIn 0.15s ease-in-out",
    }}>
      <span>{message}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const { t } = useTranslation();
  if (!error) return null;

  const { title, reason, action } = formatUserError(error);

  return (
    <div style={{
      textAlign: "left", padding: "20px 24px",
      background: "#FEF2F2", border: "1px solid #FCA5A5",
      borderRadius: "12px", maxWidth: 440, margin: "16px auto"
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#991B1B", margin: "0 0 6px 0" }}>
        {title}
      </h3>

      <p style={{ fontSize: 13, color: "#7F1D1D", margin: "0 0 10px 0", lineHeight: 1.5 }}>
        {reason}
      </p>

      <div style={{ fontSize: 13, fontWeight: 600, color: "#991B1B", marginBottom: onRetry ? 14 : 0 }}>
        {action}
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: "#991B1B", color: "#FFFFFF", border: "none",
            padding: "8px 16px", borderRadius: "6px", fontSize: 13,
            fontWeight: 600, cursor: "pointer"
          }}
        >
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}

export function copyToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

export function ErrorBox({ what, why, nextAction, onRetry }) {
  return (
    <div style={{
      padding: "16px 20px",
      borderRadius: 10,
      background: "#FEF2F2",
      border: "1px solid #FCA5A5",
      color: "#991B1B",
      marginBottom: 16
    }}>
      {what && <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{what}</div>}
      {why && <div style={{ fontSize: 13, color: "#B91C1C", marginBottom: 6 }}>{why}</div>}
      {nextAction && <div style={{ fontSize: 13, color: "#7F1D1D" }}>{nextAction}</div>}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 12,
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #F87171",
            background: "#FFF",
            color: "#991B1B",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer"
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}