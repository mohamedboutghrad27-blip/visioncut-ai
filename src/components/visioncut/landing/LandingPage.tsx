"use client";

import React from "react";
import { Navbar } from "@/components/visioncut/landing/Navbar";
import { Hero } from "@/components/visioncut/landing/Hero";
import { FeaturesSection } from "@/components/visioncut/landing/Features";
import { HowItWorks } from "@/components/visioncut/landing/HowItWorks";
import { ShowcaseGrid } from "@/components/visioncut/landing/Showcase";
import { AiShowcase } from "@/components/visioncut/landing/AiShowcase";
import { PricingSection } from "@/components/visioncut/landing/Pricing";
import { TestimonialsSection, FaqSection } from "@/components/visioncut/landing/Testimonials";
import { FinalCta, Footer } from "@/components/visioncut/landing/Footer";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <Hero />
        <FeaturesSection />
        <HowItWorks />
        <ShowcaseGrid />
        <AiShowcase />
        <PricingSection />
        <TestimonialsSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
