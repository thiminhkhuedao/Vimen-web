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
 *
 * SÉCURITÉ VISUELLE — bug corrigé : <UserProfile> a sa propre mise en
 * page interne complète (sa propre nav "Account/Security/Profile", son
 * propre header). Un `maxWidth` externe entrait en conflit avec sa
 * grille interne, causant un header plus large que le panneau en
 * dessous. On laisse maintenant Clerk gérer sa largeur nativement
 * (100% du parent), avec un scroll horizontal de secours sur mobile
 * si jamais son contenu interne reste plus large que l'écran.
 */
export default function SecuritySettings() {
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
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