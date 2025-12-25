/**
 * QueryResultsPanel - Display results from query execution
 * Supports table and chart views for query results
 */

import React, { useMemo, useCallback } from 'react';
import {
  Table, BarChart3, ArrowUpRight, ArrowDownRight,
  X, DollarSign, Package, Hash, Percent
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { QueryParams, QueryMetric, QueryGroupBy } from './QueryBuilder';
import { createMoneyFormatter } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

export interface QueryResultItem {
  key: string;           // Group key (country, category, product name, etc.)
  label: string;         // Display label
  value: number;         // Primary metric value
  secondaryValue?: number; // Optional secondary value (e.g., order count)
  change?: number;       // Optional change percentage
  metadata?: {
    sku?: string;
    category?: string;
    marketplace?: string;
    quantity?: number;
    orders?: number;
    revenue?: number;
    profit?: number;
    refundRate?: number;
  };
}

export interface QueryResults {
  query: QueryParams;
  items: QueryResultItem[];
  summary: {
    total: number;
    count: number;
    dateRange: { start: string; end: string };
  };
  generatedAt: Date;
}

interface QueryResultsPanelProps {
  results: QueryResults | null;
  onClose: () => void;
  isLoading?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const METRIC_LABELS: Record<QueryMetric, string> = {
  revenue: 'Revenue',
  profit: 'Profit',
  orders: 'Orders',
  quantity: 'Quantity',
  refundRate: 'Refund Rate',
  avgOrderValue: 'Avg Order Value',
  sellingFees: 'Selling Fees',
  fbaFees: 'FBA Fees',
};

const METRIC_ICONS: Record<QueryMetric, React.ReactNode> = {
  revenue: <DollarSign className="w-4 h-4" />,
  profit: <DollarSign className="w-4 h-4" />,
  orders: <Hash className="w-4 h-4" />,
  quantity: <Package className="w-4 h-4" />,
  refundRate: <Percent className="w-4 h-4" />,
  avgOrderValue: <DollarSign className="w-4 h-4" />,
  sellingFees: <DollarSign className="w-4 h-4" />,
  fbaFees: <DollarSign className="w-4 h-4" />,
};

const GROUPBY_LABELS: Record<QueryGroupBy, string> = {
  country: 'Country',
  category: 'Category',
  sku: 'SKU',
  product: 'Product',
  fulfillment: 'Fulfillment',
};

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#f97316',
];

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸', UK: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸',
  CA: '🇨🇦', AU: '🇦🇺', AE: '🇦🇪', SA: '🇸🇦', SG: '🇸🇬', TR: '🇹🇷',
};

// ============================================
// COMPONENT
// ============================================

export const QueryResultsPanel: React.FC<QueryResultsPanelProps> = ({
  results,
  onClose,
  isLoading = false,
}) => {
  const [viewMode, setViewMode] = React.useState<'table' | 'chart'>('table');
  const formatMoney = createMoneyFormatter('USD');

  // Format value based on metric type
  const formatValue = useCallback((value: number, metric: QueryMetric): string => {
    if (metric === 'refundRate') {
      return `${value.toFixed(1)}%`;
    }
    if (metric === 'orders' || metric === 'quantity') {
      return value.toLocaleString();
    }
    return formatMoney(value);
  }, [formatMoney]);

  // Get color for value (positive/negative)
  const getValueColor = useCallback((value: number, metric: QueryMetric): string => {
    if (metric === 'profit') {
      return value >= 0 ? 'text-green-600' : 'text-red-600';
    }
    if (metric === 'refundRate' || metric === 'sellingFees' || metric === 'fbaFees') {
      return 'text-orange-600';
    }
    return 'text-slate-800';
  }, []);

  // Chart data
  const chartData = useMemo(() => {
    if (!results) return [];
    return results.items.map((item, index) => ({
      ...item,
      fill: item.value >= 0 ? CHART_COLORS[index % CHART_COLORS.length] : '#ef4444',
    }));
  }, [results]);

  if (!results && !isLoading) return null;

  const metric = results?.query.metric || 'revenue';
  const groupBy = results?.query.groupBy || 'product';

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            {METRIC_ICONS[metric]}
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">
              {METRIC_LABELS[metric]} by {GROUPBY_LABELS[groupBy]}
            </h3>
            {results && (
              <p className="text-xs text-slate-500">
                {results.summary.dateRange.start} - {results.summary.dateRange.end} · {results.items.length} results
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded ${viewMode === 'table' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Table className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`p-2 rounded ${viewMode === 'chart' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-500">Analyzing data...</p>
        </div>
      )}

      {/* Results */}
      {results && !isLoading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 border-b border-slate-200">
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Total {METRIC_LABELS[metric]}</div>
              <div className={`text-lg font-bold ${getValueColor(results.summary.total, metric)}`}>
                {formatValue(results.summary.total, metric)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Items Analyzed</div>
              <div className="text-lg font-bold text-slate-800">{results.summary.count}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Top Item</div>
              <div className="text-sm font-semibold text-slate-800 truncate">
                {results.items[0]?.label || '-'}
              </div>
            </div>
          </div>

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">#</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      {GROUPBY_LABELS[groupBy]}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">
                      {METRIC_LABELS[metric]}
                    </th>
                    {results.items[0]?.metadata?.orders !== undefined && (
                      <th className="px-4 py-3 text-right font-medium text-slate-600">Orders</th>
                    )}
                    {results.items[0]?.metadata?.quantity !== undefined && (
                      <th className="px-4 py-3 text-right font-medium text-slate-600">Qty</th>
                    )}
                    <th className="px-4 py-3 text-right font-medium text-slate-600">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.items.map((item, index) => {
                    const share = results.summary.total !== 0
                      ? Math.abs((item.value / results.summary.total) * 100)
                      : 0;
                    const isNegative = item.value < 0;

                    return (
                      <tr key={item.key} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {groupBy === 'country' && COUNTRY_FLAGS[item.key] && (
                              <span>{COUNTRY_FLAGS[item.key]}</span>
                            )}
                            <span className="font-medium text-slate-800">{item.label}</span>
                            {item.metadata?.sku && (
                              <span className="text-xs text-slate-400">({item.metadata.sku})</span>
                            )}
                          </div>
                          {item.metadata?.category && groupBy !== 'category' && (
                            <div className="text-xs text-slate-400">{item.metadata.category}</div>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${getValueColor(item.value, metric)}`}>
                          <div className="flex items-center justify-end gap-1">
                            {isNegative ? (
                              <ArrowDownRight className="w-4 h-4 text-red-500" />
                            ) : metric === 'profit' ? (
                              <ArrowUpRight className="w-4 h-4 text-green-500" />
                            ) : null}
                            {formatValue(item.value, metric)}
                          </div>
                        </td>
                        {item.metadata?.orders !== undefined && (
                          <td className="px-4 py-3 text-right text-slate-600">
                            {item.metadata.orders.toLocaleString()}
                          </td>
                        )}
                        {item.metadata?.quantity !== undefined && (
                          <td className="px-4 py-3 text-right text-slate-600">
                            {item.metadata.quantity.toLocaleString()}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${isNegative ? 'bg-red-400' : 'bg-purple-400'} rounded-full`}
                                style={{ width: `${Math.min(share, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 w-12 text-right">
                              {share.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Chart View */}
          {viewMode === 'chart' && (
            <div className="p-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(value) => formatValue(value, metric)}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    width={90}
                  />
                  <Tooltip
                    formatter={(value) => formatValue(value as number, metric)}
                    contentStyle={{
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.value >= 0 ? CHART_COLORS[index % CHART_COLORS.length] : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QueryResultsPanel;
