"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "@/lib/router";
import { useAuth } from "@/components/visioncut/AuthContext";
import { Logo } from "@/components/visioncut/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, Globe, LayoutDashboard, LogOut, Menu, Settings, Sparkles, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Home", section: null },
  { label: "Features", section: "features" },
  { label: "AI Tools", section: "ai-tools" },
  { label: "Templates", section: null, href: "/templates" },
  { label: "Pricing", section: "pricing" },
  { label: "FAQ", section: "faq" },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
];

export function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goToSection = (id: string) => {
    setMobileOpen(false);
    if (router.route.path !== "/") {
      router.navigate("/");
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled ? "glass-strong shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)]" : "bg-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main">
        <button
          onClick={() => {
            setMobileOpen(false);
            router.navigate("/");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="rounded-lg"
          aria-label="VisionCut AI home"
        >
          <Logo />
        </button>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) =>
            link.href ? (
              <button
                key={link.label}
                onClick={() => {
                  router.navigate(link.href!);
                  window.scrollTo({ top: 0 });
                }}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </button>
            ) : (
              <button
                key={link.label}
                onClick={() => (link.section ? goToSection(link.section) : (router.navigate("/"), window.scrollTo({ top: 0 })))}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </button>
            )
          )}
        </div>

        <div className="hidden items-center gap-2.5 lg:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-zinc-300 hover:text-white">
                <Globe className="h-4 w-4" />
                <span className="uppercase">{language}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-white/10 bg-[#101018]">
              {LANGUAGES.map((l) => (
                <DropdownMenuItem
                  key={l.code}
                  onClick={() => setLanguage(l.code)}
                  className={cn("text-zinc-300 hover:!bg-white/10 hover:text-white", language === l.code && "text-violet-300")}
                >
                  {l.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-300 hover:text-white"
                onClick={() => {
                  router.navigate("/dashboard");
                  window.scrollTo({ top: 0 });
                }}
              >
                Dashboard
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full outline-none" aria-label="Account menu">
                    <Avatar className="h-8 w-8 border border-white/15">
                      <AvatarFallback
                        className="text-xs font-bold text-white"
                        style={{ background: `linear-gradient(135deg, ${user.avatarColor}, #0b0b12)` }}
                      >
                        {(user.name || user.email).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 border-white/10 bg-[#101018]">
                  <div className="border-b border-white/8 px-3 py-2.5">
                    <p className="truncate text-sm font-medium text-white">{user.name || "Creator"}</p>
                    <p className="truncate text-xs text-zinc-500">{user.email}</p>
                    {user.isDemo && (
                      <p className="mt-1 inline-block rounded bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        Demo account
                      </p>
                    )}
                  </div>
                  <DropdownMenuItem onClick={() => router.navigate("/dashboard")} className="text-zinc-300 hover:!bg-white/10 hover:text-white">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.navigate("/settings")} className="text-zinc-300 hover:!bg-white/10 hover:text-white">
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      await logout();
                      router.navigate("/");
                    }}
                    className="text-rose-400 hover:!bg-rose-500/10 hover:!text-rose-300"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                className="bg-gradient-to-r from-violet-600 to-cyan-400 font-semibold text-white shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all hover:brightness-110"
                onClick={() => router.navigate("/dashboard")}
              >
                <Sparkles className="h-4 w-4" /> Start Editing Free
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-300 hover:text-white"
                onClick={() => {
                  router.navigate("/login");
                  window.scrollTo({ top: 0 });
                }}
              >
                <UserRound className="h-4 w-4" /> Sign In
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-violet-600 to-cyan-400 font-semibold text-white shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all hover:brightness-110"
                onClick={() => {
                  router.navigate("/signup");
                  window.scrollTo({ top: 0 });
                }}
              >
                <Sparkles className="h-4 w-4" /> Start Editing Free
              </Button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="rounded-lg p-2 text-zinc-300 hover:bg-white/5 lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="glass-strong border-t border-white/8 px-4 pb-6 pt-3 lg:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <button
                key={link.label}
                onClick={() =>
                  link.href
                    ? (router.navigate(link.href), setMobileOpen(false), window.scrollTo({ top: 0 }))
                    : link.section
                      ? goToSection(link.section)
                      : (router.navigate("/"), setMobileOpen(false), window.scrollTo({ top: 0 }))
                }
                className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </button>
            ))}
            <div className="mt-3 flex gap-2.5">
              {user ? (
                <>
                  <Button
                    className="flex-1 bg-white/8 text-zinc-200 hover:bg-white/12"
                    onClick={() => (router.navigate("/dashboard"), setMobileOpen(false))}
                  >
                    Dashboard
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-violet-600 to-cyan-400 font-semibold text-white"
                    onClick={() => (router.navigate("/dashboard"), setMobileOpen(false))}
                  >
                    Start Editing
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="flex-1 bg-white/8 text-zinc-200 hover:bg-white/12"
                    onClick={() => (router.navigate("/login"), setMobileOpen(false))}
                  >
                    Sign In
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-violet-600 to-cyan-400 font-semibold text-white"
                    onClick={() => (router.navigate("/signup"), setMobileOpen(false))}
                  >
                    Start Editing Free
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
