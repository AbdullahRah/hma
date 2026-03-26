"use client";

import { useState, useEffect, useMemo, useCallback, use } from "react";
import {
    getEstablishmentById,
    getProductsForEstablishment,
    searchProducts,
    addProduct,
    isDefaultEstablishment,
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

function PlusIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
   Add Product Modal
   ═══════════════════════════════════════════════ */

function AddProductModal({
    isOpen,
    onClose,
    onAdd,
}: {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (productName: string, brandName: string) => void;
}) {
    const [productName, setProductName] = useState("");
    const [brandName, setBrandName] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (productName.trim()) {
            onAdd(productName, brandName);
            setProductName("");
            setBrandName("");
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <span className="section-label">Add Product</span>
                    <button onClick={onClose} className="btn-ghost !p-1.5" aria-label="Close">
                        <CloseIcon />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3">
                    <input
                        type="text"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="product_name"
                        autoFocus
                        className="search-input"
                        style={{ paddingLeft: "14px" }}
                    />
                    <input
                        type="text"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="brand_name (optional)"
                        className="search-input"
                        style={{ paddingLeft: "14px" }}
                    />
                    <button type="submit" disabled={!productName.trim()} className="btn-filled w-full">
                        Add Product
                    </button>
                </form>
            </div>
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
    return (
        <div className={`product-row fade-in ${verified ? "verified" : ""}`}>
            <div className="min-w-0 flex-1">
                <p className="text-[16px] font-normal leading-snug truncate" style={{ color: "var(--text-primary)" }}>
                    {product.productName}
                </p>
            </div>
            <span
                className="text-[14px] flex-shrink-0 ml-3 truncate max-w-[140px] text-right"
                style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
            >
                {product.brandName}
            </span>
            <button
                onClick={onToggle}
                className={`verify-toggle ${verified ? "checked" : ""}`}
                aria-label={verified ? "Unverify product" : "Verify product"}
                title={verified ? "Verified" : "Click to verify"}
            >
                {verified && <CheckIcon />}
            </button>
        </div>
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
    const [showAddModal, setShowAddModal] = useState(false);
    const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());

    const loadData = useCallback(() => {
        const est = getEstablishmentById(resolvedParams.id);
        if (est) {
            setEstablishment(est);
            setAllProducts(getProductsForEstablishment(resolvedParams.id));
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

    const handleAddProduct = (productName: string, brandName: string) => {
        addProduct(resolvedParams.id, productName, brandName);
        loadData();
    };

    const toggleVerified = useCallback((productId: string) => {
        setVerifiedIds((prev) => {
            const next = new Set(prev);
            if (next.has(productId)) {
                next.delete(productId);
            } else {
                next.add(productId);
            }
            return next;
        });
    }, []);

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

    return (
        <main className="min-h-screen safe-area-bottom slide-in" style={{ background: "var(--bg-base)" }}>
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
            <div className="max-w-2xl mx-auto px-5 pt-6 pb-4">
                <Link href="/" className="inline-flex items-center gap-1 mb-4 group" style={{ color: "var(--accent)" }}>
                    <BackArrow />
                    <span className="text-[14px] font-medium">Establishments</span>
                </Link>

                <div className="flex items-end justify-between">
                    <div className="min-w-0 flex-1">
                        <h1 className="text-[30px] font-bold tracking-tight leading-none truncate" style={{ color: "var(--text-primary)" }}>
                            {establishment.name}
                        </h1>
                    </div>
                    {!isDefaultEstablishment(resolvedParams.id) && (
                        <button onClick={() => setShowAddModal(true)} className="btn-outline !py-2 !px-4 text-[13px]" aria-label="Add product">
                            <PlusIcon />
                            <span>Add</span>
                        </button>
                    )}
                </div>

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
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[14px]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                            {verifiedCount} of {totalCount} products verified
                        </span>
                        <span className="text-[14px] font-medium" style={{ color: progressPct === 100 && totalCount > 0 ? "var(--clr-success)" : "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                            {totalCount > 0 ? Math.round(progressPct) : 0}%
                        </span>
                    </div>
                    <div className="progress-bar-track">
                        <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center justify-between">
                    <span className="section-label">Approved Products</span>
                    <span className="count-chip">{filteredProducts.length}</span>
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
                        <span className="flex-1 text-[12px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                            Product Name
                        </span>
                        <span className="text-[12px] font-medium uppercase tracking-wider mr-3" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                            Brand
                        </span>
                        <span className="text-[12px] font-medium uppercase tracking-wider w-[22px] text-center" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
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

            <AddProductModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onAdd={handleAddProduct} />
        </main>
    );
}
