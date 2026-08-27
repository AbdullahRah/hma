#!/usr/bin/env node
// Rebuilds data/establishments.json from the audit workbooks.
//
//   npm run build:data              rebuild and write
//   npm run build:data -- --dry-run  show what would change, write nothing
//
// Workbooks live outside the repo (they are the client's working files), so the
// generated JSON is what gets committed. Point HMA_SHEETS_DIR at the folder if
// it is not the default sibling of the repo.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkbook } from "./xlsx-read.mjs";
import {
    normalizeProducts,
    slugify,
    sortEstablishments,
    tidy,
} from "./normalize.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHEETS_DIR =
    process.env.HMA_SHEETS_DIR ||
    path.resolve(ROOT, "..", "Restaurants Product List");
const SOURCES_DIR = path.join(ROOT, "data", "sources");
const OUT_FILE = path.join(ROOT, "data", "establishments.json");

// Column headers differ across 14 workbook generations; these are the aliases.
const NAME_HEADERS = [/^product name$/i, /^package name$/i];
const BRAND_HEADERS = [/^brand name$/i, /^brand$/i];
const RULING_HEADERS = [
    /^ruling$/i,
    /^second level check/i,
    /^permissible/i,
];

// The folder name is the display name, except where the client spells their own
// name differently on the sheet itself.
const DISPLAY_NAME_OVERRIDES = {
    "Dspot Dessert Cafe": "D Spot Dessert Café",
};

function findHeader(headers, patterns) {
    for (const pattern of patterns) {
        const index = headers.findIndex((h) => pattern.test(h));
        if (index >= 0) return index;
    }
    return -1;
}

/** Locate the sheet holding the product table — it is not always sheet 1. */
function findProductTable(workbook) {
    for (const sheet of workbook) {
        const limit = Math.min(6, sheet.rows.length);
        for (let i = 0; i < limit; i++) {
            const row = sheet.rows[i] || [];
            if (findHeader(row, NAME_HEADERS) >= 0) {
                return { headers: row, rows: sheet.rows.slice(i + 1) };
            }
        }
    }
    return null;
}

function latestWorkbook(dir) {
    const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".xlsx") && !f.startsWith("~$"))
        .sort();
    return files.length ? files[files.length - 1] : null;
}

/** Pull the trailing YYYY-MM-DD out of "Product List - X - 2026-07-15.xlsx". */
function sheetDate(filename) {
    const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
}

function readWorkbookEstablishment(dir, folder) {
    const file = latestWorkbook(dir);
    if (!file) return null;

    const table = findProductTable(readWorkbook(path.join(dir, file)));
    if (!table) {
        throw new Error(`No product table found in ${folder}/${file}`);
    }

    const iName = findHeader(table.headers, NAME_HEADERS);
    const iBrand = findHeader(table.headers, BRAND_HEADERS);
    const iRuling = findHeader(table.headers, RULING_HEADERS);

    const rows = table.rows.map((row) => ({
        productName: row[iName],
        brand: iBrand >= 0 ? row[iBrand] : "",
        ruling: iRuling >= 0 ? row[iRuling] : "",
    }));

    const name = DISPLAY_NAME_OVERRIDES[folder] || tidy(folder);
    return {
        id: slugify(name),
        name,
        source: file,
        sheetDate: sheetDate(file),
        products: normalizeProducts(rows),
        rawRowCount: rows.filter((r) => tidy(r.productName)).length,
    };
}

/** Establishments with no workbook (IGY) are kept as hand-maintained JSON. */
function readSourceEstablishments() {
    if (!fs.existsSync(SOURCES_DIR)) return [];
    return fs
        .readdirSync(SOURCES_DIR)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((file) => {
            const raw = JSON.parse(
                fs.readFileSync(path.join(SOURCES_DIR, file), "utf8")
            );
            const name = tidy(raw.name);
            return {
                id: slugify(name),
                name,
                source: raw.source || file,
                sheetDate: raw.sheetDate || "",
                products: normalizeProducts(raw.products || []),
                rawRowCount: (raw.products || []).length,
            };
        });
}

/** Compare a fresh build against the committed file so the diff is reviewable. */
function summarizeChanges(next) {
    if (!fs.existsSync(OUT_FILE)) {
        console.log("\nNo existing establishments.json — this is a first build.");
        return;
    }
    const previous = JSON.parse(fs.readFileSync(OUT_FILE, "utf8"));
    const before = new Map(previous.map((e) => [e.id, e]));
    const after = new Map(next.map((e) => [e.id, e]));

    const added = next.filter((e) => !before.has(e.id));
    const removed = previous.filter((e) => !after.has(e.id));
    const changed = next
        .filter((e) => before.has(e.id))
        .map((e) => ({ est: e, delta: e.products.length - before.get(e.id).products.length,
                       resourced: e.source !== before.get(e.id).source }))
        .filter((c) => c.delta !== 0 || c.resourced);

    if (!added.length && !removed.length && !changed.length) {
        console.log("\nNo changes — the committed data already matches these workbooks.");
        return;
    }

    console.log("\nChanges:");
    for (const e of added) {
        console.log(`  + NEW      ${e.name} — ${e.products.length} products from ${e.source}`);
    }
    for (const e of removed) {
        console.log(`  - DROPPED  ${e.name} — workbook folder no longer present`);
    }
    for (const { est, delta, resourced } of changed) {
        const move =
            delta > 0 ? `+${delta} products` :
            delta < 0 ? `${delta} products` :
            "same product count";
        console.log(
            `  ~ UPDATED  ${est.name} — ${move}` +
                (resourced ? ` · now from ${est.source}` : "")
        );
    }
}

function main() {
    const dryRun = process.argv.includes("--dry-run");
    if (!fs.existsSync(SHEETS_DIR)) {
        console.error(
            `Workbook folder not found: ${SHEETS_DIR}\n` +
                `Set HMA_SHEETS_DIR to the "Restaurants Product List" folder and re-run.`
        );
        process.exit(1);
    }

    const fromWorkbooks = fs
        .readdirSync(SHEETS_DIR)
        .filter((f) => fs.statSync(path.join(SHEETS_DIR, f)).isDirectory())
        .map((folder) => readWorkbookEstablishment(path.join(SHEETS_DIR, folder), folder))
        .filter(Boolean);

    const establishments = sortEstablishments([
        ...fromWorkbooks,
        ...readSourceEstablishments(),
    ]);

    const ids = new Set();
    for (const est of establishments) {
        if (ids.has(est.id)) throw new Error(`Duplicate establishment id: ${est.id}`);
        ids.add(est.id);
    }

    let totalProducts = 0;
    let totalDropped = 0;
    for (const est of establishments) {
        totalProducts += est.products.length;
        totalDropped += est.rawRowCount - est.products.length;
        const dropped = est.rawRowCount - est.products.length;
        console.log(
            `${est.name.padEnd(32)} ${String(est.products.length).padStart(4)} products` +
                (dropped ? `  (${dropped} duplicate rows removed)` : "") +
                (est.sheetDate ? `  · ${est.sheetDate}` : "")
        );
        delete est.rawRowCount;
    }

    console.log(
        `\n${establishments.length} establishments · ${totalProducts} products · ` +
            `${totalDropped} duplicate rows removed`
    );

    summarizeChanges(establishments);

    if (dryRun) {
        console.log(`\nDry run — ${path.relative(ROOT, OUT_FILE)} left untouched.`);
        return;
    }

    fs.writeFileSync(OUT_FILE, JSON.stringify(establishments, null, 2) + "\n");
    console.log(`\nWrote ${path.relative(ROOT, OUT_FILE)}`);
}

main();
