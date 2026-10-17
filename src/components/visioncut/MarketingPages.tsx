"use client";

import React from "react";
import { Navbar } from "@/components/visioncut/landing/Navbar";
import { Footer } from "@/components/visioncut/landing/Footer";
import { FeaturesSection } from "@/components/visioncut/landing/Features";
import { PricingSection } from "@/components/visioncut/landing/Pricing";
import { ShowcaseGrid } from "@/components/visioncut/landing/Showcase";
import { Reveal, GradientButton } from "@/components/visioncut/shared";
import { useRouter } from "@/lib/router";
import { useAuth } from "@/components/visioncut/AuthContext";
import { FAQ_ITEMS } from "@/components/visioncut/landing/Testimonials";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle, MessageCircle, BookOpen, Keyboard, ShieldCheck, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

function PageHero({ eyebrow, title, subtitle }: { eyebrow: string; title: React.ReactNode; subtitle: string }) {
  return (
    <section className="relative overflow-hidden pb-10 pt-32 sm:pt-36">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black,transparent)]" />
        <div className="absolute left-1/2 top-0 h-[380px] w-[680px] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[130px]" />
      </div>
      <Reveal className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <span className="inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">
          {eyebrow}
        </span>
        <h1 className="font-display mt-5 text-4xl font-bold leading-tight text-white sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">{subtitle}</p>
      </Reveal>
    </section>
  );
}

export function FeaturesPage() {
  const router = useRouter();
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <PageHero
          eyebrow="Product Features"
          title={<>A complete studio, <span className="text-gradient">in your browser</span></>}
          subtitle="Professional multitrack editing, AI creation tools and cinematic exports — everything below is available in the editor today."
        />
        <FeaturesSection id="feature-grid" />
        <PricingSection id="plans" compact />
        <section className="border-t border-white/6 py-20 text-center">
          <Reveal>
            <GradientButton className="h-12 px-8 text-base" onClick={() => router.navigate(user ? "/dashboard" : "/signup")}>
              Try every feature free
            </GradientButton>
          </Reveal>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export function TemplatesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <PageHero
          eyebrow="Templates"
          title={<>Start from a <span className="text-gradient">story-ready template</span></>}
          subtitle="Pick a style, get a project preconfigured with the right aspect ratio and name — then make it yours in the editor."
        />
        <ShowcaseGrid showHeading={false} />
      </main>
      <Footer />
    </div>
  );
}

export function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <PageHero
          eyebrow="Pricing"
          title={<>Invest in your <span className="text-gradient">creative output</span></>}
          subtitle="Start free, upgrade when you need more AI power and collaboration. Prices shown are placeholders pending launch."
        />
        <PricingSection id="plans" />
        <section className="border-t border-white/6 py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Reveal>
              <h2 className="font-display text-center text-2xl font-bold text-white sm:text-3xl">Pricing questions</h2>
            </Reveal>
            <Reveal className="mt-8" delay={80}>
              <Accordion type="single" collapsible>
                {FAQ_ITEMS.slice(2, 5).map((item, i) => (
                  <AccordionItem key={i} value={`pp-${i}`} className="border-white/8">
                    <AccordionTrigger className="text-left text-[15px] font-medium text-zinc-200 hover:text-white hover:no-underline">{item.q}</AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-zinc-400">{item.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

const HELP_SECTIONS = [
  {
    icon: BookOpen,
    title: "Editor basics",
    items: [
      "Import media from the left panel — videos, images, audio or scripts are validated automatically.",
      "Drag clips onto the timeline, trim by the edges, split with the blade tool (S), duplicate (Ctrl/Cmd+D).",
      "Select a clip to edit position, scale, rotation, opacity, volume, speed and color in the right panel.",
      "Scrub with the playhead, zoom the timeline with Ctrl/Cmd + scroll or the zoom slider.",
    ],
  },
  {
    icon: Keyboard,
    title: "Keyboard shortcuts",
    items: [
      "Space — play / pause preview",
      "S — split clip at playhead · Delete — remove selected clip",
      "Ctrl/Cmd + Z / Shift+Z — undo / redo",
      "Ctrl/Cmd + D — duplicate clip · Ctrl/Cmd + S — save project",
      "← / → — step one frame back / forward",
    ],
  },
  {
    icon: Cpu,
    title: "AI tools",
    items: [
      "Script to Storyboard: paste a script, get scenes with visuals, narration and captions.",
      "Text to Video: generate short clips from a description (real generation service, async).",
      "Subtitles: transcribe a clip's audio, then edit text, timing and styling.",
      "Voiceover: convert narration text to speech and drop it on an audio track.",
      "Background Removal and advanced cleanup are previews — clearly labeled in the panel.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Formats, storage & privacy",
    items: [
      "Import: MP4/WebM/MOV video your browser can decode, JPEG/PNG images, MP3/WAV/M4A audio.",
      "Export: WebM (VP9/VP8) in all browsers; MP4 where the platform supports it. 480p–4K, 24–60fps.",
      "Media files are cached locally in your browser (IndexedDB) and re-linked when you reopen a project.",
      "Projects are private to your account. Example/demo projects are always clearly labeled.",
      "Oversized or undecodable files are rejected with a clear error before import.",
    ],
  },
];

export function HelpPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <PageHero
          eyebrow="Help & Documentation"
          title={<>Everything you need to <span className="text-gradient">master VisionCut</span></>}
          subtitle="Guides, shortcuts and answers for the editing studio and AI tools."
        />
        <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {HELP_SECTIONS.map((s, i) => (
              <Reveal key={s.title} delay={i * 80}>
                <div className="h-full rounded-2xl border border-white/8 bg-white/[0.025] p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/25 to-cyan-500/10 text-violet-300">
                      <s.icon className="h-5 w-5" />
                    </span>
                    <h2 className="font-display text-lg font-semibold text-white">{s.title}</h2>
                  </div>
                  <ul className="space-y-2.5">
                    {s.items.map((item, j) => (
                      <li key={j} className="flex gap-2.5 text-[13px] leading-relaxed text-zinc-400">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400/60" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-10">
            <div className="flex flex-col items-center justify-between gap-5 rounded-2xl border border-violet-400/20 bg-gradient-to-r from-violet-950/40 to-cyan-950/20 p-7 sm:flex-row">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-white">Still stuck?</h3>
                  <p className="mt-1 max-w-md text-sm text-zinc-400">
                    Support tickets are handled from your account email. Describe the issue and include your browser and project name.
                  </p>
                </div>
              </div>
              <a
                href="mailto:support@visioncut.ai"
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-400 px-6 text-sm font-semibold text-white transition-all hover:brightness-110"
              >
                <HelpCircle className="h-4 w-4" /> support@visioncut.ai
              </a>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </div>
  );
}
