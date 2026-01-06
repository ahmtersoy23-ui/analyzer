/**
 * FBM Refund Shipping Cost Analyzer
 * Analyzes Shipping Services costs (ReturnPostageBilling, Adjustment, etc.)
 * Groups by SKU/Product/Parent/Category with refund quantities from Refund transactions
 */

import React, { useState, useMemo } from 'react';
import { Truck, Filter, Download, ChevronDown, ChevronUp } from 'lucide-react';
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
  refundQuantity: number;
  shippingCost: number;
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
  const [selectedDescription, setSelectedDescription] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'shippingCost' | 'refundQuantity'>('shippingCost');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const formatMoney = createMoneyFormatter('USD');

  // Get available marketplaces, categories, descriptions, and date range
  const { marketplaces, categories, descriptions, dateRange } = useMemo(() => {
    const mps = new Set<string>();
    const cats = new Set<string>();
    const descs = new Set<string>();
    let minDate = '';
    let maxDate = '';

    transactionData.forEach(tx => {
      if (tx.marketplaceCode) mps.add(tx.marketplaceCode);
      if (tx.productCategory) cats.add(tx.productCategory);
      if (tx.dateOnly) {
        if (!minDate || tx.dateOnly < minDate) minDate = tx.dateOnly;
        if (!maxDate || tx.dateOnly > maxDate) maxDate = tx.dateOnly;
      }
      // Collect descriptions from Shipping Services
      if (tx.categoryType === 'Shipping Services' && tx.description) {
        descs.add(tx.description);
      }
    });

    return {
      marketplaces: Array.from(mps).sort(),
      categories: Array.from(cats).sort(),
      descriptions: Array.from(descs).sort(),
      dateRange: { min: minDate, max: maxDate }
    };
  }, [transactionData]);

  // Build SKU -> Refund quantity map from Refund transactions
  const refundQuantityMap = useMemo(() => {
    const map = new Map<string, number>();

    transactionData.forEach(tx => {
      if (tx.categoryType === 'Refund' && tx.sku) {
        const qty = Math.abs(tx.quantity || 0);
        map.set(tx.sku, (map.get(tx.sku) || 0) + qty);
      }
    });

    return map;
  }, [transactionData]);

  // Calculate shipping costs from Shipping Services transactions
  const analysisData = useMemo(() => {
    const effectiveStart = startDate || dateRange.min;
    const effectiveEnd = endDate || dateRange.max;

    // Filter Shipping Services transactions
    const shippingTransactions = transactionData.filter(tx => {
      if (tx.categoryType !== 'Shipping Services') return false;

      // Date filter
      if (effectiveStart && tx.dateOnly && tx.dateOnly < effectiveStart) return false;
      if (effectiveEnd && tx.dateOnly && tx.dateOnly > effectiveEnd) return false;

      // Marketplace filter
      if (selectedMarketplace !== 'all' && tx.marketplaceCode !== selectedMarketplace) return false;

      // Description filter
      if (selectedDescription !== 'all' && tx.description !== selectedDescription) return false;

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
      skus: Set<string>;
      shippingCost: number;
      marketplace?: string;
    }>();

    shippingTransactions.forEach(tx => {
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

      // Category filter (apply after grouping key is determined)
      if (selectedCategory !== 'all' && tx.productCategory !== selectedCategory) return;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label,
          sku: tx.sku,
          name: tx.name,
          parent: tx.parent,
          category: tx.productCategory,
          skus: new Set(),
          shippingCost: 0,
          marketplace: tx.marketplaceCode
        });
      }

      const group = groups.get(key)!;

      // Track SKUs for refund quantity lookup
      if (tx.sku) {
        group.skus.add(tx.sku);
      }

      // Add shipping cost (NOT absolute value - keep sign for net calculation)
      const marketplace = tx.marketplaceCode || 'US';
      const sourceCurrency = getMarketplaceCurrency(marketplace);
      const localCost = tx.total || 0;
      const usdCost = convertCurrency(localCost, sourceCurrency, 'USD');
      group.shippingCost += usdCost;
    });

    // Convert to array with calculated metrics
    const items: ShippingCostItem[] = Array.from(groups.values()).map(g => {
      // Sum refund quantities from all SKUs in this group
      let refundQty = 0;
      g.skus.forEach(sku => {
        refundQty += refundQuantityMap.get(sku) || 0;
      });

      return {
        key: g.key,
        label: g.label,
        sku: g.sku,
        name: g.name,
        parent: g.parent,
        category: g.category,
        refundQuantity: refundQty,
        shippingCost: g.shippingCost,
        marketplace: g.marketplace
      };
    });

    // Sort
    items.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // Calculate totals
    const totals = items.reduce((acc, item) => ({
      refundQuantity: acc.refundQuantity + item.refundQuantity,
      shippingCost: acc.shippingCost + item.shippingCost
    }), { refundQuantity: 0, shippingCost: 0 });

    return { items, totals };
  }, [transactionData, refundQuantityMap, groupBy, selectedMarketplace, selectedCategory, selectedDescription, startDate, endDate, dateRange, sortBy, sortOrder]);

  // Stats for Shipping Services
  const stats = useMemo(() => {
    const shippingRecords = transactionData.filter(
      tx => tx.categoryType === 'Shipping Services'
    );

    const refundRecords = transactionData.filter(
      tx => tx.categoryType === 'Refund'
    );

    const totalRefundQty = refundRecords.reduce((sum, tx) => sum + Math.abs(tx.quantity || 0), 0);

    return {
      totalShippingRecords: shippingRecords.length,
      totalRefunds: refundRecords.length,
      totalRefundQty
    };
  }, [transactionData]);

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
    const headers = ['Label', 'SKU', 'Name', 'Parent', 'Category', 'Refund Qty', 'Shipping Cost (USD)'];
    const rows = analysisData.items.map(item => [
      item.label,
      item.sku || '',
      item.name || '',
      item.parent || '',
      item.category || '',
      item.refundQuantity,
      item.shippingCost.toFixed(2)
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
            <p className="text-sm text-slate-500">Shipping Services kargo maliyetleri analizi</p>
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
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">Shipping Kayıtları</div>
          <div className="text-xl font-bold text-slate-800">{stats.totalShippingRecords.toLocaleString()}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">Refund İşlemleri</div>
          <div className="text-xl font-bold text-slate-800">{stats.totalRefunds.toLocaleString()}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">Toplam Refund Adedi</div>
          <div className="text-xl font-bold text-red-600">{stats.totalRefundQty.toLocaleString()}</div>
        </div>
      </div>

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
          <span className="text-sm text-slate-600">Tip:</span>
          <select
            value={selectedDescription}
            onChange={(e) => setSelectedDescription(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">Tümü</option>
            {descriptions.map(desc => (
              <option key={desc} value={desc}>{desc}</option>
            ))}
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
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-xs text-orange-600 mb-1">Toplam Kargo Maliyeti (Net)</div>
          <div className="text-xl font-bold text-orange-700">{formatMoney(Math.abs(analysisData.totals.shippingCost))}</div>
          <div className="text-xs text-slate-500 mt-1">
            {analysisData.totals.shippingCost < 0 ? 'Gider' : 'Geri ödeme'}
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-xs text-red-600 mb-1">Toplam Refund Adedi</div>
          <div className="text-xl font-bold text-red-700">{analysisData.totals.refundQuantity.toLocaleString()}</div>
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
                onClick={() => handleSort('refundQuantity')}
              >
                <div className="flex items-center justify-end gap-1">
                  Refund Adedi
                  <SortIcon column="refundQuantity" />
                </div>
              </th>
              <th
                className="text-right py-3 px-4 font-medium text-slate-600 cursor-pointer hover:text-slate-800"
                onClick={() => handleSort('shippingCost')}
              >
                <div className="flex items-center justify-end gap-1">
                  Kargo Maliyeti
                  <SortIcon column="shippingCost" />
                </div>
              </th>
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
                <td className="text-right py-3 px-4 text-red-600 font-medium">{item.refundQuantity.toLocaleString()}</td>
                <td className="text-right py-3 px-4 font-medium text-orange-600">{formatMoney(item.shippingCost)}</td>
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
            <p>Filtrelere uygun Shipping Services kaydı bulunamadı</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FbmShippingAnalyzer;
