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
  /** @deprecated kept for API compatibility — no longer rendered */
  accent?: string;
};

export const FEATURES: Feature[] = [
  { icon: Layers, title: "Multitrack Editing", description: "Layer unlimited video, audio, image and text tracks on a precision timeline with drag, trim, split and snapping." },
  { icon: Wand2, title: "AI-Powered Creation", description: "Turn a prompt or a full script into scenes, visuals and narration with an AI-assisted storyboard pipeline.", ai: true },
  { icon: Captions, title: "Automatic Subtitles", description: "Generate captions from any audio track with speech recognition, then style fonts, colors and timing in seconds.", ai: true },
  { icon: Clapperboard, title: "Text-to-Video", description: "Describe a shot and let generative AI render a video clip you can drop straight onto the timeline.", ai: true },
  { icon: Mic, title: "AI Voiceovers", description: "Convert narration scripts into natural speech with selectable voices, language and playback speed.", ai: true },
  { icon: Eraser, title: "Background Removal", description: "Isolate subjects from images without a green screen using AI segmentation (preview capability).", ai: true },
  { icon: ScanSearch, title: "Smart Scene Detection", description: "Automatically find cut points in long footage so you can jump between moments instantly." },
  { icon: Scissors, title: "Silence Removal", description: "Detect and tighten silent gaps in talking-head videos to keep pacing fast and engaging." },
  { icon: Palette, title: "Color Grading", description: "Real-time brightness, contrast, saturation and hue controls with cinematic filter looks." },
  { icon: AudioLines, title: "Audio Editing", description: "Per-clip volume, fading, and audio waveforms rendered directly on the timeline." },
  { icon: Smartphone, title: "Social Resizing", description: "Reframe projects for YouTube, TikTok, Reels and more with one-click aspect ratio presets." },
  { icon: LayoutTemplate, title: "Templates & Transitions", description: "Start from styled presets — cinematic fades, slides and more — applied per clip or track." },
  { icon: GreenScreen, title: "Chroma Key", description: "Classic green-screen compositing for custom backgrounds and creative effects." },
  { icon: Waves, title: "Video Stabilization", description: "Smooth out handheld shake for polished, professional-looking footage." },
  { icon: Gauge, title: "Speed Ramping", description: "Create dramatic slow motion and speed ramps with per-clip playback rate control." },
  { icon: MonitorPlay, title: "Multi-Resolution Export", description: "Export from 480p drafts to 4K masters in MP4/WebM with configurable quality presets." },
];

export function FeaturesSection({ id = "features" }: { id?: string }) {
  return (
    <section id={id} className="relative scroll-mt-20 border-t border-white/[0.08] py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Features"
          title={<>Everything you need to <span className="text-gradient">create cinematic video</span></>}
          description="A complete professional editing toolkit with AI at every step — from first idea to final export."
        />
        <div className="mt-14 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 70}>
              <div className="card-hover group relative h-full rounded-xl border border-white/[0.08] bg-white/[0.015] p-5">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300">
                  <f.icon className="h-[18px] w-[18px]" />
                </div>
                <h3 className="flex items-center gap-2 text-[15px] font-medium text-white">
                  {f.title}
                  {f.ai && (
                    <span className="rounded-full border border-white/15 bg-white/[0.05] px-1.5 py-px font-mono text-[9px] font-medium uppercase tracking-wider text-zinc-400">
                      AI
                    </span>
                  )}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">{f.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
