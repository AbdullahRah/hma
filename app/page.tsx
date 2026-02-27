"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getEstablishments,
  addEstablishment,
  deleteEstablishment,
  isDefaultEstablishment,
} from "@/lib/data";
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

function PlusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
   Add Establishment Modal
   ═══════════════════════════════════════════════ */

function AddEstablishmentModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd(name);
      setName("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <span className="section-label">New Establishment</span>
          <button onClick={onClose} className="btn-ghost !p-1.5" aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 pb-5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="establishment_name"
            autoFocus
            className="search-input mb-4"
            style={{ paddingLeft: "14px" }}
          />
          <button type="submit" disabled={!name.trim()} className="btn-filled w-full">
            Add Establishment
          </button>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Establishment Row
   ═══════════════════════════════════════════════ */

function EstablishmentRow({
  establishment,
  onDelete,
}: {
  establishment: Establishment;
  onDelete?: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="fade-in">
      <Link
        href={`/establishment/${establishment.id}`}
        className="est-row"
        onContextMenu={(e) => {
          if (!isDefaultEstablishment(establishment.id) && onDelete) {
            e.preventDefault();
            setConfirmDelete(!confirmDelete);
          }
        }}
      >
        <div className="accent-line self-stretch rounded-sm" style={{ minHeight: 24 }} />
        <div className="flex-1 min-w-0 ml-2">
          <p className="text-[15px] font-semibold tracking-tight truncate" style={{ color: "var(--text-primary)" }}>
            {establishment.name}
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            {establishment.productCount} {establishment.productCount === 1 ? "product" : "products"} approved
          </p>
        </div>
        <span style={{ color: "var(--accent)" }} className="flex-shrink-0">
          <ChevronRight />
        </span>
      </Link>

      {confirmDelete && onDelete && (
        <div className="flex items-center justify-end gap-2 px-5 py-2.5" style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-default)" }}>
          <button onClick={() => setConfirmDelete(false)} className="btn-ghost text-[13px]">Cancel</button>
          <button
            onClick={() => { onDelete(establishment.id); setConfirmDelete(false); }}
            className="text-[13px] font-semibold px-3 py-1.5 rounded"
            style={{ color: "var(--clr-destructive)" }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Main — Establishments Page
   ═══════════════════════════════════════════════ */

export default function HomePage() {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const refresh = useCallback(() => {
    setEstablishments(getEstablishments());
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
  }, [refresh]);

  const handleAdd = (name: string) => {
    addEstablishment(name);
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteEstablishment(id);
    refresh();
  };

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
            <span className="wordmark">staqtech</span>
            <span style={{ color: "var(--border-default)" }}>|</span>
            <span className="tool-label">HMA Audit Tool</span>
          </div>
          <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      {/* ── Page Header ──────────────────────── */}
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight leading-none" style={{ color: "var(--text-primary)" }}>
              Establishments
            </h1>
            <p className="text-[13px] mt-2" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
              {establishments.length} registered
            </p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-outline !py-2 !px-4 text-[13px]" aria-label="Add establishment">
            <PlusIcon size={12} />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* ── Divider ──────────────────────────── */}
      <div className="max-w-2xl mx-auto px-5">
        <hr className="hr-sharp" />
      </div>

      {/* ── List ─────────────────────────────── */}
      <div className="max-w-2xl mx-auto mt-0">
        {establishments.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[15px] font-medium" style={{ color: "var(--text-secondary)" }}>No establishments</p>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-tertiary)" }}>
              Add an establishment to begin auditing.
            </p>
          </div>
        ) : (
          establishments.map((est) => (
            <EstablishmentRow
              key={est.id}
              establishment={est}
              onDelete={!isDefaultEstablishment(est.id) ? handleDelete : undefined}
            />
          ))
        )}
      </div>

      {/* ── Footer ───────────────────────────── */}
      <div className="max-w-2xl mx-auto px-5 mt-8">
        <hr className="hr-sharp" />
        <p className="text-[11px] mt-4 text-center" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
          Right-click to remove a custom establishment
        </p>
      </div>

      <AddEstablishmentModal isOpen={showModal} onClose={() => setShowModal(false)} onAdd={handleAdd} />
    </main>
  );
}
