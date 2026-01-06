/**
 * FBM Refund Shipping Cost Analyzer
 * Links Order transactions with Shipping Services by Order ID
 * Provides SKU/Product/Parent/Category level FBM shipping cost analysis
 */

import React, { useState, useMemo } from 'react';
import { Truck, Package, Layers, Tags, Filter, Download, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import type { TransactionData } from '../../types/transaction';
import { convertCurrency, getMarketplaceCurrency } from '../../utils/currencyExchange';
import { createMoneyFormatter, formatPercent } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

type GroupByType = 'sku' | 'product' | 'parent' | 'category';

interface ShippingCostItem {
  key: string;
  label: string;
  sku?: string;
  name?: string;
  parent?: string;
  category?: string;
  orderQuantity: number;
  returnQuantity: number;
  revenue: number;
  shippingCost: number;
  shippingCostPercentage: number;
  marketplace?: string;
}

interface FbmShippingAnalyzerProps {
  transactionData: TransactionData[];
}

// ============================================
// COMPONENT
// ============================================

const FbmShippingAnalyzer: React.FC<FbmShippingAnalyzerProps> = ({ transactionData }) => {
  const [groupBy, setGroupBy] = useState<GroupByType>('product');
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'shippingCost' | 'orderQuantity' | 'returnQuantity'>('shippingCost');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const formatMoney = createMoneyFormatter('USD');

  // Get available marketplaces and categories
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

  // Build Order ID -> Shipping Cost map from Shipping Services transactions
  const shippingCostMap = useMemo(() => {
    const map = new Map<string, { cost: number; marketplace: string }>();

    transactionData.forEach(tx => {
      // Shipping Services type has categoryType = 'Shipping Services'
      if (tx.categoryType === 'Shipping Services' && tx.orderId) {
        const marketplace = tx.marketplaceCode || 'US';
        const sourceCurrency = getMarketplaceCurrency(marketplace);
        // Shipping cost is typically in 'total' field (negative value)
        const localCost = Math.abs(tx.total || 0);
        const usdCost = convertCurrency(localCost, sourceCurrency, 'USD');

        const existing = map.get(tx.orderId);
        if (existing) {
          existing.cost += usdCost;
        } else {
          map.set(tx.orderId, { cost: usdCost, marketplace });
        }
      }
    });

    return map;
  }, [transactionData]);

  // Calculate FBM shipping costs by group
  const analysisData = useMemo(() => {
    const effectiveStart = startDate || dateRange.min;
    const effectiveEnd = endDate || dateRange.max;

    // Filter FBM orders within date range
    const fbmOrders = transactionData.filter(tx => {
      if (tx.categoryType !== 'Order' || tx.fulfillment !== 'FBM') return false;
      if (!tx.orderId) return false;

      // Date filter
      if (effectiveStart && tx.dateOnly && tx.dateOnly < effectiveStart) return false;
      if (effectiveEnd && tx.dateOnly && tx.dateOnly > effectiveEnd) return false;

      // Marketplace filter
      if (selectedMarketplace !== 'all' && tx.marketplaceCode !== selectedMarketplace) return false;

      // Category filter
      if (selectedCategory !== 'all' && tx.productCategory !== selectedCategory) return false;

      return true;
    });

    // Group by selected dimension
    const groups = new Map<string, {
      key: string;
      label: string;
      sku?: string;
      name?: string;
      parent?: string;
      category?: string;
      orderIds: Set<string>;
      orderQuantity: number;
      returnQuantity: number;
      revenue: number;
      shippingCost: number;
      marketplace?: string;
    }>();

    fbmOrders.forEach(tx => {
      let key: string;
      let label: string;

      switch (groupBy) {
        case 'sku':
          key = tx.sku || 'Unknown';
          label = tx.sku || 'Unknown SKU';
          break;
        case 'product':
          key = tx.name || tx.sku || 'Unknown';
          label = tx.name || tx.sku || 'Unknown Product';
          break;
        case 'parent':
          key = tx.parent || 'No Parent';
          label = tx.parent || 'No Parent ASIN';
          break;
        case 'category':
          key = tx.productCategory || 'Uncategorized';
          label = tx.productCategory || 'Uncategorized';
          break;
        default:
          key = tx.sku || 'Unknown';
          label = tx.sku || 'Unknown';
      }

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label,
          sku: tx.sku,
          name: tx.name,
          parent: tx.parent,
          category: tx.productCategory,
          orderIds: new Set(),
          orderQuantity: 0,
          returnQuantity: 0,
          revenue: 0,
          shippingCost: 0,
          marketplace: tx.marketplaceCode
        });
      }

      const group = groups.get(key)!;

      if (tx.orderId) {
        group.orderIds.add(tx.orderId);

        // Get shipping cost for this order
        const shippingInfo = shippingCostMap.get(tx.orderId);
        if (shippingInfo) {
          group.shippingCost += shippingInfo.cost;
        }
      }

      const marketplace = tx.marketplaceCode || 'US';
      const sourceCurrency = getMarketplaceCurrency(marketplace);
      const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
      const usdRevenue = convertCurrency(localRevenue, sourceCurrency, 'USD');

      // Positive quantity = order, negative = return
      const qty = tx.quantity || 0;
      if (qty > 0) {
        group.orderQuantity += qty;
      } else {
        group.returnQuantity += Math.abs(qty);
      }
      group.revenue += usdRevenue;
    });

    // Convert to array with calculated metrics
    const items: ShippingCostItem[] = Array.from(groups.values()).map(g => ({
      key: g.key,
      label: g.label,
      sku: g.sku,
      name: g.name,
      parent: g.parent,
      category: g.category,
      orderQuantity: g.orderQuantity,
      returnQuantity: g.returnQuantity,
      revenue: g.revenue,
      shippingCost: g.shippingCost,
      shippingCostPercentage: g.revenue > 0 ? (g.shippingCost / g.revenue) * 100 : 0,
      marketplace: g.marketplace
    }));

    // Sort
    items.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // Calculate totals
    const totals = items.reduce((acc, item) => ({
      orderQuantity: acc.orderQuantity + item.orderQuantity,
      returnQuantity: acc.returnQuantity + item.returnQuantity,
      revenue: acc.revenue + item.revenue,
      shippingCost: acc.shippingCost + item.shippingCost
    }), { orderQuantity: 0, returnQuantity: 0, revenue: 0, shippingCost: 0 });

    return { items, totals };
  }, [transactionData, shippingCostMap, groupBy, selectedMarketplace, selectedCategory, startDate, endDate, dateRange, sortBy, sortOrder]);

  // Stats
  const stats = useMemo(() => {
    const ordersWithShipping = transactionData.filter(
      tx => tx.categoryType === 'Shipping Services' && tx.orderId
    ).length;

    const fbmOrders = transactionData.filter(
      tx => tx.categoryType === 'Order' && tx.fulfillment === 'FBM' && tx.orderId
    );

    const fbmOrderIds = new Set(fbmOrders.map(tx => tx.orderId));
    const matchedOrders = Array.from(fbmOrderIds).filter(id => shippingCostMap.has(id)).length;

    return {
      totalShippingRecords: ordersWithShipping,
      totalFbmOrders: fbmOrderIds.size,
      matchedOrders,
      matchRate: fbmOrderIds.size > 0 ? (matchedOrders / fbmOrderIds.size) * 100 : 0
    };
  }, [transactionData, shippingCostMap]);

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ column }: { column: typeof sortBy }) => {
    if (sortBy !== column) return null;
    return sortOrder === 'desc'
      ? <ChevronDown className="w-4 h-4" />
      : <ChevronUp className="w-4 h-4" />;
  };

  const exportToCSV = () => {
    const headers = ['Label', 'SKU', 'Name', 'Parent', 'Category', 'Order Qty', 'Return Qty', 'Revenue (USD)', 'Shipping Cost (USD)', 'Cost %'];
    const rows = analysisData.items.map(item => [
      item.label,
      item.sku || '',
      item.name || '',
      item.parent || '',
      item.category || '',
      item.orderQuantity,
      item.returnQuantity,
      item.revenue.toFixed(2),
      item.shippingCost.toFixed(2),
      item.shippingCostPercentage.toFixed(1)
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fbm-refund-shipping-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">FBM Refund Shipping Cost</h2>
            <p className="text-sm text-slate-500">Order ID ile Shipping Services eşleştirmesi</p>
          </div>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">Shipping Kayıtları</div>
          <div className="text-xl font-bold text-slate-800">{stats.totalShippingRecords.toLocaleString()}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">FBM Siparişleri</div>
          <div className="text-xl font-bold text-slate-800">{stats.totalFbmOrders.toLocaleString()}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">Eşleşen</div>
          <div className="text-xl font-bold text-green-600">{stats.matchedOrders.toLocaleString()}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">Eşleşme Oranı</div>
          <div className="text-xl font-bold text-blue-600">{formatPercent(stats.matchRate)}</div>
        </div>
      </div>

      {/* Match Rate Warning */}
      {stats.matchRate < 50 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-amber-800">Düşük Eşleşme Oranı</div>
            <div className="text-xs text-amber-700">
              FBM siparişlerinin sadece {formatPercent(stats.matchRate)}'i Shipping Services kayıtlarıyla eşleşti.
              Bu durum, eksik veri veya farklı dosyalardan yükleme yapılmasından kaynaklanabilir.
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-600">Grupla:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByType)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="sku">SKU</option>
            <option value="product">Ürün (Name)</option>
            <option value="parent">Parent ASIN</option>
            <option value="category">Kategori</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Marketplace:</span>
          <select
            value={selectedMarketplace}
            onChange={(e) => setSelectedMarketplace(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">Tümü</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Tarih:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            min={dateRange.min}
            max={dateRange.max}
            className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
          <span className="text-slate-400">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={dateRange.min}
            max={dateRange.max}
            className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-xs text-orange-600 mb-1">Toplam Kargo Maliyeti</div>
          <div className="text-xl font-bold text-orange-700">{formatMoney(analysisData.totals.shippingCost)}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-xs text-blue-600 mb-1">Toplam Gelir</div>
          <div className="text-xl font-bold text-blue-700">{formatMoney(analysisData.totals.revenue)}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-xs text-purple-600 mb-1">Kargo Oranı</div>
          <div className="text-xl font-bold text-purple-700">
            {formatPercent(analysisData.totals.revenue > 0
              ? (analysisData.totals.shippingCost / analysisData.totals.revenue) * 100
              : 0)}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 font-medium text-slate-600">
                {groupBy === 'sku' ? 'SKU' :
                 groupBy === 'product' ? 'Ürün' :
                 groupBy === 'parent' ? 'Parent ASIN' : 'Kategori'}
              </th>
              <th
                className="text-right py-3 px-4 font-medium text-slate-600 cursor-pointer hover:text-slate-800"
                onClick={() => handleSort('orderQuantity')}
              >
                <div className="flex items-center justify-end gap-1">
                  Sipariş Adedi
                  <SortIcon column="orderQuantity" />
                </div>
              </th>
              <th
                className="text-right py-3 px-4 font-medium text-slate-600 cursor-pointer hover:text-slate-800"
                onClick={() => handleSort('returnQuantity')}
              >
                <div className="flex items-center justify-end gap-1">
                  Return Adedi
                  <SortIcon column="returnQuantity" />
                </div>
              </th>
              <th className="text-right py-3 px-4 font-medium text-slate-600">Gelir</th>
              <th
                className="text-right py-3 px-4 font-medium text-slate-600 cursor-pointer hover:text-slate-800"
                onClick={() => handleSort('shippingCost')}
              >
                <div className="flex items-center justify-end gap-1">
                  Kargo
                  <SortIcon column="shippingCost" />
                </div>
              </th>
              <th className="text-right py-3 px-4 font-medium text-slate-600">%</th>
            </tr>
          </thead>
          <tbody>
            {analysisData.items.slice(0, 50).map((item, idx) => (
              <tr key={item.key} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                <td className="py-3 px-4 text-left">
                  <div className="font-semibold text-indigo-700 truncate max-w-xs" title={item.label}>
                    {item.label}
                  </div>
                  {groupBy !== 'category' && item.category && (
                    <div className="text-xs text-slate-500 text-left">{item.category}</div>
                  )}
                </td>
                <td className="text-right py-3 px-4 text-slate-700">{item.orderQuantity.toLocaleString()}</td>
                <td className="text-right py-3 px-4 text-red-600 font-medium">{item.returnQuantity.toLocaleString()}</td>
                <td className="text-right py-3 px-4 text-slate-700">{formatMoney(item.revenue)}</td>
                <td className="text-right py-3 px-4 font-medium text-orange-600">{formatMoney(item.shippingCost)}</td>
                <td className={`text-right py-3 px-4 font-medium ${
                  item.shippingCostPercentage > 20 ? 'text-red-600' :
                  item.shippingCostPercentage > 10 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {formatPercent(item.shippingCostPercentage)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {analysisData.items.length > 50 && (
          <div className="text-center py-4 text-sm text-slate-500">
            {analysisData.items.length - 50} kayıt daha var. Export ile tamamını indirebilirsiniz.
          </div>
        )}

        {analysisData.items.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Filtrelere uygun FBM sipariş bulunamadı</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FbmShippingAnalyzer;
