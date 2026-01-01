/**
 * Type definitions for Profitability Analysis
 * Extracted from profitabilityAnalytics.ts for better organization
 */

// ============================================
// PRODUCT PROFIT ANALYSIS (NAME based)
// ============================================
export interface ProductProfitAnalysis {
  // Product info (NAME based)
  name: string;
  asin: string;
  parent: string;
  category: string;
  skus: string[];
  fulfillment: 'FBA' | 'FBM' | 'Mixed';

  // Sales metrics
  totalRevenue: number;
  totalOrders: number;
  totalQuantity: number;
  refundedQuantity: number;
  replacementCount: number;  // Replacement order count
  mscfCount: number;         // MSCF count
  avgSalePrice: number;

  // Fulfillment breakdown
  fbaRevenue: number;
  fbmRevenue: number;
  fbaQuantity: number;
  fbmQuantity: number;

  // Amazon Fees (actual from transactions)
  sellingFees: number;
  fbaFees: number;
  refundLoss: number;
  vat: number;
  totalAmazonFees: number;

  // Calculated costs (from config)
  productCost: number;
  totalProductCost: number;
  shippingCost: number;
  customsDuty: number;
  ddpFee: number;
  warehouseCost: number;
  othersCost: number;
  gstCost: number;

  // Global costs (applied from percentages)
  advertisingCost: number;
  fbaCost: number;
  fbmCost: number;

  // Profitability
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  roi: number;

  // Percentages
  sellingFeePercent: number;
  fbaFeePercent: number;
  refundLossPercent: number;
  vatPercent: number;
  productCostPercent: number;
  shippingCostPercent: number;
  advertisingPercent: number;
  fbaCostPercent: number;
  fbmCostPercent: number;
  othersCostPercent: number;
  gstCostPercent: number;

  // Flags
  hasCostData: boolean;
  hasSizeData: boolean;
  desi: number | null;
}

// ============================================
// CATEGORY PROFIT ANALYSIS
// ============================================
export interface CategoryProfitAnalysis {
  category: string;
  parents: string[];  // Parents in this category
  fulfillment: 'FBA' | 'FBM' | 'Mixed';

  // Aggregated metrics
  totalParents: number;   // Parent count
  totalProducts: number;  // NAME count
  totalRevenue: number;
  totalOrders: number;
  totalQuantity: number;
  refundedQuantity: number;
  replacementCount: number;  // Replacement order count
  mscfCount: number;         // MSCF count
  avgSalePrice: number;

  // Fulfillment breakdown
  fbaRevenue: number;
  fbmRevenue: number;
  fbaQuantity: number;
  fbmQuantity: number;

  // Amazon Fees
  sellingFees: number;
  fbaFees: number;
  refundLoss: number;
  vat: number;
  totalAmazonFees: number;

  // Costs
  productCost: number;       // Avg unit cost
  totalProductCost: number;
  shippingCost: number;
  customsDuty: number;
  ddpFee: number;
  warehouseCost: number;
  othersCost: number;
  gstCost: number;

  // Global costs
  advertisingCost: number;
  fbaCost: number;
  fbmCost: number;

  // Profitability
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  roi: number;

  // Percentages
  sellingFeePercent: number;
  fbaFeePercent: number;
  refundLossPercent: number;
  vatPercent: number;
  productCostPercent: number;
  shippingCostPercent: number;
  advertisingPercent: number;
  fbaCostPercent: number;
  fbmCostPercent: number;
  othersCostPercent: number;
  gstCostPercent: number;

  // Flags
  hasCostData: boolean;
  hasSizeData: boolean;

  // Top products
  topProducts: Array<{
    name: string;
    revenue: number;
    netProfit: number;
    profitMargin: number;
  }>;
}

// ============================================
// PARENT PROFIT ANALYSIS
// ============================================
export interface ParentProfitAnalysis {
  parent: string;
  category: string;
  names: string[];  // NAMEs under this parent
  fulfillment: 'FBA' | 'FBM' | 'Mixed';

  // Aggregated metrics
  totalProducts: number;  // NAME count
  totalRevenue: number;
  totalOrders: number;
  totalQuantity: number;
  refundedQuantity: number;
  replacementCount: number;  // Replacement order count
  mscfCount: number;         // MSCF count
  avgSalePrice: number;

  // Fulfillment breakdown
  fbaRevenue: number;
  fbmRevenue: number;
  fbaQuantity: number;
  fbmQuantity: number;

  // Amazon Fees
  sellingFees: number;
  fbaFees: number;
  refundLoss: number;
  vat: number;
  totalAmazonFees: number;

  // Costs
  productCost: number;
  totalProductCost: number;
  shippingCost: number;
  customsDuty: number;
  ddpFee: number;
  warehouseCost: number;
  othersCost: number;
  gstCost: number;

  // Global costs
  advertisingCost: number;
  fbaCost: number;
  fbmCost: number;

  // Profitability
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  roi: number;

  // Percentages
  sellingFeePercent: number;
  fbaFeePercent: number;
  refundLossPercent: number;
  vatPercent: number;
  productCostPercent: number;
  shippingCostPercent: number;
  advertisingPercent: number;
  fbaCostPercent: number;
  fbmCostPercent: number;
  othersCostPercent: number;
  gstCostPercent: number;

  // Flags
  hasCostData: boolean;
  hasSizeData: boolean;
}

// ============================================
// SKU PROFIT ANALYSIS (most granular level)
// ============================================
export interface SKUProfitAnalysis {
  sku: string;
  name: string;
  parent: string;
  category: string;
  marketplace?: string;  // Marketplace code (US, UK, DE, etc.) - for All Marketplaces breakdown
  fulfillment: 'FBA' | 'FBM' | 'Mixed';

  // Sales metrics
  totalRevenue: number;
  totalOrders: number;
  totalQuantity: number;
  refundedQuantity: number;
  replacementCount: number;  // Orders with productSales=0 and total=0 (replacement orders)
  mscfCount: number;         // Orders with productSales=0 and total<0 (MSCF)
  avgSalePrice: number;

  // Amazon Fees (actual from transactions)
  sellingFees: number;
  fbaFees: number;
  refundLoss: number;
  vat: number;                // VAT from transactions (EU marketplaces)
  totalAmazonFees: number;

  // Calculated costs (from config)
  productCost: number;
  totalProductCost: number;
  shippingCost: number;
  customsDuty: number;
  ddpFee: number;
  warehouseCost: number;
  othersCost: number;
  gstCost: number;

  // Global costs (applied from percentages)
  advertisingCost: number;
  fbaCost: number;
  fbmCost: number;

  // Profitability
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  roi: number;

  // Percentages
  sellingFeePercent: number;
  fbaFeePercent: number;
  refundLossPercent: number;
  vatPercent: number;
  productCostPercent: number;
  shippingCostPercent: number;
  advertisingPercent: number;
  fbaCostPercent: number;
  fbmCostPercent: number;
  othersCostPercent: number;
  gstCostPercent: number;

  // Flags
  hasCostData: boolean;
  hasSizeData: boolean;
  desi: number | null;
}

// ============================================
// SUMMARY STATS
// ============================================
export interface ProfitabilitySummaryStats {
  // Revenue
  totalRevenue: number;
  totalOrders: number;
  totalQuantity: number;

  // Amazon Fees
  totalSellingFees: number;
  totalFbaFees: number;
  totalRefundLoss: number;
  totalAmazonFees: number;

  // Costs
  totalProductCost: number;
  totalShippingCost: number;
  totalCustomsDuty: number;
  totalCosts: number;

  // Profit
  grossProfit: number;
  netProfit: number;
  profitMargin: number;

  // Products
  totalProducts: number;
  profitableProducts: number;
  unprofitableProducts: number;
  unknownProducts: number; // No cost data
}

// ============================================
// GLOBAL COST PERCENTAGES
// ============================================
export interface GlobalCostPercentages {
  advertisingPercent: number;  // Ads % = Advertising cost / Total sales
  fbaCostPercent: number;      // FBA Cost % = FBA expenses / FBA sales
  fbmCostPercent: number;      // FBM Cost % = FBM expenses / FBM sales
  refundRecoveryRate: number;  // Refund recovery rate (0-1), e.g., 0.30 = 30% recovered
}

// ============================================
// PRICING CALCULATOR EXPORT FORMAT
// ============================================

/**
 * Category expense data for Pricing Calculator
 * Contains all percentages needed for price calculation
 */
export interface PricingCategoryExpense {
  category: string;
  marketplace: string;           // US, UK, DE, etc.
  fulfillmentType: 'FBA' | 'FBM' | 'FBM-TR' | 'FBM-US' | 'Mixed';  // US has FBM-TR (from Turkey) and FBM-US

  // Sample info
  sampleSize: number;            // Number of orders analyzed
  totalRevenue: number;          // Total revenue for this category
  totalQuantity: number;         // Total units sold
  periodStart: string;           // Analysis period start (ISO date)
  periodEnd: string;             // Analysis period end (ISO date)

  // Amazon Fee Percentages (actual from transactions)
  sellingFeePercent: number;     // Referral/commission fee %
  fbaFeePercent: number;         // FBA fulfillment fee %
  refundLossPercent: number;     // Refund loss after recovery %
  vatPercent: number;            // VAT collected by Amazon %

  // Cost Percentages
  productCostPercent: number;    // COGS as % of revenue
  shippingCostPercent: number;   // Shipping/logistics %
  customsDutyPercent: number;    // Import duty %
  ddpFeePercent: number;         // DDP fee %
  warehouseCostPercent: number;  // Warehouse/storage %
  gstCostPercent: number;        // GST/local tax %

  // Global Cost Percentages
  advertisingPercent: number;    // Ads spend %
  fbaCostPercent: number;        // FBA overhead %
  fbmCostPercent: number;        // FBM overhead %

  // Profitability (for reference/default)
  avgProfitMargin: number;       // Average profit margin %
  avgROI: number;                // Average ROI %
  avgSalePrice: number;          // Average selling price
  avgProductCost: number;        // Average unit cost

  // Fulfillment breakdown
  fbaPercent: number;            // % of sales via FBA
  fbmPercent: number;            // % of sales via FBM
}

/**
 * Complete export package for Pricing Calculator
 */
export interface PricingCalculatorExport {
  version: number;
  exportedAt: string;
  sourceApp: 'amazon-analyzer';

  // Metadata
  marketplace: string;           // Source marketplace (US, UK, etc.)
  dateRange: {
    start: string;
    end: string;
  };

  // Global settings that apply to all categories
  globalSettings: {
    advertisingPercent: number;
    fbaCostPercent: number;
    fbmCostPercent: number;
    refundRecoveryRate: number;
  };

  // Category-level expense data
  categories: PricingCategoryExpense[];

  // Summary stats
  summary: {
    totalCategories: number;
    totalRevenue: number;
    totalOrders: number;
    avgMargin: number;
  };
}
