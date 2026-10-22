// src/pages/PrivacyPolicyPage.jsx
//
// Contenu basé sur privacy-policy-fr.md / privacy-policy-en.md — les
// placeholders [À COMPLÉTER] / [TO COMPLETE] DOIVENT être remplis avant
// mise en ligne (nom de l'éditeur, adresse, email RGPD, etc. — voir src/lib/legal.js)

import { T } from "../styles/publicTokens.js";
import { useTranslation } from "../i18n/index.js";
import PublicLayout from "../components/PublicLayout.jsx";
import PageHero, { GlowBand } from "../components/PageHero.jsx";
import { L } from "../lib/legal.js";

const S = {
  wrap: {
    maxWidth: 1160,
    margin: "0 auto",
    padding: "0 28px",
  },
};

const CONTENT = {
  fr: {
    title: "Politique de confidentialité",
    updated: `Dernière mise à jour : ${L.fr.updated}`,
    intro: `Cette politique s'applique à l'application web Vimen et à l'application mobile Vimen (iOS/Android), ci-après « le Service ». Elle décrit quelles données nous collectons, pourquoi, avec qui elles sont partagées, et quels droits tu as sur elles.

Le responsable de traitement est ${L.fr.editorFull}. Pour toute question, contacte-nous à ${L.fr.privacyEmail}.`,
    sections: [
      {
        h: "1. À qui s'applique cette politique",
        b: `Vimen s'adresse à deux catégories de personnes : les professionnels (« Pro ») qui créent un compte pour gérer clients, rendez-vous, devis et factures ; et les clients des Pros (« Clients finaux ») qui interagissent via une page publique (réservation, devis, avis), souvent sans jamais créer de compte.`,
      },
      {
        h: "2. Données que nous collectons",
        b: `Compte (via Clerk) : nom, email, mot de passe (jamais stocké par nous, géré par Clerk), infos Google si connexion Google.

Profil professionnel : nom, métier, bio, tarif horaire, email et téléphone pro, photo, coordonnées bancaires (IBAN, BIC, titulaire, banque) pour les versements, identifiants Stripe, préférences de notification, devise, lien de réservation, jeton de notification push.

Données de tes clients : nom, email, téléphone, adresse, notes que tu saisis toi-même — tu es responsable de traitement pour ces données.

Réservations et devis publics : nom, email, téléphone, date/créneau, signature électronique du Client final.

Avis publics, données marketplace, formulaire de contact et parrainage.

Données techniques : adresse IP (limitation de requêtes), navigation standard.`,
      },
      {
        h: "3. Pourquoi nous traitons ces données",
        b: `Exécution du contrat (gérer ton compte, traiter les paiements, permettre les réservations), intérêt légitime (sécurité, prévention des abus, réponse à tes messages), consentement (notifications push), obligation légale (comptabilité).`,
      },
      {
        h: "4. Avec qui nous partageons ces données",
        b: `Clerk (authentification), Supabase (hébergement de la base de données), Vercel (hébergement du site), Stripe (paiements et versements), Resend (envoi d'emails), Cloudflare (protection anti-robots des formulaires), Google (connexion, si utilisée). Nous ne vendons aucune donnée.

Certains de ces prestataires sont basés aux États-Unis ; ces transferts sont encadrés par ${L.fr.transfers}.`,
      },
      {
        h: "5. Durée de conservation",
        b: `Données de compte : conservées tant que le compte est actif. Données de facturation : conservées 10 ans conformément aux obligations comptables et fiscales françaises. Le reste : le temps nécessaire à la finalité concernée.`,
      },
      {
        h: "6. Sécurité",
        b: `Chiffrement en transit (HTTPS), contrôle d'accès strict en base (chaque Pro n'accède qu'à ses propres données), limitation du nombre de requêtes, mots de passe jamais stockés par nos soins.`,
      },
      {
        h: "7. Tes droits",
        b: `Accès, rectification, effacement, portabilité, opposition, retrait du consentement. Contacte ${L.fr.privacyEmail} pour les exercer. Tu peux aussi saisir la CNIL (www.cnil.fr).`,
      },
      {
        h: "8. Cookies",
        b: `Le Service utilise uniquement des cookies et stockages locaux strictement nécessaires à son fonctionnement (session d'authentification, protection anti-robots, mémorisation de la langue choisie). Aucun cookie publicitaire n'est utilisé.`,
      },
      {
        h: "9. Application mobile",
        b: `L'app demande l'autorisation d'envoyer des notifications push. Elle peut aussi demander l'accès à l'appareil photo et à ta photothèque, uniquement si tu choisis d'ajouter une photo (par exemple ta photo de profil ou l'image d'un service). Tu peux refuser ou modifier ces autorisations à tout moment dans les réglages de ton appareil ; les fonctions concernées restent facultatives.`,
      },
      {
        h: "10. Mineurs",
        b: `Le Service n'est pas destiné aux personnes de moins de 16 ans.`,
      },
      {
        h: "11. Modifications",
        b: `Nous pouvons mettre à jour cette politique. En cas de changement substantiel, nous t'en informerons avant son entrée en vigueur.`,
      },
      {
        h: "12. Contact",
        b: `${L.fr.editorFull} — ${L.fr.privacyEmail}`,
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: `Last updated: ${L.en.updated}`,
    intro: `This policy applies to the Vimen web app and the Vimen mobile app (iOS/Android), referred to as "the Service." It describes what data we collect, why, who we share it with, and what rights you have over it.

The data controller is ${L.en.editorFull}. For any question, contact us at ${L.en.privacyEmail}.`,
    sections: [
      {
        h: "1. Who this policy applies to",
        b: `Vimen serves two categories of people: Professionals ("Pro") who create an account to manage clients, appointments, quotes and invoices; and the Pro's End Clients, who interact via a public page (booking, quote, reviews), often without ever creating an account.`,
      },
      {
        h: "2. Data we collect",
        b: `Account (via Clerk): name, email, password (never stored by us, managed by Clerk), Google info if signing in with Google.

Professional profile: name, trade, bio, hourly rate, professional email and phone, photo, bank details (IBAN, BIC, account holder, bank name) for payouts, Stripe identifiers, notification preferences, currency, booking link, push notification token.

Your clients' data: name, email, phone, address, notes you enter yourself — you are the data controller for this data.

Public bookings and quotes: name, email, phone, date/time, End Client's electronic signature.

Public reviews, marketplace data, contact form and referrals.

Technical data: IP address (rate limiting), standard browsing data.`,
      },
      {
        h: "3. Why we process this data",
        b: `Contract performance (managing your account, processing payments, enabling bookings), legitimate interest (security, abuse prevention, replying to your messages), consent (push notifications), legal obligation (accounting).`,
      },
      {
        h: "4. Who we share this data with",
        b: `Clerk (authentication), Supabase (database hosting), Vercel (website hosting), Stripe (payments and payouts), Resend (email delivery), Cloudflare (bot protection on forms), Google (sign-in, if used). We do not sell any data.

Some of these providers are based in the United States; these transfers are governed by ${L.en.transfers}.`,
      },
      {
        h: "5. Data retention",
        b: `Account data: kept as long as the account is active. Billing data: kept for 10 years in accordance with French accounting and tax obligations. Everything else: for as long as necessary for its purpose.`,
      },
      {
        h: "6. Security",
        b: `Encryption in transit (HTTPS), strict database access control (each Pro only accesses their own data), rate limiting, passwords never stored by us.`,
      },
      {
        h: "7. Your rights",
        b: `Access, rectification, erasure, portability, objection, withdrawal of consent. Contact ${L.en.privacyEmail} to exercise these. You may also file a complaint with your local data protection authority (in France, the CNIL — www.cnil.fr).`,
      },
      {
        h: "8. Cookies",
        b: `The Service only uses cookies and local storage that are strictly necessary for its operation (authentication session, bot protection, remembering your chosen language). No advertising cookies are used.`,
      },
      {
        h: "9. Mobile app",
        b: `The app requests permission to send push notifications. It may also ask for access to your camera and photo library, only if you choose to add a photo (for example your profile picture or a service image). You can refuse or change these permissions at any time in your device settings; the related features are optional.`,
      },
      {
        h: "10. Children",
        b: `The Service is not intended for individuals under 16 years of age.`,
      },
      {
        h: "11. Changes",
        b: `We may update this policy. In the event of a material change, we will notify you before it takes effect.`,
      },
      {
        h: "12. Contact",
        b: `${L.en.editorFull} — ${L.en.privacyEmail}`,
      },
    ],
  },
};

export default function PrivacyPolicyPage({ onSignIn, onSignUp }) {
  const { lang } = useTranslation();
  const c = CONTENT[lang] || CONTENT.fr;

  return (
    <PublicLayout onSignIn={onSignIn} onSignUp={onSignUp} hero>
      <PageHero title={c.title} sub={c.updated} />
      <div style={{ ...S.wrap, maxWidth: 760, padding: "60px 28px 100px" }}>

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
      <GlowBand />
    </PublicLayout>
  );
}