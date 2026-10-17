"use client";

import React from "react";
import { SectionHeading, Reveal } from "@/components/visioncut/shared";
import { Import, Wand2, Share2, ArrowRight } from "lucide-react";
import { useRouter } from "@/lib/router";
import { useAuth } from "@/components/visioncut/AuthContext";
import { GradientButton } from "@/components/visioncut/shared";

const STEPS = [
  {
    icon: Import,
    step: "01",
    title: "Import your content",
    description:
      "Bring in videos, images, music and voice tracks — or paste a script and let AI storyboard it for you. Files are validated and organized in your media library instantly.",
  },
  {
    icon: Wand2,
    step: "02",
    title: "Edit with AI assistance",
    description:
      "Cut, trim and layer on a professional multitrack timeline. Generate subtitles, voiceovers and scenes with AI, then fine-tune color, motion and audio with precision controls.",
  },
  {
    icon: Share2,
    step: "03",
    title: "Export and share",
    description:
      "Render your master in the resolution and format you need — from quick social drafts to 4K cinematic exports — then download and share your finished video anywhere.",
  },
];

export function HowItWorks() {
  const router = useRouter();
  const { user } = useAuth();
  return (
    <section id="how-it-works" className="relative scroll-mt-20 border-y border-white/6 bg-white/[0.015] py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title={<>From idea to masterpiece in <span className="text-gradient">three steps</span></>}
          description="A workflow designed to remove friction — so you spend time creating, not fighting the tool."
        />

        <div className="relative mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* connector line */}
          <div className="pointer-events-none absolute left-[16%] right-[16%] top-10 hidden h-px bg-gradient-to-r from-violet-500/40 via-indigo-400/30 to-cyan-400/40 md:block" aria-hidden />
          {STEPS.map((s, i) => (
            <Reveal key={s.step} delay={i * 120}>
              <div className="relative flex h-full flex-col items-center rounded-2xl border border-white/8 bg-[#0b0b12]/80 p-8 text-center">
                <div className="relative z-10 mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-600/25 to-cyan-500/15 shadow-[0_0_30px_-6px_rgba(139,92,246,0.5)]">
                  <s.icon className="h-8 w-8 text-violet-200" />
                  <span className="absolute -right-2 -top-2 rounded-full bg-gradient-to-r from-violet-600 to-cyan-400 px-2 py-0.5 text-[10px] font-bold text-white">
                    {s.step}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{s.description}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12 text-center" delay={200}>
          <GradientButton onClick={() => router.navigate(user ? "/dashboard" : "/signup")}>
            Try the workflow now <ArrowRight className="h-4 w-4" />
          </GradientButton>
        </Reveal>
      </div>
    </section>
  );
}
