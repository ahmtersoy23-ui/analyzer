// Phase 3: Config Service - Kargo Cetveli ve Ülke Ayarları Yönetimi
// Uses PriceLab API for data persistence (no localStorage)

import {
  ShippingRateTable,
  ShippingRoute,
  ShippingCurrency,
  AllCountryConfigs,
  CountryProfitConfig,
  DEFAULT_US_CONFIG,
  FBMShippingMode,
} from '../../types/profitability';
import { MarketplaceCode } from '../../types/transaction';
import {
  fetchShippingRates as apiFetchShippingRates,
  saveShippingRatesToAPI,
  fetchCountryConfigs as apiFetchCountryConfigs,
  saveCountryConfigToAPI,
  saveAllCountryConfigsToAPI,
} from '../api/configApi';

// ============================================
// CURRENCY MAPPING
// ============================================

const MARKETPLACE_CURRENCY: Record<MarketplaceCode, string> = {
  US: 'USD',
  UK: 'GBP',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  CA: 'CAD',
  AU: 'AUD',
  AE: 'AED',
  SA: 'SAR',
};

// ============================================
// SHIPPING RATES
// ============================================

// Default boş kargo cetveli
export const createEmptyShippingRates = (): ShippingRateTable => ({
  lastUpdated: new Date().toISOString(),
  routes: {
    'US-US': { currency: 'USD', rates: [] },
    'US-TR': { currency: 'USD', rates: [] },
    'UK': { currency: 'EUR', rates: [] },
    'CA': { currency: 'USD', rates: [] },
    'EU': { currency: 'EUR', rates: [] },
    'AU': { currency: 'EUR', rates: [] },
    'UAE': { currency: 'USD', rates: [] },
    'TR': { currency: 'TRY', rates: [] },
    'SG': { currency: 'USD', rates: [] },
    'SA': { currency: 'USD', rates: [] },
  },
});

// In-memory cache for shipping rates (loaded from API once)
let shippingRatesCache: ShippingRateTable | null = null;

// Kargo cetvelini API'den yükle (sync wrapper - uses cache)
export const loadShippingRates = (): ShippingRateTable | null => {
  return shippingRatesCache;
};

// Kargo cetvelini API'den async yükle
export const loadShippingRatesAsync = async (): Promise<ShippingRateTable> => {
  try {
    const rates = await apiFetchShippingRates();
    shippingRatesCache = rates;
    console.log('✅ Shipping rates loaded from API');
    return rates;
  } catch (error) {
    console.error('Error loading shipping rates from API:', error);
    // Return empty rates on error
    return createEmptyShippingRates();
  }
};

// Kargo cetvelini API'ye kaydet
export const saveShippingRates = async (rates: ShippingRateTable): Promise<void> => {
  try {
    rates.lastUpdated = new Date().toISOString();
    await saveShippingRatesToAPI(rates);
    shippingRatesCache = rates;
    console.log('💾 Shipping rates saved to API');
  } catch (error) {
    console.error('Error saving shipping rates:', error);
    throw new Error('Kargo cetveli kaydedilemedi');
  }
};

// Excel'den kargo cetvelini parse et
export const parseShippingRatesFromExcel = (
  data: Record<string, any>[]
): ShippingRateTable => {
  const rates = createEmptyShippingRates();

  // Exact match mapping for standard column names (priority)
  const exactMapping: Record<string, ShippingRoute> = {
    'us-us': 'US-US',
    'us-tr': 'US-TR',
    'uk': 'UK',
    'ca': 'CA',
    'eu': 'EU',
    'au': 'AU',
    'uae': 'UAE',
    'tr': 'TR',
    'sg': 'SG',
    'sa': 'SA',
  };

  // Fuzzy patterns for Turkish/alternative names (fallback)
  const fuzzyPatterns: { patterns: string[]; route: ShippingRoute }[] = [
    { patterns: ['trden abd', 'tr-us', 'turkey to us', 'tr→us', 'türkiye-abd'], route: 'US-TR' },
    { patterns: ['abd içi', 'us içi', 'us domestic', 'abd-abd'], route: 'US-US' },
    { patterns: ['ingiltere', 'İngiltere', 'england', 'britain'], route: 'UK' },
    { patterns: ['kanada', 'canada'], route: 'CA' },
    { patterns: ['avrupa', 'europe'], route: 'EU' },
    { patterns: ['avustralya', 'australia'], route: 'AU' },
    { patterns: ['bae', 'emirates', 'dubai', 'birleşik arap'], route: 'UAE' },
    { patterns: ['suudi', 'saudi', 'arabistan'], route: 'SA' },
    { patterns: ['singapur', 'singapore'], route: 'SG' },
    { patterns: ['türkiye', 'turkey', 'tr içi'], route: 'TR' },
  ];

  // Find desi column
  const findDesiValue = (row: Record<string, any>): number => {
    for (const key of Object.keys(row)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'desi' || lowerKey === 'kg' || lowerKey === 'weight' || lowerKey === 'ağırlık') {
        return parseFloat(row[key]) || 0;
      }
    }
    return 0;
  };

  // Match column to route - exact match first, then fuzzy
  const findRouteForColumn = (colName: string): ShippingRoute | null => {
    const lowerCol = colName.toLowerCase().trim();

    // 1. Try exact match first (highest priority)
    if (exactMapping[lowerCol]) {
      return exactMapping[lowerCol];
    }

    // 2. Try fuzzy patterns for Turkish/alternative names
    for (const { patterns, route } of fuzzyPatterns) {
      for (const pattern of patterns) {
        if (lowerCol.includes(pattern) || pattern.includes(lowerCol)) {
          return route;
        }
      }
    }

    return null;
  };

  data.forEach((row) => {
    const desi = findDesiValue(row);
    if (desi <= 0) return;

    Object.entries(row).forEach(([colName, value]) => {
      const lowerCol = colName.toLowerCase();
      if (lowerCol === 'desi' || lowerCol === 'kg' || lowerCol === 'weight' || lowerCol === 'ağırlık') return;

      const route = findRouteForColumn(colName);
      if (route) {
        const numValue = parseFloat(String(value)) || 0;
        if (numValue > 0) {
          rates.routes[route].rates.push({ desi, rate: numValue });
        }
      }
    });
  });

  // Her route'u desi'ye göre sırala
  Object.keys(rates.routes).forEach((route) => {
    rates.routes[route as ShippingRoute].rates.sort((a, b) => a.desi - b.desi);
  });

  rates.lastUpdated = new Date().toISOString();
  return rates;
};

// Desi için kargo ücreti bul (üst bareme yuvarla + boş değer atlama)
// Returns { rate, found, currency } - found=false means no valid rates found
//
// Interpolation Logic:
// 1. Skip entries with rate = 0 or missing (boş değerler atlanır)
// 2. Find the first VALID rate where desi <= rateEntry.desi (en yakın üst desi)
// 3. If desi is below all defined rates but some rates exist with 0 values,
//    find the first non-zero rate and use it
// 4. If desi exceeds all defined rates, rate not found
//
// Example:
//   0.5 desi = 0 (boş), 1.0 desi = 0 (boş), 1.5 desi = 50
//   Query 0.8 desi → Returns 50 (uses 1.5 as nearest upper with valid rate)
export const getShippingRate = (
  rates: ShippingRateTable,
  route: ShippingRoute,
  desi: number
): { rate: number; found: boolean; currency: ShippingCurrency } => {
  const routeConfig = rates.routes[route];
  const routeRates = routeConfig?.rates || [];
  const currency = routeConfig?.currency || 'USD';

  if (routeRates.length === 0) return { rate: 0, found: false, currency };

  // Rates are sorted by desi ascending
  // Find the first rate where desi <= rateEntry.desi AND rate > 0 (skip empty values)
  for (const rateEntry of routeRates) {
    if (desi <= rateEntry.desi && rateEntry.rate > 0) {
      return { rate: rateEntry.rate, found: true, currency };
    }
  }

  // If we're here, either:
  // 1. Desi is higher than all defined rates, OR
  // 2. All rates at or above our desi are 0 (empty)
  //
  // For case 2: Find the first non-zero rate (nearest upper with valid value)
  const firstValidRate = routeRates.find(r => r.rate > 0);
  if (firstValidRate && desi <= firstValidRate.desi) {
    // This case is already handled above, but just in case
    return { rate: firstValidRate.rate, found: true, currency };
  }

  // For desi below the first valid rate, use that rate
  // Example: rates start at 1.5=50, query is 0.5 → use 50
  if (firstValidRate && desi < firstValidRate.desi) {
    return { rate: firstValidRate.rate, found: true, currency };
  }

  // Desi is higher than all defined rates or no valid rates exist
  return { rate: 0, found: false, currency };
};

// US FBM için kargo hesapla
// LOCAL: TR'den US deposuna gönderim (desi * gemi bedeli) + US içi kargo
// BOTH: LOCAL hesaplaması ile TR'den direkt gönderimin ortalaması
// Returns:
//   - found: true if we can calculate any shipping cost
//   - partial: true if some rates are missing (e.g., US-US rate not found but warehouse cost available)
// currency: Birden fazla para birimi karıştığında USD varsayılır (fbaShippingPerDesi USD)
export const getUSFBMShippingRate = (
  rates: ShippingRateTable,
  desi: number,
  mode: FBMShippingMode,
  fbaShippingPerDesi: number = 0 // TR'den US deposuna gemi bedeli ($/desi)
): { rate: number; found: boolean; partial: boolean; breakdown: { tr: number; local: number }; currency: ShippingCurrency } => {
  const trResult = getShippingRate(rates, 'US-TR', desi); // TR'den direkt müşteriye
  const usResult = getShippingRate(rates, 'US-US', desi); // US içi kargo

  // LOCAL hesaplaması: TR'den depoya gönderim + US içi kargo
  const toWarehouseCost = desi * fbaShippingPerDesi; // Gemi bedeli
  const localTotal = toWarehouseCost + usResult.rate; // Toplam LOCAL maliyeti

  // Para birimi: fbaShippingPerDesi USD, diğer rate'ler kendi para biriminde
  // Karışık modlarda USD varsayıyoruz
  switch (mode) {
    case 'TR':
      return { rate: trResult.rate, found: trResult.found, partial: false, breakdown: { tr: trResult.rate, local: 0 }, currency: trResult.currency };
    case 'LOCAL':
      // LOCAL = desi * gemi bedeli + US içi kargo (ikisi de USD varsayılıyor)
      // US içi rate bulunamasa bile gemi bedeli varsa found=true (minimum maliyet)
      // partial=true if US-US rate is missing (incomplete calculation)
      const localFound = toWarehouseCost > 0 || usResult.found;
      const localPartial = toWarehouseCost > 0 && !usResult.found; // Gemi bedeli var ama US içi yok
      return { rate: localTotal, found: localFound, partial: localPartial, breakdown: { tr: 0, local: localTotal }, currency: 'USD' };
    case 'BOTH':
      // BOTH = (LOCAL hesaplaması + TR kargo) / 2 - karışık, USD varsay
      // En az biri (TR veya LOCAL) varsa hesapla
      const hasTR = trResult.found;
      const hasLocal = toWarehouseCost > 0 || usResult.found;
      const localIsPartial = toWarehouseCost > 0 && !usResult.found;
      if (hasTR && hasLocal) {
        // İkisi de var - ortalama al
        const avgRate = (localTotal + trResult.rate) / 2;
        return { rate: avgRate, found: true, partial: localIsPartial, breakdown: { tr: trResult.rate, local: localTotal }, currency: 'USD' };
      } else if (hasTR) {
        // Sadece TR var - LOCAL tamamen eksik
        return { rate: trResult.rate, found: true, partial: true, breakdown: { tr: trResult.rate, local: 0 }, currency: trResult.currency };
      } else if (hasLocal) {
        // Sadece LOCAL var - TR eksik
        return { rate: localTotal, found: true, partial: true, breakdown: { tr: 0, local: localTotal }, currency: 'USD' };
      }
      return { rate: 0, found: false, partial: false, breakdown: { tr: 0, local: 0 }, currency: 'USD' };
    default:
      return { rate: trResult.rate, found: trResult.found, partial: false, breakdown: { tr: trResult.rate, local: 0 }, currency: trResult.currency };
  }
};

// Marketplace için kargo route'u belirle
export const getShippingRouteForMarketplace = (
  marketplace: MarketplaceCode
): ShippingRoute => {
  switch (marketplace) {
    case 'US':
      return 'US-TR'; // Default TR'den, FBM mode'a göre değişebilir
    case 'UK':
      return 'UK';
    case 'DE':
    case 'FR':
    case 'IT':
    case 'ES':
      return 'EU';
    case 'CA':
      return 'CA';
    case 'AU':
      return 'AU';
    case 'AE':
      return 'UAE';
    case 'SA':
      return 'SA';
    default:
      return 'US-TR';
  }
};

// ============================================
// COUNTRY CONFIGS
// ============================================

// In-memory cache for country configs
let countryConfigsCache: AllCountryConfigs | null = null;

// Default ülke config'lerini oluştur
export const createDefaultCountryConfigs = (): AllCountryConfigs => {
  const marketplaces: MarketplaceCode[] = ['US', 'UK', 'DE', 'FR', 'IT', 'ES', 'CA', 'AU', 'AE', 'SA'];

  const configs: Record<MarketplaceCode, CountryProfitConfig> = {} as any;

  marketplaces.forEach((mp) => {
    if (mp === 'US') {
      configs[mp] = DEFAULT_US_CONFIG;
    } else {
      // Diğer ülkeler için varsayılan değerler 0
      configs[mp] = {
        marketplace: mp,
        currency: MARKETPLACE_CURRENCY[mp],
        fba: {
          shippingPerDesi: 0,  // Varsayılan 0, kullanıcı manuel girer
          warehousePercent: 0,
        },
        fbm: {
          shippingMode: 'BOTH',
          fromTR: {
            customsDutyPercent: 0,  // Varsayılan 0
            ddpFee: 0,
          },
          fromLocal: { shippingPerDesi: 0, warehousePercent: 0 },  // Varsayılan 0
        },
        lastUpdated: new Date().toISOString(),
      };
    }
  });

  return {
    configs,
    lastUpdated: new Date().toISOString(),
  };
};

// Ülke config'lerini sync yükle (uses cache)
export const loadCountryConfigs = (): AllCountryConfigs => {
  if (countryConfigsCache) {
    return countryConfigsCache;
  }
  return createDefaultCountryConfigs();
};

// Ülke config'lerini API'den async yükle
export const loadCountryConfigsAsync = async (): Promise<AllCountryConfigs> => {
  try {
    const configs = await apiFetchCountryConfigs();
    countryConfigsCache = configs;
    console.log('✅ Country configs loaded from API:', {
      lastUpdated: configs.lastUpdated,
      countries: Object.keys(configs.configs),
    });
    return configs;
  } catch (error) {
    console.error('Error loading country configs from API:', error);
    return createDefaultCountryConfigs();
  }
};

// Ülke config'lerini API'ye kaydet
export const saveCountryConfigs = async (configs: AllCountryConfigs): Promise<void> => {
  try {
    configs.lastUpdated = new Date().toISOString();
    await saveAllCountryConfigsToAPI(configs);
    countryConfigsCache = configs;
    console.log('💾 Country configs saved to API');
  } catch (error) {
    console.error('Error saving country configs:', error);
    throw new Error('Ülke ayarları kaydedilemedi');
  }
};

// Tek bir ülke config'ini güncelle
export const updateCountryConfig = async (
  allConfigs: AllCountryConfigs,
  marketplace: MarketplaceCode,
  updates: Partial<CountryProfitConfig>
): Promise<AllCountryConfigs> => {
  const updatedConfig = {
    ...allConfigs.configs[marketplace],
    ...updates,
    lastUpdated: new Date().toISOString(),
  };

  const updatedConfigs = {
    ...allConfigs,
    configs: {
      ...allConfigs.configs,
      [marketplace]: updatedConfig,
    },
    lastUpdated: new Date().toISOString(),
  };

  // Save single config to API
  await saveCountryConfigToAPI(updatedConfig);
  countryConfigsCache = updatedConfigs;

  return updatedConfigs;
};

// ============================================
// INITIALIZATION
// ============================================

// Load all configs from API on startup
export const initializeConfigs = async (): Promise<{
  shippingRates: ShippingRateTable;
  countryConfigs: AllCountryConfigs;
}> => {
  const [shippingRates, countryConfigs] = await Promise.all([
    loadShippingRatesAsync(),
    loadCountryConfigsAsync(),
  ]);

  return { shippingRates, countryConfigs };
};

// Clear caches (useful for logout/refresh)
export const clearConfigCaches = (): void => {
  shippingRatesCache = null;
  countryConfigsCache = null;
};

// ============================================
// EXPORT/IMPORT (JSON files)
// ============================================

// Tüm config'leri JSON olarak export et
export const exportAllConfigs = (): string => {
  const data = {
    shippingRates: loadShippingRates(),
    countryConfigs: loadCountryConfigs(),
    exportedAt: new Date().toISOString(),
    version: '2.0',
  };
  return JSON.stringify(data, null, 2);
};

// JSON'dan config'leri import et
export const importAllConfigs = async (jsonString: string): Promise<void> => {
  try {
    const data = JSON.parse(jsonString);

    if (data.shippingRates) {
      await saveShippingRates(data.shippingRates);
    }

    if (data.countryConfigs) {
      await saveCountryConfigs(data.countryConfigs);
    }
  } catch (error) {
    console.error('Error importing configs:', error);
    throw new Error('Config dosyası okunamadı');
  }
};

// Tüm config'leri sıfırla (sadece cache'i temizle, API'de veri kalır)
export const resetAllConfigs = (): void => {
  clearConfigCaches();
};
