import React, { useState, useMemo } from 'react';
import { TrendingUp, ChevronRight, BarChart3 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TransactionData } from '../../types/transaction';
import type { CategoryProfitAnalysis } from '../../types/profitabilityAnalysis';

// Country colors for chart lines
const COUNTRY_COLORS: Record<string, string> = {
  US: '#3b82f6', // blue
  UK: '#ef4444', // red
  DE: '#f59e0b', // amber
  FR: '#8b5cf6', // violet
  IT: '#10b981', // emerald
  ES: '#f97316', // orange
  CA: '#ec4899', // pink
  AU: '#06b6d4', // cyan
  AE: '#84cc16', // lime
  SA: '#6366f1', // indigo
  SG: '#14b8a6', // teal
  TR: '#e11d48', // rose
};

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸',
  UK: '🇬🇧',
  DE: '🇩🇪',
  FR: '🇫🇷',
  IT: '🇮🇹',
  ES: '🇪🇸',
  CA: '🇨🇦',
  AU: '🇦🇺',
  AE: '🇦🇪',
  SA: '🇸🇦',
  SG: '🇸🇬',
  TR: '🇹🇷',
};

interface CategoryTrendsSectionProps {
  transactionData: TransactionData[];
  categoryProfitability: CategoryProfitAnalysis[];
  startDate: string;
  endDate: string;
  filterMarketplace: string;
  filterFulfillment: string;
  formatMoney: (amount: number) => string;
}

type MetricType = 'revenue' | 'orders' | 'quantity';
type GranularityType = 'daily' | 'weekly' | 'monthly';

interface TimeSeriesPoint {
  date: string;
  label: string;
  [key: string]: string | number; // country codes as keys for revenue/orders
}

// Determine granularity based on date range
const getGranularity = (startDate: string, endDate: string): GranularityType => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 31) return 'daily';
  if (diffDays <= 120) return 'weekly';
  return 'monthly';
};

// Get week number and year for a date
const getWeekKey = (date: Date): string => {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
};

// Get month key for a date
const getMonthKey = (date: Date): string => {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
};

// Get daily key for a date
const getDayKey = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

// Format label for display
const formatLabel = (key: string, granularity: GranularityType): string => {
  if (granularity === 'daily') {
    const d = new Date(key);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (granularity === 'weekly') {
    // key is like "2024-W05"
    const [year, week] = key.split('-W');
    return `W${week} '${year.slice(2)}`;
  }
  // monthly: key is like "2024-01"
  const [year, month] = key.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

export const CategoryTrendsSection: React.FC<CategoryTrendsSectionProps> = React.memo(({
  transactionData,
  categoryProfitability,
  startDate,
  endDate,
  filterMarketplace,
  filterFulfillment,
  formatMoney,
}) => {
  const [sectionExpanded, setSectionExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('revenue');

  // Get categories list
  const categories = useMemo(() => {
    return ['all', ...categoryProfitability.map(c => c.category)];
  }, [categoryProfitability]);

  // Calculate time-series data
  const { timeSeriesData, marketplaces } = useMemo(() => {
    if (!sectionExpanded || !startDate || !endDate) {
      return { timeSeriesData: [], marketplaces: [] };
    }

    const granularity = getGranularity(startDate, endDate);
    const startD = new Date(startDate);
    const endD = new Date(endDate);

    // Filter transactions: Order type only, within date range
    const filtered = transactionData.filter(tx => {
      // Only Order transactions (has revenue)
      if (tx.type !== 'Order') return false;

      // Date filter
      const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
      if (txDate < startD || txDate > endD) return false;

      // Category filter
      if (selectedCategory !== 'all' && tx.productCategory !== selectedCategory) return false;

      // Fulfillment filter (from parent component)
      if (filterFulfillment !== 'all' && tx.fulfillment !== filterFulfillment) return false;

      // Marketplace filter (from parent component) - only if single marketplace selected
      if (filterMarketplace !== 'all' && tx.marketplaceCode !== filterMarketplace) return false;

      return true;
    });

    // Group by time bucket and marketplace
    const buckets = new Map<string, Map<string, { revenue: number; orders: Set<string>; quantity: number }>>();
    const allMarketplaces = new Set<string>();

    filtered.forEach(tx => {
      const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
      let timeKey: string;

      if (granularity === 'daily') {
        timeKey = getDayKey(txDate);
      } else if (granularity === 'weekly') {
        timeKey = getWeekKey(txDate);
      } else {
        timeKey = getMonthKey(txDate);
      }

      const marketplace = tx.marketplaceCode || 'Unknown';
      allMarketplaces.add(marketplace);

      if (!buckets.has(timeKey)) {
        buckets.set(timeKey, new Map());
      }
      const timeBucket = buckets.get(timeKey)!;

      if (!timeBucket.has(marketplace)) {
        timeBucket.set(marketplace, { revenue: 0, orders: new Set(), quantity: 0 });
      }
      const mpData = timeBucket.get(marketplace)!;

      // Calculate revenue (productSales - promotionalRebates)
      const revenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
      mpData.revenue += revenue;
      if (tx.orderId) mpData.orders.add(tx.orderId);
      mpData.quantity += Math.abs(tx.quantity || 0);
    });

    // Sort time keys
    const sortedKeys = Array.from(buckets.keys()).sort();
    const sortedMarketplaces = Array.from(allMarketplaces).sort((a, b) => {
      // Sort by total revenue descending
      let totalA = 0, totalB = 0;
      buckets.forEach(bucket => {
        totalA += bucket.get(a)?.revenue || 0;
        totalB += bucket.get(b)?.revenue || 0;
      });
      return totalB - totalA;
    });

    // Build chart data
    const data: TimeSeriesPoint[] = sortedKeys.map(key => {
      const bucket = buckets.get(key)!;
      const point: TimeSeriesPoint = {
        date: key,
        label: formatLabel(key, granularity),
      };

      sortedMarketplaces.forEach(mp => {
        const mpData = bucket.get(mp);
        if (selectedMetric === 'revenue') {
          point[mp] = mpData?.revenue || 0;
        } else if (selectedMetric === 'orders') {
          point[mp] = mpData?.orders.size || 0;
        } else {
          point[mp] = mpData?.quantity || 0;
        }
      });

      return point;
    });

    return { timeSeriesData: data, marketplaces: sortedMarketplaces };
  }, [sectionExpanded, transactionData, startDate, endDate, selectedCategory, selectedMetric, filterMarketplace, filterFulfillment]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload || payload.length === 0) return null;

    // Sort payload by value descending
    const sorted = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0));
    const total = sorted.reduce((sum, p) => sum + (p.value || 0), 0);

    return (
      <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
        <div className="font-semibold text-slate-800 mb-2 border-b pb-1">{label}</div>
        {sorted.map(entry => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-0.5">
            <div className="flex items-center gap-1.5">
              <span>{COUNTRY_FLAGS[entry.dataKey] || '🌍'}</span>
              <span className="text-slate-600">{entry.dataKey}</span>
            </div>
            <span className="font-medium" style={{ color: entry.color }}>
              {selectedMetric === 'revenue' ? formatMoney(entry.value) : entry.value.toLocaleString()}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-slate-200 font-semibold">
          <span className="text-slate-700">Total</span>
          <span className="text-slate-800">
            {selectedMetric === 'revenue' ? formatMoney(total) : total.toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  // No data state
  if (!startDate || !endDate) return null;

  const granularity = getGranularity(startDate, endDate);
  const granularityLabel = granularity === 'daily' ? 'Daily' : granularity === 'weekly' ? 'Weekly' : 'Monthly';

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      {/* Clickable Header */}
      <div
        className="flex items-center justify-between cursor-pointer hover:bg-slate-50 -mx-6 -mt-6 px-6 py-4 rounded-t-xl transition-colors"
        onClick={() => setSectionExpanded(!sectionExpanded)}
      >
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Category Trends
          <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${sectionExpanded ? 'rotate-90' : ''}`} />
        </h2>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
            {granularityLabel}
          </span>
          {!sectionExpanded && (
            <span className="text-slate-400">Click to expand</span>
          )}
        </div>
      </div>

      {/* Collapsible Content */}
      {sectionExpanded && (
        <div className="mt-6">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            {/* Category Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600">Category:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Metric Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setSelectedMetric('revenue')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedMetric === 'revenue'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Revenue
              </button>
              <button
                onClick={() => setSelectedMetric('orders')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedMetric === 'orders'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Orders
              </button>
              <button
                onClick={() => setSelectedMetric('quantity')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedMetric === 'quantity'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Quantity
              </button>
            </div>

            {/* Granularity Info */}
            <div className="ml-auto text-xs text-slate-500">
              <BarChart3 className="w-3.5 h-3.5 inline-block mr-1" />
              {timeSeriesData.length} {granularityLabel.toLowerCase()} points
            </div>
          </div>

          {/* Chart */}
          {timeSeriesData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={{ stroke: '#cbd5e1' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={{ stroke: '#cbd5e1' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickFormatter={(value) =>
                      selectedMetric === 'revenue'
                        ? `$${(value / 1000).toFixed(0)}k`
                        : value.toLocaleString()
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs">
                        {COUNTRY_FLAGS[value] || '🌍'} {value}
                      </span>
                    )}
                  />
                  {marketplaces.map((mp) => (
                    <Line
                      key={mp}
                      type="monotone"
                      dataKey={mp}
                      stroke={COUNTRY_COLORS[mp] || '#94a3b8'}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
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

          {/* Summary Stats */}
          {timeSeriesData.length > 0 && marketplaces.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex flex-wrap gap-3">
                {marketplaces.slice(0, 8).map(mp => {
                  const total = timeSeriesData.reduce((sum, point) => sum + (Number(point[mp]) || 0), 0);
                  return (
                    <div
                      key={mp}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg"
                    >
                      <span className="text-sm">{COUNTRY_FLAGS[mp] || '🌍'}</span>
                      <span className="text-xs font-medium text-slate-700">{mp}</span>
                      <span className="text-xs font-bold" style={{ color: COUNTRY_COLORS[mp] || '#64748b' }}>
                        {selectedMetric === 'revenue' ? formatMoney(total) : total.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

CategoryTrendsSection.displayName = 'CategoryTrendsSection';
