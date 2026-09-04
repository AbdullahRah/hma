# Architecture — how the product data is stored, parsed, and served

Reference for how the HMA Audit Tool moves data from a client's Excel sheet to a
row on screen. Figures verified against a real build on 2026-08-26.

Typography and contrast decisions are recorded in [`DESIGN.md`](DESIGN.md).

For the day-to-day "a new sheet arrived, what do I do" steps, see
[`data/README.md`](data/README.md). This document is the *why* behind it.

---

## Storage: one file, plain JSON on disk

```
data/establishments.json     460 KB · 34 establishments · 3,690 products
```

Pretty-printed with 2-space indent — **470,696 bytes raw** versus **306,940
minified**. The extra ~160 KB is deliberate: one field per line is what makes
`git diff` readable when a sheet changes. It costs nothing at runtime, because
the bundler minifies it anyway.

It is a flat array. No index, no ids beyond the slug, no cross-references:

```jsonc
[
  {
    "id": "adana-kebab",
    "name": "Adana Kebab",
    "source": "Product List - Adana Kebab - 2025-07-15.xlsx",
    "sheetDate": "2025-07-15",
    "products": [
      { "productName": "Allen's White Vinegar", "brand": "Allen's", "ruling": "Approved" }
    ]
  }
]
```

That is the entire storage layer. No database, no ORM, no migrations, no API.
**The file is the store, and git is the history.**

---

## Parsing: two completely separate passes

### Pass 1 — build time: `.xlsx` → JSON

Runs on a maintainer's machine, on demand. **Never in the app.**

An `.xlsx` is a zip of XML files. `scripts/xlsx-read.mjs` shells out to
`/usr/bin/unzip -p` to stream individual entries and reads them with regex — no
SheetJS, no dependency at all. Two entries matter:

- **`xl/sharedStrings.xml`** — Excel deduplicates every string in the workbook
  into one table. Cells then reference it by index, so a cell marked `t="s"`
  holding `<v>417</v>` means "string #417". The parser builds that table first,
  then resolves references against it.
- **`xl/worksheets/sheetN.xml`** — the grid. Each cell carries an `r="C14"`
  reference, so column letters are converted to an index; **missing cells are
  simply absent from the XML** and get filled in as empty. Numeric cells go
  through `Number(parseFloat(v).toPrecision(15))` — that is what turns Excel's
  `74.400000000000006` back into `74.4`.

Then `scripts/build-data.mjs`:

1. Picks the **newest-dated** `.xlsx` in each client folder.
2. Locates the product table by scanning the first 6 rows of **every** sheet —
   necessary because five workbooks (Chicken Kitchen, Mama's Meat Shop, Pizzally,
   Sobeys, The Kebob) hide the table on sheet 2 behind a cover page.
3. Maps the **14 different header layouts** onto one set of columns.
4. Hands the rows to `scripts/normalize.mjs` for casing, brand placeholders,
   de-duplication, sorting, and the ruling vocabulary.

Output: the JSON above. `scripts/check-data.mjs` then re-verifies the result
against the same rules, and works without the workbooks present.

### Pass 2 — bundle time: JSON → JavaScript

`lib/data.ts` does a static import:

```ts
import rawEstablishments from "@/data/establishments.json";
```

Turbopack resolves that at build time and emits the data **inlined into a JS
chunk** as a `JSON.parse` call on a string literal:

```js
(globalThis.TURBOPACK||...).push([..., r=>{r.v(JSON.parse('[{"id":"adana-kebab",...
```

`JSON.parse` on a string literal rather than an object literal is a deliberate
bundler optimization — V8 parses JSON several times faster than it parses
equivalent JS source.

The chunk lands in `.next/static/chunks/` under a **content-hashed filename**
(e.g. `2e2a96ee8b057688.js`) — the hash changes whenever the data changes, so
never hard-code it. Size: **304 KB raw, 49 KB gzipped over the wire.**

**The browser never fetches `establishments.json`.** There is no request for it,
no loading state, no failure mode. The data arrives as part of the JavaScript.

---

## At runtime: in-memory, read-only

Module-level, evaluated once when the chunk loads:

```ts
const SHEETS_BY_ID = new Map(SHEETS.map((s) => [s.id, s]));
```

A `Map` for O(1) establishment lookup. Product rows get their display shape built
on read (`brand || "—"`), then sorted through a shared `Intl.Collator` — one
collator instance reused for every comparison, since constructing those is the
expensive part.

**Sheet data is never persisted** — it is read-only and comes from the bundle.
Two things *are* written to `localStorage`, both created by the inspector rather
than by the sheets:

| Key | Written by | Contents |
|---|---|---|
| `hma-verified` | `lib/data.ts` | `{ [establishmentId]: productId[] }` — audit ticks |
| `hma-theme` | `lib/theme.tsx` | dark / light preference |

Verification ticks are scoped per establishment and saved on every toggle, so a
refresh, a backgrounded tab, or a phone that reloads the page mid-walkthrough
does not cost the inspector their progress. All reads and writes are wrapped in
`try/catch`: if storage is full or blocked, the audit continues in memory rather
than throwing.

---

## The shape of it

```
.xlsx (Desktop)  ──unzip + regex──>  establishments.json  ──static import──>  JS chunk  ──>  Map in memory
  33 workbooks       build:data           460 KB, git          Turbopack       49 KB gz      read-only
                          │
                     check:data ──> guardrails verified, no workbooks needed
```

Three runtime dependencies total — `next`, `react`, `react-dom`. The build
scripts add zero: Node builtins plus the `unzip` already present on macOS.
Nothing to keep patched, nothing to break on an upgrade.

---

## Known trade-offs

Recorded so they are decisions, not surprises.

**Changing a sheet requires a rebuild and redeploy.** That is the price of having
no database and no backend. At 30 clients with a sheet arriving now and then, it
is the right call. *Revisit if sheets start changing daily* — that is the signal
that the data belongs behind an API instead of in the bundle.

**Verification ticks are per-device, not per-account.** They live in that
browser's `localStorage`, so two inspectors auditing the same site do not see
each other's progress, and clearing site data wipes it. Fine for one inspector
per visit; needs a backend the day audits are shared or reviewed remotely.

**The ruling column is the only authority — with one narrow exception.** Most
workbooks also carry a `Comments (Level I)` (or `Remarks`) cell holding a phrase
from that workbook's own "Definition" legend sheet, which reads like a second
record of the verdict. It is not one: HMA confirmed (Nouman, 2026-09-04) those
notes must never influence a ruling, so a note that disagrees with a filled
column is ignored and the column stands. The build reads the legend only to
recover a verdict that was **never written in the ruling column at all** —
Passage to India left `Second Level Check` empty on all 139 rows and recorded the
ruling one column over. The legend is read per workbook, never pooled across
them, because one phrase ("Did not receive adequate information from
Manufacturer") means `Not Approved` on 25 sheets and `Undetermined` on 2. See
[`data/README.md`](data/README.md).

**The build depends on workbooks outside the repo.** `npm run build:data` needs
`../Restaurants Product List` (or `HMA_SHEETS_DIR`). A fresh clone can run the
app and `check:data`, but cannot rebuild the data without those files. This is
intentional — the workbooks are the client's working files, not repo content.
