import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useTranslation } from "../i18n/index.js";

/**
 * À insérer dans ta page Settings, section "Confidentialité" ou
 * "Zone dangereuse". Couvre deux obligations RGPD :
 * - Export de données (droit d'accès / portabilité)
 * - Suppression de compte (droit à l'oubli)
 *
 * Usage : <PrivacyControls />  (aucune prop requise, utilise useUser()
 * de Clerk pour récupérer le clerk_id de la session en cours — donc un
 * utilisateur ne peut techniquement demander que SA propre suppression)
 */
export default function PrivacyControls() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  // Mot que l'utilisateur doit taper pour confirmer — traduit lui aussi,
  // sinon quelqu'un en anglais verrait "Type DELETE" mais devrait en
  // réalité taper "SUPPRIMER" pour que ça marche. On compare toujours
  // à cette même valeur traduite, jamais à un mot codé en dur.
  const confirmWord = t("settings.privacyControls.confirmWord") || "DELETE";

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Export échoué");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vimen-mes-donnees.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[PrivacyControls] export error:", err);
      setError(t("settings.privacyControls.exportError"));
    }
    setExporting(false);
  }

  async function handleDelete() {
    if (confirmText !== confirmWord) return;
    setDeleting(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Suppression échouée");
      // Le compte Clerk vient d'être supprimé côté serveur — la session
      // locale est maintenant invalide, on redirige.
      window.location.href = "/";
    } catch (err) {
      console.error("[PrivacyControls] delete error:", err);
      setError(t("settings.privacyControls.deleteError"));
      setDeleting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ padding: 20, border: "1px solid #E5E5E0", borderRadius: 12 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700 }}>
          {t("settings.privacyControls.exportTitle")}
        </h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6B6B66" }}>
          {t("settings.privacyControls.exportDesc")}
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #E5E5E0", background: "#fff", fontWeight: 600, fontSize: 14, cursor: exporting ? "not-allowed" : "pointer" }}
        >
          {exporting ? t("settings.privacyControls.exporting") : t("settings.privacyControls.exportBtn")}
        </button>
      </div>

      <div style={{ padding: 20, border: "1px solid #FECACA", borderRadius: 12, background: "#FEF2F2" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#991B1B" }}>
          {t("settings.privacyControls.deleteTitle")}
        </h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#7F1D1D" }}>
          {t("settings.privacyControls.deleteDesc")}
        </p>

        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #DC2626", background: "#fff", color: "#DC2626", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            {t("settings.privacyControls.deleteBtn")}
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#7F1D1D" }}>
              {t("settings.privacyControls.confirmLabel", { word: confirmWord })}
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #FECACA", fontSize: 14 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setShowConfirm(false); setConfirmText(""); }}
                style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #E5E5E0", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmText !== confirmWord || deleting}
                style={{
                  padding: "10px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: confirmText === confirmWord ? "#DC2626" : "#F3A8A8",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: confirmText === confirmWord && !deleting ? "pointer" : "not-allowed",
                }}
              >
                {deleting ? t("settings.privacyControls.deleting") : t("settings.privacyControls.deleteConfirmBtn")}
              </button>
            </div>
          </div>
        )}

        {error && <p style={{ fontSize: 13, color: "#DC2626", marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
}