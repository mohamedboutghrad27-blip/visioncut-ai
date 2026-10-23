"use client";

import React from "react";
import { SectionHeading, Reveal } from "@/components/visioncut/shared";
import { useRouter } from "@/lib/router";
import { useAuth } from "@/components/visioncut/AuthContext";
import { Check, Minus } from "@/components/visioncut/landing/icons";
import { cn } from "@/lib/utils";

type PlanFeature = { label: string; included: boolean };

export type Plan = {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: string; // placeholder — configured later via env/admin
  priceNote: string;
  cta: string;
  highlight?: boolean;
  features: PlanFeature[];
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "For trying ideas and short-form edits",
    priceMonthly: "$0",
    priceNote: "Free while in early access — final pricing to be announced",
    cta: "Start for Free",
    features: [
      { label: "Basic editing tools (cut, trim, arrange)", included: true },
      { label: "Starter template library", included: true },
      { label: "720p exports with watermark", included: true },
      { label: "Limited exports per month", included: true },
      { label: "Basic video resolution options", included: true },
      { label: "AI generation tools", included: false },
      { label: "Premium effects & templates", included: false },
      { label: "Team workspaces", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For creators publishing every week",
    priceMonthly: "$—",
    priceNote: "Price placeholder — will be configured before launch",
    cta: "Choose Pro",
    highlight: true,
    features: [
      { label: "Everything in Free", included: true },
      { label: "Advanced editing tools", included: true },
      { label: "Premium templates & effects", included: true },
      { label: "Up to 4K exports, no watermark*", included: true },
      { label: "AI tools with defined usage limits", included: true },
      { label: "Priority rendering queue", included: true },
      { label: "Offline / local-only projects", included: false },
      { label: "Team workspaces", included: false },
    ],
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "For teams and production studios",
    priceMonthly: "$—",
    priceNote: "Price placeholder — will be configured before launch",
    cta: "Choose Studio",
    features: [
      { label: "Everything in Pro", included: true },
      { label: "Expanded AI usage limits", included: true },
      { label: "Team workspaces & shared projects", included: true },
      { label: "Collaboration & review features", included: true },
      { label: "Advanced export options & formats", included: true },
      { label: "Dedicated support channel", included: true },
      { label: "SSO / org policies (roadmap)", included: false },
      { label: "On-prem rendering (roadmap)", included: false },
    ],
  },
];

export function PricingSection({ id = "pricing", compact = false }: { id?: string; compact?: boolean }) {
  const router = useRouter();
  const { user } = useAuth();

  const choosePlan = (plan: Plan) => {
    if (plan.id === "free") {
      router.navigate(user ? "/dashboard" : "/signup");
      return;
    }
    router.navigate("/pricing");
  };

  return (
    <section id={id} className="scroll-mt-20 border-t border-white/[0.08] py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {!compact && (
          <SectionHeading
            eyebrow="Pricing"
            title={<>Simple plans that <span className="text-gradient">scale with you</span></>}
            description="Start free and upgrade when you need more power. Plan prices are placeholders and will be finalized before launch."
          />
        )}

        <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 100}>
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-xl border p-7 transition-all duration-300",
                  plan.highlight
                    ? "border-white/25 bg-[#0a0a0a] shadow-[0_0_80px_-24px_rgba(255,255,255,0.35)]"
                    : "border-white/[0.08] bg-white/[0.015] hover:border-white/20"
                )}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full bg-[#ededf2] px-3 py-1 text-[11px] font-medium text-black">
                    Most Popular
                  </span>
                )}
                <h3 className="font-display text-xl font-medium text-white">{plan.name}</h3>
                <p className="mt-1 text-[13px] text-zinc-500">{plan.tagline}</p>
                <div className="mt-5 flex items-end gap-2">
                  <span className="font-display text-[2.6rem] font-semibold leading-none tracking-tight text-white">{plan.priceMonthly}</span>
                  <span className="pb-1 text-sm text-zinc-500">/ month</span>
                </div>
                <p className="mt-2 min-h-8 text-[11px] leading-relaxed text-zinc-600">{plan.priceNote}</p>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f.label} className="flex items-start gap-2.5 text-[13px]">
                      {f.included ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-zinc-200" />
                      ) : (
                        <Minus className="mt-0.5 h-4 w-4 shrink-0 text-zinc-700" />
                      )}
                      <span className={f.included ? "text-zinc-300" : "text-zinc-600"}>{f.label}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => choosePlan(plan)}
                  className={cn(
                    "mt-7 w-full rounded-lg py-3 text-sm font-medium transition-all duration-200",
                    plan.highlight
                      ? "bg-[#ededf2] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] hover:bg-white"
                      : "border border-white/12 bg-white/[0.02] text-zinc-200 hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  {plan.cta}
                </button>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-8 text-center">
          <p className="text-xs leading-relaxed text-zinc-600">
            *Watermark removal subject to the plan&apos;s actual capabilities at launch. Payment integrations and subscription
            entitlements are not yet implemented — displayed tiers describe planned packaging only.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
