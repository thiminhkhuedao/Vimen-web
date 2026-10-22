// src/lib/legal.js


export const LEGAL = {
  publisherName: "Thi Mai Anh DAO", 
  legalFormFr: "personne physique, éditeur non professionnel",
  legalFormEn: "individual, non-professional publisher",
  courtCity: "Rouen",   
  email: "contact@vimen.app",
  privacyEmail: "contact@vimen.app", 
  updatedFr: "22 octobre 2026",            
  updatedEn: "October 22, 2026",
  inactivityMonths: 12, 
};

const ph = (lang, label) => (lang === "en" ? `[TO COMPLETE — ${label}]` : `[À COMPLÉTER — ${label}]`);
const pick = (v, lang, label) => (v && String(v).trim() ? String(v).trim() : ph(lang, label));

function build(lang) {
  const fr = lang === "fr";
  const publisher = pick(LEGAL.publisherName, lang, fr ? "nom ou raison sociale" : "name or company name");
  const legalForm = fr ? LEGAL.legalFormFr : LEGAL.legalFormEn;
  const address = pick(LEGAL.address, lang, fr ? "adresse postale" : "postal address");
  const email = pick(LEGAL.email, lang, fr ? "email de contact" : "contact email");
  const privacyEmail = pick(LEGAL.privacyEmail, lang, fr ? "email confidentialité" : "privacy email");

  return {
    publisher, legalForm, address, email, privacyEmail,
    editorLine: `${publisher}, ${legalForm}`,
    editorFull: `${publisher}, ${legalForm}, ${address}`,
    court: pick(LEGAL.courtCity, lang, fr ? "ville du siège social" : "city of registered office"),
    updated: fr ? LEGAL.updatedFr : LEGAL.updatedEn,
    inactivity: fr ? `supérieure à ${LEGAL.inactivityMonths} mois` : `more than ${LEGAL.inactivityMonths} months`,
    transfers: fr
      ? "les clauses contractuelles types de la Commission européenne ou, lorsque le prestataire y adhère, le cadre de protection des données UE–États-Unis (Data Privacy Framework)"
      : "the European Commission's Standard Contractual Clauses or, where the provider participates, the EU–US Data Privacy Framework",
    referral: fr
      ? "Le programme de parrainage est proposé gratuitement. Les conditions applicables (éventuelle récompense, délais, éligibilité) sont présentées dans l'application. Vimen peut modifier le programme ou y mettre fin à tout moment, sans que cela ouvre droit à une indemnité, et peut exclure toute participation frauduleuse."
      : "The referral program is offered free of charge. The applicable terms (any reward, timeframe, eligibility) are shown in the app. Vimen may modify or end the program at any time, without entitling anyone to compensation, and may exclude any fraudulent participation.",
  };
}

export const L = { fr: build("fr"), en: build("en") };