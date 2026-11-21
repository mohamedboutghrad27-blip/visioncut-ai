"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "@/lib/router";
import {
  ArrowLeft,
  Clock,
  Database,
  Film,
  HardDrive,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type ProjectRow = {
  id: string;
  name: string;
  aspectRatio: string;
  isDemo: boolean;
  clips: number;
  updatedAt: string;
  owner: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  isDemo: boolean;
  createdAt: string;
  projects: number;
  media: number;
};

type AdminStats = {
  generatedAt: string;
  users: { total: number; last7d: number; last30d: number; demo: number };
  projects: {
    total: number;
    demo: number;
    clipsTotal: number;
    byAspect: { aspect: string; count: number }[];
    recent: ProjectRow[];
  };
  media: { files: number; bytes: number };
  resets: { pending: number };
  recentUsers: UserRow[];
};

const KEY_STORE = "visioncut_admin_key";

function relTime(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-200">
          <Icon className="h-5 w-5" />
        </span>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      </div>
      <p className="font-display mt-4 text-3xl font-bold text-white">{value}</p>
      <p className="mt-1.5 text-[13px] text-zinc-500">{sub}</p>
    </div>
  );
}

export function AdminPage() {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tools, setTools] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyError, setKeyError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORE);
    if (saved) setAdminKey(saved);
  }, []);

  const load = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats", { headers: { "X-Admin-Key": key } });
      if (res.status === 401) {
        localStorage.removeItem(KEY_STORE);
        setAdminKey(null);
        setKeyError("Invalid admin key.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStats((await res.json()) as AdminStats);
      setKeyError("");
      try {
        const mcp = await fetch(`/api/mcp?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
        });
        const d = (await mcp.json()) as { result?: { tools?: { name: string }[] } };
        setTools((d.result?.tools ?? []).map((t) => t.name));
      } catch {
        setTools([]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminKey) void load(adminKey);
  }, [adminKey, load]);

  if (!adminKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-3xl border border-white/12 bg-white/[0.04] p-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-zinc-200">
            <Lock className="h-5.5 w-5.5" />
          </span>
          <h1 className="font-display mt-5 text-center text-xl font-bold text-white">Admin panel</h1>
          <p className="mt-2 text-center text-sm leading-relaxed text-zinc-500">
            Restricted area — enter the admin key to continue.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const k = input.trim();
              if (!k) return;
              localStorage.setItem(KEY_STORE, k);
              setAdminKey(k);
              setKeyError("");
            }}
            className="mt-6 space-y-3"
          >
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Admin key"
              autoFocus
              className="h-11 w-full rounded-lg border border-white/10 bg-black/40 px-4 font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-white/25"
            />
            {keyError && <p className="text-xs text-red-400">{keyError}</p>}
            <button
              type="submit"
              className="h-11 w-full rounded-lg bg-[#ededf2] text-sm font-medium text-black transition-colors hover:bg-white"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.navigate("/dashboard")}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition-colors hover:text-white"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-display flex items-center gap-2.5 text-2xl font-bold text-white">
                <ShieldCheck className="h-6 w-6 text-emerald-400" /> Admin panel
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                {stats
                  ? `Snapshot at ${new Date(stats.generatedAt).toLocaleTimeString()}`
                  : "Loading operational snapshot…"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => adminKey && void load(adminKey)}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button
              onClick={() => {
                localStorage.removeItem(KEY_STORE);
                setAdminKey(null);
                setStats(null);
                setTools([]);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-400 transition-colors hover:text-white"
            >
              <LogOut className="h-4 w-4" /> Lock
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Users}
            label="Users"
            value={stats ? String(stats.users.total) : "—"}
            sub={stats ? `${stats.users.last7d} new this week · ${stats.users.last30d} in 30d` : ""}
          />
          <StatCard
            icon={Film}
            label="Projects"
            value={stats ? String(stats.projects.total) : "—"}
            sub={stats ? `${stats.projects.clipsTotal} clips on timelines` : ""}
          />
          <StatCard
            icon={HardDrive}
            label="Cloud media"
            value={stats ? fmtBytes(stats.media.bytes) : "—"}
            sub={stats ? `${stats.media.files} files in library` : ""}
          />
          <StatCard
            icon={KeyRound}
            label="Pending resets"
            value={stats ? String(stats.resets.pending) : "—"}
            sub="Unused, unexpired reset tokens"
          />
        </div>

        {/* Aspect distribution */}
        {stats && stats.projects.byAspect.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Aspects:</span>
            {stats.projects.byAspect.map((a) => (
              <span
                key={a.aspect}
                className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300"
              >
                {a.aspect} <span className="text-zinc-500">· {a.count}</span>
              </span>
            ))}
          </div>
        )}

        {/* Recent projects */}
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-white">Recent projects</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/8">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Owner</th>
                  <th className="px-5 py-3 font-medium">Aspect</th>
                  <th className="px-5 py-3 font-medium">Clips</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {stats?.projects.recent.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 last:border-0">
                    <td className="max-w-[280px] truncate px-5 py-3 text-zinc-200">
                      {p.name}
                      {p.isDemo && (
                        <span className="ml-2 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-500">
                          demo
                        </span>
                      )}
                    </td>
                    <td className="max-w-[220px] truncate px-5 py-3 text-zinc-400">{p.owner}</td>
                    <td className="px-5 py-3 font-mono text-xs text-zinc-400">{p.aspectRatio}</td>
                    <td className="px-5 py-3 text-zinc-300">{p.clips}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-zinc-500">{relTime(p.updatedAt)}</td>
                  </tr>
                ))}
                {stats && stats.projects.recent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-zinc-500">
                      No projects yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent users */}
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-white">Recent users</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/8">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Projects</th>
                  <th className="px-5 py-3 font-medium">Media</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 last:border-0">
                    <td className="max-w-[260px] truncate px-5 py-3 text-zinc-200">
                      {u.email}
                      {u.isDemo && (
                        <span className="ml-2 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-500">
                          demo
                        </span>
                      )}
                    </td>
                    <td className="max-w-[180px] truncate px-5 py-3 text-zinc-400">{u.name || "—"}</td>
                    <td className="px-5 py-3 text-zinc-300">{u.projects}</td>
                    <td className="px-5 py-3 text-zinc-300">{u.media}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-zinc-500">{relTime(u.createdAt)}</td>
                  </tr>
                ))}
                {stats && stats.recentUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-zinc-500">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* MCP panel */}
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-white">MCP endpoint</h2>
          <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.025] p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-200">
                <Database className="h-5 w-5" />
              </span>
              <code className="rounded-lg border border-white/8 bg-black/50 px-3 py-2 font-mono text-[12px] text-zinc-300">
                /api/mcp?key=••••••••
              </code>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                {tools.length > 0 ? `${tools.length} tools live` : "tools unknown"}
              </span>
              <button
                onClick={() => router.navigate("/mcp")}
                className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                Docs <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
              </button>
            </div>
            {tools.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {tools.map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-white/8 bg-black/40 px-2 py-1 font-mono text-[11px] text-zinc-400"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
              <Clock className="h-3.5 w-3.5" /> Admin key currently doubles as the MCP token (set a dedicated
              ADMIN_KEY env to separate them).
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
