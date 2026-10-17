"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "@/lib/router";
import { useAuth } from "@/components/visioncut/AuthContext";
import { useEditor } from "@/lib/editor/store";
import { ASPECT_LIST, type AspectRatio } from "@/lib/editor/types";
import { Logo } from "@/components/visioncut/shared";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft, Check, CircleAlert, CloudUpload, Download, Loader2, Pencil,
  Redo2, Save, Settings, Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

function ToolButton({
  children, label, onClick, disabled, className,
}: { children: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <TooltipProvider delayDuration={350}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-35",
              className
            )}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="border-white/10 bg-[#101018] text-xs text-zinc-300">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatAgo(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

function SaveStatusChip() {
  const saveStatus = useEditor((s) => s.saveStatus);
  const lastSavedAt = useEditor((s) => s.lastSavedAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const ago = lastSavedAt ? formatAgo(now - lastSavedAt) : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium",
        saveStatus === "saved" && "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
        saveStatus === "saving" && "border-violet-400/25 bg-violet-400/10 text-violet-300",
        saveStatus === "unsaved" && "border-amber-400/25 bg-amber-400/10 text-amber-300",
        saveStatus === "error" && "border-rose-400/25 bg-rose-400/10 text-rose-300"
      )}
      aria-live="polite"
    >
      {saveStatus === "saved" && <><Check className="h-3 w-3" /> Saved{ago && ` · ${ago}`}</>}
      {saveStatus === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
      {saveStatus === "unsaved" && <><CloudUpload className="h-3 w-3" /> Unsaved changes</>}
      {saveStatus === "error" && <><CircleAlert className="h-3 w-3" /> Save failed</>}
    </span>
  );
}

export function Toolbar({ onOpenExport }: { onOpenExport: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const name = useEditor((s) => s.project.name);
  const setName = useEditor((s) => s.setName);
  const aspectRatio = useEditor((s) => s.project.aspectRatio);
  const setAspectRatio = useEditor((s) => s.setAspectRatio);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const saveStatus = useEditor((s) => s.saveStatus);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  const commitName = () => {
    const clean = draft.trim();
    if (clean) setName(clean.slice(0, 120));
    setEditing(false);
  };

  const saveNow = () => {
    const store = useEditor.getState();
    if (store.saveStatus !== "saved") store.setSaveStatus("unsaved");
    store.requestSave();
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/8 bg-[#0a0a12] px-3">
      <button
        onClick={() => {
          if (useEditor.getState().saveStatus === "unsaved") saveNow();
          router.navigate("/dashboard");
        }}
        className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-zinc-400 transition-colors hover:bg-white/8 hover:text-white"
        aria-label="Back to dashboard"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </button>

      <div className="mx-1 hidden h-6 items-center sm:flex">
        <Logo size="sm" withWordmark={false} />
      </div>

      <div className="mx-1 h-5 w-px bg-white/10" />

      {/* Project name (inline edit) */}
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          autoFocus
          maxLength={120}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitName();
            if (e.key === "Escape") {
              setDraft(name);
              setEditing(false);
            }
          }}
          className="w-56 rounded-md border border-violet-400/40 bg-black/50 px-2 py-1 text-sm text-white focus:outline-none"
          aria-label="Project name"
        />
      ) : (
        <button
          onClick={() => { setDraft(name); setEditing(true); setTimeout(() => inputRef.current?.select(), 10); }}
          className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/8"
          aria-label="Rename project"
        >
          <span className="max-w-48 truncate">{name}</span>
          <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
        </button>
      )}

      <div className="ml-1 hidden md:block">
        <SaveStatusChip />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ToolButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
          <Redo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Save project (Ctrl+S)" onClick={saveNow} className="text-zinc-400">
          <Save className="h-4 w-4" />
        </ToolButton>

        <div className="mx-1.5 h-5 w-px bg-white/10" />

        <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
          <SelectTrigger className="h-8 w-[132px] border-white/10 bg-white/[0.04] text-xs text-zinc-300 focus:ring-violet-400/40" aria-label="Aspect ratio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#101018]">
            {ASPECT_LIST.map((a) => (
              <SelectItem key={a.value} value={a.value} className="text-xs text-zinc-300 hover:!bg-white/10 hover:text-white">
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          onClick={onOpenExport}
          className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-400 px-3.5 text-xs font-semibold text-white shadow-[0_0_16px_-4px_rgba(139,92,246,0.7)] transition-all hover:brightness-110"
        >
          <Download className="h-3.5 w-3.5" /> Export
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1.5 rounded-full" aria-label="Account and settings">
              <Avatar className="h-7 w-7 border border-white/15">
                <AvatarFallback
                  className="text-[10px] font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${user?.avatarColor || "#8b5cf6"}, #0b0b12)` }}
                >
                  {(user?.name || user?.email || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 border-white/10 bg-[#101018]">
            <DropdownMenuLabel className="text-zinc-400">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/8" />
            <DropdownMenuItem onClick={() => router.navigate("/settings")} className="text-zinc-300 hover:!bg-white/10 hover:text-white">
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.navigate("/help")} className="text-zinc-300 hover:!bg-white/10 hover:text-white">
              Help & shortcuts
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
