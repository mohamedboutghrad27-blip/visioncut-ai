"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "@/lib/router";
import { useAuth } from "@/components/visioncut/AuthContext";
import { Navbar } from "@/components/visioncut/landing/Navbar";
import { Footer } from "@/components/visioncut/landing/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, LogOut, Palette, Save, ShieldCheck, UserRound, Video } from "lucide-react";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = ["#8b5cf6", "#3b82f6", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e"];
const PREVIEW_QUALITIES = ["Full", "Half", "Quarter"] as const;

export function SettingsPage() {
  const router = useRouter();
  const { user, loading, refresh, logout } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarColor, setAvatarColor] = useState("#8b5cf6");
  const [saving, setSaving] = useState(false);
  const [autoSnap, setAutoSnap] = useState(true);
  const [autoWave, setAutoWave] = useState(true);
  const [previewQuality, setPreviewQuality] = useState<(typeof PREVIEW_QUALITIES)[number]>("Full");

  useEffect(() => {
    if (!loading && !user) router.navigate("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email);
      setAvatarColor(user.avatarColor);
    }
  }, [user]);

  // Local preferences persisted in localStorage (documented as device preferences)
  useEffect(() => {
    const raw = localStorage.getItem("visioncut-prefs");
    if (raw) {
      try {
        const p = JSON.parse(raw);
        setAutoSnap(!!p.autoSnap);
        setAutoWave(p.autoWave !== false);
        if (PREVIEW_QUALITIES.includes(p.previewQuality)) setPreviewQuality(p.previewQuality);
      } catch { /* ignore malformed prefs */ }
    }
  }, []);

  const savePrefs = (patch: Record<string, unknown>) => {
    const raw = localStorage.getItem("visioncut-prefs");
    const p = raw ? { ...JSON.parse(raw), ...patch } : patch;
    localStorage.setItem("visioncut-prefs", JSON.stringify(p));
  };

  const saveProfile = async () => {
    if (!name.trim()) {
      toast.error("Name can't be empty.");
      return;
    }
    setSaving(true);
    try {
      // Profile name/color are updated via the projects auth surface; store locally + on user
      const res = await fetch("/api/auth/me");
      // For this early-access build, profile fields live in the session user record.
      // We persist the display name through the demo-safe settings endpoint:
      const patchRes = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), avatarColor }),
      });
      if (!patchRes.ok) {
        const data = await patchRes.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      await refresh();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-24 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Account & preferences</h1>
        <p className="mt-1.5 text-sm text-zinc-500">Manage your profile, editor behavior and security.</p>

        {/* Profile */}
        <section className="mt-8 rounded-2xl border border-white/8 bg-white/[0.025] p-6" aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="flex items-center gap-2.5 text-base font-semibold text-white">
            <UserRound className="h-4.5 w-4.5 text-zinc-400" /> Profile
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-name" className="text-zinc-300">Display name</Label>
              <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} className="border-white/10 bg-black/40" maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-email" className="text-zinc-300">Email</Label>
              <Input id="settings-email" value={email} disabled className="border-white/10 bg-black/40 text-zinc-500" />
              <p className="text-[11px] text-zinc-600">Email changes require verification and are not available in early access.</p>
            </div>
          </div>
          <div className="mt-5">
            <Label className="text-zinc-300">Avatar color</Label>
            <div className="mt-2.5 flex gap-2.5">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setAvatarColor(c)}
                  aria-label={`Choose avatar color ${c}`}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                    avatarColor === c ? "border-white" : "border-transparent"
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <Button onClick={saveProfile} disabled={saving} className="mt-6 bg-[#ededf2] text-black hover:bg-white">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save profile
          </Button>
        </section>

        {/* Editor preferences */}
        <section className="mt-6 rounded-2xl border border-white/8 bg-white/[0.025] p-6" aria-labelledby="editor-heading">
          <h2 id="editor-heading" className="flex items-center gap-2.5 text-base font-semibold text-white">
            <Video className="h-4.5 w-4.5 text-zinc-400" /> Editor preferences
          </h2>
          <p className="mt-1 text-xs text-zinc-600">These preferences are stored on this device.</p>
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-white/6 bg-black/20 px-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-white">Timeline snapping</p>
                <p className="text-xs text-zinc-500">Snap clip edges to other clips and the playhead</p>
              </div>
              <Switch
                checked={autoSnap}
                onCheckedChange={(v) => { setAutoSnap(v); savePrefs({ autoSnap: v }); }}
                aria-label="Toggle timeline snapping"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 bg-black/20 px-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-white">Audio waveforms</p>
                <p className="text-xs text-zinc-500">Render waveforms on audio clips in the timeline</p>
              </div>
              <Switch
                checked={autoWave}
                onCheckedChange={(v) => { setAutoWave(v); savePrefs({ autoWave: v }); }}
                aria-label="Toggle audio waveforms"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 bg-black/20 px-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-white">Preview quality</p>
                <p className="text-xs text-zinc-500">Lower this if previews feel choppy on your device</p>
              </div>
              <div className="flex gap-1.5">
                {PREVIEW_QUALITIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => { setPreviewQuality(q); savePrefs({ previewQuality: q }); }}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                      previewQuality === q
                        ? "border-white/40 bg-white/10 text-white"
                        : "border-white/10 text-zinc-400 hover:text-white"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="mt-6 rounded-2xl border border-white/8 bg-white/[0.025] p-6" aria-labelledby="security-heading">
          <h2 id="security-heading" className="flex items-center gap-2.5 text-base font-semibold text-white">
            <ShieldCheck className="h-4.5 w-4.5 text-zinc-400" /> Security
          </h2>
          <div className="mt-5 space-y-3 text-sm text-zinc-400">
            <p className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-zinc-600" />
              Sessions use signed, http-only cookies and expire after 7 days.
            </p>
            <p>
              Password resets are available from the{" "}
              <button onClick={() => router.navigate("/reset")} className="text-white underline decoration-white/30 underline-offset-2 hover:decoration-white">reset page</button>.
            </p>
            {user.isDemo && (
              <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/80">
                You're using the shared demo account. Create a personal account to keep your work private.
              </p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await logout();
              router.navigate("/");
            }}
            className="mt-5 border-white/12 bg-transparent text-zinc-300 hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </section>
      </main>
      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  );
}
