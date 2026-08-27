"use client";

import { useState, useEffect, useMemo, useCallback, use } from "react";
import {
    getEstablishmentById,
    getProductsForEstablishment,
    searchProducts,
    getSheetInfo,
    getVerifiedIds,
    saveVerifiedIds,
    clearVerifiedIds,
} from "@/lib/data";
import { Establishment, Product } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import Link from "next/link";

const GOOGLE_FORM_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLSe1kjtRMuApbj8NIXHCR40RYH1ozJB0l2slAjYpwF8-Jo9QDA/viewform";

/* ═══════════════════════════════════════════════
   Icons
   ═══════════════════════════════════════════════ */

function BackArrow() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function SearchIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M6.25 11.5C9.1495 11.5 11.5 9.1495 11.5 6.25C11.5 3.35051 9.1495 1 6.25 1C3.35051 1 1 3.35051 1 6.25C1 9.1495 3.35051 11.5 6.25 11.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            <path d="M13 13L10 10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
    );
}

function ClearIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function ExternalLinkIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="ext-link-icon">
            <path d="M5 1H2C1.44772 1 1 1.44772 1 2V10C1 10.5523 1.44772 11 2 11H10C10.5523 11 11 10.5523 11 10V7M8 1H11M11 1V4M11 1L5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function DownloadIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V9.5M7 9.5L4 6.5M7 9.5L10 6.5M1.5 11.5H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
   Missing Product CTA
   ═══════════════════════════════════════════════ */

function MissingProductCTA({ searchTerm }: { searchTerm?: string }) {
    return (
        <div className="missing-product-section fade-in">
            {searchTerm ? (
                <>
                    <p className="label">
                        No results for &lsquo;{searchTerm}&rsquo;
                    </p>
                    <p className="subtext">
                        This product may not be approved yet. Submit it for review and we&apos;ll get back to you.
                    </p>
                </>
            ) : (
                <>
                    <p className="label">Can&apos;t find a product?</p>
                    <p className="subtext">
                        If a product is missing from this list, submit it for review and approval.
                    </p>
                </>
            )}
            <a
                href={GOOGLE_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
            >
                Submit Missing Product
                <ExternalLinkIcon />
            </a>
        </div>
    );
}

/* ═══════════════════════════════════════════════
   Product Row (with verify toggle)
   ═══════════════════════════════════════════════ */

function ProductRow({
    product,
    verified,
    onToggle,
}: {
    product: Product;
    verified: boolean;
    onToggle: () => void;
}) {
    // The whole row is the tap target — in the field this gets used one-handed,
    // often with gloves, so aiming at a checkbox is not realistic.
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={verified}
            className={`product-row fade-in ${verified ? "verified" : ""}`}
        >
            <span className="product-name">{product.productName}</span>
            <span className="product-brand">{product.brandName}</span>
            <span className={`verify-toggle ${verified ? "checked" : ""}`} aria-hidden="true">
                {verified && <CheckIcon />}
            </span>
            <span className="sr-only">
                {verified ? "Verified — tap to clear" : "Not verified — tap to verify"}
            </span>
        </button>
    );
}

/* ═══════════════════════════════════════════════
   CSV Report Generator
   ═══════════════════════════════════════════════ */

function generateCSV(
    establishmentName: string,
    products: Product[],
    verifiedSet: Set<string>
): string {
    const today = new Date().toISOString().split("T")[0];
    const headers = ["Establishment Name", "Product Name", "Brand Name", "Verified", "Date"];
    const rows = products.map((p) => [
        `"${establishmentName.replace(/"/g, '""')}"`,
        `"${p.productName.replace(/"/g, '""')}"`,
        `"${p.brandName.replace(/"/g, '""')}"`,
        verifiedSet.has(p.id) ? "Yes" : "No",
        today,
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function downloadCSV(csv: string, filename: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════
   Main — Establishment Detail Page
   ═══════════════════════════════════════════════ */

export default function EstablishmentPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = use(params);
    const { theme, toggleTheme } = useTheme();
    const [establishment, setEstablishment] = useState<Establishment | null>(null);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [query, setQuery] = useState("");
    const [mounted, setMounted] = useState(false);
    const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());

    const loadData = useCallback(() => {
        const est = getEstablishmentById(resolvedParams.id);
        if (est) {
            setEstablishment(est);
            setAllProducts(getProductsForEstablishment(resolvedParams.id));
            setVerifiedIds(getVerifiedIds(resolvedParams.id));
        }
    }, [resolvedParams.id]);

    useEffect(() => {
        setMounted(true);
        loadData();
    }, [loadData]);

    const filteredProducts = useMemo(
        () => searchProducts(allProducts, query),
        [allProducts, query]
    );

    const toggleVerified = useCallback(
        (productId: string) => {
            setVerifiedIds((prev) => {
                const next = new Set(prev);
                if (next.has(productId)) {
                    next.delete(productId);
                } else {
                    next.add(productId);
                }
                saveVerifiedIds(resolvedParams.id, next);
                return next;
            });
        },
        [resolvedParams.id]
    );

    const resetVerified = useCallback(() => {
        clearVerifiedIds(resolvedParams.id);
        setVerifiedIds(new Set());
    }, [resolvedParams.id]);

    const verifiedCount = allProducts.filter((p) => verifiedIds.has(p.id)).length;
    const totalCount = allProducts.length;
    const progressPct = totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0;

    const handleGenerateReport = () => {
        if (!establishment) return;
        const today = new Date().toISOString().split("T")[0];
        const safeName = establishment.name.replace(/[^a-zA-Z0-9]/g, "_");
        const filename = `HMA_${safeName}_${today}.csv`;
        const csv = generateCSV(establishment.name, allProducts, verifiedIds);
        downloadCSV(csv, filename);
    };

    /* ── Loading state ────────────────────────── */
    if (!mounted) {
        return (
            <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border-default)", borderTopColor: "var(--accent)" }} />
            </main>
        );
    }

    /* ── Not found ────────────────────────────── */
    if (!establishment) {
        return (
            <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
                <div className="text-center">
                    <p className="text-[15px] font-medium" style={{ color: "var(--text-secondary)" }}>Establishment not found</p>
                    <Link href="/" className="text-[14px] mt-3 inline-block" style={{ color: "var(--accent)" }}>
                        Return to list
                    </Link>
                </div>
            </main>
        );
    }

    const hasResults = filteredProducts.length > 0;
    const isSearching = query.trim().length > 0;
    const sheetInfo = getSheetInfo(resolvedParams.id);

    return (
        <main className="min-h-screen safe-area-bottom slide-in" style={{ background: "var(--bg-base)" }}>
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
            <div className="max-w-2xl mx-auto px-5 pt-6 pb-4">
                <Link href="/" className="inline-flex items-center gap-1 mb-4 group" style={{ color: "var(--accent)" }}>
                    <BackArrow />
                    <span className="text-[14px] font-medium">Establishments</span>
                </Link>

                <h1 className="text-[30px] font-bold tracking-tight leading-none truncate" style={{ color: "var(--text-primary)" }}>
                    {establishment.name}
                </h1>
                {sheetInfo?.sheetDate && (
                    <p className="sheet-meta mt-1.5" title={sheetInfo.source}>
                        Sheet dated {sheetInfo.sheetDate}
                        {sheetInfo.monthsOld !== null && sheetInfo.monthsOld >= 24 && (
                            <span className="sheet-stale"> · {Math.floor(sheetInfo.monthsOld / 12)}+ years old</span>
                        )}
                    </p>
                )}

            </div>

            {/* ── Divider ──────────────────────────── */}
            <div className="max-w-2xl mx-auto px-5">
                <hr className="hr-sharp" />
            </div>

            {/* ── Search + Submit Missing + Meta ──── */}
            <div className="max-w-2xl mx-auto px-5 pt-4 pb-2">
                {/* Search */}
                <div className="relative mb-3">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }}>
                        <SearchIcon />
                    </div>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="search products or brands..."
                        className="search-input"
                        id="product-search"
                    />
                    {query && (
                        <button
                            onClick={() => setQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-sm"
                            style={{ background: "var(--border-default)", color: "var(--text-secondary)" }}
                            aria-label="Clear search"
                        >
                            <ClearIcon />
                        </button>
                    )}
                </div>

                {/* Submit Missing Product — top placement */}
                <div className="mb-4">
                    <a
                        href={GOOGLE_FORM_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-outline small w-full"
                    >
                        Submit Missing Product
                        <ExternalLinkIcon />
                    </a>
                </div>

                {/* Verification Progress */}
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5 gap-3">
                        <span className="progress-label">
                            <strong>{verifiedCount}</strong> of {totalCount} verified
                        </span>
                        <div className="flex items-center gap-3">
                            {verifiedCount > 0 && (
                                <button onClick={resetVerified} className="reset-link">
                                    Reset
                                </button>
                            )}
                            <span
                                className="progress-pct"
                                style={{ color: progressPct === 100 && totalCount > 0 ? "var(--clr-success)" : "var(--text-tertiary)" }}
                            >
                                {totalCount > 0 ? Math.round(progressPct) : 0}%
                            </span>
                        </div>
                    </div>
                    <div
                        className="progress-bar-track"
                        role="progressbar"
                        aria-valuenow={Math.round(progressPct)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Products verified"
                    >
                        <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center justify-between">
                    <span className="section-label">
                        {isSearching ? "Matching Products" : "Products"}
                    </span>
                    <span className="count-chip">
                        {isSearching ? `${filteredProducts.length} of ${totalCount}` : totalCount}
                    </span>
                </div>
            </div>

            {/* ── Divider ──────────────────────────── */}
            <div className="max-w-2xl mx-auto px-5">
                <hr className="hr-sharp" />
            </div>

            {/* ── Column Headers ───────────────────── */}
            {hasResults && (
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center px-5 py-2" style={{ borderBottom: "1px solid var(--border-default)" }}>
                        <span className="flex-1 text-[12px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                            Product Name
                        </span>
                        <span className="text-[12px] font-medium uppercase tracking-wider mr-3" style={{ color: "var(--text-tertiary)" }}>
                            Brand
                        </span>
                        <span className="text-[12px] font-medium uppercase tracking-wider w-[28px] text-center" style={{ color: "var(--text-tertiary)" }}>
                            ✓
                        </span>
                    </div>
                </div>
            )}

            {/* ── Product List ─────────────────────── */}
            <div className="max-w-2xl mx-auto">
                {hasResults ? (
                    <>
                        {filteredProducts.map((product) => (
                            <ProductRow
                                key={product.id}
                                product={product}
                                verified={verifiedIds.has(product.id)}
                                onToggle={() => toggleVerified(product.id)}
                            />
                        ))}
                        <MissingProductCTA />
                    </>
                ) : (
                    <MissingProductCTA searchTerm={isSearching ? query.trim() : undefined} />
                )}
            </div>

            {/* ── Generate Report Section ────────── */}
            <div className="max-w-2xl mx-auto">
                <div className="report-section">
                    <span className="section-label block mb-3">Generate Report</span>
                    <button
                        onClick={handleGenerateReport}
                        className="btn-filled w-full"
                    >
                        <DownloadIcon />
                        Generate Report
                    </button>
                    <p className="report-note">
                        Downloads a CSV with all products and their verification status. Open in Google Sheets for a full formatted report.
                    </p>
                </div>
            </div>

        </main>
    );
}
