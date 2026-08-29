import { UserProfile } from "@clerk/clerk-react";

/**
 * À insérer dans ta page Settings, section "Sécurité" (à côté de
 * PrivacyControls pour l'export/suppression). Couvre :
 * - Activation du 2FA (TOTP) — géré nativement par Clerk
 * - Sessions actives par device, avec "Révoquer" ou "Sign out of all
 *   other sessions" — géré nativement par Clerk
 *
 * Par défaut, Clerk affiche "Account" avant "Security". Comme tu gères
 * déjà le profil (nom, email, etc.) toi-même ailleurs dans Settings, on
 * réordonne pour que Security s'ouvre en premier — plutôt que de cacher
 * la navbar, ce qui bloquerait l'accès à Security (elle ne serait jamais
 * atteignable sans nav).
 */
export default function SecuritySettings() {
  return (
    <div style={{ maxWidth: 640 }}>
      <UserProfile
        routing="hash"
        appearance={{
          elements: {
            rootBox: { width: "100%" },
            card: { boxShadow: "none", border: "1px solid #E5E5E0", borderRadius: 12 },
            headerTitle: { fontSize: 16, fontWeight: 700 },
            formButtonPrimary: { backgroundColor: "#E9622F", fontSize: 14 },
            badge: { backgroundColor: "#FEF2E8", color: "#E9622F" },
          },
          variables: {
            colorPrimary: "#E9622F",
          },
        }}
      >
        <UserProfile.Page label="security" />
        <UserProfile.Page label="account" />
      </UserProfile>
    </div>
  );
}