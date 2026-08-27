// ─── HMA product-sheet guardrails ────────────────────────────────────────────
// Every product sheet — restaurant workbook, DSpot, IGY — is normalized through
// this module before it lands in data/establishments.json. Keeping the rules in
// one place is what makes the sheets consistent with each other.

// Short strings that are genuinely acronyms or brand initialisms and must stay
// upper-case when an ALL-CAPS sheet is title-cased.
const KEEP_UPPER = new Set([
    "AAA", "ADM", "AEG", "AFP", "BBQ", "BV", "CLS", "GFS", "HP", "IQF", "ITN",
    "KFI", "KG", "KOO", "KTC", "LB", "MDH", "MF", "ML", "NH", "OZ", "PC",
    "RZBC", "SAC", "SYS", "UFC", "UK", "USA", "VH", "XL",
]);

// Lower-cased inside a title unless they lead it.
const SMALL_WORDS = new Set([
    "a", "an", "and", "as", "at", "by", "de", "for", "from", "in", "of", "on",
    "or", "the", "to", "with",
]);

// Brand cells that mean "we don't know the brand", not a brand called "N/A".
const BRAND_PLACEHOLDERS = new Set([
    "", "-", "--", "—", "?", "n/a", "n\\a", "na", "none", "nil", "tbd",
    "unknown", "blank", "x",
]);

const RULINGS = ["HMA Certified", "Approved", "Not Approved", "Cancelled", "Under Review"];

export { RULINGS };

/** Collapse whitespace and strip stray wrapping punctuation. */
export function tidy(value) {
    return String(value ?? "")
        .replace(/[   ]/g, " ")   // non-breaking spaces
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^["'`\s]+|["'`\s]+$/g, (m) => (m.includes('"') && value.includes('"') ? m : ""))
        .trim();
}

function isAllCaps(text) {
    return text === text.toUpperCase() && /[A-Z]/.test(text);
}

function titleCaseWord(word, isFirst) {
    // Anything carrying a digit or an internal period is a code/measure — leave it.
    if (/\d/.test(word) || /[A-Z]\.[A-Z]/.test(word)) return word;

    const bare = word.replace(/[^A-Za-z]/g, "");
    if (KEEP_UPPER.has(bare)) return word;

    const lower = word.toLowerCase();
    if (!isFirst && SMALL_WORDS.has(lower.replace(/[^a-z]/g, ""))) return lower;

    // Capitalize the first letter of each hyphen/slash-separated part, then
    // repair the "HELLMANN'S" → "Hellmann'S" artifact Excel exports produce.
    return lower
        .replace(/(^|[\s/(-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
        .replace(/([A-Za-z])'S\b/g, "$1's");
}

/**
 * Normalize casing: sheets typed in ALL CAPS become Title Case, sheets already
 * written in mixed case are left alone (their casing is deliberate).
 */
export function normalizeCase(text) {
    const cleaned = tidy(text);
    if (!cleaned || !isAllCaps(cleaned)) {
        return cleaned.replace(/([A-Za-z])'S\b/g, "$1's");
    }
    return cleaned
        .split(" ")
        .map((word, i) => titleCaseWord(word, i === 0))
        .join(" ");
}

export function normalizeProductName(value) {
    return normalizeCase(value);
}

export function normalizeBrand(value) {
    const cleaned = tidy(value);
    if (BRAND_PLACEHOLDERS.has(cleaned.toLowerCase())) return "";
    return normalizeCase(cleaned);
}

/** Map every ruling dialect found across the workbooks onto one vocabulary. */
export function normalizeRuling(value) {
    const cleaned = tidy(value).toLowerCase();
    if (!cleaned) return "Under Review";
    if (cleaned === "yes" || cleaned === "approved") return "Approved";
    if (cleaned === "no" || cleaned === "not approved") return "Not Approved";
    if (cleaned === "cancelled" || cleaned === "canceled") return "Cancelled";
    if (cleaned === "hma certified") return "HMA Certified";
    if (cleaned === "tbd" || cleaned === "pending") return "Under Review";
    return "Under Review";
}

/** URL-safe id: apostrophes vanish, everything else collapses to one dash. */
export function slugify(name) {
    return tidy(name)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/['’`]/g, "")
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

export function compareByName(a, b) {
    return collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}

/** Trim + case-normalize + drop blanks + de-duplicate + sort alphabetically. */
export function normalizeProducts(rows) {
    const seen = new Set();
    const products = [];
    for (const row of rows) {
        const productName = normalizeProductName(row.productName);
        if (!productName) continue;
        const brand = normalizeBrand(row.brand);
        const key = `${productName.toLowerCase()}|${brand.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        products.push({ productName, brand, ruling: normalizeRuling(row.ruling) });
    }
    products.sort(
        (a, b) =>
            compareByName(a.productName, b.productName) ||
            compareByName(a.brand, b.brand)
    );
    return products;
}

/** Sort establishments alphabetically by display name. */
export function sortEstablishments(establishments) {
    return [...establishments].sort((a, b) => compareByName(a.name, b.name));
}
