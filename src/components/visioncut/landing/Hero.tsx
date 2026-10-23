"use client";

import React from "react";
import { useRouter } from "@/lib/router";
import { useAuth } from "@/components/visioncut/AuthContext";
import { GradientButton, GhostButton } from "@/components/visioncut/shared";
import {
  Play, SkipBack, SkipForward, Layers, Sparkles, Wand2,
  Volume2, Type, Music, Mic, Captions, ScissorsLineDashed,
  Crop, Gauge, Palette, MonitorPlay, Star, ArrowRight, Undo2, Redo2, Download,
  SlidersHorizontal, Lock, Eye, ZoomIn,
} from "lucide-react";

const TRUST_ITEMS = [
  { icon: Star, label: "4.9/5 creator rating" },
  { icon: MonitorPlay, label: "4K & 60fps exports" },
  { icon: Sparkles, label: "AI-powered workflow" },
  { icon: Lock, label: "Private by default" },
];

const WAVEFORM_BARS = [
  38, 62, 45, 70, 52, 80, 66, 90, 58, 74, 48, 84, 60, 92, 55, 78, 64, 46, 72, 50,
  88, 62, 40, 76, 54, 68, 82, 44, 90, 58, 72, 48, 66, 80, 52, 74, 60, 42, 86, 56,
];

/* A believable miniature of the VisionCut editor — monochrome chrome (Resend-style),
   muted clip colors that read as real media, white playhead. */
function EditorPreview() {
  return (
    <div className="relative rounded-xl border border-white/10 bg-[#0a0a0a] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9),0_0_80px_-30px_rgba(255,255,255,0.15)]">
      {/* Window chrome */}
      <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        </div>
        <div className="mx-auto flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-[11px] text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Summer — Cinematic Travel Film
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          {[Undo2, Redo2, Download].map((Icon, i) => (
            <span key={i} className="rounded-md p-1.5 text-zinc-600">
              <Icon className="h-3.5 w-3.5" />
            </span>
          ))}
        </div>
      </div>

      <div className="flex">
        {/* Left rail */}
        <div className="hidden w-12 flex-col items-center gap-1 border-r border-white/[0.08] py-3 sm:flex">
          {[Layers, Type, Music, Wand2, Captions, Sparkles].map((Icon, i) => (
            <span
              key={i}
              className={`rounded-lg p-2 ${i === 0 ? "bg-white/10 text-white" : "text-zinc-600"}`}
            >
              <Icon className="h-4 w-4" />
            </span>
          ))}
        </div>

        {/* Center: preview + timeline */}
        <div className="min-w-0 flex-1">
          {/* Canvas */}
          <div className="relative mx-auto mt-3 aspect-video w-[86%] overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-zinc-900 via-[#101012] to-zinc-900">
            {/* Cinematic frame */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.10),transparent_55%),radial-gradient(ellipse_at_75%_80%,rgba(255,255,255,0.06),transparent_50%)]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            {/* mountains silhouette */}
            <svg viewBox="0 0 160 90" className="absolute inset-0 h-full w-full opacity-60" preserveAspectRatio="none">
              <path d="M0 68 L30 40 L48 58 L72 30 L98 55 L122 38 L160 66 L160 90 L0 90 Z" fill="rgba(24,24,27,0.85)" />
              <circle cx="120" cy="22" r="9" fill="rgba(255,255,255,0.75)" />
            </svg>
            {/* title overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
              <span className="font-display text-[clamp(14px,2.2vw,24px)] font-bold tracking-wide text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.9)]">
                GOLDEN HOUR
              </span>
              <span className="text-[8px] uppercase tracking-[0.4em] text-zinc-400">Iceland · 2026</span>
            </div>
            {/* scanline sweep */}
            <div className="absolute inset-x-0 top-0 h-8 animate-scanline bg-gradient-to-b from-white/10 to-transparent" />
            {/* timecode */}
            <div className="absolute bottom-1.5 left-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-zinc-300">
              00:00:07:14
            </div>
            <div className="absolute bottom-1.5 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-zinc-400">
              Fit · 100%
            </div>
          </div>

          {/* Playback controls */}
          <div className="mx-auto mt-2.5 flex w-[86%] items-center justify-center gap-3 pb-2 text-zinc-500">
            <SkipBack className="h-3.5 w-3.5" />
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.25)]">
              <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" />
            </span>
            <SkipForward className="h-3.5 w-3.5" />
            <span className="ml-2 font-mono text-[10px] text-zinc-500">00:07 / 00:34</span>
          </div>

          {/* Timeline */}
          <div className="border-t border-white/[0.08] bg-[#070707]">
            <div className="flex items-center justify-between px-3 py-1.5">
              <div className="flex gap-2 text-zinc-600">
                <span className="rounded bg-white/10 p-1 text-zinc-300"><ScissorsLineDashed className="h-3 w-3" /></span>
                <span className="rounded p-1"><Magnet className="h-3 w-3" /></span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-600">
                <ZoomIn className="h-3 w-3" />
                <div className="h-1 w-20 rounded-full bg-white/10">
                  <div className="h-1 w-3/5 rounded-full bg-zinc-400" />
                </div>
              </div>
            </div>
            {/* ruler */}
            <div className="relative mx-3 mb-1 h-3.5 border-b border-white/[0.08]">
              {[0, 1, 2, 3, 4, 5, 6].map((s) => (
                <span key={s} className="absolute top-0 font-mono text-[8px] text-zinc-600" style={{ left: `${s * 14}%` }}>
                  {s === 0 ? "0:00" : `0:${s}0`}
                </span>
              ))}
              {/* playhead */}
              <div className="absolute -top-0.5 bottom-0 left-[38%] w-px bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]">
                <div className="absolute -left-[5px] -top-1 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-white" />
              </div>
            </div>
            {/* video track */}
            <div className="relative mx-3 mb-1.5 flex h-9 gap-1 overflow-hidden rounded-md">
              <div className="relative h-full w-[24%] overflow-hidden rounded-md bg-gradient-to-br from-zinc-600/80 to-zinc-800/80">
                <span className="absolute bottom-0.5 left-1.5 flex items-center gap-1 text-[8px] text-white/85"><Eye className="h-2 w-2" />drone_shot.mp4</span>
              </div>
              <div className="relative h-full w-[30%] overflow-hidden rounded-md bg-gradient-to-br from-zinc-700/70 to-zinc-800/60">
                <span className="absolute bottom-0.5 left-1.5 flex items-center gap-1 text-[8px] text-white/85"><Eye className="h-2 w-2" />waterfall.mp4</span>
              </div>
              <div className="relative h-full w-[22%] overflow-hidden rounded-md bg-gradient-to-br from-zinc-600/60 to-zinc-700/60">
                <span className="absolute bottom-0.5 left-1.5 flex items-center gap-1 text-[8px] text-white/85"><Eye className="h-2 w-2" />golden.mp4</span>
              </div>
              <div className="relative h-full w-[16%] overflow-hidden rounded-md border border-white/15 bg-white/[0.08]">
                <span className="absolute bottom-0.5 left-1.5 flex items-center gap-1 text-[8px] text-white/85"><Type className="h-2 w-2" />Title</span>
              </div>
            </div>
            {/* audio track with waveform */}
            <div className="relative mx-3 mb-3 h-8 overflow-hidden rounded-md border border-white/10 bg-white/[0.03]">
              <div className="flex h-full items-center gap-[2px] px-1.5 opacity-80">
                {WAVEFORM_BARS.slice(0, 40).map((h, i) => (
                  <span
                    key={i}
                    className="w-full max-w-[4px] shrink rounded-sm bg-zinc-400/80"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <span className="absolute bottom-0.5 left-1.5 flex items-center gap-1 text-[8px] text-zinc-400"><Music className="h-2 w-2" />ambient_score.wav</span>
            </div>
          </div>
        </div>

        {/* Right properties rail */}
        <div className="hidden w-32 flex-col gap-2.5 border-l border-white/[0.08] p-3 lg:flex">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <SlidersHorizontal className="h-3 w-3" /> Properties
          </span>
          {[
            { label: "Scale", value: 82 },
            { label: "Rotation", value: 0 },
            { label: "Opacity", value: 100 },
            { label: "Volume", value: 64 },
          ].map((p) => (
            <div key={p.label}>
              <div className="mb-1 flex justify-between text-[9px] text-zinc-500">
                <span>{p.label}</span>
                <span className="text-zinc-400">{p.value}%</span>
              </div>
              <div className="h-1 rounded-full bg-white/10">
                <div className="h-1 rounded-full bg-zinc-300" style={{ width: `${p.value}%` }} />
              </div>
            </div>
          ))}
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {[Crop, Gauge, Palette, Mic].map((Icon, i) => (
              <span key={i} className="flex items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02] py-2 text-zinc-500">
                <Icon className="h-3.5 w-3.5" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Magnet({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15" />
      <path d="m5 8 4 4" /><path d="m12 15 4 4" />
    </svg>
  );
}

export function Hero() {
  const router = useRouter();
  const { user } = useAuth();

  const startCreating = () => router.navigate(user ? "/dashboard" : "/signup");

  return (
    <section className="relative overflow-hidden pb-20 pt-32 sm:pt-36 lg:pb-28 lg:pt-40">
      {/* Resend-style backdrop: dot grid masked to a soft ellipse + one quiet top glow */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black_30%,transparent_75%)]" />
        <div className="absolute left-1/2 top-[-220px] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-white/[0.07] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Announcement pill */}
          <div className="animate-fade-up inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.03] py-1 pl-1 pr-3.5 text-[13px] text-zinc-300 backdrop-blur-sm">
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white">New</span>
            <span className="text-zinc-400">AI script-to-storyboard & real text-to-video</span>
            <ArrowRight className="h-3.5 w-3.5 text-zinc-500" />
          </div>

          <h1 className="animate-fade-up font-display mt-8 text-[2.75rem] font-semibold leading-[1.05] tracking-tighter text-white sm:text-6xl lg:text-[4.75rem]" style={{ animationDelay: "80ms" }}>
            Your Vision. Your Story.
            <br />
            <span className="text-gradient">Your Masterpiece.</span>
          </h1>

          <p className="animate-fade-up mx-auto mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg text-pretty" style={{ animationDelay: "160ms" }}>
            Edit videos professionally, create cinematic content, and transform your ideas into
            stunning videos with powerful AI tools — right in your browser.
          </p>

          <div className="animate-fade-up mt-9 flex flex-col items-center justify-center gap-3.5 sm:flex-row" style={{ animationDelay: "240ms" }}>
            <GradientButton onClick={startCreating} className="h-12 px-8 text-base">
              Start Creating for Free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </GradientButton>
            <GhostButton
              className="h-12 px-8 text-base"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              Explore Features
            </GhostButton>
          </div>

          <div className="animate-fade-up mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-2.5 text-xs text-zinc-500" style={{ animationDelay: "320ms" }}>
            {TRUST_ITEMS.map((t) => (
              <span key={t.label} className="inline-flex items-center gap-1.5">
                <t.icon className="h-3.5 w-3.5 text-zinc-600" /> {t.label}
              </span>
            ))}
          </div>
        </div>

        {/* Editor preview — framed like a product screenshot */}
        <div className="animate-fade-up relative mx-auto mt-16 max-w-5xl" style={{ animationDelay: "420ms" }}>
          <div className="pointer-events-none absolute -inset-x-12 -bottom-10 -top-6 rounded-[40px] bg-white/[0.05] blur-3xl" aria-hidden />
          <EditorPreview />
          <p className="mt-4 text-center font-mono text-[11px] text-zinc-600">
            The VisionCut editing studio — every control below is fully functional.
          </p>
        </div>
      </div>
    </section>
  );
}
