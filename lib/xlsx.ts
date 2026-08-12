import { unzipSync, strFromU8 } from "fflate";

// ─── XLSX Reader ─────────────────────────────────────────
// An .xlsx file is a ZIP archive of XML parts. We only need enough of it to
// pull the used cells out of the first worksheet as text:
//
//   xl/workbook.xml            — sheet list (first <sheet> wins)
//   xl/_rels/workbook.xml.rels — maps that sheet's r:id to its part path
//   xl/sharedStrings.xml       — string table; most text cells are an index into it
//   xl/worksheets/sheetN.xml   — the cells themselves
//
// Values come back as strings, matching what parseCSV produces, so both
// formats feed the same import logic. Browser-only: uses DOMParser.

const RELS_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function parseXML(xml: string): Document {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) {
        throw new Error("That .xlsx file contains malformed XML.");
    }
    return doc;
}

/** "C" → 2, "AA" → 26. Reads the letters off an A1-style ref and ignores the row digits. */
function columnIndex(ref: string): number {
    let idx = 0;
    for (let i = 0; i < ref.length; i++) {
        const code = ref.toUpperCase().charCodeAt(i);
        if (code < 65 || code > 90) break;
        idx = idx * 26 + (code - 64);
    }
    return idx - 1;
}

/** Concatenates the <t> runs in an element, skipping <rPh> phonetic guides. */
function textOf(el: Element): string {
    return Array.from(el.getElementsByTagName("t"))
        .filter((t) => t.parentElement?.tagName !== "rPh")
        .map((t) => t.textContent ?? "")
        .join("");
}

function parseSharedStrings(xml: string): string[] {
    return Array.from(parseXML(xml).getElementsByTagName("si")).map(textOf);
}

function cellText(cell: Element, shared: string[]): string {
    const type = cell.getAttribute("t");

    if (type === "s") {
        const raw = cell.getElementsByTagName("v")[0]?.textContent;
        const idx = raw ? Number.parseInt(raw, 10) : Number.NaN;
        return Number.isNaN(idx) ? "" : shared[idx] ?? "";
    }
    if (type === "inlineStr") return textOf(cell);

    // "str" (formula result), "b" (boolean) and plain numbers all sit in <v>
    const value = cell.getElementsByTagName("v")[0]?.textContent ?? "";
    if (type === "b") return value === "1" ? "TRUE" : "FALSE";
    return value;
}

function parseSheet(xml: string, shared: string[]): string[][] {
    const rows: string[][] = [];

    for (const rowEl of Array.from(parseXML(xml).getElementsByTagName("row"))) {
        const cells: string[] = [];

        for (const cell of Array.from(rowEl.getElementsByTagName("c"))) {
            const ref = cell.getAttribute("r");
            const col = ref ? columnIndex(ref) : cells.length;
            // Empty cells are omitted from the XML entirely, so pad the gaps —
            // otherwise a blank brand column would shift later values left.
            while (cells.length < col) cells.push("");
            cells.push(cellText(cell, shared));
        }

        // Rows are likewise sparse. Pad so a row's index matches its real
        // spreadsheet row number and skip messages line up with what's on screen.
        const rowNum = Number.parseInt(rowEl.getAttribute("r") ?? "", 10);
        if (!Number.isNaN(rowNum)) {
            while (rows.length < rowNum - 1) rows.push([]);
        }
        rows.push(cells);
    }

    return rows;
}

function firstSheetPath(files: Record<string, Uint8Array>): string {
    const workbook = files["xl/workbook.xml"];
    const rels = files["xl/_rels/workbook.xml.rels"];

    if (workbook && rels) {
        const sheet = parseXML(strFromU8(workbook)).getElementsByTagName("sheet")[0];
        const rid =
            sheet?.getAttributeNS(RELS_NS, "id") ?? sheet?.getAttribute("r:id") ?? null;

        if (rid) {
            for (const rel of Array.from(
                parseXML(strFromU8(rels)).getElementsByTagName("Relationship")
            )) {
                if (rel.getAttribute("Id") !== rid) continue;
                const target = rel.getAttribute("Target") ?? "";
                return target.startsWith("/")
                    ? target.slice(1)
                    : `xl/${target.replace(/^\.\//, "")}`;
            }
        }
    }

    // Fall back to the conventional location if the workbook part is unusual.
    const guess = Object.keys(files).find((name) =>
        /^xl\/worksheets\/sheet\d+\.xml$/.test(name)
    );
    if (!guess) throw new Error("Couldn't find a worksheet inside that .xlsx file.");
    return guess;
}

/** Reads the first worksheet of an .xlsx file into rows of cell text. */
export function parseXLSX(data: ArrayBuffer): string[][] {
    let files: Record<string, Uint8Array>;
    try {
        files = unzipSync(new Uint8Array(data));
    } catch {
        // .xls (the pre-2007 binary format) lands here, as does any corrupt upload.
        throw new Error(
            "That file isn't a readable .xlsx workbook. If it's an older .xls file, re-save it as .xlsx."
        );
    }

    const stringsPart = files["xl/sharedStrings.xml"];
    const shared = stringsPart ? parseSharedStrings(strFromU8(stringsPart)) : [];

    const sheetPart = files[firstSheetPath(files)];
    if (!sheetPart) throw new Error("Couldn't find a worksheet inside that .xlsx file.");

    return parseSheet(strFromU8(sheetPart), shared);
}
