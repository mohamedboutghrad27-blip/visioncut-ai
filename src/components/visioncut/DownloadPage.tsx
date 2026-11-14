"use client";

import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/visioncut/landing/Navbar";
import { Footer } from "@/components/visioncut/landing/Footer";
import { Reveal } from "@/components/visioncut/shared";
import { useRouter } from "@/lib/router";
import {
  Apple,
  ArrowRight,
  AppWindow,
  Check,
  Copy,
  Download,
  FolderDown,
  Globe,
  Laptop,
  Monitor,
  Save,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";

const VERSION = "1.0.0";
const SOURCE_URL = "/downloads/visioncut-desktop-source.zip";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button
      onClick={copy}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/* ------------------------------------------------------------------ */

const INSTALL_STEPS = [
  { os: "Chrome", steps: ["Open visioncut in a Chrome or Chromium browser.", "Click the install icon in the address bar (or ⋮ menu → “Install page as app”).", "Confirm — VisionCut opens in its own window with the app icon."] },
  { os: "Microsoft Edge", steps: ["Open visioncut in Edge.", "Settings → Apps → “Install this site as an app”.", "Confirm — it gets its own window, Start-menu entry and icon."] },
  { os: "macOS Safari / others", steps: ["Safari supports Add to Dock (File → Add to Dock).", "Firefox users: use the Electron build below or any Chromium browser for install."] },
];

const PLATFORMS = [
  { icon: AppWindow, os: "Windows 10+", target: "NSIS installer (.exe)", cmd: "npm run dist:win" },
  { icon: Apple, os: "macOS 12+", target: "DMG — Apple Silicon & Intel", cmd: "npm run dist:mac" },
  { icon: Terminal, os: "Linux x64", target: "AppImage + .deb", cmd: "npm run dist:linux" },
];

const SHELL_FEATURES = [
  { icon: Monitor, title: "Native window", text: "The full studio at 1440×900 in a real desktop window — no browser tabs, no distractions." },
  { icon: Save, title: "Native save dialogs", text: "Video and media exports go straight to your system “Save as” dialog and your Downloads folder." },
  { icon: Globe, title: "Links behave", text: "External links open in your default browser; the app itself stays on VisionCut only." },
  { icon: ShieldCheck, title: "Always current", text: "The shell loads the same production web app, so every release reaches desktop without reinstalling." },
];

/* ------------------------------------------------------------------ */

export function DownloadPage() {
  const router = useRouter();
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setIsStandalone(!!standalone);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pb-10 pt-32 sm:pt-36">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black,transparent)]" />
            <div className="absolute left-1/2 top-0 h-[380px] w-[680px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-[130px]" />
          </div>
          <Reveal className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <span className="inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
              <span className="inline-block h-1 w-1 rounded-full bg-zinc-600" aria-hidden />
              Desktop App
            </span>
            <h1 className="font-display mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
              VisionCut on your <span className="text-gradient">desktop</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              Same studio, same projects, same AI — in a dedicated window with its own dock icon. Install in one click,
              or build the native shell from source.
            </p>
            {isStandalone && (
              <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-300">
                <Check className="h-4 w-4" /> You are already running the installed desktop app.
              </p>
            )}
          </Reveal>
        </section>

        {/* Option A — PWA */}
        <section className="mx-auto max-w-5xl px-4 pb-4 sm:px-6">
          <Reveal>
            <div className="overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-b from-white/[0.05] to-transparent p-8 sm:p-10">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-zinc-100">
                  <Laptop className="h-5.5 w-5.5" />
                </span>
                <div>
                  <h2 className="font-display text-2xl font-bold text-white">Install as an app — one click</h2>
                  <p className="text-sm text-zinc-500">Recommended · Windows, macOS, Linux & ChromeOS · zero download</p>
                </div>
                <span className="ml-auto rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  Works today
                </span>
              </div>
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
                VisionCut is an installable web app (PWA). Installing pins it to your taskbar/dock, gives it its own
                window and app icon, and keeps your account, projects and cloud library in sync automatically.
              </p>
              <div className="mt-7 grid gap-4 md:grid-cols-3">
                {INSTALL_STEPS.map((b, i) => (
                  <div key={b.os} className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                    <p className="font-display text-sm font-semibold text-white">
                      <span className="mr-2 font-mono text-zinc-600">{String(i + 1).padStart(2, "0")}</span>
                      {b.os}
                    </p>
                    <ul className="mt-3 space-y-2">
                      {b.steps.map((s, j) => (
                        <li key={j} className="flex gap-2.5 text-[13px] leading-relaxed text-zinc-400">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" aria-hidden />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* Option B — Electron shell */}
        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <Reveal>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Native shell (Electron)</h2>
              <span className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 font-mono text-xs text-zinc-400">
                v{VERSION} · MIT
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
              For a classic installer with native menus and system save dialogs. The shell source is free — build the
              installer for your platform with one command (Node.js 18+ required).
            </p>
          </Reveal>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {PLATFORMS.map((p, i) => (
              <Reveal key={p.os} delay={i * 70}>
                <div className="flex h-full flex-col rounded-2xl border border-white/8 bg-white/[0.025] p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-display mt-4 text-lg font-semibold text-white">{p.os}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{p.target}</p>
                  <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-black/50 px-3 py-2">
                    <code className="font-mono text-[12px] text-zinc-300">$ {p.cmd}</code>
                    <CopyButton text={`cd desktop && npm install && ${p.cmd}`} label="Build command" />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-6" delay={80}>
            <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:flex-row sm:items-center">
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-200">
                  <FolderDown className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-base font-semibold text-white">Download the shell source</h3>
                  <p className="mt-1 max-w-md text-sm text-zinc-400">
                    ZIP with everything inside — main process, safe preload bridge, electron-builder config, app icon and
                    a bilingual build guide. Unzip, then <code className="font-mono text-[12px] text-zinc-300">cd desktop &amp;&amp; npm install</code>.
                  </p>
                </div>
              </div>
              <a
                href={SOURCE_URL}
                download
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-[#ededf2] px-6 text-sm font-medium text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-all hover:bg-white"
              >
                <Download className="h-4 w-4" /> visioncut-desktop-source.zip
              </a>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              Installers are produced per release with electron-builder (unsigned for now — Windows may show a
              SmartScreen prompt; macOS needs a right-click → Open on first launch). Signed, auto-updating builds are on
              the roadmap.
            </p>
          </Reveal>
        </section>

        {/* What the shell adds */}
        <section className="border-t border-white/6 py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <Reveal>
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">What the native shell adds</h2>
            </Reveal>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {SHELL_FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={i * 70}>
                  <div className="flex h-full gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-6">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300">
                      <f.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-display text-base font-semibold text-white">{f.title}</h3>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-400">{f.text}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-8" delay={60}>
              <p className="text-sm leading-relaxed text-zinc-400">
                Requirements: <strong className="text-zinc-200">Windows</strong> 10+ (x64) ·{" "}
                <strong className="text-zinc-200">macOS</strong> 12+ (Apple Silicon &amp; Intel) ·{" "}
                <strong className="text-zinc-200">Linux</strong> x64 (AppImage or .deb) · building needs{" "}
                <strong className="text-zinc-200">Node.js 18+</strong>. The PWA route has no requirements beyond a
                Chromium-based browser.
              </p>
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-white/6 py-20 text-center">
          <Reveal>
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Not installing? The studio is right here.</h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] text-zinc-400">
              The full editor runs in any modern browser — nothing to download, nothing to update.
            </p>
            <button
              onClick={() => router.navigate("/signup")}
              className="mt-7 inline-flex h-12 items-center gap-2 rounded-lg bg-gradient-to-b from-[#4b4b52] to-[#2a2a30] px-8 text-base font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-transform hover:scale-[1.02]"
            >
              Start editing free <ArrowRight className="h-4 w-4" />
            </button>
          </Reveal>
        </section>
      </main>
      <Footer />
    </div>
  );
}
