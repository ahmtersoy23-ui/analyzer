// Main Analytics Engine
// Centralized analytics calculation logic extracted from TransactionAnalyzer

import { TransactionData, MarketplaceConfig, GroupData, PostalZone, Analytics, MarketplaceCode } from '../../types/transaction';
import { MARKETPLACE_CONFIGS } from '../../constants/marketplaces';
import { convertCurrency, getMarketplaceCurrency } from '../../utils/currencyExchange';
import * as Calc from './calculations';

export interface AnalyticsOptions {
  data: TransactionData[];
  marketplaceCode: MarketplaceCode | null;
  selectedFulfillment: 'all' | 'FBA' | 'FBM';
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  config: MarketplaceConfig;
}

export interface DetailedAnalytics extends Analytics {
  // Detailed breakdowns
  adjustmentGroups: Record<string, GroupData>;
  inventoryGroups: Record<string, GroupData>;
  serviceGroups: Record<string, GroupData>;
  othersGroups: Record<string, GroupData>;
  fbaCustomerReturnGroups: Record<string, GroupData>;
  fbaTransactionGroups: Record<string, GroupData>;
  amazonFeesGroups: Record<string, GroupData>;
  chargebackGroups: Record<string, GroupData>;
  shippingServicesGroups: Record<string, GroupData>;

  // Totals
  adjustmentTotal: number;
  inventoryTotal: number;
  serviceTotal: number;
  chargebackTotal: number;
  liquidationsTotal: number;
  shippingServicesTotal: number;
  totalSellingFees: number;
  totalFBACost: number;
  totalFBMCost: number;
  totalFbaFees: number;
  totalAllSales: number;
  fbaTransactionFees: number;
  fbaTransactionTotal: number;
  fbaCustomerReturnTotal: number;
  feeAdjustments: number;
  safetReimbursements: number;

  // Order details
  totalOrders: number;
  fbaOrders: number;
  fbmOrders: number;
  totalRefunds: number;

  // Sales breakdown & percentages
  fbaOrderSales: number;
  fbmOrderSales: number;
  fbaOrderNet: number;
  fbmOrderNet: number;
  fbaPercentage: number;
  fbmPercentage: number;

  // Fees breakdown
  fbaSellingFees: number;
  fbmSellingFees: number;
  fbaOrderFees: number;

  // Advertising
  fbaAdvertisingCost: number;
  fbmAdvertisingCost: number;
  displayAdvertisingCost: number;

  // Refunds
  totalRefundAmount: number;
  recoveredRefunds: number;
  refundRate: number;

  // Other metrics
  totalDisbursement: number;
  totalNet: number;
  disbursements: any[];  // Raw disbursement transactions
  postalZones: Record<string, PostalZone>;
  marketplaceSalesDistribution: any;
  marketplacePieCharts: any;

  // Pie chart data
  pieChartData: {
    values: number[];
    labels: string[];
    colors: string[];
  };

  // Comparison label (for comparison mode)
  label?: string;
}

/**
 * Helper function to convert transaction values to USD when needed
 * When viewing "All" marketplaces, we need to convert all currencies to USD
 */
const convertTransactionValue = (
  value: number,
  transaction: TransactionData,
  marketplaceCode: MarketplaceCode | null
): number => {
  // If specific marketplace is selected, no conversion needed (all same currency)
  if (marketplaceCode !== null) {
    return value;
  }

  // For "All" marketplaces (marketplaceCode is null), convert to USD
  if (!transaction.marketplaceCode) {
    return value; // No marketplace info, can't convert
  }

  const sourceCurrency = getMarketplaceCurrency(transaction.marketplaceCode);
  return convertCurrency(value, sourceCurrency, 'USD');
};

// Analytics cache for performance optimization
const analyticsCache = new Map<string, { result: DetailedAnalytics; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

const getCacheKey = (options: AnalyticsOptions): string => {
  return `${options.marketplaceCode || 'ALL'}_${options.selectedFulfillment}_${options.dateRange.start?.toISOString() || ''}_${options.dateRange.end?.toISOString() || ''}_${options.data.length}`;
};

/**
 * Calculate comprehensive analytics for transaction data
 * This is the main analytics engine extracted from TransactionAnalyzer
 */
export const calculateAnalytics = (options: AnalyticsOptions): DetailedAnalytics | null => {
  const { data, marketplaceCode, selectedFulfillment, dateRange, config } = options;

  // Emergency: Skip analytics for very large datasets
  if (data.length > 200000) {
    console.warn(`⚠️ Dataset too large (${data.length} transactions). Analytics temporarily disabled.`);
    return null;
  }

  if (data.length === 0) return null;

  // Check cache first
  const cacheKey = getCacheKey(options);
  const cached = analyticsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  // ============================================
  // OPTIMIZED SINGLE-PASS CALCULATION
  // Process all data in one loop for maximum performance
  // ============================================

  // Pre-filter by date range and marketplace
  const startTime = dateRange.start?.getTime();
  const endTime = dateRange.end?.getTime();

  // Accumulators - initialized once
  let totalDisbursement = 0;
  let totalNet = 0;
  let totalSales = 0, fbaOrderSales = 0, fbmOrderSales = 0;
  let fbaOrderNet = 0, fbmOrderNet = 0;
  let totalFbaFees = 0, fbaSellingFees = 0, fbmSellingFees = 0, fbaOrderFees = 0;
  let advertisingCostTotal = 0, serviceTotal = 0;
  let adjustmentTotal = 0, inventoryTotal = 0;
  let totalAllFbaSales = 0, totalAllFbmSales = 0;

  // Arrays for items that need further processing
  const orders: TransactionData[] = [];
  const refunds: TransactionData[] = [];
  const disbursements: TransactionData[] = [];
  const fbaOrders: TransactionData[] = [];
  const fbmOrders: TransactionData[] = [];
  const allOrders: TransactionData[] = [];

  // Group accumulators
  const rawAdjustmentGroups: Record<string, GroupData> = {};
  const rawInventoryGroups: Record<string, GroupData> = {};
  const rawServiceGroups: Record<string, GroupData> = {};
  const rawOthersGroups: Record<string, GroupData> = {};
  const rawFbaCustomerReturnGroups: Record<string, GroupData> = {};
  const rawFbaTransactionGroups: Record<string, GroupData> = {};
  const rawAmazonFeesGroups: Record<string, GroupData> = {};
  const rawChargebackGroups: Record<string, GroupData> = {};
  const rawShippingServicesGroups: Record<string, GroupData> = {};

  // Additional accumulators
  let chargebackTotal = 0;
  let shippingServicesTotal = 0;
  let liquidationsTotal = 0;
  let totalVAT = 0;
  let fbaCustomerReturnTotal = 0;
  let fbaTransactionFeesTotal = 0;

  // Filtered data for later processing
  const allDataForCosts: TransactionData[] = [];

  // SINGLE PASS through all data
  for (let i = 0; i < data.length; i++) {
    const d = data[i];

    // Date filter
    if (startTime || endTime) {
      const itemTime = d.date?.getTime();
      if (!itemTime) continue;
      if (startTime && itemTime < startTime) continue;
      if (endTime && itemTime > endTime) continue;
    }

    // Marketplace filter
    if (marketplaceCode && d.marketplaceCode !== marketplaceCode) continue;

    // Item passed all filters - add to allDataForCosts
    allDataForCosts.push(d);

    const convertedTotal = convertTransactionValue(d.total, d, marketplaceCode);
    const convertedSales = convertTransactionValue(d.productSales, d, marketplaceCode);
    const convertedFbaFees = convertTransactionValue(Math.abs(d.fbaFees), d, marketplaceCode);
    const convertedSellingFees = convertTransactionValue(Math.abs(d.sellingFees), d, marketplaceCode);

    const cat = d.categoryType;
    const isFBA = d.fulfillment === 'FBA';
    const isFBM = d.fulfillment === 'FBM';
    const matchesFulfillment = selectedFulfillment === 'all' ||
      (selectedFulfillment === 'FBA' && isFBA) ||
      (selectedFulfillment === 'FBM' && isFBM);

    // Disbursement
    if (cat === 'Disbursement') {
      disbursements.push(d);
      totalDisbursement += Math.abs(convertedTotal);
    } else {
      // Total net excludes disbursements
      totalNet += convertedTotal;
    }

    // Orders
    if (cat === 'Order') {
      allOrders.push(d);
      if (isFBA) {
        totalAllFbaSales += convertedSales;
      } else if (isFBM) {
        totalAllFbmSales += convertedSales;
      }

      if (matchesFulfillment) {
        orders.push(d);
        totalSales += convertedSales;
        totalFbaFees += convertedFbaFees;

        if (isFBA) {
          fbaOrders.push(d);
          fbaOrderSales += convertedSales;
          fbaOrderNet += convertedTotal;
          fbaSellingFees += convertedSellingFees;
          fbaOrderFees += convertedFbaFees;
        } else if (isFBM) {
          fbmOrders.push(d);
          fbmOrderSales += convertedSales;
          fbmOrderNet += convertedTotal;
          fbmSellingFees += convertedSellingFees;
        }
      }
    }

    // Refunds
    if (cat === 'Refund' && matchesFulfillment) {
      refunds.push(d);
    }

    // Adjustments
    if (cat === 'Adjustment') {
      adjustmentTotal += convertedTotal;
      const key = Calc.normalizeAdjustmentDescription(d.description || 'Other');
      if (!rawAdjustmentGroups[key]) rawAdjustmentGroups[key] = { count: 0, total: 0 };
      rawAdjustmentGroups[key].count++;
      rawAdjustmentGroups[key].total += convertedTotal;
    }

    // FBA Inventory Fee
    if (cat === 'FBA Inventory Fee') {
      inventoryTotal += convertedTotal;
      const key = Calc.normalizeInventoryFeeDescription(d.description, d.orderId);
      if (!rawInventoryGroups[key]) rawInventoryGroups[key] = { count: 0, total: 0 };
      rawInventoryGroups[key].count++;
      rawInventoryGroups[key].total += convertedTotal;
    }

    // Service Fee (including advertising)
    if (cat === 'Service Fee') {
      const absTotal = convertTransactionValue(Math.abs(d.total), d, marketplaceCode);
      if (Calc.isAdvertisingTransaction(d.descriptionLower)) {
        advertisingCostTotal += absTotal;
      } else {
        serviceTotal += convertedTotal;
        const key = d.description || 'Other';
        if (!rawServiceGroups[key]) rawServiceGroups[key] = { count: 0, total: 0 };
        rawServiceGroups[key].count++;
        rawServiceGroups[key].total += convertedTotal;
      }
    }

    // Others
    if (cat === 'Others') {
      const key = d.description || 'Other';
      if (!rawOthersGroups[key]) rawOthersGroups[key] = { count: 0, total: 0 };
      rawOthersGroups[key].count++;
      rawOthersGroups[key].total += convertedTotal;
    }

    // FBA Customer Return Fee
    if (cat === 'FBA Customer Return Fee') {
      fbaCustomerReturnTotal += convertedTotal;
      const key = d.description || 'Customer Return Fee';
      if (!rawFbaCustomerReturnGroups[key]) rawFbaCustomerReturnGroups[key] = { count: 0, total: 0 };
      rawFbaCustomerReturnGroups[key].count++;
      rawFbaCustomerReturnGroups[key].total += convertedTotal;
    }

    // FBA Transaction Fee
    if (cat === 'FBA Transaction Fee') {
      fbaTransactionFeesTotal += convertedTotal;
      const key = d.description || 'Transaction Fee';
      if (!rawFbaTransactionGroups[key]) rawFbaTransactionGroups[key] = { count: 0, total: 0 };
      rawFbaTransactionGroups[key].count++;
      rawFbaTransactionGroups[key].total += convertedTotal;
    }

    // Amazon Fees
    if (cat === 'Amazon Fees') {
      const key = d.description || 'Other';
      if (!rawAmazonFeesGroups[key]) rawAmazonFeesGroups[key] = { count: 0, total: 0 };
      rawAmazonFeesGroups[key].count++;
      rawAmazonFeesGroups[key].total += convertedTotal;
    }

    // Chargeback Refund
    if (cat === 'Chargeback Refund') {
      chargebackTotal += convertedTotal;
      const key = d.sku || 'Unknown SKU';
      if (!rawChargebackGroups[key]) rawChargebackGroups[key] = { count: 0, total: 0 };
      rawChargebackGroups[key].count++;
      rawChargebackGroups[key].total += convertedTotal;
    }

    // Shipping Services (multi-language)
    if (cat === 'Shipping Services' || cat === 'Delivery Services' ||
        cat === 'Lieferdienste' || cat === 'Services de livraison' ||
        cat === 'Servizi di consegna' || cat === 'Servicios de entrega') {
      shippingServicesTotal += convertedTotal;
      const key = d.description || 'Shipping';
      if (!rawShippingServicesGroups[key]) rawShippingServicesGroups[key] = { count: 0, total: 0 };
      rawShippingServicesGroups[key].count++;
      rawShippingServicesGroups[key].total += convertedTotal;
    }

    // Liquidations
    if (cat === 'Liquidations') {
      liquidationsTotal += convertedTotal;
    }

    // VAT from orders (already in orders loop but need for all orders)
    if (cat === 'Order' && matchesFulfillment) {
      totalVAT += convertTransactionValue(d.vat, d, marketplaceCode);
    }
  }

  // Consolidate all groups
  const adjustmentGroups = Calc.consolidateSmallGroups(rawAdjustmentGroups, 10);
  const inventoryGroups = Calc.consolidateSmallGroups(rawInventoryGroups, 10);
  const serviceGroups = Calc.consolidateSmallGroups(rawServiceGroups, 10);
  const othersGroups = rawOthersGroups;
  const fbaCustomerReturnGroups = rawFbaCustomerReturnGroups;
  const fbaTransactionGroups = rawFbaTransactionGroups;
  const amazonFeesGroups = rawAmazonFeesGroups;
  const chargebackGroups = rawChargebackGroups;
  const shippingServicesGroups = rawShippingServicesGroups;

  // Derived values
  const totalSellingFees = fbaSellingFees + fbmSellingFees;
  const totalAllSales = totalAllFbaSales + totalAllFbmSales;

  // Refund calculations
  const refundRate = orders.length > 0 ? (refunds.length / orders.length * 100) : 0;
  const refundsWithConversion = refunds.map(r => ({
    ...r,
    total: convertTransactionValue(r.total, r, marketplaceCode),
    productSales: convertTransactionValue(r.productSales || 0, r, marketplaceCode)
  }));
  const { totalRefundAmount, recoveredRefunds, actualRefundLoss } =
    Calc.calculateRefundLoss(refundsWithConversion, marketplaceCode, config);

  const fbaAdvertisingCost = totalAllSales > 0 ? (advertisingCostTotal * totalAllFbaSales / totalAllSales) : 0;
  const fbmAdvertisingCost = totalAllSales > 0 ? (advertisingCostTotal * totalAllFbmSales / totalAllSales) : 0;

  // Debug logging (disabled - enable when debugging advertising issues)
  // if (process.env.NODE_ENV === 'development' && selectedFulfillment !== 'all') {
  //   console.log('🔍 Advertising Debug:', {
  //     selectedFulfillment,
  //     advertisingCostTotal,
  //     totalAllFbaSales,
  //     totalAllFbmSales,
  //     totalAllSales,
  //     fbaAdvertisingCost,
  //     fbmAdvertisingCost,
  //     fbaRatio: totalAllSales > 0 ? (totalAllFbaSales / totalAllSales * 100).toFixed(1) + '%' : 'N/A',
  //     fbmRatio: totalAllSales > 0 ? (totalAllFbmSales / totalAllSales * 100).toFixed(1) + '%' : 'N/A'
  //   });
  // }

  let displayAdvertisingCost = advertisingCostTotal;
  if (selectedFulfillment === 'FBA') {
    displayAdvertisingCost = fbaAdvertisingCost;
  } else if (selectedFulfillment === 'FBM') {
    displayAdvertisingCost = fbmAdvertisingCost;
  }

  // VAT: Only count if config has VAT (already calculated in loop)
  const finalVAT = config.hasVAT ? totalVAT : 0;

  // Total costs - conditional based on fulfillment filter
  const totalFBACost = selectedFulfillment === 'FBM' ? 0 : Calc.calculateFBACost(allDataForCosts, config);
  const totalFBMCost = selectedFulfillment === 'FBA' ? 0 : Calc.calculateFBMCost(allDataForCosts, config);

  // Debug: Check advertising values before pie chart (disabled)
  // if (process.env.NODE_ENV === 'development' && selectedFulfillment !== 'all') {
  //   console.log('🎯 Before Pie Chart Build:', {
  //     selectedFulfillment,
  //     fbaAdvertisingCost,
  //     fbmAdvertisingCost,
  //     advertisingCostTotal,
  //     willUseFBA: selectedFulfillment === 'FBA' ? fbaAdvertisingCost : 'N/A',
  //     willUseFBM: selectedFulfillment === 'FBM' ? fbmAdvertisingCost : 'N/A'
  //   });
  // }

  // Pie chart data
  const pieChartData = buildPieChartData({
    selectedFulfillment,
    fbaOrderSales,
    fbmOrderSales,
    totalSales,
    fbaSellingFees,
    fbmSellingFees,
    totalSellingFees,
    totalFbaFees,
    totalFBACost,
    totalFBMCost,
    fbaAdvertisingCost,
    fbmAdvertisingCost,
    advertisingCostTotal,
    actualRefundLoss,
    totalVAT,
    config
  });

  // Gross sales
  const grossSales = config.grossSalesFormula(totalSales, totalVAT);

  // Net profit
  const totalFees = totalSellingFees + totalFbaFees + totalFBACost + totalFBMCost;
  const netProfit = grossSales - totalFees - displayAdvertisingCost - actualRefundLoss;
  const profitMargin = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;

  // Percentages
  const fbaPercentage = totalSales > 0 ? (fbaOrderSales / totalSales) * 100 : 0;
  const fbmPercentage = totalSales > 0 ? (fbmOrderSales / totalSales) * 100 : 0;

  // Note: fbaTransactionFeesTotal and fbaCustomerReturnTotal already calculated in main loop
  // feeAdjustments and safetReimbursements need to be added to main loop if needed
  // For now, calculate them here (minor perf impact)
  let feeAdjustments = 0;
  let safetReimbursements = 0;
  for (const d of allDataForCosts) {
    if (d.categoryType === 'Fee Adjustment') {
      feeAdjustments += Math.abs(convertTransactionValue(d.total, d, marketplaceCode));
    } else if (d.categoryType === 'SAFE-T Reimbursement') {
      safetReimbursements += Math.abs(convertTransactionValue(d.total, d, marketplaceCode));
    }
  }

  const result: DetailedAnalytics = {
    // Core metrics
    totalOrders: orders.length,
    totalRefunds: refunds.length,
    totalSales,
    totalRefundAmount,

    // Fulfillment breakdown
    fbaOrders: fbaOrders.length,
    fbmOrders: fbmOrders.length,
    fbaSales: fbaOrderSales,
    fbmSales: fbmOrderSales,

    // Costs and fees
    totalFees,
    fbaFees: totalFbaFees,
    sellingFees: totalSellingFees,
    advertisingCost: displayAdvertisingCost,

    // VAT and liquidations
    totalVAT,
    totalLiquidations: liquidationsTotal,

    // Calculated metrics
    grossSales,
    netProfit,
    expectedRefundLoss: actualRefundLoss, // Keep same naming for compatibility
    actualRefundLoss,

    // Recovery and margins
    refundRecoveryRate: totalRefundAmount > 0 ? (recoveredRefunds / totalRefundAmount) : 0,
    profitMargin,

    // Shipping (FBM)
    fbmShippingRevenue: totalFBMCost,

    // Breakdowns (placeholders - will be populated if needed)
    byCountry: {},
    byZone: {},

    // Detailed breakdowns
    adjustmentGroups,
    inventoryGroups,
    serviceGroups,
    othersGroups,
    fbaCustomerReturnGroups,
    fbaTransactionGroups,
    amazonFeesGroups,
    chargebackGroups,
    shippingServicesGroups,

    // Totals
    adjustmentTotal,
    inventoryTotal,
    serviceTotal,
    chargebackTotal,
    liquidationsTotal,
    shippingServicesTotal,
    totalSellingFees,
    totalFBACost,
    totalFBMCost,
    totalFbaFees,
    totalAllSales,
    fbaTransactionFees: fbaTransactionFeesTotal,
    fbaTransactionTotal: fbaTransactionFeesTotal,
    fbaCustomerReturnTotal,
    feeAdjustments,
    safetReimbursements,

    // Order details
    fbaOrderSales,
    fbmOrderSales,
    fbaOrderNet,
    fbmOrderNet,
    fbaPercentage,
    fbmPercentage,

    // Fees breakdown
    fbaSellingFees,
    fbmSellingFees,
    fbaOrderFees,

    // Advertising
    fbaAdvertisingCost,
    fbmAdvertisingCost,
    displayAdvertisingCost,

    // Refunds
    recoveredRefunds,
    refundRate,

    // Other metrics
    totalDisbursement,
    totalNet,
    disbursements,
    postalZones: config.hasPostalZones && marketplaceCode ? Calc.calculatePostalZones(orders) : {},
    marketplaceSalesDistribution: !marketplaceCode ? Calc.calculateMarketplaceSalesDistribution(orders) : null,
    marketplacePieCharts: !marketplaceCode ? calculateMarketplacePieCharts(allDataForCosts, selectedFulfillment) : null,

    // Pie chart data
    pieChartData,
  };

  // Cache result for future requests
  analyticsCache.set(cacheKey, { result, timestamp: Date.now() });

  // Limit cache size (keep max 20 entries)
  if (analyticsCache.size > 20) {
    const firstKey = analyticsCache.keys().next().value;
    if (firstKey) analyticsCache.delete(firstKey);
  }

  return result;
};

/**
 * Calculate marketplace-specific pie charts (for "Tümü" mode)
 * IMPORTANT: Convert all values to USD for multi-marketplace comparison
 */
function calculateMarketplacePieCharts(
  allDataForCosts: TransactionData[],
  selectedFulfillment: 'all' | 'FBA' | 'FBM'
): Record<string, any> | null {
  // Group data by marketplace
  const marketplaces: Record<string, TransactionData[]> = {};

  allDataForCosts.forEach(item => {
    const mpCode = item.marketplaceCode || 'UNKNOWN';
    if (!marketplaces[mpCode]) {
      marketplaces[mpCode] = [];
    }
    marketplaces[mpCode].push(item);
  });

  const pieCharts: Record<string, any> = {};

  Object.entries(marketplaces).forEach(([mpCode, mpData]) => {
    const config = MARKETPLACE_CONFIGS[mpCode as MarketplaceCode];
    if (!config) return;

    // Get source currency for this marketplace
    const sourceCurrency = getMarketplaceCurrency(mpCode as MarketplaceCode);

    // Separate filtered data for orders/refunds and all data for costs
    const mpAllOrders = mpData.filter(d => d.categoryType === 'Order');
    const mpAllRefunds = mpData.filter(d => d.categoryType === 'Refund');

    // Filter orders/refunds by fulfillment
    const mpOrders = mpAllOrders.filter(d => selectedFulfillment === 'all' || d.fulfillment === selectedFulfillment);
    const mpRefunds = mpAllRefunds.filter(d => selectedFulfillment === 'all' || d.fulfillment === selectedFulfillment);

    // For costs: use all data but apply proportional advertising calculation
    const fbaOrders = mpAllOrders.filter(d => d.fulfillment === 'FBA');
    const fbmOrders = mpAllOrders.filter(d => d.fulfillment === 'FBM');

    // FIXED: Convert to USD for "Tümü" mode
    const fbaOrderSales = fbaOrders.reduce((sum, t) =>
      sum + convertCurrency(t.productSales, sourceCurrency, 'USD'), 0);
    const fbmOrderSales = fbmOrders.reduce((sum, t) =>
      sum + convertCurrency(t.productSales, sourceCurrency, 'USD'), 0);

    const totalSales = mpOrders.reduce((sum, t) =>
      sum + convertCurrency(t.productSales, sourceCurrency, 'USD'), 0);

    // Calculate costs - FIXED: Convert to USD
    const totalSellingFees = mpOrders.reduce((sum, d) =>
      sum + convertCurrency(Math.abs(d.sellingFees), sourceCurrency, 'USD'), 0);
    const totalFbaFees = mpOrders.reduce((sum, d) =>
      sum + convertCurrency(Math.abs(d.fbaFees), sourceCurrency, 'USD'), 0);

    // FBA/FBM costs - FIXED: Convert to USD
    const totalFBACost = selectedFulfillment === 'FBM' ? 0 : convertCurrency(
      Calc.calculateFBACost(mpData, config), sourceCurrency, 'USD');
    const totalFBMCost = selectedFulfillment === 'FBA' ? 0 : convertCurrency(
      Calc.calculateFBMCost(mpData, config), sourceCurrency, 'USD');

    // Advertising - proportional based on fulfillment filter - FIXED: Convert to USD
    const serviceFees = mpData.filter(d => d.categoryType === 'Service Fee');
    let allAdvertisingCost = 0;
    serviceFees.forEach(item => {
      if (Calc.isAdvertisingTransaction(item.descriptionLower)) {
        allAdvertisingCost += convertCurrency(Math.abs(item.total), sourceCurrency, 'USD');
      }
    });
    const advertisingCost = Calc.calculateAdvertisingCost(allAdvertisingCost, fbaOrderSales, fbmOrderSales, selectedFulfillment);

    // Refund loss - FIXED: Convert to USD
    const { actualRefundLoss } = Calc.calculateRefundLoss(mpRefunds, mpCode as MarketplaceCode, config);
    const actualRefundLossUSD = convertCurrency(actualRefundLoss, sourceCurrency, 'USD');

    // VAT - only from Orders, filter by fulfillment - FIXED: Convert to USD
    const totalVAT = mpOrders
      .reduce((sum, d) => sum + convertCurrency(d.vat, sourceCurrency, 'USD'), 0);

    // Build pie chart - adjust based on fulfillment filter
    const baseCosts: number[] = [];
    const baseLabels: string[] = [];
    const baseColors: string[] = [];

    if (selectedFulfillment === 'FBA') {
      // FBA only
      baseCosts.push(totalSellingFees, totalFbaFees, totalFBACost, advertisingCost, actualRefundLossUSD);
      baseLabels.push('Selling Fees', 'FBA Fees', 'FBA Cost', 'Advertising', 'Refund Loss');
      baseColors.push('#3b82f6', '#ef4444', '#8b5cf6', '#10b981', '#f97316');
    } else if (selectedFulfillment === 'FBM') {
      // FBM only
      baseCosts.push(totalSellingFees, totalFBMCost, advertisingCost, actualRefundLossUSD);
      baseLabels.push('Selling Fees', 'FBM Cost', 'Advertising', 'Refund Loss');
      baseColors.push('#3b82f6', '#ec4899', '#10b981', '#f97316');
    } else {
      // All
      baseCosts.push(totalSellingFees, totalFbaFees, totalFBACost, totalFBMCost, advertisingCost, actualRefundLossUSD);
      baseLabels.push('Selling Fees', 'FBA Fees', 'FBA Cost', 'FBM Cost', 'Advertising', 'Refund Loss');
      baseColors.push('#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#10b981', '#f97316');
    }

    if (config.hasVAT) {
      baseCosts.push(Math.abs(totalVAT));
      baseLabels.push('VAT');
      baseColors.push('#6366f1');
    }

    const netRemaining = Math.max(0, totalSales - baseCosts.reduce((sum, val) => sum + val, 0));
    baseCosts.push(netRemaining);
    baseLabels.push('Net');
    baseColors.push('#06b6d4');

    pieCharts[mpCode] = {
      values: baseCosts,
      labels: baseLabels,
      colors: baseColors,
      totalSales,
      totalOrders: mpOrders.length
    };
  });

  return Object.keys(pieCharts).length > 0 ? pieCharts : null;
}

/**
 * Build pie chart data based on fulfillment filter
 */
function buildPieChartData(params: {
  selectedFulfillment: 'all' | 'FBA' | 'FBM';
  fbaOrderSales: number;
  fbmOrderSales: number;
  totalSales: number;
  fbaSellingFees: number;
  fbmSellingFees: number;
  totalSellingFees: number;
  totalFbaFees: number;
  totalFBACost: number;
  totalFBMCost: number;
  fbaAdvertisingCost: number;
  fbmAdvertisingCost: number;
  advertisingCostTotal: number;
  actualRefundLoss: number;
  totalVAT: number;
  config: MarketplaceConfig;
}): { values: number[]; labels: string[]; colors: string[] } {
  const { selectedFulfillment, config } = params;

  if (selectedFulfillment === 'FBA') {
    const baseCosts = [
      params.fbaSellingFees,
      params.totalFbaFees,
      params.totalFBACost,
      params.fbaAdvertisingCost,
      params.actualRefundLoss
    ];
    const baseLabels = ['Selling Fees', 'FBA Fees', 'Total FBA Cost', 'Reklam', 'İade Kaybı'];
    const baseColors = ['#3b82f6', '#ef4444', '#8b5cf6', '#10b981', '#f97316'];

    // Debug log (disabled)
    // if (process.env.NODE_ENV === 'development') {
    //   console.log('📊 FBA Pie Chart Build:', {
    //     fbaSellingFees: params.fbaSellingFees,
    //     totalFbaFees: params.totalFbaFees,
    //     totalFBACost: params.totalFBACost,
    //     fbaAdvertisingCost: params.fbaAdvertisingCost,
    //     actualRefundLoss: params.actualRefundLoss,
    //     baseCosts,
    //     baseLabels
    //   });
    // }

    if (config.vatIncludedInPrice) {
      baseCosts.push(params.totalVAT);
      baseLabels.push('VAT');
      baseColors.push('#6366f1');
    }

    const netRemaining = Math.max(0, params.fbaOrderSales - baseCosts.reduce((sum, val) => sum + val, 0));
    baseCosts.push(netRemaining);
    baseLabels.push('Net Kalan');
    baseColors.push('#06b6d4');

    return { values: baseCosts, labels: baseLabels, colors: baseColors };
  } else if (selectedFulfillment === 'FBM') {
    const baseCosts = [
      params.fbmSellingFees,
      params.totalFBMCost,
      params.fbmAdvertisingCost,
      params.actualRefundLoss
    ];
    const baseLabels = ['Selling Fees', 'Total FBM Cost', 'Reklam', 'İade Kaybı'];
    const baseColors = ['#3b82f6', '#ec4899', '#10b981', '#f97316'];

    // Debug log (disabled)
    // if (process.env.NODE_ENV === 'development') {
    //   console.log('📊 FBM Pie Chart Build:', {
    //     fbmSellingFees: params.fbmSellingFees,
    //     totalFBMCost: params.totalFBMCost,
    //     fbmAdvertisingCost: params.fbmAdvertisingCost,
    //     actualRefundLoss: params.actualRefundLoss,
    //     baseCosts,
    //     baseLabels
    //   });
    // }

    if (config.vatIncludedInPrice) {
      baseCosts.push(params.totalVAT);
      baseLabels.push('VAT');
      baseColors.push('#6366f1');
    }

    const netRemaining = Math.max(0, params.fbmOrderSales - baseCosts.reduce((sum, val) => sum + val, 0));
    baseCosts.push(netRemaining);
    baseLabels.push('Net Kalan');
    baseColors.push('#06b6d4');

    return { values: baseCosts, labels: baseLabels, colors: baseColors };
  } else {
    // 'all' mode
    const baseCosts = [
      params.totalSellingFees,
      params.totalFbaFees,
      params.totalFBACost,
      params.totalFBMCost,
      params.advertisingCostTotal,
      params.actualRefundLoss
    ];
    const baseLabels = ['Selling Fees', 'FBA Fees', 'Total FBA Cost', 'Total FBM Cost', 'Reklam', 'İade Kaybı'];
    const baseColors = ['#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#10b981', '#f97316'];

    if (config.hasVAT) {
      baseCosts.push(Math.abs(params.totalVAT));
      baseLabels.push('VAT');
      baseColors.push('#6366f1');
    }

    const netRemaining = Math.max(0, params.totalSales - baseCosts.reduce((sum, val) => sum + val, 0));
    baseCosts.push(netRemaining);
    baseLabels.push('Net Kalan');
    baseColors.push('#06b6d4');

    return { values: baseCosts, labels: baseLabels, colors: baseColors };
  }
}
