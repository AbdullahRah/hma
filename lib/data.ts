import { Establishment, Product, RawProduct, RawIGYProduct } from "./types";
import rawDspotProducts from "@/data/products.json";
import rawIgyProducts from "@/data/igy_products.json";

// ─── Establishments ──────────────────────────────────────
// Pre-seeded with DSpot and IGY Immune Technologies. Add more via the UI.

const STORAGE_KEY_ESTABLISHMENTS = "hma-establishments";
const STORAGE_KEY_CUSTOM_PRODUCTS = "hma-custom-products";

const DEFAULT_ESTABLISHMENT_IDS = ["dspot", "igy-immune"];

const DEFAULT_ESTABLISHMENTS: Establishment[] = [
    { id: "dspot", name: "DSpot", productCount: 0 },
    { id: "igy-immune", name: "IGY Immune Technologies", productCount: 0 },
];

// ─── Helpers ─────────────────────────────────────────────

function generateId(): string {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// ─── Establishments CRUD ─────────────────────────────────

export function getEstablishments(): Establishment[] {
    if (typeof window === "undefined") return DEFAULT_ESTABLISHMENTS;

    const stored = localStorage.getItem(STORAGE_KEY_ESTABLISHMENTS);
    let establishments: Establishment[] = stored
        ? JSON.parse(stored)
        : [...DEFAULT_ESTABLISHMENTS];

    // Ensure default establishments always exist
    for (const def of DEFAULT_ESTABLISHMENTS) {
        if (!establishments.find((e) => e.id === def.id)) {
            establishments = [def, ...establishments];
        }
    }

    // Recompute product counts
    establishments = establishments.map((e) => ({
        ...e,
        productCount: getProductsForEstablishment(e.id).length,
    }));

    return establishments;
}

export function addEstablishment(name: string): Establishment {
    const establishments = getEstablishments();
    const newEstablishment: Establishment = {
        id: generateId(),
        name: name.trim(),
        productCount: 0,
    };
    establishments.push(newEstablishment);
    localStorage.setItem(
        STORAGE_KEY_ESTABLISHMENTS,
        JSON.stringify(establishments)
    );
    return newEstablishment;
}

export function deleteEstablishment(id: string): void {
    if (DEFAULT_ESTABLISHMENT_IDS.includes(id)) return; // Protect defaults
    const establishments = getEstablishments().filter((e) => e.id !== id);
    localStorage.setItem(
        STORAGE_KEY_ESTABLISHMENTS,
        JSON.stringify(establishments)
    );
    // Also remove custom products for this establishment
    const customProducts = getCustomProducts().filter(
        (p) => p.establishmentId !== id
    );
    localStorage.setItem(
        STORAGE_KEY_CUSTOM_PRODUCTS,
        JSON.stringify(customProducts)
    );
}

export function getEstablishmentById(id: string): Establishment | undefined {
    return getEstablishments().find((e) => e.id === id);
}

export function isDefaultEstablishment(id: string): boolean {
    return DEFAULT_ESTABLISHMENT_IDS.includes(id);
}

// ─── Products ────────────────────────────────────────────

function getDspotProducts(): Product[] {
    return (rawDspotProducts as RawProduct[]).map((item, index) => ({
        id: `dspot-${index}`,
        establishmentId: "dspot",
        productName: item["Product Name"],
        brandName: item["Brand"] || "—",
    }));
}

function getIgyProducts(): Product[] {
    return (rawIgyProducts as RawIGYProduct[]).map((item, index) => ({
        id: `igy-${index}`,
        establishmentId: "igy-immune",
        productName: item.productName,
        brandName: item.brand || "—",
    }));
}

function getCustomProducts(): Product[] {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(STORAGE_KEY_CUSTOM_PRODUCTS);
    return stored ? JSON.parse(stored) : [];
}

export function getProductsForEstablishment(establishmentId: string): Product[] {
    if (establishmentId === "dspot") {
        return getDspotProducts();
    }
    if (establishmentId === "igy-immune") {
        return getIgyProducts();
    }
    return getCustomProducts().filter(
        (p) => p.establishmentId === establishmentId
    );
}

export function addProduct(
    establishmentId: string,
    productName: string,
    brandName: string
): Product {
    const customProducts = getCustomProducts();
    const newProduct: Product = {
        id: generateId(),
        establishmentId,
        productName: productName.trim(),
        brandName: brandName.trim() || "—",
    };
    customProducts.push(newProduct);
    localStorage.setItem(
        STORAGE_KEY_CUSTOM_PRODUCTS,
        JSON.stringify(customProducts)
    );
    return newProduct;
}

export function searchProducts(
    products: Product[],
    query: string
): Product[] {
    if (!query.trim()) return products;
    const q = query.toLowerCase().trim();
    return products.filter(
        (p) =>
            p.productName.toLowerCase().includes(q) ||
            p.brandName.toLowerCase().includes(q)
    );
}
