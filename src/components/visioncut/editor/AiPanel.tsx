"use client";

import React, { useRef, useState } from "react";
import { useEditor, makeTextClip } from "@/lib/editor/store";
import { uid, type Clip } from "@/lib/editor/types";
import { ingestBlob } from "@/lib/editor/media";
import { getAssetUrl } from "@/lib/editor/idb";
import { extractAudioToWavBase64 } from "@/lib/editor/waveform";
import { ensureMediaUrl } from "@/lib/editor/engine";
import { toast } from "sonner";
import {
  Captions, Check, ChevronDown, Film, Info, Loader2, Mic, ScanSearch,
  Sparkles, Volume2, Wand2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AiTab = "storyboard" | "text2video" | "subtitles" | "voiceover" | "smart" | "bg";

const AI_TABS: { id: AiTab; label: string; icon: React.ElementType }[] = [
  { id: "storyboard", label: "Script → Video", icon: Wand2 },
  { id: "text2video", label: "Text to Video", icon: Film },
  { id: "subtitles", label: "Subtitles", icon: Captions },
  { id: "voiceover", label: "Voiceover", icon: Mic },
  { id: "smart", label: "Smart Edit", icon: ScanSearch },
  { id: "bg", label: "Background", icon: Sparkles },
];

type Scene = {
  index: number;
  visual: string;
  narration: string;
  caption: string;
  transition: string;
  durationSeconds: number;
  imagePrompt: string;
};

export function AiPanel() {
  const [tab, setTab] = useState<AiTab>("storyboard");
  return (
    <div className="p-3">
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/8 p-2.5">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-fuchsia-300" />
        <p className="text-[10px] leading-relaxed text-fuchsia-200/80">
          AI tools call live services. Each tool reports real status — nothing is faked.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {AI_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border p-2 transition-all",
              tab === t.id
                ? "border-fuchsia-400/50 bg-fuchsia-500/15 text-white"
                : "border-white/8 bg-white/[0.02] text-zinc-500 hover:text-zinc-200"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            <span className="text-[9px] font-semibold">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === "storyboard" && <StoryboardTool />}
        {tab === "text2video" && <TextToVideoTool />}
        {tab === "subtitles" && <SubtitlesTool />}
        {tab === "voiceover" && <VoiceoverTool />}
        {tab === "smart" && <SmartTools />}
        {tab === "bg" && <BackgroundRemoval />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Script → Storyboard                                                  */
/* ------------------------------------------------------------------ */

function StoryboardTool() {
  const [script, setScript] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [busy, setBusy] = useState(false);
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [music, setMusic] = useState<string>("");
  const [genImage, setGenImage] = useState<number | null>(null);
  const scenesRef = useRef<HTMLDivElement | null>(null);

  const run = async () => {
    if (script.trim().length < 20) {
      toast.error("Please paste a script of at least 20 characters.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/ai/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: script.trim(), style }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Storyboard failed");
      setScenes(data.storyboard.scenes);
      setMusic(data.storyboard.musicSuggestion || "");
      // Results render below the controls — bring them into view so the
      // generated scenes are immediately visible in the narrow sidebar.
      requestAnimationFrame(() =>
        setTimeout(() => scenesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
      );
      toast.success("Storyboard ready — scenes are shown below", {
        description: `${data.storyboard.scenes.length} scenes generated.`,
        duration: 8000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Storyboard generation failed");
    } finally {
      setBusy(false);
    }
  };

  const insertAll = () => {
    const store = useEditor.getState();
    const track = store.project.tracks.find((t) => t.type === "video" && !t.locked);
    if (!track) {
      toast.error("No unlocked video track available.");
      return;
    }
    let t = Math.max(store.playhead, store.project.duration);
    for (const scene of scenes || []) {
      store.addClip(
        {
          ...makeTextClip(track.id, "caption", t),
          duration: scene.durationSeconds,
          name: `Scene ${scene.index} — caption`,
          text: { content: scene.caption, fontSize: 0.04, color: "#ffffff", weight: 600, align: "center", family: "sans", bgOpacity: 0.55, letterSpacing: 0 },
          animation: scene.transition === "fade" ? "fadeBoth" : scene.transition === "slide" ? "slideLeft" : "none",
        },
        { select: false }
      );
      t += scene.durationSeconds;
    }
    toast.success(`${scenes?.length} scene captions added at ${t.toFixed(1)}s`);
  };

  const generateSceneVisual = async (scene: Scene) => {
    setGenImage(scene.index);
    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: scene.imagePrompt || scene.visual, aspectRatio: useEditor.getState().project.aspectRatio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Image generation failed");
      const blob = await (await fetch(data.imageDataUrl)).blob();
      const { asset } = await ingestBlob(blob, {
        name: `Scene ${scene.index} visual`,
        kind: "image",
        mimeType: "image/png",
        origin: "ai",
      });
      // thumbnail from the data url directly
      const patched = { ...asset, thumbnail: data.imageDataUrl };
      const store = useEditor.getState();
      store.addAsset(patched);
      const track = store.project.tracks.find((t) => t.type === "video" && !t.locked);
      if (!track) throw new Error("No unlocked video track");
      const clip = store.addClipFromAsset(patched, track.id, Math.max(store.playhead, store.project.duration));
      if (clip) {
        store.updateClip(clip.id, { duration: scene.durationSeconds }, { history: false });
      }
      toast.success(`Scene ${scene.index} visual added to the timeline`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scene visual failed");
    } finally {
      setGenImage(null);
    }
  };

  return (
    <div>
      <textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        rows={5}
        maxLength={6000}
        placeholder="Paste your script here — e.g. 'A 30-second ad for a surf school in Lisbon. Open on dawn waves, then a coach teaching a beginner…'"
        className="scrollbar-slim w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-fuchsia-400/50 focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 text-[11px] text-zinc-300 focus:outline-none"
          aria-label="Visual style"
        >
          {["cinematic", "documentary", "energetic", "minimal", "playful"].map((s) => (
            <option key={s} value={s} className="bg-[#101018]">{s}</option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={busy}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-500 px-3 text-[11px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          {busy ? "Directing…" : "Generate"}
        </button>
      </div>

      {busy && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-fuchsia-400/20 bg-fuchsia-500/10 px-2 py-1.5 text-[10px] leading-relaxed text-fuchsia-200" role="status">
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          Directing your storyboard… this usually takes 10–20 seconds. Results will appear here.
        </p>
      )}

      {scenes && (
        <div ref={scenesRef} className="mt-3 space-y-2 scroll-mt-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{scenes.length} scenes</p>
            <button onClick={insertAll} className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-2.5 py-1 text-[10px] font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20">
              Insert captions at playhead
            </button>
          </div>
          {scenes.map((s) => (
            <div key={s.index} className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-fuchsia-300">Scene {s.index} · {s.durationSeconds}s · {s.transition}</span>
                <button
                  onClick={() => generateSceneVisual(s)}
                  disabled={genImage !== null}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[9px] font-semibold text-zinc-300 hover:border-fuchsia-400/40 hover:text-white disabled:opacity-50"
                >
                  {genImage === s.index ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
                  Visual
                </button>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">{s.caption}</p>
              <p className="mt-0.5 text-[9px] italic leading-relaxed text-zinc-600">VO: {s.narration}</p>
            </div>
          ))}
          {music && (
            <p className="rounded-lg border border-white/6 bg-white/[0.02] p-2 text-[10px] text-zinc-500">
              <Volume2 className="mr-1 inline h-3 w-3 text-emerald-300" /> Music: {music}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Text → Video (async generation task)                                 */
/* ------------------------------------------------------------------ */

function TextToVideoTool() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<5 | 10>(5);
  const [quality, setQuality] = useState<"speed" | "quality">("speed");
  const [withAudio, setWithAudio] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const run = async () => {
    if (prompt.trim().length < 3) {
      toast.error("Describe the video you want first.");
      return;
    }
    setBusy(true);
    setPollCount(0);
    setStatus("Submitting generation task…");
    try {
      const res = await fetch("/api/ai/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), duration, quality, withAudio, fps: 30 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start video generation");
      const taskId = data.taskId as string;

      // Poll until done (max ~7 min)
      const maxPolls = 84;
      let videoUrl: string | null = null;
      for (let i = 1; i <= maxPolls; i++) {
        setPollCount(i);
        setStatus(`Generating… check ${i}/${maxPolls} (typically 1–4 min)`);
        await new Promise((r) => setTimeout(r, 5000));
        const sres = await fetch(`/api/ai/video-status/${taskId}`);
        const sdata = await sres.json();
        if (sdata.status === "SUCCESS") {
          videoUrl = sdata.videoUrl;
          break;
        }
        if (sdata.status === "FAILED") throw new Error(sdata.error || "Generation failed on the provider side.");
      }
      if (!videoUrl) throw new Error("Generation is taking longer than expected — try again later.");

      setStatus("Downloading generated video…");
      const proxied = await fetch(`/api/ai/proxy-media?url=${encodeURIComponent(videoUrl)}`);
      if (!proxied.ok) throw new Error("Could not download the generated video.");
      const blob = await proxied.blob();

      // probe duration
      const probeUrl = URL.createObjectURL(blob);
      const dur = await new Promise<number>((resolve) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.src = probeUrl;
        v.onloadedmetadata = () => resolve(isFinite(v.duration) ? v.duration : 5);
        v.onerror = () => resolve(5);
        setTimeout(() => resolve(5), 8000);
      });

      setStatus("Adding to timeline…");
      const { asset } = await ingestBlob(blob, {
        name: prompt.trim().slice(0, 32) + "…",
        kind: "video",
        mimeType: blob.type || "video/mp4",
        duration: dur,
        origin: "ai",
      });
      await new Promise<void>((resolve) => {
        const v = document.createElement("video");
        v.src = probeUrl;
        v.muted = true;
        v.currentTime = Math.min(1, dur * 0.1);
        v.onseeked = () => {
          const c = document.createElement("canvas");
          const scale = Math.min(1, 320 / (v.videoWidth || 320));
          c.width = Math.round((v.videoWidth || 320) * scale);
          c.height = Math.round((v.videoHeight || 180) * scale);
          c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
          const store = useEditor.getState();
          const assets = store.project.assets.map((a) => (a.id === asset.id ? { ...a, thumbnail: c.toDataURL("image/jpeg", 0.6) } : a));
          useEditor.setState({ project: { ...store.project, assets } });
          resolve();
        };
        setTimeout(resolve, 8000);
      });
      URL.revokeObjectURL(probeUrl);

      const store = useEditor.getState();
      store.addAsset(asset); // register asset metadata in the project
      const url = await getAssetUrl(asset.id);
      const clip = store.addClipFromAsset(asset);
      if (clip && url) ensureMediaUrl(clip, url);
      toast.success("AI video added to the timeline");
      setStatus(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Video generation failed");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        maxLength={1500}
        placeholder="e.g. A neon-lit cyberpunk street in the rain, camera slowly dollying forward, reflections on wet asphalt"
        className="scrollbar-slim w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-fuchsia-400/50 focus:outline-none"
      />
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <label className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] text-zinc-400">
          Duration
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) as 5 | 10)}
            className="mt-0.5 block w-full bg-transparent text-[11px] font-semibold text-zinc-200 focus:outline-none"
          >
            <option value={5} className="bg-[#101018]">5s</option>
            <option value={10} className="bg-[#101018]">10s</option>
          </select>
        </label>
        <label className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] text-zinc-400">
          Quality
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as "speed" | "quality")}
            className="mt-0.5 block w-full bg-transparent text-[11px] font-semibold text-zinc-200 focus:outline-none"
          >
            <option value="speed" className="bg-[#101018]">Fast</option>
            <option value="quality" className="bg-[#101018]">Detailed</option>
          </select>
        </label>
        <button
          onClick={() => setWithAudio((v) => !v)}
          className={cn(
            "rounded-lg border px-2 py-1.5 text-left text-[10px] transition-colors",
            withAudio ? "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200" : "border-white/10 bg-black/30 text-zinc-400"
          )}
        >
          AI audio
          <span className="mt-0.5 block text-[11px] font-semibold text-zinc-200">{withAudio ? "On" : "Off"}</span>
        </button>
      </div>
      <button
        onClick={run}
        disabled={busy}
        className="mt-2.5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-500 text-[11px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}
        {busy ? "Generating video…" : "Generate video clip"}
      </button>
      {busy && status && (
        <div className="mt-2 rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
          <p className="text-[10px] text-zinc-400">{status}</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400" />
          </div>
        </div>
      )}
      <p className="mt-2 rounded-lg border border-white/6 bg-white/[0.02] p-2 text-[9px] leading-relaxed text-zinc-600">
        Real generation via a connected video model. Typical wait: 1–4 minutes for 5s clips. The result is added as a
        normal video clip you can trim and reposition.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Automatic subtitles (ASR)                                            */
/* ------------------------------------------------------------------ */

function SubtitlesTool() {
  const selection = useEditor((s) => s.selection);
  const clip = useEditor((s) => s.project.clips.find((c) => c.id === s.selection));
  const assets = useEditor((s) => s.project.assets);
  const [busy, setBusy] = useState(false);
  const [captions, setCaptions] = useState<{ text: string; start: number; end: number }[] | null>(null);
  const [fontSize, setFontSize] = useState(0.038);
  const [color, setColor] = useState("#ffffff");
  const captionsRef = useRef<HTMLDivElement | null>(null);

  const run = async () => {
    if (!clip || (clip.type !== "video" && clip.type !== "audio")) {
      toast.error("Select a video or audio clip in the timeline first.");
      return;
    }
    const asset = assets.find((a) => a.id === clip.assetId);
    if (!asset) {
      toast.error("The selected clip's media is missing — re-import it first.");
      return;
    }
    setBusy(true);
    try {
      const url = await getAssetUrl(asset.id);
      if (!url) throw new Error("Media file missing from local cache.");
      const blob = await (await fetch(url)).blob();
      const extracted = await extractAudioToWavBase64(blob);
      if (!extracted) throw new Error("Could not extract audio from this file in your browser.");
      const res = await fetch("/api/ai/subtitles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: extracted.base64, duration: extracted.duration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed");
      setCaptions(data.captions);
      // The caption list renders below the fold in the narrow sidebar —
      // scroll it into view so results are immediately visible.
      requestAnimationFrame(() =>
        setTimeout(() => captionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
      );
      toast.success("Captions ready — the list is shown below", {
        description: `${data.captions.length} caption segments (estimated timing).`,
        duration: 8000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setBusy(false);
    }
  };

  const insert = () => {
    const store = useEditor.getState();
    const track = store.project.tracks.find((t) => t.type === "video" && !t.locked);
    if (!track) {
      toast.error("Add an unlocked video track for captions.");
      return;
    }
    for (const cap of captions || []) {
      store.addClip(
        {
          ...makeTextClip(track.id, "caption", cap.start),
          duration: Math.max(0.6, cap.end - cap.start),
          name: `Caption`,
          text: { content: cap.text, fontSize, color, weight: 600, align: "center", family: "sans", bgOpacity: 0.55, letterSpacing: 0 },
        },
        { select: false }
      );
    }
    toast.success(`${captions?.length} caption clips added to the timeline`);
  };

  return (
    <div>
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5">
        <p className="text-[10px] text-zinc-400">
          {clip && (clip.type === "video" || clip.type === "audio") ? (
            <>Transcribe: <strong className="text-zinc-200">{clip.name}</strong></>
          ) : (
            "Select a video or audio clip in the timeline to transcribe."
          )}
        </p>
      </div>
      <button
        onClick={run}
        disabled={busy}
        className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 text-[11px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Captions className="h-3.5 w-3.5" />}
        {busy ? "Transcribing audio…" : "Generate subtitles"}
      </button>
      {busy && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2 py-1.5 text-[10px] leading-relaxed text-cyan-100" role="status">
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          Transcribing the selected clip… this can take up to a minute for long clips.
        </p>
      )}
      {captions && (
        <div ref={captionsRef} className="mt-2.5 scroll-mt-2">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
              Size
              <input
                type="range" min={0.025} max={0.07} step={0.002} value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="vc-range w-16"
              />
            </label>
            <input
              type="color" value={color} onChange={(e) => setColor(e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border border-white/10 bg-transparent"
              aria-label="Caption color"
            />
            <button onClick={insert} className="ml-auto rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/20">
              Add all to timeline
            </button>
          </div>
          <div className="scrollbar-slim mt-2 max-h-48 space-y-1.5 overflow-y-auto">
            {captions.map((c, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-white/6 bg-white/[0.02] p-2">
                <span className="font-mono text-[9px] text-cyan-300/80">{c.start.toFixed(1)}s</span>
                <span className="flex-1 text-[10px] leading-snug text-zinc-300">{c.text}</span>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[9px] text-zinc-600">Timing is estimated from audio duration — adjust per clip in Timing.</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AI Voiceover (TTS)                                                   */
/* ------------------------------------------------------------------ */

const VOICES = [
  { id: "tongtong", label: "Tongtong (female, warm)" },
];

function VoiceoverTool() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("tongtong");
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const run = async (previewOnly: boolean) => {
    if (!text.trim()) {
      toast.error("Enter the narration text first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/ai/voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), voice, speed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Voiceover failed");
      const blob = await (await fetch(data.audioDataUrl)).blob();

      if (previewOnly) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        const audio = new Audio(url);
        audio.play().catch(() => toast.error("Browser blocked audio preview — add it to the timeline instead."));
        return;
      }

      // probe duration
      const probeUrl = URL.createObjectURL(blob);
      const dur = await new Promise<number>((resolve) => {
        const a = new Audio();
        a.src = probeUrl;
        a.onloadedmetadata = () => resolve(isFinite(a.duration) ? a.duration : 3);
        a.onerror = () => resolve(3);
        setTimeout(() => resolve(3), 8000);
      });
      URL.revokeObjectURL(probeUrl);

      const { asset } = await ingestBlob(blob, {
        name: `Voiceover — ${text.trim().slice(0, 24)}…`,
        kind: "audio",
        mimeType: blob.type || "audio/wav",
        duration: dur,
        origin: "ai",
      });
      const store = useEditor.getState();
      store.addAsset(asset); // register asset metadata in the project
      const audioTrack =
        store.project.tracks.find((t) => t.type === "audio" && !t.locked) ||
        store.project.tracks.find((t) => t.type === "audio");
      const clip = store.addClipFromAsset(asset, audioTrack?.id, store.playhead);
      if (clip) {
        const url = await getAssetUrl(asset.id);
        if (url) ensureMediaUrl(clip, url);
      }
      toast.success("Voiceover added to the audio track");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Voiceover generation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="Type the narration… e.g. 'Three tips that will change how you edit videos forever.'"
        className="scrollbar-slim w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:border-fuchsia-400/50 focus:outline-none"
      />
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <label className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] text-zinc-400">
          Voice
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="mt-0.5 block w-full bg-transparent text-[11px] font-semibold text-zinc-200 focus:outline-none"
          >
            {VOICES.map((v) => (
              <option key={v.id} value={v.id} className="bg-[#101018]">{v.label}</option>
            ))}
          </select>
        </label>
        <label className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] text-zinc-400">
          Speed · {speed.toFixed(1)}×
          <input
            type="range" min={0.5} max={2} step={0.1} value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="vc-range mt-1.5 w-full"
          />
        </label>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          onClick={() => run(true)}
          disabled={busy}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] text-[11px] font-semibold text-zinc-200 transition-all hover:bg-white/[0.08] disabled:opacity-60"
        >
          <Volume2 className="h-3.5 w-3.5" /> Preview
        </button>
        <button
          onClick={() => run(false)}
          disabled={busy}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-500 text-[11px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
          {busy ? "Generating…" : "Add to timeline"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Smart editing                                                        */
/* ------------------------------------------------------------------ */

function SmartTools() {
  const selection = useEditor((s) => s.selection);
  const clip = useEditor((s) => s.project.clips.find((c) => c.id === s.selection));
  const [busy, setBusy] = useState(false);

  const removeSilences = async () => {
    if (!clip || (clip.type !== "video" && clip.type !== "audio")) {
      toast.error("Select a video or audio clip with audio first.");
      return;
    }
    const peaks = clip.peaks;
    if (!peaks || peaks.length === 0) {
      toast.error("No waveform data yet — wait a moment for analysis, then try again.");
      return;
    }
    setBusy(true);
    try {
      const store = useEditor.getState();
      const asset = store.project.assets.find((a) => a.id === clip.assetId);
      const sourceDur = asset?.duration ?? clip.duration;
      const bucketDur = sourceDur / peaks.length;
      const THRESHOLD = 0.055;
      const MIN_SILENCE = Math.max(1, Math.round(0.45 / bucketDur));
      const MIN_KEEP = Math.max(1, Math.round(0.3 / bucketDur));

      // find silent runs
      const silent: boolean[] = peaks.map((p) => p < THRESHOLD);
      const keepSegments: { start: number; end: number }[] = [];
      let i = 0;
      let cursor = 0; // source seconds
      while (i < silent.length) {
        if (silent[i]) {
          let j = i;
          while (j < silent.length && silent[j]) j++;
          const silenceLen = j - i;
          if (silenceLen >= MIN_SILENCE) {
            const silenceStart = i * bucketDur;
            const silenceEnd = j * bucketDur;
            if (silenceStart - cursor > 0.05) {
              keepSegments.push({ start: cursor, end: silenceStart });
            }
            cursor = silenceEnd;
          }
          i = j;
        } else i++;
      }
      if (cursor < sourceDur - 0.05) keepSegments.push({ start: cursor, end: sourceDur });
      const meaningful = keepSegments.filter((s) => s.end - s.start >= 0.15);
      if (meaningful.length === 0) {
        toast.info("No significant silence found in this clip.");
        return;
      }

      store.commit();
      // replace the original clip with keep-segments
      const trackId = clip.trackId;
      let timelineT = clip.start;
      const newClips: Clip[] = meaningful.map((seg, idx) => ({
        ...structuredClone(clip),
        id: uid(),
        name: idx === 0 ? clip.name : `${clip.name} (${idx + 1})`,
        start: timelineT,
        duration: (seg.end - seg.start) / clip.speed,
        trimStart: clip.trimStart + seg.start,
        peaks: undefined,
      }));
      for (const c of newClips) timelineT += c.duration;

      const rest = store.project.clips.filter((c) => c.id !== clip.id);
      // shift subsequent clips on the same track by the removed time
      const removedTotal = clip.duration - (timelineT - clip.start);
      const shifted = rest.map((c) =>
        c.trackId === trackId && c.start >= clip.start + clip.duration - 1e-3
          ? { ...c, start: Math.max(0, c.start - removedTotal) }
          : c
      );
      useEditor.setState({
        project: {
          ...store.project,
          clips: [...shifted, ...newClips],
          duration: Math.max(0, store.project.duration - removedTotal),
        },
        saveStatus: "unsaved",
      });
      toast.success(`Removed ${newClips.length - 1 || "no"} silence gap${newClips.length === 2 ? "" : "s"}`, {
        description: `Clip shortened by ${removedTotal.toFixed(1)}s.`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-zinc-100">Silence removal</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">
              Detects quiet gaps in the selected clip&apos;s waveform and tightens them automatically.
            </p>
          </div>
          <button
            onClick={removeSilences}
            disabled={busy}
            className="shrink-0 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-400 px-3 py-1.5 text-[10px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Run"}
          </button>
        </div>
      </div>

      {[
        { name: "Scene detection", desc: "Auto-split long footage at visual cut points" },
        { name: "Auto reframe", desc: "Re-crop landscape video to vertical subject tracking" },
        { name: "Highlight extraction", desc: "Pick the most engaging moments from long recordings" },
      ].map((t) => (
        <div key={t.name} className="rounded-xl border border-white/8 bg-white/[0.02] p-3 opacity-70">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
                {t.name}
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-px text-[8px] font-bold uppercase tracking-wider text-amber-300">
                  Preview
                </span>
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-600">{t.desc}</p>
            </div>
            <button disabled className="shrink-0 cursor-not-allowed rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-semibold text-zinc-600">
              Unavailable
            </button>
          </div>
        </div>
      ))}
      <p className="rounded-lg border border-white/6 bg-white/[0.02] p-2 text-[9px] leading-relaxed text-zinc-600">
        Preview tools are labeled honestly: they require additional processing services that aren&apos;t connected in this
        deployment, so their buttons are disabled rather than pretending to work.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Background removal (preview)                                         */
/* ------------------------------------------------------------------ */

function BackgroundRemoval() {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-200">
        Background removal
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-px text-[8px] font-bold uppercase tracking-wider text-amber-300">
          Preview
        </span>
      </p>
      <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
        AI subject segmentation needs a dedicated processing model that isn&apos;t connected in this deployment. Rather
        than simulating results, this capability is clearly marked unavailable. In the meantime:
      </p>
      <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-zinc-500">
        <li className="flex gap-1.5"><Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" /> Use chroma-style compositing via color grading on solid backgrounds</li>
        <li className="flex gap-1.5"><Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" /> Layer AI-generated images (Script → Video scenes) as clean backdrops</li>
        <li className="flex gap-1.5"><Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" /> Vignette + blur effects can isolate subjects visually</li>
      </ul>
    </div>
  );
}
