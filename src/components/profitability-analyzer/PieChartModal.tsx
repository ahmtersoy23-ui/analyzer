import React, { useState, useMemo } from 'react';
import { X, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import PieChartDisplay from './PieChartDisplay';
import { formatPercent } from '../../utils/formatters';
import { useProfitabilityFilters } from '../../contexts/ProfitabilityFilterContext';
import {
  SKUProfitAnalysis,
  ProductProfitAnalysis,
  ParentProfitAnalysis,
  CategoryProfitAnalysis,
} from '../../services/profitability/profitabilityAnalytics';
import type { TransactionData } from '../../types/transaction';

export type SelectedItemType =
  | { type: 'sku'; data: SKUProfitAnalysis }
  | { type: 'product'; data: ProductProfitAnalysis }
  | { type: 'parent'; data: ParentProfitAnalysis }
  | { type: 'category'; data: CategoryProfitAnalysis }
  | null;

interface PieChartModalProps {
  selectedItem: SelectedItemType;
  onClose: () => void;
  formatMoney: (value: number) => string;
  transactionData?: TransactionData[];
  marketplace?: string;
  selectedMarketplaces?: Set<string>;
}

type TabType = 'breakdown' | 'trend';

const PieChartModal: React.FC<PieChartModalProps> = ({
  selectedItem,
  onClose,
  formatMoney,
  transactionData = [],
  marketplace = 'all',
  selectedMarketplaces = new Set(),
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('breakdown');

  // Get filter state from context
  const {
    showPerUnit,
    setShowPerUnit,
    startDate,
    endDate,
  } = useProfitabilityFilters();

  // Get item identifier based on type - reusable function
  const matchesItem = (t: TransactionData) => {
    if (!selectedItem) return false;
    if (selectedItem.type === 'sku') {
      // SKU must exist and match
      return t.sku && selectedItem.data.sku && t.sku === selectedItem.data.sku;
    } else if (selectedItem.type === 'product') {
      // Product name must exist and match (prevent undefined === undefined)
      return t.name && selectedItem.data.name && t.name === selectedItem.data.name;
    } else if (selectedItem.type === 'parent') {
      // Parent must exist and match
      return t.parent && selectedItem.data.parent && t.parent === selectedItem.data.parent;
    } else if (selectedItem.type === 'category') {
      // Category must exist and match
      return t.productCategory && selectedItem.data.category && t.productCategory === selectedItem.data.category;
    }
    return false;
  };

  // Calculate trend data for this item
  const trendData = useMemo(() => {
    if (!selectedItem || transactionData.length === 0) return [];

    // Filter transactions for this item and date range
    const filtered = transactionData.filter(t => {
      if (t.categoryType !== 'Order') return false;
      if (!matchesItem(t)) return false;

      // Apply date filter
      if (startDate && t.dateOnly && t.dateOnly < startDate) return false;
      if (endDate && t.dateOnly && t.dateOnly > endDate) return false;

      // Apply marketplace filter (support both single and multi-select)
      if (selectedMarketplaces.size > 0) {
        // Multi-select mode: filter by selected marketplaces
        if (!t.marketplaceCode || !selectedMarketplaces.has(t.marketplaceCode)) return false;
      } else if (marketplace !== 'all' && t.marketplaceCode !== marketplace) {
        // Single select mode
        return false;
      }

      return true;
    });

    // Determine grouping - monthly if > 90 days, otherwise daily
    const dateRangeDays = startDate && endDate
      ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
      : 365;
    const groupByMonth = dateRangeDays > 90;

    // Group by date
    const grouped: Record<string, { date: string; sales: number; quantity: number; profit: number }> = {};

    filtered.forEach(t => {
      if (!t.dateOnly) return;

      const dateKey = groupByMonth
        ? t.dateOnly.substring(0, 7) // YYYY-MM
        : t.dateOnly; // YYYY-MM-DD

      if (!grouped[dateKey]) {
        grouped[dateKey] = { date: dateKey, sales: 0, quantity: 0, profit: 0 };
      }

      grouped[dateKey].sales += t.productSales || 0;
      grouped[dateKey].quantity += t.quantity || 0;
      // Approximate profit from transaction data
      grouped[dateKey].profit += (t.productSales || 0) + (t.sellingFees || 0) + (t.fbaFees || 0);
    });

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedItem, transactionData, startDate, endDate, marketplace]);


  if (!selectedItem) return null;

  // Calculate per-unit values if showPerUnit is true
  const qty = selectedItem.data.totalQuantity || 1;
  const isPerUnit = showPerUnit && (selectedItem.type === 'sku' || selectedItem.type === 'product') && qty > 0;
  const divisor = isPerUnit ? qty : 1;

  // Helper to get value (per unit or total)
  const v = (total: number) => total / divisor;

  // Pre-calculate all display values
  const displayData = {
    revenue: v(selectedItem.data.totalRevenue),
    netProfit: v(selectedItem.data.netProfit),
    sellingFees: v(selectedItem.data.sellingFees),
    fbaFees: v(selectedItem.data.fbaFees),
    refundLoss: v(selectedItem.data.refundLoss),
    vat: v(selectedItem.data.vat),
    advertisingCost: v(selectedItem.data.advertisingCost),
    fbaCost: v(selectedItem.data.fbaCost),
    fbmCost: v(selectedItem.data.fbmCost),
    totalProductCost: v(selectedItem.data.totalProductCost),
    shippingCost: v(selectedItem.data.shippingCost),
    customsDuty: v(selectedItem.data.customsDuty),
    ddpFee: v(selectedItem.data.ddpFee),
    warehouseCost: v(selectedItem.data.warehouseCost),
    gstCost: v(selectedItem.data.gstCost),
  };

  // Amazon & Non-Amazon totals for pie charts
  const amazonExpensesTotal = displayData.sellingFees + displayData.fbaFees + displayData.refundLoss + displayData.vat + displayData.advertisingCost + displayData.fbaCost + displayData.fbmCost;
  const nonAmazonCostsTotal = displayData.totalProductCost + displayData.shippingCost + displayData.customsDuty + displayData.ddpFee + displayData.warehouseCost + displayData.gstCost;
  const amazonExpensesPercent = displayData.revenue > 0 ? (amazonExpensesTotal / displayData.revenue) * 100 : 0;
  const nonAmazonCostsPercent = displayData.revenue > 0 ? (nonAmazonCostsTotal / displayData.revenue) * 100 : 0;

  const getTitle = () => {
    switch (selectedItem.type) {
      case 'sku': return selectedItem.data.sku;
      case 'product': return selectedItem.data.name;
      case 'parent': return selectedItem.data.parent;
      case 'category': return selectedItem.data.category;
    }
  };

  // Determine if we should group by month
  const dateRangeDays = startDate && endDate
    ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 365;
  const groupByMonth = dateRangeDays > 90;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200">
          {/* Top row: Title + Toggle + Close */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                <h3 className="text-lg font-bold text-slate-800 line-clamp-2 text-left" title={getTitle()}>
                  {getTitle()}
                </h3>
                {/* Total / Per Unit Toggle */}
                {(selectedItem.type === 'sku' || selectedItem.type === 'product') && (
                  <div className="inline-flex items-center rounded-full bg-slate-100 p-0.5 text-xs flex-shrink-0 mt-0.5">
                    <button
                      onClick={() => setShowPerUnit(false)}
                      className={`px-2.5 py-1 rounded-full font-medium transition-all ${
                        !showPerUnit
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Total
                    </button>
                    <button
                      onClick={() => setShowPerUnit(true)}
                      className={`px-2.5 py-1 rounded-full font-medium transition-all ${
                        showPerUnit
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Per Unit
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          {/* Second row: Parent context + Active filters */}
          <div className="flex items-start justify-between mt-1.5 text-xs text-slate-500">
            {/* Parent context info */}
            <div className="line-clamp-2 flex-1 min-w-0 pr-2 text-left">
              {selectedItem.type === 'sku' && (
                <span title={selectedItem.data.name}>
                  <span className="text-slate-400">Product:</span> {selectedItem.data.name}
                </span>
              )}
              {selectedItem.type === 'product' && (
                <span>
                  <span className="text-slate-400">Parent:</span> {selectedItem.data.parent || '-'}
                </span>
              )}
              {selectedItem.type === 'parent' && (
                <span>
                  <span className="text-slate-400">Category:</span> {selectedItem.data.category || '-'}
                </span>
              )}
            </div>
            {/* Item's actual fulfillment + date filters */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Show item's actual fulfillment type (not global filter) */}
              {selectedItem.data.fulfillment && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  selectedItem.data.fulfillment === 'FBA'
                    ? 'bg-blue-100 text-blue-700'
                    : selectedItem.data.fulfillment === 'FBM'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {selectedItem.data.fulfillment}
                </span>
              )}
              {(startDate || endDate) && (
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] whitespace-nowrap">
                  {startDate ? new Date(startDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' }) : '..'}
                  {' - '}
                  {endDate ? new Date(endDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' }) : '..'}
                </span>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('breakdown')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'breakdown'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <PieChartIcon className="w-4 h-4" />
              Breakdown
            </button>
            <button
              onClick={() => setActiveTab('trend')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'trend'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Trend
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-4">
          {/* Summary Stats - Always visible */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-slate-800">{formatMoney(displayData.revenue)}</div>
              <div className="text-[10px] text-slate-500">{isPerUnit ? 'Revenue/Unit' : 'Revenue'}</div>
            </div>
            <div className={`rounded-lg p-2 text-center ${displayData.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className={`text-lg font-bold ${displayData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(displayData.netProfit)}
              </div>
              <div className="text-[10px] text-slate-500">{isPerUnit ? 'Profit/Unit' : 'Net Profit'}</div>
            </div>
            <div className={`rounded-lg p-2 text-center ${selectedItem.data.profitMargin >= 10 ? 'bg-green-50' : selectedItem.data.profitMargin >= 0 ? 'bg-yellow-50' : 'bg-red-50'}`}>
              <div className={`text-lg font-bold ${selectedItem.data.profitMargin >= 10 ? 'text-green-600' : selectedItem.data.profitMargin >= 0 ? 'text-yellow-700' : 'text-red-600'}`}>
                {formatPercent(selectedItem.data.profitMargin)}
              </div>
              <div className="text-[10px] text-slate-500">Margin</div>
            </div>
          </div>

          {/* Breakdown Tab Content */}
          {activeTab === 'breakdown' && (
            <>
              {/* Chart + Table */}
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <div className="flex gap-4 items-center">
                  {/* Pie Chart */}
                  <div className="flex-shrink-0 flex items-center">
                    <PieChartDisplay
                      data={[
                        { label: 'Net Profit', value: Math.max(0, displayData.netProfit), color: '#22c55e' },
                        { label: 'Selling Fee', value: displayData.sellingFees, color: '#ef4444' },
                        { label: 'FBA Fee', value: displayData.fbaFees, color: '#f97316' },
                        { label: 'Refund', value: displayData.refundLoss, color: '#eab308' },
                        ...(displayData.vat > 0 ? [{ label: 'VAT', value: displayData.vat, color: '#dc2626' }] : []),
                        { label: 'Ads', value: displayData.advertisingCost, color: '#ec4899' },
                        { label: 'FBA Cost', value: displayData.fbaCost, color: '#8b5cf6' },
                        { label: 'FBM Cost', value: displayData.fbmCost, color: '#06b6d4' },
                        { label: 'Product Cost', value: displayData.totalProductCost, color: '#3b82f6' },
                        { label: 'Shipping', value: displayData.shippingCost, color: '#14b8a6' },
                        ...(displayData.customsDuty > 0 ? [{ label: 'Customs', value: displayData.customsDuty, color: '#f59e0b' }] : []),
                        ...(displayData.ddpFee > 0 ? [{ label: 'DDP', value: displayData.ddpFee, color: '#fbbf24' }] : []),
                        ...(displayData.warehouseCost > 0 ? [{ label: 'Warehouse', value: displayData.warehouseCost, color: '#d97706' }] : []),
                        ...(displayData.gstCost > 0 ? [{ label: 'GST', value: displayData.gstCost, color: '#fb923c' }] : []),
                        { label: 'Loss', value: Math.max(0, -displayData.netProfit), color: '#b91c1c' },
                      ]}
                      formatMoney={formatMoney}
                      showAsPercentOfRevenue
                      totalRevenue={displayData.revenue}
                      large
                      hideLegend
                    />
                  </div>

                  {/* Breakdown Table */}
                  <div className="flex-1 bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="text-left px-2 py-1.5 font-medium text-slate-600">Item</th>
                          <th className="text-right px-2 py-1.5 font-medium text-slate-600">{isPerUnit ? '/Unit' : 'Amount'}</th>
                          <th className="text-right px-2 py-1.5 font-medium text-slate-600">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="px-2 py-1 flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#ef4444' }} />
                            <span className="text-slate-700">Selling Fee</span>
                          </td>
                          <td className="px-2 py-1 text-right">{formatMoney(displayData.sellingFees)}</td>
                          <td className="px-2 py-1 text-right text-slate-500">{formatPercent(selectedItem.data.sellingFeePercent)}</td>
                        </tr>
                        <tr>
                          <td className="px-2 py-1 flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#f97316' }} />
                            <span className="text-slate-700">FBA Fee</span>
                          </td>
                          <td className="px-2 py-1 text-right">{formatMoney(displayData.fbaFees)}</td>
                          <td className="px-2 py-1 text-right text-slate-500">{formatPercent(selectedItem.data.fbaFeePercent)}</td>
                        </tr>
                        <tr>
                          <td className="px-2 py-1 flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#eab308' }} />
                            <span className="text-slate-700">Refund</span>
                          </td>
                          <td className="px-2 py-1 text-right">{formatMoney(displayData.refundLoss)}</td>
                          <td className="px-2 py-1 text-right text-slate-500">{formatPercent(selectedItem.data.refundLossPercent)}</td>
                        </tr>
                        {displayData.vat > 0 && (
                          <tr>
                            <td className="px-2 py-1 flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#dc2626' }} />
                              <span className="text-slate-700">VAT</span>
                            </td>
                            <td className="px-2 py-1 text-right">{formatMoney(displayData.vat)}</td>
                            <td className="px-2 py-1 text-right text-slate-500">{formatPercent(selectedItem.data.vatPercent)}</td>
                          </tr>
                        )}
                        <tr>
                          <td className="px-2 py-1 flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#ec4899' }} />
                            <span className="text-slate-700">Ads</span>
                          </td>
                          <td className="px-2 py-1 text-right">{formatMoney(displayData.advertisingCost)}</td>
                          <td className="px-2 py-1 text-right text-slate-500">{formatPercent(selectedItem.data.advertisingPercent)}</td>
                        </tr>
                        <tr>
                          <td className="px-2 py-1 flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#8b5cf6' }} />
                            <span className="text-slate-700">FBA Cost</span>
                          </td>
                          <td className="px-2 py-1 text-right">{formatMoney(displayData.fbaCost)}</td>
                          <td className="px-2 py-1 text-right text-slate-500">{formatPercent(selectedItem.data.fbaCostPercent)}</td>
                        </tr>
                        <tr>
                          <td className="px-2 py-1 flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#06b6d4' }} />
                            <span className="text-slate-700">FBM Cost</span>
                          </td>
                          <td className="px-2 py-1 text-right">{formatMoney(displayData.fbmCost)}</td>
                          <td className="px-2 py-1 text-right text-slate-500">{formatPercent(selectedItem.data.fbmCostPercent)}</td>
                        </tr>
                        <tr className="border-t border-slate-200">
                          <td className="px-2 py-1 flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#3b82f6' }} />
                            <span className="text-slate-700">Product Cost</span>
                          </td>
                          <td className="px-2 py-1 text-right">{formatMoney(displayData.totalProductCost)}</td>
                          <td className="px-2 py-1 text-right text-slate-500">{formatPercent(selectedItem.data.productCostPercent)}</td>
                        </tr>
                        <tr>
                          <td className="px-2 py-1 flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#14b8a6' }} />
                            <span className="text-slate-700">Shipping</span>
                          </td>
                          <td className="px-2 py-1 text-right">{formatMoney(displayData.shippingCost)}</td>
                          <td className="px-2 py-1 text-right text-slate-500">{formatPercent(selectedItem.data.shippingCostPercent)}</td>
                        </tr>
                        {displayData.customsDuty > 0 && (
                          <tr>
                            <td className="px-2 py-1 flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#f59e0b' }} />
                              <span className="text-slate-700">Customs</span>
                            </td>
                            <td className="px-2 py-1 text-right">{formatMoney(displayData.customsDuty)}</td>
                            <td className="px-2 py-1 text-right text-slate-500">{displayData.revenue > 0 ? formatPercent((displayData.customsDuty / displayData.revenue) * 100) : '-'}</td>
                          </tr>
                        )}
                        {displayData.ddpFee > 0 && (
                          <tr>
                            <td className="px-2 py-1 flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#fbbf24' }} />
                              <span className="text-slate-700">DDP</span>
                            </td>
                            <td className="px-2 py-1 text-right">{formatMoney(displayData.ddpFee)}</td>
                            <td className="px-2 py-1 text-right text-slate-500">{displayData.revenue > 0 ? formatPercent((displayData.ddpFee / displayData.revenue) * 100) : '-'}</td>
                          </tr>
                        )}
                        {displayData.warehouseCost > 0 && (
                          <tr>
                            <td className="px-2 py-1 flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#d97706' }} />
                              <span className="text-slate-700">Warehouse</span>
                            </td>
                            <td className="px-2 py-1 text-right">{formatMoney(displayData.warehouseCost)}</td>
                            <td className="px-2 py-1 text-right text-slate-500">{displayData.revenue > 0 ? formatPercent((displayData.warehouseCost / displayData.revenue) * 100) : '-'}</td>
                          </tr>
                        )}
                        {displayData.gstCost > 0 && (
                          <tr>
                            <td className="px-2 py-1 flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#fb923c' }} />
                              <span className="text-slate-700">GST</span>
                            </td>
                            <td className="px-2 py-1 text-right">{formatMoney(displayData.gstCost)}</td>
                            <td className="px-2 py-1 text-right text-slate-500">{formatPercent(selectedItem.data.gstCostPercent)}</td>
                          </tr>
                        )}
                        <tr className={`border-t border-slate-200 ${displayData.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                          <td className="px-2 py-1 flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: displayData.netProfit >= 0 ? '#22c55e' : '#dc2626' }} />
                            <span className={`font-semibold ${displayData.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>Net Profit</span>
                          </td>
                          <td className={`px-2 py-1 text-right font-semibold ${displayData.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatMoney(displayData.netProfit)}</td>
                          <td className={`px-2 py-1 text-right font-semibold ${displayData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(selectedItem.data.profitMargin)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Two Column Layout for Amazon/Non-Amazon Pie Charts */}
              <div className="grid grid-cols-2 gap-3">
                {/* Amazon Expenses Pie Chart */}
                <div className="bg-orange-50/50 rounded-lg p-3">
                  <h4 className="font-medium text-orange-800 mb-2 text-center text-xs">
                    Amazon Expenses <span className="text-orange-600">({amazonExpensesPercent.toFixed(1)}%)</span>
                  </h4>
                  <PieChartDisplay
                    data={[
                      { label: 'Selling Fee', value: displayData.sellingFees, color: '#f87171' },
                      { label: 'FBA Fee', value: displayData.fbaFees, color: '#fb923c' },
                      { label: 'Refund', value: displayData.refundLoss, color: '#fbbf24' },
                      ...(displayData.vat > 0 ? [{ label: 'VAT', value: displayData.vat, color: '#ef4444' }] : []),
                      { label: 'Ads', value: displayData.advertisingCost, color: '#f472b6' },
                      { label: 'FBA Cost', value: displayData.fbaCost, color: '#a78bfa' },
                      { label: 'FBM Cost', value: displayData.fbmCost, color: '#67e8f9' },
                    ]}
                    formatMoney={formatMoney}
                  />
                </div>

                {/* Non-Amazon Costs Pie Chart */}
                <div className="bg-blue-50/50 rounded-lg p-3">
                  <h4 className="font-medium text-blue-800 mb-2 text-center text-xs">
                    Non-Amazon Costs <span className="text-blue-600">({nonAmazonCostsPercent.toFixed(1)}%)</span>
                  </h4>
                  <PieChartDisplay
                    data={[
                      { label: 'Product Cost', value: displayData.totalProductCost, color: '#60a5fa' },
                      { label: 'Shipping', value: displayData.shippingCost, color: '#5eead4' },
                      ...(displayData.customsDuty > 0 ? [{ label: 'Customs', value: displayData.customsDuty, color: '#f59e0b' }] : []),
                      ...(displayData.ddpFee > 0 ? [{ label: 'DDP', value: displayData.ddpFee, color: '#fbbf24' }] : []),
                      ...(displayData.warehouseCost > 0 ? [{ label: 'Warehouse', value: displayData.warehouseCost, color: '#d97706' }] : []),
                      ...(displayData.gstCost > 0 ? [{ label: 'GST', value: displayData.gstCost, color: '#fb923c' }] : []),
                    ]}
                    formatMoney={formatMoney}
                  />
                </div>
              </div>
            </>
          )}

          {/* Trend Tab Content */}
          {activeTab === 'trend' && (
            <div className="space-y-4">
              {/* Trend Chart */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">
                  Sales Trend
                  <span className="text-xs font-normal text-slate-500 ml-2">
                    {groupByMonth ? '(Monthly)' : '(Daily)'}
                  </span>
                </h4>

                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        style={{ fontSize: '11px' }}
                        tickFormatter={(date: string) => {
                          if (groupByMonth) {
                            const [year, month] = date.split('-');
                            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            return `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`;
                          } else {
                            const d = new Date(date);
                            return `${d.getMonth() + 1}/${d.getDate()}`;
                          }
                        }}
                      />
                      <YAxis
                        stroke="#64748b"
                        style={{ fontSize: '11px' }}
                        tickFormatter={(value: number) => formatMoney(value)}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          const formattedDate = groupByMonth
                            ? (() => {
                                const [year, month] = String(label).split('-');
                                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                                  'July', 'August', 'September', 'October', 'November', 'December'];
                                return `${monthNames[parseInt(month) - 1]} ${year}`;
                              })()
                            : new Date(String(label)).toLocaleDateString('en-US');

                          return (
                            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
                              <p className="text-sm font-semibold text-slate-700 mb-2">{formattedDate}</p>
                              <p className="text-sm">
                                <span className="text-blue-600">Sales:</span>{' '}
                                <span className="font-semibold text-slate-800">{formatMoney(data.sales)}</span>
                                <span className="text-slate-500 ml-1">({data.quantity} qty)</span>
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="sales"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', r: 3 }}
                        activeDot={{ r: 5 }}
                        name="sales"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-slate-500">
                    <p className="text-sm">No trend data found for this item</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(PieChartModal);
