/**
 * Product Mapping Service
 * Handles fetching and caching product information from PriceLab API
 */

import { logger } from '../utils/logger';

export interface ProductInfo {
  sku: string;
  asin: string;
  name: string;
  parent: string;
  category: string;
  cost: number | null;    // Ürün maliyeti (null = eksik)
  size: number | null;    // Desi (null = eksik)
  marketplace?: string;   // US, UK, DE, etc.
  customShipping?: number | null;  // SKU bazlı özel kargo (USD) - US local warehouse için
  fbmSource?: string | null;       // TR, LOCAL, BOTH - FBM gönderim kaynağı
}

// SKU Master API endpoint (from sku_master table)
const SKU_MASTER_API_URL = 'https://amzsellmetrics.iwa.web.tr/api/amazon-analyzer/sku-master';

const CACHE_KEY = 'productMapping_cache';
const CACHE_TIMESTAMP_KEY = 'productMapping_timestamp';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// In-memory cache (survives even if localStorage fails)
let memoryCache: { data: ProductInfo[]; timestamp: number } | null = null;

// Prevent concurrent requests - store the pending promise
let pendingFetch: Promise<ProductInfo[]> | null = null;

/**
 * Fetch product mapping from PriceLab API with caching
 * Uses both in-memory and localStorage caching
 * Deduplicates concurrent requests
 */
export const fetchProductMapping = async (forceRefresh = false): Promise<ProductInfo[]> => {
  // Check in-memory cache first (fastest)
  if (!forceRefresh && memoryCache) {
    const age = Date.now() - memoryCache.timestamp;
    if (age < CACHE_DURATION) {
      logger.log(`[ProductMapping] Using memory cache: ${memoryCache.data.length} products`);
      return memoryCache.data;
    }
  }

  // Check localStorage cache
  if (!forceRefresh) {
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

    if (cachedData && cachedTimestamp) {
      const age = Date.now() - parseInt(cachedTimestamp);
      if (age < CACHE_DURATION) {
        const products: ProductInfo[] = JSON.parse(cachedData);
        // Also populate memory cache
        memoryCache = { data: products, timestamp: parseInt(cachedTimestamp) };
        logger.log(`[ProductMapping] Using localStorage cache: ${products.length} products`);
        return products;
      }
    }
  }

  // If there's already a pending fetch, return that promise (deduplicate requests)
  if (pendingFetch && !forceRefresh) {
    logger.log('[ProductMapping] Waiting for pending fetch...');
    return pendingFetch;
  }

  // Create the fetch promise
  pendingFetch = (async () => {
    try {
      logger.log('[ProductMapping] Fetching from SKU Master API...');

      const response = await fetch(SKU_MASTER_API_URL);

      if (!response.ok) {
        throw new Error(`SKU Master API error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();

      if (!json.success || !Array.isArray(json.data)) {
        throw new Error('Invalid response from SKU Master API');
      }

      // Transform API response to ProductInfo format
      // sku_master fields: sku, marketplace, country_code, asin, iwasku, name, parent, category, cost, size, custom_shipping, fbm_source, fulfillment
      const products: ProductInfo[] = json.data.map((item: any) => ({
        sku: item.sku || '',
        asin: item.asin || '',
        name: item.name || '',
        parent: item.parent || '',
        category: item.category || '',
        cost: item.cost !== null ? parseFloat(item.cost) : null,
        size: item.size !== null ? parseFloat(item.size) : null,
        marketplace: item.marketplace || item.country_code || '',
        customShipping: item.custom_shipping !== null ? parseFloat(item.custom_shipping) : null,
        fbmSource: item.fbm_source || null,
      }));

      // Count products with cost/size data
      const withCost = products.filter(p => p.cost !== null).length;
      const withSize = products.filter(p => p.size !== null).length;

      logger.log(`[ProductMapping] Fetched ${products.length} products from SKU Master`);
      logger.log(`[ProductMapping] With cost: ${withCost}, With size: ${withSize}`);

      const timestamp = Date.now();

      // Always save to memory cache
      memoryCache = { data: products, timestamp };

      // Try to save to localStorage cache
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(products));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, timestamp.toString());
        logger.log('[ProductMapping] Cached to localStorage');
      } catch (cacheError) {
        // localStorage quota exceeded - memory cache is still valid
        console.warn('[ProductMapping] localStorage cache failed (quota exceeded), using memory cache only');
        try {
          localStorage.removeItem(CACHE_KEY);
          localStorage.removeItem(CACHE_TIMESTAMP_KEY);
        } catch {
          // Ignore
        }
      }

      return products;
    } finally {
      // Clear pending fetch so future calls can make new requests
      pendingFetch = null;
    }
  })();

  return pendingFetch;
};

/**
 * Get cached product mapping (synchronous)
 * Checks memory cache first, then localStorage
 */
export const getCachedProductMapping = (): ProductInfo[] | null => {
  // Check memory cache first
  if (memoryCache) {
    const age = Date.now() - memoryCache.timestamp;
    if (age < CACHE_DURATION) {
      return memoryCache.data;
    }
  }

  // Fall back to localStorage
  const cachedData = localStorage.getItem(CACHE_KEY);
  const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

  if (cachedData && cachedTimestamp) {
    const age = Date.now() - parseInt(cachedTimestamp);
    if (age < CACHE_DURATION) {
      const products = JSON.parse(cachedData);
      // Populate memory cache for future sync reads
      memoryCache = { data: products, timestamp: parseInt(cachedTimestamp) };
      return products;
    }
  }

  return null;
};

/**
 * Clear cache to force refresh
 */
export const clearProductMappingCache = (): void => {
  memoryCache = null;
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  logger.log('[ProductMapping] Cache cleared');
};

/**
 * Normalize marketplace codes between PriceLab and Amazon formats
 * PriceLab uses some different codes than Amazon's standard
 */
const MARKETPLACE_ALIASES: Record<string, string[]> = {
  'AE': ['UAE'],     // Amazon uses AE, PriceLab uses UAE
  'UAE': ['AE'],     // Allow reverse lookup too
  'SA': ['KSA'],     // Saudi Arabia variations
  'KSA': ['SA'],
};

/**
 * Create a SKU -> ProductInfo map for O(1) lookups
 * Key format: "marketplace:sku" for marketplace-specific lookup, or just "sku" as fallback
 */
export const createProductMap = (products: ProductInfo[]): Map<string, ProductInfo> => {
  const map = new Map<string, ProductInfo>();

  products.forEach(p => {
    // Primary key: marketplace:sku (for exact marketplace match)
    if (p.marketplace) {
      map.set(`${p.marketplace}:${p.sku}`, p);

      // Also add aliases for marketplace variations
      const aliases = MARKETPLACE_ALIASES[p.marketplace];
      if (aliases) {
        aliases.forEach(alias => {
          map.set(`${alias}:${p.sku}`, p);
        });
      }
    }

    // Fallback key: just sku (for cases without marketplace context)
    // Prioritize entries with cost data, but always add fallback for basic info (category, name)
    if (!map.has(p.sku)) {
      // First occurrence - add it
      map.set(p.sku, p);
    } else if (p.cost !== null && map.get(p.sku)?.cost === null) {
      // Current entry has cost but existing one doesn't - replace it
      map.set(p.sku, p);
    }
  });

  return map;
};

/**
 * Get product info from map, trying marketplace-specific key first
 */
export const getProductFromMap = (
  productMap: Map<string, ProductInfo>,
  sku: string,
  marketplaceCode?: string
): ProductInfo | undefined => {
  // Try marketplace-specific key first
  if (marketplaceCode) {
    const marketplaceKey = `${marketplaceCode}:${sku}`;
    const product = productMap.get(marketplaceKey);
    if (product) return product;
  }

  // Fallback to SKU-only key
  return productMap.get(sku);
};

/**
 * Detect marketplace code from Amazon marketplace URL
 * Fallback for old data that doesn't have marketplaceCode field
 */
const detectMarketplaceFromUrl = (marketplaceUrl: string): string | undefined => {
  if (!marketplaceUrl) return undefined;
  const normalized = marketplaceUrl.toLowerCase().trim().replace(/,/g, '.');

  // Check more specific domains FIRST
  if (normalized.includes('amazon.com.au')) return 'AU';
  if (normalized.includes('amazon.co.uk')) return 'UK';
  if (normalized.includes('amazon.de')) return 'DE';
  if (normalized.includes('amazon.fr')) return 'FR';
  if (normalized.includes('amazon.it')) return 'IT';
  if (normalized.includes('amazon.es')) return 'ES';
  if (normalized.includes('amazon.ca')) return 'CA';
  if (normalized.includes('amazon.ae')) return 'AE';
  if (normalized.includes('amazon.sa')) return 'SA';
  // Check amazon.com LAST
  if (normalized.includes('amazon.com') || normalized.includes('www.amazon.com')) return 'US';

  return undefined;
};

/**
 * Enrich a single transaction with product info
 * IMPORTANT: We use 'productCategory' to avoid conflict with transaction's 'categoryType'
 */
export const enrichTransaction = <T extends { sku: string; marketplaceCode?: string; marketplace?: string }>(
  transaction: T,
  productMap: Map<string, ProductInfo>
): T & {
  asin?: string;
  name?: string;
  parent?: string;
  productCategory?: string;
  productCost?: number | null;
  productSize?: number | null;
  productCustomShipping?: number | null;
  productFbmSource?: string | null;
} => {
  // Use marketplace-aware lookup
  // If marketplaceCode is missing (old data), try to detect from marketplace URL
  const effectiveMarketplaceCode = transaction.marketplaceCode ||
    (transaction.marketplace ? detectMarketplaceFromUrl(transaction.marketplace) : undefined);

  const product = getProductFromMap(productMap, transaction.sku, effectiveMarketplaceCode);

  return {
    ...transaction,
    asin: product?.asin || undefined,
    name: product?.name || undefined,
    parent: product?.parent || undefined,
    productCategory: product?.category || undefined,  // Renamed to avoid conflict
    productCost: product?.cost ?? null,
    productSize: product?.size ?? null,
    productCustomShipping: product?.customShipping ?? null,
    productFbmSource: product?.fbmSource || null,
  };
};

// ============================================
// MISSING SKU DETECTION & REPORTING
// ============================================

export interface MissingSKUInfo {
  sku: string;
  asin?: string;
  name?: string;
  marketplace: string;
  category?: string;
  fulfillment?: string;      // FBA, FBM, Mixed
  transactionCount: number;  // Bu SKU kaç transaction'da geçiyor
  totalRevenue: number;      // Bu SKU'nun toplam geliri (öncelik sıralaması için)
}

/**
 * Detect SKUs that exist in transactions but not in PriceLab mapping
 * Returns list of missing SKUs sorted by revenue (highest first)
 */
export const detectMissingSKUs = <T extends {
  sku: string;
  marketplaceCode?: string;
  marketplace?: string;
  asin?: string;
  name?: string;
  productCategory?: string;
  productSales?: number;
}>(
  transactions: T[],
  productMap: Map<string, ProductInfo>
): MissingSKUInfo[] => {
  const missingMap = new Map<string, MissingSKUInfo>();

  transactions.forEach(t => {
    if (!t.sku) return;

    const marketplaceCode = t.marketplaceCode ||
      (t.marketplace ? detectMarketplaceFromUrl(t.marketplace) : undefined) || 'Unknown';

    // Check if SKU exists in product map
    const product = getProductFromMap(productMap, t.sku, marketplaceCode);

    // If no product found, it's missing
    if (!product) {
      const key = `${marketplaceCode}:${t.sku}`;
      const existing = missingMap.get(key);

      if (existing) {
        existing.transactionCount++;
        existing.totalRevenue += t.productSales || 0;
      } else {
        missingMap.set(key, {
          sku: t.sku,
          asin: t.asin,
          name: t.name,
          marketplace: marketplaceCode,
          category: t.productCategory,
          transactionCount: 1,
          totalRevenue: t.productSales || 0,
        });
      }
    }
  });

  // Sort by revenue (highest first - most important to fix)
  const result = Array.from(missingMap.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  logger.log(`[ProductMapping] Detected ${result.length} missing SKUs from ${transactions.length} transactions`);

  return result;
};

/**
 * Export missing SKUs to PriceLab backend for data entry
 */
export const exportMissingSKUsToPriceLab = async (
  missingSKUs: MissingSKUInfo[]
): Promise<{ added: number; skipped: number }> => {
  const MISSING_SKU_API = 'https://amzsellmetrics.iwa.web.tr/api/amazon-analyzer/sku-master/missing';

  try {
    const response = await fetch(MISSING_SKU_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skus: missingSKUs }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to export missing SKUs');
    }

    logger.log(`[ProductMapping] Exported missing SKUs: ${json.data.added} added, ${json.data.skipped} skipped`);
    return json.data;
  } catch (error) {
    console.error('[ProductMapping] Failed to export missing SKUs:', error);
    throw error;
  }
};

