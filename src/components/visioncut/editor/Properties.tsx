"use client";

import React from "react";
import { useEditor } from "@/lib/editor/store";
import { type Clip, formatDuration, NEUTRAL_COLOR } from "@/lib/editor/types";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Crop, MousePointer2, Palette, RotateCcw, SlidersHorizontal, Type, Volume2, Wand2, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium text-zinc-400">{label}</span>
        {hint && <span className="font-mono text-[10px] tabular-nums text-zinc-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function NumRow({
  label, value, min, max, step, onChange, suffix,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <Row label={label} hint={`${Number(value.toFixed(2))}${suffix || ""}`}>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="py-1"
      />
    </Row>
  );
}

const ANIMATIONS: { value: Clip["animation"]; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fadeIn", label: "Fade in" },
  { value: "fadeOut", label: "Fade out" },
  { value: "fadeBoth", label: "Cross fade" },
  { value: "kenBurns", label: "Ken Burns zoom" },
  { value: "slideLeft", label: "Slide in left" },
  { value: "slideUp", label: "Slide up" },
  { value: "popIn", label: "Pop in" },
];

const FILTER_PRESETS: { name: string; color: Partial<typeof NEUTRAL_COLOR> }[] = [
  { name: "Original", color: NEUTRAL_COLOR },
  { name: "Cinematic", color: { brightness: 0.94, contrast: 1.22, saturation: 0.88 } },
  { name: "Warm Sun", color: { brightness: 1.06, contrast: 1.05, saturation: 1.18, hue: -8 } },
  { name: "Cool Night", color: { brightness: 0.92, contrast: 1.12, saturation: 1.05, hue: 14 } },
  { name: "Noir B&W", color: { brightness: 0.98, contrast: 1.3, saturation: 0 } },
  { name: "Vintage", color: { brightness: 1.02, contrast: 0.92, saturation: 0.75, hue: -12 } },
];

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-zinc-600">
        <MousePointer2 className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-zinc-300">Nothing selected</p>
      <p className="text-[11px] leading-relaxed text-zinc-600">
        Click a clip in the timeline to edit its transform, color, audio and animation properties.
      </p>
    </div>
  );
}

export function Properties() {
  const selection = useEditor((s) => s.selection);
  const clip = useEditor((s) => s.project.clips.find((c) => c.id === s.selection));
  const updateClip = useEditor((s) => s.updateClip);
  const playhead = useEditor((s) => s.playhead);

  if (!clip) return <div className="h-full border-l border-white/8 bg-[#0a0a12]"><EmptyState /></div>;

  const patch = (p: Partial<Clip>) => updateClip(clip.id, p);
  const livePatch = (p: Partial<Clip>) => updateClip(clip.id, p, { history: false });

  const setStart = (v: string) => {
    const num = parseFloat(v);
    if (!isNaN(num) && num >= 0) patch({ start: num });
  };
  const setDuration = (v: string) => {
    const num = parseFloat(v);
    if (!isNaN(num) && num > 0.1) patch({ duration: Math.min(num, 3600) });
  };

  return (
    <div className="scrollbar-slim h-full overflow-y-auto border-l border-white/8 bg-[#0a0a12]">
      <div className="sticky top-0 z-10 border-b border-white/8 bg-[#0a0a12]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold",
              clip.type === "video" && "bg-violet-500/20 text-violet-300",
              clip.type === "audio" && "bg-emerald-500/20 text-emerald-300",
              clip.type === "image" && "bg-sky-500/20 text-sky-300",
              clip.type === "text" && "bg-amber-500/20 text-amber-300"
            )}
          >
            {clip.type === "video" ? "VID" : clip.type === "audio" ? "AUD" : clip.type === "image" ? "IMG" : "TXT"}
          </span>
          <input
            value={clip.name}
            onChange={(e) => livePatch({ name: e.target.value })}
            onBlur={() => patch({})}
            className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm font-semibold text-white hover:bg-white/5 focus:bg-white/5 focus:outline-none"
            maxLength={80}
            aria-label="Clip name"
          />
        </div>
        <p className="mt-1 px-1 text-[10px] text-zinc-600">
          {formatDuration(clip.start)} → {formatDuration(clip.start + clip.duration)} · {clip.duration.toFixed(1)}s{clip.speed !== 1 ? ` · ${clip.speed}×` : ""}
        </p>
      </div>

      <Tabs defaultValue={clip.type === "text" ? "text" : clip.type === "audio" ? "audio" : "transform"} className="px-4 pb-8">
        <TabsList className="mt-3 grid w-full grid-cols-4 bg-white/[0.04]">
          {clip.type === "text" ? (
            <>
              <TabsTrigger value="text" className="text-[10px] data-[state=active]:bg-violet-500/25">Text</TabsTrigger>
              <TabsTrigger value="transform" className="text-[10px] data-[state=active]:bg-violet-500/25">Layout</TabsTrigger>
              <TabsTrigger value="anim" className="text-[10px] data-[state=active]:bg-violet-500/25">Anim</TabsTrigger>
              <TabsTrigger value="timing" className="text-[10px] data-[state=active]:bg-violet-500/25">Timing</TabsTrigger>
            </>
          ) : clip.type === "audio" ? (
            <>
              <TabsTrigger value="audio" className="text-[10px] data-[state=active]:bg-violet-500/25">Audio</TabsTrigger>
              <TabsTrigger value="anim" className="text-[10px] data-[state=active]:bg-violet-500/25">Anim</TabsTrigger>
              <TabsTrigger value="timing" className="text-[10px] data-[state=active]:bg-violet-500/25">Timing</TabsTrigger>
              <TabsTrigger value="color" className="text-[10px] text-zinc-600" disabled>Color</TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="transform" className="text-[10px] data-[state=active]:bg-violet-500/25">Layout</TabsTrigger>
              <TabsTrigger value="color" className="text-[10px] data-[state=active]:bg-violet-500/25">Color</TabsTrigger>
              <TabsTrigger value="anim" className="text-[10px] data-[state=active]:bg-violet-500/25">Anim</TabsTrigger>
              <TabsTrigger value="timing" className="text-[10px] data-[state=active]:bg-violet-500/25">Timing</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Transform */}
        <TabsContent value="transform" className="mt-2">
          <NumRow label="Scale" value={clip.scale} min={0.1} max={4} step={0.01} onChange={(v) => livePatch({ scale: v })} suffix="×" />
          <NumRow label="Position X" value={clip.x} min={-1} max={1} step={0.01} onChange={(v) => livePatch({ x: v })} />
          <NumRow label="Position Y" value={clip.y} min={-1} max={1} step={0.01} onChange={(v) => livePatch({ y: v })} />
          <NumRow label="Rotation" value={clip.rotation} min={-180} max={180} step={1} onChange={(v) => livePatch({ rotation: v })} suffix="°" />
          <NumRow label="Opacity" value={clip.opacity} min={0} max={1} step={0.01} onChange={(v) => livePatch({ opacity: v })} />
          {clip.type === "video" && (
            <NumRow label="Volume" value={clip.volume} min={0} max={1} step={0.01} onChange={(v) => livePatch({ volume: v })} />
          )}
          {clip.type === "video" && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5">
              <span className="text-[11px] font-medium text-zinc-400">Mute audio</span>
              <button
                role="switch"
                aria-checked={!!clip.muted}
                onClick={() => patch({ muted: !clip.muted })}
                className={cn("h-5 w-9 rounded-full transition-colors relative", clip.muted ? "bg-rose-500/70" : "bg-white/15")}
              >
                <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", clip.muted ? "right-0.5" : "left-0.5")} />
              </button>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full border-white/10 bg-transparent text-xs text-zinc-400 hover:text-white"
            onClick={() => patch({ scale: 1, x: 0, y: 0, rotation: 0, opacity: 1 })}
          >
            <RotateCcw className="mr-1.5 h-3 w-3" /> Reset layout
          </Button>
        </TabsContent>

        {/* Color */}
        <TabsContent value="color" className="mt-2">
          <div className="mb-3 grid grid-cols-3 gap-1.5">
            {FILTER_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => patch({ color: { ...NEUTRAL_COLOR, ...p.color } as Clip["color"] })}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-all",
                  JSON.stringify(clip.color) === JSON.stringify({ ...NEUTRAL_COLOR, ...p.color })
                    ? "border-violet-400/50 bg-violet-500/15 text-white"
                    : "border-white/8 bg-white/[0.02] text-zinc-400 hover:text-white"
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
          <NumRow label="Brightness" value={clip.color.brightness} min={0.2} max={2} step={0.01} onChange={(v) => livePatch({ color: { ...clip.color, brightness: v } })} suffix="×" />
          <NumRow label="Contrast" value={clip.color.contrast} min={0.2} max={2} step={0.01} onChange={(v) => livePatch({ color: { ...clip.color, contrast: v } })} suffix="×" />
          <NumRow label="Saturation" value={clip.color.saturation} min={0} max={2} step={0.01} onChange={(v) => livePatch({ color: { ...clip.color, saturation: v } })} suffix="×" />
          <NumRow label="Hue shift" value={clip.color.hue} min={-180} max={180} step={1} onChange={(v) => livePatch({ color: { ...clip.color, hue: v } })} suffix="°" />
          <NumRow label="Blur" value={clip.color.blur} min={0} max={20} step={0.5} onChange={(v) => livePatch({ color: { ...clip.color, blur: v } })} suffix="px" />
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full border-white/10 bg-transparent text-xs text-zinc-400 hover:text-white"
            onClick={() => patch({ color: { ...NEUTRAL_COLOR } })}
          >
            <RotateCcw className="mr-1.5 h-3 w-3" /> Reset color
          </Button>
        </TabsContent>

        {/* Audio */}
        <TabsContent value="audio" className="mt-2">
          <NumRow label="Volume" value={clip.volume} min={0} max={1} step={0.01} onChange={(v) => livePatch({ volume: v })} />
          <NumRow label="Playback speed" value={clip.speed} min={0.25} max={4} step={0.05} onChange={(v) => patch({ speed: v })} suffix="×" />
          <div className="mt-3 flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5">
            <span className="text-[11px] font-medium text-zinc-400">Mute clip</span>
            <button
              role="switch"
              aria-checked={!!clip.muted}
              onClick={() => patch({ muted: !clip.muted })}
              className={cn("h-5 w-9 rounded-full transition-colors relative", clip.muted ? "bg-rose-500/70" : "bg-white/15")}
            >
              <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", clip.muted ? "right-0.5" : "left-0.5")} />
            </button>
          </div>
          <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-zinc-500">
            Waveform peaks are rendered on the timeline clip. Speed changes stretch the clip against its source audio.
          </div>
        </TabsContent>

        {/* Text */}
        <TabsContent value="text" className="mt-2">
          <Row label="Content">
            <textarea
              value={clip.text?.content ?? ""}
              onChange={(e) => livePatch({ text: { ...(clip.text ?? { fontSize: 0.05, color: "#fff", weight: 600, align: "center" as const, family: "sans" as const, bgOpacity: 0, letterSpacing: 0 }), content: e.target.value } })}
              rows={3}
              className="scrollbar-slim w-full resize-none rounded-lg border border-white/10 bg-black/40 p-2.5 text-xs text-zinc-200 focus:border-violet-400/50 focus:outline-none"
              placeholder="Type your text…"
            />
          </Row>
          <Row label="Font size" hint={`${Math.round((clip.text?.fontSize ?? 0.05) * 100)}% of height`}>
            <Slider value={[clip.text?.fontSize ?? 0.05]} min={0.02} max={0.2} step={0.002} onValueChange={([v]) => livePatch({ text: { ...clip.text!, fontSize: v } })} />
          </Row>
          <Row label="Color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={clip.text?.color ?? "#ffffff"}
                onChange={(e) => livePatch({ text: { ...clip.text!, color: e.target.value } })}
                className="h-8 w-10 cursor-pointer rounded-md border border-white/10 bg-transparent"
                aria-label="Text color"
              />
              <div className="flex gap-1.5">
                {["#ffffff", "#0b0b12", "#8b5cf6", "#22d3ee", "#f59e0b", "#f43f5e", "#10b981"].map((c) => (
                  <button
                    key={c}
                    onClick={() => livePatch({ text: { ...clip.text!, color: c } })}
                    className="h-6 w-6 rounded-md border border-white/15 transition-transform hover:scale-110"
                    style={{ background: c }}
                    aria-label={`Set text color ${c}`}
                  />
                ))}
              </div>
            </div>
          </Row>
          <Row label="Weight & align">
            <div className="flex gap-2">
              <Select value={String(clip.text?.weight ?? 600)} onValueChange={(v) => livePatch({ text: { ...clip.text!, weight: Number(v) } })}>
                <SelectTrigger className="h-8 flex-1 border-white/10 bg-white/[0.03] text-xs text-zinc-300"><SelectValue /></SelectTrigger>
                <SelectContent className="border-white/10 bg-[#101018]">
                  {[400, 500, 600, 700, 800].map((w) => (
                    <SelectItem key={w} value={String(w)} className="text-xs text-zinc-300">{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-1 overflow-hidden rounded-lg border border-white/10">
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => livePatch({ text: { ...clip.text!, align: a } })}
                    className={cn(
                      "flex-1 py-1.5 text-[10px] font-medium transition-colors",
                      clip.text?.align === a ? "bg-violet-500/25 text-white" : "text-zinc-500 hover:text-white"
                    )}
                  >
                    {a[0].toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </Row>
          <Row label="Font family">
            <Select value={clip.text?.family ?? "sans"} onValueChange={(v) => livePatch({ text: { ...clip.text!, family: v as "sans" } })}>
              <SelectTrigger className="h-8 border-white/10 bg-white/[0.03] text-xs text-zinc-300"><SelectValue /></SelectTrigger>
              <SelectContent className="border-white/10 bg-[#101018]">
                <SelectItem value="display" className="text-xs text-zinc-300">Display (Grotesk)</SelectItem>
                <SelectItem value="sans" className="text-xs text-zinc-300">Sans (Geist)</SelectItem>
                <SelectItem value="mono" className="text-xs text-zinc-300">Mono</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <NumRow label="Letter spacing" value={clip.text?.letterSpacing ?? 0} min={-0.05} max={0.4} step={0.005} onChange={(v) => livePatch({ text: { ...clip.text!, letterSpacing: v } })} suffix="em" />
          <NumRow label="Background box" value={clip.text?.bgOpacity ?? 0} min={0} max={1} step={0.05} onChange={(v) => livePatch({ text: { ...clip.text!, bgOpacity: v } })} />
        </TabsContent>

        {/* Animation */}
        <TabsContent value="anim" className="mt-2">
          <Row label="Animation preset">
            <Select value={clip.animation} onValueChange={(v) => patch({ animation: v as Clip["animation"] })}>
              <SelectTrigger className="h-8 border-white/10 bg-white/[0.03] text-xs text-zinc-300"><SelectValue /></SelectTrigger>
              <SelectContent className="border-white/10 bg-[#101018]">
                {ANIMATIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value} className="text-xs text-zinc-300">{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <NumRow
            label="Animation duration"
            value={clip.animationDuration}
            min={0.2}
            max={Math.max(0.3, clip.duration / 2)}
            step={0.1}
            onChange={(v) => patch({ animationDuration: v })}
            suffix="s"
          />
          <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-zinc-500">
            <Wand2 className="mb-1 h-3.5 w-3.5 text-violet-300" />
            Animations apply on top of opacity and scale. Ken Burns zooms the whole clip across its full duration for a cinematic feel.
          </div>
        </TabsContent>

        {/* Timing */}
        <TabsContent value="timing" className="mt-2">
          <Row label="Start time (seconds)">
            <Input
              type="number" min={0} step={0.1} value={Number(clip.start.toFixed(2))}
              onChange={(e) => setStart(e.target.value)}
              className="h-8 border-white/10 bg-black/40 text-xs"
            />
          </Row>
          <Row label="Duration (seconds)">
            <Input
              type="number" min={0.1} step={0.1} value={Number(clip.duration.toFixed(2))}
              onChange={(e) => setDuration(e.target.value)}
              className="h-8 border-white/10 bg-black/40 text-xs"
            />
          </Row>
          <Row label="Playback speed" hint={`${clip.speed}×`}>
            <Slider value={[clip.speed]} min={0.25} max={4} step={0.05} onValueChange={([v]) => patch({ speed: v })} />
          </Row>
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline" size="sm"
              className="flex-1 border-white/10 bg-transparent text-[11px] text-zinc-300 hover:text-white"
              onClick={() => patch({ start: Math.max(0, playhead - clip.duration / 2) })}
            >
              Center at playhead
            </Button>
          </div>
          <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-zinc-500">
            <Zap className="mb-1 h-3.5 w-3.5 text-cyan-300" />
            Split with <kbd className="rounded bg-white/10 px-1 font-mono">S</kbd> at the playhead, or drag clip edges in the timeline for visual trimming.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
