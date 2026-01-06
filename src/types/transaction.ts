// Core Types for Amazon Transaction Analyzer

export type MarketplaceCode = 'US' | 'UK' | 'DE' | 'FR' | 'IT' | 'ES' | 'CA' | 'AU' | 'AE' | 'SA';

export interface TransactionData {
  id: string;
  fileName: string;
  date: Date;
  dateOnly: string;  // YYYY-MM-DD format - original date without timezone conversion for filtering
  timeOnly?: string; // HH:MM format - original time without timezone conversion
  type: string;
  categoryType: string;
  orderId: string;
  sku: string;
  description: string;
  descriptionLower: string;
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
  marketplaceCode: string; // US, UK, DE, etc.

  // Product enrichment fields (from PriceLab API)
  // NOTE: Using 'productCategory' to avoid conflict with 'categoryType' (transaction category)
  asin?: string;
  name?: string;
  parent?: string;
  productCategory?: string;
  productCost?: number | null;    // Ürün maliyeti
  productSize?: number | null;    // Desi (hacimsel ağırlık)
  productCustomShipping?: number | null;  // SKU bazlı özel kargo (USD)
  productFbmSource?: string | null;       // TR, LOCAL, BOTH
}

export interface MarketplaceConfig {
  code: MarketplaceCode;
  name: string;
  currency: string;
  currencySymbol: string;
  hasVAT: boolean;
  vatIncludedInPrice: boolean;
  refundRecoveryRate: number;
  grossSalesFormula: (sales: number, vat: number) => number;
  hasLiquidations: boolean;
  fbmShippingCategory: string;
  fbmShippingSource: 'total' | 'other';
  hasPostalZones: boolean;
}

export interface GroupData {
  count: number;
  total: number;
}

export interface PostalZone {
  count: number;
  sales: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ComparisonRange {
  current: DateRange;
  previous: DateRange;
}

export interface Analytics {
  // Core metrics
  totalOrders: number;
  totalRefunds: number;
  totalSales: number;
  totalRefundAmount: number;

  // Fulfillment breakdown
  fbaOrders: number;
  fbmOrders: number;
  fbaSales: number;
  fbmSales: number;

  // Costs and fees
  totalFees: number;
  fbaFees: number;
  sellingFees: number;
  advertisingCost: number;

  // VAT and liquidations
  totalVAT: number;
  totalLiquidations: number;

  // Calculated metrics
  grossSales: number;
  netProfit: number;
  expectedRefundLoss: number;
  actualRefundLoss: number;

  // Recovery and margins
  refundRecoveryRate: number;
  profitMargin: number;

  // Shipping (FBM)
  fbmShippingRevenue: number;

  // Additional breakdowns
  byCountry: Record<string, GroupData>;
  byZone: Record<string, PostalZone>;
}

export interface ComparisonAnalytics {
  current: Analytics;
  previous: Analytics;
  changes: {
    totalSales: { value: number; percentage: number };
    netProfit: { value: number; percentage: number };
    totalOrders: { value: number; percentage: number };
    advertisingCost: { value: number; percentage: number };
    profitMargin: { value: number; percentage: number };
  };
}
