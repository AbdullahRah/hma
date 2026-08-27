import { Establishment, Product, RawEstablishment } from "./types";
import rawEstablishments from "@/data/establishments.json";

// ─── Establishments ──────────────────────────────────────
// One baked-in source of truth for every audited product sheet — the
// restaurants, D Spot and IGY alike. The list is read-only: establishments come
// from the audit workbooks, not from the UI.

const SHEETS = rawEstablishments as RawEstablishment[];

const SHEETS_BY_ID = new Map(SHEETS.map((s) => [s.id, s]));

const ESTABLISHMENTS: Establishment[] = SHEETS.map((s) => ({
    id: s.id,
    name: s.name,
    productCount: s.products.length,
}));

// ─── Helpers ─────────────────────────────────────────────

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** Alphabetical by name — the order every list in the tool is shown in. */
function byName<T extends { name: string }>(a: T, b: T): number {
    return collator.compare(a.name, b.name);
}

function byProductName(a: Product, b: Product): number {
    return (
        collator.compare(a.productName, b.productName) ||
        collator.compare(a.brandName, b.brandName)
    );
}

// ─── Establishments (read-only) ──────────────────────────

export function getEstablishments(): Establishment[] {
    return ESTABLISHMENTS.map((e) => ({
        ...e,
        productCount: getProductsForEstablishment(e.id).length,
    })).sort(byName);
}

export function getEstablishmentById(id: string): Establishment | undefined {
    return getEstablishments().find((e) => e.id === id);
}

/** Where an establishment's list came from, and how old it is. */
export function getSheetInfo(id: string): {
    source: string;
    sheetDate: string;
    monthsOld: number | null;
} | undefined {
    const sheet = SHEETS_BY_ID.get(id);
    if (!sheet) return undefined;
    let monthsOld: number | null = null;
    if (sheet.sheetDate) {
        const then = new Date(sheet.sheetDate);
        if (!Number.isNaN(then.getTime())) {
            const now = new Date();
            monthsOld =
                (now.getFullYear() - then.getFullYear()) * 12 +
                (now.getMonth() - then.getMonth());
        }
    }
    return { source: sheet.source, sheetDate: sheet.sheetDate, monthsOld };
}

// ─── Products ────────────────────────────────────────────

function getSheetProducts(establishmentId: string): Product[] {
    const sheet = SHEETS_BY_ID.get(establishmentId);
    if (!sheet) return [];
    return sheet.products.map((item, index) => ({
        id: `${sheet.id}-${index}`,
        establishmentId: sheet.id,
        productName: item.productName,
        brandName: item.brand || "—",
        ruling: item.ruling,
    }));
}

export function getProductsForEstablishment(establishmentId: string): Product[] {
    return getSheetProducts(establishmentId).sort(byProductName);
}

export function searchProducts(
    products: Product[],
    query: string
): Product[] {
    if (!query.trim()) return products;
    const q = query.toLowerCase().trim();
    return products.filter(
        (p) =>
            p.productName.toLowerCase().includes(q) ||
            p.brandName.toLowerCase().includes(q)
    );
}

// ─── Audit progress ──────────────────────────────────────
// Verification ticks are the one thing the inspector creates, so they survive a
// refresh, a backgrounded tab, or a phone that decides to reload the page
// mid-walkthrough. Scoped per establishment and keyed by product id.

const STORAGE_KEY_VERIFIED = "hma-verified";

type VerifiedStore = Record<string, string[]>;

function readVerifiedStore(): VerifiedStore {
    if (typeof window === "undefined") return {};
    try {
        const stored = localStorage.getItem(STORAGE_KEY_VERIFIED);
        return stored ? (JSON.parse(stored) as VerifiedStore) : {};
    } catch {
        return {}; // corrupt or unavailable storage must not break the audit
    }
}

export function getVerifiedIds(establishmentId: string): Set<string> {
    return new Set(readVerifiedStore()[establishmentId] ?? []);
}

export function saveVerifiedIds(establishmentId: string, ids: Set<string>): void {
    if (typeof window === "undefined") return;
    try {
        const store = readVerifiedStore();
        if (ids.size === 0) {
            delete store[establishmentId];
        } else {
            store[establishmentId] = [...ids];
        }
        localStorage.setItem(STORAGE_KEY_VERIFIED, JSON.stringify(store));
    } catch {
        // Storage full or blocked — the audit continues in memory.
    }
}

export function clearVerifiedIds(establishmentId: string): void {
    saveVerifiedIds(establishmentId, new Set());
}
