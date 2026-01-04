/**
 * ProductDetailModal - Detailed view for a specific product or parent group
 * Shows product analytics and variant details
 */

import React, { useMemo } from 'react';
import { X, Package, DollarSign, ShoppingCart, Tag, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatMoney, formatPercent } from '../../utils/formatters';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  productData: any;
  marketplace: string;
  viewType?: 'category' | 'parent' | 'name';
  transactionData: any[];
  dateRange: { start: string; end: string };
  comparisonMode: 'none' | 'previous-period' | 'previous-year';
  comparisonDateRange: { start: Date; end: Date } | null;
  globalCosts: {
    advertising: number;
    fba: number;
    fbm: number;
  };
  salesByFulfillment: {
    totalSales: number;
    fbaSales: number;
    fbmSales: number;
  };
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  onClose,
  productData,
  marketplace,
  viewType = 'name',
  transactionData,
  dateRange,
  comparisonMode,
  comparisonDateRange,
  globalCosts,
  salesByFulfillment
}) => {
  // State for showing/hiding comparison line
  const [showComparison, setShowComparison] = React.useState(comparisonMode !== 'none');
  // Calculate date range in days for smart grouping
  const dateRangeDays = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return 0;
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, [dateRange]);

  // Determine if we should group by month (>90 days) or day (<=90 days)
  const groupByMonth = dateRangeDays > 90;

  // Calculate sales trend data (must be before early return)
  const salesTrendData = useMemo(() => {
    if (!productData) return [];

    // Filter transactions for this product AND date range
    const filtered = transactionData.filter(t => {
      // Only include Order transactions (not Refund, ServiceFee, etc.)
      if (t.categoryType !== 'Order') return false;

      // Product/parent/category filter
      const matchesProduct = viewType === 'category'
        ? t.productCategory === productData.category
        : viewType === 'parent'
        ? t.parent === productData.parent
        : t.name === productData.name;

      if (!matchesProduct) return false;

      // Date range filter
      if (dateRange.start || dateRange.end) {
        if (!t.date) return false;
        const transactionDate = new Date(t.date);
        if (dateRange.start && transactionDate < new Date(dateRange.start)) return false;
        if (dateRange.end && transactionDate > new Date(dateRange.end)) return false;
      }

      // Marketplace filter
      if (marketplace !== 'all' && t.marketplaceCode !== marketplace) return false;

      return true;
    });

    // Group by date or month
    const grouped: Record<string, { date: string; sales: number; quantity: number; orders: number }> = {};

    filtered.forEach(t => {
      if (!t.date) return;
      const date = new Date(t.date);

      // Group by month or day based on date range
      const dateKey = groupByMonth
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` // YYYY-MM
        : date.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!grouped[dateKey]) {
        grouped[dateKey] = { date: dateKey, sales: 0, quantity: 0, orders: 0 };
      }

      grouped[dateKey].sales += t.productSales || 0;
      grouped[dateKey].quantity += t.quantity || 0;
      grouped[dateKey].orders += 1;
    });

    // Sort by date
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [transactionData, productData, viewType, dateRange, groupByMonth, marketplace]);

  // Calculate comparison sales trend data
  const comparisonSalesTrendData = useMemo(() => {
    if (!productData || !comparisonDateRange) return [];

    // Filter transactions for comparison period
    const filtered = transactionData.filter(t => {
      if (t.categoryType !== 'Order') return false;

      const matchesProduct = viewType === 'category'
        ? t.productCategory === productData.category
        : viewType === 'parent'
        ? t.parent === productData.parent
        : t.name === productData.name;

      if (!matchesProduct) return false;

      // Comparison date range filter
      if (!t.date) return false;
      const transactionDate = new Date(t.date);
      if (transactionDate < comparisonDateRange.start || transactionDate > comparisonDateRange.end) return false;

      // Marketplace filter
      if (marketplace !== 'all' && t.marketplaceCode !== marketplace) return false;

      return true;
    });

    // Group by date or month
    const grouped: Record<string, { date: string; sales: number; quantity: number; orders: number }> = {};

    filtered.forEach(t => {
      if (!t.date) return;
      const date = new Date(t.date);

      const dateKey = groupByMonth
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : date.toISOString().split('T')[0];

      if (!grouped[dateKey]) {
        grouped[dateKey] = { date: dateKey, sales: 0, quantity: 0, orders: 0 };
      }

      grouped[dateKey].sales += t.productSales || 0;
      grouped[dateKey].quantity += t.quantity || 0;
      grouped[dateKey].orders += 1;
    });

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [transactionData, productData, viewType, comparisonDateRange, groupByMonth, marketplace]);

  // Merge current and comparison data for chart display
  const mergedChartData = useMemo(() => {
    if (!showComparison || comparisonSalesTrendData.length === 0) {
      return salesTrendData;
    }

    // Normalize comparison dates to match current period dates
    // For example: 2024-01 becomes 2025-01 for proper overlay
    const normalizedComparison = comparisonSalesTrendData.map(item => {
      if (!dateRange.start || !dateRange.end || !comparisonDateRange) return item;

      const currentStart = new Date(dateRange.start);
      const compStart = comparisonDateRange.start;

      if (groupByMonth) {
        // For monthly data: shift year/month
        const [compYear, compMonth] = item.date.split('-').map(Number);
        const currentYear = currentStart.getFullYear();
        const currentMonth = currentStart.getMonth() + 1;

        // Calculate month offset
        const compDate = new Date(compYear, compMonth - 1);
        const monthOffset = (compDate.getFullYear() - compStart.getFullYear()) * 12 +
                           (compDate.getMonth() - compStart.getMonth());

        // Apply offset to current start
        const normalizedDate = new Date(currentYear, currentMonth - 1 + monthOffset);
        const normalizedKey = `${normalizedDate.getFullYear()}-${String(normalizedDate.getMonth() + 1).padStart(2, '0')}`;

        return { ...item, date: normalizedKey };
      } else {
        // For daily data: shift by day offset
        const compDate = new Date(item.date);
        const dayOffset = Math.floor((compDate.getTime() - compStart.getTime()) / (1000 * 60 * 60 * 24));

        const normalizedDate = new Date(currentStart);
        normalizedDate.setDate(normalizedDate.getDate() + dayOffset);
        const normalizedKey = normalizedDate.toISOString().split('T')[0];

        return { ...item, date: normalizedKey };
      }
    });

    // Create a map for quick lookup
    const dataMap = new Map<string, any>();

    // Add current period data
    salesTrendData.forEach(item => {
      dataMap.set(item.date, {
        date: item.date,
        sales: item.sales,
        quantity: item.quantity,
        orders: item.orders
      });
    });

    // Add normalized comparison period data with 'Prev' suffix
    normalizedComparison.forEach(item => {
      const existing = dataMap.get(item.date) || { date: item.date };
      dataMap.set(item.date, {
        ...existing,
        prevSales: item.sales,
        prevQuantity: item.quantity,
        prevOrders: item.orders
      });
    });

    return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [salesTrendData, comparisonSalesTrendData, showComparison, dateRange, comparisonDateRange, groupByMonth]);

  // Early return after all hooks
  if (!isOpen || !productData) return null;

  // Calculate summary metrics
  const totalQuantity = productData.variants?.reduce((sum: number, v: any) => sum + v.quantity, 0) || 0;
  const avgPrice = totalQuantity > 0 ? productData.totalSales / totalQuantity : 0;

  // Calculate FBA/FBM sales from variants if not available in productData
  const calculatedFbaSales = productData.variants?.reduce((sum: number, v: any) =>
    v.fulfillment === 'FBA' ? sum + (v.sales || 0) : sum, 0) || 0;
  const calculatedFbmSales = productData.variants?.reduce((sum: number, v: any) =>
    v.fulfillment !== 'FBA' ? sum + (v.sales || 0) : sum, 0) || 0;

  // Use calculated values if productData values are undefined
  const actualFbaSales = productData.fbaSales ?? calculatedFbaSales;
  const actualFbmSales = productData.fbmSales ?? calculatedFbmSales;

  // Calculate proportional global costs for this product
  const productSalesRatio = salesByFulfillment.totalSales > 0
    ? productData.totalSales / salesByFulfillment.totalSales
    : 0;

  const productFbaSalesRatio = salesByFulfillment.fbaSales > 0
    ? actualFbaSales / salesByFulfillment.fbaSales
    : 0;

  const productFbmSalesRatio = salesByFulfillment.fbmSales > 0
    ? actualFbmSales / salesByFulfillment.fbmSales
    : 0;

  // Proportional costs
  const proportionalAdvertising = globalCosts.advertising * productSalesRatio;
  const proportionalFbaCost = globalCosts.fba * productFbaSalesRatio;
  const proportionalFbmCost = globalCosts.fbm * productFbmSalesRatio;

  // Net Profit = Total Sales - Selling Fees - FBA Fees - Refund Loss - Proportional Advertising - Proportional FBA Cost - Proportional FBM Cost
  const netProfit = productData.totalSales
    - (productData.sellingFees || 0)
    - (productData.fbaFees || 0)
    - (productData.totalRefundLoss || 0)
    - proportionalAdvertising
    - proportionalFbaCost
    - proportionalFbmCost;

  const profitMargin = productData.totalSales > 0 ? (netProfit / productData.totalSales) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-800">{productData.name}</h2>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {viewType === 'name' && productData.asin && (
                <span className="text-sm text-slate-600">
                  ASIN: <span className="font-mono font-semibold">{productData.asin}</span>
                </span>
              )}
              {productData.parent && (
                <span className="text-sm text-slate-600">
                  Parent: <span className="font-mono font-semibold">{productData.parent}</span>
                </span>
              )}
              {productData.category && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md text-sm font-medium">
                  <Tag className="w-3 h-3" />
                  {productData.category}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="text-sm font-semibold text-green-800">Total Sales</span>
              </div>
              <p className="text-2xl font-bold text-green-900">{formatMoney(productData.totalSales, marketplace)}</p>
              <p className="text-xs text-green-700 mt-1">{productData.totalOrders} orders</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-blue-800">Quantity Sold</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">{totalQuantity}</p>
              <p className="text-xs text-blue-700 mt-1">Avg: {formatMoney(avgPrice, marketplace)}</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-4 border border-purple-100">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-semibold text-purple-800">Net Profit</span>
              </div>
              <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-purple-900' : 'text-red-900'}`}>
                {formatMoney(netProfit, marketplace)}
              </p>
              <p className="text-xs text-purple-700 mt-1">
                {formatPercent(profitMargin)} margin
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">Total Fees</span>
              </div>
              <p className="text-2xl font-bold text-amber-900">
                {formatMoney((productData.sellingFees || 0) + (productData.fbaFees || 0), marketplace)}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                + {formatMoney(productData.totalRefundLoss || 0, marketplace)} refund loss
              </p>
            </div>
          </div>

          {/* Sales Trend Chart */}
          {salesTrendData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  Sales Trend
                  <span className="text-sm font-normal text-slate-500 ml-2">
                    ({dateRange.start && dateRange.end ?
                      `${new Date(dateRange.start).toLocaleDateString('tr-TR')} - ${new Date(dateRange.end).toLocaleDateString('tr-TR')}` :
                      'All time'})
                    {groupByMonth ? ' · Grouped by month' : ' · Grouped by day'}
                  </span>
                </h3>
                {comparisonMode !== 'none' && comparisonSalesTrendData.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showComparison}
                      onChange={(e) => setShowComparison(e.target.checked)}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-slate-600">
                      {comparisonMode === 'previous-period' ? 'Previous Period' : 'Previous Year'}
                    </span>
                  </label>
                )}
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={mergedChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                    tickFormatter={(date: string) => {
                      if (groupByMonth) {
                        // Format as "Oca 2024" for monthly data (YYYY-MM format)
                        const [year, month] = date.split('-');
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        return `${monthNames[parseInt(month) - 1]} ${year}`;
                      } else {
                        // Format as "15/1" for daily data (YYYY-MM-DD format)
                        const d = new Date(date);
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }
                    }}
                  />
                  <YAxis
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length || !label) return null;

                      const data = payload[0].payload;
                      const labelStr = String(label);
                      const formattedDate = groupByMonth
                        ? (() => {
                            const [year, month] = labelStr.split('-');
                            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                              'July', 'August', 'September', 'October', 'November', 'December'];
                            return `${monthNames[parseInt(month) - 1]} ${year}`;
                          })()
                        : new Date(labelStr).toLocaleDateString('en-US');

                      return (
                        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
                          <p className="text-sm font-semibold text-slate-700 mb-2">{formattedDate}</p>
                          <div className="space-y-1">
                            {data.sales !== undefined && (
                              <p className="text-sm">
                                <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
                                <span className="text-slate-600">Sales:</span>{' '}
                                <span className="font-semibold text-slate-800">{formatMoney(data.sales, marketplace)}</span>
                              </p>
                            )}
                            {data.quantity !== undefined && (
                              <p className="text-sm text-slate-600">
                                <span className="ml-5">Qty: {data.quantity}</span>
                              </p>
                            )}
                            {data.prevSales !== undefined && (
                              <>
                                <div className="border-t border-slate-200 my-2"></div>
                                <p className="text-sm">
                                  <span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-2"></span>
                                  <span className="text-slate-600">Sales (Previous):</span>{' '}
                                  <span className="font-semibold text-slate-800">{formatMoney(data.prevSales, marketplace)}</span>
                                </p>
                                {data.prevQuantity !== undefined && (
                                  <p className="text-sm text-slate-600">
                                    <span className="ml-5">Qty: {data.prevQuantity}</span>
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {/* Current Period Line - Sales Only */}
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="sales"
                  />
                  {/* Comparison Period Line - Sales Only (dashed, orange) */}
                  {showComparison && comparisonSalesTrendData.length > 0 && (
                    <Line
                      type="monotone"
                      dataKey="prevSales"
                      stroke="#f97316"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: '#f97316', r: 4 }}
                      activeDot={{ r: 6 }}
                      name="prevSales"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Fee Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Fee Breakdown</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Selling Fees</span>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-800">{formatMoney(productData.sellingFees || 0, marketplace)}</div>
                  <div className="text-xs text-slate-500">
                    {formatPercent(productData.totalSales > 0 ? ((productData.sellingFees || 0) / productData.totalSales) * 100 : 0)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">FBA Fees</span>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-800">{formatMoney(productData.fbaFees || 0, marketplace)}</div>
                  <div className="text-xs text-slate-500">
                    {formatPercent(productData.fbaSales > 0 ? ((productData.fbaFees || 0) / productData.fbaSales) * 100 : 0)}
                  </div>
                </div>
              </div>

              <div className="py-2 border-b border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-red-600">Refund Loss *</span>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-red-700">{formatMoney(productData.totalRefundLoss || 0, marketplace)}</div>
                    <div className="text-xs text-red-500">
                      {formatPercent(productData.totalSales > 0 ? ((productData.totalRefundLoss || 0) / productData.totalSales) * 100 : 0)}
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 italic leading-tight">
                  * A designated proportion of returned items has been classified as loss (50% for the US, 70% for all other regions)
                </p>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Advertising Cost (Proportional)</span>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-800">{formatMoney(proportionalAdvertising, marketplace)}</div>
                  <div className="text-xs text-slate-500">
                    {formatPercent(productData.totalSales > 0 ? (proportionalAdvertising / productData.totalSales) * 100 : 0)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">FBA Cost (Proportional)</span>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-800">{formatMoney(proportionalFbaCost, marketplace)}</div>
                  <div className="text-xs text-slate-500">
                    {formatPercent(actualFbaSales > 0 ? (proportionalFbaCost / actualFbaSales) * 100 : 0)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-600">FBM Cost (Proportional)</span>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-800">{formatMoney(proportionalFbmCost, marketplace)}</div>
                  <div className="text-xs text-slate-500">
                    {formatPercent(actualFbmSales > 0 ? (proportionalFbmCost / actualFbmSales) * 100 : 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Variants Table */}
          {productData.variants && productData.variants.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                Variants ({productData.variants.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 text-sm font-semibold text-slate-700">SKU</th>
                      <th className="text-left py-2 px-3 text-sm font-semibold text-slate-700">Fulfillment</th>
                      <th className="text-right py-2 px-3 text-sm font-semibold text-slate-700">Quantity</th>
                      <th className="text-right py-2 px-3 text-sm font-semibold text-slate-700">Orders</th>
                      <th className="text-right py-2 px-3 text-sm font-semibold text-slate-700">Refunds</th>
                      <th className="text-right py-2 px-3 text-sm font-semibold text-slate-700">Sales</th>
                      <th className="text-right py-2 px-3 text-sm font-semibold text-slate-700">Avg Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productData.variants.map((variant: any, idx: number) => {
                      const avgVariantPrice = variant.quantity > 0 ? variant.sales / variant.quantity : 0;
                      return (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-3 text-sm text-slate-800 font-mono">
                            {variant.sku}
                          </td>
                          <td className="py-2 px-3 text-sm">
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                              variant.fulfillment === 'FBA'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {variant.fulfillment}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-sm text-slate-800 text-right font-semibold">
                            {variant.quantity}
                          </td>
                          <td className="py-2 px-3 text-sm text-slate-600 text-right">
                            {variant.orders}
                          </td>
                          <td className="py-2 px-3 text-sm text-red-600 text-right">
                            {variant.refunds || 0}
                          </td>
                          <td className="py-2 px-3 text-sm text-green-700 text-right font-semibold">
                            {formatMoney(variant.sales, marketplace)}
                          </td>
                          <td className="py-2 px-3 text-sm text-slate-600 text-right">
                            {formatMoney(avgVariantPrice, marketplace)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ProductDetailModal);
