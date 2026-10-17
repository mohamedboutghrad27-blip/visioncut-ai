"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "@/lib/router";
import { useAuth } from "@/components/visioncut/AuthContext";
import { Logo, GradientButton } from "@/components/visioncut/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Info, Loader2, Sparkles, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Mode = "login" | "signup" | "reset" | "reset-confirm";

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-16">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,black,transparent)]" />
        <div className="absolute left-1/2 top-1/4 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[130px]" />
      </div>
      <div className="relative w-full max-w-md">
        <button
          onClick={() => router.navigate("/")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </button>
        <div className="glass rounded-3xl p-8 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)]">
          <div className="mb-7 text-center">
            <button onClick={() => router.navigate("/")} className="mx-auto" aria-label="VisionCut AI home">
              <Logo size="lg" />
            </button>
            <h1 className="font-display mt-6 text-2xl font-bold text-white">{title}</h1>
            <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function DemoNote() {
  return (
    <div className="mt-5 flex gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
      <p className="text-[11px] leading-relaxed text-zinc-500">
        Real authentication with a database is active — accounts are private to you. A clearly-labeled
        <strong className="text-zinc-400"> demo account</strong> with example projects is also available.
      </p>
    </div>
  );
}

export function LoginPage() {
  const router = useRouter();
  const { login, loginDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError("Please enter a valid email address.");
    if (!password) return setError("Please enter your password.");
    setBusy(true);
    try {
      await login(email.trim(), password);
      toast.success("Welcome back!");
      router.navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  const startDemo = async () => {
    setDemoBusy(true);
    try {
      await loginDemo();
      toast.success("Demo mode started", { description: "You're signed in as the demo creator with example projects." });
      router.navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo mode failed");
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue creating">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="login-email" className="text-zinc-300">Email</Label>
          <Input
            id="login-email" type="email" autoComplete="email" placeholder="you@studio.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="border-white/10 bg-black/40 focus-visible:ring-violet-400/40"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" className="text-zinc-300">Password</Label>
            <button type="button" onClick={() => router.navigate("/reset")} className="text-xs text-violet-300 hover:text-violet-200">
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Input
              id="login-password" type={showPw ? "text" : "password"} autoComplete="current-password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="border-white/10 bg-black/40 pr-10 focus-visible:ring-violet-400/40"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300" aria-label={showPw ? "Hide password" : "Show password"}>
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {error && <p className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
        <GradientButton type="submit" disabled={busy} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Signing in…" : "Sign In"}
        </GradientButton>
      </form>

      <div className="relative my-5 text-center">
        <span className="relative z-10 bg-transparent px-3 text-xs text-zinc-600" style={{ background: "linear-gradient(90deg, transparent, #101018 15%, #101018 85%, transparent)" }}>
          or
        </span>
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/8" />
      </div>

      <button
        onClick={startDemo}
        disabled={demoBusy}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] py-3 text-sm font-semibold text-zinc-200 transition-all hover:border-violet-400/40 hover:bg-white/[0.08] disabled:opacity-60"
      >
        {demoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {demoBusy ? "Preparing demo…" : "Try the Demo Account"}
      </button>
      <DemoNote />

      <p className="mt-6 text-center text-sm text-zinc-500">
        New to VisionCut?{" "}
        <button onClick={() => router.navigate("/signup")} className="font-semibold text-violet-300 hover:text-violet-200">
          Create a free account
        </button>
      </p>
    </AuthShell>
  );
}

export function SignupPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pwStrength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Please tell us your name.");
    if (!EMAIL_RE.test(email.trim())) return setError("Please enter a valid email address.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      await register(name.trim(), email.trim(), password);
      toast.success("Account created — welcome to VisionCut AI!");
      router.navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start editing professionally — free">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="signup-name" className="text-zinc-300">Name</Label>
          <Input id="signup-name" autoComplete="name" placeholder="Alex Director" value={name} onChange={(e) => setName(e.target.value)} className="border-white/10 bg-black/40 focus-visible:ring-violet-400/40" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signup-email" className="text-zinc-300">Email</Label>
          <Input id="signup-email" type="email" autoComplete="email" placeholder="you@studio.com" value={email} onChange={(e) => setEmail(e.target.value)} className="border-white/10 bg-black/40 focus-visible:ring-violet-400/40" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signup-password" className="text-zinc-300">Password</Label>
          <div className="relative">
            <Input
              id="signup-password" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="border-white/10 bg-black/40 pr-10 focus-visible:ring-violet-400/40"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300" aria-label={showPw ? "Hide password" : "Show password"}>
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password && (
            <div className="flex items-center gap-1.5 pt-1">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < pwStrength ? (pwStrength <= 1 ? "bg-rose-500" : pwStrength === 2 ? "bg-amber-400" : "bg-emerald-400") : "bg-white/10")} />
              ))}
              <span className="ml-1.5 text-[10px] text-zinc-500">{["Weak", "Weak", "Fair", "Good", "Strong"][pwStrength]}</span>
            </div>
          )}
        </div>
        {error && <p className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
        <GradientButton type="submit" disabled={busy} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Creating account…" : "Create Free Account"}
        </GradientButton>
      </form>
      <DemoNote />
      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <button onClick={() => router.navigate("/login")} className="font-semibold text-violet-300 hover:text-violet-200">
          Sign in
        </button>
      </p>
    </AuthShell>
  );
}

export function ResetPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<"request" | "confirm">("request");
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Support #/reset?token=... deep links
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const t = params.get("token");
    if (t) {
      setToken(t);
      setStage("confirm");
    }
  }, []);

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError("Please enter a valid email address.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setNotice(data.message || "Check your inbox.");
      if (data.devResetToken) {
        setDevToken(data.devResetToken);
        setStage("confirm");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token.trim()) return setError("Paste the reset token you received.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      await refresh();
      toast.success("Password updated — you're signed in.");
      router.navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={stage === "request" ? "Reset your password" : "Choose a new password"}
      subtitle={stage === "request" ? "We'll generate a reset link for your account" : "Enter the reset token and your new password"}
    >
      {stage === "request" ? (
        <form onSubmit={request} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="reset-email" className="text-zinc-300">Email</Label>
            <Input id="reset-email" type="email" placeholder="you@studio.com" value={email} onChange={(e) => setEmail(e.target.value)} className="border-white/10 bg-black/40 focus-visible:ring-violet-400/40" />
          </div>
          {error && <p className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
          {notice && (
            <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{notice}</p>
          )}
          <GradientButton type="submit" disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
            {busy ? "Generating…" : "Generate Reset Link"}
          </GradientButton>
          <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] leading-relaxed text-amber-200/80">
            Development mode: no email provider is configured, so the reset token is shown here instead of emailed.
            In production this links to a real email flow.
          </p>
        </form>
      ) : (
        <form onSubmit={confirm} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="reset-token" className="text-zinc-300">Reset token</Label>
            <Input id="reset-token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste your token" className="border-white/10 bg-black/40 font-mono text-xs focus-visible:ring-violet-400/40" />
          </div>
          {devToken && (
            <p className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2 font-mono text-[11px] leading-relaxed break-all text-violet-200">
              Dev token: {devToken}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="reset-password" className="text-zinc-300">New password</Label>
            <Input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="border-white/10 bg-black/40 focus-visible:ring-violet-400/40" />
          </div>
          {error && <p className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
          <GradientButton type="submit" disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Updating…" : "Set New Password"}
          </GradientButton>
          <button type="button" onClick={() => setStage("request")} className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300">
            Use a different email
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-zinc-500">
        Remembered it?{" "}
        <button onClick={() => router.navigate("/login")} className="font-semibold text-violet-300 hover:text-violet-200">
          Sign in
        </button>
      </p>
    </AuthShell>
  );
}
