# Product sheet data

`establishments.json` is the single source of truth for every audited product
list in the tool. It is **generated** — edit the sources, not this file.

> For how the data is stored, parsed, and bundled — and the trade-offs behind
> those choices — see [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

```
Restaurants Product List/<Client>/Product List - <Client> - <date>.xlsx   ← client workbooks (outside the repo)
data/sources/*.json                                                       ← clients with no workbook (IGY)
        │
        │  npm run build:data
        ▼
data/establishments.json     ← committed, read by lib/data.ts
        │
        │  npm run check:data
        ▼
   guardrails verified (runs without the workbooks)
```

## Record shape

```jsonc
{
  "id": "adana-kebab",                                        // slug of name
  "name": "Adana Kebab",
  "source": "Product List - Adana Kebab - 2025-07-15.xlsx",   // audit trail
  "sheetDate": "2025-07-15",                                  // "" if the source carries none
  "products": [
    { "productName": "Nador Cayenne Pepper", "brand": "Nador Moulin Rouge", "ruling": "Approved" }
  ]
}
```

## Guardrails

Enforced by `scripts/normalize.mjs` on build and re-checked by
`scripts/check-data.mjs`:

1. **One shape.** Every product is exactly `productName`, `brand`, `ruling` —
   no per-client field names.
2. **Alphabetical.** Establishments sort by name; products sort by product name,
   then brand. Case- and accent-insensitive, digit-aware (`Item 2` < `Item 10`).
3. **Consistent casing.** Sheets typed in ALL CAPS are title-cased
   (`BARBECUE SAUCE` → `Barbecue Sauce`); sheets already in mixed case are left
   alone. Acronyms in `KEEP_UPPER` stay upper (`GFS`, `MDH`, `PC`, …), and the
   Excel `HELLMANN'S` → `Hellmann'S` artifact is repaired to `Hellmann's`.
4. **Real brands only.** `N/A`, `-`, `TBD`, `unknown` and friends become `""`
   (the UI renders `—`). `Select` is a real brand and is kept.
5. **No duplicates.** Same product name + brand within one establishment is
   collapsed to one row.
6. **One ruling vocabulary.** The 14 workbook generations spell the verdict four
   different ways (`Ruling`, `Second Level Check (Yes/No)`,
   `Second Level Check (Approved/Not Approved)`, `Permissible (Yes / No)`). They
   all map onto: `HMA Certified`, `Approved`, `Not Approved`, `Cancelled`,
   `Under Review` (blank or `TBD`). See **Where a ruling hides** below for the
   second place a verdict can be recorded.
7. **Brand falls back to the manufacturer.** A blank `Brand Name` takes the
   sheet's own `Manufacturer / Brand Owner / Client` value. Bulk raw materials
   ("Leek", "Onion Yellow Foodservice") genuinely have no brand and stay blank.
8. **Ids are slugs of names** — apostrophes drop rather than becoming dashes
   (`Galito's Flame` → `galitos-flame`).

## Rebuilding

```bash
npm run build:data     # needs the workbook folder
npm run check:data     # no workbooks needed
```

The build looks for the workbooks at `../Restaurants Product List` by default.
Override with `HMA_SHEETS_DIR=/path/to/folder npm run build:data`. It reads the
**newest-dated** `.xlsx` in each client folder, so adding a new batch is: drop
the file in, rebuild, commit.

## When a new sheet arrives

**1. Put the file where it belongs.**

```
~/Desktop/HMA/Restaurants Product List/<Client Name>/Product List - <Client Name> - YYYY-MM-DD.xlsx
```

- *Updated sheet for an existing client* — drop it into that client's existing
  folder alongside the old one. Keep the old file; the build takes the
  **newest date in the filename**, so history stays intact.
- *New client* — make a folder named exactly how the client should appear in the
  tool. The folder name becomes the display name and the id is its slug.

The date in the filename is what the build reads. If a sheet arrives without
one, add it before dropping it in, or it will sort as older than everything else.

**2. Preview what it will do.**

```bash
npm run build:data -- --dry-run
```

Writes nothing. Prints a per-client product count and a change summary:

```
  + NEW      Test Bistro — 11 products from Product List - Test Bistro - 2026-08-20.xlsx
  ~ UPDATED  Adana Kebab — +14 products · now from Product List - Adana Kebab - 2026-08-26.xlsx
```

Read that summary before going further. `- DROPPED` means a client folder went
missing — usually a rename or a half-finished move, not something you want to
commit.

**3. Build and verify.**

```bash
npm run build:data
npm run check:data
```

**4. Review the diff and commit.**

```bash
git diff --stat data/establishments.json
git add data/establishments.json && git commit
```

The JSON is sorted and stable, so the diff shows exactly the products that moved.

**5. Check it in the app.**

```bash
npm run dev
```

Open the client's page and spot-check a product you know is new on the sheet.

### If the build complains

- **`No product table found in <Client>/<file>`** — the header row uses a column
  name the aliases don't cover yet. Add it to `NAME_HEADERS` / `BRAND_HEADERS` /
  `RULING_HEADERS` in `scripts/build-data.mjs`.
- **`Duplicate establishment id`** — two folders slugify to the same id (e.g.
  `Kara Mia` and `Kara-Mia`). Rename one folder.
- **`Workbook folder not found`** — the sheets live somewhere else. Run with
  `HMA_SHEETS_DIR=/path/to/folder npm run build:data`.
- **A product reads oddly after import** (a brand title-cased that shouldn't be)
  — add the token to `KEEP_UPPER` in `scripts/normalize.mjs` and rebuild.

## Where a ruling hides

A sheet can record the same verdict in two places, and for one client it only
ever used the second one.

Most workbooks carry a **"Definition" sheet** — a legend of
`Product Type | Selection | Definition`. The auditor picks a phrase from
**Selection** into the row's `Comments (Level I)` cell (some sheets use
`Remarks`), and the legend's **Product Type** is the verdict that phrase stands
for. `scripts/build-data.mjs` reads that legend and resolves each row with
`resolveRuling()`:

| Ruling column | Level I note | Result |
| --- | --- | --- |
| filled | none, or not in the legend | the column |
| **blank** | **a legend phrase** | **the legend's verdict** |
| filled | legend agrees | the column |
| filled | legend is **stricter** | `Under Review` — the sheet contradicts itself |
| filled | legend is looser | the column — a note does not upgrade an entry |

The legend is read **per workbook and never pooled**: the phrase "Did not receive
adequate information from Manufacturer" is `Not Approved` on 25 sheets and
`Undetermined` on 2, so only a workbook's own Definition sheet may decode it.

This is what recovers **Passage to India**, whose `Second Level Check` column was
left empty on all 139 rows while Level I was filled on all 139 — it read as 139
"Under Review" products and now reads as 131 Approved and 7 HMA Certified.

Across every workbook this leaves **11 products genuinely `Under Review`**: 7 the
sheets contradict themselves on, and 4 with no verdict recorded anywhere. There
are no cell comments or notes anywhere in the workbooks — checked at the ZIP
level for `xl/comments*.xml`, `xl/threadedComments/`, and `vmlDrawing*.vml`.

## How rulings are shown

Every product is listed whatever its ruling — nothing is filtered out.

- **Not Approved / Cancelled** render in red with a tag, and sort to the bottom
  of the establishment's list.
- **Under Review** renders with an amber tag and sorts between the two.
- Alphabetical order applies *within* each band, never across them.
- "N approved" counters count `Approved` + `HMA Certified` only.

## Roster

Dropped from the tool (`EXCLUDED_ESTABLISHMENTS` in `scripts/build-data.mjs`) —
their source files stay on disk, delete a line to bring one back:

| Establishment | Why |
| --- | --- |
| The Dum Biryani | no longer an HMA client |
| Texas Wild BBQ | no longer an HMA client |
| Hyperama Lekker Restuarant | no longer an HMA client |
| IGY Immune Technologies | non-meat client, not a restaurant |

Awaiting sheets (`AWAITING_SHEETS`) — every build prints these until the
workbook folder appears: **Fortinos**, **Loblaws**, **North Kabob**.
