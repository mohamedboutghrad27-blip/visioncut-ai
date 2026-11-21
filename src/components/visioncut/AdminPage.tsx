"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/lib/router";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Database,
  Eye,
  EyeOff,
  Film,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

type MediaRow = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  owner: string;
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
  media: { files: number; bytes: number; largest: MediaRow[] };
  resets: { pending: number };
  activity: { date: string; label: string; signups: number; projects: number }[];
  recentUsers: UserRow[];
};

type Tab = "overview" | "projects" | "users" | "media" | "api";

type ConfirmTarget = { kind: "projects" | "users" | "media"; id: string; label: string; note?: string };

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
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-200">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      </div>
      <p className="font-display mt-3 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-[13px] text-zinc-500">{sub}</p>
    </div>
  );
}

const NAV: { tab: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { tab: "overview", label: "Overview", icon: LayoutDashboard },
  { tab: "projects", label: "Projects", icon: Film },
  { tab: "users", label: "Users", icon: Users },
  { tab: "media", label: "Media", icon: HardDrive },
  { tab: "api", label: "API keys", icon: KeyRound },
];

export function AdminPage() {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tools, setTools] = useState<string[]>([]);
  const [mcpShared, setMcpShared] = useState(true);
  const [loading, setLoading] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [revealToken, setRevealToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);

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
        if (!mcp.ok) {
          setTools([]);
          setMcpShared(false);
          return;
        }
        const d = (await mcp.json()) as { result?: { tools?: { name: string }[] } };
        setTools((d.result?.tools ?? []).map((t) => t.name));
        setMcpShared(true);
      } catch {
        setTools([]);
        setMcpShared(false);
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

  const deleteRow = useCallback(
    async (t: ConfirmTarget) => {
      if (!adminKey) return;
      setDeleting(true);
      try {
        const res = await fetch(`/api/admin/${t.kind}/${t.id}`, {
          method: "DELETE",
          headers: { "X-Admin-Key": adminKey },
        });
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(d.error || `HTTP ${res.status}`);
        }
        toast.success(`Deleted ${t.label}`);
        setConfirmTarget(null);
        await load(adminKey);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setDeleting(false);
      }
    },
    [adminKey, load],
  );

  const revealApiKey = useCallback(async () => {
    if (!adminKey) return;
    if (revealToken !== null) {
      setRevealToken(null);
      return;
    }
    setTokenLoading(true);
    try {
      const res = await fetch("/api/admin/keys", { headers: { "X-Admin-Key": adminKey } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as { mcpToken: string };
      setRevealToken(d.mcpToken || "(not configured)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load token");
    } finally {
      setTokenLoading(false);
    }
  }, [adminKey, revealToken]);

  const copy = useCallback((text: string, what: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${what} copied`))
      .catch(() => toast.error("Copy failed"));
  }, []);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || tab !== "projects") return stats?.projects.recent ?? [];
    return (stats?.projects.recent ?? []).filter(
      (p) => p.name.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q),
    );
  }, [stats, query, tab]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || tab !== "users") return stats?.recentUsers ?? [];
    return (stats?.recentUsers ?? []).filter(
      (u) => u.email.toLowerCase().includes(q) || (u.name || "").toLowerCase().includes(q),
    );
  }, [stats, query, tab]);

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

  const confirmNote =
    confirmTarget?.kind === "users"
      ? "This permanently removes the account with all of its projects and cloud media backups. There is no undo."
      : confirmTarget?.kind === "projects"
        ? "The project and its timeline clips will be permanently removed. There is no undo."
        : "The cloud backup of this media file will be permanently removed. There is no undo.";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/8 px-4 py-6 md:flex">
        <div className="flex items-center gap-3 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-sm font-bold text-white">Admin console</p>
            <p className="text-[11px] text-zinc-500">VisionCut AI</p>
          </div>
        </div>
        <nav className="mt-8 space-y-1">
          {NAV.map(({ tab: t, label, icon: Icon }) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setQuery("");
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                tab === t
                  ? "bg-white/[0.07] font-medium text-white"
                  : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
              }`}
            >
              <Icon className="h-4.5 w-4.5" /> {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-1">
          <button
            onClick={() => router.navigate("/dashboard")}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-300"
          >
            <ArrowLeft className="h-4.5 w-4.5" /> Back to app
          </button>
          <button
            onClick={() => {
              localStorage.removeItem(KEY_STORE);
              setAdminKey(null);
              setStats(null);
              setTools([]);
              setMcpShared(true);
              setRevealToken(null);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-red-300"
          >
            <LogOut className="h-4.5 w-4.5" /> Lock console
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-20 pt-8 sm:px-8">
        {/* Mobile nav */}
        <div className="mb-6 flex gap-2 overflow-x-auto md:hidden">
          {NAV.map(({ tab: t, label, icon: Icon }) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setQuery("");
              }}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs transition-colors ${
                tab === t
                  ? "border-white/20 bg-white/[0.08] text-white"
                  : "border-white/10 bg-white/[0.03] text-zinc-500"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">
              {NAV.find((n) => n.tab === tab)?.label}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-zinc-500">
              <Clock className="h-3.5 w-3.5" />
              {stats
                ? `Snapshot at ${new Date(stats.generatedAt).toLocaleTimeString()}`
                : "Loading operational snapshot…"}
            </p>
          </div>
          <button
            onClick={() => adminKey && void load(adminKey)}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* ---------- OVERVIEW ---------- */}
        {tab === "overview" && (
          <>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

            {/* 30-day activity chart */}
            <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.025] p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-white">Last 90 days</h2>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Signups
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-violet-400" /> Projects created
                  </span>
                </div>
              </div>
              <div className="mt-4 h-56">
                {stats && stats.activity.every((d) => !d.signups && !d.projects) && (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-600">
                    No signups or projects created in this window yet.
                  </div>
                )}
                {stats && !stats.activity.every((d) => !d.signups && !d.projects) && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.activity} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#71717a", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        interval={13}
                      />
                      <YAxis tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <ChartTooltip
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        contentStyle={{
                          background: "#111113",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 12,
                          fontSize: 12,
                          color: "#e4e4e7",
                        }}
                      />
                      <Bar dataKey="signups" name="Signups" fill="#34d399" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="projects" name="Projects" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Aspect + latest activity */}
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-6">
                <h2 className="font-display text-base font-semibold text-white">Aspect ratios</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {stats?.projects.byAspect.map((a) => (
                    <span
                      key={a.aspect}
                      className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300"
                    >
                      {a.aspect} <span className="text-zinc-500">· {a.count}</span>
                    </span>
                  ))}
                  {stats && stats.projects.byAspect.length === 0 && (
                    <p className="text-sm text-zinc-500">No projects yet.</p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-6">
                <h2 className="font-display text-base font-semibold text-white">Latest updates</h2>
                <ul className="mt-4 space-y-3">
                  {stats?.projects.recent.slice(0, 4).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-zinc-200">{p.name}</span>
                      <span className="shrink-0 text-xs text-zinc-500">{relTime(p.updatedAt)}</span>
                    </li>
                  ))}
                  {stats && stats.projects.recent.length === 0 && (
                    <li className="text-sm text-zinc-500">Nothing yet.</li>
                  )}
                </ul>
              </div>
            </div>
          </>
        )}

        {/* ---------- PROJECTS ---------- */}
        {tab === "projects" && (
          <>
            <div className="mt-7 flex items-center gap-3">
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or owner…"
                  className="h-10 w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-4 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-white/25"
                />
              </div>
              <span className="text-sm text-zinc-500">{filteredProjects.length} shown</span>
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/8">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-zinc-500">
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 font-medium">Owner</th>
                    <th className="px-5 py-3 font-medium">Aspect</th>
                    <th className="px-5 py-3 font-medium">Clips</th>
                    <th className="px-5 py-3 font-medium">Updated</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 last:border-0">
                      <td className="max-w-[260px] truncate px-5 py-3 text-zinc-200">
                        {p.name}
                        {p.isDemo && (
                          <span className="ml-2 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-500">
                            demo
                          </span>
                        )}
                      </td>
                      <td className="max-w-[200px] truncate px-5 py-3 text-zinc-400">{p.owner}</td>
                      <td className="px-5 py-3 font-mono text-xs text-zinc-400">{p.aspectRatio}</td>
                      <td className="px-5 py-3 text-zinc-300">{p.clips}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-zinc-500">{relTime(p.updatedAt)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => setConfirmTarget({ kind: "projects", id: p.id, label: `"${p.name}"` })}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400"
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredProjects.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-center text-zinc-500">
                        No projects match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ---------- USERS ---------- */}
        {tab === "users" && (
          <>
            <div className="mt-7 flex items-center gap-3">
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by email or name…"
                  className="h-10 w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-4 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-white/25"
                />
              </div>
              <span className="text-sm text-zinc-500">{filteredUsers.length} shown</span>
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/8">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-zinc-500">
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Projects</th>
                    <th className="px-5 py-3 font-medium">Media</th>
                    <th className="px-5 py-3 font-medium">Joined</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 last:border-0">
                      <td className="max-w-[240px] truncate px-5 py-3 text-zinc-200">
                        {u.email}
                        {u.isDemo && (
                          <span className="ml-2 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-500">
                            demo
                          </span>
                        )}
                      </td>
                      <td className="max-w-[160px] truncate px-5 py-3 text-zinc-400">{u.name || "—"}</td>
                      <td className="px-5 py-3 text-zinc-300">{u.projects}</td>
                      <td className="px-5 py-3 text-zinc-300">{u.media}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-zinc-500">{relTime(u.createdAt)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() =>
                            setConfirmTarget({ kind: "users", id: u.id, label: u.email, note: `${u.projects} projects · ${u.media} media` })
                          }
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400"
                          aria-label={`Delete ${u.email}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-center text-zinc-500">
                        No users match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ---------- MEDIA ---------- */}
        {tab === "media" && (
          <>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <StatCard
                icon={HardDrive}
                label="Total storage"
                value={stats ? fmtBytes(stats.media.bytes) : "—"}
                sub={stats ? `${stats.media.files} backed-up files` : ""}
              />
              <StatCard
                icon={Film}
                label="Largest file"
                value={stats?.media.largest[0] ? fmtBytes(stats.media.largest[0].size) : "—"}
                sub={stats?.media.largest[0]?.name || ""}
              />
            </div>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-white/8">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-zinc-500">
                    <th className="px-5 py-3 font-medium">File</th>
                    <th className="px-5 py-3 font-medium">Owner</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Size</th>
                    <th className="px-5 py-3 font-medium">Uploaded</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {(stats?.media.largest ?? []).map((m) => (
                    <tr key={m.id} className="border-b border-white/5 last:border-0">
                      <td className="max-w-[240px] truncate px-5 py-3 text-zinc-200">{m.name}</td>
                      <td className="max-w-[190px] truncate px-5 py-3 text-zinc-400">{m.owner}</td>
                      <td className="px-5 py-3 text-xs text-zinc-500">{m.mimeType.split("/")[1] || m.mimeType}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-zinc-300">{fmtBytes(m.size)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-zinc-500">{relTime(m.createdAt)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => setConfirmTarget({ kind: "media", id: m.id, label: `"${m.name}"` })}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400"
                          aria-label={`Delete ${m.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {stats && stats.media.largest.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-center text-zinc-500">
                        No media backups yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-zinc-600">Showing the 15 largest cloud media backups.</p>
          </>
        )}

        {/* ---------- API ---------- */}
        {tab === "api" && (
          <div className="mt-7 space-y-6">
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-200">
                  <Database className="h-5 w-5" />
                </span>
                <code className="rounded-lg border border-white/8 bg-black/50 px-3 py-2 font-mono text-[12px] text-zinc-300">
                  POST /api/mcp?key=••••••••
                </code>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                  {tools.length > 0 ? `${tools.length} tools live` : mcpShared ? "tools unknown" : "token separate"}
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
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-6">
              <h2 className="font-display text-base font-semibold text-white">MCP API token</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Paste this into Claude Desktop / Claude Code to connect the 14 VisionCut tools.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <code className="min-w-0 max-w-full break-all rounded-lg border border-white/8 bg-black/50 px-3 py-2 font-mono text-[12px] text-zinc-300">
                  {revealToken ? revealToken : "••••••••••••••••••••••"}
                </code>
                <button
                  onClick={() => void revealApiKey()}
                  disabled={tokenLoading}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  {revealToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {tokenLoading ? "Loading…" : revealToken ? "Hide" : "Reveal"}
                </button>
                {revealToken && revealToken !== "(not configured)" && (
                  <button
                    onClick={() => void copy(revealToken, "API token")}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Check className="h-4 w-4" /> Copy
                  </button>
                )}
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                <Clock className="h-3.5 w-3.5" />{" "}
                {mcpShared
                  ? "Admin key currently doubles as the MCP token."
                  : "Dedicated ADMIN_KEY protects this panel; the MCP API keeps its own stronger token."}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Delete confirmation */}
      <AlertDialog open={confirmTarget !== null} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <AlertDialogContent className="max-w-md border-white/10 bg-[#141416] text-zinc-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete {confirmTarget?.label}?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-zinc-400">
              {confirmNote}
              {confirmTarget?.note && <span className="mt-1 block text-zinc-500">{confirmTarget.note}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-transparent text-zinc-300 hover:bg-white/10 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmTarget) void deleteRow(confirmTarget);
              }}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
