/**
 * Phase 4: Trends Analyzer
 * Comprehensive time-series analysis with multiple view modes and metrics
 * All monetary values converted to USD for accurate comparison
 */

import React, { useState, useMemo, useCallback } from 'react';
import { TrendingUp, BarChart3, Calendar, DollarSign, RefreshCw, Globe, Package, Layers, Eye, EyeOff, Percent, Truck, Clock } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import type { TransactionData } from '../types/transaction';
import { convertCurrency, getMarketplaceCurrency } from '../utils/currencyExchange';
import { createMoneyFormatter } from '../utils/formatters';
import {
  QueryBuilder,
  QueryResultsPanel,
  executeQuery,
  FbmShippingAnalyzer,
  OrderHourAnalyzer,
  type QueryParams,
  type QueryResults,
} from './trends-analyzer';

// ============================================
// CONSTANTS
// ============================================

const COUNTRY_COLORS: Record<string, string> = {
  US: '#3b82f6', UK: '#ef4444', DE: '#f59e0b', FR: '#8b5cf6',
  IT: '#10b981', ES: '#f97316', CA: '#ec4899', AU: '#06b6d4',
  AE: '#84cc16', SA: '#6366f1', SG: '#14b8a6', TR: '#e11d48',
};

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸', UK: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸',
  CA: '🇨🇦', AU: '🇦🇺', AE: '🇦🇪', SA: '🇸🇦', SG: '🇸🇬', TR: '🇹🇷',
};

// Category colors (generated dynamically but with some presets)
const CATEGORY_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#f97316',
  '#14b8a6', '#e11d48', '#0ea5e9', '#22c55e', '#a855f7',
];

// ============================================
// TYPES
// ============================================

interface TrendsAnalyzerProps {
  transactionData: TransactionData[];
}

type ViewMode = 'country' | 'category' | 'fulfillment';
type GranularityType = 'daily' | 'weekly' | 'monthly';
type ChartType = 'line' | 'area' | 'stacked';

// Comprehensive metrics
type MetricType =
  | 'revenue'           // Total revenue (USD)
  | 'orders'            // Order count
  | 'quantity'          // Units sold
  | 'avgOrderValue'     // Average order value
  | 'sellingFeesPct'    // Selling fees as % of revenue
  | 'fbaFeesPct'        // FBA fees as % of revenue
  | 'refundRate'        // Refunds as % of orders
  | 'fbaRevenue'        // FBA revenue only
  | 'fbmRevenue'        // FBM revenue only
  | 'fbaQuantity'       // FBA units
  | 'fbmQuantity';      // FBM units

interface MetricConfig {
  label: string;
  shortLabel: string;
  format: 'money' | 'number' | 'percent';
  description: string;
  group: 'sales' | 'fees' | 'fulfillment';
}

const METRIC_CONFIGS: Record<MetricType, MetricConfig> = {
  revenue: { label: 'Revenue (USD)', shortLabel: 'Revenue', format: 'money', description: 'Total sales revenue', group: 'sales' },
  orders: { label: 'Orders', shortLabel: 'Orders', format: 'number', description: 'Number of orders', group: 'sales' },
  quantity: { label: 'Quantity', shortLabel: 'Qty', format: 'number', description: 'Units sold', group: 'sales' },
  avgOrderValue: { label: 'Avg Order Value', shortLabel: 'AOV', format: 'money', description: 'Average revenue per order', group: 'sales' },
  sellingFeesPct: { label: 'Selling Fees %', shortLabel: 'Sell%', format: 'percent', description: 'Selling fees as % of revenue', group: 'fees' },
  fbaFeesPct: { label: 'FBA Fees %', shortLabel: 'FBA%', format: 'percent', description: 'FBA fees as % of revenue', group: 'fees' },
  refundRate: { label: 'Refund Rate %', shortLabel: 'Refund%', format: 'percent', description: 'Refunds as % of orders', group: 'fees' },
  fbaRevenue: { label: 'FBA Revenue', shortLabel: 'FBA Rev', format: 'money', description: 'Revenue from FBA orders', group: 'fulfillment' },
  fbmRevenue: { label: 'FBM Revenue', shortLabel: 'FBM Rev', format: 'money', description: 'Revenue from FBM orders', group: 'fulfillment' },
  fbaQuantity: { label: 'FBA Quantity', shortLabel: 'FBA Qty', format: 'number', description: 'Units sold via FBA', group: 'fulfillment' },
  fbmQuantity: { label: 'FBM Quantity', shortLabel: 'FBM Qty', format: 'number', description: 'Units sold via FBM', group: 'fulfillment' },
};

interface TimeSeriesPoint {
  date: string;
  label: string;
  total: number;
  [key: string]: string | number;
}

interface AggregatedData {
  revenue: number;
  orders: Set<string>;
  quantity: number;
  sellingFees: number;
  fbaFees: number;
  refunds: number;
  refundOrders: Set<string>;
  fbaRevenue: number;
  fbmRevenue: number;
  fbaQuantity: number;
  fbmQuantity: number;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getAutoGranularity = (startDate: Date, endDate: Date): GranularityType => {
  const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 31) return 'daily';
  if (diffDays <= 120) return 'weekly';
  return 'monthly';
};

const getWeekKey = (date: Date): string => {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
};

const getMonthKey = (date: Date): string => {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
};

const getDayKey = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

const formatLabel = (key: string, granularity: GranularityType): string => {
  if (granularity === 'daily') {
    const d = new Date(key);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (granularity === 'weekly') {
    const [, week] = key.split('-W');
    return `W${week}`;
  }
  const [year, month] = key.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

const createEmptyAggregatedData = (): AggregatedData => ({
  revenue: 0,
  orders: new Set(),
  quantity: 0,
  sellingFees: 0,
  fbaFees: 0,
  refunds: 0,
  refundOrders: new Set(),
  fbaRevenue: 0,
  fbmRevenue: 0,
  fbaQuantity: 0,
  fbmQuantity: 0,
});

// ============================================
// MAIN COMPONENT
// ============================================

type AnalyzerTab = 'trends' | 'fbm-shipping' | 'order-hours';

const TrendsAnalyzer: React.FC<TrendsAnalyzerProps> = ({ transactionData }) => {
  // ============================================
  // STATE
  // ============================================
  const [activeTab, setActiveTab] = useState<AnalyzerTab>('trends');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('country');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('revenue');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [manualGranularity, setManualGranularity] = useState<GranularityType | 'auto'>('auto');
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [topN, setTopN] = useState<number>(10);

  // Query Builder State
  const [queryResults, setQueryResults] = useState<QueryResults | null>(null);
  const [isQueryLoading, setIsQueryLoading] = useState(false);

  const formatMoney = createMoneyFormatter('USD');

  // ============================================
  // MEMOIZED CALCULATIONS
  // ============================================

  // Date range from data
  const dataDateRange = useMemo(() => {
    if (transactionData.length === 0) return { min: '', max: '' };
    let minDate = new Date();
    let maxDate = new Date(0);
    transactionData.forEach(tx => {
      const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
      if (txDate < minDate) minDate = txDate;
      if (txDate > maxDate) maxDate = txDate;
    });
    return {
      min: minDate.toISOString().slice(0, 10),
      max: maxDate.toISOString().slice(0, 10),
    };
  }, [transactionData]);

  // Categories list
  const categories = useMemo(() => {
    const cats = new Set<string>();
    transactionData.forEach(tx => {
      if (tx.productCategory) cats.add(tx.productCategory);
    });
    return ['all', ...Array.from(cats).sort()];
  }, [transactionData]);

  // Marketplaces list (for QueryBuilder)
  const marketplaces = useMemo(() => {
    const mps = new Set<string>();
    transactionData.forEach(tx => {
      if (tx.marketplaceCode) mps.add(tx.marketplaceCode);
    });
    return Array.from(mps).sort();
  }, [transactionData]);

  // Effective dates
  const effectiveStartDate = startDate || dataDateRange.min;
  const effectiveEndDate = endDate || dataDateRange.max;

  // Granularity
  const granularity = useMemo(() => {
    if (manualGranularity !== 'auto') return manualGranularity;
    if (!effectiveStartDate || !effectiveEndDate) return 'monthly';
    return getAutoGranularity(new Date(effectiveStartDate), new Date(effectiveEndDate));
  }, [manualGranularity, effectiveStartDate, effectiveEndDate]);

  // Main data calculation - comprehensive aggregation
  const { timeSeriesData, seriesKeys, totals, seriesLabels, seriesColors } = useMemo(() => {
    if (!effectiveStartDate || !effectiveEndDate) {
      return { timeSeriesData: [], seriesKeys: [], totals: {} as Record<string, AggregatedData>, seriesLabels: {}, seriesColors: {} };
    }

    const startD = new Date(effectiveStartDate);
    const endD = new Date(effectiveEndDate);

    // Filter transactions by date and category
    const filtered = transactionData.filter(tx => {
      const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
      if (txDate < startD || txDate > endD) return false;
      if (selectedCategory !== 'all' && tx.productCategory !== selectedCategory) return false;
      return true;
    });

    // Determine grouping key based on view mode
    const getGroupKey = (tx: TransactionData): string => {
      switch (viewMode) {
        case 'country':
          return tx.marketplaceCode || 'Unknown';
        case 'category':
          return tx.productCategory || 'Unknown';
        case 'fulfillment':
          return tx.fulfillment || 'Unknown';
        default:
          return 'Unknown';
      }
    };

    // Group by time bucket and series
    const buckets = new Map<string, Map<string, AggregatedData>>();
    const allSeriesKeys = new Set<string>();
    const seriesTotals: Record<string, AggregatedData> = {};

    filtered.forEach(tx => {
      const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
      let timeKey: string;
      if (granularity === 'daily') timeKey = getDayKey(txDate);
      else if (granularity === 'weekly') timeKey = getWeekKey(txDate);
      else timeKey = getMonthKey(txDate);

      const seriesKey = getGroupKey(tx);
      allSeriesKeys.add(seriesKey);

      if (!buckets.has(timeKey)) {
        buckets.set(timeKey, new Map());
      }
      const timeBucket = buckets.get(timeKey)!;
      if (!timeBucket.has(seriesKey)) {
        timeBucket.set(seriesKey, createEmptyAggregatedData());
      }
      if (!seriesTotals[seriesKey]) {
        seriesTotals[seriesKey] = createEmptyAggregatedData();
      }

      const data = timeBucket.get(seriesKey)!;
      const totalData = seriesTotals[seriesKey];

      const marketplace = tx.marketplaceCode || 'US';
      const sourceCurrency = getMarketplaceCurrency(marketplace);

      // Only process Order type for revenue metrics
      if (tx.type === 'Order') {
        const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
        const usdRevenue = convertCurrency(localRevenue, sourceCurrency, 'USD');
        const usdSellingFees = convertCurrency(Math.abs(tx.sellingFees || 0), sourceCurrency, 'USD');
        const usdFbaFees = convertCurrency(Math.abs(tx.fbaFees || 0), sourceCurrency, 'USD');

        data.revenue += usdRevenue;
        totalData.revenue += usdRevenue;

        if (tx.orderId) {
          data.orders.add(tx.orderId);
          totalData.orders.add(tx.orderId);
        }

        const qty = Math.abs(tx.quantity || 0);
        data.quantity += qty;
        totalData.quantity += qty;

        data.sellingFees += usdSellingFees;
        totalData.sellingFees += usdSellingFees;

        data.fbaFees += usdFbaFees;
        totalData.fbaFees += usdFbaFees;

        // FBA vs FBM breakdown
        if (tx.fulfillment === 'FBA') {
          data.fbaRevenue += usdRevenue;
          totalData.fbaRevenue += usdRevenue;
          data.fbaQuantity += qty;
          totalData.fbaQuantity += qty;
        } else if (tx.fulfillment === 'FBM') {
          data.fbmRevenue += usdRevenue;
          totalData.fbmRevenue += usdRevenue;
          data.fbmQuantity += qty;
          totalData.fbmQuantity += qty;
        }
      }

      // Refund tracking
      if (tx.type === 'Refund') {
        const refundAmount = convertCurrency(Math.abs(tx.productSales || 0), sourceCurrency, 'USD');
        data.refunds += refundAmount;
        totalData.refunds += refundAmount;
        if (tx.orderId) {
          data.refundOrders.add(tx.orderId);
          totalData.refundOrders.add(tx.orderId);
        }
      }
    });

    // Sort series by total revenue and apply topN
    const sortedSeriesKeys = Array.from(allSeriesKeys).sort((a, b) =>
      (seriesTotals[b]?.revenue || 0) - (seriesTotals[a]?.revenue || 0)
    ).slice(0, topN);

    // Build chart data
    const sortedTimeKeys = Array.from(buckets.keys()).sort();

    const getMetricValue = (data: AggregatedData): number => {
      switch (selectedMetric) {
        case 'revenue': return data.revenue;
        case 'orders': return data.orders.size;
        case 'quantity': return data.quantity;
        case 'avgOrderValue': return data.orders.size > 0 ? data.revenue / data.orders.size : 0;
        case 'sellingFeesPct': return data.revenue > 0 ? (data.sellingFees / data.revenue) * 100 : 0;
        case 'fbaFeesPct': return data.revenue > 0 ? (data.fbaFees / data.revenue) * 100 : 0;
        case 'refundRate': return data.orders.size > 0 ? (data.refundOrders.size / data.orders.size) * 100 : 0;
        case 'fbaRevenue': return data.fbaRevenue;
        case 'fbmRevenue': return data.fbmRevenue;
        case 'fbaQuantity': return data.fbaQuantity;
        case 'fbmQuantity': return data.fbmQuantity;
        default: return 0;
      }
    };

    const chartData: TimeSeriesPoint[] = sortedTimeKeys.map(key => {
      const bucket = buckets.get(key)!;
      const point: TimeSeriesPoint = {
        date: key,
        label: formatLabel(key, granularity),
        total: 0,
      };

      let pointTotal = 0;
      sortedSeriesKeys.forEach(seriesKey => {
        const data = bucket.get(seriesKey) || createEmptyAggregatedData();
        const value = getMetricValue(data);
        point[seriesKey] = value;
        pointTotal += value;
      });
      point.total = pointTotal;

      return point;
    });

    // Generate labels and colors
    const labels: Record<string, string> = {};
    const colors: Record<string, string> = {};

    sortedSeriesKeys.forEach((key, index) => {
      if (viewMode === 'country') {
        labels[key] = `${COUNTRY_FLAGS[key] || '🌍'} ${key}`;
        colors[key] = COUNTRY_COLORS[key] || CATEGORY_COLORS[index % CATEGORY_COLORS.length];
      } else if (viewMode === 'category') {
        labels[key] = key;
        colors[key] = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
      } else {
        labels[key] = key;
        colors[key] = key === 'FBA' ? '#3b82f6' : key === 'FBM' ? '#10b981' : '#94a3b8';
      }
    });

    return {
      timeSeriesData: chartData,
      seriesKeys: sortedSeriesKeys,
      totals: seriesTotals,
      seriesLabels: labels,
      seriesColors: colors,
    };
  }, [transactionData, effectiveStartDate, effectiveEndDate, selectedCategory, viewMode, granularity, selectedMetric, topN]);

  // Calculate grand totals for summary cards
  const grandTotals = useMemo(() => {
    const result = createEmptyAggregatedData();
    Object.values(totals).forEach(data => {
      result.revenue += data.revenue;
      data.orders.forEach(o => result.orders.add(o));
      result.quantity += data.quantity;
      result.sellingFees += data.sellingFees;
      result.fbaFees += data.fbaFees;
      result.refunds += data.refunds;
      data.refundOrders.forEach(o => result.refundOrders.add(o));
      result.fbaRevenue += data.fbaRevenue;
      result.fbmRevenue += data.fbmRevenue;
      result.fbaQuantity += data.fbaQuantity;
      result.fbmQuantity += data.fbmQuantity;
    });
    return result;
  }, [totals]);

  // Visible series (excluding hidden)
  const visibleSeriesKeys = useMemo(() =>
    seriesKeys.filter(key => !hiddenSeries.has(key)),
    [seriesKeys, hiddenSeries]
  );

  // ============================================
  // HANDLERS
  // ============================================

  const handleReset = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setSelectedCategory('all');
    setSelectedMetric('revenue');
    setChartType('line');
    setManualGranularity('auto');
    setHiddenSeries(new Set());
    setTopN(10);
  }, []);

  const toggleSeries = useCallback((key: string) => {
    setHiddenSeries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  const showAllSeries = useCallback(() => {
    setHiddenSeries(new Set());
  }, []);

  const hideAllSeries = useCallback(() => {
    setHiddenSeries(new Set(seriesKeys));
  }, [seriesKeys]);

  // Query Builder Handler
  const handleQuerySelect = useCallback((query: QueryParams) => {
    setIsQueryLoading(true);
    // Small delay for visual feedback
    setTimeout(() => {
      const results = executeQuery(transactionData, query);
      setQueryResults(results);
      setIsQueryLoading(false);
    }, 300);
  }, [transactionData]);

  const handleCloseQueryResults = useCallback(() => {
    setQueryResults(null);
  }, []);

  // ============================================
  // FORMAT HELPERS
  // ============================================

  const formatValue = useCallback((value: number, metric: MetricType = selectedMetric): string => {
    const config = METRIC_CONFIGS[metric];
    if (config.format === 'money') return formatMoney(value);
    if (config.format === 'percent') return `${value.toFixed(1)}%`;
    return value.toLocaleString();
  }, [selectedMetric, formatMoney]);

  const formatAxisValue = useCallback((value: number): string => {
    const config = METRIC_CONFIGS[selectedMetric];
    if (config.format === 'money') {
      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
      return `$${value.toFixed(0)}`;
    }
    if (config.format === 'percent') return `${value.toFixed(0)}%`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toString();
  }, [selectedMetric]);

  // ============================================
  // CUSTOM TOOLTIP
  // ============================================

  const CustomTooltip = useCallback(({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload || payload.length === 0) return null;

    const sorted = [...payload]
      .filter(p => p.dataKey !== 'total' && !hiddenSeries.has(p.dataKey))
      .sort((a, b) => (b.value || 0) - (a.value || 0));
    const total = sorted.reduce((sum, p) => sum + (p.value || 0), 0);

    return (
      <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-lg shadow-lg p-3 text-xs max-h-80 overflow-y-auto">
        <div className="font-semibold text-slate-800 mb-2 border-b pb-1">{label}</div>
        {sorted.slice(0, 15).map(entry => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-600 truncate max-w-[120px]">
                {seriesLabels[entry.dataKey] || entry.dataKey}
              </span>
            </div>
            <span className="font-medium" style={{ color: entry.color }}>
              {formatValue(entry.value)}
            </span>
          </div>
        ))}
        {sorted.length > 15 && (
          <div className="text-slate-400 text-center py-1">+{sorted.length - 15} more</div>
        )}
        <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-slate-200 font-semibold">
          <span className="text-slate-700">Total</span>
          <span className="text-slate-800">{formatValue(total)}</span>
        </div>
      </div>
    );
  }, [hiddenSeries, seriesLabels, formatValue]);

  // ============================================
  // RENDER
  // ============================================

  const granularityLabel = granularity === 'daily' ? 'Daily' : granularity === 'weekly' ? 'Weekly' : 'Monthly';
  const metricConfig = METRIC_CONFIGS[selectedMetric];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Main Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm p-2 mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('trends')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'trends'
                ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Trend Analizi
          </button>
          <button
            onClick={() => setActiveTab('fbm-shipping')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'fbm-shipping'
                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Truck className="w-4 h-4" />
            FBM Kargo Analizi
          </button>
          <button
            onClick={() => setActiveTab('order-hours')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'order-hours'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            Sipariş Saati Analizi
          </button>
        </div>

        {/* FBM Shipping Analyzer Tab */}
        {activeTab === 'fbm-shipping' && (
          <FbmShippingAnalyzer transactionData={transactionData} />
        )}

        {/* Order Hour Analyzer Tab */}
        {activeTab === 'order-hours' && (
          <OrderHourAnalyzer transactionData={transactionData} />
        )}

        {/* Trends Analyzer Tab (Original Content) */}
        {activeTab === 'trends' && (
          <>
        {/* Query Builder - Quick Analysis */}
        <QueryBuilder
          onQuerySelect={handleQuerySelect}
          availableMarketplaces={marketplaces}
        />

        {/* Query Results Panel */}
        {(queryResults || isQueryLoading) && (
          <div className="mb-6">
            <QueryResultsPanel
              results={queryResults}
              onClose={handleCloseQueryResults}
              isLoading={isQueryLoading}
            />
          </div>
        )}

        {/* Header - Sticky below main nav */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 sticky top-[68px] z-40">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Trends Analyzer</h1>
                <p className="text-sm text-slate-500">Time-series analysis · All values in USD</p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm font-medium text-slate-600">View by:</span>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('country')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'country' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Globe className="w-4 h-4" />
                Country
              </button>
              <button
                onClick={() => setViewMode('category')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'category' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                Category
              </button>
              <button
                onClick={() => setViewMode('fulfillment')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'fulfillment' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Package className="w-4 h-4" />
                FBA/FBM
              </button>
            </div>
          </div>

          {/* Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Date Range
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={dataDateRange.min}
                  max={dataDateRange.max}
                  className="flex-1 px-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={dataDateRange.min}
                  max={dataDateRange.max}
                  className="flex-1 px-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Metric */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Metric</label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              >
                <optgroup label="Sales">
                  {Object.entries(METRIC_CONFIGS).filter(([, c]) => c.group === 'sales').map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Fees & Rates">
                  {Object.entries(METRIC_CONFIGS).filter(([, c]) => c.group === 'fees').map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Fulfillment">
                  {Object.entries(METRIC_CONFIGS).filter(([, c]) => c.group === 'fulfillment').map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Category Filter (only when not in category view) */}
            {viewMode !== 'category' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Granularity */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Granularity</label>
              <select
                value={manualGranularity}
                onChange={(e) => setManualGranularity(e.target.value as GranularityType | 'auto')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              >
                <option value="auto">Auto ({granularityLabel})</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Chart Type & Top N */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Display</label>
              <div className="flex gap-2">
                <select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value as ChartType)}
                  className="flex-1 px-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="line">Line</option>
                  <option value="area">Area</option>
                  <option value="stacked">Stacked</option>
                </select>
                <select
                  value={topN}
                  onChange={(e) => setTopN(parseInt(e.target.value))}
                  className="w-20 px-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  title="Top N series"
                >
                  <option value={5}>Top 5</option>
                  <option value={10}>Top 10</option>
                  <option value={15}>Top 15</option>
                  <option value={20}>Top 20</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-cyan-600" />
              <span className="text-xs font-medium text-slate-500">Revenue</span>
            </div>
            <div className="text-xl font-bold text-slate-800">{formatMoney(grandTotals.revenue)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-slate-500">Orders</span>
            </div>
            <div className="text-xl font-bold text-slate-800">{grandTotals.orders.size.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-slate-500">FBA / FBM</span>
            </div>
            <div className="text-xl font-bold text-slate-800">
              <span className="text-blue-600">{((grandTotals.fbaRevenue / grandTotals.revenue) * 100 || 0).toFixed(0)}%</span>
              <span className="text-slate-400 mx-1">/</span>
              <span className="text-green-600">{((grandTotals.fbmRevenue / grandTotals.revenue) * 100 || 0).toFixed(0)}%</span>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-medium text-slate-500">Fees %</span>
            </div>
            <div className="text-xl font-bold text-slate-800">
              {grandTotals.revenue > 0 ? ((grandTotals.sellingFees + grandTotals.fbaFees) / grandTotals.revenue * 100).toFixed(1) : 0}%
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {metricConfig.label} by {viewMode === 'country' ? 'Country' : viewMode === 'category' ? 'Category' : 'Fulfillment'}
              </h2>
              <p className="text-sm text-slate-500">
                {granularityLabel} · {timeSeriesData.length} points · {visibleSeriesKeys.length}/{seriesKeys.length} visible
              </p>
            </div>
            {metricConfig.format === 'money' && (
              <div className="flex items-center gap-1 text-xs text-cyan-600 bg-cyan-50 px-2 py-1 rounded">
                <DollarSign className="w-3 h-3" />
                USD
              </div>
            )}
          </div>

          {/* Series Toggle */}
          <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-slate-200">
            <span className="text-xs font-medium text-slate-500 mr-2">Series:</span>
            <button
              onClick={showAllSeries}
              className="px-2 py-1 text-xs text-cyan-600 hover:bg-cyan-50 rounded transition-colors"
            >
              <Eye className="w-3 h-3 inline mr-1" />
              All
            </button>
            <button
              onClick={hideAllSeries}
              className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded transition-colors"
            >
              <EyeOff className="w-3 h-3 inline mr-1" />
              None
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            {seriesKeys.map(key => (
              <button
                key={key}
                onClick={() => toggleSeries(key)}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-all ${
                  hiddenSeries.has(key)
                    ? 'bg-slate-100 text-slate-400 line-through'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: hiddenSeries.has(key) ? '#cbd5e1' : seriesColors[key] }}
                />
                {seriesLabels[key] || key}
              </button>
            ))}
          </div>

          {timeSeriesData.length > 0 ? (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart data={timeSeriesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={formatAxisValue} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      onClick={(e) => toggleSeries(e.dataKey as string)}
                      formatter={(value) => (
                        <span className={`text-xs cursor-pointer ${hiddenSeries.has(value) ? 'line-through text-slate-400' : ''}`}>
                          {seriesLabels[value] || value}
                        </span>
                      )}
                    />
                    {visibleSeriesKeys.map(key => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={seriesColors[key]}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                ) : (
                  <AreaChart data={timeSeriesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={formatAxisValue} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      onClick={(e) => toggleSeries(e.dataKey as string)}
                      formatter={(value) => (
                        <span className={`text-xs cursor-pointer ${hiddenSeries.has(value) ? 'line-through text-slate-400' : ''}`}>
                          {seriesLabels[value] || value}
                        </span>
                      )}
                    />
                    {visibleSeriesKeys.map(key => (
                      <Area
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={seriesColors[key]}
                        fill={seriesColors[key]}
                        fillOpacity={chartType === 'stacked' ? 0.7 : 0.3}
                        stackId={chartType === 'stacked' ? '1' : undefined}
                      />
                    ))}
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-60 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No data available for the selected filters</p>
              </div>
            </div>
          )}

          {/* Series Summary */}
          {timeSeriesData.length > 0 && visibleSeriesKeys.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="text-sm font-medium text-slate-700 mb-3">
                {viewMode === 'country' ? 'Country' : viewMode === 'category' ? 'Category' : 'Fulfillment'} Totals
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {visibleSeriesKeys.map(key => {
                  const data = totals[key] || createEmptyAggregatedData();
                  const total = selectedMetric === 'revenue' ? data.revenue :
                    selectedMetric === 'orders' ? data.orders.size :
                    selectedMetric === 'quantity' ? data.quantity :
                    selectedMetric === 'avgOrderValue' ? (data.orders.size > 0 ? data.revenue / data.orders.size : 0) :
                    selectedMetric === 'sellingFeesPct' ? (data.revenue > 0 ? (data.sellingFees / data.revenue) * 100 : 0) :
                    selectedMetric === 'fbaFeesPct' ? (data.revenue > 0 ? (data.fbaFees / data.revenue) * 100 : 0) :
                    selectedMetric === 'refundRate' ? (data.orders.size > 0 ? (data.refundOrders.size / data.orders.size) * 100 : 0) :
                    selectedMetric === 'fbaRevenue' ? data.fbaRevenue :
                    selectedMetric === 'fbmRevenue' ? data.fbmRevenue :
                    selectedMetric === 'fbaQuantity' ? data.fbaQuantity :
                    data.fbmQuantity;

                  const pct = grandTotals.revenue > 0 && metricConfig.format !== 'percent'
                    ? (data.revenue / grandTotals.revenue) * 100
                    : 0;

                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: seriesColors[key] }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-slate-700 truncate">{seriesLabels[key] || key}</div>
                        <div className="text-sm font-bold" style={{ color: seriesColors[key] }}>
                          {formatValue(total)}
                        </div>
                      </div>
                      {metricConfig.format !== 'percent' && (
                        <div className="text-xs text-slate-400">
                          {pct.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TrendsAnalyzer;
