"use client";

import React, { useRef, useState } from "react";
import { useEditor, makeTextClip } from "@/lib/editor/store";
import { type Asset, uid } from "@/lib/editor/types";
import { ingestFile, IngestError, validateFile } from "@/lib/editor/media";
import { getAssetUrl } from "@/lib/editor/idb";
import { toast } from "sonner";
import { AiPanel } from "@/components/visioncut/editor/AiPanel";
import {
  AudioLines, Film, Image as ImageIcon, Loader2, Music, Palette, Plus,
  Shapes, Sparkles, Trash2, Type as TypeIcon, Upload, Wand2, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "media", label: "Media", icon: Film },
  { id: "audio", label: "Audio", icon: AudioLines },
  { id: "text", label: "Text", icon: TypeIcon },
  { id: "transitions", label: "Transition", icon: Layers },
  { id: "effects", label: "Effects", icon: Palette },
  { id: "stickers", label: "Stickers", icon: Shapes },
  { id: "templates", label: "Template", icon: Wand2 },
  { id: "ai", label: "AI Tools", icon: Sparkles },
] as const;

type TabId = (typeof TABS)[number]["id"];

const FILTER_PRESETS: { name: string; color: Record<string, number> }[] = [
  { name: "Original", color: {} },
  { name: "Cinematic", color: { brightness: 0.94, contrast: 1.22, saturation: 0.88 } },
  { name: "Warm Sun", color: { brightness: 1.06, contrast: 1.05, saturation: 1.18, hue: -8 } },
  { name: "Cool Night", color: { brightness: 0.92, contrast: 1.12, saturation: 1.05, hue: 14 } },
  { name: "Noir B&W", color: { saturation: 0, contrast: 1.3 } },
  { name: "Vintage", color: { brightness: 1.02, contrast: 0.92, saturation: 0.75, hue: -12 } },
  { name: "Dreamy", color: { brightness: 1.08, contrast: 0.9, saturation: 1.1, blur: 1.5 } },
  { name: "Punch", color: { contrast: 1.35, saturation: 1.3 } },
];

const TRANSITIONS: { anim: ClipAnim; label: string; desc: string }[] = [
  { anim: "fadeBoth", label: "Cross Fade", desc: "Gentle fade in & out" },
  { anim: "fadeIn", label: "Fade In", desc: "Appear from black" },
  { anim: "fadeOut", label: "Fade Out", desc: "Disappear to black" },
  { anim: "kenBurns", label: "Ken Burns", desc: "Cinematic slow zoom" },
  { anim: "slideLeft", label: "Slide In", desc: "Slide from the left" },
  { anim: "slideUp", label: "Slide Up", desc: "Rise into frame" },
  { anim: "popIn", label: "Pop", desc: "Energetic pop-in" },
];
type ClipAnim = "fadeIn" | "fadeOut" | "fadeBoth" | "kenBurns" | "slideLeft" | "slideUp" | "popIn";

const STICKERS = ["🔥", "✨", "❤️", "😂", "😮", "👏", "💯", "⭐", "🎬", "🎵", "⬆️", "👇", "💬", "🎯", "🚀", "💎"];

/* Generate a gradient background image in-browser (no AI needed) */
async function generateGradientAsset(kind: "wide" | "vertical" | "square", palette: [string, string, string], name: string): Promise<Asset | null> {
  const dims = kind === "wide" ? [1920, 1080] : kind === "vertical" ? [1080, 1920] : [1080, 1080];
  const canvas = document.createElement("canvas");
  canvas.width = dims[0];
  canvas.height = dims[1];
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 0, dims[0], dims[1]);
  g.addColorStop(0, palette[0]);
  g.addColorStop(0.55, palette[1]);
  g.addColorStop(1, palette[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, dims[0], dims[1]);
  // soft vignette + grain for a cinematic feel
  const radial = ctx.createRadialGradient(dims[0] / 2, dims[1] / 2, dims[1] * 0.2, dims[0] / 2, dims[1] / 2, dims[1] * 0.9);
  radial.addColorStop(0, "rgba(0,0,0,0)");
  radial.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, dims[0], dims[1]);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let i = 0; i < 900; i++) {
    ctx.fillRect(Math.random() * dims[0], Math.random() * dims[1], 2, 2);
  }
  const small = document.createElement("canvas");
  small.width = 320;
  small.height = Math.round((320 * dims[1]) / dims[0]);
  small.getContext("2d")?.drawImage(canvas, 0, 0, small.width, small.height);
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
  const thumb = small.toDataURL("image/jpeg", 0.7);
  const { ingestBlob } = await import("@/lib/editor/media");
  const { asset } = await ingestBlob(blob, { name, kind: "image", mimeType: "image/png", origin: "sample", thumbnail: thumb });
  return asset;
}

function AssetTile({ asset, onAdd, onDelete }: { asset: Asset; onAdd: () => void; onDelete?: () => void }) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-white/8 bg-white/[0.02]"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/visioncut-asset", asset.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      title={`${asset.name} — drag to the timeline or click to add`}
    >
      <button onClick={onAdd} className="block w-full" aria-label={`Add ${asset.name} to timeline`}>
        <div className="relative aspect-video w-full overflow-hidden bg-black/50">
          {asset.thumbnail ? (
            <img src={asset.thumbnail} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {asset.kind === "audio" ? <Music className="h-6 w-6 text-emerald-300/70" /> : <ImageIcon className="h-6 w-6 text-zinc-600" />}
            </div>
          )}
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 font-mono text-[9px] text-zinc-300">
            {asset.duration ? `${asset.duration.toFixed(1)}s` : `${(asset.size / 1048576).toFixed(1)}MB`}
          </span>
          {asset.origin === "ai" && (
            <span className="absolute left-1 top-1 rounded bg-fuchsia-500/80 px-1 py-0.5 text-[8px] font-bold uppercase text-white">AI</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1 px-2 py-1.5">
          <span className="truncate text-[10px] text-zinc-400">{asset.name}</span>
          <Plus className="h-3 w-3 shrink-0 text-zinc-600 group-hover:text-violet-300" />
        </div>
      </button>
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-zinc-400 opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100"
          aria-label={`Remove ${asset.name} from project`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function LeftSidebar() {
  const [tab, setTab] = useState<TabId>("media");
  const [ingesting, setIngesting] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const assets = useEditor((s) => s.project.assets);
  const addAsset = useEditor((s) => s.addAsset);
  const removeAsset = useEditor((s) => s.removeAsset);
  const addClipFromAsset = useEditor((s) => s.addClipFromAsset);
  const selection = useEditor((s) => s.selection);
  const playhead = useEditor((s) => s.playhead);
  const updateClip = useEditor((s) => s.updateClip);
  const addClip = useEditor((s) => s.addClip);
  const project = useEditor((s) => s.project);
  const [busyTemplate, setBusyTemplate] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const file of list) {
      setIngesting((n) => n + 1);
      try {
        const { asset } = await ingestFile(file);
        addAsset(asset);
        toast.success(`Imported “${asset.name}”`, { description: "Drag it to the timeline or click to add at the playhead." });
      } catch (err) {
        if (err instanceof IngestError) toast.error(err.message);
        else {
          const check = validateFile(file);
          toast.error("error" in check ? check.error : `Could not import “${file.name}”.`);
        }
      } finally {
        setIngesting((n) => n - 1);
      }
    }
  };

  const addAssetAtPlayhead = async (asset: Asset) => {
    const url = await getAssetUrl(asset.id);
    if (url) {
      // prime the URL so the first frame renders immediately
      const store = useEditor.getState();
      const clip = store.addClipFromAsset(asset);
      if (clip) {
        const { ensureMediaUrl } = await import("@/lib/editor/engine");
        ensureMediaUrl(clip, url);
      }
    } else {
      toast.error("Media file is missing from local cache — re-import it.");
    }
  };

  const deleteAsset = (asset: Asset) => {
    removeAsset(asset.id);
    toast.info(`Removed “${asset.name}”`, { description: "Clips using it were also removed." });
  };

  const addTextPreset = (preset: "title" | "subtitle" | "caption") => {
    const store = useEditor.getState();
    const track = store.project.tracks.find((t) => t.type === "video" && !t.locked);
    if (!track) {
      toast.error("No unlocked video track available. Add one with the + button in the timeline.");
      return;
    }
    addClip(makeTextClip(track.id, preset, playhead));
  };

  const applyTransition = (anim: ClipAnim) => {
    if (!selection) {
      toast.info("Select a clip first", { description: "Transitions are applied to the selected clip in this build." });
      return;
    }
    updateClip(selection, { animation: anim });
    toast.success("Transition applied to selected clip");
  };

  const applyFilter = (preset: (typeof FILTER_PRESETS)[number]) => {
    if (!selection) {
      toast.info("Select a clip first", { description: "Filters apply to the selected clip." });
      return;
    }
    const clip = project.clips.find((c) => c.id === selection);
    if (!clip || clip.type === "audio") {
      toast.error("Filters apply to visual clips only.");
      return;
    }
    updateClip(selection, { color: { ...clip.color, ...preset.color } });
    toast.success(`${preset.name} look applied`);
  };

  const addSticker = (emoji: string) => {
    const store = useEditor.getState();
    const track = store.project.tracks.find((t) => t.type === "video" && !t.locked);
    if (!track) {
      toast.error("No unlocked video track available.");
      return;
    }
    addClip({
      id: uid(),
      trackId: track.id,
      type: "text",
      name: `Sticker ${emoji}`,
      start: playhead,
      duration: 3,
      trimStart: 0,
      x: (Math.random() - 0.5) * 0.6,
      y: (Math.random() - 0.5) * 0.6,
      scale: 1,
      rotation: (Math.random() - 0.5) * 14,
      opacity: 1,
      volume: 1,
      speed: 1,
      color: { brightness: 1, contrast: 1, saturation: 1, hue: 0, blur: 0 },
      text: { content: emoji, fontSize: 0.14, color: "#ffffff", weight: 400, align: "center", family: "sans", bgOpacity: 0, letterSpacing: 0 },
      animation: "popIn",
      animationDuration: 0.4,
    });
  };

  const applyTemplate = async (template: "cinematic-title" | "vertical-hook" | "lower-third" | "quote-card") => {
    setBusyTemplate(true);
    try {
      const store = useEditor.getState();
      const track = store.project.tracks.find((t) => t.type === "video" && !t.locked);
      if (!track) {
        toast.error("Add an unlocked video track first.");
        return;
      }
      let asset: Asset | null = null;
      if (template === "cinematic-title") {
        asset = await generateGradientAsset("wide", ["#1e1b4b", "#4c1d95", "#0e7490"], "Cinematic Gradient");
      } else if (template === "vertical-hook") {
        asset = await generateGradientAsset("vertical", ["#312e81", "#831843", "#f59e0b"], "Vertical Hook Gradient");
      } else if (template === "quote-card") {
        asset = await generateGradientAsset("wide", ["#0f172a", "#1e1b4b", "#0f172a"], "Quote Backdrop");
      }
      if (template === "lower-third") {
        addClip(makeTextClip(track.id, "caption", playhead));
        const clip = useEditor.getState().project.clips.at(-1);
        if (clip) {
          updateClip(clip.id, { y: 0.24, x: -0.18, text: { ...clip.text!, align: "left", content: "Jane Doe\nDirector of Photography", fontSize: 0.032, bgOpacity: 0.6 } });
        }
        toast.success("Lower third added");
        return;
      }
      if (!asset) return;
      store.addClipFromAsset(asset, track.id, playhead);
      const inserted = useEditor.getState().project.clips.filter((c) => c.assetId === asset!.id).at(-1);
      const start = inserted?.start ?? playhead;
      const textTrack = track.id;
      if (template === "cinematic-title") {
        addClip({
          ...makeTextClip(textTrack, "title", start + 0.3),
          duration: 3.5,
          text: { content: "A FILM BY YOU", fontSize: 0.075, color: "#ffffff", weight: 700, align: "center", family: "display", bgOpacity: 0, letterSpacing: 0.18 },
          animation: "fadeBoth",
        });
      } else if (template === "vertical-hook") {
        addClip({
          ...makeTextClip(textTrack, "title", start + 0.2),
          duration: 2.5,
          text: { content: "WAIT FOR IT…", fontSize: 0.09, color: "#ffffff", weight: 800, align: "center", family: "display", bgOpacity: 0, letterSpacing: 0.02 },
          animation: "popIn",
        });
        addClip({
          ...makeTextClip(textTrack, "caption", start + 2.8),
          duration: 2,
          text: { content: "Follow for part 2", fontSize: 0.042, color: "#ffffff", weight: 600, align: "center", family: "sans", bgOpacity: 0.5, letterSpacing: 0 },
          animation: "slideUp",
        });
      } else if (template === "quote-card") {
        addClip({
          ...makeTextClip(textTrack, "subtitle", start + 0.3),
          duration: 4,
          text: { content: "“The best way to predict\nthe future is to create it.”", fontSize: 0.05, color: "#e6e6f0", weight: 500, align: "center", family: "display", bgOpacity: 0, letterSpacing: 0 },
          animation: "fadeBoth",
        });
      }
      toast.success("Template added to the timeline");
    } finally {
      setBusyTemplate(false);
    }
  };

  const visualAssets = assets.filter((a) => a.kind !== "audio");
  const audioAssets = assets.filter((a) => a.kind === "audio");

  return (
    <div className="flex h-full bg-[#0a0a12]">
      {/* icon rail */}
      <div className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-white/8 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-label={t.label}
            className={cn(
              "flex h-10 w-10 flex-col items-center justify-center gap-0.5 rounded-xl transition-all",
              tab === t.id
                ? "bg-violet-500/20 text-violet-200 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.4)]"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            )}
          >
            <t.icon className="h-4 w-4" />
            <span className="text-[7px] font-semibold uppercase tracking-wide">{t.label.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      {/* panel */}
      <div className="scrollbar-slim min-w-0 flex-1 overflow-y-auto">
        {/* MEDIA */}
        {tab === "media" && (
          <div className="p-3">
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,image/jpeg,image/png,image/webp,.mp4,.webm,.mov,.mp3,.wav,.m4a,.jpg,.jpeg,.png,.webp"
              multiple
              hidden
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
              }}
              className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-violet-400/30 bg-violet-500/5 py-6 transition-colors hover:border-violet-400/60 hover:bg-violet-500/10"
            >
              {ingesting > 0 ? (
                <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
              ) : (
                <Upload className="h-5 w-5 text-violet-300" />
              )}
              <span className="text-xs font-semibold text-zinc-200">
                {ingesting > 0 ? "Importing…" : "Upload media"}
              </span>
              <span className="text-[10px] leading-relaxed text-zinc-500">
                Click or drop files · MP4/WebM, MP3/WAV, JPG/PNG · max 200MB
              </span>
            </button>

            {visualAssets.length === 0 ? (
              <p className="mt-4 rounded-xl border border-white/6 bg-white/[0.02] p-3 text-center text-[10px] leading-relaxed text-zinc-600">
                No media yet. Imported files are stored privately in this browser and referenced by your cloud project.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {visualAssets.map((a) => (
                  <AssetTile key={a.id} asset={a} onAdd={() => addAssetAtPlayhead(a)} onDelete={() => deleteAsset(a)} />
                ))}
              </div>
            )}

            <div className="mt-4 rounded-xl border border-white/6 bg-white/[0.02] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Stock library</p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
                Third-party stock requires configuring a provider (e.g. Pexels) for this deployment — it&apos;s not
                connected yet. Use the Template panel for locally generated backdrops.
              </p>
            </div>
          </div>
        )}

        {/* AUDIO */}
        {tab === "audio" && (
          <div className="p-3">
            {audioAssets.length === 0 ? (
              <p className="rounded-xl border border-white/6 bg-white/[0.02] p-3 text-[10px] leading-relaxed text-zinc-600">
                No audio yet. Import music or voice tracks from the Media tab, or generate narration with the AI Voiceover tool.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {audioAssets.map((a) => (
                  <AssetTile key={a.id} asset={a} onAdd={() => addAssetAtPlayhead(a)} onDelete={() => deleteAsset(a)} />
                ))}
              </div>
            )}
            <button
              onClick={() => setTab("ai")}
              className="mt-4 flex w-full items-center gap-2.5 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/8 p-3 text-left transition-colors hover:bg-fuchsia-500/15"
            >
              <Wand2 className="h-4 w-4 shrink-0 text-fuchsia-300" />
              <span>
                <span className="block text-[11px] font-semibold text-zinc-100">AI Voiceover</span>
                <span className="block text-[10px] text-zinc-500">Turn a script into narration audio</span>
              </span>
            </button>
          </div>
        )}

        {/* TEXT */}
        {tab === "text" && (
          <div className="space-y-2.5 p-3">
            {[
              { preset: "title" as const, label: "Title", desc: "Large centered headline", preview: "Your Title Here", cls: "text-lg font-bold" },
              { preset: "subtitle" as const, label: "Subtitle", desc: "Supporting line below center", preview: "A supporting subtitle", cls: "text-sm font-medium" },
              { preset: "caption" as const, label: "Caption", desc: "Boxed captions near the bottom", preview: "Caption text", cls: "text-xs font-semibold bg-black/60 px-2 py-0.5 rounded" },
            ].map((p) => (
              <button
                key={p.preset}
                onClick={() => addTextPreset(p.preset)}
                className="group flex w-full flex-col gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] p-3 transition-all hover:border-violet-400/40 hover:bg-white/[0.05]"
              >
                <span className={cn("flex h-14 items-center justify-center rounded-lg bg-gradient-to-br from-violet-950/60 to-black text-white", p.cls)}>
                  {p.preview}
                </span>
                <span className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">{p.label}</span>
                  <Plus className="h-3.5 w-3.5 text-zinc-600 group-hover:text-violet-300" />
                </span>
                <span className="text-[10px] text-zinc-500">{p.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* TRANSITIONS */}
        {tab === "transitions" && (
          <div className="p-3">
            <p className="mb-2.5 rounded-lg border border-white/6 bg-white/[0.02] p-2.5 text-[10px] leading-relaxed text-zinc-500">
              Select a clip in the timeline, then apply a motion transition. Each transition uses the clip&apos;s animation duration from the properties panel.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TRANSITIONS.map((t) => (
                <button
                  key={t.anim}
                  onClick={() => applyTransition(t.anim)}
                  className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5 text-left transition-all hover:border-violet-400/40 hover:bg-white/[0.05]"
                >
                  <span className="mb-1.5 flex h-10 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-r from-violet-950/80 to-cyan-950/60">
                    <span className="h-5 w-9 rounded bg-gradient-to-r from-violet-500 to-cyan-400 transition-transform duration-500 hover:translate-x-2" />
                  </span>
                  <span className="block text-[11px] font-semibold text-zinc-200">{t.label}</span>
                  <span className="block text-[9px] text-zinc-500">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* EFFECTS */}
        {tab === "effects" && (
          <div className="p-3">
            <p className="mb-2.5 rounded-lg border border-white/6 bg-white/[0.02] p-2.5 text-[10px] leading-relaxed text-zinc-500">
              Cinematic looks apply live color adjustments to the selected visual clip. Fine-tune every value in the Color tab.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {FILTER_PRESETS.map((f) => (
                <button
                  key={f.name}
                  onClick={() => applyFilter(f)}
                  className="group overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] transition-all hover:border-violet-400/40"
                >
                  <span
                    className="block h-12 w-full"
                    style={{
                      background: "linear-gradient(120deg, #7c3aed, #0891b2, #f59e0b)",
                      filter: `brightness(${f.color.brightness ?? 1}) contrast(${f.color.contrast ?? 1}) saturate(${f.color.saturation ?? 1}) hue-rotate(${f.color.hue ?? 0}deg) blur(${f.color.blur ?? 0}px)`,
                    }}
                  />
                  <span className="block px-2.5 py-1.5 text-left text-[11px] font-semibold text-zinc-300 group-hover:text-white">{f.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STICKERS */}
        {tab === "stickers" && (
          <div className="p-3">
            <p className="mb-2.5 text-[10px] leading-relaxed text-zinc-500">
              Click to drop a sticker at the playhead — position and rotate it from the properties panel.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {STICKERS.map((s) => (
                <button
                  key={s}
                  onClick={() => addSticker(s)}
                  className="flex aspect-square items-center justify-center rounded-xl border border-white/8 bg-white/[0.02] text-2xl transition-all hover:scale-110 hover:border-violet-400/40 hover:bg-white/[0.06]"
                  aria-label={`Add sticker ${s}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TEMPLATES */}
        {tab === "templates" && (
          <div className="space-y-2.5 p-3">
            {[
              { id: "cinematic-title" as const, name: "Cinematic Title Card", desc: "Gradient backdrop + letterspaced title", ratio: "16:9" },
              { id: "vertical-hook" as const, name: "Vertical Hook", desc: "9:16 opener with pop-in hook text", ratio: "9:16" },
              { id: "lower-third" as const, name: "Lower Third", desc: "Boxed name & role, bottom-left", ratio: "16:9" },
              { id: "quote-card" as const, name: "Quote Card", desc: "Dark backdrop with elegant quote", ratio: "16:9" },
            ].map((t) => (
              <button
                key={t.id}
                disabled={busyTemplate}
                onClick={() => applyTemplate(t.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-left transition-all hover:border-violet-400/40 hover:bg-white/[0.05] disabled:opacity-60"
              >
                {busyTemplate ? <Loader2 className="h-5 w-5 animate-spin text-violet-300" /> : <Layers className="h-5 w-5 shrink-0 text-violet-300" />}
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-zinc-100">{t.name}</span>
                  <span className="block truncate text-[10px] text-zinc-500">{t.desc} · {t.ratio}</span>
                </span>
                <Plus className="ml-auto h-3.5 w-3.5 shrink-0 text-zinc-600" />
              </button>
            ))}
          </div>
        )}

        {/* AI */}
        {tab === "ai" && <AiPanel />}
      </div>
    </div>
  );
}
