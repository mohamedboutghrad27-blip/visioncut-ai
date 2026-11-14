"use client";

import React from "react";
import { Navbar } from "@/components/visioncut/landing/Navbar";
import { Footer } from "@/components/visioncut/landing/Footer";
import { Reveal } from "@/components/visioncut/shared";

const LAST_UPDATED = "November 15, 2026";
const CONTACT_EMAIL = "support@visioncut.ai";

function LegalPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="relative overflow-hidden pb-6 pt-32 sm:pt-36">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black,transparent)]" />
            <div className="absolute left-1/2 top-0 h-[380px] w-[680px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-[130px]" />
          </div>
          <Reveal className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <span className="inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
              <span className="inline-block h-1 w-1 rounded-full bg-zinc-600" aria-hidden />
              {eyebrow}
            </span>
            <h1 className="font-display mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">{title}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">{intro}</p>
            <p className="mt-3 text-xs text-zinc-600">Last updated: {LAST_UPDATED}</p>
          </Reveal>
        </section>
        <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">{children}</section>
      </main>
      <Footer />
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Reveal className="mt-10" delay={40}>
      <div id={id} className="scroll-mt-24">
        <h2 className="font-display text-xl font-semibold text-white sm:text-2xl">{title}</h2>
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-zinc-400">{children}</div>
      </div>
    </Reveal>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title={<>Privacy <span className="text-gradient">Policy</span></>}
      intro="What we collect, why we collect it and how your projects, media and AI prompts are handled."
    >
      <Section id="who" title="1. Who we are">
        <p>
          VisionCut AI (&quot;VisionCut&quot;, &quot;we&quot;) is a browser-based video editing studio with AI creation tools, reachable at
          visioncut.ai and operated as an early-access product. For all privacy questions and requests, contact{" "}
          <a className="text-zinc-200 underline decoration-zinc-600 underline-offset-4 hover:decoration-zinc-300" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section id="collect" title="2. Data we collect">
        <List
          items={[
            <><strong className="text-zinc-200">Account data</strong> — the email address you register and a salted hash of your password. We never store passwords in plain text.</>,
            <><strong className="text-zinc-200">Project data</strong> — your project names, aspect ratios, timeline structure (tracks, clips, positions, effects) and the assets linked to each project.</>,
            <><strong className="text-zinc-200">Media files</strong> — videos, images and audio you upload or import into the cloud library. Files are stored in encrypted-at-rest database storage in chunks, with a 1&nbsp;GB quota per account.</>,
            <><strong className="text-zinc-200">AI prompts</strong> — the text (scripts, prompts, narration) you submit to AI features such as storyboard, text-to-video, image generation, voiceover and transcription.</>,
            <><strong className="text-zinc-200">Newsletter email</strong> — if you subscribe to product updates, the address you enter in the subscribe form.</>,
            <><strong className="text-zinc-200">Support email</strong> — the content of messages you send to our support address.</>,
          ]}
        />
      </Section>

      <Section id="local" title="3. Data stored only in your browser">
        <p>
          Video editing runs locally in your browser. Preview playback relies on media cached in <strong className="text-zinc-200">IndexedDB</strong>{" "}
          on your own device, and your session token is kept in browser local storage. Clearing your browser data removes both. Your password
          never reaches localStorage.
        </p>
      </Section>

      <Section id="use" title="4. How we use data">
        <List
          items={[
            "To operate the editor: store and serve your projects and media, restore cached assets when you reopen a project.",
            "To provide AI features: your prompt (and, for transcription or background removal, the selected media) is sent to the AI provider configured for that feature so it can generate the result.",
            "To authenticate you and keep your projects private to your account.",
            "To send product updates you explicitly subscribed to (one click to unsubscribe in every email).",
            "We do not sell your data and we do not use your projects or media to advertise to anyone.",
          ]}
        />
      </Section>

      <Section id="processors" title="5. Third-party processors">
        <p>Hosting, storage and AI generation rely on specialized providers that process data on our behalf:</p>
        <List
          items={[
            <><strong className="text-zinc-200">Vercel, Inc.</strong> — application hosting and delivery (EU/US edge network).</>,
            <><strong className="text-zinc-200">Neon</strong> — managed PostgreSQL database storing accounts, projects and media chunks.</>,
            <><strong className="text-zinc-200">AI video / image / voice providers</strong> — WaveSpeed, Kie.ai, Higgsfield, PixVerse, fal.ai, Pollinations, Google translate-TTS and the configured LLM (OpenRouter). What is sent: the prompt or media needed for the requested generation, nothing else. Results returned by them are stored like any other media.</>,
            <><strong className="text-zinc-200">OpenMoji</strong> — public sticker CDN (CC BY-SA 4.0) used by the sticker search.</>,
          ]}
        />
        <p>
          These providers act under their own privacy terms. Prompts and media submitted for AI generation are processed by the receiving
          provider under its policy — review it if you plan to send sensitive material.
        </p>
      </Section>

      <Section id="retention" title="6. Retention and deletion">
        <List
          items={[
            "Projects and media are kept until you delete them. Deleting a project or a library asset removes it from our database (media chunks are deleted with the file).",
            "You can delete your account from Account Settings; this removes your projects, media files and personal data.",
            "Server and security logs kept by our hosting provider expire automatically after a short retention window.",
          ]}
        />
      </Section>

      <Section id="rights" title="7. Your rights">
        <p>
          You can access, correct, export (download your media and projects) and delete your data at any time from the dashboard and settings
          pages. For anything that cannot be done in the product — including a full account data export or a GDPR/CCPA request — email{" "}
          <a className="text-zinc-200 underline decoration-zinc-600 underline-offset-4 hover:decoration-zinc-300" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{" "}
          and we will respond within 30 days.
        </p>
      </Section>

      <Section id="children" title="8. Children">
        <p>VisionCut is not directed at children under 13 (or 16 in the EEA). We do not knowingly collect their personal data.</p>
      </Section>

      <Section id="changes" title="9. Changes to this policy">
        <p>
          We will update this page as the product evolves and change the &quot;Last updated&quot; date above. Material changes will be announced
          in the app or by email to account holders.
        </p>
      </Section>
    </LegalPage>
  );
}

export function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title={<>Terms of <span className="text-gradient">Service</span></>}
      intro="The agreement between you and VisionCut AI when you use the editor, the AI tools and this website."
    >
      <Section id="acceptance" title="1. Acceptance">
        <p>
          By creating an account or using VisionCut AI you agree to these terms. If you do not agree, do not use the service. You must be at
          least 13 years old (16 in the EEA) and able to form a binding contract.
        </p>
      </Section>

      <Section id="service" title="2. The service">
        <p>
          VisionCut AI provides a browser-based, multitrack video editor with AI features (script-to-storyboard, text-to-video, image
          generation, voiceover, transcription, stickers) and a per-account cloud media library. The product is currently in{" "}
          <strong className="text-zinc-200">early access</strong>: features may change, and pricing shown on the site is a placeholder until
          plans officially launch — you will always be asked before any charge.
        </p>
      </Section>

      <Section id="accounts" title="3. Accounts">
        <p>
          Keep your credentials confidential; you are responsible for activity under your account. Cloud media storage is limited to 1&nbsp;GB
          per account during early access. We may suspend accounts that abuse the service or endanger its availability for others.
        </p>
      </Section>

      <Section id="content" title="4. Your content">
        <p>
          You keep all rights to the projects, media and scripts you create or upload. You grant us only the limited license needed to store,
          process and display them inside the service (for example, generating thumbnails or serving your video back to your browser). You
          confirm you own or have licensed everything you upload, including music and footage, and that it does not violate any law or third
          party&apos;s rights.
        </p>
      </Section>

      <Section id="ai" title="5. AI features and generated content">
        <p>
          AI output (storyboards, video clips, images, voiceovers, transcriptions) is produced by third-party models and may be inaccurate,
          imperfect or unsuitable for a given purpose. Review every result before publishing it. You are responsible for how you use generated
          content, including compliance with platform rules, disclosure requirements and applicable law (including rules on synthetic media
          and impersonation). Do not use the tools to create deceptive, harmful or illegal material.
        </p>
      </Section>

      <Section id="acceptable-use" title="6. Acceptable use">
        <List
          items={[
            "Do not upload or generate unlawful, infringing, hateful, explicit or deceptive content.",
            "Do not attempt to access other accounts, scrape the service, or bypass quotas, rate limits and authentication.",
            "Do not use the service to distribute malware or to build a competing dataset from our API.",
          ]}
        />
      </Section>

      <Section id="availability" title="7. Availability, changes and termination">
        <p>
          The service is provided &quot;as is&quot; during early access, without warranties of uninterrupted availability. We may add, change or
          discontinue features. You can stop using VisionCut and delete your account at any time; we may suspend or terminate accounts that
          violate these terms, with notice where practical.
        </p>
      </Section>

      <Section id="liability" title="8. Limitation of liability">
        <p>
          To the maximum extent permitted by law, VisionCut is not liable for indirect, incidental or consequential damages, or for lost data
          outside its reasonable control. Where liability cannot be excluded, it is limited to the amount you paid us in the 12 months before
          the claim (typically zero during free early access).
        </p>
      </Section>

      <Section id="changes" title="9. Changes to these terms">
        <p>
          We may update these terms as the product launches new features. Continued use after an update means acceptance. The current version
          is always on this page.
        </p>
      </Section>

      <Section id="contact" title="10. Contact">
        <p>
          Questions about these terms:{" "}
          <a className="text-zinc-200 underline decoration-zinc-600 underline-offset-4 hover:decoration-zinc-300" href="mailto:support@visioncut.ai">
            support@visioncut.ai
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
