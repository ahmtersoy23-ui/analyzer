/**
 * Order Hour Analyzer
 * Analyzes order distribution by hour of day
 * Provides insights into peak shopping hours with filters
 */

import React, { useState, useMemo } from 'react';
import { Clock, Filter, Globe, Package, Layers, BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import type { TransactionData } from '../../types/transaction';
import { convertCurrency, getMarketplaceCurrency } from '../../utils/currencyExchange';
import { createMoneyFormatter, formatPercent } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

interface HourData {
  hour: number;
  label: string;
  orders: number;
  quantity: number;
  revenue: number;
  percentage: number;
}

interface HourByDimensionData {
  hour: number;
  label: string;
  [key: string]: number | string; // dynamic keys for countries/categories
}

type ViewMode = 'overview' | 'byCountry' | 'byCategory' | 'byFulfillment';

interface OrderHourAnalyzerProps {
  transactionData: TransactionData[];
}

// ============================================
// CONSTANTS
// ============================================

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  `${i.toString().padStart(2, '0')}:00`
);

const COUNTRY_COLORS: Record<string, string> = {
  US: '#3b82f6', UK: '#ef4444', DE: '#f59e0b', FR: '#8b5cf6',
  IT: '#10b981', ES: '#f97316', CA: '#ec4899', AU: '#06b6d4',
  AE: '#84cc16', SA: '#6366f1',
};

const CATEGORY_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#f97316',
];

/**
 * Amazon report timezone offsets (hours from UTC)
 * - North America: Reports in PST (UTC-8)
 * - Europe: Reports in UTC
 * - Others: Reports in UTC
 */
const AMAZON_REPORT_OFFSETS: Record<string, number> = {
  US: -8,  // PST
  CA: -8,  // PST
  // Europe - UTC (offset 0)
  UK: 0, DE: 0, FR: 0, IT: 0, ES: 0,
  // Others - assuming UTC
  AU: 0, AE: 0, SA: 0, SG: 0, TR: 0,
};

/**
 * Local timezone offsets for each marketplace (hours from UTC)
 */
const LOCAL_TIMEZONE_OFFSETS: Record<string, number> = {
  US: -8,   // PST (Pacific Standard Time)
  CA: -5,   // EST (Toronto/Montreal area)
  UK: 0,    // GMT
  DE: 1,    // CET
  FR: 1,    // CET
  IT: 1,    // CET
  ES: 1,    // CET
  AU: 9,    // GMT+9
  AE: 4,    // UTC+4 (Gulf Standard Time)
  SA: 3,    // UTC+3 (Arabia Standard Time)
  SG: 8,    // SGT
  TR: 3,    // TRT
};

/**
 * Get local hour from transaction
 * Converts from Amazon's report timezone to local marketplace timezone
 */
const getHourFromTransaction = (tx: { timeOnly?: string; date: Date; marketplaceCode?: string }): number => {
  const marketplace = tx.marketplaceCode || 'US';
  let rawHour: number;

  // Get raw hour from timeOnly or date
  if (tx.timeOnly) {
    const match = tx.timeOnly.match(/^(\d{2}):/);
    if (match) {
      rawHour = parseInt(match[1], 10);
    } else {
      const date = tx.date instanceof Date ? tx.date : new Date(tx.date);
      rawHour = date.getUTCHours();
    }
  } else {
    const date = tx.date instanceof Date ? tx.date : new Date(tx.date);
    rawHour = date.getUTCHours();
  }

  // Convert from Amazon report timezone to local marketplace timezone
  const reportOffset = AMAZON_REPORT_OFFSETS[marketplace] ?? 0;
  const localOffset = LOCAL_TIMEZONE_OFFSETS[marketplace] ?? 0;

  // Formula: localHour = rawHour - reportOffset + localOffset
  // Example CA: rawHour=1 (1am PST), reportOffset=-8, localOffset=-5
  // localHour = 1 - (-8) + (-5) = 1 + 8 - 5 = 4am EST
  let localHour = rawHour - reportOffset + localOffset;

  // Wrap around 24 hours
  while (localHour < 0) localHour += 24;
  while (localHour >= 24) localHour -= 24;

  return localHour;
};

// ============================================
// COMPONENT
// ============================================

const OrderHourAnalyzer: React.FC<OrderHourAnalyzerProps> = ({ transactionData }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFulfillment, setSelectedFulfillment] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [metric, setMetric] = useState<'orders' | 'quantity' | 'revenue'>('orders');

  const formatMoney = createMoneyFormatter('USD');

  // Get available filters
  const { marketplaces, categories, dateRange } = useMemo(() => {
    const mps = new Set<string>();
    const cats = new Set<string>();
    let minDate = '';
    let maxDate = '';

    transactionData.forEach(tx => {
      if (tx.marketplaceCode) mps.add(tx.marketplaceCode);
      if (tx.productCategory) cats.add(tx.productCategory);
      if (tx.dateOnly) {
        if (!minDate || tx.dateOnly < minDate) minDate = tx.dateOnly;
        if (!maxDate || tx.dateOnly > maxDate) maxDate = tx.dateOnly;
      }
    });

    return {
      marketplaces: Array.from(mps).sort(),
      categories: Array.from(cats).sort(),
      dateRange: { min: minDate, max: maxDate }
    };
  }, [transactionData]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    const effectiveStart = startDate || dateRange.min;
    const effectiveEnd = endDate || dateRange.max;

    return transactionData.filter(tx => {
      if (tx.categoryType !== 'Order') return false;

      // Date filter
      if (effectiveStart && tx.dateOnly && tx.dateOnly < effectiveStart) return false;
      if (effectiveEnd && tx.dateOnly && tx.dateOnly > effectiveEnd) return false;

      // Marketplace filter
      if (selectedMarketplace !== 'all' && tx.marketplaceCode !== selectedMarketplace) return false;

      // Category filter
      if (selectedCategory !== 'all' && tx.productCategory !== selectedCategory) return false;

      // Fulfillment filter
      if (selectedFulfillment !== 'all' && tx.fulfillment !== selectedFulfillment) return false;

      return true;
    });
  }, [transactionData, startDate, endDate, dateRange, selectedMarketplace, selectedCategory, selectedFulfillment]);

  // Overview: Aggregate by hour
  const hourlyData = useMemo(() => {
    const hours: HourData[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: HOUR_LABELS[i],
      orders: 0,
      quantity: 0,
      revenue: 0,
      percentage: 0
    }));

    filteredOrders.forEach(tx => {
      // Using timeOnly for accurate hour without timezone conversion
      const marketplace = tx.marketplaceCode || 'US';
      const hour = getHourFromTransaction(tx);

      if (hour >= 0 && hour < 24) {
        hours[hour].orders++;
        hours[hour].quantity += Math.abs(tx.quantity || 0);

        const sourceCurrency = getMarketplaceCurrency(marketplace);
        const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
        const usdRevenue = convertCurrency(localRevenue, sourceCurrency, 'USD');
        hours[hour].revenue += usdRevenue;
      }
    });

    // Calculate percentages
    const totalOrders = hours.reduce((sum, h) => sum + h.orders, 0);
    hours.forEach(h => {
      h.percentage = totalOrders > 0 ? (h.orders / totalOrders) * 100 : 0;
    });

    return hours;
  }, [filteredOrders]);

  // By Country: Aggregate by hour and country
  const hourlyByCountry = useMemo(() => {
    const data: HourByDimensionData[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: HOUR_LABELS[i]
    }));

    const countrySet = new Set<string>();

    filteredOrders.forEach(tx => {
      // Using timeOnly for accurate hour without timezone conversion
      const country = tx.marketplaceCode || 'Unknown';
      const hour = getHourFromTransaction(tx);

      if (hour >= 0 && hour < 24) {
        countrySet.add(country);
        const current = (data[hour][country] as number) || 0;

        if (metric === 'orders') {
          data[hour][country] = current + 1;
        } else if (metric === 'quantity') {
          data[hour][country] = current + Math.abs(tx.quantity || 0);
        } else {
          const sourceCurrency = getMarketplaceCurrency(country);
          const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
          const usdRevenue = convertCurrency(localRevenue, sourceCurrency, 'USD');
          data[hour][country] = current + usdRevenue;
        }
      }
    });

    return { data, countries: Array.from(countrySet).sort() };
  }, [filteredOrders, metric]);

  // By Category: Aggregate by hour and category (top 5)
  const hourlyByCategory = useMemo(() => {
    // First, find top 5 categories by order count
    const categoryTotals = new Map<string, number>();
    filteredOrders.forEach(tx => {
      const cat = tx.productCategory || 'Uncategorized';
      categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + 1);
    });

    const topCategories = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);

    const data: HourByDimensionData[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: HOUR_LABELS[i]
    }));

    filteredOrders.forEach(tx => {
      // Using timeOnly for accurate hour without timezone conversion
      const marketplace = tx.marketplaceCode || 'US';
      const hour = getHourFromTransaction(tx);
      const category = tx.productCategory || 'Uncategorized';

      if (!topCategories.includes(category)) return;

      if (hour >= 0 && hour < 24) {
        const current = (data[hour][category] as number) || 0;

        if (metric === 'orders') {
          data[hour][category] = current + 1;
        } else if (metric === 'quantity') {
          data[hour][category] = current + Math.abs(tx.quantity || 0);
        } else {
          const sourceCurrency = getMarketplaceCurrency(marketplace);
          const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
          const usdRevenue = convertCurrency(localRevenue, sourceCurrency, 'USD');
          data[hour][category] = current + usdRevenue;
        }
      }
    });

    return { data, categories: topCategories };
  }, [filteredOrders, metric]);

  // By Fulfillment: FBA vs FBM
  const hourlyByFulfillment = useMemo(() => {
    const data: HourByDimensionData[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: HOUR_LABELS[i],
      FBA: 0,
      FBM: 0
    }));

    filteredOrders.forEach(tx => {
      // Using timeOnly for accurate hour without timezone conversion
      const marketplace = tx.marketplaceCode || 'US';
      const hour = getHourFromTransaction(tx);
      const fulfillment = tx.fulfillment === 'FBA' ? 'FBA' : tx.fulfillment === 'FBM' ? 'FBM' : null;

      if (!fulfillment || hour < 0 || hour >= 24) return;

      const current = (data[hour][fulfillment] as number) || 0;

      if (metric === 'orders') {
        data[hour][fulfillment] = current + 1;
      } else if (metric === 'quantity') {
        data[hour][fulfillment] = current + Math.abs(tx.quantity || 0);
      } else {
        const sourceCurrency = getMarketplaceCurrency(marketplace);
        const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
        const usdRevenue = convertCurrency(localRevenue, sourceCurrency, 'USD');
        data[hour][fulfillment] = current + usdRevenue;
      }
    });

    return data;
  }, [filteredOrders, metric]);

  // Stats
  const stats = useMemo(() => {
    const totalOrders = hourlyData.reduce((sum, h) => sum + h.orders, 0);
    const totalQuantity = hourlyData.reduce((sum, h) => sum + h.quantity, 0);
    const totalRevenue = hourlyData.reduce((sum, h) => sum + h.revenue, 0);

    const peakHour = hourlyData.reduce((max, h) =>
      h.orders > max.orders ? h : max, hourlyData[0]);

    const lowHour = hourlyData.reduce((min, h) =>
      h.orders < min.orders ? h : min, hourlyData[0]);

    return {
      totalOrders,
      totalQuantity,
      totalRevenue,
      peakHour: peakHour.label,
      peakOrders: peakHour.orders,
      lowHour: lowHour.label,
      lowOrders: lowHour.orders
    };
  }, [hourlyData]);

  // Get color for bar based on percentage
  const getBarColor = (percentage: number) => {
    if (percentage >= 6) return '#22c55e'; // High
    if (percentage >= 4) return '#3b82f6'; // Medium
    return '#94a3b8'; // Low
  };

  const metricLabel = metric === 'orders' ? 'Sipariş' : metric === 'quantity' ? 'Adet' : 'Gelir';

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
          <Clock className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Sipariş Saati Analizi</h2>
          <p className="text-sm text-slate-500">Saat bazlı sipariş dağılımı</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">Toplam Sipariş</div>
          <div className="text-xl font-bold text-slate-800">{stats.totalOrders.toLocaleString()}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-xs text-green-600 mb-1">En Yoğun Saat</div>
          <div className="text-xl font-bold text-green-700">{stats.peakHour}</div>
          <div className="text-xs text-green-600">{stats.peakOrders.toLocaleString()} sipariş</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-xs text-blue-600 mb-1">Toplam Gelir</div>
          <div className="text-xl font-bold text-blue-700">{formatMoney(stats.totalRevenue)}</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-4">
          <div className="text-xs text-amber-600 mb-1">En Sakin Saat</div>
          <div className="text-xl font-bold text-amber-700">{stats.lowHour}</div>
          <div className="text-xs text-amber-600">{stats.lowOrders.toLocaleString()} sipariş</div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-sm font-medium text-slate-600">Görünüm:</span>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'overview' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Genel
          </button>
          <button
            onClick={() => setViewMode('byCountry')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'byCountry' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Globe className="w-4 h-4" />
            Ülke
          </button>
          <button
            onClick={() => setViewMode('byCategory')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'byCategory' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            Kategori
          </button>
          <button
            onClick={() => setViewMode('byFulfillment')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'byFulfillment' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            FBA/FBM
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-600">Metrik:</span>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as typeof metric)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="orders">Sipariş Sayısı</option>
            <option value="quantity">Adet</option>
            <option value="revenue">Gelir (USD)</option>
          </select>
        </div>

        {viewMode === 'overview' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Marketplace:</span>
              <select
                value={selectedMarketplace}
                onChange={(e) => setSelectedMarketplace(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tümü</option>
                {marketplaces.map(mp => (
                  <option key={mp} value={mp}>{mp}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Kategori:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tümü</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Fulfillment:</span>
              <select
                value={selectedFulfillment}
                onChange={(e) => setSelectedFulfillment(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tümü</option>
                <option value="FBA">FBA</option>
                <option value="FBM">FBM</option>
              </select>
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Tarih:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            min={dateRange.min}
            max={dateRange.max}
            className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-slate-400">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={dateRange.min}
            max={dateRange.max}
            className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Charts */}
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'overview' ? (
            <BarChart data={hourlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload as HourData;
                  return (
                    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
                      <div className="font-semibold text-slate-800 mb-2">{label}</div>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-600">Sipariş:</span>
                          <span className="font-medium">{data.orders.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-600">Adet:</span>
                          <span className="font-medium">{data.quantity.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-600">Gelir:</span>
                          <span className="font-medium">{formatMoney(data.revenue)}</span>
                        </div>
                        <div className="flex justify-between gap-4 pt-1 border-t border-slate-200">
                          <span className="text-slate-600">Oran:</span>
                          <span className="font-medium text-indigo-600">{formatPercent(data.percentage)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
                {hourlyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.percentage)} />
                ))}
              </Bar>
            </BarChart>
          ) : viewMode === 'byCountry' ? (
            <LineChart data={hourlyByCountry.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                formatter={(value: number | undefined, name: string | undefined) => [
                  metric === 'revenue' ? formatMoney(value || 0) : (value || 0).toLocaleString(),
                  name || ''
                ]}
              />
              <Legend />
              {hourlyByCountry.countries.map(country => (
                <Line
                  key={country}
                  type="monotone"
                  dataKey={country}
                  stroke={COUNTRY_COLORS[country] || '#94a3b8'}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              ))}
            </LineChart>
          ) : viewMode === 'byCategory' ? (
            <LineChart data={hourlyByCategory.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                formatter={(value: number | undefined, name: string | undefined) => [
                  metric === 'revenue' ? formatMoney(value || 0) : (value || 0).toLocaleString(),
                  name || ''
                ]}
              />
              <Legend />
              {hourlyByCategory.categories.map((category, index) => (
                <Line
                  key={category}
                  type="monotone"
                  dataKey={category}
                  stroke={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={hourlyByFulfillment} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                formatter={(value: number | undefined, name: string | undefined) => [
                  metric === 'revenue' ? formatMoney(value || 0) : (value || 0).toLocaleString(),
                  name || ''
                ]}
              />
              <Legend />
              <Bar dataKey="FBA" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="FBM" fill="#10b981" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Hourly Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 font-medium text-slate-600">Saat</th>
              <th className="text-right py-3 px-4 font-medium text-slate-600">Sipariş</th>
              <th className="text-right py-3 px-4 font-medium text-slate-600">Adet</th>
              <th className="text-right py-3 px-4 font-medium text-slate-600">Gelir</th>
              <th className="text-right py-3 px-4 font-medium text-slate-600">%</th>
              <th className="py-3 px-4 font-medium text-slate-600 w-40">Dağılım</th>
            </tr>
          </thead>
          <tbody>
            {hourlyData.map((hour, idx) => (
              <tr key={hour.hour} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                <td className="py-2 px-4 font-medium text-slate-800">{hour.label}</td>
                <td className="text-right py-2 px-4 text-slate-700">{hour.orders.toLocaleString()}</td>
                <td className="text-right py-2 px-4 text-slate-700">{hour.quantity.toLocaleString()}</td>
                <td className="text-right py-2 px-4 text-slate-700">{formatMoney(hour.revenue)}</td>
                <td className="text-right py-2 px-4 font-medium text-indigo-600">{formatPercent(hour.percentage)}</td>
                <td className="py-2 px-4">
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(hour.percentage * 10, 100)}%`,
                        backgroundColor: getBarColor(hour.percentage)
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderHourAnalyzer;
