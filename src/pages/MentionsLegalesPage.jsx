// src/pages/MentionsLegalesPage.jsx
//
// ⚠️ Contenu placeholder pour la phase de développement — [À COMPLÉTER] /
// [TO COMPLETE] DOIVENT être remplis dès l'immatriculation (raison
// sociale, SIRET, forme juridique, adresse) avant mise en ligne réelle.
// Même convention de placeholders que PrivacyPolicyPage / TermsOfServicePage.

import { T } from "../styles/tokens.js";
import { useTranslation } from "../i18n/index.js";
import PublicLayout from "../components/PublicLayout.jsx";

const S = {
  wrap: {
    maxWidth: 1160,
    margin: "0 auto",
    padding: "0 28px",
  },
};

const CONTENT = {
  fr: {
    title: "Mentions Légales",
    updated: "Dernière mise à jour : [À COMPLÉTER — date de publication]",
    intro: `Les présentes mentions légales s'appliquent au site et à l'application Vimen (« le Service »), accessible à l'adresse vimen.com.`,
    sections: [
      {
        h: "1. Éditeur du site",
        b: `Le Service est édité par [À COMPLÉTER — raison sociale, forme juridique (auto-entrepreneur, SASU...), SIRET, adresse du siège].

Mai Anh [Nom de famille] — Rouen, France
Email : contact.vimen@gmail.com
Numéro SIRET : [À COMPLÉTER dès immatriculation]`,
      },
      {
        h: "2. Directrice de la publication",
        b: `Mai Anh [Nom de famille]`,
      },
      {
        h: "3. Hébergement",
        b: `Hébergement du site web (frontend) : Vercel Inc. — 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis — vercel.com

Hébergement de la base de données : Supabase Inc. — 970 Toa Payoh North #07-04, Singapour (infrastructure hébergée sur AWS, région eu-west-1 — Irlande, Union Européenne) — supabase.com`,
      },
      {
        h: "4. Contact",
        b: `Pour toute question relative au site ou à tes données personnelles : contact.vimen@gmail.com`,
      },
      {
        h: "5. Propriété intellectuelle",
        b: `L'ensemble des contenus présents sur le Service (textes, logos, graphismes, structure) est protégé par le droit d'auteur. Toute reproduction, même partielle, est soumise à autorisation préalable.`,
      },
      {
        h: "6. Données personnelles",
        b: `Le traitement de tes données personnelles est décrit en détail dans notre Politique de confidentialité.`,
      },
      {
        h: "7. Cookies",
        b: `L'utilisation de cookies sur ce site est décrite dans notre bandeau de consentement et notre Politique de confidentialité.`,
      },
      {
        h: "8. Litiges",
        b: `En cas de litige, une solution amiable sera recherchée avant toute action judiciaire. À défaut d'accord amiable, les tribunaux français seront seuls compétents, sous réserve des règles impératives de protection des consommateurs.`,
      },
    ],
  },
  en: {
    title: "Legal Notice",
    updated: "Last updated: [TO COMPLETE — publication date]",
    intro: `This legal notice applies to the Vimen website and application ("the Service"), accessible at vimen.com.`,
    sections: [
      {
        h: "1. Site publisher",
        b: `The Service is published by [TO COMPLETE — company name, legal form (sole trader, limited company...), registration number, registered address].

Mai Anh [Last name] — Rouen, France
Email: contact.vimen@gmail.com
Registration number: [TO COMPLETE upon registration]`,
      },
      {
        h: "2. Publication director",
        b: `Mai Anh [Last name]`,
      },
      {
        h: "3. Hosting",
        b: `Website hosting (frontend): Vercel Inc. — 340 S Lemon Ave #4133, Walnut, CA 91789, United States — vercel.com

Database hosting: Supabase Inc. — 970 Toa Payoh North #07-04, Singapore (infrastructure hosted on AWS, eu-west-1 region — Ireland, European Union) — supabase.com`,
      },
      {
        h: "4. Contact",
        b: `For any question regarding the site or your personal data: contact.vimen@gmail.com`,
      },
      {
        h: "5. Intellectual property",
        b: `All content on the Service (text, logos, graphics, structure) is protected by copyright. Any reproduction, even partial, requires prior authorization.`,
      },
      {
        h: "6. Personal data",
        b: `The processing of your personal data is described in detail in our Privacy Policy.`,
      },
      {
        h: "7. Cookies",
        b: `The use of cookies on this site is described in our consent banner and our Privacy Policy.`,
      },
      {
        h: "8. Disputes",
        b: `In the event of a dispute, an amicable solution will be sought before any legal action. Failing an amicable agreement, French courts shall have sole jurisdiction, subject to mandatory consumer protection rules.`,
      },
    ],
  },
};

export default function MentionsLegalesPage({ onSignIn, onSignUp }) {
  const { lang } = useTranslation();
  const c = CONTENT[lang] || CONTENT.fr;

  return (
    <PublicLayout onSignIn={onSignIn} onSignUp={onSignUp}>
      <div style={{ ...S.wrap, maxWidth: 760, padding: "60px 28px 100px" }}>
        <h1
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: "clamp(28px, 4vw, 40px)",
            letterSpacing: -1,
            marginBottom: 8,
          }}
        >
          {c.title}
        </h1>
        <p style={{ fontSize: 13, color: T.hint, marginBottom: 32 }}>{c.updated}</p>

        <p style={{ fontSize: 15, color: T.muted, lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: 40 }}>
          {c.intro}
        </p>

        {c.sections.map((s) => (
          <div key={s.h} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{s.h}</h2>
            <p style={{ fontSize: 14.5, color: T.text, lineHeight: 1.75, whiteSpace: "pre-line" }}>{s.b}</p>
          </div>
        ))}
      </div>
    </PublicLayout>
  );
}