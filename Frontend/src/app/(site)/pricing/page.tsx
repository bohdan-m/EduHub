"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Chip, Separator, ToggleButton, ToggleButtonGroup, buttonVariants } from "@heroui/react";
import { IconCheck, IconX } from "@tabler/icons-react";
import DescriptionPage from "@/components/Description/DescriptionPage";

type BillingPeriod = "monthly" | "yearly";

const freeFeaturesIncluded = [
  "Access to selected free courses",
  "Limited course materials and resources",
  "Basic community support",
  "No certification upon completion",
  "Ad-supported platform",
];

const freeFeaturesExcluded = [
  "Access to exclusive Pro Plan community forums",
  "Early access to new courses and updates",
];

const proFeaturesIncluded = [
  "Unlimited access to all courses",
  "Unlimited course materials and resources",
  "Priority support from instructors",
  "Course completion certificates",
  "Ad-free experience",
  "Access to exclusive Pro Plan community forums",
  "Early access to new courses and updates",
];

function Pricing() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  const freePrice = 0;
  const proPriceMonthly = 79;
  const proPriceYearly = 79 * 12 * 0.8; // 20% discount for yearly
  const proPrice = period === "monthly" ? proPriceMonthly : Math.round(proPriceYearly);

  const plans = [
    { name: "Free Plan", price: freePrice, per: "/month", included: freeFeaturesIncluded, excluded: freeFeaturesExcluded, isPro: false },
    { name: "Pro Plan", price: proPrice, per: period === "yearly" ? "/year" : "/month", included: proFeaturesIncluded, excluded: [], isPro: true },
  ];

  return (
    <div className="pb-4">
      <DescriptionPage
            header="Our Pricing"
            description="Welcome to EduHub's Pricing page, where we offer flexible plans designed to support both learners and educators. Whether you are an individual student looking to expand your skills or a teacher aiming to share your knowledge, EduHub provides options that fit your needs. Explore our available plans and choose the one that best supports your learning or teaching goals."
        />
      <div className="mt-10 mb-8 flex justify-center">
        <ToggleButtonGroup
          aria-label="Billing period"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[period]}
          onSelectionChange={(keys) => setPeriod([...keys][0] as BillingPeriod)}
          className="w-full sm:w-auto"
        >
          <ToggleButton id="monthly" className="flex-1 sm:min-w-32">Monthly</ToggleButton>
          <ToggleButton id="yearly" className="flex-1 gap-2 sm:min-w-32">
            Yearly
            <Chip size="sm" className="bg-highlight-soft text-highlight-ink">−20%</Chip>
          </ToggleButton>
        </ToggleButtonGroup>
      </div>

      <div className="mx-auto grid max-w-[900px] gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.name} className={`gap-0 p-5 sm:p-6 ${plan.isPro ? "ring-2 ring-accent" : ""}`}>
            <Card.Header className="gap-2">
              <Card.Title className="m-0 text-[17px] font-semibold text-muted">{plan.name}</Card.Title>
              <p className="m-0 mb-4">
                <span className="text-[40px] font-semibold leading-tight tabular-nums">${plan.price}</span>
                <span className="ml-1 text-[15px] text-muted">{plan.per}</span>
              </p>
            </Card.Header>
            <Separator />
            <Card.Content className="flex-1 gap-0 pt-5">
              <h3 className="m-0 mb-3 text-sm font-semibold">Available Features</h3>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {plan.included.map((text) => (
                  <li key={text} className="flex items-start gap-2.5 text-[15px] leading-snug">
                    <IconCheck size={18} className="mt-px shrink-0 text-accent" aria-hidden />
                    {text}
                  </li>
                ))}
                {plan.excluded.map((text) => (
                  <li key={text} className="flex items-start gap-2.5 text-[15px] leading-snug text-muted">
                    <IconX size={18} className="mt-px shrink-0" aria-hidden />
                    {text}
                  </li>
                ))}
              </ul>
            </Card.Content>
            <Card.Footer className="pt-6">
              <Link
                className={buttonVariants({ variant: plan.isPro ? "primary" : "outline", size: "lg", fullWidth: true })}
                href="/register"
              >
                Get started
              </Link>
            </Card.Footer>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default Pricing;
