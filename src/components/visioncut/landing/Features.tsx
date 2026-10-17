"use client";

import React from "react";
import { SectionHeading, Reveal } from "@/components/visioncut/shared";
import {
  Layers, Wand2, Captions, Clapperboard, Mic, Eraser, ScanSearch, Scissors,
  Palette, AudioLines, Smartphone, LayoutTemplate, Image as GreenScreen,
  Waves, Gauge, MonitorPlay, type LucideIcon,
} from "lucide-react";

export type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  ai?: boolean;
  accent: string;
};

export const FEATURES: Feature[] = [
  { icon: Layers, title: "Multitrack Editing", description: "Layer unlimited video, audio, image and text tracks on a precision timeline with drag, trim, split and snapping.", accent: "from-violet-500/25 to-violet-500/5 text-violet-300" },
  { icon: Wand2, title: "AI-Powered Creation", description: "Turn a prompt or a full script into scenes, visuals and narration with an AI-assisted storyboard pipeline.", ai: true, accent: "from-cyan-500/25 to-cyan-500/5 text-cyan-300" },
  { icon: Captions, title: "Automatic Subtitles", description: "Generate captions from any audio track with speech recognition, then style fonts, colors and timing in seconds.", ai: true, accent: "from-blue-500/25 to-blue-500/5 text-blue-300" },
  { icon: Clapperboard, title: "Text-to-Video", description: "Describe a shot and let generative AI render a video clip you can drop straight onto the timeline.", ai: true, accent: "from-fuchsia-500/25 to-fuchsia-500/5 text-fuchsia-300" },
  { icon: Mic, title: "AI Voiceovers", description: "Convert narration scripts into natural speech with selectable voices, language and playback speed.", ai: true, accent: "from-emerald-500/25 to-emerald-500/5 text-emerald-300" },
  { icon: Eraser, title: "Background Removal", description: "Isolate subjects from images without a green screen using AI segmentation (preview capability).", ai: true, accent: "from-rose-500/25 to-rose-500/5 text-rose-300" },
  { icon: ScanSearch, title: "Smart Scene Detection", description: "Automatically find cut points in long footage so you can jump between moments instantly.", accent: "from-amber-500/25 to-amber-500/5 text-amber-300" },
  { icon: Scissors, title: "Silence Removal", description: "Detect and tighten silent gaps in talking-head videos to keep pacing fast and engaging.", accent: "from-teal-500/25 to-teal-500/5 text-teal-300" },
  { icon: Palette, title: "Color Grading", description: "Real-time brightness, contrast, saturation and hue controls with cinematic filter looks.", accent: "from-indigo-500/25 to-indigo-500/5 text-indigo-300" },
  { icon: AudioLines, title: "Audio Editing", description: "Per-clip volume, fading, and audio waveforms rendered directly on the timeline.", accent: "from-lime-500/25 to-lime-500/5 text-lime-300" },
  { icon: Smartphone, title: "Social Resizing", description: "Reframe projects for YouTube, TikTok, Reels and more with one-click aspect ratio presets.", accent: "from-sky-500/25 to-sky-500/5 text-sky-300" },
  { icon: LayoutTemplate, title: "Templates & Transitions", description: "Start from styled presets — cinematic fades, slides and more — applied per clip or track.", accent: "from-purple-500/25 to-purple-500/5 text-purple-300" },
  { icon: GreenScreen, title: "Chroma Key", description: "Classic green-screen compositing for custom backgrounds and creative effects.", accent: "from-green-500/25 to-green-500/5 text-green-300" },
  { icon: Waves, title: "Video Stabilization", description: "Smooth out handheld shake for polished, professional-looking footage.", accent: "from-orange-500/25 to-orange-500/5 text-orange-300" },
  { icon: Gauge, title: "Speed Ramping", description: "Create dramatic slow motion and speed ramps with per-clip playback rate control.", accent: "from-pink-500/25 to-pink-500/5 text-pink-300" },
  { icon: MonitorPlay, title: "Multi-Resolution Export", description: "Export from 480p drafts to 4K masters in MP4/WebM with configurable quality presets.", accent: "from-cyan-400/25 to-cyan-400/5 text-cyan-200" },
];

export function FeaturesSection({ id = "features" }: { id?: string }) {
  return (
    <section id={id} className="relative scroll-mt-20 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Features"
          title={<>Everything you need to <span className="text-gradient">create cinematic video</span></>}
          description="A complete professional editing toolkit with AI at every step — from first idea to final export."
        />
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 70}>
              <div className="card-hover group relative h-full overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.accent} border border-white/10`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="flex items-center gap-2 text-[15px] font-semibold text-white">
                  {f.title}
                  {f.ai && (
                    <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-cyan-300">
                      AI
                    </span>
                  )}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">{f.description}</p>
                <div className="pointer-events-none absolute -bottom-16 -right-16 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
