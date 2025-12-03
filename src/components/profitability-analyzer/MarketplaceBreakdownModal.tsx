/**
 * MarketplaceBreakdownModal - Shows marketplace breakdown for a category/item
 * Opens as a popup when clicking on category cards in All Marketplaces mode
 */

import React, { useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { SKUProfitAnalysis } from '../../services/profitability/profitabilityAnalytics';

// Marketplace breakdown data structure
export interface MarketplaceBreakdown {
  marketplace: string;
  revenue: number;
  netProfit: number;
  profitMargin: number;
  orders: number;
  quantity: number;
  avgPrice: number;
  productCost: number;
  shippingCost: number;
  customsDuty: number;
  sellingFees: number;
  fbaFees: number;
}

interface MarketplaceBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  skuData: SKUProfitAnalysis[];
  formatMoney: (amount: number) => string;
  formatPercent: (value: number) => string;
}

// Country flags mapping
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

// Calculate marketplace breakdown from SKU data
const calculateMarketplaceBreakdown = (skuData: SKUProfitAnalysis[]): MarketplaceBreakdown[] => {
  // Group SKUs by marketplace and aggregate
  const marketplaceMap = new Map<string, {
    revenue: number;
    netProfit: number;
    orders: number;
    quantity: number;
    productCost: number;
    shippingCost: number;
    customsDuty: number;
    sellingFees: number;
    fbaFees: number;
  }>();

  skuData.forEach(sku => {
    const mp = sku.marketplace || 'Unknown';
    const existing = marketplaceMap.get(mp);

    if (existing) {
      existing.revenue += sku.totalRevenue;
      existing.netProfit += sku.netProfit;
      existing.orders += sku.totalOrders;
      existing.quantity += sku.totalQuantity;
      existing.productCost += sku.totalProductCost;
      existing.shippingCost += sku.shippingCost;
      existing.customsDuty += sku.customsDuty;
      existing.sellingFees += sku.sellingFees;
      existing.fbaFees += sku.fbaFees;
    } else {
      marketplaceMap.set(mp, {
        revenue: sku.totalRevenue,
        netProfit: sku.netProfit,
        orders: sku.totalOrders,
        quantity: sku.totalQuantity,
        productCost: sku.totalProductCost,
        shippingCost: sku.shippingCost,
        customsDuty: sku.customsDuty,
        sellingFees: sku.sellingFees,
        fbaFees: sku.fbaFees,
      });
    }
  });

  // Convert to breakdown array
  const breakdown: MarketplaceBreakdown[] = [];

  marketplaceMap.forEach((data, marketplace) => {
    if (data.revenue > 0) {
      breakdown.push({
        marketplace,
        revenue: data.revenue,
        netProfit: data.netProfit,
        profitMargin: (data.netProfit / data.revenue) * 100,
        orders: data.orders,
        quantity: data.quantity,
        avgPrice: data.quantity > 0 ? data.revenue / data.quantity : 0,
        productCost: data.productCost,
        shippingCost: data.shippingCost,
        customsDuty: data.customsDuty,
        sellingFees: data.sellingFees,
        fbaFees: data.fbaFees,
      });
    }
  });

  return breakdown.sort((a, b) => b.revenue - a.revenue);
};

export const MarketplaceBreakdownModal: React.FC<MarketplaceBreakdownModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  skuData,
  formatMoney,
  formatPercent,
}) => {
  // Calculate breakdown - must be before early return for React hooks rules
  const breakdown = useMemo(() => calculateMarketplaceBreakdown(skuData), [skuData]);

  // Calculate totals for percentage bars
  const totalRevenue = useMemo(() => breakdown.reduce((sum, b) => sum + b.revenue, 0), [breakdown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{title}</h2>
              {subtitle && (
                <p className="text-indigo-200 text-sm mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
          {breakdown.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No marketplace data available
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-xs text-blue-600 font-medium">Total Revenue</div>
                  <div className="text-lg font-bold text-blue-800">
                    {formatMoney(breakdown.reduce((s, b) => s + b.revenue, 0))}
                  </div>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <div className="text-xs text-green-600 font-medium">Net Profit</div>
                  <div className="text-lg font-bold text-green-800">
                    {formatMoney(breakdown.reduce((s, b) => s + b.netProfit, 0))}
                  </div>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <div className="text-xs text-purple-600 font-medium">Avg Margin</div>
                  <div className="text-lg font-bold text-purple-800">
                    {formatPercent(
                      totalRevenue > 0
                        ? (breakdown.reduce((s, b) => s + b.netProfit, 0) / totalRevenue) * 100
                        : 0
                    )}
                  </div>
                </div>
                <div className="bg-amber-50 rounded-xl p-4">
                  <div className="text-xs text-amber-600 font-medium">Total Orders</div>
                  <div className="text-lg font-bold text-amber-800">
                    {breakdown.reduce((s, b) => s + b.orders, 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Marketplace Table */}
              <div className="bg-slate-50 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600">
                      <th className="text-left px-4 py-3 font-semibold">Marketplace</th>
                      <th className="text-right px-4 py-3 font-semibold">Revenue</th>
                      <th className="text-right px-4 py-3 font-semibold">Net Profit</th>
                      <th className="text-right px-4 py-3 font-semibold">Margin</th>
                      <th className="text-right px-4 py-3 font-semibold">Avg Price</th>
                      <th className="text-right px-4 py-3 font-semibold">Orders</th>
                      <th className="text-center px-4 py-3 font-semibold">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown
                      .sort((a, b) => b.revenue - a.revenue)
                      .map((row, idx) => {
                        const sharePercent = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
                        const MarginIcon = row.profitMargin >= 15 ? TrendingUp : row.profitMargin >= 0 ? Minus : TrendingDown;
                        const marginColor = row.profitMargin >= 15 ? 'text-green-600' : row.profitMargin >= 0 ? 'text-amber-600' : 'text-red-600';

                        return (
                          <tr
                            key={row.marketplace}
                            className={`border-t border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-indigo-50/50 transition-colors`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{COUNTRY_FLAGS[row.marketplace] || '🌍'}</span>
                                <span className="font-medium text-slate-800">{row.marketplace}</span>
                              </div>
                            </td>
                            <td className="text-right px-4 py-3 font-medium text-slate-800">
                              {formatMoney(row.revenue)}
                            </td>
                            <td className={`text-right px-4 py-3 font-medium ${row.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatMoney(row.netProfit)}
                            </td>
                            <td className="text-right px-4 py-3">
                              <div className={`flex items-center justify-end gap-1 font-medium ${marginColor}`}>
                                <MarginIcon className="w-3.5 h-3.5" />
                                {formatPercent(row.profitMargin)}
                              </div>
                            </td>
                            <td className="text-right px-4 py-3 text-slate-600">
                              {formatMoney(row.avgPrice)}
                            </td>
                            <td className="text-right px-4 py-3 text-slate-600">
                              {row.orders.toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                    style={{ width: `${sharePercent}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-slate-600 w-12 text-right">
                                  {formatPercent(sharePercent)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Cost Breakdown per Marketplace */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Cost Breakdown by Marketplace</h3>
                <div className="bg-slate-50 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600">
                        <th className="text-left px-4 py-3 font-semibold">Marketplace</th>
                        <th className="text-right px-4 py-3 font-semibold">Product Cost</th>
                        <th className="text-right px-4 py-3 font-semibold">Shipping</th>
                        <th className="text-right px-4 py-3 font-semibold">Customs</th>
                        <th className="text-right px-4 py-3 font-semibold">Selling Fees</th>
                        <th className="text-right px-4 py-3 font-semibold">FBA Fees</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown
                        .sort((a, b) => b.revenue - a.revenue)
                        .map((row, idx) => (
                          <tr
                            key={`cost-${row.marketplace}`}
                            className={`border-t border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{COUNTRY_FLAGS[row.marketplace] || '🌍'}</span>
                                <span className="font-medium text-slate-800">{row.marketplace}</span>
                              </div>
                            </td>
                            <td className="text-right px-4 py-3 text-slate-600">
                              {formatMoney(row.productCost)}
                            </td>
                            <td className="text-right px-4 py-3 text-slate-600">
                              {formatMoney(row.shippingCost)}
                            </td>
                            <td className="text-right px-4 py-3 text-slate-600">
                              {formatMoney(row.customsDuty)}
                            </td>
                            <td className="text-right px-4 py-3 text-slate-600">
                              {formatMoney(row.sellingFees)}
                            </td>
                            <td className="text-right px-4 py-3 text-slate-600">
                              {formatMoney(row.fbaFees)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(MarketplaceBreakdownModal);
