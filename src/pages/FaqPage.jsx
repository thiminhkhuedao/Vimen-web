import { useState, useMemo } from "react";
import { T } from "../styles/publicTokens.js";
import { useTranslation } from "../i18n/index.js";
import PublicLayout from "../components/PublicLayout.jsx";
import PageHero, { CtaBand } from "../components/PageHero.jsx";


const S = {
  page: {
    minHeight: "100vh",
    background: T.surface,
    color: T.text,
    fontFamily: "'Inter', sans-serif",
    WebkitFontSmoothing: "antialiased",
  },
  wrap: {
    maxWidth: 1160,
    margin: "0 auto",
    padding: "0 28px",
  },
};


function FAQItem({ id, question, answer, open, onToggle }) {
  const contentId = `faq-answer-${id}`;

  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "22px 0",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: T.text }}>
          {question}
        </span>
        <span
          aria-hidden="true"
          style={{
            fontSize: 20,
            color: T.hint,
            transform: open ? "rotate(45deg)" : "none",
            transition: "transform 0.15s ease",
            lineHeight: 1,
            display: "inline-block",
          }}
        >
          +
        </span>
      </button>
      {(
        <div id={contentId} role="region" hidden={!open}>
          <p
            style={{
              fontSize: 15,
              color: T.muted,
              lineHeight: 1.7,
              margin: "0 0 22px",
              maxWidth: 640,
            }}
          >
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}

export default function FAQPage({ onSignIn, onSignUp }) {
  const { t, lang, setLanguage, languages } = useTranslation();
  const [openIndex, setOpenIndex] = useState(0);

  const items = useMemo(() => {
    return Array.from({ length: 10 }, (_, index) => {
      const i = index + 1;
      return {
        id: i,
        question: t(`faqPage.q${i}.question`),
        answer: t(`faqPage.q${i}.answer`),
      };
    });
  }, [t]);

  return (
  <PublicLayout
    onSignIn={onSignIn}
    onSignUp={onSignUp}
    hero
  >

      <PageHero title={t("faqPage.title")} sub={t("faqPage.sub")} />

      <section style={{ padding: "40px 0 100px" }}>
        <div style={{ ...S.wrap, maxWidth: 720 }}>
          {items.map((item, i) => (
            <FAQItem
              key={item.id}
              id={item.id}
              question={item.question}
              answer={item.answer}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
            />
          ))}
        </div>
      </section>

      <CtaBand title={t("faqPage.finalCta.title")} cta={t("faqPage.finalCta.cta")} href="/contact" />

          </PublicLayout>
  );
}