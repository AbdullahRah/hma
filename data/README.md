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
   `Under Review` (blank or `TBD`).
7. **Ids are slugs of names** — apostrophes drop rather than becoming dashes
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

## Open question: rulings are captured but not shown

Every product carries a `ruling`, but the UI currently lists **all** products
regardless of it — 169 `Not Approved` and 54 `Cancelled` records are shown the
same as approved ones, and the counters read "N products approved".

This is deliberate for now, pending client input on how non-approved items should
be handled. When that comes back, the options are: badge non-approved rows,
filter them out, or leave as is — and either way the counter labels should be
corrected. Largest gaps: Passage to India (139 of 139 have no recorded ruling),
Paramount Fine Foods (63 of 663), Chick Fiesta (27 of 116), D Spot Dessert Café
(26 of 565).
