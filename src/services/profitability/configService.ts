// Phase 3: Config Service - Kargo Cetveli ve Ülke Ayarları Yönetimi

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

// ============================================
// STORAGE KEYS
// ============================================

const STORAGE_KEYS = {
  SHIPPING_RATES: 'amazon-analyzer-shipping-rates',
  COUNTRY_CONFIGS: 'amazon-analyzer-country-configs',
};

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

// Kargo cetvelini localStorage'dan yükle
export const loadShippingRates = (): ShippingRateTable | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SHIPPING_RATES);
    if (stored) {
      return JSON.parse(stored) as ShippingRateTable;
    }
    return null;
  } catch (error) {
    console.error('Error loading shipping rates:', error);
    return null;
  }
};

// Kargo cetvelini localStorage'a kaydet
export const saveShippingRates = (rates: ShippingRateTable): void => {
  try {
    rates.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.SHIPPING_RATES, JSON.stringify(rates));
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

// Desi için kargo ücreti bul (üst bareme yuvarla)
// Returns { rate, found, currency } - found=false means no rates defined at all
// If desi exceeds the highest rate in table, uses the highest rate (extrapolation)
export const getShippingRate = (
  rates: ShippingRateTable,
  route: ShippingRoute,
  desi: number
): { rate: number; found: boolean; currency: ShippingCurrency } => {
  const routeConfig = rates.routes[route];
  const routeRates = routeConfig?.rates || [];
  const currency = routeConfig?.currency || 'USD';

  if (routeRates.length === 0) return { rate: 0, found: false, currency };

  // Üst bareme yuvarla: 1.33 desi için 1.5 satırını bul
  for (const rateEntry of routeRates) {
    if (desi <= rateEntry.desi) {
      return { rate: rateEntry.rate, found: true, currency };
    }
  }

  // En yüksek desi'den büyükse, rate bulunamadı - kullanıcı override girmeli veya cetveli genişletmeli
  return { rate: 0, found: false, currency };
};

// US FBM için kargo hesapla
// LOCAL: TR'den US deposuna gönderim (desi * gemi bedeli) + US içi kargo
// BOTH: LOCAL hesaplaması ile TR'den direkt gönderimin ortalaması
// Returns found=false if any required rate is missing
// currency: Birden fazla para birimi karıştığında USD varsayılır (fbaShippingPerDesi USD)
export const getUSFBMShippingRate = (
  rates: ShippingRateTable,
  desi: number,
  mode: FBMShippingMode,
  fbaShippingPerDesi: number = 0 // TR'den US deposuna gemi bedeli ($/desi)
): { rate: number; found: boolean; breakdown: { tr: number; local: number }; currency: ShippingCurrency } => {
  const trResult = getShippingRate(rates, 'US-TR', desi); // TR'den direkt müşteriye
  const usResult = getShippingRate(rates, 'US-US', desi); // US içi kargo

  // LOCAL hesaplaması: TR'den depoya gönderim + US içi kargo
  const toWarehouseCost = desi * fbaShippingPerDesi; // Gemi bedeli
  const localTotal = toWarehouseCost + usResult.rate; // Toplam LOCAL maliyeti

  // Para birimi: fbaShippingPerDesi USD, diğer rate'ler kendi para biriminde
  // Karışık modlarda USD varsayıyoruz
  switch (mode) {
    case 'TR':
      return { rate: trResult.rate, found: trResult.found, breakdown: { tr: trResult.rate, local: 0 }, currency: trResult.currency };
    case 'LOCAL':
      // LOCAL = desi * gemi bedeli + US içi kargo (ikisi de USD varsayılıyor)
      return { rate: localTotal, found: usResult.found, breakdown: { tr: 0, local: localTotal }, currency: 'USD' };
    case 'BOTH':
      // BOTH = (LOCAL hesaplaması + TR kargo) / 2 - karışık, USD varsay
      const bothFound = trResult.found && usResult.found;
      const avgRate = (localTotal + trResult.rate) / 2;
      return { rate: avgRate, found: bothFound, breakdown: { tr: trResult.rate, local: localTotal }, currency: 'USD' };
    default:
      return { rate: trResult.rate, found: trResult.found, breakdown: { tr: trResult.rate, local: 0 }, currency: trResult.currency };
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
          fromLocal: { warehousePercent: 0 },  // Varsayılan 0
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

// Ülke config'lerini localStorage'dan yükle
export const loadCountryConfigs = (): AllCountryConfigs => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.COUNTRY_CONFIGS);
    if (stored) {
      const parsed = JSON.parse(stored) as AllCountryConfigs;
      console.log('✅ Country configs loaded from localStorage:', {
        lastUpdated: parsed.lastUpdated,
        countries: Object.keys(parsed.configs),
        usConfig: parsed.configs.US ? {
          fbaShipping: parsed.configs.US.fba.shippingPerDesi,
          fbaWarehouse: parsed.configs.US.fba.warehousePercent,
        } : null,
      });
      return parsed;
    }
    console.log('ℹ️ No saved country configs found, using defaults');
    return createDefaultCountryConfigs();
  } catch (error) {
    console.error('Error loading country configs:', error);
    return createDefaultCountryConfigs();
  }
};

// Ülke config'lerini localStorage'a kaydet
export const saveCountryConfigs = (configs: AllCountryConfigs): void => {
  try {
    configs.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.COUNTRY_CONFIGS, JSON.stringify(configs));
    console.log('💾 Country configs saved to localStorage:', {
      lastUpdated: configs.lastUpdated,
      usConfig: configs.configs.US ? {
        fbaShipping: configs.configs.US.fba.shippingPerDesi,
        fbaWarehouse: configs.configs.US.fba.warehousePercent,
      } : null,
    });
  } catch (error) {
    console.error('Error saving country configs:', error);
    throw new Error('Ülke ayarları kaydedilemedi');
  }
};

// Tek bir ülke config'ini güncelle
export const updateCountryConfig = (
  allConfigs: AllCountryConfigs,
  marketplace: MarketplaceCode,
  updates: Partial<CountryProfitConfig>
): AllCountryConfigs => {
  const updatedConfigs = {
    ...allConfigs,
    configs: {
      ...allConfigs.configs,
      [marketplace]: {
        ...allConfigs.configs[marketplace],
        ...updates,
        lastUpdated: new Date().toISOString(),
      },
    },
    lastUpdated: new Date().toISOString(),
  };

  saveCountryConfigs(updatedConfigs);
  return updatedConfigs;
};

// ============================================
// EXPORT/IMPORT
// ============================================

// Tüm config'leri JSON olarak export et
export const exportAllConfigs = (): string => {
  const data = {
    shippingRates: loadShippingRates(),
    countryConfigs: loadCountryConfigs(),
    exportedAt: new Date().toISOString(),
    version: '1.0',
  };
  return JSON.stringify(data, null, 2);
};

// JSON'dan config'leri import et
export const importAllConfigs = (jsonString: string): void => {
  try {
    const data = JSON.parse(jsonString);

    if (data.shippingRates) {
      saveShippingRates(data.shippingRates);
    }

    if (data.countryConfigs) {
      saveCountryConfigs(data.countryConfigs);
    }
  } catch (error) {
    console.error('Error importing configs:', error);
    throw new Error('Config dosyası okunamadı');
  }
};

// Tüm config'leri sıfırla
export const resetAllConfigs = (): void => {
  localStorage.removeItem(STORAGE_KEYS.SHIPPING_RATES);
  localStorage.removeItem(STORAGE_KEYS.COUNTRY_CONFIGS);
};
