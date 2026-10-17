import React from "react";

/** Small icon set used across showcase/pricing without extra deps. */
export function UseTemplate({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 12H3" /><path d="M16 6H3" /><path d="M16 18H3" />
      <path d="m19 10-4 4" /><path d="m15 10 4 4" />
    </svg>
  );
}

export function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function Minus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className={className}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function Play({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M6 4.5a1.5 1.5 0 0 1 2.25-1.3l12 6.8a1.5 1.5 0 0 1 0 2.6l-12 6.8A1.5 1.5 0 0 1 6 18.5v-14Z" />
    </svg>
  );
}
