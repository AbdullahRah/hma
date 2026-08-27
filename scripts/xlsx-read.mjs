// Minimal, dependency-free .xlsx reader.
// Returns each sheet as an array of row arrays of trimmed cell strings.
import { execFileSync } from "node:child_process";

function decodeEntities(s) {
    return s
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
}

function unzipEntry(file, entry) {
    try {
        return execFileSync("unzip", ["-p", file, entry], {
            encoding: "utf8",
            maxBuffer: 256 * 1024 * 1024,
        });
    } catch {
        return "";
    }
}

function listEntries(file) {
    const out = execFileSync("unzip", ["-Z1", file], { encoding: "utf8" });
    return out.split("\n").filter(Boolean);
}

function parseSharedStrings(xml) {
    if (!xml) return [];
    return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, si]) =>
        decodeEntities([...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""))
    );
}

function colToIndex(ref) {
    const letters = ref.match(/^[A-Z]+/)[0];
    let n = 0;
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
}

function parseSheet(xml, shared) {
    const rows = [];
    for (const [, rowXml] of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
        const cells = [];
        for (const m of rowXml.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const attrs = m[1];
            const body = m[2] || "";
            const refMatch = attrs.match(/r="([A-Z]+\d+)"/);
            const idx = refMatch ? colToIndex(refMatch[1]) : cells.length;
            const type = (attrs.match(/t="([^"]+)"/) || [])[1];
            let value = "";
            if (type === "inlineStr") {
                value = decodeEntities([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
            } else {
                const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
                if (v !== undefined) {
                    if (type === "s") {
                        value = shared[Number(v)] ?? "";
                    } else if (/^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(v)) {
                        // Excel stores 74.4 as 74.400000000000006 — round back.
                        value = String(Number(parseFloat(v).toPrecision(15)));
                    } else {
                        value = decodeEntities(v);
                    }
                }
            }
            cells[idx] = String(value ?? "").replace(/\s+/g, " ").trim();
        }
        rows.push(Array.from(cells, (c) => c ?? ""));
    }
    return rows;
}

export function readWorkbook(file) {
    const shared = parseSharedStrings(unzipEntry(file, "xl/sharedStrings.xml"));
    const sheetEntries = listEntries(file)
        .filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e))
        .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    return sheetEntries.map((entry) => ({
        entry,
        rows: parseSheet(unzipEntry(file, entry), shared),
    }));
}
