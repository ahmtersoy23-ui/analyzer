/**
 * Phase 3: Profitability Analytics Service
 *
 * Transaction-based profitability analysis like Phase 2
 * Calculates actual profit/loss from historical transaction data
 */

import { TransactionData, MarketplaceCode } from '../../types/transaction';
import { ProductCostData, ShippingRateTable, AllCountryConfigs, ShippingCurrency } from '../../types/profitability';
import { getShippingRate, getShippingRouteForMarketplace, getUSFBMShippingRate } from './configService';
import { convertCurrency, CurrencyCode, getMarketplaceCurrency } from '../../utils/currencyExchange';

// Cost verileri için varsayılan para birimi (Excel'den gelen maliyetler USD olarak kabul edilir)
const COST_DATA_CURRENCY: CurrencyCode = 'USD';

/**
 * Shipping para birimini CurrencyCode'a dönüştür
 */
const shippingCurrencyToCurrencyCode = (sc: ShippingCurrency): CurrencyCode => {
  if (sc === 'TRY') return 'TRY';
  if (sc === 'EUR') return 'EUR';
  return 'USD';
};

// ============================================
// TYPES
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

export interface CategoryProfitAnalysis {
  category: string;
  parents: string[];  // Bu category'deki Parent'lar
  fulfillment: 'FBA' | 'FBM' | 'Mixed';

  // Aggregated metrics
  totalParents: number;   // Parent sayısı
  totalProducts: number;  // NAME sayısı
  totalRevenue: number;
  totalOrders: number;
  totalQuantity: number;
  refundedQuantity: number;
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

export interface ParentProfitAnalysis {
  parent: string;
  category: string;
  names: string[];  // Bu parent'a ait NAME'ler
  fulfillment: 'FBA' | 'FBM' | 'Mixed';

  // Aggregated metrics
  totalProducts: number;  // NAME sayısı
  totalRevenue: number;
  totalOrders: number;
  totalQuantity: number;
  refundedQuantity: number;
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
}

export interface SKUProfitAnalysis {
  sku: string;
  name: string;
  parent: string;
  category: string;
  fulfillment: 'FBA' | 'FBM' | 'Mixed';

  // Sales metrics
  totalRevenue: number;
  totalOrders: number;
  totalQuantity: number;
  refundedQuantity: number;
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
  warehouseCost: number;      // Depo+İşçilik maliyeti
  othersCost: number;         // FBA: depo+işçilik, FBM: kaynak bazlı (TR=vergi+ddp, US=depo, BOTH=ortalama)
  gstCost: number;            // Non-Amazon GST obligation (AU için - fiyat içinden hesaplanır)

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

export interface ProfitabilitySummaryStats {
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
// HELPER FUNCTIONS
// ============================================

/**
 * Get customs duty percentage based on category
 */
const getCustomsDutyPercent = (
  countryConfig: AllCountryConfigs,
  marketplace: MarketplaceCode,
  category: string | undefined
): number => {
  const config = countryConfig.configs[marketplace];
  if (!config) return 8.5; // Default

  const fromTR = config.fbm.fromTR;

  if (!category || !fromTR.categoryDuties || fromTR.categoryDuties.length === 0) {
    return fromTR.customsDutyPercent;
  }

  const normalizedCategory = category.toLowerCase().trim();
  const matchingDuty = fromTR.categoryDuties.find(cd => {
    const normalizedCdCategory = cd.category.toLowerCase().trim();
    return normalizedCategory.includes(normalizedCdCategory) ||
           normalizedCdCategory.includes(normalizedCategory);
  });

  return matchingDuty ? matchingDuty.dutyPercent : fromTR.customsDutyPercent;
};

// ============================================
// MAIN CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate profitability for each product (NAME based)
 * Aggregates SKU-level data to NAME level
 */
export const calculateProductProfitability = (
  skuAnalysis: SKUProfitAnalysis[]
): ProductProfitAnalysis[] => {
  // Group SKUs by NAME
  const nameMap = new Map<string, {
    skus: SKUProfitAnalysis[];
    name: string;
    parent: string;
    category: string;
  }>();

  skuAnalysis.forEach(sku => {
    const existing = nameMap.get(sku.name);
    if (existing) {
      existing.skus.push(sku);
    } else {
      nameMap.set(sku.name, {
        skus: [sku],
        name: sku.name,
        parent: sku.parent,
        category: sku.category,
      });
    }
  });

  // Convert to ProductProfitAnalysis by aggregating SKU values
  const results: ProductProfitAnalysis[] = [];

  nameMap.forEach(({ skus, name, parent, category }) => {
    // Determine fulfillment type for this NAME
    const hasFBA = skus.some(s => s.fulfillment === 'FBA' || s.fulfillment === 'Mixed');
    const hasFBM = skus.some(s => s.fulfillment === 'FBM' || s.fulfillment === 'Mixed');
    const fulfillment: 'FBA' | 'FBM' | 'Mixed' = hasFBA && hasFBM ? 'Mixed' : hasFBA ? 'FBA' : 'FBM';

    // Aggregate numeric values
    const totalRevenue = skus.reduce((sum, s) => sum + s.totalRevenue, 0);
    const totalOrders = skus.reduce((sum, s) => sum + s.totalOrders, 0);
    const totalQuantity = skus.reduce((sum, s) => sum + s.totalQuantity, 0);
    const refundedQuantity = skus.reduce((sum, s) => sum + s.refundedQuantity, 0);

    // FBA/FBM breakdown
    const fbaSkus = skus.filter(s => s.fulfillment === 'FBA');
    const fbmSkus = skus.filter(s => s.fulfillment === 'FBM');
    const mixedSkus = skus.filter(s => s.fulfillment === 'Mixed');

    const fbaRevenue = fbaSkus.reduce((sum, s) => sum + s.totalRevenue, 0) +
      mixedSkus.reduce((sum, s) => sum + s.totalRevenue / 2, 0);
    const fbmRevenue = fbmSkus.reduce((sum, s) => sum + s.totalRevenue, 0) +
      mixedSkus.reduce((sum, s) => sum + s.totalRevenue / 2, 0);
    const fbaQuantity = fbaSkus.reduce((sum, s) => sum + s.totalQuantity, 0) +
      mixedSkus.reduce((sum, s) => sum + s.totalQuantity / 2, 0);
    const fbmQuantity = fbmSkus.reduce((sum, s) => sum + s.totalQuantity, 0) +
      mixedSkus.reduce((sum, s) => sum + s.totalQuantity / 2, 0);

    // Amazon Fees
    const sellingFees = skus.reduce((sum, s) => sum + s.sellingFees, 0);
    const fbaFees = skus.reduce((sum, s) => sum + s.fbaFees, 0);
    const refundLoss = skus.reduce((sum, s) => sum + s.refundLoss, 0);
    const vat = skus.reduce((sum, s) => sum + s.vat, 0);
    const totalAmazonFees = skus.reduce((sum, s) => sum + s.totalAmazonFees, 0);

    // Costs
    const totalProductCost = skus.reduce((sum, s) => sum + s.totalProductCost, 0);
    const shippingCost = skus.reduce((sum, s) => sum + s.shippingCost, 0);
    const customsDuty = skus.reduce((sum, s) => sum + s.customsDuty, 0);
    const ddpFee = skus.reduce((sum, s) => sum + s.ddpFee, 0);
    const warehouseCost = skus.reduce((sum, s) => sum + s.warehouseCost, 0);
    const othersCost = skus.reduce((sum, s) => sum + s.othersCost, 0);
    const gstCost = skus.reduce((sum, s) => sum + s.gstCost, 0);

    // Global costs
    const advertisingCost = skus.reduce((sum, s) => sum + s.advertisingCost, 0);
    const fbaCost = skus.reduce((sum, s) => sum + s.fbaCost, 0);
    const fbmCost = skus.reduce((sum, s) => sum + s.fbmCost, 0);

    // Profitability
    const grossProfit = skus.reduce((sum, s) => sum + s.grossProfit, 0);
    const netProfit = skus.reduce((sum, s) => sum + s.netProfit, 0);

    // Flags - true only if ALL SKUs have data
    const hasCostData = skus.every(s => s.hasCostData);
    const hasSizeData = skus.every(s => s.hasSizeData);

    // Use first SKU's desi (they should be the same for same product)
    const desi = skus[0]?.desi ?? null;
    const productCost = skus[0]?.productCost ?? 0;

    // Calculate percentages from aggregated values
    const profitMargin = totalRevenue > 0 && hasCostData ? (netProfit / totalRevenue) * 100 : 0;
    const totalCosts = totalProductCost + shippingCost + customsDuty + ddpFee + advertisingCost + fbaCost + fbmCost + warehouseCost + gstCost;
    const roi = totalCosts > 0 && hasCostData ? (netProfit / totalCosts) * 100 : 0;

    const sellingFeePercent = totalRevenue > 0 ? (sellingFees / totalRevenue) * 100 : 0;
    const fbaFeePercent = totalRevenue > 0 ? (fbaFees / totalRevenue) * 100 : 0;
    const refundLossPercent = totalRevenue > 0 ? (refundLoss / totalRevenue) * 100 : 0;
    const vatPercent = totalRevenue > 0 ? (vat / totalRevenue) * 100 : 0;
    const productCostPercent = totalRevenue > 0 ? (totalProductCost / totalRevenue) * 100 : 0;
    const shippingCostPercent = totalRevenue > 0 ? (shippingCost / totalRevenue) * 100 : 0;
    const advertisingPercent = totalRevenue > 0 ? (advertisingCost / totalRevenue) * 100 : 0;
    const fbaCostPercent = totalRevenue > 0 ? (fbaCost / totalRevenue) * 100 : 0;
    const fbmCostPercent = totalRevenue > 0 ? (fbmCost / totalRevenue) * 100 : 0;
    const othersCostPercent = totalRevenue > 0 ? (othersCost / totalRevenue) * 100 : 0;
    const gstCostPercent = totalRevenue > 0 ? (gstCost / totalRevenue) * 100 : 0;

    results.push({
      name,
      asin: skus[0]?.parent || '',
      parent,
      category,
      skus: skus.map(s => s.sku),
      fulfillment,

      totalRevenue,
      totalOrders,
      totalQuantity,
      refundedQuantity,
      avgSalePrice: totalQuantity > 0 ? totalRevenue / totalQuantity : 0,

      fbaRevenue,
      fbmRevenue,
      fbaQuantity,
      fbmQuantity,

      sellingFees,
      fbaFees,
      refundLoss,
      vat,
      totalAmazonFees,

      productCost,
      totalProductCost,
      shippingCost,
      customsDuty,
      ddpFee,
      warehouseCost,
      othersCost,
      gstCost,

      advertisingCost,
      fbaCost,
      fbmCost,

      grossProfit,
      netProfit,
      profitMargin,
      roi,

      sellingFeePercent,
      fbaFeePercent,
      refundLossPercent,
      vatPercent,
      productCostPercent,
      shippingCostPercent,
      advertisingPercent,
      fbaCostPercent,
      fbmCostPercent,
      othersCostPercent,
      gstCostPercent,

      hasCostData,
      hasSizeData,
      desi,
    });
  });

  return results.sort((a, b) => b.totalRevenue - a.totalRevenue);
};

/**
 * Calculate profitability by category
 * Aggregates Parent-level data to Category level
 */
export const calculateCategoryProfitability = (
  parents: ParentProfitAnalysis[],
  products: ProductProfitAnalysis[]  // For top products
): CategoryProfitAnalysis[] => {
  // Group Parents by Category
  const categoryMap = new Map<string, {
    parents: ParentProfitAnalysis[];
    category: string;
  }>();

  parents.forEach(parent => {
    const existing = categoryMap.get(parent.category);
    if (existing) {
      existing.parents.push(parent);
    } else {
      categoryMap.set(parent.category, {
        parents: [parent],
        category: parent.category,
      });
    }
  });

  // Convert to CategoryProfitAnalysis by aggregating Parent values
  const results: CategoryProfitAnalysis[] = [];

  categoryMap.forEach(({ parents: categoryParents, category }) => {
    // Determine fulfillment type for this Category
    const hasFBA = categoryParents.some(p => p.fulfillment === 'FBA' || p.fulfillment === 'Mixed');
    const hasFBM = categoryParents.some(p => p.fulfillment === 'FBM' || p.fulfillment === 'Mixed');
    const fulfillment: 'FBA' | 'FBM' | 'Mixed' = hasFBA && hasFBM ? 'Mixed' : hasFBA ? 'FBA' : 'FBM';

    // Aggregate numeric values
    const totalRevenue = categoryParents.reduce((sum, p) => sum + p.totalRevenue, 0);
    const totalOrders = categoryParents.reduce((sum, p) => sum + p.totalOrders, 0);
    const totalQuantity = categoryParents.reduce((sum, p) => sum + p.totalQuantity, 0);
    const refundedQuantity = categoryParents.reduce((sum, p) => sum + p.refundedQuantity, 0);
    const totalProducts = categoryParents.reduce((sum, p) => sum + p.totalProducts, 0);

    // FBA/FBM breakdown
    const fbaRevenue = categoryParents.reduce((sum, p) => sum + p.fbaRevenue, 0);
    const fbmRevenue = categoryParents.reduce((sum, p) => sum + p.fbmRevenue, 0);
    const fbaQuantity = categoryParents.reduce((sum, p) => sum + p.fbaQuantity, 0);
    const fbmQuantity = categoryParents.reduce((sum, p) => sum + p.fbmQuantity, 0);

    // Amazon Fees
    const sellingFees = categoryParents.reduce((sum, p) => sum + p.sellingFees, 0);
    const fbaFees = categoryParents.reduce((sum, p) => sum + p.fbaFees, 0);
    const refundLoss = categoryParents.reduce((sum, p) => sum + p.refundLoss, 0);
    const vat = categoryParents.reduce((sum, p) => sum + p.vat, 0);
    const totalAmazonFees = categoryParents.reduce((sum, p) => sum + p.totalAmazonFees, 0);

    // Costs
    const totalProductCost = categoryParents.reduce((sum, p) => sum + p.totalProductCost, 0);
    const shippingCost = categoryParents.reduce((sum, p) => sum + p.shippingCost, 0);
    const customsDuty = categoryParents.reduce((sum, p) => sum + p.customsDuty, 0);
    const ddpFee = categoryParents.reduce((sum, p) => sum + p.ddpFee, 0);
    const warehouseCost = categoryParents.reduce((sum, p) => sum + p.warehouseCost, 0);
    const othersCost = categoryParents.reduce((sum, p) => sum + p.othersCost, 0);
    const gstCost = categoryParents.reduce((sum, p) => sum + p.gstCost, 0);

    // Global costs
    const advertisingCost = categoryParents.reduce((sum, p) => sum + p.advertisingCost, 0);
    const fbaCost = categoryParents.reduce((sum, p) => sum + p.fbaCost, 0);
    const fbmCost = categoryParents.reduce((sum, p) => sum + p.fbmCost, 0);

    // Profitability
    const grossProfit = categoryParents.reduce((sum, p) => sum + p.grossProfit, 0);
    const netProfit = categoryParents.reduce((sum, p) => sum + p.netProfit, 0);

    // Flags - true only if ALL Parents have data
    const hasCostData = categoryParents.every(p => p.hasCostData);
    const hasSizeData = categoryParents.every(p => p.hasSizeData);

    // Calculate weighted average unit cost
    const productCost = totalQuantity > 0 ? totalProductCost / totalQuantity : 0;

    // Calculate percentages from aggregated values
    const profitMargin = totalRevenue > 0 && hasCostData ? (netProfit / totalRevenue) * 100 : 0;
    const totalCosts = totalProductCost + shippingCost + customsDuty + ddpFee + advertisingCost + fbaCost + fbmCost + warehouseCost + gstCost;
    const roi = totalCosts > 0 && hasCostData ? (netProfit / totalCosts) * 100 : 0;

    const sellingFeePercent = totalRevenue > 0 ? (sellingFees / totalRevenue) * 100 : 0;
    const fbaFeePercent = totalRevenue > 0 ? (fbaFees / totalRevenue) * 100 : 0;
    const refundLossPercent = totalRevenue > 0 ? (refundLoss / totalRevenue) * 100 : 0;
    const vatPercent = totalRevenue > 0 ? (vat / totalRevenue) * 100 : 0;
    const productCostPercent = totalRevenue > 0 ? (totalProductCost / totalRevenue) * 100 : 0;
    const shippingCostPercent = totalRevenue > 0 ? (shippingCost / totalRevenue) * 100 : 0;
    const advertisingPercent = totalRevenue > 0 ? (advertisingCost / totalRevenue) * 100 : 0;
    const fbaCostPercent = totalRevenue > 0 ? (fbaCost / totalRevenue) * 100 : 0;
    const fbmCostPercent = totalRevenue > 0 ? (fbmCost / totalRevenue) * 100 : 0;
    const othersCostPercent = totalRevenue > 0 ? (othersCost / totalRevenue) * 100 : 0;
    const gstCostPercent = totalRevenue > 0 ? (gstCost / totalRevenue) * 100 : 0;

    // Top 5 products by revenue (from NAME level)
    const categoryProducts = products.filter(p => p.category === category);
    const topProducts = categoryProducts
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        revenue: p.totalRevenue,
        netProfit: p.netProfit,
        profitMargin: p.profitMargin,
      }));

    results.push({
      category,
      parents: categoryParents.map(p => p.parent),
      fulfillment,

      totalParents: categoryParents.length,
      totalProducts,
      totalRevenue,
      totalOrders,
      totalQuantity,
      refundedQuantity,
      avgSalePrice: totalQuantity > 0 ? totalRevenue / totalQuantity : 0,

      fbaRevenue,
      fbmRevenue,
      fbaQuantity,
      fbmQuantity,

      sellingFees,
      fbaFees,
      refundLoss,
      vat,
      totalAmazonFees,

      productCost,
      totalProductCost,
      shippingCost,
      customsDuty,
      ddpFee,
      warehouseCost,
      othersCost,
      gstCost,

      advertisingCost,
      fbaCost,
      fbmCost,

      grossProfit,
      netProfit,
      profitMargin,
      roi,

      sellingFeePercent,
      fbaFeePercent,
      refundLossPercent,
      vatPercent,
      productCostPercent,
      shippingCostPercent,
      advertisingPercent,
      fbaCostPercent,
      fbmCostPercent,
      othersCostPercent,
      gstCostPercent,

      hasCostData,
      hasSizeData,

      topProducts,
    });
  });

  return results.sort((a, b) => b.totalRevenue - a.totalRevenue);
};

/**
 * Global cost percentages calculated from all transactions
 */
export interface GlobalCostPercentages {
  advertisingPercent: number;  // Ads % = Advertising cost / Total sales
  fbaCostPercent: number;      // FBA Cost % = FBA expenses / FBA sales
  fbmCostPercent: number;      // FBM Cost % = FBM expenses / FBM sales
  refundRecoveryRate: number;  // İade kurtarma oranı (0-1), örn: 0.30 = %30 kurtarılır
}

/**
 * Calculate profitability by SKU (lowest level - most granular)
 * SKU level gives clear FBA/FBM distinction
 */
export const calculateSKUProfitability = (
  transactions: TransactionData[],
  costData: ProductCostData[],
  shippingRates: ShippingRateTable | null,
  countryConfigs: AllCountryConfigs | null,
  marketplace: MarketplaceCode | null,
  globalCostPercentages?: GlobalCostPercentages
): SKUProfitAnalysis[] => {
  // Create cost lookup by SKU
  const costBySku = new Map<string, ProductCostData>();
  costData.forEach(c => costBySku.set(c.sku, c));

  // Group transactions by SKU
  const skuMap = new Map<string, {
    sku: string;
    name: string;
    parent: string;
    category: string;
    fulfillment: Set<string>;
    revenue: number;
    orders: number;
    quantity: number;
    refundedQuantity: number;  // İade edilen adet
    sellingFees: number;
    fbaFees: number;
    vat: number;              // VAT from transactions (EU marketplaces)
    totalRefund: number;  // Toplam iade tutarı (henüz recovery uygulanmamış)
  }>();

  transactions.forEach(t => {
    if (!t.sku) return;

    // Filter by marketplace if specified
    if (marketplace && t.marketplaceCode !== marketplace) return;

    const existing = skuMap.get(t.sku);

    // Determine category using same logic as productAnalytics
    let category = t.productCategory;
    if (!category) {
      const skuUpper = t.sku.toUpperCase();
      category = (skuUpper.startsWith('AMZN.GR') || skuUpper.startsWith('AMZN,GR'))
        ? 'Grade and Resell'
        : 'Uncategorized';
    }

    // Only process Order and Refund transactions
    if (t.categoryType !== 'Order' && t.categoryType !== 'Refund') return;

    if (!existing) {
      skuMap.set(t.sku, {
        sku: t.sku,
        name: t.name || t.sku,
        parent: t.parent || t.asin || 'Unknown',
        category,
        fulfillment: new Set([t.fulfillment || 'Unknown']),
        revenue: t.categoryType === 'Order' ? (t.productSales || 0) : 0,
        orders: t.categoryType === 'Order' ? 1 : 0,
        quantity: t.categoryType === 'Order' ? (t.quantity || 0) : 0,
        refundedQuantity: t.categoryType === 'Refund' ? Math.abs(t.quantity || 0) : 0,
        sellingFees: t.categoryType === 'Order' ? Math.abs(t.sellingFees || 0) : 0,
        fbaFees: t.categoryType === 'Order' ? Math.abs(t.fbaFees || 0) : 0,
        vat: t.categoryType === 'Order' ? Math.abs(t.vat || 0) : 0,
        totalRefund: t.categoryType === 'Refund' ? Math.abs(t.total || 0) : 0,
      });
    } else {
      if (t.fulfillment) existing.fulfillment.add(t.fulfillment);

      if (t.categoryType === 'Order') {
        existing.revenue += t.productSales || 0;
        existing.orders++;
        existing.quantity += t.quantity || 0;
        existing.sellingFees += Math.abs(t.sellingFees || 0);
        existing.fbaFees += Math.abs(t.fbaFees || 0);
        existing.vat += Math.abs(t.vat || 0);
      } else if (t.categoryType === 'Refund') {
        existing.totalRefund += Math.abs(t.total || 0);
        existing.refundedQuantity += Math.abs(t.quantity || 0);
      }
    }
  });

  // Convert to SKUProfitAnalysis
  const results: SKUProfitAnalysis[] = [];

  // Hedef para birimi belirleme
  const targetCurrency: CurrencyCode = marketplace ? getMarketplaceCurrency(marketplace) : 'USD';

  skuMap.forEach((data, sku) => {
    const costInfo = costBySku.get(sku);
    const unitCostRaw = costInfo?.cost ?? null;
    // Cost verisini hedef para birimine dönüştür (Excel'den gelen maliyetler USD olarak kabul edilir)
    const unitCost = unitCostRaw !== null ? convertCurrency(unitCostRaw, COST_DATA_CURRENCY, targetCurrency) : null;
    const desi = costInfo?.size ?? null;
    const customShippingRaw = costInfo?.customShipping ?? null; // SKU bazlı özel kargo (USD)
    // Custom shipping'i de dönüştür
    const customShipping = customShippingRaw !== null ? convertCurrency(customShippingRaw, COST_DATA_CURRENCY, targetCurrency) : null;
    const skuFbmSource = costInfo?.fbmSource ?? null; // SKU bazlı FBM kaynağı
    const hasCostData = unitCostRaw !== null;
    let hasSizeData = desi !== null || customShippingRaw !== null; // customShipping varsa desi gerekmez

    // Determine fulfillment type
    const fulfillmentTypes = Array.from(data.fulfillment);
    let fulfillment: 'FBA' | 'FBM' | 'Mixed' = 'FBM';
    if (fulfillmentTypes.length > 1 && fulfillmentTypes.includes('FBA') && (fulfillmentTypes.includes('FBM') || fulfillmentTypes.includes('MFN'))) {
      fulfillment = 'Mixed';
    } else if (fulfillmentTypes.includes('FBA') || fulfillmentTypes.includes('AFN')) {
      fulfillment = 'FBA';
    }

    // Calculate shipping cost
    let shippingCost = 0;
    let customsDuty = 0;
    let ddpFee = 0;
    let shippingRateFound = true; // Track if shipping rate was found

    // Helper: Calculate FBM shipping for a given mode
    // Note: 'US' from fbmSource maps to 'LOCAL' in FBMShippingMode
    // Para birimi dönüşümü: Shipping rate'ler kendi para birimlerinden, DDP USD'den hedef para birimine dönüştürülür
    const calculateFBMShipping = (
      qty: number,
      mode: 'TR' | 'US' | 'LOCAL' | 'BOTH',
      config: any
    ): { shipping: number; customs: number; ddp: number; found: boolean } => {
      // Normalize 'US' to 'LOCAL' for consistency with FBMShippingMode type
      const normalizedMode = mode === 'US' ? 'LOCAL' : mode;

      // DDP fee USD olarak varsayılıyor - hedef para birimine dönüştür
      const ddpFeeConverted = convertCurrency(config.fbm.fromTR.ddpFee || 0, COST_DATA_CURRENCY, targetCurrency);
      // Gemi bedeli USD olarak varsayılıyor
      const fbaShippingPerDesiConverted = convertCurrency(config?.fba.shippingPerDesi || 0, COST_DATA_CURRENCY, targetCurrency);

      // Eğer customShipping varsa, US içi kargo ücreti olarak kullan (zaten dönüştürüldü)
      // LOCAL modunda: desi * gemi bedeli + customShipping
      // BOTH modunda: ((desi * gemi + customShipping) + TR kargo) / 2
      if (customShipping !== null && marketplace === 'US') {
        const toWarehouseCost = desi ? desi * fbaShippingPerDesiConverted : 0; // Gemi bedeli
        const localTotal = toWarehouseCost + customShipping; // LOCAL toplam (customShipping zaten dönüştürüldü)

        if (normalizedMode === 'LOCAL') {
          // LOCAL = gemi bedeli + US içi kargo (customShipping)
          return {
            shipping: localTotal * qty,
            customs: 0,
            ddp: 0,
            found: true,
          };
        } else if (normalizedMode === 'BOTH') {
          // BOTH = (LOCAL + TR kargo) / 2
          // TR kargo için rate table'dan al ve dönüştür
          const trResult = shippingRates ? getShippingRate(shippingRates, 'US-TR', desi || 1) : { rate: 0, found: false, currency: 'USD' as ShippingCurrency };
          const trRateConverted = trResult.found ? convertCurrency(trResult.rate, shippingCurrencyToCurrencyCode(trResult.currency), targetCurrency) : 0;
          const avgShipping = (localTotal + trRateConverted) / 2;

          const dutyPercent = getCustomsDutyPercent(countryConfigs!, marketplace!, data.category);
          const avgPrice = data.quantity > 0 ? data.revenue / data.quantity : 0;
          return {
            shipping: avgShipping * qty,
            customs: avgPrice * (dutyPercent / 100) * qty * 0.5, // Yarısı TR
            ddp: ddpFeeConverted * qty * 0.5,
            found: true,
          };
        } else {
          // TR modu - customShipping kullanılmaz, TR kargo tablosundan
          const trResult = shippingRates ? getShippingRate(shippingRates, 'US-TR', desi || 1) : { rate: 0, found: false, currency: 'USD' as ShippingCurrency };
          if (!trResult.found) {
            return { shipping: 0, customs: 0, ddp: 0, found: false };
          }
          const trRateConverted = convertCurrency(trResult.rate, shippingCurrencyToCurrencyCode(trResult.currency), targetCurrency);
          const dutyPercent = getCustomsDutyPercent(countryConfigs!, marketplace!, data.category);
          const avgPrice = data.quantity > 0 ? data.revenue / data.quantity : 0;
          return {
            shipping: trRateConverted * qty,
            customs: avgPrice * (dutyPercent / 100) * qty,
            ddp: ddpFeeConverted * qty,
            found: true,
          };
        }
      }

      // Diğer marketplace'ler için customShipping varsa direkt kullan (zaten dönüştürüldü)
      if (customShipping !== null) {
        const shipping = customShipping * qty;
        const dutyPercent = getCustomsDutyPercent(countryConfigs!, marketplace!, data.category);
        const avgPrice = data.quantity > 0 ? data.revenue / data.quantity : 0;
        return {
          shipping,
          customs: avgPrice * (dutyPercent / 100) * qty,
          ddp: ddpFeeConverted * qty,
          found: true,
        };
      }

      // Normal desi bazlı hesaplama
      if (!desi) return { shipping: 0, customs: 0, ddp: 0, found: false };

      if (marketplace === 'US') {
        // FBA shipping per desi (gemi bedeli) - LOCAL modunda TR'den depoya gönderim için kullanılır
        const shippingResult = getUSFBMShippingRate(shippingRates!, desi, normalizedMode, config?.fba.shippingPerDesi || 0);
        if (!shippingResult.found) {
          return { shipping: 0, customs: 0, ddp: 0, found: false };
        }
        // Shipping rate'i dönüştür
        const shippingRateConverted = convertCurrency(shippingResult.rate, shippingCurrencyToCurrencyCode(shippingResult.currency), targetCurrency);
        const shipping = shippingRateConverted * qty;
        if (normalizedMode === 'TR' || normalizedMode === 'BOTH') {
          const dutyPercent = getCustomsDutyPercent(countryConfigs!, marketplace!, data.category);
          const avgPrice = data.quantity > 0 ? data.revenue / data.quantity : 0;
          const multiplier = normalizedMode === 'BOTH' ? 0.5 : 1;
          return {
            shipping,
            customs: avgPrice * (dutyPercent / 100) * qty * multiplier,
            ddp: ddpFeeConverted * qty * multiplier,
            found: true,
          };
        }
        return { shipping, customs: 0, ddp: 0, found: true };
      } else {
        const route = getShippingRouteForMarketplace(marketplace!);
        const shippingResult = getShippingRate(shippingRates!, route, desi);
        if (!shippingResult.found) {
          return { shipping: 0, customs: 0, ddp: 0, found: false };
        }
        // Shipping rate'i dönüştür
        const shippingRateConverted = convertCurrency(shippingResult.rate, shippingCurrencyToCurrencyCode(shippingResult.currency), targetCurrency);
        const dutyPercent = getCustomsDutyPercent(countryConfigs!, marketplace!, data.category);
        const avgPrice = data.quantity > 0 ? data.revenue / data.quantity : 0;
        return {
          shipping: shippingRateConverted * qty,
          customs: avgPrice * (dutyPercent / 100) * qty,
          ddp: ddpFeeConverted * qty,
          found: true,
        };
      }
    };

    if (shippingRates && countryConfigs && marketplace) {
      const config = countryConfigs.configs[marketplace];

      // shippingPerDesi USD olarak varsayılıyor, hedef para birimine dönüştür
      const shippingPerDesiConverted = convertCurrency(config?.fba.shippingPerDesi || 0, COST_DATA_CURRENCY, targetCurrency);

      if (fulfillment === 'FBA') {
        // FBA shipping (gemi bedeli) - uses config, not rate table
        if (desi) {
          shippingCost = data.quantity * desi * shippingPerDesiConverted;
        }
      } else if (fulfillment === 'FBM') {
        // FBM shipping + customs
        if (config) {
          // SKU bazlı fbmSource varsa onu kullan, yoksa global config'den al
          const effectiveMode = skuFbmSource || config.fbm.shippingMode;
          const result = calculateFBMShipping(data.quantity, effectiveMode, config);
          shippingCost = result.shipping;
          customsDuty = result.customs;
          ddpFee = result.ddp;
          shippingRateFound = result.found;
        }
      } else {
        // Mixed - estimate 50/50 FBA/FBM
        const fbaQty = data.quantity / 2;
        const fbmQty = data.quantity / 2;

        // FBA portion
        if (desi) {
          shippingCost = fbaQty * desi * shippingPerDesiConverted;
        }

        // FBM portion
        if (config) {
          const effectiveMode = skuFbmSource || config.fbm.shippingMode;
          const result = calculateFBMShipping(fbmQty, effectiveMode, config);
          shippingCost += result.shipping;
          customsDuty = result.customs;
          ddpFee = result.ddp;
          shippingRateFound = result.found;
        }
      }
    }

    // If FBM/Mixed and shipping rate not found, mark as missing size data
    if ((fulfillment === 'FBM' || fulfillment === 'Mixed') && !shippingRateFound) {
      hasSizeData = false;
    }

    // Calculate costs
    const totalProductCost = unitCost !== null ? unitCost * data.quantity : 0;

    // Refund Loss = Total Refund × (1 - Recovery Rate)
    // Recovery rate comes from global config, default 0.30 (30% recovered)
    const recoveryRate = globalCostPercentages?.refundRecoveryRate ?? 0.30;
    const refundLoss = data.totalRefund * (1 - recoveryRate);

    // VAT from transactions (EU marketplaces collect VAT which is an Amazon expense)
    const vat = data.vat;

    const totalAmazonFees = data.sellingFees + data.fbaFees + refundLoss + vat;
    const grossProfit = data.revenue - totalAmazonFees;

    // Apply global cost percentages
    // Ads applies to all SKUs
    const adsPercent = globalCostPercentages?.advertisingPercent || 0;
    const advertisingCost = data.revenue * (adsPercent / 100);

    // FBA Cost only applies to FBA/Mixed SKUs
    const fbaCostPercent = globalCostPercentages?.fbaCostPercent || 0;
    const fbaCost = (fulfillment === 'FBA' || fulfillment === 'Mixed')
      ? data.revenue * (fbaCostPercent / 100)
      : 0;

    // FBM Cost only applies to FBM/Mixed SKUs
    const fbmCostPercent = globalCostPercentages?.fbmCostPercent || 0;
    const fbmCost = (fulfillment === 'FBM' || fulfillment === 'Mixed')
      ? data.revenue * (fbmCostPercent / 100)
      : 0;

    // Calculate Warehouse Cost and Others Cost
    // Others = FBA için depo+işçilik, FBM için kaynak bazlı hesap
    let warehouseCost = 0;
    let othersCost = 0;

    if (countryConfigs && marketplace) {
      const config = countryConfigs.configs[marketplace];

      if (fulfillment === 'FBA') {
        // FBA: Others = Depo+İşçilik (warehouse %) - SADECE US için geçerli
        if (marketplace === 'US') {
          const warehousePercent = config?.fba.warehousePercent || 0;
          warehouseCost = data.revenue * (warehousePercent / 100);
          othersCost = warehouseCost;
        }
        // Diğer ülkelerde FBA için depo+işçilik yok
      } else if (fulfillment === 'FBM') {
        // FBM: Others kaynak bazlı
        const effectiveMode = skuFbmSource || config?.fbm.shippingMode || 'BOTH';
        const normalizedMode = effectiveMode === 'US' ? 'LOCAL' : effectiveMode;

        if (normalizedMode === 'LOCAL') {
          // US lokal: Sadece depo+işçilik
          const localWarehousePercent = config?.fbm.fromLocal?.warehousePercent || 0;
          warehouseCost = data.revenue * (localWarehousePercent / 100);
          othersCost = warehouseCost;
        } else if (normalizedMode === 'TR') {
          // TR: Vergi + DDP (customs + ddp zaten hesaplandı)
          othersCost = customsDuty + ddpFee;
        } else {
          // BOTH: İkisinin ortalaması
          const localWarehousePercent = config?.fbm.fromLocal?.warehousePercent || 0;
          const localWarehouseCost = data.revenue * (localWarehousePercent / 100);
          const trCost = customsDuty + ddpFee;
          warehouseCost = localWarehouseCost / 2; // Yarısı lokal
          othersCost = (localWarehouseCost + trCost) / 2;
        }
      } else {
        // Mixed: FBA ve FBM karışımı (50/50)
        // FBA kısmı için warehouse - SADECE US için geçerli
        let fbaWarehouseCost = 0;
        if (marketplace === 'US') {
          const fbaWarehousePercent = config?.fba.warehousePercent || 0;
          fbaWarehouseCost = (data.revenue / 2) * (fbaWarehousePercent / 100);
        }

        // FBM kısmı için kaynak bazlı hesap
        const effectiveMode = skuFbmSource || config?.fbm.shippingMode || 'BOTH';
        const normalizedMode = effectiveMode === 'US' ? 'LOCAL' : effectiveMode;

        let fbmOthersCost = 0;
        if (normalizedMode === 'LOCAL') {
          const localWarehousePercent = config?.fbm.fromLocal?.warehousePercent || 0;
          fbmOthersCost = (data.revenue / 2) * (localWarehousePercent / 100);
        } else if (normalizedMode === 'TR') {
          fbmOthersCost = customsDuty + ddpFee;
        } else {
          const localWarehousePercent = config?.fbm.fromLocal?.warehousePercent || 0;
          const localWarehouseCost = (data.revenue / 2) * (localWarehousePercent / 100);
          const trCost = customsDuty + ddpFee;
          fbmOthersCost = (localWarehouseCost + trCost) / 2;
        }

        warehouseCost = fbaWarehouseCost;
        othersCost = fbaWarehouseCost + fbmOthersCost;
      }
    }

    // Calculate GST cost for non-Amazon tax obligations (e.g., AU GST)
    // GST is a Non-Amazon expense when seller is GST-registered (like AU with ABN+GST)
    // Formula: If price includes GST, GST = revenue * (rate / (100 + rate))
    // Example: AU 10% GST, $110 price → GST = $110 * (10/110) = $10
    let gstCost = 0;
    if (countryConfigs && marketplace) {
      const config = countryConfigs.configs[marketplace];
      if (config?.gst?.enabled && config.gst.ratePercent > 0) {
        if (config.gst.includedInPrice) {
          // GST is included in price - extract it
          gstCost = data.revenue * (config.gst.ratePercent / (100 + config.gst.ratePercent));
        } else {
          // GST is on top of price
          gstCost = data.revenue * (config.gst.ratePercent / 100);
        }
      }
    }

    // Total costs including global costs, others, and GST
    const totalCosts = totalProductCost + shippingCost + customsDuty + ddpFee + advertisingCost + fbaCost + fbmCost + warehouseCost + gstCost;
    const netProfit = hasCostData ? grossProfit - totalCosts : 0;
    const profitMargin = data.revenue > 0 && hasCostData ? (netProfit / data.revenue) * 100 : 0;
    const roi = totalCosts > 0 && hasCostData ? (netProfit / totalCosts) * 100 : 0;

    // Percentages
    const sellingFeePercent = data.revenue > 0 ? (data.sellingFees / data.revenue) * 100 : 0;
    const fbaFeePercent = data.revenue > 0 ? (data.fbaFees / data.revenue) * 100 : 0;
    const refundLossPercent = data.revenue > 0 ? (refundLoss / data.revenue) * 100 : 0;
    const vatPercent = data.revenue > 0 ? (vat / data.revenue) * 100 : 0;
    const productCostPercent = data.revenue > 0 ? (totalProductCost / data.revenue) * 100 : 0;
    const shippingCostPercent = data.revenue > 0 ? (shippingCost / data.revenue) * 100 : 0;
    const othersCostPercent = data.revenue > 0 ? (othersCost / data.revenue) * 100 : 0;
    const gstCostPercent = data.revenue > 0 ? (gstCost / data.revenue) * 100 : 0;

    results.push({
      sku,
      name: data.name,
      parent: data.parent,
      category: data.category,
      fulfillment,
      totalRevenue: data.revenue,
      totalOrders: data.orders,
      totalQuantity: data.quantity,
      refundedQuantity: data.refundedQuantity,
      avgSalePrice: data.quantity > 0 ? data.revenue / data.quantity : 0,
      sellingFees: data.sellingFees,
      fbaFees: data.fbaFees,
      refundLoss,
      vat,
      totalAmazonFees,
      productCost: unitCost ?? 0,
      totalProductCost,
      shippingCost,
      customsDuty,
      ddpFee,
      warehouseCost,
      othersCost,
      gstCost,
      advertisingCost,
      fbaCost,
      fbmCost,
      grossProfit,
      netProfit,
      profitMargin,
      roi,
      sellingFeePercent,
      fbaFeePercent,
      refundLossPercent,
      vatPercent,
      productCostPercent,
      shippingCostPercent,
      advertisingPercent: adsPercent,
      fbaCostPercent: (fulfillment === 'FBA' || fulfillment === 'Mixed') ? fbaCostPercent : 0,
      fbmCostPercent: (fulfillment === 'FBM' || fulfillment === 'Mixed') ? fbmCostPercent : 0,
      othersCostPercent,
      gstCostPercent,
      hasCostData,
      hasSizeData,
      desi,
    });
  });

  return results.sort((a, b) => b.totalRevenue - a.totalRevenue);
};

/**
 * Calculate profitability by parent ASIN
 * Aggregates NAME-level data to Parent level
 */
export const calculateParentProfitability = (
  products: ProductProfitAnalysis[]
): ParentProfitAnalysis[] => {
  // Group NAMEs by Parent
  const parentMap = new Map<string, {
    names: ProductProfitAnalysis[];
    parent: string;
    category: string;
  }>();

  products.forEach(product => {
    const existing = parentMap.get(product.parent);
    if (existing) {
      existing.names.push(product);
    } else {
      parentMap.set(product.parent, {
        names: [product],
        parent: product.parent,
        category: product.category,
      });
    }
  });

  // Convert to ParentProfitAnalysis by aggregating NAME values
  const results: ParentProfitAnalysis[] = [];

  parentMap.forEach(({ names, parent, category }) => {
    // Determine fulfillment type for this Parent
    const hasFBA = names.some(n => n.fulfillment === 'FBA' || n.fulfillment === 'Mixed');
    const hasFBM = names.some(n => n.fulfillment === 'FBM' || n.fulfillment === 'Mixed');
    const fulfillment: 'FBA' | 'FBM' | 'Mixed' = hasFBA && hasFBM ? 'Mixed' : hasFBA ? 'FBA' : 'FBM';

    // Aggregate numeric values
    const totalRevenue = names.reduce((sum, n) => sum + n.totalRevenue, 0);
    const totalOrders = names.reduce((sum, n) => sum + n.totalOrders, 0);
    const totalQuantity = names.reduce((sum, n) => sum + n.totalQuantity, 0);
    const refundedQuantity = names.reduce((sum, n) => sum + n.refundedQuantity, 0);

    // FBA/FBM breakdown
    const fbaRevenue = names.reduce((sum, n) => sum + n.fbaRevenue, 0);
    const fbmRevenue = names.reduce((sum, n) => sum + n.fbmRevenue, 0);
    const fbaQuantity = names.reduce((sum, n) => sum + n.fbaQuantity, 0);
    const fbmQuantity = names.reduce((sum, n) => sum + n.fbmQuantity, 0);

    // Amazon Fees
    const sellingFees = names.reduce((sum, n) => sum + n.sellingFees, 0);
    const fbaFees = names.reduce((sum, n) => sum + n.fbaFees, 0);
    const refundLoss = names.reduce((sum, n) => sum + n.refundLoss, 0);
    const vat = names.reduce((sum, n) => sum + n.vat, 0);
    const totalAmazonFees = names.reduce((sum, n) => sum + n.totalAmazonFees, 0);

    // Costs
    const totalProductCost = names.reduce((sum, n) => sum + n.totalProductCost, 0);
    const shippingCost = names.reduce((sum, n) => sum + n.shippingCost, 0);
    const customsDuty = names.reduce((sum, n) => sum + n.customsDuty, 0);
    const ddpFee = names.reduce((sum, n) => sum + n.ddpFee, 0);
    const warehouseCost = names.reduce((sum, n) => sum + n.warehouseCost, 0);
    const othersCost = names.reduce((sum, n) => sum + n.othersCost, 0);
    const gstCost = names.reduce((sum, n) => sum + n.gstCost, 0);

    // Global costs
    const advertisingCost = names.reduce((sum, n) => sum + n.advertisingCost, 0);
    const fbaCost = names.reduce((sum, n) => sum + n.fbaCost, 0);
    const fbmCost = names.reduce((sum, n) => sum + n.fbmCost, 0);

    // Profitability
    const grossProfit = names.reduce((sum, n) => sum + n.grossProfit, 0);
    const netProfit = names.reduce((sum, n) => sum + n.netProfit, 0);

    // Flags - true only if ALL NAMEs have data
    const hasCostData = names.every(n => n.hasCostData);
    const hasSizeData = names.every(n => n.hasSizeData);

    // Calculate weighted average unit cost
    const productCost = totalQuantity > 0 ? totalProductCost / totalQuantity : 0;

    // Calculate percentages from aggregated values
    const profitMargin = totalRevenue > 0 && hasCostData ? (netProfit / totalRevenue) * 100 : 0;
    const totalCosts = totalProductCost + shippingCost + customsDuty + ddpFee + advertisingCost + fbaCost + fbmCost + warehouseCost + gstCost;
    const roi = totalCosts > 0 && hasCostData ? (netProfit / totalCosts) * 100 : 0;

    const sellingFeePercent = totalRevenue > 0 ? (sellingFees / totalRevenue) * 100 : 0;
    const fbaFeePercent = totalRevenue > 0 ? (fbaFees / totalRevenue) * 100 : 0;
    const refundLossPercent = totalRevenue > 0 ? (refundLoss / totalRevenue) * 100 : 0;
    const vatPercent = totalRevenue > 0 ? (vat / totalRevenue) * 100 : 0;
    const productCostPercent = totalRevenue > 0 ? (totalProductCost / totalRevenue) * 100 : 0;
    const shippingCostPercent = totalRevenue > 0 ? (shippingCost / totalRevenue) * 100 : 0;
    const advertisingPercent = totalRevenue > 0 ? (advertisingCost / totalRevenue) * 100 : 0;
    const fbaCostPercent = totalRevenue > 0 ? (fbaCost / totalRevenue) * 100 : 0;
    const fbmCostPercent = totalRevenue > 0 ? (fbmCost / totalRevenue) * 100 : 0;
    const othersCostPercent = totalRevenue > 0 ? (othersCost / totalRevenue) * 100 : 0;
    const gstCostPercent = totalRevenue > 0 ? (gstCost / totalRevenue) * 100 : 0;

    results.push({
      parent,
      category,
      names: names.map(n => n.name),
      fulfillment,

      totalProducts: names.length,
      totalRevenue,
      totalOrders,
      totalQuantity,
      refundedQuantity,
      avgSalePrice: totalQuantity > 0 ? totalRevenue / totalQuantity : 0,

      fbaRevenue,
      fbmRevenue,
      fbaQuantity,
      fbmQuantity,

      sellingFees,
      fbaFees,
      refundLoss,
      vat,
      totalAmazonFees,

      productCost,
      totalProductCost,
      shippingCost,
      customsDuty,
      ddpFee,
      warehouseCost,
      othersCost,
      gstCost,

      advertisingCost,
      fbaCost,
      fbmCost,

      grossProfit,
      netProfit,
      profitMargin,
      roi,

      sellingFeePercent,
      fbaFeePercent,
      refundLossPercent,
      vatPercent,
      productCostPercent,
      shippingCostPercent,
      advertisingPercent,
      fbaCostPercent,
      fbmCostPercent,
      othersCostPercent,
      gstCostPercent,

      hasCostData,
      hasSizeData,
    });
  });

  return results.sort((a, b) => b.totalRevenue - a.totalRevenue);
};

/**
 * Calculate overall profitability summary
 */
export const calculateProfitabilitySummary = (
  products: ProductProfitAnalysis[]
): ProfitabilitySummaryStats => {
  const stats: ProfitabilitySummaryStats = {
    totalRevenue: 0,
    totalOrders: 0,
    totalQuantity: 0,
    totalSellingFees: 0,
    totalFbaFees: 0,
    totalRefundLoss: 0,
    totalAmazonFees: 0,
    totalProductCost: 0,
    totalShippingCost: 0,
    totalCustomsDuty: 0,
    totalCosts: 0,
    grossProfit: 0,
    netProfit: 0,
    profitMargin: 0,
    totalProducts: products.length,
    profitableProducts: 0,
    unprofitableProducts: 0,
    unknownProducts: 0,
  };

  products.forEach(product => {
    stats.totalRevenue += product.totalRevenue;
    stats.totalOrders += product.totalOrders;
    stats.totalQuantity += product.totalQuantity;
    stats.totalSellingFees += product.sellingFees;
    stats.totalFbaFees += product.fbaFees;
    stats.totalRefundLoss += product.refundLoss;
    stats.totalProductCost += product.totalProductCost;
    stats.totalShippingCost += product.shippingCost;
    stats.totalCustomsDuty += product.customsDuty + product.ddpFee;
    stats.grossProfit += product.grossProfit;

    if (product.hasCostData) {
      stats.netProfit += product.netProfit;
      if (product.netProfit > 0) {
        stats.profitableProducts++;
      } else {
        stats.unprofitableProducts++;
      }
    } else {
      stats.unknownProducts++;
    }
  });

  stats.totalAmazonFees = stats.totalSellingFees + stats.totalFbaFees + stats.totalRefundLoss;
  stats.totalCosts = stats.totalProductCost + stats.totalShippingCost + stats.totalCustomsDuty;
  stats.profitMargin = stats.totalRevenue > 0
    ? (stats.netProfit / stats.totalRevenue) * 100
    : 0;

  return stats;
};
