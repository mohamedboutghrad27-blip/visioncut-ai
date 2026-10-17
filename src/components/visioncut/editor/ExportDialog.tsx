"use client";

import React, { useMemo, useRef, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import {
  type ExportSettings, startExport, pickMimeType, estimateSizeBytes, downloadBlob, safeFilename,
} from "@/lib/editor/export";
import { formatDuration } from "@/lib/editor/types";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, Download, Film, Info, Loader2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RESOLUTIONS: { value: ExportSettings["resolution"]; label: string }[] = [
  { value: "480p", label: "480p Draft" },
  { value: "720p", label: "720p HD" },
  { value: "1080p", label: "1080p Full HD" },
  { value: "1440p", label: "1440p QHD" },
  { value: "4K", label: "4K UHD" },
];
const FRAMERATES: ExportSettings["fps"][] = [24, 25, 30, 50, 60];
const QUALITIES: { value: ExportSettings["quality"]; label: string; desc: string }[] = [
  { value: "draft", label: "Draft", desc: "Smallest file, fastest" },
  { value: "standard", label: "Standard", desc: "Balanced quality" },
  { value: "high", label: "High", desc: "Crisp detail" },
  { value: "maximum", label: "Maximum", desc: "Master quality" },
];

type Phase = "settings" | "rendering" | "done" | "error";

export function ExportDialog({ open, onOpenChange, onExported }: { open: boolean; onOpenChange: (v: boolean) => void; onExported?: () => void }) {
  const project = useEditor((s) => s.project);
  const [settings, setSettings] = useState<ExportSettings>({
    resolution: "1080p",
    fps: 30,
    format: "webm",
    quality: "standard",
    audioBitrateKbps: 192,
  });
  const [phase, setPhase] = useState<Phase>("settings");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; ext: string; fallbackNotice: boolean } | null>(null);
  const handleRef = useRef<ReturnType<typeof startExport> | null>(null);

  const supported = useMemo(() => {
    if (typeof MediaRecorder === "undefined") return { ok: false, note: "This browser does not support MediaRecorder, which the export pipeline requires." };
    const webm = MediaRecorder.isTypeSupported("video/webm");
    const mp4 = MediaRecorder.isTypeSupported("video/mp4") || MediaRecorder.isTypeSupported("video/mp4;codecs=avc1");
    return { ok: webm || mp4, webm, mp4, note: "" };
  }, []);

  const estimated = useMemo(() => {
    if (project.duration <= 0) return null;
    return estimateSizeBytes(project.duration, settings, project.aspectRatio);
  }, [project.duration, settings, project.aspectRatio]);

  const start = () => {
    if (project.duration <= 0 || project.clips.length === 0) {
      toast.error("Add at least one clip to the timeline before exporting.");
      return;
    }
    setPhase("rendering");
    setProgress(0);
    setError(null);

    const handle = startExport(
      useEditor.getState().project,
      settings,
      (p, s) => {
        setProgress(p);
        setStage(s);
      },
      () => {
        /* done handled by promise */
      }
    );
    handleRef.current = handle;

    handle.promise
      .then(({ blob, ext, mimeType }) => {
        const actualExt = ext;
        const fallbackNotice = settings.format === "mp4" && actualExt !== "mp4";
        setResult({ blob, ext: actualExt, fallbackNotice });
        setPhase("done");
        downloadBlob(blob, safeFilename(project.name, actualExt));
        toast.success("Export complete — download started", {
          description: `${(blob.size / 1048576).toFixed(1)}MB ${actualExt.toUpperCase()} · verified before download.`,
        });
        onExported?.();
      })
      .catch((err) => {
        if (err?.name === "AbortError" || err?.message?.includes("cancel")) {
          setPhase("settings");
          return;
        }
        console.error("[export]", err);
        setError(err instanceof Error ? err.message : "Export failed unexpectedly.");
        setPhase("error");
      });
  };

  const cancel = () => {
    handleRef.current?.cancel();
    handleRef.current = null;
    setPhase("settings");
  };

  const dl = settings.format === "webm" ? supported.webm !== false : supported.mp4 === true;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && phase === "rendering") return; onOpenChange(v); }}>
      <DialogContent className="border-white/10 bg-[#0d0d16] sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Film className="h-4.5 w-4.5 text-violet-300" /> Export video
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            {formatDuration(project.duration)} · {project.aspectRatio} · rendered in your browser by the same engine as the preview
          </DialogDescription>
        </DialogHeader>

        {phase === "settings" && (
          <div className="space-y-4">
            {!supported.ok && (
              <div className="flex gap-2.5 rounded-xl border border-rose-400/25 bg-rose-500/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <p className="text-[11px] leading-relaxed text-rose-200">{supported.note}</p>
              </div>
            )}
            {settings.format === "mp4" && supported.ok && !supported.mp4 && (
              <div className="flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <p className="text-[11px] leading-relaxed text-amber-200/90">
                  MP4 encoding isn&apos;t supported by this browser — the export will produce WebM instead (universally playable, including by editors and social platforms).
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Resolution">
                <select
                  value={settings.resolution}
                  onChange={(e) => setSettings({ ...settings, resolution: e.target.value as ExportSettings["resolution"] })}
                  className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 text-xs text-zinc-200 focus:border-violet-400/50 focus:outline-none"
                >
                  {RESOLUTIONS.map((r) => (
                    <option key={r.value} value={r.value} className="bg-[#101018]">{r.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Frame rate">
                <select
                  value={settings.fps}
                  onChange={(e) => setSettings({ ...settings, fps: Number(e.target.value) as ExportSettings["fps"] })}
                  className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 text-xs text-zinc-200 focus:border-violet-400/50 focus:outline-none"
                >
                  {FRAMERATES.map((f) => (
                    <option key={f} value={f} className="bg-[#101018]">{f} FPS</option>
                  ))}
                </select>
              </Field>
              <Field label="Format">
                <select
                  value={settings.format}
                  onChange={(e) => setSettings({ ...settings, format: e.target.value as ExportSettings["format"] })}
                  className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 text-xs text-zinc-200 focus:border-violet-400/50 focus:outline-none"
                >
                  <option value="webm" className="bg-[#101018]">WebM (VP9)</option>
                  <option value="mp4" className="bg-[#101018]">MP4 (H.264, where supported)</option>
                </select>
              </Field>
              <Field label="Audio bitrate">
                <select
                  value={settings.audioBitrateKbps}
                  onChange={(e) => setSettings({ ...settings, audioBitrateKbps: Number(e.target.value) as ExportSettings["audioBitrateKbps"] })}
                  className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 text-xs text-zinc-200 focus:border-violet-400/50 focus:outline-none"
                >
                  {[128, 192, 256].map((b) => (
                    <option key={b} value={b} className="bg-[#101018]">{b} kbps</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Quality preset">
              <div className="grid grid-cols-4 gap-1.5">
                {QUALITIES.map((q) => (
                  <button
                    key={q.value}
                    onClick={() => setSettings({ ...settings, quality: q.value })}
                    title={q.desc}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-[10px] font-semibold transition-all",
                      settings.quality === q.value
                        ? "border-violet-400/50 bg-violet-500/20 text-white"
                        : "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-white"
                    )}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </Field>

            {estimated != null && (
              <p className="flex items-center gap-2 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-400">
                <Info className="h-3.5 w-3.5 text-cyan-300" />
                Estimated size: <strong className="text-zinc-200">{(estimated / 1048576).toFixed(1)} MB</strong>
                <span className="text-zinc-600">(rendering runs at 1× real time)</span>
              </p>
            )}

            <button
              onClick={start}
              disabled={!supported.ok}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-400 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(139,92,246,0.7)] transition-all hover:brightness-110 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Start export
            </button>
          </div>
        )}

        {phase === "rendering" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">Rendering your video…</p>
                <p className="truncate text-[11px] text-zinc-500">{stage}</p>
              </div>
              <span className="font-mono text-sm tabular-nums text-violet-300">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-[width] duration-300"
                style={{ width: `${Math.max(2, progress * 100)}%` }}
              />
            </div>
            <p className="text-[10px] leading-relaxed text-zinc-600">
              Frame-accurate capture runs at 1× real time — keep this tab visible for the best results. You can cancel safely at any point.
            </p>
            <button
              onClick={cancel}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] text-xs font-semibold text-zinc-300 hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-3.5 w-3.5" /> Cancel export
            </button>
          </div>
        )}

        {phase === "done" && result && (
          <div className="space-y-4 py-2 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-white">Export verified & downloaded</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {(result.blob.size / 1048576).toFixed(1)}MB · {result.ext.toUpperCase()} · {settings.resolution} · {settings.fps}fps
              </p>
              {result.fallbackNotice && (
                <p className="mx-auto mt-2 max-w-sm rounded-lg border border-amber-400/25 bg-amber-400/10 p-2 text-[10px] text-amber-200/90">
                  Note: MP4 isn&apos;t supported by this browser, so the file was encoded as WebM — playable everywhere.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => downloadBlob(result.blob, safeFilename(project.name, result.ext))}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] text-xs font-semibold text-zinc-200 hover:bg-white/[0.08]"
              >
                <Download className="h-3.5 w-3.5" /> Download again
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-cyan-400 text-xs font-semibold text-white hover:brightness-110"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-4 py-2 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-rose-400" />
            <p className="text-sm font-semibold text-white">Export failed</p>
            <p className="mx-auto max-w-sm text-[11px] leading-relaxed text-zinc-500">{error}</p>
            <button
              onClick={() => setPhase("settings")}
              className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-xs font-semibold text-zinc-200 hover:bg-white/[0.08]"
            >
              Back to settings
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
