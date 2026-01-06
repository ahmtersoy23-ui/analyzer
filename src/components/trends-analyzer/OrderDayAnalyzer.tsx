/**
 * Order Day Analyzer
 * Analyzes order distribution by day of month (1-31)
 * Provides insights into which days are busiest
 */

import React, { useState, useMemo } from 'react';
import { Calendar, Filter, Globe, Package, Layers, BarChart3 } from 'lucide-react';
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

interface DayData {
  day: number;
  label: string;
  orders: number;
  quantity: number;
  revenue: number;
  percentage: number;
}

interface DayByDimensionData {
  day: number;
  label: string;
  [key: string]: number | string;
}

type ViewMode = 'overview' | 'byCountry' | 'byCategory' | 'byFulfillment';
type MetricType = 'orders' | 'quantity' | 'revenue';

interface OrderDayAnalyzerProps {
  transactionData: TransactionData[];
}

// ============================================
// CONSTANTS
// ============================================

const DAY_LABELS = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

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
 * Get day of month from transaction
 */
const getDayFromTransaction = (tx: { dateOnly?: string; date: Date }): number => {
  // Try dateOnly first (YYYY-MM-DD format)
  if (tx.dateOnly) {
    const match = tx.dateOnly.match(/-(\d{2})$/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  // Fallback to date object
  const date = tx.date instanceof Date ? tx.date : new Date(tx.date);
  return date.getDate();
};

// ============================================
// COMPONENT
// ============================================

const OrderDayAnalyzer: React.FC<OrderDayAnalyzerProps> = ({ transactionData }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFulfillment, setSelectedFulfillment] = useState<string>('all');
  const [metric, setMetric] = useState<MetricType>('orders');

  const formatMoney = createMoneyFormatter('USD');

  // Get unique values for filters
  const { marketplaces, categories } = useMemo(() => {
    const mpSet = new Set<string>();
    const catSet = new Set<string>();

    transactionData.forEach(tx => {
      if (tx.marketplaceCode) mpSet.add(tx.marketplaceCode);
      if (tx.productCategory) catSet.add(tx.productCategory);
    });

    return {
      marketplaces: Array.from(mpSet).sort(),
      categories: Array.from(catSet).sort(),
    };
  }, [transactionData]);

  // Filter to only Order type transactions
  const filteredOrders = useMemo(() => {
    return transactionData.filter(tx => {
      if (tx.categoryType !== 'Order') return false;
      if (selectedMarketplace !== 'all' && tx.marketplaceCode !== selectedMarketplace) return false;
      if (selectedCategory !== 'all' && tx.productCategory !== selectedCategory) return false;
      if (selectedFulfillment !== 'all' && tx.fulfillment !== selectedFulfillment) return false;
      return true;
    });
  }, [transactionData, selectedMarketplace, selectedCategory, selectedFulfillment]);

  // Calculate daily distribution (Overview)
  const dailyData = useMemo((): DayData[] => {
    const days: DayData[] = Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      label: DAY_LABELS[i],
      orders: 0,
      quantity: 0,
      revenue: 0,
      percentage: 0
    }));

    filteredOrders.forEach(tx => {
      const marketplace = tx.marketplaceCode || 'US';
      const day = getDayFromTransaction(tx);

      if (day >= 1 && day <= 31) {
        days[day - 1].orders++;
        days[day - 1].quantity += Math.abs(tx.quantity || 0);

        const sourceCurrency = getMarketplaceCurrency(marketplace);
        const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
        const usdRevenue = convertCurrency(localRevenue, sourceCurrency, 'USD');
        days[day - 1].revenue += usdRevenue;
      }
    });

    // Calculate percentages
    const totalOrders = days.reduce((sum, d) => sum + d.orders, 0);
    days.forEach(d => {
      d.percentage = totalOrders > 0 ? (d.orders / totalOrders) * 100 : 0;
    });

    return days;
  }, [filteredOrders]);

  // Calculate daily by country
  const dailyByCountry = useMemo(() => {
    const data: DayByDimensionData[] = Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      label: DAY_LABELS[i]
    }));

    const countrySet = new Set<string>();

    filteredOrders.forEach(tx => {
      const country = tx.marketplaceCode || 'Unknown';
      const day = getDayFromTransaction(tx);

      if (day >= 1 && day <= 31) {
        countrySet.add(country);
        const current = (data[day - 1][country] as number) || 0;

        if (metric === 'orders') {
          data[day - 1][country] = current + 1;
        } else if (metric === 'quantity') {
          data[day - 1][country] = current + Math.abs(tx.quantity || 0);
        } else {
          const sourceCurrency = getMarketplaceCurrency(country);
          const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
          const usdRevenue = convertCurrency(localRevenue, sourceCurrency, 'USD');
          data[day - 1][country] = current + usdRevenue;
        }
      }
    });

    return { data, countries: Array.from(countrySet).sort() };
  }, [filteredOrders, metric]);

  // Calculate daily by category
  const dailyByCategory = useMemo(() => {
    // Get top 10 categories by order count
    const categoryCount = new Map<string, number>();
    filteredOrders.forEach(tx => {
      const cat = tx.productCategory || 'Uncategorized';
      categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
    });

    const topCategories = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cat]) => cat);

    const data: DayByDimensionData[] = Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      label: DAY_LABELS[i]
    }));

    filteredOrders.forEach(tx => {
      const marketplace = tx.marketplaceCode || 'US';
      const day = getDayFromTransaction(tx);
      const category = tx.productCategory || 'Uncategorized';

      if (!topCategories.includes(category)) return;

      if (day >= 1 && day <= 31) {
        const current = (data[day - 1][category] as number) || 0;

        if (metric === 'orders') {
          data[day - 1][category] = current + 1;
        } else if (metric === 'quantity') {
          data[day - 1][category] = current + Math.abs(tx.quantity || 0);
        } else {
          const sourceCurrency = getMarketplaceCurrency(marketplace);
          const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
          const usdRevenue = convertCurrency(localRevenue, sourceCurrency, 'USD');
          data[day - 1][category] = current + usdRevenue;
        }
      }
    });

    return { data, categories: topCategories };
  }, [filteredOrders, metric]);

  // Calculate daily by fulfillment
  const dailyByFulfillment = useMemo(() => {
    const data: DayByDimensionData[] = Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      label: DAY_LABELS[i],
      FBA: 0,
      FBM: 0
    }));

    filteredOrders.forEach(tx => {
      const marketplace = tx.marketplaceCode || 'US';
      const day = getDayFromTransaction(tx);
      const fulfillment = tx.fulfillment === 'FBA' ? 'FBA' : tx.fulfillment === 'FBM' ? 'FBM' : null;

      if (!fulfillment || day < 1 || day > 31) return;

      const current = (data[day - 1][fulfillment] as number) || 0;

      if (metric === 'orders') {
        data[day - 1][fulfillment] = current + 1;
      } else if (metric === 'quantity') {
        data[day - 1][fulfillment] = current + Math.abs(tx.quantity || 0);
      } else {
        const sourceCurrency = getMarketplaceCurrency(marketplace);
        const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
        const usdRevenue = convertCurrency(localRevenue, sourceCurrency, 'USD');
        data[day - 1][fulfillment] = current + usdRevenue;
      }
    });

    return data;
  }, [filteredOrders, metric]);

  // Find peak days and insights
  const insights = useMemo(() => {
    const sortedByOrders = [...dailyData].sort((a, b) => b.orders - a.orders);
    const top5Days = sortedByOrders.slice(0, 5);
    const bottom5Days = sortedByOrders.filter(d => d.orders > 0).slice(-5).reverse();

    // Week grouping (1-7, 8-14, 15-21, 22-31)
    const weeks = [
      { label: '1-7', orders: 0, revenue: 0 },
      { label: '8-14', orders: 0, revenue: 0 },
      { label: '15-21', orders: 0, revenue: 0 },
      { label: '22-31', orders: 0, revenue: 0 },
    ];

    dailyData.forEach(d => {
      if (d.day <= 7) {
        weeks[0].orders += d.orders;
        weeks[0].revenue += d.revenue;
      } else if (d.day <= 14) {
        weeks[1].orders += d.orders;
        weeks[1].revenue += d.revenue;
      } else if (d.day <= 21) {
        weeks[2].orders += d.orders;
        weeks[2].revenue += d.revenue;
      } else {
        weeks[3].orders += d.orders;
        weeks[3].revenue += d.revenue;
      }
    });

    const totalOrders = dailyData.reduce((sum, d) => sum + d.orders, 0);
    const totalRevenue = dailyData.reduce((sum, d) => sum + d.revenue, 0);
    const avgOrdersPerDay = totalOrders / 31;

    return {
      top5Days,
      bottom5Days,
      weeks,
      totalOrders,
      totalRevenue,
      avgOrdersPerDay,
    };
  }, [dailyData]);

  // Get bar color based on value
  const getBarColor = (value: number, max: number) => {
    const ratio = max > 0 ? value / max : 0;
    if (ratio >= 0.8) return '#22c55e'; // green - high
    if (ratio >= 0.5) return '#3b82f6'; // blue - medium-high
    if (ratio >= 0.3) return '#f59e0b'; // yellow - medium
    return '#94a3b8'; // gray - low
  };

  const maxValue = Math.max(...dailyData.map(d =>
    metric === 'orders' ? d.orders : metric === 'quantity' ? d.quantity : d.revenue
  ));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Ayın Günlerine Göre Sipariş Analizi</h2>
              <p className="text-sm text-slate-500">
                {filteredOrders.length.toLocaleString()} sipariş analiz edildi
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          {/* View Mode */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Görünüm:</span>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {[
                { value: 'overview', label: 'Genel', icon: BarChart3 },
                { value: 'byCountry', label: 'Ülke', icon: Globe },
                { value: 'byCategory', label: 'Kategori', icon: Layers },
                { value: 'byFulfillment', label: 'FBA/FBM', icon: Package },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setViewMode(value as ViewMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    viewMode === value
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Metric Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Metrik:</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as MetricType)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="orders">Sipariş Sayısı</option>
              <option value="quantity">Ürün Adedi</option>
              <option value="revenue">Gelir (USD)</option>
            </select>
          </div>

          {/* Marketplace Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedMarketplace}
              onChange={(e) => setSelectedMarketplace(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Tüm Pazaryerleri</option>
              {marketplaces.map(mp => (
                <option key={mp} value={mp}>{mp}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Tüm Kategoriler</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}

          {/* Fulfillment Filter */}
          <select
            value={selectedFulfillment}
            onChange={(e) => setSelectedFulfillment(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Tüm Kanallar</option>
            <option value="FBA">FBA</option>
            <option value="FBM">FBM</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-sm text-slate-500 mb-1">Toplam Sipariş</div>
          <div className="text-2xl font-bold text-slate-800">
            {insights.totalOrders.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-sm text-slate-500 mb-1">Toplam Gelir</div>
          <div className="text-2xl font-bold text-green-600">
            {formatMoney(insights.totalRevenue)}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-sm text-slate-500 mb-1">Günlük Ortalama</div>
          <div className="text-2xl font-bold text-purple-600">
            {Math.round(insights.avgOrdersPerDay).toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-sm text-slate-500 mb-1">En Yoğun Gün</div>
          <div className="text-2xl font-bold text-blue-600">
            {insights.top5Days[0]?.day || '-'}. gün
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-medium text-slate-700 mb-4">
          {viewMode === 'overview' && 'Ayın Günlerine Göre Dağılım'}
          {viewMode === 'byCountry' && 'Ülkelere Göre Günlük Dağılım'}
          {viewMode === 'byCategory' && 'Kategorilere Göre Günlük Dağılım'}
          {viewMode === 'byFulfillment' && 'FBA/FBM Günlük Dağılım'}
        </h3>

        <ResponsiveContainer width="100%" height={400}>
          {viewMode === 'overview' ? (
            <BarChart data={dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#64748b' }}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                formatter={(value: number | undefined) => [
                  metric === 'revenue' ? formatMoney(value || 0) : (value || 0).toLocaleString(),
                  metric === 'orders' ? 'Sipariş' : metric === 'quantity' ? 'Adet' : 'Gelir'
                ]}
                labelFormatter={(label) => `${label}. gün`}
              />
              <Bar
                dataKey={metric}
                radius={[4, 4, 0, 0]}
              >
                {dailyData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getBarColor(
                      metric === 'orders' ? entry.orders : metric === 'quantity' ? entry.quantity : entry.revenue,
                      maxValue
                    )}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : viewMode === 'byCountry' ? (
            <LineChart data={dailyByCountry.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                formatter={(value: number | undefined, name: string | undefined) => [
                  metric === 'revenue' ? formatMoney(value || 0) : (value || 0).toLocaleString(),
                  name || ''
                ]}
                labelFormatter={(label) => `${label}. gün`}
              />
              <Legend />
              {dailyByCountry.countries.map(country => (
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
            <LineChart data={dailyByCategory.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                formatter={(value: number | undefined, name: string | undefined) => [
                  metric === 'revenue' ? formatMoney(value || 0) : (value || 0).toLocaleString(),
                  name || ''
                ]}
                labelFormatter={(label) => `${label}. gün`}
              />
              <Legend />
              {dailyByCategory.categories.map((category, index) => (
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
            <BarChart data={dailyByFulfillment} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                formatter={(value: number | undefined, name: string | undefined) => [
                  metric === 'revenue' ? formatMoney(value || 0) : (value || 0).toLocaleString(),
                  name || ''
                ]}
                labelFormatter={(label) => `${label}. gün`}
              />
              <Legend />
              <Bar dataKey="FBA" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="FBM" fill="#10b981" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Week Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Week Distribution */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-medium text-slate-700 mb-4">Haftalık Dağılım</h3>
          <div className="space-y-3">
            {insights.weeks.map((week, index) => {
              const maxWeekOrders = Math.max(...insights.weeks.map(w => w.orders));
              const percentage = maxWeekOrders > 0 ? (week.orders / maxWeekOrders) * 100 : 0;

              return (
                <div key={week.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{week.label}. günler</span>
                    <span className="font-medium text-slate-800">
                      {week.orders.toLocaleString()} sipariş
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 text-right">
                    {formatMoney(week.revenue)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top & Bottom Days */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-medium text-slate-700 mb-4">En Yoğun & En Sakin Günler</h3>

          <div className="space-y-4">
            <div>
              <div className="text-xs text-green-600 font-medium mb-2">EN YOĞUN 5 GÜN</div>
              <div className="space-y-1">
                {insights.top5Days.map((day, index) => (
                  <div key={day.day} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      <span className="font-medium text-slate-800">{day.day}.</span> gün
                    </span>
                    <span className="font-medium text-green-600">
                      {day.orders.toLocaleString()} ({formatPercent(day.percentage)})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="text-xs text-slate-400 font-medium mb-2">EN SAKİN 5 GÜN</div>
              <div className="space-y-1">
                {insights.bottom5Days.map((day, index) => (
                  <div key={day.day} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      <span className="font-medium text-slate-800">{day.day}.</span> gün
                    </span>
                    <span className="text-slate-500">
                      {day.orders.toLocaleString()} ({formatPercent(day.percentage)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDayAnalyzer;
