// Phase 3: Profitability Analyzer Types

import { MarketplaceCode } from './transaction';

// ============================================
// SHIPPING RATES (Kargo Cetveli)
// ============================================

export type ShippingRoute =
  | 'US-US'   // US içi gönderim
  | 'US-TR'   // TR'den US'e
  | 'UK'      // UK'e gönderim
  | 'CA'      // Kanada'ya
  | 'EU'      // Avrupa (DE, FR, IT, ES)
  | 'AU'      // Avustralya
  | 'UAE'     // BAE
  | 'TR'      // Türkiye içi
  | 'SG'      // Singapur
  | 'SA';     // Suudi Arabistan

export type ShippingCurrency = 'USD' | 'EUR' | 'TRY';

export interface DesiRate {
  desi: number;    // 0.5, 1, 1.5, 2, ...
  rate: number;    // Fiyat
}

export interface ShippingRouteConfig {
  currency: ShippingCurrency;
  rates: DesiRate[];
}

export interface ShippingRateTable {
  lastUpdated: string;
  routes: Record<ShippingRoute, ShippingRouteConfig>;
}

// ============================================
// COUNTRY CONFIG (Ülke Bazlı Manuel Ayarlar)
// ============================================

export type FBMShippingMode = 'TR' | 'LOCAL' | 'BOTH';

export interface FBAConfig {
  shippingPerDesi: number;      // Gemi bedeli ($/desi veya yerel para)
  warehousePercent: number;     // Depo-İdare %
}

// Kategori bazlı gümrük vergisi
export interface CategoryCustomsDuty {
  category: string;
  dutyPercent: number;
}

export interface FBMFromTRConfig {
  customsDutyPercent: number;   // Varsayılan gümrük vergisi %
  categoryDuties?: CategoryCustomsDuty[];  // Kategori bazlı farklı oranlar
  ddpFee: number;               // DDP ücreti (sabit)
}

export interface FBMFromLocalConfig {
  shippingPerDesi?: number;     // US deposuna gönderim bedeli ($/desi) - FBA ile aynı olabilir
  warehousePercent: number;     // Yerel depo maliyeti %
}

export interface FBMConfig {
  shippingMode: FBMShippingMode;
  fromTR: FBMFromTRConfig;
  fromLocal?: FBMFromLocalConfig;  // Sadece US için gerekli
}

// GST/VAT uygulanacak fulfillment türü
export type GSTApplyTo = 'FBA' | 'FBM' | 'BOTH';

// GST/VAT config for non-Amazon tax obligations
export interface GSTConfig {
  enabled: boolean;           // GST hesaplaması aktif mi
  ratePercent: number;        // GST oranı % (AU: 10%, AE: 5%, SA: 15%)
  includedInPrice: boolean;   // Fiyatın içinde mi (AU: true)
  applyTo: GSTApplyTo;        // Hangi fulfillment türüne uygulanacak (AU: FBA, AE/SA: BOTH)
}

export interface CountryProfitConfig {
  marketplace: MarketplaceCode;
  currency: string;
  fba: FBAConfig;
  fbm: FBMConfig;
  gst?: GSTConfig;            // Non-Amazon GST obligation (AU için)
  lastUpdated: string;
}

export interface AllCountryConfigs {
  configs: Record<MarketplaceCode, CountryProfitConfig>;
  lastUpdated: string;
}

// ============================================
// COST DATA (Maliyet Dosyası)
// ============================================

// FBM gönderim kaynağı (SKU bazlı override)
export type FBMSourceOverride = 'TR' | 'US' | 'BOTH' | null;

export interface ProductCostData {
  sku: string;
  asin?: string;
  name: string;
  parent?: string;
  category?: string;
  cost: number | null;           // null = eksik
  size: number | null;           // desi, null = eksik
  customShipping?: number | null; // Özel kargo ücreti (desi cetvelini bypass eder)
  fbmSource?: FBMSourceOverride;  // SKU bazlı FBM kaynak (TR/US/BOTH) - sadece US marketplace için
}

export interface CostDataSummary {
  totalProducts: number;
  matchedProducts: number;
  missingCost: string[];    // SKU listesi
  missingSize: string[];    // SKU listesi
  matchPercentage: number;
}

// ============================================
// PHASE 1/2 DATA TRANSFER
// ============================================

// Phase 1'den gelen genel oranlar
export interface Phase1GlobalRates {
  marketplace: MarketplaceCode | 'ALL';
  fbaCostPercent: number;       // FBA Cost (stok + diğer Amazon maliyetleri)
  fbmCostPercent: number;       // FBM Cost
  advertisingPercent: number;   // Reklam gideri %
  refundRecoveryRate: number;   // İade geri kazanım oranı
}

// Phase 2'den gelen NAME bazlı veriler
export interface Phase2NameData {
  name: string;
  skus: string[];               // Bu name'e bağlı SKU'lar

  // Revenue
  avgSalePrice: number;
  totalRevenue: number;
  totalQuantity: number;

  // Amazon Fees (NAME bazlı)
  sellingFeePercent: number;    // Selling Fee %
  fbaFeePercent: number;        // FBA Fee % (sipariş bazlı)
  refundLossPercent: number;    // İade kaybı %

  // Fulfillment breakdown
  fbaRevenue: number;
  fbmRevenue: number;
  fbaQuantity: number;
  fbmQuantity: number;
}

// ============================================
// PROFITABILITY CALCULATION
// ============================================

export interface ProfitBreakdown {
  // Revenue
  avgSalePrice: number;

  // Amazon Kesintileri
  sellingFee: number;
  fbaFee: number;           // NAME bazlı (sipariş bazlı)
  fbaCost: number;          // GENEL (stok + diğer)
  fbmCost: number;          // GENEL
  refundLoss: number;
  advertisingCost: number;
  totalAmazonCuts: number;

  // Maliyetler
  productCost: number;
  shippingCost: number;
  customsDuty: number;
  ddpFee: number;
  warehouseCost: number;
  totalCosts: number;

  // Sonuç
  netProfit: number;
  profitMargin: number;     // %
  roi: number;              // %
}

export interface ProductProfitability {
  // Ürün bilgileri
  name: string;
  skus: string[];
  category: string;

  // Maliyet bilgileri
  productCost: number | null;
  desi: number | null;
  hasCostData: boolean;
  hasSizeData: boolean;

  // Satış bilgileri (Phase 2'den)
  avgSalePrice: number;
  totalQuantity: number;
  fbaQuantity: number;
  fbmQuantity: number;

  // Karlılık hesapları
  fba: ProfitBreakdown | null;    // null = hesaplanamadı (eksik veri)
  fbm: ProfitBreakdown | null;

  // Özet
  bestOption: 'FBA' | 'FBM' | null;
  profitDifference: number | null;
}

export interface ProfitabilitySummary {
  marketplace: MarketplaceCode;
  totalProducts: number;
  calculatedProducts: number;

  // FBA özet
  fbaAverageMargin: number;
  fbaTotalProfit: number;
  fbaProfitableCount: number;
  fbaUnprofitableCount: number;

  // FBM özet
  fbmAverageMargin: number;
  fbmTotalProfit: number;
  fbmProfitableCount: number;
  fbmUnprofitableCount: number;

  // Karşılaştırma
  fbaBetterCount: number;
  fbmBetterCount: number;
}

// ============================================
// UI STATE
// ============================================

export type ProfitabilityTab = 'cost-upload' | 'shipping-rates' | 'country-settings' | 'analysis';

export interface ProfitabilityFilters {
  marketplace: MarketplaceCode;
  category: string | 'all';
  fulfillment: 'FBA' | 'FBM' | 'both';
  profitability: 'all' | 'profitable' | 'unprofitable';
  sortBy: 'name' | 'margin' | 'profit' | 'revenue';
  sortDirection: 'asc' | 'desc';
}

export interface ProfitabilityState {
  activeTab: ProfitabilityTab;
  filters: ProfitabilityFilters;
  costData: ProductCostData[];
  costSummary: CostDataSummary | null;
  shippingRates: ShippingRateTable | null;
  countryConfigs: AllCountryConfigs | null;
  phase1Data: Phase1GlobalRates | null;
  phase2Data: Phase2NameData[];
  results: ProductProfitability[];
  summary: ProfitabilitySummary | null;
  isLoading: boolean;
  error: string | null;
}

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULT_FBA_CONFIG: FBAConfig = {
  shippingPerDesi: 1.0,      // $1/desi
  warehousePercent: 0,       // Varsayılan 0
};

export const DEFAULT_FBM_FROM_TR: FBMFromTRConfig = {
  customsDutyPercent: 8.5,
  ddpFee: 2.50,
};

export const DEFAULT_FBM_FROM_LOCAL: FBMFromLocalConfig = {
  shippingPerDesi: 1.0,     // Default $1/desi (FBA ile aynı)
  warehousePercent: 3.0,
};

export const DEFAULT_COUNTRY_CONFIG: Omit<CountryProfitConfig, 'marketplace' | 'currency'> = {
  fba: DEFAULT_FBA_CONFIG,
  fbm: {
    shippingMode: 'TR',
    fromTR: DEFAULT_FBM_FROM_TR,
  },
  lastUpdated: new Date().toISOString(),
};

// US özel default (BOTH modu)
export const DEFAULT_US_CONFIG: CountryProfitConfig = {
  marketplace: 'US',
  currency: 'USD',
  fba: DEFAULT_FBA_CONFIG,
  fbm: {
    shippingMode: 'BOTH',
    fromTR: DEFAULT_FBM_FROM_TR,
    fromLocal: DEFAULT_FBM_FROM_LOCAL,
  },
  lastUpdated: new Date().toISOString(),
};
