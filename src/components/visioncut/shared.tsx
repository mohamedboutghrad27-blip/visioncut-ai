"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/* ---------------- Logo ---------------- */

export function Logo({ size = "md", withWordmark = true }: { size?: "sm" | "md" | "lg"; withWordmark?: boolean }) {
  const dims = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const text = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      {/* Monochrome mark: white glyph on near-black tile, hairline border (Resend-style) */}
      <span
        className={cn(
          "relative inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          dims
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-[58%] w-[58%] text-white" aria-hidden>
          <path d="M4 5h3.2L10 14.4 12.8 5H16l-4.4 13H8.4L4 5z" fill="currentColor" />
          <circle cx="17.4" cy="16.6" r="2.1" fill="currentColor" opacity="0.9" />
        </svg>
      </span>
      {withWordmark && (
        <span className={cn("font-display font-semibold tracking-tight text-white", text)}>
          VisionCut <span className="text-zinc-400">AI</span>
        </span>
      )}
    </span>
  );
}

/* ---------------- Reveal on scroll ---------------- */

export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: React.ElementType;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add("vc-revealed");
            io.disconnect();
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={cn("vc-reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/* ---------------- Section heading ---------------- */

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <Reveal className={cn("max-w-3xl", align === "center" ? "mx-auto text-center" : "text-left")}>
      {/* Resend-style eyebrow: quiet mono label instead of a colored pill */}
      <span className="inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
        <span className="inline-block h-1 w-1 rounded-full bg-zinc-600" aria-hidden />
        {eyebrow}
      </span>
      <h2 className="font-display mt-5 text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {description && <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg text-pretty">{description}</p>}
    </Reveal>
  );
}

/* ---------------- Buttons (Resend-style: white primary / hairline ghost) ---------------- */

export function GradientButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return (
    <button
      {...props}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 rounded-lg bg-[#ededf2] px-6 py-3 text-sm font-medium text-black shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.6)] transition-all duration-200 hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.02] px-6 py-3 text-sm font-medium text-zinc-200 transition-all duration-200 hover:border-white/25 hover:bg-white/[0.06] hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

/* ---------------- Sample-content badge ---------------- */

export function SampleBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400",
        className
      )}
      title="This is sample content shown for demonstration purposes"
    >
      Sample
    </span>
  );
}

/* ---------------- Thumbnail placeholder (cinematic, deterministic) ---------------- */

const THUMB_GRADIENTS = [
  "from-zinc-700/40 via-zinc-800/40 to-zinc-950",
  "from-slate-700/40 via-slate-800/40 to-zinc-950",
  "from-neutral-600/35 via-neutral-800/45 to-zinc-950",
  "from-stone-600/30 via-stone-800/40 to-zinc-950",
  "from-zinc-600/35 via-zinc-800/45 to-zinc-950",
  "from-slate-600/30 via-neutral-800/45 to-zinc-950",
];

export function ThumbGradient({ seed, className }: { seed: string; className?: string }) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const g = THUMB_GRADIENTS[hash % THUMB_GRADIENTS.length];
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-zinc-950", className)}>
      <div className={cn("absolute inset-0 bg-gradient-to-br", g)} />
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-[10px] font-medium text-white/60">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
        PREVIEW
      </div>
    </div>
  );
}
