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

  // Totals
  adjustmentTotal: number;
  inventoryTotal: number;
  serviceTotal: number;
  chargebackTotal: number;
  liquidationsTotal: number;
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

  // Filter data by date range and marketplace
  let allDataForCosts = Calc.filterByDateRange(data, dateRange.start, dateRange.end);
  allDataForCosts = Calc.filterByMarketplace(allDataForCosts, marketplaceCode);

  // Filter for orders/refunds based on fulfillment
  const allOrders = allDataForCosts.filter(d => d.categoryType === 'Order');
  const orders = Calc.filterByFulfillment(allOrders, selectedFulfillment);

  const allRefunds = allDataForCosts.filter(d => d.categoryType === 'Refund');
  const refunds = Calc.filterByFulfillment(allRefunds, selectedFulfillment);

  // Disbursements (with currency conversion for "All" view)
  const disbursements = allDataForCosts.filter(d => d.categoryType === 'Disbursement');
  const totalDisbursement = disbursements.reduce((sum, t) =>
    sum + Math.abs(convertTransactionValue(t.total, t, marketplaceCode)), 0);

  // Order breakdown
  const fbaOrders = orders.filter(d => d.fulfillment === 'FBA');
  const fbmOrders = orders.filter(d => d.fulfillment === 'FBM');

  // Sales calculations (with currency conversion for "All" view)
  const totalSales = orders.reduce((sum, t) =>
    sum + convertTransactionValue(t.productSales, t, marketplaceCode), 0);
  const fbaOrderSales = fbaOrders.reduce((sum, t) =>
    sum + convertTransactionValue(t.productSales, t, marketplaceCode), 0);
  const fbmOrderSales = fbmOrders.reduce((sum, t) =>
    sum + convertTransactionValue(t.productSales, t, marketplaceCode), 0);

  // Net calculations (with currency conversion for "All" view)
  const totalNet = allDataForCosts
    .filter(d => d.categoryType !== 'Disbursement')
    .reduce((sum, t) => sum + convertTransactionValue(t.total, t, marketplaceCode), 0);

  const fbaOrderNet = fbaOrders.reduce((sum, t) =>
    sum + convertTransactionValue(t.total, t, marketplaceCode), 0);
  const fbmOrderNet = fbmOrders.reduce((sum, t) =>
    sum + convertTransactionValue(t.total, t, marketplaceCode), 0);

  // Refund calculations (with currency conversion for "All" view)
  const refundRate = orders.length > 0 ? (refunds.length / orders.length * 100) : 0;

  // FIXED: Use calculateRefundLoss for consistent calculation across main chart and country charts
  // This function uses 'total' (net impact) and applies correct recovery rate per marketplace
  const refundsWithConversion = refunds.map(r => ({
    ...r,
    total: convertTransactionValue(r.total, r, marketplaceCode),
    productSales: convertTransactionValue(r.productSales || 0, r, marketplaceCode)
  }));
  const { totalRefundAmount, recoveredRefunds, actualRefundLoss } =
    Calc.calculateRefundLoss(refundsWithConversion, marketplaceCode, config);

  // Fee calculations (with currency conversion for "All" view)
  const totalFbaFees = orders.reduce((sum, t) =>
    sum + convertTransactionValue(Math.abs(t.fbaFees), t, marketplaceCode), 0);
  const fbaSellingFees = fbaOrders.reduce((sum, t) =>
    sum + convertTransactionValue(Math.abs(t.sellingFees), t, marketplaceCode), 0);
  const fbmSellingFees = fbmOrders.reduce((sum, t) =>
    sum + convertTransactionValue(Math.abs(t.sellingFees), t, marketplaceCode), 0);
  const fbaOrderFees = fbaOrders.reduce((sum, t) =>
    sum + convertTransactionValue(Math.abs(t.fbaFees), t, marketplaceCode), 0);
  const totalSellingFees = fbaSellingFees + fbmSellingFees;

  // Group calculations (with currency conversion for "All" view)
  const adjustments = allDataForCosts.filter(d => d.categoryType === 'Adjustment');
  const adjustmentGroups = Calc.groupTransactions(adjustments, d => d.description || 'Other');
  const adjustmentTotal = adjustments.reduce((sum, t) =>
    sum + convertTransactionValue(t.total, t, marketplaceCode), 0);

  const fbaInventoryFees = allDataForCosts.filter(d => d.categoryType === 'FBA Inventory Fee');
  const inventoryGroups = Calc.groupTransactions(
    fbaInventoryFees,
    d => Calc.normalizeInventoryFeeDescription(d.description)
  );
  const inventoryTotal = fbaInventoryFees.reduce((sum, t) =>
    sum + convertTransactionValue(t.total, t, marketplaceCode), 0);

  // Service fees and advertising (with currency conversion for "All" view)
  const serviceFees = allDataForCosts.filter(d => d.categoryType === 'Service Fee');
  const serviceGroups: Record<string, GroupData> = {};
  let advertisingCostTotal = 0;
  let serviceTotal = 0;

  serviceFees.forEach(item => {
    const convertedTotal = convertTransactionValue(Math.abs(item.total), item, marketplaceCode);
    if (Calc.isAdvertisingTransaction(item.descriptionLower)) {
      advertisingCostTotal += convertedTotal;
    } else {
      const key = item.description || 'Other';
      if (!serviceGroups[key]) serviceGroups[key] = { count: 0, total: 0 };
      serviceGroups[key].count++;
      serviceGroups[key].total += convertTransactionValue(item.total, item, marketplaceCode);
      serviceTotal += convertTransactionValue(item.total, item, marketplaceCode);
    }
  });

  // Advertising cost distribution - use ALL orders (not filtered) for ratio calculation
  // Apply currency conversion for "All" view
  const allFbaOrders = allOrders.filter(d => d.fulfillment === 'FBA');
  const allFbmOrders = allOrders.filter(d => d.fulfillment === 'FBM');
  const totalAllFbaSales = allFbaOrders.reduce((sum, t) =>
    sum + convertTransactionValue(t.productSales, t, marketplaceCode), 0);
  const totalAllFbmSales = allFbmOrders.reduce((sum, t) =>
    sum + convertTransactionValue(t.productSales, t, marketplaceCode), 0);
  const totalAllSales = totalAllFbaSales + totalAllFbmSales;

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

  // Other fee groups
  const others = allDataForCosts.filter(d => d.categoryType === 'Others');
  const othersGroups = Calc.groupTransactions(others, d => d.description || 'Other');

  const fbaCustomerReturnFees = allDataForCosts.filter(d => d.categoryType === 'FBA Customer Return Fee');
  const fbaCustomerReturnGroups = Calc.groupTransactions(fbaCustomerReturnFees, d => d.description || 'Customer Return Fee');

  const fbaTransactionFeesData = allDataForCosts.filter(d => d.categoryType === 'FBA Transaction Fee');
  const fbaTransactionGroups = Calc.groupTransactions(fbaTransactionFeesData, d => d.description || 'Transaction Fee');

  const amazonFees = allDataForCosts.filter(d => d.categoryType === 'Amazon Fees');
  const amazonFeesGroups = Calc.groupTransactions(amazonFees, d => d.description || 'Other');

  const chargebacks = allDataForCosts.filter(d => d.categoryType === 'Chargeback Refund');
  const chargebackGroups = Calc.groupTransactions(chargebacks, d => d.sku || 'Unknown SKU');
  const chargebackTotal = chargebacks.reduce((sum, t) =>
    sum + convertTransactionValue(t.total, t, marketplaceCode), 0);

  // Liquidations (with currency conversion for "All" view)
  const liquidationsTotal = config.hasLiquidations
    ? allDataForCosts
        .filter(d => d.categoryType === 'Liquidations')
        .reduce((sum, t) => sum + convertTransactionValue(t.total, t, marketplaceCode), 0)
    : 0;

  // VAT calculation (with currency conversion for "All" view)
  const totalVAT = config.hasVAT
    ? orders.reduce((sum, t) => sum + convertTransactionValue(t.vat, t, marketplaceCode), 0)
    : 0;

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

  // Additional totals (with currency conversion for "All" view)
  const fbaTransactionFeesTotal = Math.abs(fbaTransactionFeesData.reduce((sum, t) =>
    sum + convertTransactionValue(t.total, t, marketplaceCode), 0));
  const fbaCustomerReturnTotal = Math.abs(fbaCustomerReturnFees.reduce((sum, t) =>
    sum + convertTransactionValue(t.total, t, marketplaceCode), 0));
  const feeAdjustments = Math.abs(allDataForCosts
    .filter(d => d.categoryType === 'Fee Adjustment')
    .reduce((sum, t) => sum + convertTransactionValue(t.total, t, marketplaceCode), 0));
  const safetReimbursements = Math.abs(allDataForCosts
    .filter(d => d.categoryType === 'SAFE-T Reimbursement')
    .reduce((sum, t) => sum + convertTransactionValue(t.total, t, marketplaceCode), 0));

  return {
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

    // Totals
    adjustmentTotal,
    inventoryTotal,
    serviceTotal,
    chargebackTotal,
    liquidationsTotal,
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
