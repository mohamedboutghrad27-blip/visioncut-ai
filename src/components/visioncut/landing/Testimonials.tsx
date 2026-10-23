"use client";

import React, { useState } from "react";
import { SectionHeading, Reveal, SampleBadge } from "@/components/visioncut/shared";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const TESTIMONIALS = [
  {
    id: "t1",
    quote:
      "The timeline feels like a desktop editor but lives in my browser. I storyboarded a client ad with the AI tools in about ten minutes.",
    name: "Maya R.",
    role: "Freelance video editor",
    initials: "MR",
    color: "#8b5cf6",
  },
  {
    id: "t2",
    quote:
      "Automatic subtitles used to be my least favorite task. Now I generate captions, restyle them, and export — all in one sitting.",
    name: "Daniel K.",
    role: "YouTube educator",
    initials: "DK",
    color: "#3b82f6",
  },
  {
    id: "t3",
    quote:
      "The multitrack timeline with waveforms is genuinely fast. Trimming interview clips and dropping AI voiceover on top just works.",
    name: "Priya S.",
    role: "Podcast producer",
    initials: "PS",
    color: "#22d3ee",
  },
];

export const FAQ_ITEMS = [
  {
    q: "Which video and audio formats are supported?",
    a: "In the browser editor you can import common formats your browser can decode — MP4 (H.264), WebM (VP8/VP9), most MP4/MOV variants, plus JPEG/PNG images and MP3/WAV/M4A audio. Files your browser cannot decode are rejected with a clear error message instead of silently failing.",
  },
  {
    q: "What export quality can I get?",
    a: "Exports render through the browser's media engine at the resolution you choose — from 480p drafts up to 4K where your device supports it — with configurable frame rate (24–60fps), quality presets and WebM output. The estimator in the export dialog shows the expected file size before you commit.",
  },
  {
    q: "How does pricing work?",
    a: "The Free tier lets you edit and export with limits. Pro and Studio tiers add advanced tools, AI usage and collaboration. Displayed prices are placeholders while the product is in early access — no payment integration is active yet, so nothing is charged.",
  },
  {
    q: "How are my projects and media stored?",
    a: "Projects are saved to your account in the cloud database, while your uploaded media is cached locally in your browser's storage and re-linked when you reopen a project. Projects are private to your account by default. Demo/example projects are clearly labeled as examples.",
  },
  {
    q: "What can the AI tools actually do?",
    a: "AI features run against real connected services: script-to-video produces an editable scene storyboard, text-to-image generates scene visuals, text-to-video generates short video clips, voiceover converts scripts to narration, and subtitles transcribe your clips' audio. Each tool shows its real status — when a service is unavailable the feature is labeled as a preview rather than pretending to succeed.",
  },
  {
    q: "Is my content private?",
    a: "Yes — your projects are private to your account, and AI processing only sends the specific content you submit (a script, an audio track, or a prompt). We never publish or share your media, and you can delete projects permanently at any time.",
  },
  {
    q: "Do I need a powerful computer?",
    a: "A modern browser is enough for editing up to 1080p comfortably. 4K previews and exports benefit from a discrete GPU and more RAM, and the preview quality selector lets you trade preview resolution for smoothness on lighter machines.",
  },
];

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="scroll-mt-20 border-t border-white/[0.08] py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Loved by creators"
          title={<>What creators <span className="text-gradient">are saying</span></>}
          description="Early-access feedback from editors, educators and producers using VisionCut AI."
        />
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.id} delay={i * 100}>
              <figure className="card-hover relative flex h-full flex-col rounded-xl border border-white/[0.08] bg-white/[0.015] p-6">
                <div className="mb-4 flex gap-1" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="h-3.5 w-3.5 fill-zinc-200 text-zinc-200" />
                  ))}
                </div>
                <blockquote className="flex-1 text-sm leading-relaxed text-zinc-300">“{t.quote}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-xs font-semibold text-white"
                  >
                    {t.initials}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{t.name}</p>
                    <p className="text-xs text-zinc-500">{t.role}</p>
                  </div>
                  <SampleBadge className="ml-auto" />
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-6 text-center" delay={150}>
          <p className="text-[11px] text-zinc-600">Testimonials are sample content shown for demonstration purposes.</p>
        </Reveal>
      </div>
    </section>
  );
}

export function FaqSection({ id = "faq" }: { id?: string }) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  return (
    <section id={id} className="scroll-mt-20 border-t border-white/[0.08] py-24 lg:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="FAQ"
          title={<>Questions, <span className="text-gradient">answered</span></>}
          description="Everything about formats, exports, privacy, pricing and AI features."
        />
        <Reveal className="mt-12">
          <Accordion type="single" collapsible value={openItem ?? undefined} onValueChange={setOpenItem}>
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className={cn(
                  "border-white/[0.08] transition-colors",
                  openItem === `faq-${i}` && "border-white/25"
                )}
              >
                <AccordionTrigger className="py-5 text-left text-[15px] font-medium text-zinc-200 hover:text-white hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-zinc-400">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
