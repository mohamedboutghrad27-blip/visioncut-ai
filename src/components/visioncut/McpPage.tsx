"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/visioncut/landing/Navbar";
import { Footer } from "@/components/visioncut/landing/Footer";
import { Reveal } from "@/components/visioncut/shared";
import { Check, Copy, Terminal, ShieldCheck, Cpu, Workflow, FolderKanban, Clapperboard } from "lucide-react";
import { toast } from "sonner";

const SITE = "https://visioncut-ai-mu.vercel.app";
const ENDPOINT = `${SITE}/api/mcp`;

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

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/60">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-zinc-500">{label}</span>
        <CopyButton text={code} label={label} />
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[12.5px] leading-relaxed text-zinc-300">{code}</pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const TOOL_GROUPS: { icon: React.ElementType; group: string; blurb: string; tools: { name: string; desc: string }[] }[] = [
  {
    icon: FolderKanban,
    group: "Status & projects",
    blurb: "Read state before you write.",
    tools: [
      { name: "visioncut_status", desc: "Which engines are configured (video, image, voiceover, LLM, stickers), balances and the project count. Call this first." },
      { name: "visioncut_list_projects", desc: "List projects with name, aspect ratio, track/clip counts and last-updated time." },
      { name: "visioncut_get_project", desc: "Read a project's full timeline — every clip id, track, type, start, duration and asset id." },
    ],
  },
  {
    icon: Cpu,
    group: "AI generation",
    blurb: "The same engines the editor uses.",
    tools: [
      { name: "visioncut_generate_storyboard", desc: "Script → production-ready storyboard: 3–6 scenes with visuals, narration, captions, durations and image prompts." },
      { name: "visioncut_generate_image", desc: "Text → image (16:9, 9:16, 1:1, 4:5, 21:9). Saved to the cloud library with an asset_id ready for the timeline." },
      { name: "visioncut_generate_voiceover", desc: "Text → speech in 600+ languages including Arabic, 6 voices, fast/hd quality. Returns an audio asset_id." },
      { name: "visioncut_start_video", desc: "Start a text-to-video task (5 or 10s, aspect_ratio incl. 9:16). Returns a task_id immediately." },
      { name: "visioncut_check_video", desc: "Poll a video task — PENDING, SUCCESS with the MP4 URL, or FAILED with the reason." },
      { name: "visioncut_search_stickers", desc: "Search 1800+ transparent-PNG stickers (OpenMoji). Arabic, English and emoji queries all work." },
    ],
  },
  {
    icon: Clapperboard,
    group: "Timeline editing",
    blurb: "Full write access to the editor.",
    tools: [
      { name: "visioncut_create_project", desc: "Create a project in the user's dashboard, aspect-ratio aware (state matches the canvas)." },
      { name: "visioncut_import_media", desc: "Download a public MP4 / image / audio URL into the cloud library (200MB max) → returns an asset_id." },
      { name: "visioncut_add_to_project", desc: "Place an asset on the timeline — video or audio track, at_seconds and duration, appended to the track end by default." },
      { name: "visioncut_update_clip", desc: "Re-time or move an existing clip — fix durations or lay scenes back-to-back." },
      { name: "visioncut_remove_clip", desc: "Delete a clip; later clips on the same track shift left to close the gap (optional)." },
    ],
  },
];

const WORKFLOW = [
  { call: "visioncut_status", note: "see which engines are live" },
  { call: "visioncut_create_project", note: `{ name: "Launch Teaser", aspect_ratio: "9:16" }` },
  { call: "visioncut_start_video", note: `{ prompt: "…", aspect_ratio: "9:16" } → task_id` },
  { call: "visioncut_check_video", note: "poll until SUCCESS → MP4 URL" },
  { call: "visioncut_import_media", note: `{ url: "https://….mp4", duration_seconds: 5 } → as_…` },
  { call: "visioncut_add_to_project", note: `{ project_id, media_id: "as_…", duration: 5 }` },
  { call: "visioncut_get_project", note: "verify the placement" },
];

const INIT_SNIPPET = `curl -s ${ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{
    "jsonrpc": "2.0", "id": 1, "method": "initialize",
    "params": { "protocolVersion": "2025-06-18", "capabilities": {} }
  }'`;

const CALL_SNIPPET = `curl -s ${ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{
    "jsonrpc": "2.0", "id": 2,
    "method": "tools/call",
    "params": {
      "name": "visioncut_create_project",
      "arguments": { "name": "Launch Teaser", "aspect_ratio": "9:16" }
    }
  }'`;

const CLAUDE_CODE_SNIPPET = `claude mcp add --transport http visioncut \\
  "${ENDPOINT}?key=YOUR_MCP_TOKEN"`;

const DESKTOP_CONFIG = `{
  "mcpServers": {
    "visioncut": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${ENDPOINT}?key=YOUR_MCP_TOKEN"]
    }
  }
}`;

/* ------------------------------------------------------------------ */

export function McpPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pb-8 pt-32 sm:pt-36">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black,transparent)]" />
            <div className="absolute left-1/2 top-0 h-[380px] w-[680px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-[130px]" />
          </div>
          <Reveal className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <span className="inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
              <span className="inline-block h-1 w-1 rounded-full bg-zinc-600" aria-hidden />
              MCP Integration
            </span>
            <h1 className="font-display mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
              Connect Claude to <span className="text-gradient">VisionCut</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              VisionCut ships a remote MCP (Model Context Protocol) server. Add it once and Claude can storyboard scripts,
              generate images, voiceovers and video, create projects and place clips on real timelines — the same engines
              the editor uses, driven from the chat.
            </p>
          </Reveal>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-5xl px-4 pb-4 sm:px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Workflow, title: "1 · Connect", text: "Register the endpoint below as a custom connector in claude.ai, Claude Desktop or Claude Code." },
              { icon: Terminal, title: "2 · Prompt", text: "Ask Claude in plain language: \u201cbuild a 9:16 teaser and put it on my timeline\u201d. It calls the tools itself." },
              { icon: FolderKanban, title: "3 · Open the editor", text: "Every project and clip Claude creates is visible in your VisionCut dashboard and editor immediately." },
            ].map((s, i) => (
              <Reveal key={s.title} delay={i * 80}>
                <div className="h-full rounded-2xl border border-white/8 bg-white/[0.025] p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <h2 className="font-display mt-4 text-lg font-semibold text-white">{s.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Endpoint */}
        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <Reveal>
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">The endpoint</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
              JSON-RPC 2.0 over Streamable HTTP, stateless — plain JSON responses, no SSE session to manage. Supported
              protocol versions: 2024-11-05, 2025-03-26, 2025-06-18. Authenticate with the token in the{" "}
              <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[13px] text-zinc-200">?key=</code> query
              parameter or an{" "}
              <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[13px] text-zinc-200">Authorization: Bearer</code>{" "}
              header.
            </p>
          </Reveal>
          <Reveal className="mt-6" delay={60}>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/[0.03] px-5 py-4">
              <code className="min-w-0 break-all font-mono text-[13.5px] text-zinc-200">{ENDPOINT}?key=YOUR_MCP_TOKEN</code>
              <CopyButton text={`${ENDPOINT}?key=YOUR_MCP_TOKEN`} label="Endpoint URL" />
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
              Keep your token private — it grants full access to AI engines and your projects. Treat it like a password;
              rotate it by changing the server&apos;s MCP_TOKEN. This page never embeds a real token.
            </p>
          </Reveal>
        </section>

        {/* Connect */}
        <section className="border-t border-white/6 py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <Reveal>
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Connect your client</h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
                Pick your Claude surface — one registration, all 14 tools appear.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              <Reveal>
                <div className="flex h-full flex-col rounded-2xl border border-white/8 bg-white/[0.025] p-6">
                  <h3 className="font-display text-lg font-semibold text-white">claude.ai</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    Settings → Connectors → <strong className="text-zinc-200">Add custom connector</strong> → paste the
                    endpoint URL (including your <code className="font-mono text-[12px] text-zinc-300">?key=…</code>) →
                    Connect. Available in every chat from then on.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={60}>
                <div className="flex h-full flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-6">
                  <h3 className="font-display text-lg font-semibold text-white">Claude Desktop</h3>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    Edit <code className="font-mono text-[12px] text-zinc-300">claude_desktop_config.json</code> (Settings →
                    Developer → Edit Config) and add:
                  </p>
                  <pre className="overflow-x-auto rounded-lg border border-white/8 bg-black/60 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-zinc-300">
                    {DESKTOP_CONFIG}
                  </pre>
                </div>
              </Reveal>
              <Reveal delay={120}>
                <div className="flex h-full flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-6">
                  <h3 className="font-display text-lg font-semibold text-white">Claude Code</h3>
                  <p className="text-sm leading-relaxed text-zinc-400">One command in your terminal:</p>
                  <pre className="overflow-x-auto rounded-lg border border-white/8 bg-black/60 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-zinc-300">
                    {CLAUDE_CODE_SNIPPET}
                  </pre>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Tools */}
        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <Reveal>
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">14 tools</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
              Everything below is callable by Claude — and each result is plain text or media Claude can reason about.
            </p>
          </Reveal>
          <div className="mt-8 space-y-8">
            {TOOL_GROUPS.map((g) => (
              <Reveal key={g.group}>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300">
                    <g.icon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-white">{g.group}</h3>
                    <p className="text-xs text-zinc-500">{g.blurb}</p>
                  </div>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/8">
                  {g.tools.map((t, i) => (
                    <div
                      key={t.name}
                      className={`flex flex-col gap-1.5 px-5 py-4 sm:flex-row sm:items-baseline sm:gap-5 ${i % 2 ? "bg-white/[0.02]" : "bg-white/[0.035]"}`}
                    >
                      <code className="w-full shrink-0 font-mono text-[13px] font-medium text-emerald-300/90 sm:w-72">{t.name}</code>
                      <span className="text-[13px] leading-relaxed text-zinc-400">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Example session */}
        <section className="border-t border-white/6 py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <Reveal>
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Talk to it directly</h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
                Any MCP client — or plain curl — speaks the same two calls:{" "}
                <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[13px] text-zinc-200">initialize</code>{" "}
                then{" "}
                <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[13px] text-zinc-200">tools/call</code>.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <Reveal>
                <CodeBlock code={INIT_SNIPPET} label="initialize" />
              </Reveal>
              <Reveal delay={60}>
                <CodeBlock code={CALL_SNIPPET} label="tools/call" />
              </Reveal>
            </div>

            <Reveal className="mt-10" delay={60}>
              <h3 className="font-display text-lg font-semibold text-white">A typical generation workflow</h3>
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/8">
                {WORKFLOW.map((w, i) => (
                  <div
                    key={i}
                    className={`flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-baseline sm:gap-5 ${i % 2 ? "bg-white/[0.02]" : "bg-white/[0.035]"}`}
                  >
                    <span className="font-mono text-xs text-zinc-600">{String(i + 1).padStart(2, "0")}</span>
                    <code className="w-full shrink-0 font-mono text-[13px] font-medium text-emerald-300/90 sm:w-80">{w.call}</code>
                    <code className="font-mono text-[12px] text-zinc-500">{w.note}</code>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                Tip: when adding video or audio, always pass{" "}
                <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[12.5px] text-zinc-200">duration</code>{" "}
                matching the real media length — clips otherwise default to 5s and get truncated in preview and export.
                Verify afterwards with{" "}
                <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[12.5px] text-zinc-200">visioncut_get_project</code>.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-white/6 py-20 text-center">
          <Reveal>
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Prefer clicking to prompting?</h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] text-zinc-400">
              The whole studio — timeline, preview, export — also runs in your browser. No setup required.
            </p>
          </Reveal>
        </section>
      </main>
      <Footer />
    </div>
  );
}
