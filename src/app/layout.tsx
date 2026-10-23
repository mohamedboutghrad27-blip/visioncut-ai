import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

/* Resend-style typography: Inter everywhere, Geist Mono for code/labels.
   --font-geist-sans is kept as the CSS variable name so every existing
   font-sans/font-display reference continues to resolve. */
const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://visioncut.ai";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "VisionCut AI — Create Stunning Videos. Turn Every Idea Into Reality.",
    template: "%s · VisionCut AI",
  },
  description:
    "Edit videos professionally, create cinematic content, and transform your ideas into stunning videos with powerful AI tools. Multitrack editing, AI subtitles, text-to-video, AI voiceovers and more.",
  keywords: [
    "video editor",
    "AI video editing",
    "text to video",
    "AI subtitles",
    "AI voiceover",
    "online video editor",
    "cinematic video",
    "VisionCut AI",
  ],
  authors: [{ name: "VisionCut AI" }],
  creator: "VisionCut AI",
  applicationName: "VisionCut AI",
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml," +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#000000"/><path d="M18 16h8l6 18 6-18h8L36 48h-8L18 16z" fill="#ffffff"/><rect x="42" y="36" width="6" height="12" rx="3" fill="#ffffff" transform="rotate(45 45 42)"/></svg>`
          ),
        type: "image/svg+xml",
      },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "VisionCut AI",
    title: "VisionCut AI — Your Vision. Your Story. Your Masterpiece.",
    description:
      "Professional multitrack video editing in your browser with AI-powered creation tools: text-to-video, automatic subtitles, AI voiceovers, smart editing and cinematic exports.",
  },
  twitter: {
    card: "summary_large_image",
    title: "VisionCut AI — Your Vision. Your Story. Your Masterpiece.",
    description:
      "Professional browser-based video editing with powerful AI creation tools. Start creating for free.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* Marks JS availability before paint: reveal animations only hide content when JS runs
            (ui-ux-pro-max no-JS fallback rule). Body-top inline script executes before any
            .vc-reveal element parses/paints. NOTE: a manual <head> here breaks Turbopack's
            next/font import-map resolution on Vercel — keep this out of <head>. */}
        <script dangerouslySetInnerHTML={{ __html: 'document.documentElement.classList.add("js");' }} />
        {children}
        {/* Radix toasts (use-toast) + Sonner toasts (toast from "sonner") — the app
            fires BOTH kinds, so both renderers must be mounted or messages vanish. */}
        <Toaster />
        <SonnerToaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
