# Design notes — typography, contrast, and touch

The tool is used standing up, one-handed, in a restaurant kitchen or stockroom —
often in bad light, sometimes with gloves on, on a phone. Every decision below
follows from that, not from how the screens look on a desktop monitor.

---

## Typography

### Two families, with a clear division of labour

| Family | Loaded as | Used for |
|---|---|---|
| **Inter** | `next/font/google`, self-hosted | Everything read as language — product names, brand names, labels, buttons |
| **IBM Plex Mono** | `next/font/google`, self-hosted | Figures only — the progress percentage, counts |

**Inter** is the right face here: a large x-height, open apertures, and letterforms
that hold up at small sizes on a low-brightness screen.

**The mono font was demoted deliberately.** It was previously used for brand
names, counts, section labels, and the search placeholder. Two problems:

1. Monospace costs roughly 15% more width per character, so real brand names hit
   truncation early — "Weston Food Ser…" instead of "Weston Food Service".
2. Mono reads as *code*, not as data. The search placeholder looked like a
   terminal prompt rather than a text field.

It now appears only where digits are compared rather than read, and alignment
genuinely helps.

### Both fonts are self-hosted

They were previously pulled from `fonts.gstatic.com` at runtime via a hand-written
`@font-face` with a hard-coded version in the URL. Both fonts now go through
`next/font/google`, which downloads them at build time and serves them from the
app's own origin.

This matters in the field: **the tool keeps its typography on a bad connection**,
there is no third-party request on the critical path, and no hard-coded font URL
to rot.

### OpenType features

Set on `body`:

- `cv05`, `ss02` — disambiguated letterforms, so `1` / `l` / `I` stay distinct.
  Brand names contain product codes where that distinction is the whole point.

Set on figures (`.count-chip`, `.progress-label`, `.progress-pct`, `.sheet-meta`):

- `tnum` — tabular figures, so the percentage does not jitter as it counts up.
- `zero` — slashed zero, so `0` never reads as `O` in a code.

### Scale

Sizes went up across the board. The old scale was tuned for a desktop mockup.

| Element | Before | After | Why |
|---|---|---|---|
| Product name | 16px | **17px** | The primary read of the whole app |
| Brand name | 14px mono | **15px sans** | Audit data, not a caption |
| Search input | 15px | **16px** | Below 16px, iOS Safari zooms the viewport on focus |
| Progress readout | 14px | **15px** | Read at arm's length |

---

## Contrast

Measured with the WCAG 2.1 relative-luminance formula. The prototype's secondary
text failed AA in **both** themes — and secondary text is where brand names live.

| Pair | Before | After |
|---|---|---|
| Dark · brand name | 3.54 ✗ | **7.94** AAA |
| Dark · meta text | 3.72 ✗ | **5.73** AA |
| Light · brand name | 3.26 ✗ | **7.41** AAA |
| Light · meta text | 2.92 ✗ | **4.82** AA |
| Light · links | 3.60 ✗ | **4.93** AA |

Token changes: `--text-secondary` and `--text-tertiary` lifted in both themes, and
the light-mode `--accent` darkened from `#007AFF` to `#0064D8` so links clear AA
on the tinted `#F2F2F7` background.

A new `--border-strong` gives the *unchecked* checkbox a visible 2px outline —
at the old 1.5px `--border-default` it effectively disappeared in daylight.

---

## Touch

**The whole row is the tap target.** Previously only a 22×22px checkbox was
tappable. Nobody hits a 22px target one-handed with a phone in a kitchen. The row
is now a single `<button>` with `aria-pressed`, minimum height **56px** —
comfortably above the 44px floor in both Apple's HIG and WCAG 2.5.5.

The checkbox is still there, but it is now an *affordance* showing state, not the
hit area.

**Verified reads green, not blue.** The checked state used `--accent`, the same
colour as links and the back arrow. Verification now uses `--clr-success`, so
"done" is never confused with "tappable" at a glance.

---

## Field affordances

**Sheet provenance is visible.** The establishment page shows `Sheet dated
2021-09-26`, and anything two years or older gets an amber `4+ years old` warning.
The date was already in the data and previously went unused — an inspector working
from a four-year-old list should know that before they start.

**Progress is recoverable.** A `Reset` control appears once anything is ticked, so
a mis-started audit does not require clearing site data.

**Search counts are honest.** The header reads `Matching Products · 3 of 23` while
searching, rather than showing a filtered count under a fixed label.

---

## Known gaps

Not yet addressed — see the summary in conversation for the reasoning.

- **No offline support.** No service worker, so a dead spot in a walk-in freezer
  means a blank page on reload. The strongest remaining field improvement.
- **Long lists have no jump-to-letter index.** Paramount Fine Foods is 663 rows.
- **Rulings are not shown.** Pending client input — see `data/README.md`.
- **Ticks are per-device.** See the trade-off note in `ARCHITECTURE.md`.
