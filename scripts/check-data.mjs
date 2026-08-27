#!/usr/bin/env node
// Verifies data/establishments.json still obeys the sheet guardrails.
//
//   npm run check:data
//
// Runs without the source workbooks, so it works in CI and on a fresh clone.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    RULINGS,
    compareByName,
    normalizeBrand,
    normalizeProductName,
    slugify,
} from "./normalize.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data", "establishments.json");

const errors = [];
const fail = (msg) => errors.push(msg);

const establishments = JSON.parse(fs.readFileSync(FILE, "utf8"));

if (!Array.isArray(establishments) || establishments.length === 0) {
    fail("establishments.json must be a non-empty array");
}

// 1. Establishments are alphabetical by name, with unique ids derived from them.
const names = establishments.map((e) => e.name);
const sorted = [...names].sort(compareByName);
names.forEach((name, i) => {
    if (name !== sorted[i]) {
        fail(`Establishments are not alphabetical: "${name}" sits where "${sorted[i]}" belongs`);
    }
});

const ids = new Set();
for (const est of establishments) {
    for (const field of ["id", "name", "source", "sheetDate"]) {
        if (typeof est[field] !== "string") {
            fail(`${est.name || est.id}: missing string field "${field}"`);
        }
    }
    if (est.id !== slugify(est.name)) {
        fail(`${est.name}: id should be "${slugify(est.name)}", found "${est.id}"`);
    }
    if (ids.has(est.id)) fail(`Duplicate establishment id: ${est.id}`);
    ids.add(est.id);
    if (est.sheetDate && !/^\d{4}-\d{2}-\d{2}$/.test(est.sheetDate)) {
        fail(`${est.name}: sheetDate "${est.sheetDate}" is not YYYY-MM-DD`);
    }
    if (!Array.isArray(est.products)) {
        fail(`${est.name}: products must be an array`);
        continue;
    }

    // 2. Every product record has the same three fields, normalized.
    const seen = new Set();
    let previous = null;
    for (const product of est.products) {
        const keys = Object.keys(product).sort().join(",");
        if (keys !== "brand,productName,ruling") {
            fail(`${est.name}: product fields should be productName/brand/ruling, found ${keys}`);
        }
        if (!product.productName) {
            fail(`${est.name}: a product has a blank name`);
        }
        if (product.productName !== normalizeProductName(product.productName)) {
            fail(`${est.name}: "${product.productName}" is not normalized`);
        }
        if (product.brand !== normalizeBrand(product.brand)) {
            fail(`${est.name}: brand "${product.brand}" is not normalized`);
        }
        if (!RULINGS.includes(product.ruling)) {
            fail(`${est.name}: "${product.productName}" has unknown ruling "${product.ruling}"`);
        }

        // 3. No duplicates, and products are alphabetical.
        const key = `${product.productName.toLowerCase()}|${product.brand.toLowerCase()}`;
        if (seen.has(key)) fail(`${est.name}: duplicate product "${product.productName}"`);
        seen.add(key);

        if (previous) {
            const order =
                compareByName(previous.productName, product.productName) ||
                compareByName(previous.brand, product.brand);
            if (order > 0) {
                fail(`${est.name}: "${product.productName}" sorts before "${previous.productName}"`);
            }
        }
        previous = product;
    }
}

const totalProducts = establishments.reduce((n, e) => n + e.products.length, 0);

if (errors.length) {
    console.error(`✗ ${errors.length} guardrail violation(s):\n`);
    for (const error of errors.slice(0, 40)) console.error(`  · ${error}`);
    if (errors.length > 40) console.error(`  … and ${errors.length - 40} more`);
    process.exit(1);
}

console.log(
    `✓ ${establishments.length} establishments · ${totalProducts} products · all guardrails pass`
);
