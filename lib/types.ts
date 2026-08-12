export interface Establishment {
  id: string;
  name: string;
  productCount: number;
}

export interface Product {
  id: string;
  establishmentId: string;
  productName: string;
  brandName: string;
}

// DSpot JSON shape
export interface RawProduct {
  "Product Name": string;
  "Brand": string;
}

// IGY JSON shape
export interface RawIGYProduct {
  productName: string;
  brand: string;
}

// ─── Bulk Import ───────────────────────────────
export interface ImportSkip {
  row: number;
  reason: string;
}

export interface ImportSummary {
  establishmentsCreated: number;
  establishmentsMatched: number;
  productsAdded: number;
  skipped: ImportSkip[];
}
