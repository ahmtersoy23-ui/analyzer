/**
 * Phase 3: Profitability Calculation Engine
 *
 * Handles all profit calculations combining:
 * - Phase 1/2 data (fees, sales, etc.)
 * - Cost data (product costs, desi)
 * - Shipping rates
 * - Country configs (customs, DDP, warehouse)
 */

import { TransactionData, MarketplaceCode } from '../../types/transaction';
import {
  ProductCostData,
  CostDataSummary,
  Phase1GlobalRates,
  Phase2NameData,
  ProfitBreakdown,
  ProductProfitability,
  ProfitabilitySummary,
  ShippingRateTable,
  AllCountryConfigs,
  CountryProfitConfig,
  FBMFromTRConfig,
  ShippingCurrency,
} from '../../types/profitability';
import { ProductAnalytics, GlobalCosts } from '../analytics/productAnalytics';
import {
  getShippingRate,
  getUSFBMShippingRate,
  getShippingRouteForMarketplace,
} from './configService';
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
// HELPER FUNCTIONS
// ============================================

/**
 * Get customs duty percentage for a product based on its category.
 * Falls back to default rate if no category-specific rate is defined.
 */
const getCustomsDutyPercent = (
  fromTRConfig: FBMFromTRConfig,
  category: string | undefined
): number => {
  // If no category or no category duties defined, use default
  if (!category || !fromTRConfig.categoryDuties || fromTRConfig.categoryDuties.length === 0) {
    return fromTRConfig.customsDutyPercent;
  }

  // Normalize category for comparison
  const normalizedCategory = category.toLowerCase().trim();

  // Find matching category duty (case-insensitive, partial match)
  const matchingDuty = fromTRConfig.categoryDuties.find(cd => {
    const normalizedCdCategory = cd.category.toLowerCase().trim();
    return normalizedCategory.includes(normalizedCdCategory) ||
           normalizedCdCategory.includes(normalizedCategory);
  });

  return matchingDuty ? matchingDuty.dutyPercent : fromTRConfig.customsDutyPercent;
};

// ============================================
// PHASE 1 DATA EXTRACTION
// ============================================

/**
 * Extract global rates from Phase 1 analytics
 * These are GENERAL percentages, not NAME-based
 */
export const extractPhase1GlobalRates = (
  transactions: TransactionData[],
  globalCosts: GlobalCosts,
  marketplace: MarketplaceCode | 'ALL'
): Phase1GlobalRates => {
  // Calculate total sales (only Orders)
  const orders = transactions.filter(t => t.categoryType === 'Order');
  const totalSales = orders.reduce((sum, t) => sum + t.productSales, 0);

  // FBA sales
  const fbaOrders = orders.filter(t => t.fulfillment === 'FBA');
  const fbaSales = fbaOrders.reduce((sum, t) => sum + t.productSales, 0);

  // FBM sales
  const fbmOrders = orders.filter(t => t.fulfillment !== 'FBA');
  const fbmSales = fbmOrders.reduce((sum, t) => sum + t.productSales, 0);

  // FBA Cost % (global costs / FBA sales)
  const fbaCostPercent = fbaSales > 0 ? (globalCosts.fba / fbaSales) * 100 : 0;

  // FBM Cost % (global costs / FBM sales)
  const fbmCostPercent = fbmSales > 0 ? (globalCosts.fbm / fbmSales) * 100 : 0;

  // Advertising % (global costs / total sales)
  const advertisingPercent = totalSales > 0 ? (globalCosts.advertising / totalSales) * 100 : 0;

  // Refund recovery rate (marketplace-specific or average)
  // This is already calculated in Phase 1, we'll use a default here
  const refundRecoveryRate = marketplace === 'US' ? 0.50 :
                            marketplace === 'UK' ? 0.30 :
                            marketplace === 'CA' || marketplace === 'AU' ? 0.40 : 0.30;

  return {
    marketplace,
    fbaCostPercent,
    fbmCostPercent,
    advertisingPercent,
    refundRecoveryRate,
  };
};

// ============================================
// PHASE 2 DATA EXTRACTION
// ============================================

/**
 * Convert ProductAnalytics to Phase2NameData for profitability calculation
 */
export const extractPhase2NameData = (
  products: ProductAnalytics[]
): Phase2NameData[] => {
  return products.map(p => {
    const totalQuantity = p.variants.reduce((sum, v) => sum + v.quantity, 0);

    return {
      name: p.name,
      skus: p.variants.map(v => v.sku),

      // Revenue
      avgSalePrice: p.avgOrderValue,
      totalRevenue: p.totalSales,
      totalQuantity,

      // Amazon Fees (NAME-based percentages)
      sellingFeePercent: p.totalSales > 0 ? (p.sellingFees / p.totalSales) * 100 : 0,
      fbaFeePercent: p.fbaSales > 0 ? (p.fbaFees / p.fbaSales) * 100 : 0,
      refundLossPercent: p.totalSales > 0 ? (p.totalRefundLoss / p.totalSales) * 100 : 0,

      // Fulfillment breakdown
      fbaRevenue: p.fbaSales,
      fbmRevenue: p.fbmSales,
      fbaQuantity: p.fbaOrders,
      fbmQuantity: p.fbmOrders,
    };
  });
};

// ============================================
// COST DATA PROCESSING
// ============================================

/**
 * Extract cost data from enriched transaction data (from PriceLab API)
 * This is the PRIMARY method - cost/size comes from PriceLab product mapping
 *
 * IMPORTANT: We prioritize transactions that HAVE cost/size data over those that don't.
 * This is because the same SKU may appear in transactions where:
 * - Some have marketplace-specific enrichment (with cost/size)
 * - Some only have fallback enrichment (category only, no cost/size)
 */
export const extractCostDataFromTransactions = (
  transactions: TransactionData[]
): ProductCostData[] => {
  const skuMap = new Map<string, ProductCostData>();

  transactions.forEach(t => {
    if (!t.sku) return;

    const existing = skuMap.get(t.sku);
    const hasCost = t.productCost !== null && t.productCost !== undefined;
    const hasSize = t.productSize !== null && t.productSize !== undefined;
    const hasCustomShipping = t.productCustomShipping !== null && t.productCustomShipping !== undefined;
    const hasFbmSource = t.productFbmSource !== null && t.productFbmSource !== undefined;

    // If we don't have this SKU yet, add it
    if (!existing) {
      skuMap.set(t.sku, {
        sku: t.sku,
        asin: t.asin,
        name: t.name || t.sku,
        parent: t.parent,
        category: t.productCategory,
        cost: t.productCost ?? null,
        size: t.productSize ?? null,
        customShipping: t.productCustomShipping ?? null,
        fbmSource: (t.productFbmSource as 'TR' | 'US' | 'BOTH') || null,
      });
      return;
    }

    // If existing entry is missing data, try to fill from this transaction
    const needsCost = existing.cost === null && hasCost;
    const needsSize = existing.size === null && hasSize;
    const needsCustomShipping = existing.customShipping === null && hasCustomShipping;
    const needsFbmSource = !existing.fbmSource && hasFbmSource;

    if (needsCost || needsSize || needsCustomShipping || needsFbmSource) {
      skuMap.set(t.sku, {
        ...existing,
        cost: needsCost ? t.productCost! : existing.cost,
        size: needsSize ? t.productSize! : existing.size,
        customShipping: needsCustomShipping ? t.productCustomShipping! : existing.customShipping,
        fbmSource: needsFbmSource ? (t.productFbmSource as 'TR' | 'US' | 'BOTH') : existing.fbmSource,
        // Also update other fields if they were empty
        asin: existing.asin || t.asin,
        name: existing.name || t.name || t.sku,
        parent: existing.parent || t.parent,
        category: existing.category || t.productCategory,
      });
    }
  });

  return Array.from(skuMap.values());
};

/**
 * Parse cost data from Excel file (BACKUP method)
 * Expected columns: sku, asin, name, parent, category, cost, size, customShipping, fbmSource
 */
export const parseCostDataFromExcel = (
  data: Record<string, any>[]
): ProductCostData[] => {
  return data.map(row => {
    // Try different column name variations
    const sku = row['sku'] || row['SKU'] || row['Sku'] || '';
    const asin = row['asin'] || row['ASIN'] || row['Asin'] || '';
    const name = row['name'] || row['NAME'] || row['Name'] || '';
    const parent = row['parent'] || row['PARENT'] || row['Parent'] || '';
    const category = row['category'] || row['CATEGORY'] || row['Category'] || '';

    // Cost - parse as number, null if empty or invalid
    const costRaw = row['cost'] || row['COST'] || row['Cost'] || row['maliyet'] || row['Maliyet'];
    const cost = costRaw !== undefined && costRaw !== '' && !isNaN(parseFloat(costRaw))
      ? parseFloat(costRaw)
      : null;

    // Size (desi) - parse as number, null if empty or invalid
    const sizeRaw = row['size'] || row['SIZE'] || row['Size'] || row['desi'] || row['Desi'];
    const size = sizeRaw !== undefined && sizeRaw !== '' && !isNaN(parseFloat(sizeRaw))
      ? parseFloat(sizeRaw)
      : null;

    // Custom Shipping - özel kargo ücreti (desi cetvelini bypass eder)
    const customShippingRaw = row['customShipping'] || row['CustomShipping'] || row['CUSTOMSHIPPING'] ||
                              row['custom_shipping'] || row['ozelKargo'] || row['OzelKargo'];
    const customShipping = customShippingRaw !== undefined && customShippingRaw !== '' && !isNaN(parseFloat(customShippingRaw))
      ? parseFloat(customShippingRaw)
      : null;

    // FBM Source - SKU bazlı kaynak (TR/US/BOTH)
    const fbmSourceRaw = row['fbmSource'] || row['FbmSource'] || row['FBMSOURCE'] ||
                         row['fbm_source'] || row['source'] || row['Source'] || row['kaynak'] || row['Kaynak'];
    let fbmSource: 'TR' | 'US' | 'BOTH' | null = null;
    if (fbmSourceRaw) {
      const normalized = fbmSourceRaw.toString().toUpperCase().trim();
      if (normalized === 'TR' || normalized === 'TURKEY' || normalized === 'TÜRKİYE') {
        fbmSource = 'TR';
      } else if (normalized === 'US' || normalized === 'USA' || normalized === 'LOCAL' || normalized === 'ABD') {
        fbmSource = 'US';
      } else if (normalized === 'BOTH' || normalized === 'MIXED' || normalized === 'İKİSİ' || normalized === 'IKISI') {
        fbmSource = 'BOTH';
      }
    }

    return {
      sku: sku.toString().trim(),
      asin: asin.toString().trim() || undefined,
      name: name.toString().trim(),
      parent: parent.toString().trim() || undefined,
      category: category.toString().trim() || undefined,
      cost,
      size,
      customShipping,
      fbmSource,
    };
  }).filter(item => item.sku); // Filter out empty rows
};

/**
 * Match cost data with Phase 2 products and generate summary
 */
export const matchCostData = (
  costData: ProductCostData[],
  phase2Data: Phase2NameData[]
): CostDataSummary => {
  const allSkus = new Set<string>();
  phase2Data.forEach(p => p.skus.forEach(sku => allSkus.add(sku)));

  const costSkuMap = new Map<string, ProductCostData>();
  costData.forEach(c => costSkuMap.set(c.sku, c));

  const missingCost: string[] = [];
  const missingSize: string[] = [];
  let matchedCount = 0;

  allSkus.forEach(sku => {
    const costInfo = costSkuMap.get(sku);
    if (costInfo) {
      matchedCount++;
      if (costInfo.cost === null) {
        missingCost.push(sku);
      }
      if (costInfo.size === null) {
        missingSize.push(sku);
      }
    } else {
      missingCost.push(sku);
      missingSize.push(sku);
    }
  });

  return {
    totalProducts: allSkus.size,
    matchedProducts: matchedCount,
    missingCost,
    missingSize,
    matchPercentage: allSkus.size > 0 ? (matchedCount / allSkus.size) * 100 : 0,
  };
};

// ============================================
// PROFITABILITY CALCULATION
// ============================================

/**
 * Calculate FBA profit breakdown for a product
 * @param marketplace - Hedef marketplace (para birimi dönüşümü için)
 */
const calculateFBAProfitBreakdown = (
  nameData: Phase2NameData,
  costData: ProductCostData | null,
  phase1Rates: Phase1GlobalRates,
  countryConfig: CountryProfitConfig,
  marketplace: MarketplaceCode
): ProfitBreakdown | null => {
  // Check if we have required data
  if (!costData || costData.cost === null || costData.size === null) {
    return null;
  }

  const avgPrice = nameData.avgSalePrice;
  if (avgPrice <= 0) return null;

  // Hedef para birimi
  const targetCurrency = getMarketplaceCurrency(marketplace);

  // Amazon Cuts (percentages applied to avg price) - bunlar zaten hedef para biriminde
  const sellingFee = avgPrice * (nameData.sellingFeePercent / 100);
  const fbaFee = avgPrice * (nameData.fbaFeePercent / 100);
  const fbaCost = avgPrice * (phase1Rates.fbaCostPercent / 100);
  const refundLoss = avgPrice * (nameData.refundLossPercent / 100);
  const advertisingCost = avgPrice * (phase1Rates.advertisingPercent / 100);
  const totalAmazonCuts = sellingFee + fbaFee + fbaCost + refundLoss + advertisingCost;

  // Costs - Cost verisi USD'den hedef para birimine dönüştürülmeli
  const productCostConverted = convertCurrency(costData.cost, COST_DATA_CURRENCY, targetCurrency);

  // Shipping per desi USD olarak girildiğini varsayıyoruz
  const shippingPerDesiConverted = convertCurrency(
    countryConfig.fba.shippingPerDesi,
    COST_DATA_CURRENCY,
    targetCurrency
  );
  const shippingCost = costData.size * shippingPerDesiConverted;

  // Depo+İşçilik SADECE US için geçerli
  const warehouseCost = marketplace === 'US'
    ? avgPrice * (countryConfig.fba.warehousePercent / 100)
    : 0;
  const totalCosts = productCostConverted + shippingCost + warehouseCost;

  // Profit
  const netProfit = avgPrice - totalAmazonCuts - totalCosts;
  const profitMargin = avgPrice > 0 ? (netProfit / avgPrice) * 100 : 0;
  const roi = totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0;

  return {
    avgSalePrice: avgPrice,
    sellingFee,
    fbaFee,
    fbaCost,
    fbmCost: 0,
    refundLoss,
    advertisingCost,
    totalAmazonCuts,
    productCost: productCostConverted,
    shippingCost,
    customsDuty: 0,
    ddpFee: 0,
    warehouseCost,
    totalCosts,
    netProfit,
    profitMargin,
    roi,
  };
};

/**
 * Calculate FBM profit breakdown for a product
 * Para birimi dönüşümü: Cost ve shipping USD'den hedef marketplace para birimine dönüştürülür
 */
const calculateFBMProfitBreakdown = (
  nameData: Phase2NameData,
  costData: ProductCostData | null,
  phase1Rates: Phase1GlobalRates,
  countryConfig: CountryProfitConfig,
  shippingRates: ShippingRateTable,
  marketplace: MarketplaceCode,
  category?: string
): ProfitBreakdown | null => {
  // Check if we have required data
  if (!costData || costData.cost === null || costData.size === null) {
    return null;
  }

  const avgPrice = nameData.avgSalePrice;
  if (avgPrice <= 0) return null;

  const desi = costData.size;

  // Hedef para birimi
  const targetCurrency = getMarketplaceCurrency(marketplace);

  // Amazon Cuts - bunlar zaten hedef para biriminde (avgPrice üzerinden hesaplanıyor)
  const sellingFee = avgPrice * (nameData.sellingFeePercent / 100);
  const fbmCost = avgPrice * (phase1Rates.fbmCostPercent / 100);
  const refundLoss = avgPrice * (nameData.refundLossPercent / 100);
  const advertisingCost = avgPrice * (phase1Rates.advertisingPercent / 100);
  const totalAmazonCuts = sellingFee + fbmCost + refundLoss + advertisingCost;

  // Get category-based customs duty percentage
  const customsDutyPercent = getCustomsDutyPercent(countryConfig.fbm.fromTR, category);

  // Shipping & Customs calculation
  let shippingCost = 0;
  let customsDuty = 0;
  let ddpFee = 0;
  let warehouseCost = 0;

  if (marketplace === 'US') {
    // US has special handling: TR, LOCAL, or BOTH
    const mode = countryConfig.fbm.shippingMode;
    const { rate, currency: shippingCurrency } = getUSFBMShippingRate(shippingRates, desi, mode);
    // Shipping rate'i hedef para birimine dönüştür
    const shippingSourceCurrency = shippingCurrencyToCurrencyCode(shippingCurrency);
    shippingCost = convertCurrency(rate, shippingSourceCurrency, targetCurrency);

    // Customs & DDP only apply to TR portion
    if (mode === 'TR') {
      customsDuty = avgPrice * (customsDutyPercent / 100);
      // DDP fee USD olarak varsayılıyor
      ddpFee = convertCurrency(countryConfig.fbm.fromTR.ddpFee, COST_DATA_CURRENCY, targetCurrency);
    } else if (mode === 'LOCAL') {
      warehouseCost = avgPrice * (countryConfig.fbm.fromLocal?.warehousePercent || 0) / 100;
    } else if (mode === 'BOTH') {
      // Average of TR and US costs
      const trCustoms = avgPrice * (customsDutyPercent / 100);
      const trDdp = convertCurrency(countryConfig.fbm.fromTR.ddpFee, COST_DATA_CURRENCY, targetCurrency);
      const usWarehouse = avgPrice * (countryConfig.fbm.fromLocal?.warehousePercent || 0) / 100;

      customsDuty = trCustoms / 2; // Half, since only TR portion has customs
      ddpFee = trDdp / 2;
      warehouseCost = usWarehouse / 2;
    }
  } else {
    // Other countries: direct from shipping rate table
    const route = getShippingRouteForMarketplace(marketplace);
    const shippingResult = getShippingRate(shippingRates, route, desi);
    // Shipping rate'i hedef para birimine dönüştür
    const shippingSourceCurrency = shippingCurrencyToCurrencyCode(shippingResult.currency);
    shippingCost = convertCurrency(shippingResult.rate, shippingSourceCurrency, targetCurrency);

    customsDuty = avgPrice * (customsDutyPercent / 100);
    // DDP fee USD olarak varsayılıyor
    ddpFee = convertCurrency(countryConfig.fbm.fromTR.ddpFee, COST_DATA_CURRENCY, targetCurrency);
  }

  // Total costs - Product cost USD'den hedef para birimine dönüştür
  const productCostConverted = convertCurrency(costData.cost, COST_DATA_CURRENCY, targetCurrency);
  const totalCosts = productCostConverted + shippingCost + customsDuty + ddpFee + warehouseCost;

  // Profit
  const netProfit = avgPrice - totalAmazonCuts - totalCosts;
  const profitMargin = avgPrice > 0 ? (netProfit / avgPrice) * 100 : 0;
  const roi = totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0;

  return {
    avgSalePrice: avgPrice,
    sellingFee,
    fbaFee: 0,
    fbaCost: 0,
    fbmCost,
    refundLoss,
    advertisingCost,
    totalAmazonCuts,
    productCost: productCostConverted,
    shippingCost,
    customsDuty,
    ddpFee,
    warehouseCost,
    totalCosts,
    netProfit,
    profitMargin,
    roi,
  };
};

/**
 * Calculate profitability for all products
 */
export const calculateAllProfitability = (
  phase2Data: Phase2NameData[],
  costData: ProductCostData[],
  phase1Rates: Phase1GlobalRates,
  countryConfigs: AllCountryConfigs,
  shippingRates: ShippingRateTable,
  marketplace: MarketplaceCode
): ProductProfitability[] => {
  // Create cost lookup by SKU
  const costBySku = new Map<string, ProductCostData>();
  costData.forEach(c => costBySku.set(c.sku, c));

  // Get country config
  const countryConfig = countryConfigs.configs[marketplace];

  return phase2Data.map(nameData => {
    // Find cost data for this product (using first SKU)
    const primarySku = nameData.skus[0];
    const productCost = costBySku.get(primarySku) || null;

    // Get category from cost data
    const category = productCost?.category;

    // Calculate FBA and FBM breakdowns (para birimi dönüşümü fonksiyonlar içinde yapılıyor)
    const fba = calculateFBAProfitBreakdown(nameData, productCost, phase1Rates, countryConfig, marketplace);
    const fbm = calculateFBMProfitBreakdown(
      nameData, productCost, phase1Rates, countryConfig, shippingRates, marketplace, category
    );

    // Determine best option
    let bestOption: 'FBA' | 'FBM' | null = null;
    let profitDifference: number | null = null;

    if (fba && fbm) {
      if (fba.netProfit > fbm.netProfit) {
        bestOption = 'FBA';
        profitDifference = fba.netProfit - fbm.netProfit;
      } else {
        bestOption = 'FBM';
        profitDifference = fbm.netProfit - fba.netProfit;
      }
    } else if (fba) {
      bestOption = 'FBA';
    } else if (fbm) {
      bestOption = 'FBM';
    }

    return {
      name: nameData.name,
      skus: nameData.skus,
      category: productCost?.category || 'Unknown',
      productCost: productCost?.cost ?? null,
      desi: productCost?.size ?? null,
      hasCostData: productCost?.cost !== null,
      hasSizeData: productCost?.size !== null,
      avgSalePrice: nameData.avgSalePrice,
      totalQuantity: nameData.totalQuantity,
      fbaQuantity: nameData.fbaQuantity,
      fbmQuantity: nameData.fbmQuantity,
      fba,
      fbm,
      bestOption,
      profitDifference,
    };
  });
};

/**
 * Generate profitability summary
 */
export const calculateProfitabilitySummary = (
  results: ProductProfitability[],
  marketplace: MarketplaceCode
): ProfitabilitySummary => {
  const calculatedResults = results.filter(r => r.fba || r.fbm);

  // FBA stats
  const fbaResults = calculatedResults.filter(r => r.fba);
  const fbaTotalProfit = fbaResults.reduce((sum, r) => sum + (r.fba?.netProfit || 0), 0);
  const fbaAvgMargin = fbaResults.length > 0
    ? fbaResults.reduce((sum, r) => sum + (r.fba?.profitMargin || 0), 0) / fbaResults.length
    : 0;
  const fbaProfitable = fbaResults.filter(r => (r.fba?.netProfit || 0) > 0).length;
  const fbaUnprofitable = fbaResults.filter(r => (r.fba?.netProfit || 0) <= 0).length;

  // FBM stats
  const fbmResults = calculatedResults.filter(r => r.fbm);
  const fbmTotalProfit = fbmResults.reduce((sum, r) => sum + (r.fbm?.netProfit || 0), 0);
  const fbmAvgMargin = fbmResults.length > 0
    ? fbmResults.reduce((sum, r) => sum + (r.fbm?.profitMargin || 0), 0) / fbmResults.length
    : 0;
  const fbmProfitable = fbmResults.filter(r => (r.fbm?.netProfit || 0) > 0).length;
  const fbmUnprofitable = fbmResults.filter(r => (r.fbm?.netProfit || 0) <= 0).length;

  // Comparison
  const fbaBetter = calculatedResults.filter(r => r.bestOption === 'FBA').length;
  const fbmBetter = calculatedResults.filter(r => r.bestOption === 'FBM').length;

  return {
    marketplace,
    totalProducts: results.length,
    calculatedProducts: calculatedResults.length,
    fbaAverageMargin: fbaAvgMargin,
    fbaTotalProfit,
    fbaProfitableCount: fbaProfitable,
    fbaUnprofitableCount: fbaUnprofitable,
    fbmAverageMargin: fbmAvgMargin,
    fbmTotalProfit,
    fbmProfitableCount: fbmProfitable,
    fbmUnprofitableCount: fbmUnprofitable,
    fbaBetterCount: fbaBetter,
    fbmBetterCount: fbmBetter,
  };
};
