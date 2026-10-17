"use client";

import { create } from "zustand";
import {
  type Asset, type Clip, type ProjectState, type Track, type AspectRatio,
  computeDuration, clipEnd, uid, newClip, type ClipType,
} from "./types";

export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

const HISTORY_LIMIT = 60;

function snapshot(state: ProjectState): string {
  return JSON.stringify(state);
}

function emptyProject(name = "Untitled Project", aspectRatio: AspectRatio = "16:9"): ProjectState {
  return {
    version: 1,
    name,
    aspectRatio,
    tracks: [
      { id: "v1", type: "video", name: "Video 1", muted: false, hidden: false, locked: false, height: 64 },
      { id: "a1", type: "audio", name: "Audio 1", muted: false, hidden: false, locked: false, height: 56 },
    ],
    clips: [],
    assets: [],
    duration: 0,
  };
}

export type EditorStore = {
  projectId: string | null;
  project: ProjectState;
  /* transient ui state */
  selection: string | null;
  playhead: number;
  playing: boolean;
  zoom: number; // px per second
  snapping: boolean;
  loop: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  previewQualityScale: number; // 1 | 0.66 | 0.4
  showRatioGuides: boolean;
  /* history */
  past: string[];
  future: string[];
  /* actions */
  loadProject: (projectId: string, project: ProjectState) => void;
  setName: (name: string) => void;
  setAspectRatio: (ar: AspectRatio) => void;
  commit: (label?: string) => void; // push snapshot to past (call BEFORE mutation for explicit ops we choose)
  undo: () => void;
  redo: () => void;
  /* clips */
  addClip: (clip: Clip, opts?: { select?: boolean }) => void;
  addClipFromAsset: (asset: Asset, trackId?: string, atStart?: number) => Clip | null;
  updateClip: (id: string, patch: Partial<Clip>, opts?: { history?: boolean }) => void;
  removeClip: (id: string) => void;
  duplicateClip: (id: string) => void;
  splitClip: (id: string, atTime: number) => void;
  select: (id: string | null) => void;
  /* tracks */
  addTrack: (type: "video" | "audio") => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  /* playback & ui */
  setPlayhead: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setZoom: (z: number) => void;
  setSnapping: (s: boolean) => void;
  setLoop: (l: boolean) => void;
  setPreviewQualityScale: (s: number) => void;
  setShowRatioGuides: (v: boolean) => void;
  setSaveStatus: (s: SaveStatus) => void;
  markSaved: () => void;
  saveRequestTick: number;
  requestSave: () => void;
  /* assets */
  addAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;
};

export const useEditor = create<EditorStore>((set, get) => ({
  projectId: null,
  project: emptyProject(),
  selection: null,
  playhead: 0,
  playing: false,
  zoom: 64,
  snapping: true,
  loop: false,
  saveStatus: "saved",
  lastSavedAt: null,
  previewQualityScale: 1,
  showRatioGuides: false,
  past: [],
  future: [],

  loadProject: (projectId, project) =>
    set({
      projectId,
      project: { ...project, duration: computeDuration(project.clips) },
      past: [],
      future: [],
      selection: null,
      playhead: 0,
      playing: false,
      saveStatus: "saved",
    }),

  setName: (name) =>
    set((s) => ({ project: { ...s.project, name }, saveStatus: "unsaved" })),

  setAspectRatio: (ar) => {
    get().commit();
    set((s) => ({ project: { ...s.project, aspectRatio: ar }, saveStatus: "unsaved" }));
  },

  commit: () =>
    set((s) => ({
      past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot(s.project)],
      future: [],
    })),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s;
      const past = [...s.past];
      const prev = past.pop()!;
      return {
        past,
        future: [snapshot(s.project), ...s.future].slice(0, HISTORY_LIMIT),
        project: JSON.parse(prev),
        saveStatus: "unsaved",
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const [next, ...rest] = s.future;
      return {
        past: [...s.past, snapshot(s.project)],
        future: rest,
        project: JSON.parse(next),
        saveStatus: "unsaved",
      };
    }),

  addClip: (clip, opts) => {
    get().commit();
    set((s) => ({
      project: { ...s.project, clips: [...s.project.clips, clip], duration: computeDuration([...s.project.clips, clip]) },
      selection: opts?.select === false ? s.selection : clip.id,
      saveStatus: "unsaved",
    }));
  },

  addClipFromAsset: (asset, trackId, atStart) => {
    const st = get();
    const duration =
      asset.kind === "image" ? 4 : Math.max(0.5, asset.duration ?? 4);
    // find a suitable track
    let targetTrackId = trackId;
    if (!targetTrackId) {
      const wantedTrackType = asset.kind === "audio" ? "audio" : "video";
      const track = st.project.tracks.find((t) => t.type === wantedTrackType && !t.locked);
      if (!track) return null;
      targetTrackId = track.id;
    }
    const track = st.project.tracks.find((t) => t.id === targetTrackId);
    if (!track || track.locked) return null;

    // place at playhead if free, otherwise after the last clip on the track
    const trackClips = st.project.clips.filter((c) => c.trackId === targetTrackId);
    let start = atStart ?? st.playhead;
    const overlaps = (s: number, e: number) =>
      trackClips.some((c) => s < clipEnd(c) - 1e-6 && e > c.start + 1e-6);
    if (overlaps(start, start + duration)) {
      start = trackClips.reduce((m, c) => Math.max(m, clipEnd(c)), 0);
    }
    const clip = newClip({
      trackId: targetTrackId,
      type: asset.kind,
      name: asset.name,
      assetId: asset.id,
      start: Math.max(0, start),
      duration,
      peaks: undefined,
    });
    st.addClip(clip);
    return clip;
  },

  updateClip: (id, patch, opts) => {
    if (opts?.history !== false) get().commit();
    set((s) => {
      const clips = s.project.clips.map((c) => (c.id === id ? { ...c, ...patch } : c));
      return { project: { ...s.project, clips, duration: computeDuration(clips) }, saveStatus: "unsaved" };
    });
  },

  removeClip: (id) => {
    get().commit();
    set((s) => {
      const clips = s.project.clips.filter((c) => c.id !== id);
      return {
        project: { ...s.project, clips, duration: computeDuration(clips) },
        selection: s.selection === id ? null : s.selection,
        saveStatus: "unsaved",
      };
    });
  },

  duplicateClip: (id) => {
    const st = get();
    const clip = st.project.clips.find((c) => c.id === id);
    if (!clip) return;
    const copy: Clip = { ...structuredClone(clip), id: uid(), start: clipEnd(clip) };
    st.addClip(copy);
  },

  splitClip: (id, atTime) => {
    const st = get();
    const clip = st.project.clips.find((c) => c.id === id);
    if (!clip) return;
    const local = atTime - clip.start;
    if (local <= 0.05 || local >= clip.duration - 0.05) {
      return; // nothing meaningful to split
    }
    st.commit();
    const left: Clip = { ...structuredClone(clip), duration: local };
    const right: Clip = {
      ...structuredClone(clip),
      id: uid(),
      start: clip.start + local,
      duration: clip.duration - local,
      trimStart: clip.trimStart + local * clip.speed,
    };
    set((s) => {
      const clips = s.project.clips.flatMap((c) => (c.id === id ? [left, right] : [c]));
      return { project: { ...s.project, clips, duration: computeDuration(clips) }, selection: right.id, saveStatus: "unsaved" };
    });
  },

  select: (id) => set({ selection: id }),

  addTrack: (type) => {
    get().commit();
    set((s) => {
      const count = s.project.tracks.filter((t) => t.type === type).length + 1;
      const track: Track = {
        id: uid(type === "video" ? "v" : "a"),
        type,
        name: `${type === "video" ? "Video" : "Audio"} ${count}`,
        muted: false, hidden: false, locked: false,
        height: type === "video" ? 64 : 56,
      };
      // insert video tracks above existing video tracks (top of list), audio below
      const insertIdx = type === "video" ? 0 : s.project.tracks.length;
      const tracks = [...s.project.tracks];
      tracks.splice(insertIdx, 0, track);
      return { project: { ...s.project, tracks }, saveStatus: "unsaved" };
    });
  },

  removeTrack: (id) => {
    get().commit();
    set((s) => {
      const tracks = s.project.tracks.filter((t) => t.id !== id);
      const clips = s.project.clips.filter((c) => c.trackId !== id);
      return {
        project: { ...s.project, tracks, clips, duration: computeDuration(clips) },
        saveStatus: "unsaved",
      };
    });
  },

  updateTrack: (id, patch) =>
    set((s) => ({
      project: { ...s.project, tracks: s.project.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) },
      saveStatus: "unsaved",
    })),

  setPlayhead: (t) => set({ playhead: Math.max(0, t) }),
  setPlaying: (p) => set({ playing: p }),
  setZoom: (z) => set({ zoom: Math.min(400, Math.max(8, z)) }),
  setSnapping: (snapping) => set({ snapping }),
  setLoop: (loop) => set({ loop }),
  setPreviewQualityScale: (previewQualityScale) => set({ previewQualityScale }),
  setShowRatioGuides: (showRatioGuides) => set({ showRatioGuides }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  markSaved: () => set({ saveStatus: "saved", lastSavedAt: Date.now() }),
  saveRequestTick: 0,
  requestSave: () => set((s) => ({ saveRequestTick: s.saveRequestTick + 1 })),

  addAsset: (asset) =>
    set((s) => ({ project: { ...s.project, assets: [...s.project.assets, asset] }, saveStatus: "unsaved" })),

  removeAsset: (id) =>
    set((s) => ({
      project: { ...s.project, assets: s.project.assets.filter((a) => a.id !== id) },
      clips: s.project.clips.filter((c) => c.assetId !== id),
      saveStatus: "unsaved",
    })),
}));

/** Helper: create a text clip with sensible defaults */
export function makeTextClip(trackId: string, preset: "title" | "subtitle" | "caption", at: number): Clip {
  const base = { trackId, type: "text" as ClipType, start: at, duration: 4 };
  if (preset === "title")
    return newClip({
      ...base,
      name: "Title",
      y: -0.05,
      text: { content: "Your Title Here", fontSize: 0.085, color: "#ffffff", weight: 700, align: "center", family: "display", bgOpacity: 0, letterSpacing: 0.02 },
      animation: "fadeIn",
    });
  if (preset === "subtitle")
    return newClip({
      ...base,
      name: "Subtitle",
      y: 0.18,
      duration: 5,
      text: { content: "A supporting subtitle line", fontSize: 0.045, color: "#e6e6f0", weight: 500, align: "center", family: "sans", bgOpacity: 0, letterSpacing: 0 },
    });
  return newClip({
    ...base,
    name: "Caption",
    y: 0.34,
    duration: 3,
    text: { content: "Caption text", fontSize: 0.038, color: "#ffffff", weight: 600, align: "center", family: "sans", bgOpacity: 0.55, letterSpacing: 0 },
  });
}
