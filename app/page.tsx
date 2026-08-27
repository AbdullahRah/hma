"use client";

import { useState, useEffect } from "react";
import { getEstablishments } from "@/lib/data";
import { Establishment } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import Link from "next/link";

/* ═══════════════════════════════════════════════
   Inline SVG Icons
   ═══════════════════════════════════════════════ */

function ChevronRight() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
      <path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.4 3.4L4.5 4.5M11.5 11.5L12.6 12.6M12.6 3.4L11.5 4.5M4.5 11.5L3.4 12.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M13.5 9.5C12.5 10.5 11 11.1 9.4 11.1C6.1 11.1 3.4 8.4 3.4 5.1C3.4 3.5 4 2 5 1C2.6 2.1 1 4.5 1 7.3C1 11.2 4.1 14.3 8 14.3C10.8 14.3 13.2 12.7 14.3 10.3C13.9 10.1 13.7 9.8 13.5 9.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   Establishment Row
   ═══════════════════════════════════════════════ */

function EstablishmentRow({ establishment }: { establishment: Establishment }) {
  return (
    <div className="fade-in">
      <Link href={`/establishment/${establishment.id}`} className="est-row">
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-semibold tracking-tight truncate" style={{ color: "var(--text-primary)" }}>
            {establishment.name}
          </p>
          <p className="text-[14px] mt-0.5" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            {establishment.productCount} {establishment.productCount === 1 ? "product" : "products"} approved
          </p>
        </div>
        <span style={{ color: "var(--accent)" }} className="flex-shrink-0">
          <ChevronRight />
        </span>
      </Link>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Main — Establishments Page
   ═══════════════════════════════════════════════ */

export default function HomePage() {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    setEstablishments(getEstablishments());
  }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border-default)", borderTopColor: "var(--accent)" }} />
      </main>
    );
  }

  return (
    <main className="min-h-screen safe-area-bottom" style={{ background: "var(--bg-base)" }}>
      {/* ── Top Bar ──────────────────────────── */}
      <div className="top-bar">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="wordmark">HMA</span>
            <span style={{ color: "var(--border-default)" }}>|</span>
            <span className="tool-label">Audit Tool</span>
          </div>
          <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      {/* ── Page Header ──────────────────────── */}
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-4">
        <h1 className="text-[30px] font-bold tracking-tight leading-none" style={{ color: "var(--text-primary)" }}>
          Establishments
        </h1>
        <p className="text-[15px] mt-2" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
          {establishments.length} registered
        </p>
      </div>

      {/* ── Divider ──────────────────────────── */}
      <div className="max-w-2xl mx-auto px-5">
        <hr className="hr-sharp" />
      </div>

      {/* ── List ─────────────────────────────── */}
      <div className="max-w-2xl mx-auto mt-0">
        {establishments.map((est) => (
          <EstablishmentRow key={est.id} establishment={est} />
        ))}
      </div>

      {/* ── Footer ───────────────────────────── */}
      <div className="max-w-2xl mx-auto px-5 mt-8">
        <hr className="hr-sharp" />
      </div>
    </main>
  );
}
