// src/pages/TermsOfServicePage.jsx
//
// Contenu basé sur terms-of-service-fr.md / terms-of-service-en.md — les
// placeholders [À COMPLÉTER] / [TO COMPLETE] DOIVENT être remplis avant
// mise en ligne (raison sociale, SIRET, prix des plans, commission, etc.)

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
    title: "Conditions Générales d'Utilisation",
    updated: "Dernière mise à jour : [À COMPLÉTER — date de publication]",
    intro: `Les présentes CGU régissent l'accès et l'utilisation de l'application web et mobile Vimen (« le Service »), éditée par [À COMPLÉTER — raison sociale, forme juridique, SIRET, adresse].

En créant un compte ou en utilisant le Service, tu acceptes d'être lié par ces CGU. Si tu n'es pas d'accord, n'utilise pas le Service.`,
    sections: [
      {
        h: "1. Description du Service",
        b: `Vimen est une plateforme permettant aux professionnels indépendants (« Pro ») de gérer leurs clients, rendez-vous, devis, factures et paiements, et de proposer une page de réservation publique à leurs propres clients (« Clients finaux »).`,
      },
      {
        h: "2. Création de compte",
        b: `Tu dois avoir au moins 18 ans et la capacité juridique de contracter. Tu es responsable de l'exactitude des informations fournies et de la confidentialité de tes identifiants. Un compte est personnel et ne doit pas être partagé. Nous nous réservons le droit de suspendre ou résilier un compte en cas de violation de ces CGU.`,
      },
      {
        h: "3. Abonnement et facturation",
        b: `Vimen est 100% gratuit : il n'existe aucun abonnement payant, aucun forfait, ni aucune limite sur le nombre de clients, factures, devis ou rendez-vous. Aucune information de carte bancaire n'est requise pour créer un compte ou utiliser le Service.`,
      },
      {
        h: "4. Paiements et versements",
        b: `Actuellement, les paiements de tes clients se font par virement bancaire direct en utilisant l'IBAN que tu affiches sur tes devis et factures — Vimen n'intervient à aucun moment dans ce paiement et ne détient jamais tes fonds. Le paiement en ligne par carte bancaire, via Stripe, notre futur prestataire de paiement, arrivera prochainement ; les présentes CGU seront mises à jour en conséquence à ce moment-là. Tu es seul responsable de déclarer et payer les impôts et cotisations applicables à tes revenus.`,
      },
      {
        h: "5. Ta responsabilité concernant les données de tes clients",
        b: `Quand tu enregistres des informations sur tes propres clients dans Vimen, tu agis en tant que responsable de traitement au sens du RGPD pour ces données : base légale, information de tes clients, réponse à leurs demandes de droits. Vimen agit comme sous-traitant technique pour l'hébergement, voir notre Politique de confidentialité.`,
      },
      {
        h: "6. Page de réservation publique et devis",
        b: `Tu es responsable de l'exactitude des informations affichées sur ta page publique. Les devis signés électroniquement par un Client final constituent un accord entre toi et ce client — Vimen n'est pas partie à cet accord et n'en garantit ni l'exécution ni le contenu.`,
      },
      {
        h: "7. Avis",
        b: `Les avis doivent refléter une expérience réelle — faux avis interdits, y compris sur ton propre profil. Nous pouvons retirer un avis frauduleux, diffamatoire ou contraire à ces CGU. Tu peux masquer un avis te concernant, mais pas en modifier le contenu ni le statut de vérification.`,
      },
      {
        h: "8. Marketplace",
        b: `Les annonces doivent être exactes et légales. Vimen ne garantit pas la conclusion d'une transaction et n'est pas partie aux accords entre utilisateurs. Nous pouvons retirer toute annonce non conforme.`,
      },
      {
        h: "9. Programme de parrainage",
        b: `[À COMPLÉTER — conditions exactes : récompense, délai, éligibilité, droit de Vimen de modifier ou mettre fin au programme.]`,
      },
      {
        h: "10. Utilisation acceptable",
        b: `Interdiction d'utiliser le Service à des fins illégales, de contourner nos mesures de sécurité, d'extraire massivement des données (scraping), de publier du contenu diffamatoire ou portant atteinte à des tiers, ou d'usurper une identité. Toute violation peut entraîner la suspension ou résiliation immédiate du compte.`,
      },
      {
        h: "11. Propriété intellectuelle",
        b: `Le Service, sa marque, son design et son code appartiennent à Vimen. Tu conserves la propriété de ton propre contenu (photos, descriptions, annonces) mais nous accordes une licence non-exclusive pour l'afficher dans le cadre du Service.`,
      },
      {
        h: "12. Disponibilité du Service",
        b: `Nous nous efforçons d'assurer une disponibilité continue, sans garantie absolue. Interruptions possibles pour maintenance, mise à jour ou force majeure, avec préavis raisonnable lorsque possible.`,
      },
      {
        h: "13. Limitation de responsabilité",
        b: `Le Service est fourni « en l'état ». Vimen n'est pas responsable des litiges entre un Pro et ses propres Clients finaux. La responsabilité de Vimen, si engagée, est limitée [À COMPLÉTER]. Cette limitation ne s'applique pas en cas de faute lourde ou intentionnelle, ni où la loi l'interdit.`,
      },
      {
        h: "14. Résiliation",
        b: `Tu peux supprimer ton compte à tout moment. Nous pouvons suspendre ou résilier ton accès en cas de violation de ces CGU ou d'inactivité prolongée [À COMPLÉTER — durée], avec notification préalable sauf urgence (fraude, sécurité). Les dispositions sur la propriété intellectuelle, la responsabilité et le droit applicable survivent à la résiliation.`,
      },
      {
        h: "15. Modifications des CGU",
        b: `Nous pouvons modifier ces CGU. En cas de changement substantiel, nous t'en informerons avant leur entrée en vigueur. La poursuite de l'utilisation vaut acceptation des nouvelles CGU.`,
      },
      {
        h: "16. Droit applicable et juridiction",
        b: `Ces CGU sont soumises au droit français. Tout litige relève de la compétence des tribunaux de [À COMPLÉTER — ville du siège social], sous réserve des règles impératives de protection des consommateurs.`,
      },
      {
        h: "17. Contact",
        b: `[À COMPLÉTER — raison sociale, adresse postale, email de contact]`,
      },
    ],
  },
  en: {
    title: "Terms of Service",
    updated: "Last updated: [TO COMPLETE — publication date]",
    intro: `These Terms govern access to and use of the Vimen web and mobile application ("the Service"), operated by [TO COMPLETE — company name, legal form, SIRET, address].

By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.`,
    sections: [
      {
        h: "1. Description of the Service",
        b: `Vimen is a platform enabling independent professionals ("Pro") to manage their clients, appointments, quotes, invoices, and payments, and to offer a public booking page to their own clients ("End Clients").`,
      },
      {
        h: "2. Account creation",
        b: `You must be at least 18 years old and have the legal capacity to contract. You are responsible for the accuracy of your information and the confidentiality of your credentials. An account is personal and must not be shared. We reserve the right to suspend or terminate an account for violating these Terms.`,
      },
      {
        h: "3. Subscription and billing",
        b: `Vimen is 100% free: there is no paid subscription, no plan, and no limit on the number of clients, invoices, quotes, or bookings. No credit card information is required to create an account or use the Service.`,
      },
      {
        h: "4. Payments and payouts",
        b: `Currently, client payments are made by direct bank transfer using the IBAN you display on your quotes and invoices — Vimen never intervenes in this payment and never holds your funds. Online card payment, via Stripe, our upcoming payment processor, is coming soon; these Terms will be updated accordingly at that time. You are solely responsible for declaring and paying taxes on your income.`,
      },
      {
        h: "5. Your responsibility regarding your clients' data",
        b: `When you record information about your own clients in Vimen, you act as the data controller under GDPR: legal basis, informing your clients, responding to their rights requests. Vimen acts as a technical data processor for hosting, see our Privacy Policy.`,
      },
      {
        h: "6. Public booking page and quotes",
        b: `You are responsible for the accuracy of information on your public page. Quotes electronically signed by an End Client form an agreement between you and that client — Vimen is not a party to it and does not guarantee its performance or content.`,
      },
      {
        h: "7. Reviews",
        b: `Reviews must reflect a genuine experience — fake reviews prohibited, including on your own profile. We may remove fraudulent, defamatory, or non-compliant reviews. You may hide a review about you, but not edit its content or verification status.`,
      },
      {
        h: "8. Marketplace",
        b: `Listings must be accurate and lawful. Vimen does not guarantee a transaction will occur and is not a party to agreements between users. We may remove non-compliant listings.`,
      },
      {
        h: "9. Referral program",
        b: `[TO COMPLETE — exact terms: reward, timeframe, eligibility, Vimen's right to modify or end the program.]`,
      },
      {
        h: "10. Acceptable use",
        b: `No illegal use, circumventing security measures, scraping, posting defamatory or infringing content, or impersonation. Violations may result in suspension or immediate termination.`,
      },
      {
        h: "11. Intellectual property",
        b: `The Service, its brand, design, and code belong to Vimen. You retain ownership of your own content (photos, descriptions, listings) but grant us a non-exclusive license to display it as part of the Service.`,
      },
      {
        h: "12. Service availability",
        b: `We strive for continuous availability without absolute guarantee. Interruptions possible for maintenance, updates, or force majeure, with reasonable notice when possible.`,
      },
      {
        h: "13. Limitation of liability",
        b: `The Service is provided "as is." Vimen is not liable for disputes between a Pro and their own End Clients. Vimen's liability, where established, is limited to [TO COMPLETE]. This does not apply to gross or intentional misconduct, or where prohibited by law.`,
      },
      {
        h: "14. Termination",
        b: `You may delete your account anytime. We may suspend or terminate access for violating these Terms or prolonged inactivity [TO COMPLETE — duration], with prior notice except in urgent cases (fraud, security). Provisions on IP, liability, and governing law survive termination.`,
      },
      {
        h: "15. Changes to these Terms",
        b: `We may modify these Terms. We'll notify you of material changes before they take effect. Continued use constitutes acceptance of the new Terms.`,
      },
      {
        h: "16. Governing law and jurisdiction",
        b: `These Terms are governed by French law. Disputes fall under the jurisdiction of the courts of [TO COMPLETE — city of registered office], subject to mandatory consumer protection rules.`,
      },
      {
        h: "17. Contact",
        b: `[TO COMPLETE — company name, postal address, contact email]`,
      },
    ],
  },
};

export default function TermsOfServicePage({ onSignIn, onSignUp }) {
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