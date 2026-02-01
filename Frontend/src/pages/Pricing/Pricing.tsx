import { useState } from "react";
import styles from "./Pricing.module.css";
import DescriptionPage from "../../components/Description/DescriptionPage";

const IconCheck = () => (
  <span className={`${styles.icon} ${styles.iconCheck}`} aria-hidden>
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 4.5L6.75 12.75L3 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

const IconCross = () => (
  <span className={`${styles.icon} ${styles.iconCross}`} aria-hidden>
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  </span>
);

type BillingPeriod = "monthly" | "yearly";

const freeFeaturesIncluded = [
  "Access to selected free courses.",
  "Limited course materials and resources.",
  "Basic community support.",
  "No certification upon completion.",
  "Ad-supported platform.",
];

const freeFeaturesExcluded = [
  "Access to exclusive Pro Plan community forums.",
  "Early access to new courses and updates.",
];

const proFeaturesIncluded = [
  "Unlimited access to all courses.",
  "Unlimited course materials and resources.",
  "Priority support from instructors.",
  "Course completion certificates.",
  "Ad-free experience.",
  "Access to exclusive Pro Plan community forums.",
  "Early access to new courses and updates.",
];

function Pricing() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  const freePrice = 0;
  const proPriceMonthly = 79;
  const proPriceYearly = 79 * 12 * 0.8; // 20% discount for yearly
  const proPrice = period === "monthly" ? proPriceMonthly : Math.round(proPriceYearly / 12);
  const proPriceDisplay = period === "monthly" ? proPriceMonthly : Math.round(proPriceYearly);

  return (
    <div className={styles.wrapper}>
      <DescriptionPage
            header="Our Pricing"
            description="Welcome to EduHub's Pricing page, where we offer flexible plans designed to support both learners and educators. Whether you are an individual student looking to expand your skills or a teacher aiming to share your knowledge, EduHub provides options that fit your needs. Explore our available plans and choose the one that best supports your learning or teaching goals."
        />
      <div className={styles.toggleWrap}>
        <div className={styles.toggle} role="group" aria-label="Billing period">
          <button
            type="button"
            className={`${styles.toggleButton} ${period === "monthly" ? styles.toggleButtonActive : ""}`}
            onClick={() => setPeriod("monthly")}
            aria-pressed={period === "monthly"}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`${styles.toggleButton} ${period === "yearly" ? styles.toggleButtonActive : ""}`}
            onClick={() => setPeriod("yearly")}
            aria-pressed={period === "yearly"}
          >
            Yearly
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.cards}>
          {/* Free Plan */}
          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Free Plan</h2>
            <div className={styles.priceWrap}>
              <span className={styles.price}>${freePrice}</span>
              <span className={styles.pricePeriod}>/month</span>
            </div>
            <div className={styles.featuresSection}>
              <h3 className={styles.featuresTitle}>Available Features</h3>
              <ul className={styles.featureList}>
                {freeFeaturesIncluded.map((text, i) => (
                  <li key={i} className={styles.featureItem}>
                    <IconCheck />
                    {text}
                  </li>
                ))}
                {freeFeaturesExcluded.map((text, i) => (
                  <li key={`ex-${i}`} className={styles.featureItem}>
                    <IconCross />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.ctaWrap}>
              <button type="button" className={styles.cta}>Get Started</button>
            </div>
          </article>

          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Pro Plan</h2>
            <div className={styles.priceWrap}>
              <span className={styles.price}>
                {period === "yearly" ? `$${proPriceDisplay}` : `$${proPrice}`}
              </span>
              <span className={styles.pricePeriod}>
                {period === "yearly" ? "/year" : "/month"}
              </span>
            </div>
            <div className={styles.featuresSection}>
              <h3 className={styles.featuresTitle}>Available Features</h3>
              <ul className={styles.featureList}>
                {proFeaturesIncluded.map((text, i) => (
                  <li key={i} className={styles.featureItem}>
                    <IconCheck />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.ctaWrap}>
              <button type="button" className={styles.cta}>Get Started</button>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

export default Pricing;
