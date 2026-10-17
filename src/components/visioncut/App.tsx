"use client";

import React, { useEffect } from "react";
import { RouterProvider, useRouter, PAGE_TITLES } from "@/lib/router";
import { AuthProvider } from "@/components/visioncut/AuthContext";
import { LandingPage } from "@/components/visioncut/landing/LandingPage";
import { LoginPage, SignupPage, ResetPage } from "@/components/visioncut/AuthPages";
import { DashboardPage } from "@/components/visioncut/DashboardPage";
import { SettingsPage } from "@/components/visioncut/SettingsPage";
import { FeaturesPage, TemplatesPage, PricingPage, HelpPage } from "@/components/visioncut/MarketingPages";
import { EditorPage } from "@/components/visioncut/editor/EditorPage";

function RouteView() {
  const { route } = useRouter();
  const path = route.path;

  useEffect(() => {
    document.title = PAGE_TITLES[path] || "VisionCut AI";
    // Landing page keeps native scroll; editor resets to top
    if (path !== "/" && !path.startsWith("/editor")) window.scrollTo({ top: 0 });
  }, [path]);

  if (path.startsWith("/editor/")) {
    const projectId = path.replace("/editor/", "");
    return <EditorPage key={projectId} projectId={projectId} />;
  }

  switch (path) {
    case "/features":
      return <FeaturesPage />;
    case "/templates":
      return <TemplatesPage />;
    case "/pricing":
      return <PricingPage />;
    case "/help":
      return <HelpPage />;
    case "/login":
      return <LoginPage />;
    case "/signup":
      return <SignupPage />;
    case "/reset":
      return <ResetPage />;
    case "/dashboard":
      return <DashboardPage />;
    case "/settings":
      return <SettingsPage />;
    default:
      return <LandingPage />;
  }
}

export function VisionCutApp() {
  return (
    <AuthProvider>
      <RouterProvider>
        <RouteView />
      </RouterProvider>
    </AuthProvider>
  );
}
