export interface Establishment {
  id: string;
  name: string;
  /** Every product on the sheet, whatever its ruling. */
  productCount: number;
  /** Only those actually ruled approved — what the "N approved" label counts. */
  approvedCount: number;
}

/** The ruling recorded on the audit sheet for a product. */
export type Ruling =
  | "HMA Certified"
  | "Approved"
  | "Not Approved"
  | "Cancelled"
  | "Under Review";

/** Ruled fit to serve. "HMA Certified" is an approval, and a stronger one. */
export function isApproved(ruling: Ruling): boolean {
  return ruling === "Approved" || ruling === "HMA Certified";
}

/** Ruled against — shown in red and sorted below everything else. */
export function isFlagged(ruling: Ruling): boolean {
  return ruling === "Not Approved" || ruling === "Cancelled";
}

/**
 * Display order: approved first, awaiting a ruling next, ruled-against last.
 * Products stay alphabetical inside each band — the grouping decides which
 * band a product lands in, never the order within one.
 */
export function rulingRank(ruling: Ruling): number {
  if (isApproved(ruling)) return 0;
  if (isFlagged(ruling)) return 2;
  return 1; // Under Review
}

export interface Product {
  id: string;
  establishmentId: string;
  productName: string;
  brandName: string;
  ruling: Ruling;
}

// ─── Shape of data/establishments.json ───────────────────
// Built by `npm run build:data` from the audit workbooks. Every product sheet
// normalizes to this one shape — see data/README.md for the guardrails.

export interface RawProduct {
  productName: string;
  brand: string;
  ruling: Ruling;
}

export interface RawEstablishment {
  id: string;
  name: string;
  /** Workbook the list was built from, e.g. "Product List - Adana Kebab - 2025-07-15.xlsx". */
  source: string;
  /** Date on that workbook, "YYYY-MM-DD", or "" when the source carries none. */
  sheetDate: string;
  products: RawProduct[];
}
