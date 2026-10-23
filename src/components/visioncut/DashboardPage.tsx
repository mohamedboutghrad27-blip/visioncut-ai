"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "@/lib/router";
import { useAuth } from "@/components/visioncut/AuthContext";
import { Logo, ThumbGradient, GradientButton } from "@/components/visioncut/shared";
import { Navbar } from "@/components/visioncut/landing/Navbar";
import { Footer } from "@/components/visioncut/landing/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Clapperboard, Copy, FileVideo, Loader2, MoreVertical, Pencil, Plus,
  Sparkles, Trash2, Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ProjectMeta = {
  id: string;
  name: string;
  aspectRatio: string;
  thumbnail: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

const RATIO_BOX: Record<string, string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16] max-h-48 mx-auto",
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "21:9": "aspect-[21/9]",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<ProjectMeta | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<ProjectMeta | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      if (res.status === 401) {
        router.navigate("/login");
        return;
      }
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch {
      toast.error("Could not load your projects.");
      setProjects([]);
    }
  }, [router]);

  useEffect(() => {
    if (!authLoading && !user) router.navigate("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) loadProjects();
  }, [user, loadProjects]);

  const createProject = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create project");
      router.navigate(`/editor/${data.project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setCreating(false);
    }
  };

  const confirmRename = async () => {
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error("Project name can't be empty.");
      return;
    }
    try {
      const res = await fetch(`/api/projects/${renaming.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Rename failed");
      setProjects((prev) => prev?.map((p) => (p.id === renaming.id ? { ...p, name } : p)) ?? null);
      toast.success("Project renamed");
    } catch {
      toast.error("Rename failed");
    } finally {
      setRenaming(null);
    }
  };

  const duplicate = async (p: ProjectMeta) => {
    try {
      const res = await fetch(`/api/projects/${p.id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Duplicate failed");
      toast.success("Project duplicated");
      loadProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Duplicate failed");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/projects/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setProjects((prev) => prev?.filter((p) => p.id !== deleting.id) ?? null);
      toast.success("Project deleted");
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleteBusy(false);
      setDeleting(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
                Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}
              </h1>
              {user.isDemo && (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Demo Account
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-zinc-500">
              {projects === null ? "Loading your projects…" : `${projects.length} project${projects.length === 1 ? "" : "s"} in your workspace`}
            </p>
          </div>
          <GradientButton onClick={createProject} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            New Project
          </GradientButton>
        </div>

        {/* Quick actions */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: Clapperboard, title: "Blank project", desc: "Start with an empty multitrack timeline", action: createProject },
            { icon: Wand2, title: "AI storyboard", desc: "Paste a script → get scenes & narration", action: () => toast.info("Create a project first", { description: "The AI panel lives inside the editor." }) },
            { icon: FileVideo, title: "Vertical short", desc: "9:16 project for Reels & TikTok", action: async () => {
              setCreating(true);
              try {
                const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Untitled Short", aspectRatio: "9:16" }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                router.navigate(`/editor/${data.project.id}`);
              } catch { toast.error("Could not create project"); setCreating(false); }
            } },
          ].map((c) => (
            <button
              key={c.title}
              onClick={c.action}
              className="card-hover group flex items-start gap-4 rounded-xl border border-white/[0.08] bg-white/[0.015] p-5 text-left"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300">
                <c.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">{c.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{c.desc}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Projects */}
        <h2 className="font-display mt-12 text-lg font-semibold text-white">Recent projects</h2>
        {projects === null ? (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/8 p-3">
                <Skeleton className="aspect-video w-full rounded-xl bg-white/5 skeleton-shimmer" />
                <Skeleton className="mt-3 h-4 w-2/3 bg-white/5" />
                <Skeleton className="mt-2 h-3 w-1/3 bg-white/5" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-6 flex flex-col items-center rounded-3xl border border-dashed border-white/12 bg-white/[0.015] py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-300">
              <Sparkles className="h-6 w-6" />
            </span>
            <h3 className="font-display mt-5 text-lg font-semibold text-white">No projects yet</h3>
            <p className="mt-2 max-w-sm text-sm text-zinc-500">
              Create your first project and discover a professional timeline with AI tools built in.
            </p>
            <GradientButton className="mt-6" onClick={createProject} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create your first project
            </GradientButton>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((p) => (
              <div
                key={p.id}
                className="card-hover group cursor-pointer overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a0a]"
                onClick={() => router.navigate(`/editor/${p.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && router.navigate(`/editor/${p.id}`)}
                aria-label={`Open project ${p.name}`}
              >
                <div className={cn("relative w-full overflow-hidden", RATIO_BOX[p.aspectRatio] || "aspect-video")}>
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <ThumbGradient seed={p.id + p.name} />
                  )}
                  {p.isDemo && (
                    <span className="absolute left-2 top-2 rounded-md bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                      Example
                    </span>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm border border-white/25">
                      Open in Editor
                    </span>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-white">{p.name}</h3>
                    <p className="mt-1 text-xs text-zinc-600">
                      {p.aspectRatio} · edited {timeAgo(p.updatedAt)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-zinc-500 hover:text-white" aria-label="Project actions">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-white/10 bg-[#101018]" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => { setRenaming(p); setRenameValue(p.name); }} className="text-zinc-300 hover:!bg-white/10 hover:text-white">
                        <Pencil className="mr-2 h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicate(p)} className="text-zinc-300 hover:!bg-white/10 hover:text-white">
                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/8" />
                      <DropdownMenuItem onClick={() => setDeleting(p)} className="text-rose-400 hover:!bg-rose-500/10 hover:!text-rose-300">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <div className="mt-auto">
        <Footer />
      </div>

      {/* Rename dialog */}
      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="border-white/10 bg-[#101018] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Rename project</DialogTitle>
            <DialogDescription className="text-zinc-500">Choose a name that helps you find it later.</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmRename()}
            className="border-white/10 bg-black/40"
            maxLength={120}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)} className="text-zinc-400 hover:text-white">Cancel</Button>
            <Button onClick={confirmRename} className="bg-[#ededf2] text-black hover:bg-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="border-white/10 bg-[#101018] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Delete “{deleting?.name}”?</DialogTitle>
            <DialogDescription className="text-zinc-500">
              This permanently removes the project and its saved timeline. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)} className="text-zinc-400 hover:text-white">Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
