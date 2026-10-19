// src/styles/publicTokens.js
//
// Même clés que tokens.js, mais en version sombre pour les pages publiques :
// le fond de la page recouvre tout (plus de blanc), les cartes sont en verre.
// Les pages publiques importent { T } d'ici au lieu de tokens.js.

import { T as base } from "./tokens.js";

export const PAGE_BG = "#1B0E09"; // brun très foncé : même couleur que le bas de l'image du hero

export const T = {
  ...base,
  bg: PAGE_BG,
  surface: "rgba(255,255,255,0.06)",
  surface2: "rgba(255,255,255,0.07)",
  surface3: "rgba(255,255,255,0.12)",
  text: "#FBF1E6",
  muted: "rgba(251,241,230,0.76)",
  hint: "rgba(251,241,230,0.55)",
  border: "rgba(255,255,255,0.14)",
  borderMed: "rgba(255,255,255,0.26)",
  brandLight: "rgba(232,80,10,0.2)",
  green: "#5FD39A",
  greenBg: "rgba(95,211,154,0.15)",
  red: "#FF8A80",
  redBg: "rgba(255,138,128,0.15)",
};