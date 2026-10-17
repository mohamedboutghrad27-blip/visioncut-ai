"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type RoutePath =
  | "/"
  | "/features"
  | "/templates"
  | "/pricing"
  | "/login"
  | "/signup"
  | "/reset"
  | "/dashboard"
  | "/settings"
  | "/help"
  | `/editor/${string}`;

export type Route = {
  path: string;
  segments: string[];
  query: URLSearchParams;
};

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart] = raw.split("?");
  const path = pathPart || "/";
  return {
    path,
    segments: path.split("/").filter(Boolean),
    query: new URLSearchParams(queryPart || ""),
  };
}

const RouterContext = createContext<{
  route: Route;
  navigate: (path: string, opts?: { replace?: boolean }) => void;
}>({ route: { path: "/", segments: [], query: new URLSearchParams() }, navigate: () => {} });

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === "undefined"
      ? { path: "/", segments: [], query: new URLSearchParams() }
      : parseHash()
  );

  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((path: string, opts?: { replace?: boolean }) => {
    const target = `#${path}`;
    if (window.location.hash === target) return;
    if (opts?.replace) {
      window.history.replaceState(null, "", target);
      setRoute(parseHash());
    } else {
      window.location.hash = path;
    }
  }, []);

  return (
    <RouterContext.Provider value={{ route, navigate }}>{children}</RouterContext.Provider>
  );
}

export function useRouter() {
  return useContext(RouterContext);
}

/** Smooth-scroll to a section on the landing page (navigating home first if needed). */
export function useSectionScroller() {
  const { route, navigate } = useRouter();
  return useCallback(
    (sectionId: string) => {
      const scrollTo = () => {
        requestAnimationFrame(() => {
          const el = document.getElementById(sectionId);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      };
      if (route.path !== "/") {
        navigate("/");
        setTimeout(scrollTo, 120);
      } else {
        scrollTo();
      }
    },
    [route.path, navigate]
  );
}

export const PAGE_TITLES: Record<string, string> = {
  "/": "VisionCut AI — Create Stunning Videos. Turn Every Idea Into Reality.",
  "/features": "Features",
  "/templates": "Templates",
  "/pricing": "Pricing",
  "/login": "Sign in",
  "/signup": "Create account",
  "/reset": "Reset password",
  "/dashboard": "Dashboard",
  "/settings": "Settings",
  "/help": "Help & Support",
};
