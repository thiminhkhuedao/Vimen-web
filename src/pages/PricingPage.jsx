// src/pages/PricingPage.jsx

import { useState } from "react";
import { T } from "../styles/tokens";
import { useTranslation } from "../i18n/index.js";
import PublicLayout from "../components/PublicLayout";

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

export default function PricingPage({ onSignIn, onSignUp }) {
  const { t, lang } = useTranslation();
  const [openFaq, setOpenFaq] = useState(null);

  const isFr = lang === "fr";

  const locale = isFr ? "fr-FR" : "en-GB";
  const currencyCode = isFr ? "EUR" : "GBP";

  const fmt = (n) => {
    return Number(n || 0).toLocaleString(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const plans = [
    {
      id: "free",
      nameKey: "pricingPage.plans.free.name",
      taglineKey: "pricingPage.plans.free.tagline",
      price: 0,
      popular: false,
      features: [
        "pricingPage.plans.free.feat1",
        "pricingPage.plans.free.feat2",
        "pricingPage.plans.free.feat3",
        "pricingPage.plans.free.feat4",
        "pricingPage.plans.free.feat5",
        "pricingPage.plans.free.feat6",
      ],
      ctaKey: "pricingPage.plans.free.cta",
    },
  ];

  const faqs = [
    {
      qKey: "pricingPage.faq.q1",
      aKey: "pricingPage.faq.a1",
    },
    {
      qKey: "pricingPage.faq.q2",
      aKey: "pricingPage.faq.a2",
    },
    {
      qKey: "pricingPage.faq.q3",
      aKey: "pricingPage.faq.a3",
    },
    {
      qKey: "pricingPage.faq.q4",
      aKey: "pricingPage.faq.a4",
    },
  ];

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div style={S.page}>
      <PublicLayout
        onSignIn={onSignIn}
        onSignUp={onSignUp}
      >
        {/* Hero */}
        <header
          style={{
            padding: "80px 0 60px",
            textAlign: "center",
          }}
        >
          <div style={S.wrap}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: T.hint,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              {t("pricingPage.eyebrow", "Pricing")}
            </div>

            <h1
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: "clamp(32px, 5vw, 52px)",
                letterSpacing: -1.5,
                margin: "0 0 20px",
              }}
            >
              {t("pricingPage.hero.title")}
            </h1>

            <p
              style={{
                fontSize: 17,
                color: T.muted,
                maxWidth: 600,
                margin: "0 auto",
                lineHeight: 1.65,
              }}
            >
              {t("pricingPage.hero.subtitle")}
            </p>
          </div>
        </header>

        {/* Pricing Cards */}
        <section style={{ padding: "0 0 100px" }}>
          <div
            style={{
              ...S.wrap,
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 24,
              maxWidth: 800,
            }}
          >
            {plans.map((plan) => (
              <div
                key={plan.id}
                style={{
                  background: T.surface,
                  border: plan.popular
                    ? `2px solid ${T.brand}`
                    : `1px solid ${T.border}`,
                  borderRadius: T.r?.lg || 16,
                  padding: 32,
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  boxShadow: plan.popular
                    ? "0 10px 30px rgba(0,0,0,0.08)"
                    : "none",
                }}
              >
                {plan.popular && (
                  <div
                    style={{
                      position: "absolute",
                      top: -14,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: T.brand,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 800,
                      padding: "4px 14px",
                      borderRadius: T.r?.full || 999,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t("pricingPage.popularBadge")}
                  </div>
                )}

                <h3
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    margin: "0 0 6px",
                  }}
                >
                  {t(plan.nameKey)}
                </h3>

                <p
                  style={{
                    fontSize: 13,
                    color: T.muted,
                    margin: "0 0 24px",
                    minHeight: 38,
                    lineHeight: 1.5,
                  }}
                >
                  {t(plan.taglineKey)}
                </p>

                {/* Price */}
                <div
                  style={{
                    marginBottom: 28,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 42,
                      fontWeight: 900,
                      letterSpacing: -1,
                    }}
                  >
                    {fmt(plan.price)}
                  </span>

                  <span
                    style={{
                      fontSize: 14,
                      color: T.muted,
                    }}
                  >
                    / {t("pricingPage.monthAbbr")}
                  </span>
                </div>

                {/* Features */}
                <div
                  style={{
                    flex: 1,
                    marginBottom: 32,
                  }}
                >
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {plan.features.map((fKey, idx) => (
                      <li
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          fontSize: 14,
                          lineHeight: 1.5,
                        }}
                      >
                        <span
                          style={{
                            color: "#16A34A",
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          ✓
                        </span>

                        <span>{t(fKey)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <button
                  type="button"
                  onClick={onSignUp}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    borderRadius: T.r?.md || 6,
                    border: plan.popular
                      ? "none"
                      : `1px solid ${T.borderMed || T.border}`,
                    background: plan.popular
                      ? T.brand
                      : T.surface2 || T.surface,
                    color: plan.popular ? "#fff" : T.text,
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  {t(plan.ctaKey)}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section
          style={{
            padding: "70px 0 90px",
            background: T.surface2 || T.surface,
            borderTop: `1px solid ${T.border}`,
          }}
        >
          <div
            style={{
              ...S.wrap,
              maxWidth: 800,
            }}
          >
            <h2
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: "clamp(24px, 3.5vw, 34px)",
                letterSpacing: -1,
                textAlign: "center",
                margin: "0 0 40px",
              }}
            >
              {t("pricingPage.faq.title")}
            </h2>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;

                return (
                  <div
                    key={idx}
                    onClick={() => toggleFaq(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        toggleFaq(idx);
                      }
                    }}
                    style={{
                      background: T.surface,
                      borderRadius: T.r?.md || 8,
                      border: `1px solid ${T.border}`,
                      padding: "18px 24px",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 20,
                        fontWeight: 700,
                        fontSize: 16,
                      }}
                    >
                      <span>{t(faq.qKey)}</span>

                      <span
                        style={{
                          fontSize: 18,
                          color: T.muted,
                          flexShrink: 0,
                        }}
                      >
                        {isOpen ? "−" : "+"}
                      </span>
                    </div>

                    {isOpen && (
                      <p
                        style={{
                          margin: "12px 0 0",
                          fontSize: 14,
                          color: T.muted,
                          lineHeight: 1.6,
                        }}
                      >
                        {t(faq.aKey)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section
          style={{
            padding: "80px 0",
            textAlign: "center",
            borderTop: `1px solid ${T.border}`,
          }}
        >
          <div style={S.wrap}>
            <h2
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: "clamp(26px, 3.5vw, 38px)",
                letterSpacing: -1,
                margin: "0 0 18px",
              }}
            >
              {t("pricingPage.finalCta.title")}
            </h2>

            <button
              type="button"
              onClick={onSignUp}
              style={{
                background: T.brand,
                color: "#fff",
                border: "none",
                padding: "14px 32px",
                borderRadius: T.r?.md || 6,
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              {t("pricingPage.finalCta.cta")}
            </button>
          </div>
        </section>
      </PublicLayout>
    </div>
  );
}