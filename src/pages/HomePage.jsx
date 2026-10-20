// src/pages/HomePage.jsx

import { useState } from "react";
import { T } from "../styles/publicTokens.js";
import { useTranslation } from "../i18n/index.js";
import PublicLayout from "../components/PublicLayout";
import HeroScene from "../components/HeroScene.jsx";
import TradesMosaic from "../components/TradesMosaic.jsx";
import { CtaBand } from "../components/PageHero.jsx";
import { Link } from "react-router-dom";

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

function KeyValueRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13,
        padding: "8px 0",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <span style={{ color: T.muted }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function TotalRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 12,
        marginTop: 4,
      }}
    >
      <span
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: T.hint,
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontFamily: "'Archivo Black', sans-serif",
          fontSize: 20,
          color: T.brand,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusPill({ children, color }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 999,
        background: `${color}1A`,
        color,
      }}
    >
      {children}
    </span>
  );
}

function BookingVisual({ t }) {
  return (
    <div
      style={{
        background: T.surface2,
        borderRadius: 16,
        padding: 24,
        border: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: T.brand,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          JM
        </div>

        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {t("home.features.booking.visual.name")}
          </div>

          <StatusPill color={T.green}>
            {t("home.features.booking.visual.badge")}
          </StatusPill>
        </div>
      </div>

      <div
        style={{
          background: T.surface,
          borderRadius: 10,
          padding: 14,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            marginBottom: 4,
          }}
        >
          {t("home.features.booking.visual.service1")}
        </div>

        <div
          style={{
            fontSize: 13,
            color: T.brand,
            fontWeight: 700,
          }}
        >
          €65
        </div>
      </div>

      <div
        style={{
          background: T.surface,
          borderRadius: 10,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            marginBottom: 4,
          }}
        >
          {t("home.features.booking.visual.service2")}
        </div>

        <div
          style={{
            fontSize: 13,
            color: T.brand,
            fontWeight: 700,
          }}
        >
          €120
        </div>
      </div>

      <div
        style={{
          background: T.brand,
          color: "#fff",
          textAlign: "center",
          padding: 12,
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        {t("home.features.booking.visual.cta")}
      </div>
    </div>
  );
}

function QuotesVisual({ t }) {
  return (
    <div
      style={{
        background: T.surface2,
        borderRadius: 16,
        padding: 24,
        border: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: T.brand,
          }}
        >
          {t("home.features.quotes.visual.number")}
        </div>

        <StatusPill color={T.green}>
          {t("home.features.quotes.visual.status")}
        </StatusPill>
      </div>

      <KeyValueRow
        label={t("home.features.quotes.visual.line1")}
        value="€320"
      />

      <KeyValueRow
        label={t("home.features.quotes.visual.line2")}
        value="€180"
      />

      <TotalRow
        label={t("home.features.quotes.visual.totalLabel")}
        value="€500"
      />
    </div>
  );
}

function InvoicesVisual({ t }) {
  return (
    <div
      style={{
        background: T.surface2,
        borderRadius: 16,
        padding: 24,
        border: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: T.brand,
          }}
        >
          {t("home.features.invoices.visual.number")}
        </div>

        <StatusPill color={T.green}>
          {t("home.features.invoices.visual.status")}
        </StatusPill>
      </div>

      <KeyValueRow
        label={t("home.features.invoices.visual.billTo")}
        value={t("home.features.invoices.visual.client")}
      />

      <KeyValueRow
        label={t("home.features.invoices.visual.line")}
        value="€850"
      />

      <TotalRow
        label={t("home.features.invoices.visual.totalLabel")}
        value="€850"
      />
    </div>
  );
}

function PaymentsVisual({ t }) {
  return (
    <div
      style={{
        background: T.surface2,
        borderRadius: 16,
        padding: 24,
        border: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 16,
        }}
      >
        {t("home.features.payments.visual.title")}
      </div>

      <KeyValueRow
        label={t("home.features.payments.visual.amount")}
        value="€550"
      />

      <KeyValueRow
        label={t("home.features.payments.visual.bankLabel")}
        value="Vimen"
      />

      <KeyValueRow
        label={t("home.features.payments.visual.ibanLabel")}
        value="FR76 •••• •••• •••4 5678"
      />

      <TotalRow
        label={t("home.features.payments.visual.receive")}
        value="€550.00"
      />
    </div>
  );
}

function ClientsVisual({ t }) {
  return (
    <div
      style={{
        background: T.surface2,
        borderRadius: 16,
        padding: 24,
        border: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 16,
        }}
      >
        {t("home.features.clients.visual.title")}
      </div>

      {[
        [
          t("home.features.clients.visual.client1"),
          "8",
          "€3,240",
        ],
        [
          t("home.features.clients.visual.client2"),
          "3",
          "€1,120",
        ],
        [
          t("home.features.clients.visual.client3"),
          "12",
          "€5,880",
        ],
      ].map(([name, jobs, revenue]) => (
        <div
          key={name}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 0",
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {name}
            </div>

            <div
              style={{
                fontSize: 12,
                color: T.hint,
              }}
            >
              {jobs} {t("home.features.clients.visual.jobsLabel")}
            </div>
          </div>

          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: T.brand,
            }}
          >
            {revenue}
          </div>
        </div>
      ))}
    </div>
  );
}

function GrowthVisual({ t }) {
  return (
    <div
      style={{
        background: T.surface2,
        borderRadius: 16,
        padding: 24,
        border: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: 32,
            letterSpacing: -1,
          }}
        >
          4.9
        </div>

        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {t("home.features.growth.visual.reviewsLabel")}
          </div>

          <div
            style={{
              fontSize: 12,
              color: T.hint,
            }}
          >
            {t("home.features.growth.visual.reviewsCount")}
          </div>
        </div>
      </div>

      <div
        style={{
          background: T.surface,
          borderRadius: 10,
          padding: 14,
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            marginBottom: 4,
          }}
        >
          {t("home.features.growth.visual.referralTitle")}
        </div>

        <div
          style={{
            fontSize: 12,
            color: T.muted,
          }}
        >
          {t("home.features.growth.visual.referralDesc")}
        </div>
      </div>
    </div>
  );
}

const FEATURE_TABS = [
  "booking",
  "quotes",
  "invoices",
  "payments",
  "clients",
  "growth",
];

const FEATURE_VISUALS = {
  booking: BookingVisual,
  quotes: QuotesVisual,
  invoices: InvoicesVisual,
  payments: PaymentsVisual,
  clients: ClientsVisual,
  growth: GrowthVisual,
};

function FeatureTabs({ t }) {
  const [active, setActive] = useState("booking");

  return (
    <section id="features" style={{ padding: "100px 0" }}>
      <div style={S.wrap}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: T.hint,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            textAlign: "center",
            marginBottom: 14,
          }}
        >
          {t("home.features.eyebrow")}
        </div>

        <h2
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: "clamp(28px, 4vw, 44px)",
            letterSpacing: -1,
            textAlign: "center",
            margin: "0 0 48px",
          }}
        >
          {t("home.features.title")}
        </h2>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 4,
            marginBottom: 48,
            flexWrap: "wrap",
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          {FEATURE_TABS.map((id) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              type="button"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "14px 20px",
                fontSize: 14,
                fontWeight: 600,
                color: active === id ? T.brand : T.muted,
                borderBottom:
                  active === id
                    ? `2px solid ${T.brand}`
                    : "2px solid transparent",
              }}
            >
              {t(`home.features.${id}.tabLabel`)}
            </button>
          ))}
        </div>

        <style>{`
          @media (max-width: 720px) {
            .vimen-features-grid {
              grid-template-columns: 1fr !important;
              gap: 32px !important;
            }
          }
        `}</style>

        {FEATURE_TABS.map((id) => {
          const Visual = FEATURE_VISUALS[id];

          return (
            <div
              key={id}
              role="tabpanel"
              className="vimen-features-grid"
              style={{
                display: active === id ? "grid" : "none",
                gridTemplateColumns: "1fr 1fr",
                gap: 64,
                alignItems: "center",
                minWidth: 0,
              }}
            >
              <div style={{ minHeight: 180, minWidth: 0 }}>
                <h3
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: -0.5,
                    margin: "0 0 16px",
                  }}
                >
                  {t(`home.features.${id}.title`)}
                </h3>

                <p
                  style={{
                    fontSize: 15,
                    color: T.muted,
                    lineHeight: 1.7,
                    marginBottom: 24,
                  }}
                >
                  {t(`home.features.${id}.desc`)}
                </p>

                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                  }}
                >
                  {[1, 2, 3].map((i) => (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        marginBottom: 14,
                        fontSize: 14,
                        color: T.text,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: T.brand,
                          marginTop: 7,
                          flexShrink: 0,
                        }}
                      />

                      {t(`home.features.${id}.bullet${i}`)}
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ minWidth: 0 }}>
                <Visual t={t} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PricingTeaser({ t }) {
  // "/pricing" désactivé temporairement — pas de Stripe/SIRET actif,
  // donc message "100% gratuit" à la place du teaser de tarifs.
  return (
    <section
      style={{
        padding: "80px 0",
        background: "transparent",
      }}
    >
      <div
        style={{
          ...S.wrap,
          textAlign: "center",
        }}
      >
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
          {t("home.pricingTeaser.eyebrow")}
        </div>

        <h2
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: "clamp(26px, 3.5vw, 40px)",
            letterSpacing: -1,
            margin: "0 0 16px",
          }}
        >
          {t("home.pricingTeaser.freeTitle")}
        </h2>

        <p
          style={{
            fontSize: 16,
            color: T.muted,
            maxWidth: 460,
            margin: "0 auto 32px",
            lineHeight: 1.7,
          }}
        >
          {t("home.pricingTeaser.freeSub")}
        </p>
      </div>
    </section>
  );
}

export default function HomePage({ onSignIn, onSignUp }) {
  const { t } = useTranslation();

  const stats = [
    ["5 min", t("home.hero.stats.setup")],
    ["€0", t("home.hero.stats.free")],
  ];

  return (
    <div style={S.page}>
      <PublicLayout
        onSignIn={onSignIn}
        onSignUp={onSignUp}
        hero
      >
        {/* Hero */}
        <HeroScene onSignUp={onSignUp} />

        <TradesMosaic />

        {/* Features */}
        <FeatureTabs t={t} />

        {/* Pricing Teaser */}
        <PricingTeaser t={t} />

        {/* Final CTA */}
        <CtaBand title={t("home.finalCta.title")} sub={t("home.finalCta.sub")} cta={t("home.finalCta.cta")} onClick={onSignUp} />
      </PublicLayout>
    </div>
  );
}