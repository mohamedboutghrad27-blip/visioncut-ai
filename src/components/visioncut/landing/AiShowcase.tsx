"use client";

import React, { useEffect, useRef, useState } from "react";
import { SectionHeading, Reveal } from "@/components/visioncut/shared";
import { useRouter } from "@/lib/router";
import { useAuth } from "@/components/visioncut/AuthContext";
import { cn } from "@/lib/utils";
import { Sparkles, ArrowRight, Info } from "lucide-react";
import { GradientButton } from "@/components/visioncut/shared";

const STYLES = [
  { id: "cinematic", label: "Cinematic", desc: "Filmic light, shallow depth", gradient: "from-indigo-900 via-violet-950 to-black" },
  { id: "anime", label: "Anime", desc: "Bold lines, vivid color", gradient: "from-pink-900 via-rose-950 to-black" },
  { id: "3d", label: "3D Render", desc: "Soft studio lighting", gradient: "from-sky-900 via-blue-950 to-black" },
  { id: "documentary", label: "Documentary", desc: "Natural, grounded look", gradient: "from-amber-900 via-stone-900 to-black" },
  { id: "retro", label: "Retro VHS", desc: "Analog grain & glow", gradient: "from-fuchsia-900 via-purple-950 to-black" },
];

type Phase = "idle" | "writing" | "designing" | "generating" | "composing" | "done";

const PHASES: { id: Phase; label: string; detail: string }[] = [
  { id: "writing", label: "Interpreting your prompt", detail: "Breaking the idea into scenes and beats…" },
  { id: "designing", label: "Storyboarding", detail: "Framing shots, pacing and transitions…" },
  { id: "generating", label: "Generating visuals", detail: "Rendering each scene in the selected style…" },
  { id: "composing", label: "Composing the cut", detail: "Syncing narration, captions and music…" },
];

const SAMPLE_PROMPT = "A drone flies over misty mountains at sunrise, revealing a hidden waterfall as a voice-over reflects on adventure.";

function PipelinePreview({ prompt, style, phase }: { prompt: string; style: string; phase: Phase }) {
  const activeIndex = PHASES.findIndex((p) => p.id === phase);
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a]">
      {/* preview viewport */}
      <div className="relative aspect-video w-full overflow-hidden">
        <div className={cn("absolute inset-0 bg-gradient-to-br transition-all duration-1000", STYLES.find((s) => s.id === style)?.gradient)} />
        <div className="absolute inset-0 bg-dots opacity-20" />
        {phase === "idle" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500">
            <Sparkles className="h-8 w-8 text-zinc-600" />
            <p className="text-sm">Your generated preview appears here</p>
            <p className="max-w-xs text-center text-[11px] text-zinc-600">
              This demo visualizes the AI workflow. Sign in to generate real storyboards, images and videos.
            </p>
          </div>
        ) : (
          <>
            {/* simulated scenes */}
            <div className="absolute inset-0 flex">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-full flex-1 border-r border-white/5 transition-all duration-700",
                    phase === "done" || activeIndex >= 2 ? "opacity-100" : "opacity-20",
                  )}
                  style={{
                    background:
                      i === 0
                        ? "radial-gradient(ellipse at 30% 60%, rgba(255,255,255,0.28), transparent 60%)"
                        : i === 1
                          ? "radial-gradient(ellipse at 70% 30%, rgba(255,255,255,0.22), transparent 55%)"
                          : "radial-gradient(ellipse at 50% 80%, rgba(255,255,255,0.18), transparent 55%)",
                  }}
                >
                  <span className="absolute left-1/2 top-4 -translate-x-1/2 rounded bg-black/40 px-1.5 py-0.5 text-[9px] text-white/70">
                    Scene {i + 1}
                  </span>
                </div>
              ))}
            </div>
            {/* caption bar */}
            <div className="absolute bottom-4 left-1/2 max-w-[85%] -translate-x-1/2 rounded-lg bg-black/60 px-3 py-1.5 text-center text-[11px] text-white/90 backdrop-blur-sm">
              {phase === "done" || activeIndex >= 3 ? prompt.slice(0, 68) + (prompt.length > 68 ? "…" : "") : "…"}
            </div>
            {/* audio bars */}
            <div className="absolute right-3 top-3 flex items-end gap-0.5">
              {[3, 6, 4, 8, 5].map((h, i) => (
                <span
                  key={i}
                  className="w-1 rounded-sm bg-white/70"
                  style={{ height: `${phase === "done" || activeIndex >= 3 ? h * 2 : 2}px`, transition: "height .6s" }}
                />
              ))}
            </div>
          </>
        )}
        {/* progress shimmer */}
        {phase !== "idle" && phase !== "done" && (
          <div className="absolute inset-x-0 top-0 h-0.5 bg-white/10">
            <div
              className="h-full bg-white/80 transition-all duration-1000"
              style={{ width: `${((activeIndex + 1) / (PHASES.length + 1)) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* pipeline steps */}
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
        {PHASES.map((p, i) => {
          const state = phase === "idle" ? "pending" : activeIndex > i || phase === "done" ? "done" : activeIndex === i ? "active" : "pending";
          return (
            <div
              key={p.id}
              className={cn(
                "rounded-lg border p-3 transition-all duration-500",
                state === "done" && "border-white/15 bg-white/[0.04]",
                state === "active" && "border-white/35 bg-white/[0.07]",
                state === "pending" && "border-white/[0.08] bg-white/[0.01] opacity-50"
              )}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    state === "done" ? "bg-zinc-300" : state === "active" ? "animate-pulse bg-white" : "bg-zinc-600"
                  )}
                />
                <span className={cn("text-[11px] font-medium", state === "pending" ? "text-zinc-500" : "text-white")}>{p.label}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-zinc-500">{p.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AiShowcase() {
  const router = useRouter();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [phase, setPhase] = useState<Phase>("idle");
  const [displayPrompt, setDisplayPrompt] = useState(SAMPLE_PROMPT);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const runDemo = () => {
    timers.current.forEach(clearTimeout);
    const text = prompt.trim() || SAMPLE_PROMPT;
    setDisplayPrompt(text);
    setPhase("writing");
    PHASES.slice(1).forEach((p, i) => {
      timers.current.push(setTimeout(() => setPhase(p.id), 1400 * (i + 1)));
    });
    timers.current.push(setTimeout(() => setPhase("done"), 1400 * PHASES.length + 600));
  };

  return (
    <section id="ai-tools" className="relative scroll-mt-20 border-t border-white/[0.08] py-24 lg:py-32">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-white/[0.04] blur-[130px]" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="AI Creation"
          title={<>Describe it. <span className="text-gradient">Watch it come together.</span></>}
          description="See how a prompt becomes a storyboard, visuals and a finished cut inside VisionCut AI."
        />

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Controls */}
          <Reveal className="lg:col-span-2">
            <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6">
              <label htmlFor="ai-demo-prompt" className="text-sm font-medium text-white">
                Describe your video idea
              </label>
              <textarea
                id="ai-demo-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={SAMPLE_PROMPT}
                rows={4}
                maxLength={400}
                className="scrollbar-slim mt-3 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-3.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
              />
              <p className="mt-1.5 font-mono text-[11px] text-zinc-600">{prompt.length}/400 characters</p>

              <p className="mt-5 text-sm font-medium text-white">Visual style</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    title={s.desc}
                    className={cn(
                      "group rounded-lg border p-2.5 text-left transition-all duration-200",
                      style === s.id
                        ? "border-white/40 bg-white/[0.05]"
                        : "border-white/10 bg-white/[0.01] hover:border-white/25"
                    )}
                  >
                    <span className={cn("mb-2 block h-8 w-full rounded-md bg-gradient-to-br", s.gradient)} />
                    <span className={cn("text-xs font-medium", style === s.id ? "text-white" : "text-zinc-400")}>{s.label}</span>
                  </button>
                ))}
              </div>

              <GradientButton onClick={runDemo} className="mt-6 w-full">
                <Sparkles className="h-4 w-4" /> Preview the AI Workflow
              </GradientButton>

              <div className="mt-4 flex gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  This is a <strong className="font-semibold text-zinc-300">simulated preview</strong> that illustrates the workflow — no media is generated here.
                  {user ? " Use the AI panel inside the editor to generate real storyboards, images and videos." : " Sign in and open the editor to generate real storyboards, images and videos."}
                </p>
              </div>
            </div>
          </Reveal>

          {/* Preview */}
          <Reveal className="lg:col-span-3" delay={120}>
            <PipelinePreview prompt={displayPrompt} style={style} phase={phase} />
            <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.015] p-4 sm:flex-row sm:items-center">
              <p className="text-sm text-zinc-400">
                Ready to create the real thing? The editor includes script-to-video, TTS voiceover and speech-to-text captions.
              </p>
              <GradientButton
                className="shrink-0 px-5 py-2.5 text-[13px]"
                onClick={() => router.navigate(user ? "/dashboard" : "/signup")}
              >
                Open the studio <ArrowRight className="h-3.5 w-3.5" />
              </GradientButton>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
