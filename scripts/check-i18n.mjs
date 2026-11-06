// scripts/check-i18n.mjs
//
// Cherche dans tout le code les clés de traduction utilisées (t("section.cle"), tr(...), tf(...))
// qui N'EXISTENT PAS dans src/i18n/en.js ou fr.js : ce sont celles qui s'affichent « en brut » à l'écran
// (ex. « booking.declineModalTitle »). Aucune dépendance à installer.
//
// Usage, depuis la racine du projet :   node scripts/check-i18n.mjs
//   (autre dossier source :             node scripts/check-i18n.mjs chemin/vers/src)
// Code de sortie 1 s'il manque au moins une clé : utilisable dans une vérification avant mise en ligne.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.argv[2] || "src";
const EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "node_modules" ? [] : walk(p);
    return EXT.has(extname(p)) ? [p] : [];
  });

const load = async (lang) => (await import(pathToFileURL(join(root, "i18n", `${lang}.js`)).href)).default;
const dicts = { en: await load("en"), fr: await load("fr") };
const lookup = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

// t("a.b"), tr("a.b"), tf("a.b", ...) — uniquement les clés écrites en toutes lettres
const CALL = /\b(?:t|tr|tf)\(\s*["'`]([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)["'`]/g;

const used = new Map(); // clé -> fichiers
for (const file of walk(root)) {
  if (file.includes(`${sep}i18n${sep}`)) continue; // on ne scanne pas les fichiers de langue eux-mêmes
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(CALL)) {
    if (!used.has(m[1])) used.set(m[1], new Set());
    used.get(m[1]).add(file);
  }
}

let problems = 0;
for (const lang of ["en", "fr"]) {
  const missing = [...used.keys()].filter((k) => lookup(dicts[lang], k) === undefined).sort();
  console.log(`\n${lang.toUpperCase()} — ${missing.length} clé(s) manquante(s) sur ${used.size} utilisées`);
  for (const k of missing) console.log(`  ${k}   ←  ${[...used.get(k)].map((f) => f.replace(root + sep, "")).join(", ")}`);
  problems += missing.length;
}
const onlyEn = [...used.keys()].filter((k) => lookup(dicts.en, k) !== undefined && lookup(dicts.fr, k) === undefined);
const onlyFr = [...used.keys()].filter((k) => lookup(dicts.fr, k) !== undefined && lookup(dicts.en, k) === undefined);
if (onlyEn.length || onlyFr.length) console.log(`\nAttention : ${onlyEn.length} clé(s) seulement en anglais, ${onlyFr.length} seulement en français.`);
console.log(problems ? "\nDes clés sont à ajouter (voir ci-dessus)." : "\nToutes les clés utilisées existent dans les deux langues.");
process.exit(problems ? 1 : 0);
