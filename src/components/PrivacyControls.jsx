import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";

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
  const { getToken } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

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
      setError("Impossible d'exporter tes données pour le moment. Réessaie ou contacte le support.");
    }
    setExporting(false);
  }

  async function handleDelete() {
    if (confirmText !== "SUPPRIMER") return;
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
      setError("Impossible de supprimer ton compte pour le moment. Contacte contact.vimen@gmail.com pour qu'on le fasse manuellement.");
      setDeleting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ padding: 20, border: "1px solid #E5E5E0", borderRadius: 12 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700 }}>Exporter mes données</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6B6B66" }}>
          Télécharge une copie complète de toutes tes données personnelles stockées sur Vimen (profil, clients, factures, avis, etc.) au format JSON.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #E5E5E0", background: "#fff", fontWeight: 600, fontSize: 14, cursor: exporting ? "not-allowed" : "pointer" }}
        >
          {exporting ? "Export en cours..." : "Télécharger mes données"}
        </button>
      </div>

      <div style={{ padding: 20, border: "1px solid #FECACA", borderRadius: 12, background: "#FEF2F2" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#991B1B" }}>Supprimer mon compte</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#7F1D1D" }}>
          Action définitive et irréversible. Supprime ton profil, tous tes clients, factures, avis, réservations, et ton compte de connexion. Aucune récupération possible après.
        </p>

        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #DC2626", background: "#fff", color: "#DC2626", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            Supprimer mon compte
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#7F1D1D" }}>
              Tape SUPPRIMER pour confirmer :
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
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmText !== "SUPPRIMER" || deleting}
                style={{
                  padding: "10px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: confirmText === "SUPPRIMER" ? "#DC2626" : "#F3A8A8",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: confirmText === "SUPPRIMER" && !deleting ? "pointer" : "not-allowed",
                }}
              >
                {deleting ? "Suppression..." : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        )}

        {error && <p style={{ fontSize: 13, color: "#DC2626", marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
}