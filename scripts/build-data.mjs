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
    normalizeBrand,
    normalizeLegendType,
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
// Read only to recover a verdict the ruling column never recorded (Passage to
// India). Both hold phrases lifted verbatim from the workbook's own "Definition"
// legend sheet. A note never overrides a ruling column that is filled in — see
// resolveRuling in normalize.mjs.
const LEVEL_ONE_HEADERS = [/^comments \(level i\)$/i];
const REMARKS_HEADERS = [/^remarks$/i];
// Fallback for a blank brand cell: the sheet's own record of who makes the
// product. Sourced data, not a guess — a blank stays blank if this is empty too.
const MANUFACTURER_HEADERS = [
    /^manufacturer \/ brand owner \/ client$/i,
    /^manufacturer$/i,
    /^brand owner$/i,
];

// The folder name is the display name, except where the client spells their own
// name differently on the sheet itself.
const DISPLAY_NAME_OVERRIDES = {
    "Dspot Dessert Cafe": "D Spot Dessert Café",
};

// Dropped from the tool: no longer HMA clients, or never belonged in a list of
// audited restaurants. Keyed by id so it catches a workbook folder and a
// data/sources entry alike. The source files stay on disk — delete a line here
// to bring one back.
const EXCLUDED_ESTABLISHMENTS = new Set([
    "the-dum-biryani",          // no longer an HMA client
    "texas-wild-bbq",           // no longer an HMA client
    "hyperama-lekker-restuarant", // no longer an HMA client
    "igy-immune-technologies",  // non-meat client, not a restaurant
]);

// Clients whose workbook has not arrived yet. Listed so every build says out
// loud what the tool is still missing; drop a workbook folder in and the name
// disappears from the reminder on its own.
//
// A name stays here even once it has an entry in data/sources — Fortinos and
// Loblaws were opened from a single emailed product each, so the tool shows
// them but their real sheet is still outstanding. The reminder tracks
// *workbooks*, not entries, so it keeps saying so.
const AWAITING_SHEETS = ["Fortinos", "Loblaws"];

function findHeader(headers, patterns) {
    for (const pattern of patterns) {
        const index = headers.findIndex((h) => pattern.test(h));
        if (index >= 0) return index;
    }
    return -1;
}

/** Locate the sheet holding the product table — it is not always sheet 1. */
function findProductTable(workbook) {
    for (const [index, sheet] of workbook.entries()) {
        const limit = Math.min(6, sheet.rows.length);
        for (let i = 0; i < limit; i++) {
            const row = sheet.rows[i] || [];
            if (findHeader(row, NAME_HEADERS) >= 0) {
                return { headers: row, rows: sheet.rows.slice(i + 1), index };
            }
        }
    }
    return null;
}

/**
 * Read the workbook's "Definition" sheet — a legend of
 * `Product Type | Selection | Definition` that tells you which verdict each
 * Level I phrase stands for. Returns selection phrase → ruling, lower-cased.
 * Empty for the handful of older sheets that predate the legend.
 */
function readLegend(workbook, productSheetIndex) {
    const legend = new Map();
    workbook.forEach((sheet, index) => {
        if (index === productSheetIndex) return;
        const start = sheet.rows.findIndex(
            (row) => /^product type$/i.test(row[0] || "") && /^selection$/i.test(row[1] || "")
        );
        if (start < 0) return;
        for (const row of sheet.rows.slice(start + 1)) {
            const ruling = normalizeLegendType(row[0]);
            const selection = tidy(row[1]);
            if (ruling && selection) legend.set(selection.toLowerCase(), ruling);
        }
    });
    return legend;
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

    const workbook = readWorkbook(path.join(dir, file));
    const table = findProductTable(workbook);
    if (!table) {
        throw new Error(`No product table found in ${folder}/${file}`);
    }

    const iName = findHeader(table.headers, NAME_HEADERS);
    const iBrand = findHeader(table.headers, BRAND_HEADERS);
    const iRuling = findHeader(table.headers, RULING_HEADERS);
    const iLevelOne = findHeader(table.headers, LEVEL_ONE_HEADERS);
    const iRemarks = findHeader(table.headers, REMARKS_HEADERS);
    const iManufacturer = findHeader(table.headers, MANUFACTURER_HEADERS);

    const legend = readLegend(workbook, table.index);

    /** The verdict the row's Level I note stands for, "" if it carries none. */
    const legendRuling = (row) => {
        for (const index of [iLevelOne, iRemarks]) {
            if (index < 0) continue;
            const ruling = legend.get(tidy(row[index]).toLowerCase());
            if (ruling) return ruling;
        }
        return "";
    };

    const rows = table.rows.map((row) => {
        const brand = iBrand >= 0 ? normalizeBrand(row[iBrand]) : "";
        return {
            productName: row[iName],
            // A blank brand falls back to the manufacturer the sheet names —
            // bulk raw materials ("Leek", "Onion Yellow Foodservice") often
            // have no consumer brand at all and stay blank either way.
            brand: brand || (iManufacturer >= 0 ? row[iManufacturer] : ""),
            ruling: iRuling >= 0 ? row[iRuling] : "",
            legendRuling: legendRuling(row),
        };
    });

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
        const count = `${e.products.length} product${e.products.length === 1 ? "" : "s"}`;
        console.log(`  + NEW      ${e.name} — ${count} from ${e.source}`);
    }
    for (const e of removed) {
        console.log(
            `  - DROPPED  ${e.name} — ` +
                (EXCLUDED_ESTABLISHMENTS.has(e.id)
                    ? "excluded on purpose (EXCLUDED_ESTABLISHMENTS)"
                    : "workbook folder no longer present")
        );
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

    const all = [...fromWorkbooks, ...readSourceEstablishments()];
    const dropped = all.filter((e) => EXCLUDED_ESTABLISHMENTS.has(e.id));
    const establishments = sortEstablishments(
        all.filter((e) => !EXCLUDED_ESTABLISHMENTS.has(e.id))
    );

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

    if (dropped.length) {
        console.log(
            `\nExcluded (EXCLUDED_ESTABLISHMENTS): ` +
                dropped.map((e) => e.name).sort().join(", ")
        );
    }

    const workbookIds = new Set(fromWorkbooks.map((e) => e.id));
    const stillMissing = AWAITING_SHEETS.filter((name) => !workbookIds.has(slugify(name)));
    if (stillMissing.length) {
        console.log(`\nAwaiting workbooks:`);
        for (const name of stillMissing) {
            const provisional = establishments.find((e) => e.id === slugify(name));
            console.log(
                `  · ${name} — ` +
                    (provisional
                        ? `provisional entry only (${provisional.products.length} product` +
                          `${provisional.products.length === 1 ? "" : "s"} from data/sources); ` +
                          `full sheet still outstanding`
                        : `add "${name}/Product List - ${name} - YYYY-MM-DD.xlsx"`)
            );
        }
    }

    summarizeChanges(establishments);

    if (dryRun) {
        console.log(`\nDry run — ${path.relative(ROOT, OUT_FILE)} left untouched.`);
        return;
    }

    fs.writeFileSync(OUT_FILE, JSON.stringify(establishments, null, 2) + "\n");
    console.log(`\nWrote ${path.relative(ROOT, OUT_FILE)}`);
}

main();
