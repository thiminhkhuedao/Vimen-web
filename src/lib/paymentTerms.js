// src/lib/paymentTerms.js
//
// Le délai de paiement est stocké en base comme une clé stable et
// indépendante de la langue ("immediate", "7", "14", "30"), jamais comme
// du texte déjà traduit — sinon un compte enregistré une fois en anglais
// (ex: "14 days") reste bloqué dans cette langue pour toujours, même en
// changeant la langue de l'app ensuite.

export const PAYMENT_TERMS_KEYS = ["immediate", "7", "14", "30"];

export function getPaymentTermsLabel(value, t) {
  const key = String(value ?? "14");
  const labelKeys = {
    immediate: "settings.termsImmediate",
    "7": "settings.terms7",
    "14": "settings.terms14",
    "30": "settings.terms30",
  };
  if (labelKeys[key]) return t(labelKeys[key]);
  // Valeur historique déjà enregistrée en toutes lettres (avant ce
  // correctif) — on l'affiche telle quelle plutôt que de perdre l'info.
  return value || t("settings.terms14");
}