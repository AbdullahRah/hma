import { getEstablishments, addEstablishment, addProduct, isDefaultEstablishment } from "./data";
import { ImportSummary } from "./types";

// ─── CSV Import ──────────────────────────────────────────
// Expected columns (header row required, any order):
//   establishment_name   (required — also accepts "establishment")
//   product_name          (required — also accepts "product")
//   brand                 (optional — also accepts "brand_name")
//
// One row per product; establishment_name repeats across all of an
// establishment's rows. New establishment names are created automatically;
// names matching an existing custom establishment are matched by exact
// name (case-insensitive) and have products appended to them.

const ESTABLISHMENT_HEADERS = ["establishment_name", "establishment"];
const PRODUCT_HEADERS = ["product_name", "product"];
const BRAND_HEADERS = ["brand", "brand_name"];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Minimal RFC 4180-ish CSV parser: handles quoted fields, escaped quotes, CRLF/LF. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') inQuotes = true;
      else if (char === ",") pushField();
      else if (char === "\n") pushRow();
      else if (char === "\r") {
        /* skip — \n follows */
      } else field += char;
    }
  }
  // flush trailing field/row if file doesn't end with a newline
  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function importFromCSV(csvText: string): ImportSummary {
  const summary: ImportSummary = {
    establishmentsCreated: 0,
    establishmentsMatched: 0,
    productsAdded: 0,
    skipped: [],
  };

  const rows = parseCSV(csvText);

  if (rows.length < 2) {
    summary.skipped.push({ row: 0, reason: "File is empty or missing a header row." });
    return summary;
  }

  const headers = rows[0].map(normalizeHeader);
  const nameIdx = headers.findIndex((h) => ESTABLISHMENT_HEADERS.includes(h));
  const productIdx = headers.findIndex((h) => PRODUCT_HEADERS.includes(h));
  const brandIdx = headers.findIndex((h) => BRAND_HEADERS.includes(h));

  if (nameIdx === -1 || productIdx === -1) {
    summary.skipped.push({
      row: 0,
      reason: 'Header row must include "establishment_name" and "product_name" columns.',
    });
    return summary;
  }

  // Seed the name→id map with everything that already exists so repeat
  // establishment names in the CSV — or a second upload for the same
  // establishment later — match instead of creating duplicates.
  const nameToId = new Map<string, string>();
  for (const e of getEstablishments()) {
    nameToId.set(e.name.trim().toLowerCase(), e.id);
  }
  const matchedThisRun = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const establishmentName = (cols[nameIdx] || "").trim();
    const productName = (cols[productIdx] || "").trim();
    const brandName = brandIdx !== -1 ? (cols[brandIdx] || "").trim() : "";
    const rowNum = i + 1; // +1 for 1-indexed, header already consumed

    if (!establishmentName || !productName) {
      summary.skipped.push({ row: rowNum, reason: "Missing establishment name or product name." });
      continue;
    }

    const key = establishmentName.toLowerCase();
    let id = nameToId.get(key);

    if (id && isDefaultEstablishment(id)) {
      summary.skipped.push({
        row: rowNum,
        reason: `"${establishmentName}" is a locked default establishment — its product list can't be extended via import.`,
      });
      continue;
    }

    if (!id) {
      const created = addEstablishment(establishmentName);
      id = created.id;
      nameToId.set(key, id);
      summary.establishmentsCreated++;
    } else if (!matchedThisRun.has(id)) {
      matchedThisRun.add(id);
      summary.establishmentsMatched++;
    }

    addProduct(id, productName, brandName);
    summary.productsAdded++;
  }

  return summary;
}
