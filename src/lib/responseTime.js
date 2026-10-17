// src/lib/responseTime.js
//
// Délai de réponse affiché sur la page publique. On stocke seulement la clé
// ("1h", "4h", "24h", "48h") dans profiles.response_time ; les libellés sont ici.

export const RESPONSE_TIME_OPTIONS = ["1h", "4h", "24h", "48h"];

const LABELS = {
  "1h":  { fr: "Répond en général sous 1 h",  en: "Usually replies within 1 hour" },
  "4h":  { fr: "Répond en général sous 4 h",  en: "Usually replies within 4 hours" },
  "24h": { fr: "Répond en général sous 24 h", en: "Usually replies within 24 hours" },
  "48h": { fr: "Répond en général sous 48 h", en: "Usually replies within 48 hours" },
};

// Renvoie "" si la clé est vide ou inconnue (rien n'est alors affiché).
export function getResponseTimeLabel(key, lang = "fr") {
  const entry = LABELS[key];
  if (!entry) return "";
  return lang === "fr" ? entry.fr : entry.en;
}