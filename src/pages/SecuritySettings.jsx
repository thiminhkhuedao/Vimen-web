import { UserProfile } from "@clerk/clerk-react";

/**
 * À insérer dans ta page Settings, section "Sécurité" (à côté de
 * PrivacyControls pour l'export/suppression). Couvre :
 * - Activation du 2FA (TOTP) — géré nativement par Clerk
 * - Liste des sessions actives par device, avec bouton "Révoquer" sur
 *   chacune, ou "Sign out of all other sessions" — géré nativement par
 *   Clerk, aucun code custom nécessaire pour la révocation
 *
 * Le thème `appearance` ci-dessous adapte les couleurs Clerk à ta charte
 * (orange Vimen) plutôt que le violet par défaut. Ajuste les valeurs
 * hexadécimales si ta couleur exacte diffère.
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
            navbar: { display: "none" }, // cache la navbar par défaut de Clerk, on ne montre que le contenu
            headerTitle: { fontSize: 16, fontWeight: 700 },
            formButtonPrimary: { backgroundColor: "#E9622F", fontSize: 14 },
            badge: { backgroundColor: "#FEF2E8", color: "#E9622F" },
          },
          variables: {
            colorPrimary: "#E9622F",
          },
        }}
      />
    </div>
  );
}