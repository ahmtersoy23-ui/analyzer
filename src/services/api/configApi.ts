/**
 * Config API Service
 * Fetches and saves profitability config data from PriceLab backend
 */

import {
  ShippingRateTable,
  ShippingRoute,
  AllCountryConfigs,
  CountryProfitConfig,
} from '../../types/profitability';
import { MarketplaceCode } from '../../types/transaction';
import { logger } from '../../utils/logger';

// API Base URL
const API_BASE_URL = 'https://amzsellmetrics.iwa.web.tr/api/amazon-analyzer';

// ============================================
// SHIPPING RATES
// ============================================

/**
 * Fetch shipping rates from API
 */
export const fetchShippingRates = async (): Promise<ShippingRateTable> => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/shipping-rates`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to fetch shipping rates');
    }

    // Transform API response to ShippingRateTable format
    const data = json.data;
    const routes: Record<string, any> = {};

    // Route code mapping: API uses 'TR-UK', frontend expects 'UK'
    const routeCodeMapping: Record<string, ShippingRoute> = {
      'TR-UK': 'UK',
      'TR-EU': 'EU',
      'TR-CA': 'CA',
      'TR-AU': 'AU',
      'TR-SG': 'SG',
      'TR-SA': 'SA',
      'TR-UAE': 'UAE',
      'TR-TR': 'TR',
      'TR-US': 'US-TR',  // Both TR-US and US-TR map to US-TR
      'US-TR': 'US-TR',
      'US-US': 'US-US',
    };

    // API returns { routes: { 'TR-UK': { currency, rates: [{ maxWeight, rate }] }, ... } }
    // Frontend expects { routes: { 'UK': { currency, rates: [{ desi, rate }] }, ... } }
    Object.entries(data.routes || {}).forEach(([apiRouteCode, config]: [string, any]) => {
      // Map API route code to frontend route code
      const frontendRouteCode = routeCodeMapping[apiRouteCode] || apiRouteCode;

      // Transform maxWeight -> desi
      const transformedRates = (config.rates || []).map((r: any) => ({
        desi: r.maxWeight ?? r.desi ?? 0,  // API uses maxWeight, frontend uses desi
        rate: r.rate || 0,
      }));

      routes[frontendRouteCode as ShippingRoute] = {
        currency: config.currency || 'USD',
        rates: transformedRates,
      };
    });

    logger.log('[ConfigAPI] Fetched shipping routes:', Object.keys(routes));

    return {
      lastUpdated: data.lastUpdated || new Date().toISOString(),
      routes: routes as ShippingRateTable['routes'],
    };
  } catch (error) {
    console.error('[ConfigAPI] Error fetching shipping rates:', error);
    throw error;
  }
};

/**
 * Save shipping rates to API
 */
export const saveShippingRatesToAPI = async (rates: ShippingRateTable): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/shipping-rates/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routes: rates.routes }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to save shipping rates');
    }

    logger.log('[ConfigAPI] Shipping rates saved to API');
  } catch (error) {
    console.error('[ConfigAPI] Error saving shipping rates:', error);
    throw error;
  }
};

/**
 * Update single route shipping rate
 */
export const updateRouteShippingRate = async (
  routeCode: string,
  currency: string,
  rates: { desi: number; rate: number }[]
): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/shipping-rates/${routeCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency, rates }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to update shipping rate');
    }
  } catch (error) {
    console.error('[ConfigAPI] Error updating route shipping rate:', error);
    throw error;
  }
};

// ============================================
// COUNTRY/MARKETPLACE CONFIGS
// ============================================

/**
 * Fetch all marketplace configs from API
 */
export const fetchCountryConfigs = async (): Promise<AllCountryConfigs> => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/country-configs`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to fetch country configs');
    }

    // Transform API response to AllCountryConfigs format
    // API returns: { configs: { US: { name, currency, fba, fbm, gst }, UK: {...}, ... } }
    const configs: Record<MarketplaceCode, CountryProfitConfig> = {} as any;

    Object.entries(json.data.configs || {}).forEach(([mpCode, item]: [string, any]) => {
      const mp = mpCode as MarketplaceCode;
      configs[mp] = {
        marketplace: mp,
        currency: item.currency,
        fba: item.fba || { shippingPerDesi: 0, warehousePercent: 0 },
        fbm: item.fbm || { shippingMode: 'TR', fromTR: { customsDutyPercent: 0, ddpFee: 0 } },
        gst: item.gst || undefined,
        lastUpdated: new Date().toISOString(),
      };
    });

    logger.log('[ConfigAPI] Fetched country configs:', Object.keys(configs));

    return {
      configs,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[ConfigAPI] Error fetching country configs:', error);
    throw error;
  }
};

/**
 * Save single marketplace config to API
 */
export const saveCountryConfigToAPI = async (config: CountryProfitConfig): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/countries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketplace: config.marketplace,
        currency: config.currency,
        fba: config.fba,
        fbm: config.fbm,
        gst: config.gst,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to save country config');
    }

    logger.log(`[ConfigAPI] Country config saved for ${config.marketplace}`);
  } catch (error) {
    console.error('[ConfigAPI] Error saving country config:', error);
    throw error;
  }
};

/**
 * Save all country configs to API (bulk)
 */
export const saveAllCountryConfigsToAPI = async (configs: AllCountryConfigs): Promise<void> => {
  try {
    const configsArray = Object.values(configs.configs).map(c => ({
      marketplace: c.marketplace,
      currency: c.currency,
      fba: c.fba,
      fbm: c.fbm,
      gst: c.gst,
    }));

    const response = await fetch(`${API_BASE_URL}/settings/countries/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configs: configsArray }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to save country configs');
    }

    logger.log('[ConfigAPI] All country configs saved to API');
  } catch (error) {
    console.error('[ConfigAPI] Error saving country configs:', error);
    throw error;
  }
};

// ============================================
// SKU OVERRIDES
// ============================================

export interface SkuOverride {
  sku: string;
  marketplace?: string;
  customShipping?: number;
  fbmSource?: 'TR' | 'US' | 'LOCAL' | 'BOTH';
  notes?: string;
}

/**
 * Fetch SKU overrides from API
 */
export const fetchSkuOverrides = async (marketplace?: string): Promise<SkuOverride[]> => {
  try {
    const url = marketplace
      ? `${API_BASE_URL}/settings/sku-overrides?marketplace=${marketplace}`
      : `${API_BASE_URL}/settings/sku-overrides`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to fetch SKU overrides');
    }

    return json.data.map((item: any) => ({
      sku: item.sku,
      marketplace: item.marketplace_code,
      customShipping: item.custom_shipping ? parseFloat(item.custom_shipping) : undefined,
      fbmSource: item.fbm_source,
      notes: item.notes,
    }));
  } catch (error) {
    console.error('[ConfigAPI] Error fetching SKU overrides:', error);
    throw error;
  }
};

/**
 * Save SKU override to API
 */
export const saveSkuOverride = async (override: SkuOverride): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/sku-overrides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(override),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to save SKU override');
    }
  } catch (error) {
    console.error('[ConfigAPI] Error saving SKU override:', error);
    throw error;
  }
};

/**
 * Save multiple SKU overrides to API (bulk)
 */
export const saveSkuOverridesBulk = async (overrides: SkuOverride[]): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/sku-overrides/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to save SKU overrides');
    }

    logger.log(`[ConfigAPI] ${overrides.length} SKU overrides saved to API`);
  } catch (error) {
    console.error('[ConfigAPI] Error saving SKU overrides:', error);
    throw error;
  }
};

/**
 * Delete SKU override from API
 */
export const deleteSkuOverride = async (sku: string, marketplace?: string): Promise<void> => {
  try {
    const url = marketplace
      ? `${API_BASE_URL}/settings/sku-overrides/${encodeURIComponent(sku)}?marketplace=${marketplace}`
      : `${API_BASE_URL}/settings/sku-overrides/${encodeURIComponent(sku)}`;

    const response = await fetch(url, { method: 'DELETE' });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to delete SKU override');
    }
  } catch (error) {
    console.error('[ConfigAPI] Error deleting SKU override:', error);
    throw error;
  }
};

// ============================================
// PROFITABILITY SETTINGS (Global percentages)
// ============================================

export interface ProfitabilitySettings {
  advertisingPercent: number;
  fbaCostPercent: number;
  fbmCostPercent: number;
  refundRecoveryRate: number;
}

/**
 * Fetch global profitability settings
 */
export const fetchProfitabilitySettings = async (): Promise<ProfitabilitySettings | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/profitability`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const json = await response.json();
    if (!json.success || !json.data) {
      return null;
    }

    return {
      advertisingPercent: parseFloat(json.data.advertising_percent) || 0,
      fbaCostPercent: parseFloat(json.data.fba_cost_percent) || 0,
      fbmCostPercent: parseFloat(json.data.fbm_cost_percent) || 0,
      refundRecoveryRate: parseFloat(json.data.refund_recovery_rate) || 0.3,
    };
  } catch (error) {
    console.error('[ConfigAPI] Error fetching profitability settings:', error);
    return null;
  }
};

/**
 * Save global profitability settings
 */
export const saveProfitabilitySettings = async (settings: ProfitabilitySettings): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/profitability`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to save profitability settings');
    }

    logger.log('[ConfigAPI] Profitability settings saved to API');
  } catch (error) {
    console.error('[ConfigAPI] Error saving profitability settings:', error);
    throw error;
  }
};

// ============================================
// FBM OVERRIDES (Custom Shipping & FBM Source)
// ============================================

export interface FbmOverride {
  sku: string;
  marketplace: string;
  shippingCost: number | null;
  shipFromCountry: 'TR' | 'US' | 'BOTH' | null;
}

/**
 * Fetch all FBM overrides from API
 */
export const fetchFbmOverrides = async (): Promise<FbmOverride[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/fbm-overrides`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to fetch FBM overrides');
    }

    return (json.data || []).map((item: any) => ({
      sku: item.sku,
      marketplace: item.marketplace,
      shippingCost: item.shipping_cost ? parseFloat(item.shipping_cost) : null,
      shipFromCountry: item.ship_from_country,
    }));
  } catch (error) {
    console.error('[ConfigAPI] Error fetching FBM overrides:', error);
    return [];
  }
};

/**
 * Save single FBM override to API
 */
export const saveFbmOverride = async (override: FbmOverride): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/fbm-overrides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: override.sku,
        marketplace: override.marketplace,
        shippingCost: override.shippingCost,
        shipFromCountry: override.shipFromCountry,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to save FBM override');
    }
  } catch (error) {
    console.error('[ConfigAPI] Error saving FBM override:', error);
    throw error;
  }
};

/**
 * Save multiple FBM overrides to API (bulk)
 */
export const saveFbmOverridesBulk = async (overrides: FbmOverride[]): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/fbm-overrides/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overrides: overrides.map(o => ({
          sku: o.sku,
          marketplace: o.marketplace,
          shippingCost: o.shippingCost,
          shipFromCountry: o.shipFromCountry,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to save FBM overrides');
    }

    logger.log(`[ConfigAPI] ${overrides.length} FBM overrides saved to API`);
  } catch (error) {
    console.error('[ConfigAPI] Error saving FBM overrides:', error);
    throw error;
  }
};

/**
 * Delete FBM override from API
 */
export const deleteFbmOverride = async (sku: string, marketplace: string): Promise<void> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/fbm-overrides/${encodeURIComponent(sku)}/${encodeURIComponent(marketplace)}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to delete FBM override');
    }
  } catch (error) {
    console.error('[ConfigAPI] Error deleting FBM override:', error);
    throw error;
  }
};

/**
 * Clear only shipping cost for a FBM override
 */
export const clearFbmOverrideShipping = async (sku: string, marketplace: string): Promise<void> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/fbm-overrides/clear-shipping/${encodeURIComponent(sku)}/${encodeURIComponent(marketplace)}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
  } catch (error) {
    console.error('[ConfigAPI] Error clearing FBM override shipping:', error);
    throw error;
  }
};

/**
 * Clear only ship_from_country for a FBM override
 */
export const clearFbmOverrideLocation = async (sku: string, marketplace: string): Promise<void> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/fbm-overrides/clear-location/${encodeURIComponent(sku)}/${encodeURIComponent(marketplace)}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
  } catch (error) {
    console.error('[ConfigAPI] Error clearing FBM override location:', error);
    throw error;
  }
};

// ============================================
// TRANSACTION STORAGE
// ============================================

export interface TransactionStats {
  total: number;
  minDate: string | null;
  maxDate: string | null;
  byMarketplace: Array<{
    marketplace_code: string;
    count: number;
    min_date: string;
    max_date: string;
  }>;
}

export interface TransactionApiData {
  id: string;
  fileName: string;
  date: string;
  dateOnly: string;
  type: string;
  categoryType: string;
  orderId: string;
  sku: string;
  description: string;
  marketplace: string;
  fulfillment: string;
  orderPostal: string;
  quantity: number;
  productSales: number;
  promotionalRebates: number;
  sellingFees: number;
  fbaFees: number;
  otherTransactionFees: number;
  other: number;
  vat: number;
  liquidations: number;
  total: number;
  marketplaceCode: string;
}

/**
 * Fetch transaction statistics from API
 */
export const fetchTransactionStats = async (): Promise<TransactionStats> => {
  try {
    const response = await fetch(`${API_BASE_URL}/transactions/stats`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to fetch transaction stats');
    }
    return json.data;
  } catch (error) {
    console.error('[ConfigAPI] Error fetching transaction stats:', error);
    throw error;
  }
};

/**
 * Fetch all transactions from API
 */
export const fetchTransactions = async (params?: {
  startDate?: string;
  endDate?: string;
  marketplace?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: TransactionApiData[]; meta: { total: number; limit: number; offset: number } }> => {
  try {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    if (params?.marketplace) searchParams.set('marketplace', params.marketplace);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const url = `${API_BASE_URL}/transactions${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    logger.log(`[ConfigAPI] Fetching transactions from ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to fetch transactions');
    }

    logger.log(`[ConfigAPI] Fetched ${json.data.length} transactions`);
    return { data: json.data, meta: json.meta };
  } catch (error) {
    console.error('[ConfigAPI] Error fetching transactions:', error);
    throw error;
  }
};

/**
 * Save transactions to API (bulk upsert)
 */
export const saveTransactions = async (
  transactions: TransactionApiData[]
): Promise<{ inserted: number; updated: number; errors: number; total: number }> => {
  try {
    logger.log(`[ConfigAPI] Saving ${transactions.length} transactions to API...`);

    const response = await fetch(`${API_BASE_URL}/transactions/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to save transactions');
    }

    logger.log(`[ConfigAPI] Transactions saved: ${json.data.inserted} inserted, ${json.data.updated} updated`);
    return json.data;
  } catch (error) {
    console.error('[ConfigAPI] Error saving transactions:', error);
    throw error;
  }
};

/**
 * Delete all transactions from API
 */
export const deleteAllTransactions = async (): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/transactions`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to delete transactions');
    }

    logger.log('[ConfigAPI] All transactions deleted');
  } catch (error) {
    console.error('[ConfigAPI] Error deleting transactions:', error);
    throw error;
  }
};

/**
 * Delete transactions by file name
 */
export const deleteTransactionsByFile = async (fileName: string): Promise<number> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/transactions/file/${encodeURIComponent(fileName)}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to delete transactions');
    }

    logger.log(`[ConfigAPI] Deleted ${json.deleted} transactions from file ${fileName}`);
    return json.deleted;
  } catch (error) {
    console.error('[ConfigAPI] Error deleting transactions by file:', error);
    throw error;
  }
};
