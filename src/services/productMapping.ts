/**
 * Product Mapping Service
 * Handles fetching and caching product information from Google Sheets
 */

export interface ProductInfo {
  sku: string;
  asin: string;
  name: string;
  parent: string;
  category: string;
  cost: number | null;    // Ürün maliyeti (null = eksik)
  size: number | null;    // Desi (null = eksik)
}

const SHEET_ID = '1RRffiKOvBf6u-j9n4Clpvm6eqbJNujBNj7J6JRKqy0c';
const CACHE_KEY = 'productMapping_cache';
const CACHE_TIMESTAMP_KEY = 'productMapping_timestamp';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch product mapping from Google Sheets with caching
 */
export const fetchProductMapping = async (forceRefresh = false): Promise<ProductInfo[]> => {
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

    if (cachedData && cachedTimestamp) {
      const age = Date.now() - parseInt(cachedTimestamp);
      if (age < CACHE_DURATION) {
        const products: ProductInfo[] = JSON.parse(cachedData);
        return products;
      }
    }
  }

  // Fetch from Google Sheets as TSV (tab-separated) to avoid comma issues
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=tsv`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Cannot access Google Sheets. Is it public?');
  }

  const tsvText = await response.text();

  // Parse TSV (tab-separated values) - much simpler and avoids comma issues
  const products: ProductInfo[] = [];

  const lines = tsvText.split('\n');
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());

  const skuIndex = headers.findIndex(h => h === 'sku');
  const asinIndex = headers.findIndex(h => h === 'asin');
  const nameIndex = headers.findIndex(h => h === 'name');
  const parentIndex = headers.findIndex(h => h === 'parent');
  const categoryIndex = headers.findIndex(h => h === 'category');
  const costIndex = headers.findIndex(h => h === 'cost' || h === 'maliyet');
  const sizeIndex = headers.findIndex(h => h === 'size' || h === 'desi');

  if (skuIndex === -1 || nameIndex === -1 || categoryIndex === -1) {
    throw new Error('Google Sheets must have columns: sku, name, category (asin and parent are optional)');
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = line.split('\t');

    const sku = cells[skuIndex]?.trim();
    if (!sku) continue;

    // Parse cost - null if empty or invalid
    const costRaw = costIndex !== -1 ? cells[costIndex]?.trim() : '';
    const cost = costRaw && !isNaN(parseFloat(costRaw)) ? parseFloat(costRaw) : null;

    // Parse size (desi) - null if empty or invalid
    const sizeRaw = sizeIndex !== -1 ? cells[sizeIndex]?.trim() : '';
    const size = sizeRaw && !isNaN(parseFloat(sizeRaw)) ? parseFloat(sizeRaw) : null;

    const product: ProductInfo = {
      sku,
      asin: cells[asinIndex]?.trim() || '',
      name: cells[nameIndex]?.trim() || '',
      parent: cells[parentIndex]?.trim() || '',
      category: cells[categoryIndex]?.trim() || '',
      cost,
      size
    };

    products.push(product);
  }

  // Save to cache
  const timestamp = Date.now();
  localStorage.setItem(CACHE_KEY, JSON.stringify(products));
  localStorage.setItem(CACHE_TIMESTAMP_KEY, timestamp.toString());

  return products;
};

/**
 * Get cached product mapping (synchronous)
 */
export const getCachedProductMapping = (): ProductInfo[] | null => {
  const cachedData = localStorage.getItem(CACHE_KEY);
  const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

  if (cachedData && cachedTimestamp) {
    const age = Date.now() - parseInt(cachedTimestamp);
    if (age < CACHE_DURATION) {
      return JSON.parse(cachedData);
    }
  }

  return null;
};

/**
 * Create a SKU -> ProductInfo map for O(1) lookups
 */
export const createProductMap = (products: ProductInfo[]): Map<string, ProductInfo> => {
  const map = new Map<string, ProductInfo>();
  products.forEach(p => map.set(p.sku, p));
  return map;
};

/**
 * Enrich a single transaction with product info
 * IMPORTANT: We use 'productCategory' to avoid conflict with transaction's 'categoryType'
 */
export const enrichTransaction = <T extends { sku: string }>(
  transaction: T,
  productMap: Map<string, ProductInfo>
): T & {
  asin?: string;
  name?: string;
  parent?: string;
  productCategory?: string;
  productCost?: number | null;
  productSize?: number | null;
} => {
  const product = productMap.get(transaction.sku);

  return {
    ...transaction,
    asin: product?.asin || undefined,
    name: product?.name || undefined,
    parent: product?.parent || undefined,
    productCategory: product?.category || undefined,  // Renamed to avoid conflict
    productCost: product?.cost ?? null,
    productSize: product?.size ?? null
  };
};
