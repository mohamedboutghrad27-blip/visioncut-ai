"use client";

import React from "react";
import { SectionHeading, Reveal, ThumbGradient } from "@/components/visioncut/shared";
import { useRouter } from "@/lib/router";
import { useAuth } from "@/components/visioncut/AuthContext";
import { toast } from "sonner";
import { Play, UseTemplate as UseIcon } from "@/components/visioncut/landing/icons";
import { cn } from "@/lib/utils";

export type ShowcaseItem = {
  id: string;
  title: string;
  category: string;
  duration: string;
  ratio: "16:9" | "9:16" | "1:1";
  templateName: string;
};

export const SHOWCASE_CATEGORIES = [
  "All", "Cinematic", "YouTube", "Reels & TikTok", "Travel", "Gaming",
  "Product", "Business", "Education", "Wedding", "AI Creative",
] as const;

export const SHOWCASE_ITEMS: ShowcaseItem[] = [
  { id: "s1", title: "Neon City Nights", category: "Cinematic", duration: "0:42", ratio: "16:9", templateName: "Neon City Cinematic Teaser" },
  { id: "s2", title: "Weekly Tech Vlog", category: "YouTube", duration: "8:15", ratio: "16:9", templateName: "Tech Vlog — Weekly Episode" },
  { id: "s3", title: "Morning Routine Hook", category: "Reels & TikTok", duration: "0:22", ratio: "9:16", templateName: "Vertical Hook Reel" },
  { id: "s4", title: "Bali in 60 Seconds", category: "Travel", duration: "1:00", ratio: "16:9", templateName: "Travel Recap — 60s Cut" },
  { id: "s5", title: "Ranked Highlights", category: "Gaming", duration: "2:30", ratio: "16:9", templateName: "Gaming Montage — Ranked" },
  { id: "s6", title: "Spring Drop Ad", category: "Product", duration: "0:30", ratio: "1:1", templateName: "Product Ad — Seasonal Drop" },
  { id: "s7", title: "Quarterly Results", category: "Business", duration: "3:10", ratio: "16:9", templateName: "Business Update Deck" },
  { id: "s8", title: "Photosynthesis Explained", category: "Education", duration: "4:45", ratio: "16:9", templateName: "Explainer — Whiteboard Style" },
  { id: "s9", title: "Ana & Joao — SNEAK", category: "Wedding", duration: "5:20", ratio: "16:9", templateName: "Wedding Film — Emotional Cut" },
  { id: "s10", title: "Dreamscape Sequence", category: "AI Creative", duration: "0:35", ratio: "16:9", templateName: "AI Dreamscape Sequence" },
  { id: "s11", title: "Outfit Transition Set", category: "Reels & TikTok", duration: "0:18", ratio: "9:16", templateName: "Outfit Transition Pack" },
  { id: "s12", title: "Street Food Tour", category: "Travel", duration: "2:05", ratio: "9:16", templateName: "Street Food Mini-Doc" },
];

export function ShowcaseGrid({ showHeading = true }: { showHeading?: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const [active, setActive] = React.useState<string>("All");
  const [creating, setCreating] = React.useState<string | null>(null);

  const filtered = active === "All" ? SHOWCASE_ITEMS : SHOWCASE_ITEMS.filter((s) => s.category === active);

  const applyTemplate = async (item: ShowcaseItem) => {
    if (!user) {
      toast.info("Sign in to start from a template", { description: "Create a free account — the template will be waiting in your dashboard." });
      router.navigate("/signup");
      return;
    }
    setCreating(item.id);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.templateName,
          aspectRatio: item.ratio,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the project");
      toast.success("Template project created", { description: `“${item.templateName}” is ready in the editor.` });
      router.navigate(`/editor/${data.project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(null);
    }
  };

  return (
    <section id="showcase" className="scroll-mt-20 border-t border-white/[0.08] py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {showHeading && (
          <SectionHeading
            eyebrow="Showcase"
            title={<>Start from a style, <span className="text-gradient">make it yours</span></>}
            description="Explore editing styles and starter templates across every format. Sample previews shown for inspiration."
          />
        )}

        <Reveal className="mt-10 flex flex-wrap justify-center gap-2">
          {SHOWCASE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-[13px] font-medium transition-all duration-200",
                active === c
                  ? "border-white bg-[#ededf2] text-black"
                  : "border-white/10 bg-transparent text-zinc-400 hover:border-white/25 hover:text-white"
              )}
            >
              {c}
            </button>
          ))}
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item, i) => (
            <Reveal key={item.id} delay={(i % 4) * 60}>
              <div className="card-hover group relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a0a]">
                <div className={cn("relative w-full", item.ratio === "9:16" ? "aspect-[3/4]" : item.ratio === "1:1" ? "aspect-square" : "aspect-video")}>
                  <ThumbGradient seed={item.id + item.title} />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur-md border border-white/25">
                      <Play className="h-5 w-5 text-white" fill="currentColor" />
                    </span>
                  </div>
                  <span className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                    {item.duration}
                  </span>
                  <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                    {item.ratio === "9:16" ? "Vertical 9:16" : item.ratio === "1:1" ? "Square 1:1" : "Widescreen 16:9"}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-medium text-white">{item.title}</h3>
                    <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-400">{item.category}</span>
                  </div>
                  <button
                    onClick={() => applyTemplate(item)}
                    disabled={creating === item.id}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] py-2 text-xs font-medium text-zinc-200 transition-all hover:border-white/25 hover:bg-white/[0.07] hover:text-white disabled:opacity-60"
                  >
                    <UseIcon className="h-3.5 w-3.5" />
                    {creating === item.id ? "Creating…" : "Use Template"}
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
