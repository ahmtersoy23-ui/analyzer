/**
 * FBM Refund Shipping Cost Analyzer
 * Links FBM Orders with Shipping Services by Order ID
 * Gets refund counts from Refund transactions
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Truck, Filter, Download, ChevronDown, ChevronUp, Check } from 'lucide-react';
import type { TransactionData } from '../../types/transaction';
import { convertCurrency, getMarketplaceCurrency } from '../../utils/currencyExchange';
import { createMoneyFormatter, formatPercent } from '../../utils/formatters';

type GroupByType = 'sku' | 'product' | 'parent' | 'category';

interface ShippingItem {
  key: string;
  label: string;
  category?: string;
  totalOrderQuantity: number;  // All FBM orders
  orderQuantity: number;       // Orders with shipping
  refundQuantity: number;
  totalRevenue: number;        // All FBM revenue
  revenue: number;             // Revenue from orders with shipping
  shippingCost: number;
  shippingPercent: number;
}

interface FbmShippingAnalyzerProps {
  transactionData: TransactionData[];
}

const FbmShippingAnalyzer: React.FC<FbmShippingAnalyzerProps> = ({ transactionData }) => {
  const [groupBy, setGroupBy] = useState<GroupByType>('product');
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDescriptions, setSelectedDescriptions] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'shippingCost' | 'refundQuantity' | 'shippingPercent'>('shippingCost');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isDescDropdownOpen, setIsDescDropdownOpen] = useState(false);
  const descDropdownRef = useRef<HTMLDivElement>(null);

  const formatMoney = createMoneyFormatter('USD');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (descDropdownRef.current && !descDropdownRef.current.contains(event.target as Node)) {
        setIsDescDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDescription = (desc: string) => {
    setSelectedDescriptions(prev =>
      prev.includes(desc)
        ? prev.filter(d => d !== desc)
        : [...prev, desc]
    );
  };

  // Get filter options and date range
  const { marketplaces, categories, descriptions, dateRange } = useMemo(() => {
    const mps = new Set<string>();
    const cats = new Set<string>();
    const descs = new Set<string>();
    let minDate = '';
    let maxDate = '';

    transactionData.forEach(tx => {
      if (tx.marketplaceCode) mps.add(tx.marketplaceCode);
      if (tx.productCategory) cats.add(tx.productCategory);
      if (tx.categoryType === 'Shipping Services' && tx.description) {
        descs.add(tx.description);
      }
      if (tx.dateOnly) {
        if (!minDate || tx.dateOnly < minDate) minDate = tx.dateOnly;
        if (!maxDate || tx.dateOnly > maxDate) maxDate = tx.dateOnly;
      }
    });

    return {
      marketplaces: Array.from(mps).sort(),
      categories: Array.from(cats).sort(),
      descriptions: Array.from(descs).sort(),
      dateRange: { min: minDate, max: maxDate }
    };
  }, [transactionData]);

  // Build Order ID -> Shipping Cost map
  // Negative total = cost (we pay), Positive total = refund (we receive back)
  // Net shipping cost = sum of negative totals (as positive) - sum of positive totals
  const shippingCostMap = useMemo(() => {
    const map = new Map<string, number>();

    transactionData.forEach(tx => {
      if (tx.categoryType !== 'Shipping Services' || !tx.orderId) return;
      // Multi-select filter: empty array = all, filled array = selected only
      if (selectedDescriptions.length > 0 && !selectedDescriptions.includes(tx.description || '')) return;

      const marketplace = tx.marketplaceCode || 'US';
      const sourceCurrency = getMarketplaceCurrency(marketplace);
      const localTotal = tx.total || 0;

      // Negative total = cost (convert to positive for display)
      // Positive total = refund/credit (subtract from cost)
      const usdAmount = convertCurrency(localTotal, sourceCurrency, 'USD');
      // We negate because negative total means cost to us
      const costAmount = -usdAmount;

      map.set(tx.orderId, (map.get(tx.orderId) || 0) + costAmount);
    });

    return map;
  }, [transactionData, selectedDescriptions]);

  // Build Order ID -> Refund Quantity map
  const refundQuantityMap = useMemo(() => {
    const map = new Map<string, number>();

    transactionData.forEach(tx => {
      if (tx.categoryType !== 'Refund' || !tx.orderId) return;
      map.set(tx.orderId, (map.get(tx.orderId) || 0) + Math.abs(tx.quantity || 1));
    });

    return map;
  }, [transactionData]);

  // Helper to get group key
  const getGroupKey = (tx: TransactionData): { key: string; label: string; category?: string } => {
    switch (groupBy) {
      case 'sku':
        return { key: tx.sku || 'Unknown', label: tx.sku || 'Unknown SKU', category: tx.productCategory };
      case 'product':
        return { key: tx.name || tx.sku || 'Unknown', label: tx.name || tx.sku || 'Unknown Product', category: tx.productCategory };
      case 'parent':
        return { key: tx.parent || 'No Parent', label: tx.parent || 'No Parent ASIN', category: tx.productCategory };
      case 'category':
        return { key: tx.productCategory || 'Uncategorized', label: tx.productCategory || 'Uncategorized' };
      default:
        return { key: tx.name || tx.sku || 'Unknown', label: tx.name || tx.sku || 'Unknown Product', category: tx.productCategory };
    }
  };

  // Analyze FBM Orders
  const analysisData = useMemo(() => {
    const effectiveStart = startDate || dateRange.min;
    const effectiveEnd = endDate || dateRange.max;

    // Get ALL FBM Orders (filtered by marketplace, category, date)
    const allFbmOrders = transactionData.filter(tx => {
      if (tx.categoryType !== 'Order' || tx.fulfillment !== 'FBM') return false;
      if (selectedMarketplace !== 'all' && tx.marketplaceCode !== selectedMarketplace) return false;
      if (selectedCategory !== 'all' && tx.productCategory !== selectedCategory) return false;
      if (effectiveStart && tx.dateOnly && tx.dateOnly < effectiveStart) return false;
      if (effectiveEnd && tx.dateOnly && tx.dateOnly > effectiveEnd) return false;
      return true;
    });

    // Get FBM Orders that have shipping costs
    const fbmOrdersWithShipping = allFbmOrders.filter(tx => tx.orderId && shippingCostMap.has(tx.orderId));

    // First pass: Calculate totals for ALL FBM orders per group (for totalOrderQuantity and totalRevenue)
    const allOrderGroups = new Map<string, { totalOrderQuantity: number; totalRevenue: number }>();

    allFbmOrders.forEach(tx => {
      const { key } = getGroupKey(tx);

      if (!allOrderGroups.has(key)) {
        allOrderGroups.set(key, { totalOrderQuantity: 0, totalRevenue: 0 });
      }

      const group = allOrderGroups.get(key)!;
      const marketplace = tx.marketplaceCode || 'US';
      const sourceCurrency = getMarketplaceCurrency(marketplace);
      const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
      const usdRevenue = convertCurrency(localRevenue, sourceCurrency, 'USD');

      group.totalOrderQuantity += Math.abs(tx.quantity || 0);
      group.totalRevenue += usdRevenue;
    });

    // Second pass: Group FBM orders with shipping
    const groups = new Map<string, ShippingItem>();
    const processedOrders = new Set<string>();

    fbmOrdersWithShipping.forEach(tx => {
      const { key, label, category } = getGroupKey(tx);

      if (!groups.has(key)) {
        const allOrderData = allOrderGroups.get(key) || { totalOrderQuantity: 0, totalRevenue: 0 };
        groups.set(key, {
          key,
          label,
          category,
          totalOrderQuantity: allOrderData.totalOrderQuantity,
          orderQuantity: 0,
          refundQuantity: 0,
          totalRevenue: allOrderData.totalRevenue,
          revenue: 0,
          shippingCost: 0,
          shippingPercent: 0
        });
      }

      const group = groups.get(key)!;

      // Add order quantity and revenue (for orders with shipping)
      const marketplace = tx.marketplaceCode || 'US';
      const sourceCurrency = getMarketplaceCurrency(marketplace);
      const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
      const usdRevenue = convertCurrency(localRevenue, sourceCurrency, 'USD');

      group.orderQuantity += Math.abs(tx.quantity || 0);
      group.revenue += usdRevenue;

      // Add shipping cost (once per order)
      if (tx.orderId && !processedOrders.has(tx.orderId)) {
        processedOrders.add(tx.orderId);
        const shippingCost = shippingCostMap.get(tx.orderId) || 0;
        group.shippingCost += shippingCost;

        // Add refund quantity for this order
        const refundQty = refundQuantityMap.get(tx.orderId) || 0;
        group.refundQuantity += refundQty;
      }
    });

    // Calculate shipping percentages based on TOTAL revenue (not just shipping orders revenue)
    groups.forEach(group => {
      group.shippingPercent = group.totalRevenue > 0 ? (group.shippingCost / group.totalRevenue) * 100 : 0;
    });

    // Convert to array and sort
    const items = Array.from(groups.values());
    items.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // Calculate totals
    const itemTotals = items.reduce((acc, item) => ({
      totalOrderQuantity: acc.totalOrderQuantity + item.totalOrderQuantity,
      orderQuantity: acc.orderQuantity + item.orderQuantity,
      refundQuantity: acc.refundQuantity + item.refundQuantity,
      totalRevenue: acc.totalRevenue + item.totalRevenue,
      revenue: acc.revenue + item.revenue,
      shippingCost: acc.shippingCost + item.shippingCost
    }), { totalOrderQuantity: 0, orderQuantity: 0, refundQuantity: 0, totalRevenue: 0, revenue: 0, shippingCost: 0 });

    // Calculate TOTAL FBM revenue from ALL FBM orders
    let totalFbmRevenue = 0;
    let totalFbmQuantity = 0;
    allFbmOrders.forEach(tx => {
      const marketplace = tx.marketplaceCode || 'US';
      const sourceCurrency = getMarketplaceCurrency(marketplace);
      const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
      totalFbmRevenue += convertCurrency(localRevenue, sourceCurrency, 'USD');
      totalFbmQuantity += Math.abs(tx.quantity || 0);
    });

    const totalShippingPercent = totalFbmRevenue > 0 ? (itemTotals.shippingCost / totalFbmRevenue) * 100 : 0;

    return {
      items,
      totals: {
        ...itemTotals,
        totalRevenue: totalFbmRevenue,
        totalOrderQuantity: totalFbmQuantity,
        shippingPercent: totalShippingPercent
      }
    };
  }, [transactionData, shippingCostMap, refundQuantityMap, groupBy, selectedMarketplace, selectedCategory, sortBy, sortOrder, startDate, endDate, dateRange]);

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
    return sortOrder === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />;
  };

  const exportToCSV = () => {
    const headers = ['Label', 'Category', 'Order Qty', 'Refund Qty', 'Revenue (USD)', 'Shipping Cost (USD)', 'Shipping %'];
    const rows = analysisData.items.map(item => [
      item.label,
      item.category || '',
      item.orderQuantity,
      item.refundQuantity,
      item.revenue.toFixed(2),
      item.shippingCost.toFixed(2),
      item.shippingPercent.toFixed(1)
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fbm-shipping-${new Date().toISOString().slice(0, 10)}.csv`;
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
            <h2 className="text-xl font-bold text-slate-800">FBM Shipping Cost Analysis</h2>
            <p className="text-sm text-slate-500">Shipping Services cost analysis by product</p>
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-600">Group by:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByType)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="sku">SKU</option>
            <option value="product">Product (Name)</option>
            <option value="parent">Parent ASIN</option>
            <option value="category">Category</option>
          </select>
        </div>

        <div className="flex items-center gap-2 relative" ref={descDropdownRef}>
          <span className="text-sm text-slate-600">Type:</span>
          <button
            onClick={() => setIsDescDropdownOpen(!isDescDropdownOpen)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white flex items-center gap-2 min-w-[140px]"
          >
            <span className="truncate">
              {selectedDescriptions.length === 0
                ? 'All'
                : selectedDescriptions.length === 1
                  ? selectedDescriptions[0]
                  : `${selectedDescriptions.length} selected`}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDescDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDescDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-50 min-w-[200px] max-h-64 overflow-y-auto">
              <div
                className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-2 border-b border-slate-200"
                onClick={() => setSelectedDescriptions([])}
              >
                <div className={`w-4 h-4 border rounded flex items-center justify-center ${selectedDescriptions.length === 0 ? 'bg-orange-500 border-orange-500' : 'border-slate-300'}`}>
                  {selectedDescriptions.length === 0 && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm">All</span>
              </div>
              {descriptions.map(desc => (
                <div
                  key={desc}
                  className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-2"
                  onClick={() => toggleDescription(desc)}
                >
                  <div className={`w-4 h-4 border rounded flex items-center justify-center ${selectedDescriptions.includes(desc) ? 'bg-orange-500 border-orange-500' : 'border-slate-300'}`}>
                    {selectedDescriptions.includes(desc) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm">{desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Marketplace:</span>
          <select
            value={selectedMarketplace}
            onChange={(e) => setSelectedMarketplace(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All</option>
            {marketplaces.map(mp => (
              <option key={mp} value={mp}>{mp}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Date:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            min={dateRange.min}
            max={dateRange.max}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
          <span className="text-slate-400">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={dateRange.min}
            max={dateRange.max}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-xs text-orange-600 mb-1">Total Shipping Cost</div>
          <div className="text-xl font-bold text-orange-700">{formatMoney(analysisData.totals.shippingCost)}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-xs text-blue-600 mb-1">Total FBM Revenue</div>
          <div className="text-xl font-bold text-blue-700">{formatMoney(analysisData.totals.totalRevenue)}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-xs text-purple-600 mb-1">Shipping / Revenue</div>
          <div className="text-xl font-bold text-purple-700">{formatPercent(analysisData.totals.shippingPercent)}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-xs text-red-600 mb-1">Total Refunds</div>
          <div className="text-xl font-bold text-red-700">{analysisData.totals.refundQuantity.toLocaleString()}</div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 font-medium text-slate-600">
                {groupBy === 'sku' ? 'SKU' : groupBy === 'product' ? 'Product' : groupBy === 'parent' ? 'Parent ASIN' : 'Category'}
              </th>
              <th className="text-right py-3 px-4 font-medium text-slate-600">Total Orders</th>
              <th
                className="text-right py-3 px-4 font-medium text-slate-600 cursor-pointer hover:text-slate-800"
                onClick={() => handleSort('refundQuantity')}
              >
                <div className="flex items-center justify-end gap-1">
                  Refunds
                  <SortIcon column="refundQuantity" />
                </div>
              </th>
              <th className="text-right py-3 px-4 font-medium text-slate-600">Total Revenue</th>
              <th
                className="text-right py-3 px-4 font-medium text-slate-600 cursor-pointer hover:text-slate-800"
                onClick={() => handleSort('shippingCost')}
              >
                <div className="flex items-center justify-end gap-1">
                  Shipping
                  <SortIcon column="shippingCost" />
                </div>
              </th>
              <th
                className="text-right py-3 px-4 font-medium text-slate-600 cursor-pointer hover:text-slate-800"
                onClick={() => handleSort('shippingPercent')}
              >
                <div className="flex items-center justify-end gap-1">
                  %
                  <SortIcon column="shippingPercent" />
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
                <td className="text-right py-3 px-4 text-slate-700">{item.totalOrderQuantity.toLocaleString()}</td>
                <td className="text-right py-3 px-4 text-red-600 font-medium">{item.refundQuantity.toLocaleString()}</td>
                <td className="text-right py-3 px-4 text-slate-700">{formatMoney(item.totalRevenue)}</td>
                <td className="text-right py-3 px-4 font-medium text-orange-600">{formatMoney(item.shippingCost)}</td>
                <td className={`text-right py-3 px-4 font-medium ${
                  item.shippingPercent > 20 ? 'text-red-600' :
                  item.shippingPercent > 10 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {formatPercent(item.shippingPercent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {analysisData.items.length > 50 && (
          <div className="text-center py-4 text-sm text-slate-500">
            {analysisData.items.length - 50} more items. Use Export to download all.
          </div>
        )}

        {analysisData.items.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No FBM orders found matching filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FbmShippingAnalyzer;
