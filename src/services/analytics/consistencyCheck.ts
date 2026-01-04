/**
 * Data Consistency Check Service
 * Compares calculations between different analyzers to detect discrepancies
 */

import { TransactionData, MarketplaceCode } from '../../types/transaction';
import { isDateInRange } from './calculations';
import { isAdvertisingTransaction } from './calculations';
import { convertCurrency, getMarketplaceCurrency } from '../../utils/currencyExchange';
import { getDateOnly } from '../../utils/formatters';

// Threshold for acceptable difference (percentage)
const REVENUE_TOLERANCE_PERCENT = 1; // 1% difference is acceptable
const COST_TOLERANCE_PERCENT = 5; // 5% for costs (rounding differences)

export interface ConsistencyCheckResult {
  isConsistent: boolean;
  checks: {
    name: string;
    passed: boolean;
    expected: number;
    actual: number;
    difference: number;
    differencePercent: number;
    severity: 'info' | 'warning' | 'error';
    message: string;
  }[];
  summary: string;
}

export interface AnalyzerMetrics {
  totalRevenue: number;
  totalOrders: number;
  advertisingCost: number;
  refundCount: number;
  marketplace: MarketplaceCode | 'all';
  dateRange: { start: string | null; end: string | null };
}

/**
 * Calculate base metrics from raw transactions
 * This is the "source of truth" calculation
 */
export const calculateBaseMetrics = (
  transactions: TransactionData[],
  marketplace: MarketplaceCode | 'all',
  startDate: string | null,
  endDate: string | null
): AnalyzerMetrics => {
  // Filter by date and marketplace
  const filtered = transactions.filter(t => {
    if (!isDateInRange(getDateOnly(t), startDate, endDate)) return false;
    if (marketplace !== 'all' && t.marketplaceCode !== marketplace) return false;
    return true;
  });

  // Calculate revenue from Orders
  const orders = filtered.filter(t => t.categoryType === 'Order');
  const totalRevenue = orders.reduce((sum, t) => {
    if (marketplace === 'all' && t.marketplaceCode) {
      const currency = getMarketplaceCurrency(t.marketplaceCode);
      return sum + convertCurrency(t.productSales || 0, currency, 'USD');
    }
    return sum + (t.productSales || 0);
  }, 0);

  // Calculate advertising cost
  const serviceFees = filtered.filter(t => t.categoryType === 'Service Fee');
  const advertisingCost = serviceFees
    .filter(t => isAdvertisingTransaction(t.descriptionLower || ''))
    .reduce((sum, t) => {
      if (marketplace === 'all' && t.marketplaceCode) {
        const currency = getMarketplaceCurrency(t.marketplaceCode);
        return sum + convertCurrency(Math.abs(t.total || 0), currency, 'USD');
      }
      return sum + Math.abs(t.total || 0);
    }, 0);

  // Count refunds
  const refunds = filtered.filter(t => t.categoryType === 'Refund');

  return {
    totalRevenue,
    totalOrders: orders.length,
    advertisingCost,
    refundCount: refunds.length,
    marketplace,
    dateRange: { start: startDate, end: endDate },
  };
};

/**
 * Compare two sets of metrics and report discrepancies
 */
export const compareMetrics = (
  baseMetrics: AnalyzerMetrics,
  comparedMetrics: AnalyzerMetrics,
  sourceName: string
): ConsistencyCheckResult => {
  const checks: ConsistencyCheckResult['checks'] = [];
  let hasError = false;
  let hasWarning = false;

  // Revenue check
  const revenueDiff = Math.abs(baseMetrics.totalRevenue - comparedMetrics.totalRevenue);
  const revenuePercent = baseMetrics.totalRevenue > 0
    ? (revenueDiff / baseMetrics.totalRevenue) * 100
    : 0;

  const revenueCheck = {
    name: 'Total Revenue',
    passed: revenuePercent <= REVENUE_TOLERANCE_PERCENT,
    expected: baseMetrics.totalRevenue,
    actual: comparedMetrics.totalRevenue,
    difference: revenueDiff,
    differencePercent: revenuePercent,
    severity: revenuePercent > REVENUE_TOLERANCE_PERCENT * 2 ? 'error' as const :
              revenuePercent > REVENUE_TOLERANCE_PERCENT ? 'warning' as const : 'info' as const,
    message: revenuePercent <= REVENUE_TOLERANCE_PERCENT
      ? 'Revenue matches'
      : `Revenue differs by ${revenuePercent.toFixed(2)}% ($${revenueDiff.toFixed(2)})`
  };
  checks.push(revenueCheck);
  if (revenueCheck.severity === 'error') hasError = true;
  if (revenueCheck.severity === 'warning') hasWarning = true;

  // Order count check
  const orderDiff = Math.abs(baseMetrics.totalOrders - comparedMetrics.totalOrders);
  const orderPercent = baseMetrics.totalOrders > 0
    ? (orderDiff / baseMetrics.totalOrders) * 100
    : 0;

  const orderCheck = {
    name: 'Order Count',
    passed: orderDiff === 0,
    expected: baseMetrics.totalOrders,
    actual: comparedMetrics.totalOrders,
    difference: orderDiff,
    differencePercent: orderPercent,
    severity: orderDiff > 0 ? 'warning' as const : 'info' as const,
    message: orderDiff === 0
      ? 'Order count matches'
      : `Order count differs by ${orderDiff} (${orderPercent.toFixed(2)}%)`
  };
  checks.push(orderCheck);
  if (orderCheck.severity === 'warning') hasWarning = true;

  // Advertising cost check
  const adsDiff = Math.abs(baseMetrics.advertisingCost - comparedMetrics.advertisingCost);
  const adsPercent = baseMetrics.advertisingCost > 0
    ? (adsDiff / baseMetrics.advertisingCost) * 100
    : 0;

  const adsCheck = {
    name: 'Advertising Cost',
    passed: adsPercent <= COST_TOLERANCE_PERCENT,
    expected: baseMetrics.advertisingCost,
    actual: comparedMetrics.advertisingCost,
    difference: adsDiff,
    differencePercent: adsPercent,
    severity: adsPercent > COST_TOLERANCE_PERCENT * 2 ? 'error' as const :
              adsPercent > COST_TOLERANCE_PERCENT ? 'warning' as const : 'info' as const,
    message: adsPercent <= COST_TOLERANCE_PERCENT
      ? 'Advertising cost matches'
      : `Advertising cost differs by ${adsPercent.toFixed(2)}% ($${adsDiff.toFixed(2)})`
  };
  checks.push(adsCheck);
  if (adsCheck.severity === 'error') hasError = true;
  if (adsCheck.severity === 'warning') hasWarning = true;

  // Summary
  const failedChecks = checks.filter(c => !c.passed);
  let summary = '';
  if (failedChecks.length === 0) {
    summary = `All ${checks.length} consistency checks passed for ${sourceName}`;
  } else if (hasError) {
    summary = `${failedChecks.length} consistency issues found in ${sourceName} (requires attention)`;
  } else if (hasWarning) {
    summary = `${failedChecks.length} minor discrepancies in ${sourceName}`;
  } else {
    summary = `${sourceName} data is consistent`;
  }

  return {
    isConsistent: !hasError && !hasWarning,
    checks,
    summary,
  };
};

/**
 * Run consistency check across all analyzers
 */
export const runFullConsistencyCheck = (
  transactions: TransactionData[],
  transactionAnalyzerMetrics: AnalyzerMetrics,
  profitabilityAnalyzerMetrics: AnalyzerMetrics,
  productAnalyzerMetrics?: AnalyzerMetrics
): {
  overall: boolean;
  results: {
    transactionVsBase: ConsistencyCheckResult;
    profitabilityVsBase: ConsistencyCheckResult;
    productVsBase?: ConsistencyCheckResult;
  };
} => {
  // Calculate base metrics (source of truth)
  const baseMetrics = calculateBaseMetrics(
    transactions,
    transactionAnalyzerMetrics.marketplace,
    transactionAnalyzerMetrics.dateRange.start,
    transactionAnalyzerMetrics.dateRange.end
  );

  const transactionVsBase = compareMetrics(baseMetrics, transactionAnalyzerMetrics, 'Transaction Analyzer');
  const profitabilityVsBase = compareMetrics(baseMetrics, profitabilityAnalyzerMetrics, 'Profitability Analyzer');
  const productVsBase = productAnalyzerMetrics
    ? compareMetrics(baseMetrics, productAnalyzerMetrics, 'Product Analyzer')
    : undefined;

  return {
    overall: transactionVsBase.isConsistent && profitabilityVsBase.isConsistent && (!productVsBase || productVsBase.isConsistent),
    results: {
      transactionVsBase,
      profitabilityVsBase,
      productVsBase,
    },
  };
};
