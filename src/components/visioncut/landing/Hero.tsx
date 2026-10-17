"use client";

import React from "react";
import { useRouter } from "@/lib/router";
import { useAuth } from "@/components/visioncut/AuthContext";
import { GradientButton, GhostButton } from "@/components/visioncut/shared";
import {
  Play, Pause, SkipBack, SkipForward, Layers, Sparkles, Scissors, Wand2,
  Volume2, Type, Image as ImageIcon, Music, Mic, Captions, ScissorsLineDashed,
  Crop, Gauge, Palette, MonitorPlay, Star, ArrowRight, Undo2, Redo2, Download,
  PanelLeft, SlidersHorizontal, Lock, Eye, ZoomIn,
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

/* A believable miniature of the VisionCut editor, fully CSS-animated */
function EditorPreview() {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-[#0a0a12]/90 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9),0_0_80px_-20px_rgba(139,92,246,0.35)] backdrop-blur-xl">
      {/* Window chrome */}
      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        </div>
        <div className="mx-auto flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Summer — Cinematic Travel Film
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          {[Undo2, Redo2, Download].map((Icon, i) => (
            <span key={i} className="rounded-md p-1.5 text-zinc-500">
              <Icon className="h-3.5 w-3.5" />
            </span>
          ))}
        </div>
      </div>

      <div className="flex">
        {/* Left rail */}
        <div className="hidden w-12 flex-col items-center gap-1 border-r border-white/8 py-3 sm:flex">
          {[Layers, Type, Music, Wand2, Captions, Sparkles].map((Icon, i) => (
            <span
              key={i}
              className={`rounded-lg p-2 ${i === 0 ? "bg-violet-500/20 text-violet-300" : "text-zinc-600"}`}
            >
              <Icon className="h-4 w-4" />
            </span>
          ))}
        </div>

        {/* Center: preview + timeline */}
        <div className="min-w-0 flex-1">
          {/* Canvas */}
          <div className="relative mx-auto mt-3 aspect-video w-[86%] overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-indigo-950 via-[#131528] to-violet-950/60">
            {/* Fake cinematic frame */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(139,92,246,0.35),transparent_55%),radial-gradient(ellipse_at_75%_80%,rgba(34,211,238,0.25),transparent_50%)]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
            {/* mountains silhouette */}
            <svg viewBox="0 0 160 90" className="absolute inset-0 h-full w-full opacity-60" preserveAspectRatio="none">
              <path d="M0 68 L30 40 L48 58 L72 30 L98 55 L122 38 L160 66 L160 90 L0 90 Z" fill="rgba(20,18,40,0.85)" />
              <circle cx="120" cy="22" r="9" fill="rgba(255,240,200,0.85)" />
            </svg>
            {/* title overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
              <span className="font-display text-[clamp(14px,2.2vw,24px)] font-bold tracking-wide text-white drop-shadow-[0_2px_16px_rgba(139,92,246,0.8)]">
                GOLDEN HOUR
              </span>
              <span className="text-[8px] uppercase tracking-[0.4em] text-violet-200/80">Iceland · 2026</span>
            </div>
            {/* scanline sweep */}
            <div className="absolute inset-x-0 top-0 h-8 animate-scanline bg-gradient-to-b from-white/10 to-transparent" />
            {/* timecode */}
            <div className="absolute bottom-1.5 left-2 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">
              00:00:07:14
            </div>
            <div className="absolute bottom-1.5 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] text-zinc-300">
              Fit · 100%
            </div>
          </div>

          {/* Playback controls */}
          <div className="mx-auto mt-2.5 flex w-[86%] items-center justify-center gap-3 pb-2 text-zinc-500">
            <SkipBack className="h-3.5 w-3.5" />
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.35)]">
              <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" />
            </span>
            <SkipForward className="h-3.5 w-3.5" />
            <span className="ml-2 font-mono text-[10px] text-zinc-500">00:07 / 00:34</span>
          </div>

          {/* Timeline */}
          <div className="border-t border-white/8 bg-[#08080e]">
            <div className="flex items-center justify-between px-3 py-1.5">
              <div className="flex gap-2 text-zinc-600">
                <span className="rounded bg-violet-500/15 p-1 text-violet-300"><ScissorsLineDashed className="h-3 w-3" /></span>
                <span className="rounded p-1"><Magnet className="h-3 w-3" /></span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-600">
                <ZoomIn className="h-3 w-3" />
                <div className="h-1 w-20 rounded-full bg-white/10">
                  <div className="h-1 w-3/5 rounded-full bg-violet-400/70" />
                </div>
              </div>
            </div>
            {/* ruler */}
            <div className="relative mx-3 mb-1 h-3.5 border-b border-white/8">
              {[0, 1, 2, 3, 4, 5, 6].map((s) => (
                <span key={s} className="absolute top-0 font-mono text-[8px] text-zinc-600" style={{ left: `${s * 14}%` }}>
                  {s === 0 ? "0:00" : `0:${s}0`}
                </span>
              ))}
              {/* playhead */}
              <div className="absolute -top-0.5 bottom-0 left-[38%] w-px bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.9)]">
                <div className="absolute -left-[5px] -top-1 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-violet-400" />
              </div>
            </div>
            {/* video track */}
            <div className="relative mx-3 mb-1.5 flex h-9 gap-1 overflow-hidden rounded-md">
              <div className="relative h-full w-[24%] overflow-hidden rounded-md bg-gradient-to-br from-sky-600/70 to-indigo-700/70">
                <span className="absolute bottom-0.5 left-1.5 flex items-center gap-1 text-[8px] text-white/85"><ImageIcon className="h-2 w-2" />drone_shot.mp4</span>
              </div>
              <div className="relative h-full w-[30%] overflow-hidden rounded-md bg-gradient-to-br from-violet-600/70 to-fuchsia-700/60">
                <span className="absolute bottom-0.5 left-1.5 flex items-center gap-1 text-[8px] text-white/85"><ImageIcon className="h-2 w-2" />waterfall.mp4</span>
              </div>
              <div className="relative h-full w-[22%] overflow-hidden rounded-md bg-gradient-to-br from-amber-500/60 to-rose-600/60">
                <span className="absolute bottom-0.5 left-1.5 flex items-center gap-1 text-[8px] text-white/85"><ImageIcon className="h-2 w-2" />golden.mp4</span>
              </div>
              <div className="relative h-full w-[16%] overflow-hidden rounded-md bg-gradient-to-br from-emerald-600/60 to-teal-700/60">
                <span className="absolute bottom-0.5 left-1.5 flex items-center gap-1 text-[8px] text-white/85"><Type className="h-2 w-2" />Title</span>
              </div>
            </div>
            {/* audio track with waveform */}
            <div className="relative mx-3 mb-3 h-8 overflow-hidden rounded-md border border-emerald-400/15 bg-emerald-950/30">
              <div className="flex h-full items-center gap-[2px] px-1.5 opacity-80">
                {WAVEFORM_BARS.slice(0, 40).map((h, i) => (
                  <span
                    key={i}
                    className="w-full max-w-[4px] shrink rounded-sm bg-gradient-to-t from-emerald-500/70 to-emerald-300/80"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <span className="absolute bottom-0.5 left-1.5 flex items-center gap-1 text-[8px] text-emerald-200/70"><Music className="h-2 w-2" />ambient_score.wav</span>
            </div>
          </div>
        </div>

        {/* Right properties rail */}
        <div className="hidden w-32 flex-col gap-2.5 border-l border-white/8 p-3 lg:flex">
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
                <div className="h-1 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${p.value}%` }} />
              </div>
            </div>
          ))}
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {[Crop, Gauge, Palette, Mic].map((Icon, i) => (
              <span key={i} className="flex items-center justify-center rounded-md border border-white/8 bg-white/[0.03] py-2 text-zinc-500">
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
      {/* Cinematic background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black,transparent)]" />
        <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[140px] animate-pulse-glow" />
        <div className="absolute right-[8%] top-[30%] h-[300px] w-[300px] rounded-full bg-cyan-500/12 blur-[110px]" />
        <div className="absolute left-[4%] top-[55%] h-[260px] w-[260px] rounded-full bg-indigo-600/14 blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 py-1.5 pl-1.5 pr-4 text-xs text-violet-200">
            <span className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-400 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">New</span>
            AI script-to-storyboard & real text-to-video generation
          </div>

          <h1 className="animate-fade-up font-display mt-7 text-[2.6rem] font-bold leading-[1.06] tracking-tight text-white sm:text-6xl lg:text-[4.6rem]" style={{ animationDelay: "80ms" }}>
            Your Vision. <span className="text-gradient">Your Story.</span>
            <br />
            Your Masterpiece.
          </h1>

          <p className="animate-fade-up mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg" style={{ animationDelay: "160ms" }}>
            Edit videos professionally, create cinematic content, and transform your ideas into
            stunning videos with powerful AI tools — right in your browser.
          </p>

          <div className="animate-fade-up mt-9 flex flex-col items-center justify-center gap-3.5 sm:flex-row" style={{ animationDelay: "240ms" }}>
            <GradientButton onClick={startCreating} className="h-12 px-8 text-base">
              Start Creating for Free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </GradientButton>
            <GhostButton
              className="h-12 px-8 text-base"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              Explore Features
            </GhostButton>
          </div>

          <div className="animate-fade-up mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-2.5 text-xs text-zinc-500" style={{ animationDelay: "320ms" }}>
            {TRUST_ITEMS.map((t) => (
              <span key={t.label} className="inline-flex items-center gap-1.5">
                <t.icon className="h-3.5 w-3.5 text-violet-400/80" /> {t.label}
              </span>
            ))}
          </div>
        </div>

        {/* Editor preview */}
        <div className="animate-fade-up relative mx-auto mt-16 max-w-5xl" style={{ animationDelay: "420ms" }}>
          <div className="pointer-events-none absolute -inset-8 rounded-[36px] bg-gradient-to-r from-violet-600/15 via-indigo-500/10 to-cyan-400/15 blur-2xl" aria-hidden />
          <EditorPreview />
          <p className="mt-4 text-center text-[11px] text-zinc-600">
            Preview of the VisionCut editing studio — every control below is fully functional.
          </p>
        </div>
      </div>
    </section>
  );
}
