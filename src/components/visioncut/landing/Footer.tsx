"use client";

import React, { useState } from "react";
import { Logo, Reveal } from "@/components/visioncut/shared";
import { useRouter } from "@/lib/router";
import { useAuth } from "@/components/visioncut/AuthContext";
import { toast } from "sonner";
import { GradientButton } from "@/components/visioncut/shared";
import { Youtube, Twitter, Instagram, Github, ArrowRight, Send } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const PRODUCT_LINKS = [
  { label: "Features", href: "/" as const, section: "features" },
  { label: "AI Tools", href: "/" as const, section: "ai-tools" },
  { label: "Templates", href: "/templates" },
  { label: "Pricing", href: "/pricing" },
];

const RESOURCE_LINKS = [
  { label: "Help & Documentation", href: "/help" },
  { label: "Editor Guide", href: "/help" },
  { label: "Supported Formats", href: "/help" },
  { label: "Contact Support", href: "/help" },
];

export function FinalCta() {
  const router = useRouter();
  const { user } = useAuth();
  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-1/2 h-[380px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/15 blur-[130px]" />
      </div>
      <Reveal className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="font-display text-3xl font-bold leading-tight text-white sm:text-5xl">
          Your Next Great Video <span className="text-gradient">Starts Here.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base text-zinc-400 sm:text-lg">
          Join creators turning ideas into cinematic videos with professional tools and AI superpowers.
        </p>
        <div className="mt-9 flex justify-center">
          <GradientButton className="h-12 px-9 text-base" onClick={() => router.navigate(user ? "/dashboard" : "/signup")}>
            Start Creating for Free <ArrowRight className="h-4 w-4" />
          </GradientButton>
        </div>
        <p className="mt-4 text-xs text-zinc-600">No credit card required · Free plan available</p>
      </Reveal>
    </section>
  );
}

export function Footer() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState<"idle" | "error" | "ok">("idle");

  const subscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setSubscribed("error");
      return;
    }
    setSubscribed("ok");
    setEmail("");
    toast.success("You're on the list!", { description: "Product updates will arrive at your inbox. (Demo subscription — no email is actually sent.)" });
  };

  const go = (href: string, section?: string | null) => {
    if (section) {
      if (router.route.path !== "/") router.navigate("/");
      setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: "smooth" }), router.route.path !== "/" ? 150 : 0);
    } else {
      router.navigate(href);
      window.scrollTo({ top: 0 });
    }
  };

  return (
    <footer className="border-t border-white/8 bg-[#07070c]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2 md:col-span-2">
            <Logo size="lg" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
              Create stunning videos. Turn every idea into reality with professional browser-based editing and AI creation tools.
            </p>
            <form onSubmit={subscribe} className="mt-6" aria-label="Newsletter subscription">
              <label htmlFor="newsletter-email" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Product updates
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="newsletter-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSubscribed("idle");
                  }}
                  placeholder="you@studio.com"
                  className={`w-full max-w-xs rounded-lg border bg-black/40 px-3.5 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none transition-colors ${
                    subscribed === "error" ? "border-rose-500/60" : "border-white/10 focus:border-violet-400/50"
                  }`}
                />
                <button
                  type="submit"
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-400 px-4 text-sm font-semibold text-white transition-all hover:brightness-110"
                >
                  <Send className="h-3.5 w-3.5" /> Subscribe
                </button>
              </div>
              {subscribed === "error" && <p className="mt-2 text-xs text-rose-400">Please enter a valid email address.</p>}
              {subscribed === "ok" && <p className="mt-2 text-xs text-emerald-400">Subscribed — see you in your inbox!</p>}
            </form>
          </div>

          <nav aria-label="Product">
            <p className="text-sm font-semibold text-white">Product</p>
            <ul className="mt-4 space-y-2.5">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.label}>
                  <button onClick={() => go(l.href, l.section)} className="text-sm text-zinc-500 transition-colors hover:text-white">
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Resources">
            <p className="text-sm font-semibold text-white">Resources</p>
            <ul className="mt-4 space-y-2.5">
              {RESOURCE_LINKS.map((l) => (
                <li key={l.label}>
                  <button onClick={() => go(l.href)} className="text-sm text-zinc-500 transition-colors hover:text-white">
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Legal">
            <p className="text-sm font-semibold text-white">Legal</p>
            <ul className="mt-4 space-y-2.5">
              <li><button onClick={() => router.navigate("/help")} className="text-sm text-zinc-500 hover:text-white">Privacy Policy</button></li>
              <li><button onClick={() => router.navigate("/help")} className="text-sm text-zinc-500 hover:text-white">Terms of Service</button></li>
              <li><button onClick={() => router.navigate("/settings")} className="text-sm text-zinc-500 hover:text-white">Account Settings</button></li>
            </ul>
            <div className="mt-5 flex gap-3">
              {[
                { Icon: Youtube, label: "VisionCut AI on YouTube" },
                { Icon: Twitter, label: "VisionCut AI on X" },
                { Icon: Instagram, label: "VisionCut AI on Instagram" },
                { Icon: Github, label: "VisionCut AI on GitHub" },
              ].map(({ Icon, label }) => (
                <button
                  key={label}
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-zinc-500 transition-all hover:border-violet-400/40 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/6 pt-7 sm:flex-row">
          <p className="text-xs text-zinc-600">© 2026 VisionCut AI. All rights reserved.</p>
          <p className="text-xs text-zinc-700">Crafted for creators · Early access build</p>
        </div>
      </div>
    </footer>
  );
}
