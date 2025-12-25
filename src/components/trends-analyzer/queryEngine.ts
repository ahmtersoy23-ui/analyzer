/**
 * Query Engine - Executes queries against transaction data
 * Converts QueryParams into actual results
 */

import type { TransactionData } from '../../types/transaction';
import type { QueryParams, QueryMetric, QueryGroupBy, QueryDatePreset } from './QueryBuilder';
import type { QueryResults, QueryResultItem } from './QueryResultsPanel';
import { convertCurrency, getMarketplaceCurrency } from '../../utils/currencyExchange';

// ============================================
// DATE RANGE CALCULATION
// ============================================

export const getDateRangeFromPreset = (preset: QueryDatePreset, customRange?: { start: string; end: string }): { start: Date; end: Date } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'last7days':
      return {
        start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: today
      };

    case 'last30days':
      return {
        start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: today
      };

    case 'last90days':
      return {
        start: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
        end: today
      };

    case 'lastMonth': {
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: firstOfLastMonth, end: lastOfLastMonth };
    }

    case 'last3months':
      return {
        start: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
        end: today
      };

    case 'lastYear':
      return {
        start: new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000),
        end: today
      };

    case 'custom':
      if (customRange) {
        return {
          start: new Date(customRange.start),
          end: new Date(customRange.end)
        };
      }
      // Fallback to last 30 days
      return {
        start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: today
      };

    default:
      return {
        start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: today
      };
  }
};

// ============================================
// AGGREGATION HELPERS
// ============================================

interface AggregatedItem {
  key: string;
  label: string;
  revenue: number;
  profit: number;
  orders: Set<string>;
  quantity: number;
  sellingFees: number;
  fbaFees: number;
  refundAmount: number;
  refundOrders: Set<string>;
  costOfGoods: number;
  sku?: string;
  category?: string;
  marketplace?: string;
}

const createEmptyAggregation = (key: string, label: string): AggregatedItem => ({
  key,
  label,
  revenue: 0,
  profit: 0,
  orders: new Set(),
  quantity: 0,
  sellingFees: 0,
  fbaFees: 0,
  refundAmount: 0,
  refundOrders: new Set(),
  costOfGoods: 0,
});

const getGroupKey = (tx: TransactionData, groupBy: QueryGroupBy): { key: string; label: string } => {
  switch (groupBy) {
    case 'country':
      return {
        key: tx.marketplaceCode || 'Unknown',
        label: tx.marketplaceCode || 'Unknown'
      };

    case 'category':
      return {
        key: tx.productCategory || 'Uncategorized',
        label: tx.productCategory || 'Uncategorized'
      };

    case 'sku':
      return {
        key: tx.sku || 'Unknown SKU',
        label: tx.sku || 'Unknown SKU'
      };

    case 'product':
      // Use product name as primary, with SKU fallback
      const productLabel = tx.name || tx.sku || 'Unknown Product';
      return {
        key: tx.sku || productLabel,  // Key by SKU for uniqueness
        label: productLabel.length > 50 ? productLabel.substring(0, 50) + '...' : productLabel
      };

    case 'fulfillment':
      return {
        key: tx.fulfillment || 'Unknown',
        label: tx.fulfillment || 'Unknown'
      };

    default:
      return { key: 'Unknown', label: 'Unknown' };
  }
};

// ============================================
// MAIN QUERY EXECUTOR
// ============================================

export const executeQuery = (
  transactionData: TransactionData[],
  query: QueryParams
): QueryResults => {
  // Calculate date range
  const dateRange = getDateRangeFromPreset(query.datePreset, query.customDateRange);

  // Filter transactions by date and other filters
  const filtered = transactionData.filter(tx => {
    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);

    // Date filter
    if (txDate < dateRange.start || txDate > dateRange.end) return false;

    // Marketplace filter
    if (query.filters.marketplace && query.filters.marketplace.length > 0) {
      if (!query.filters.marketplace.includes(tx.marketplaceCode || '')) return false;
    }

    // Fulfillment filter
    if (query.filters.fulfillment) {
      if (tx.fulfillment !== query.filters.fulfillment) return false;
    }

    // Category filter
    if (query.filters.category) {
      if (tx.productCategory !== query.filters.category) return false;
    }

    return true;
  });

  // Aggregate by group
  const aggregations = new Map<string, AggregatedItem>();

  filtered.forEach(tx => {
    const { key, label } = getGroupKey(tx, query.groupBy);
    const marketplace = tx.marketplaceCode || 'US';
    const sourceCurrency = getMarketplaceCurrency(marketplace);

    if (!aggregations.has(key)) {
      const agg = createEmptyAggregation(key, label);
      agg.sku = tx.sku;
      agg.category = tx.productCategory;
      agg.marketplace = marketplace;
      aggregations.set(key, agg);
    }

    const agg = aggregations.get(key)!;

    if (tx.type === 'Order') {
      const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
      const usdRevenue = convertCurrency(localRevenue, sourceCurrency, 'USD');
      const usdSellingFees = convertCurrency(Math.abs(tx.sellingFees || 0), sourceCurrency, 'USD');
      const usdFbaFees = convertCurrency(Math.abs(tx.fbaFees || 0), sourceCurrency, 'USD');
      const usdCost = convertCurrency(Math.abs(tx.productCost || 0), sourceCurrency, 'USD');

      agg.revenue += usdRevenue;
      agg.sellingFees += usdSellingFees;
      agg.fbaFees += usdFbaFees;
      agg.costOfGoods += usdCost;

      if (tx.orderId) {
        agg.orders.add(tx.orderId);
      }

      const qty = Math.abs(tx.quantity || 0);
      agg.quantity += qty;

      // Calculate profit: Revenue - Fees - Cost
      agg.profit = agg.revenue - agg.sellingFees - agg.fbaFees - agg.costOfGoods;
    }

    if (tx.type === 'Refund') {
      const refundAmount = convertCurrency(Math.abs(tx.productSales || 0), sourceCurrency, 'USD');
      agg.refundAmount += refundAmount;
      if (tx.orderId) {
        agg.refundOrders.add(tx.orderId);
      }
    }
  });

  // Convert to result items with selected metric
  const getMetricValue = (agg: AggregatedItem, metric: QueryMetric): number => {
    switch (metric) {
      case 'revenue': return agg.revenue;
      case 'profit': return agg.profit;
      case 'orders': return agg.orders.size;
      case 'quantity': return agg.quantity;
      case 'refundRate': return agg.orders.size > 0 ? (agg.refundOrders.size / agg.orders.size) * 100 : 0;
      case 'avgOrderValue': return agg.orders.size > 0 ? agg.revenue / agg.orders.size : 0;
      case 'sellingFees': return agg.sellingFees;
      case 'fbaFees': return agg.fbaFees;
      default: return 0;
    }
  };

  let items: QueryResultItem[] = Array.from(aggregations.values()).map(agg => ({
    key: agg.key,
    label: agg.label,
    value: getMetricValue(agg, query.metric),
    metadata: {
      sku: agg.sku,
      category: agg.category,
      marketplace: agg.marketplace,
      quantity: agg.quantity,
      orders: agg.orders.size,
      revenue: agg.revenue,
      profit: agg.profit,
      refundRate: agg.orders.size > 0 ? (agg.refundOrders.size / agg.orders.size) * 100 : 0,
    }
  }));

  // Sort by value
  items.sort((a, b) => {
    if (query.sort === 'asc') {
      return a.value - b.value;
    }
    return b.value - a.value;
  });

  // Apply limit
  items = items.slice(0, query.limit);

  // Calculate summary
  const totalValue = items.reduce((sum, item) => sum + item.value, 0);

  return {
    query,
    items,
    summary: {
      total: totalValue,
      count: items.length,
      dateRange: {
        start: dateRange.start.toISOString().slice(0, 10),
        end: dateRange.end.toISOString().slice(0, 10),
      }
    },
    generatedAt: new Date(),
  };
};
