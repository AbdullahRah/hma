export interface Establishment {
  id: string;
  name: string;
  productCount: number;
}

/** The ruling recorded on the audit sheet for a product. */
export type Ruling =
  | "HMA Certified"
  | "Approved"
  | "Not Approved"
  | "Cancelled"
  | "Under Review";

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
