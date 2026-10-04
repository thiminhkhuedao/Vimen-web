// src/components/Seo.jsx
// Met à jour le titre, la description, le canonical et les balises de partage
// pour chaque page publique. Sans librairie : on modifie les balises déjà
// présentes dans index.html (pas de doublons).
import { useEffect } from "react";

const SITE = "https://vimen.app";

function setMeta(selector, attrs, content) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export default function Seo({ title, description, path = "/", noindex = false }) {
  useEffect(() => {
    const url = SITE + path;
    document.title = title;
    setMeta('meta[name="description"]', { name: "description" }, description);
    setMeta('meta[property="og:title"]', { property: "og:title" }, title);
    setMeta('meta[property="og:description"]', { property: "og:description" }, description);
    setMeta('meta[property="og:url"]', { property: "og:url" }, url);
    setMeta('meta[name="twitter:title"]', { name: "twitter:title" }, title);
    setMeta('meta[name="twitter:description"]', { name: "twitter:description" }, description);
    setCanonical(url);
    // Pages pas encore finalisées (ex. placeholders légaux) : demandent à Google de ne pas les indexer.
    setMeta('meta[name="robots"]', { name: "robots" }, noindex ? "noindex, follow" : "index, follow");
  }, [title, description, path, noindex]);

  return null;
}