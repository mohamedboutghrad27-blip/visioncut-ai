"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/* ---------------- Logo ---------------- */

export function Logo({ size = "md", withWordmark = true }: { size?: "sm" | "md" | "lg"; withWordmark?: boolean }) {
  const dims = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const text = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <span className={cn("relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 shadow-[0_0_18px_rgba(139,92,246,0.45)]", dims)}>
        <svg viewBox="0 0 24 24" fill="none" className="h-[58%] w-[58%] text-white" aria-hidden>
          <path d="M4 5h3.2L10 14.4 12.8 5H16l-4.4 13H8.4L4 5z" fill="currentColor" />
          <circle cx="17.4" cy="16.6" r="2.1" fill="currentColor" opacity="0.9" />
        </svg>
      </span>
      {withWordmark && (
        <span className={cn("font-display font-semibold tracking-tight text-white", text)}>
          VisionCut <span className="text-gradient">AI</span>
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
      <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">
        {eyebrow}
      </span>
      <h2 className="font-display mt-5 text-3xl font-bold leading-[1.12] text-white sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {description && <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">{description}</p>}
    </Reveal>
  );
}

/* ---------------- Buttons ---------------- */

export function GradientButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return (
    <button
      {...props}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-400 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:shadow-[0_8px_40px_-6px_rgba(139,92,246,0.65)] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
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
        "inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-zinc-200 transition-all duration-300 hover:border-violet-400/40 hover:bg-white/[0.08] hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
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
        "inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300",
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
  "from-violet-600/50 via-indigo-600/30 to-cyan-500/30",
  "from-cyan-500/40 via-blue-600/30 to-violet-600/40",
  "from-fuchsia-500/40 via-purple-600/30 to-indigo-500/30",
  "from-amber-500/35 via-rose-500/30 to-purple-600/30",
  "from-emerald-500/35 via-teal-500/30 to-cyan-500/40",
  "from-blue-500/40 via-violet-500/30 to-fuchsia-500/30",
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
