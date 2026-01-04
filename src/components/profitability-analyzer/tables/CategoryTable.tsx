/**
 * CategoryTable - Category level profitability table
 */

import React from 'react';
import { formatPercent } from '../../../utils/formatters';
import { SortableHeader } from '../../shared/SortableHeader';
import type { SelectedItemType } from '../PieChartModal';
import type { CategoryProfitAnalysis } from '../../../services/profitability/profitabilityAnalytics';

export interface CategoryTableProps {
  displayCategories: CategoryProfitAnalysis[];
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  formatMoney: (amount: number) => string;
  onSort: (column: string) => void;
  onSelectItem: (item: SelectedItemType | null) => void;
}

export const CategoryTable: React.FC<CategoryTableProps> = ({
  displayCategories,
  sortColumn,
  sortDirection,
  formatMoney,
  onSort,
  onSelectItem,
}) => {
  // Calculate totals for All Categories row
  const totals = displayCategories.reduce(
    (acc, cat) => ({
      totalRevenue: acc.totalRevenue + cat.totalRevenue,
      totalOrders: acc.totalOrders + cat.totalOrders,
      totalQuantity: acc.totalQuantity + cat.totalQuantity,
      refundedQuantity: acc.refundedQuantity + cat.refundedQuantity,
      replacementCount: acc.replacementCount + cat.replacementCount,
      mscfCount: acc.mscfCount + cat.mscfCount,
      totalProducts: acc.totalProducts + cat.totalProducts,
      totalParents: acc.totalParents + cat.totalParents,
      sellingFees: acc.sellingFees + cat.sellingFees,
      fbaFees: acc.fbaFees + cat.fbaFees,
      refundLoss: acc.refundLoss + cat.refundLoss,
      vat: acc.vat + cat.vat,
      advertisingCost: acc.advertisingCost + cat.advertisingCost,
      fbaCost: acc.fbaCost + cat.fbaCost,
      fbmCost: acc.fbmCost + cat.fbmCost,
      totalProductCost: acc.totalProductCost + cat.totalProductCost,
      shippingCost: acc.shippingCost + cat.shippingCost,
      customsDuty: acc.customsDuty + cat.customsDuty,
      ddpFee: acc.ddpFee + cat.ddpFee,
      warehouseCost: acc.warehouseCost + cat.warehouseCost,
      gstCost: acc.gstCost + cat.gstCost,
      netProfit: acc.netProfit + cat.netProfit,
      fbaRevenue: acc.fbaRevenue + cat.fbaRevenue,
      fbmRevenue: acc.fbmRevenue + cat.fbmRevenue,
    }),
    {
      totalRevenue: 0,
      totalOrders: 0,
      totalQuantity: 0,
      refundedQuantity: 0,
      replacementCount: 0,
      mscfCount: 0,
      totalProducts: 0,
      totalParents: 0,
      sellingFees: 0,
      fbaFees: 0,
      refundLoss: 0,
      vat: 0,
      advertisingCost: 0,
      fbaCost: 0,
      fbmCost: 0,
      totalProductCost: 0,
      shippingCost: 0,
      customsDuty: 0,
      ddpFee: 0,
      warehouseCost: 0,
      gstCost: 0,
      netProfit: 0,
      fbaRevenue: 0,
      fbmRevenue: 0,
    }
  );

  // Calculate percentages for All Categories
  const allProfitMargin = totals.totalRevenue > 0 ? (totals.netProfit / totals.totalRevenue) * 100 : 0;
  const allSellingFeePercent = totals.totalRevenue > 0 ? (totals.sellingFees / totals.totalRevenue) * 100 : 0;
  const allFbaFeePercent = totals.fbaRevenue > 0 ? (totals.fbaFees / totals.fbaRevenue) * 100 : 0;
  const allRefundLossPercent = totals.totalRevenue > 0 ? (totals.refundLoss / totals.totalRevenue) * 100 : 0;
  const allVatPercent = totals.totalRevenue > 0 ? (totals.vat / totals.totalRevenue) * 100 : 0;
  const allAdvertisingPercent = totals.totalRevenue > 0 ? (totals.advertisingCost / totals.totalRevenue) * 100 : 0;
  const allFbaCostPercent = totals.fbaRevenue > 0 ? (totals.fbaCost / totals.fbaRevenue) * 100 : 0;
  const allFbmCostPercent = totals.fbmRevenue > 0 ? (totals.fbmCost / totals.fbmRevenue) * 100 : 0;
  const allProductCostPercent = totals.totalRevenue > 0 ? (totals.totalProductCost / totals.totalRevenue) * 100 : 0;
  const allShippingCostPercent = totals.totalRevenue > 0 ? (totals.shippingCost / totals.totalRevenue) * 100 : 0;
  const allCustomsDutyPercent = totals.totalRevenue > 0 ? (totals.customsDuty / totals.totalRevenue) * 100 : 0;
  const allDdpFeePercent = totals.totalRevenue > 0 ? (totals.ddpFee / totals.totalRevenue) * 100 : 0;
  const allWarehouseCostPercent = totals.totalRevenue > 0 ? (totals.warehouseCost / totals.totalRevenue) * 100 : 0;
  const allGstCostPercent = totals.totalRevenue > 0 ? (totals.gstCost / totals.totalRevenue) * 100 : 0;

  // Create All Categories data for pie chart
  const allCategoriesData: CategoryProfitAnalysis = {
    category: 'All Categories',
    parents: [],
    fulfillment: 'Mixed',
    totalParents: totals.totalParents,
    totalProducts: totals.totalProducts,
    totalRevenue: totals.totalRevenue,
    totalOrders: totals.totalOrders,
    totalQuantity: totals.totalQuantity,
    refundedQuantity: totals.refundedQuantity,
    replacementCount: totals.replacementCount,
    mscfCount: totals.mscfCount,
    avgSalePrice: totals.totalQuantity > 0 ? totals.totalRevenue / totals.totalQuantity : 0,
    fbaRevenue: totals.fbaRevenue,
    fbmRevenue: totals.fbmRevenue,
    fbaQuantity: 0,
    fbmQuantity: 0,
    sellingFees: totals.sellingFees,
    fbaFees: totals.fbaFees,
    refundLoss: totals.refundLoss,
    vat: totals.vat,
    totalAmazonFees: totals.sellingFees + totals.fbaFees + totals.refundLoss + totals.vat,
    productCost: 0,
    totalProductCost: totals.totalProductCost,
    shippingCost: totals.shippingCost,
    customsDuty: totals.customsDuty,
    ddpFee: totals.ddpFee,
    warehouseCost: totals.warehouseCost,
    othersCost: 0,
    gstCost: totals.gstCost,
    advertisingCost: totals.advertisingCost,
    fbaCost: totals.fbaCost,
    fbmCost: totals.fbmCost,
    grossProfit: totals.totalRevenue - totals.sellingFees - totals.fbaFees,
    netProfit: totals.netProfit,
    profitMargin: allProfitMargin,
    roi: 0,
    sellingFeePercent: allSellingFeePercent,
    fbaFeePercent: allFbaFeePercent,
    refundLossPercent: allRefundLossPercent,
    vatPercent: allVatPercent,
    productCostPercent: allProductCostPercent,
    shippingCostPercent: allShippingCostPercent,
    advertisingPercent: allAdvertisingPercent,
    fbaCostPercent: allFbaCostPercent,
    fbmCostPercent: allFbmCostPercent,
    othersCostPercent: 0,
    gstCostPercent: allGstCostPercent,
    hasCostData: true,
    hasSizeData: false,
    topProducts: [],
  };

  return (
    <table className="w-full min-w-max divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50 sticky top-0 z-20">
        <tr>
          <SortableHeader column="category" label="Category" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} color="amber" className="sticky left-0 bg-slate-50 z-30 min-w-[200px] border-r border-slate-200" />
          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">#Parents</th>
          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">#Products</th>
          <SortableHeader column="totalRevenue" label="Revenue" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" />
          <SortableHeader column="netProfit" label="Net Profit" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-green-50" />
          <SortableHeader column="profitMargin" label="Margin" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-green-50 border-r border-slate-200" />
          <SortableHeader column="totalOrders" label="Orders" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" />
          <SortableHeader column="totalQuantity" label="Qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" />
          <SortableHeader column="refundedQuantity" label="RQty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="border-r border-slate-200" />
          <SortableHeader column="sellingFees" label="Selling" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-red-50" />
          <SortableHeader column="fbaFees" label="FBA Fee" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-red-50" />
          <SortableHeader column="refundLoss" label="Refund" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-red-50" />
          <SortableHeader column="vat" label="VAT" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-red-50 border-r border-slate-200" />
          <SortableHeader column="advertisingCost" label="Ads" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-pink-50" />
          <SortableHeader column="fbaCost" label="FBA Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-indigo-50" />
          <SortableHeader column="fbmCost" label="FBM Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-cyan-50 border-r border-slate-200" />
          <SortableHeader column="totalProductCost" label="Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" />
          <SortableHeader column="shippingCost" label="Ship" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" />
          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap bg-amber-50">Customs</th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap bg-amber-50">DDP</th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap bg-amber-50">Warehouse</th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap bg-orange-50">GST</th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap bg-purple-50">Replace</th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap bg-purple-50">MCF</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-slate-100">
        {/* All Categories Summary Row */}
        <tr className="hover:bg-indigo-50 bg-indigo-50/30 border-b-2 border-indigo-200">
          <td
            className="px-3 py-3 text-left sticky left-0 bg-indigo-50 z-10 min-w-[200px] border-r border-slate-200 cursor-pointer hover:bg-indigo-100"
            onClick={() => onSelectItem({ type: 'category', data: allCategoriesData })}
          >
            <div className="font-bold text-indigo-700 text-sm">All Categories</div>
            <div className="text-[10px] text-indigo-500">Click for breakdown</div>
          </td>
          <td className="px-3 py-3 text-center text-slate-600">{totals.totalParents}</td>
          <td className="px-3 py-3 text-center text-slate-600 border-r border-slate-100">{totals.totalProducts}</td>
          <td className="px-3 py-3 text-right font-bold text-indigo-700 whitespace-nowrap text-sm">{formatMoney(totals.totalRevenue)}</td>
          <td className={`px-3 py-3 text-right font-bold bg-green-50/30 whitespace-nowrap text-sm ${totals.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatMoney(totals.netProfit)}
          </td>
          <td className={`px-3 py-3 text-right font-bold bg-green-50/30 border-r border-slate-100 whitespace-nowrap ${allProfitMargin >= 10 ? 'text-green-600' : allProfitMargin >= 0 ? 'text-yellow-700' : 'text-red-600'}`}>
            {formatPercent(allProfitMargin)}
          </td>
          <td className="px-3 py-3 text-right text-slate-600">{totals.totalOrders}</td>
          <td className="px-3 py-3 text-right text-slate-600">{totals.totalQuantity}</td>
          <td className="px-3 py-3 text-right text-red-500 border-r border-slate-100">{totals.refundedQuantity > 0 ? totals.refundedQuantity : '-'}</td>
          <td className="px-3 py-3 text-right bg-red-50/30 whitespace-nowrap">
            <div className="text-red-600 font-medium">{formatPercent(allSellingFeePercent)}</div>
            <div className="text-[10px] text-slate-400">{formatMoney(totals.sellingFees)}</div>
          </td>
          <td className="px-3 py-3 text-right bg-red-50/30 whitespace-nowrap">
            <div className="text-red-600 font-medium">{formatPercent(allFbaFeePercent)}</div>
            <div className="text-[10px] text-slate-400">{formatMoney(totals.fbaFees)}</div>
          </td>
          <td className="px-3 py-3 text-right bg-red-50/30 whitespace-nowrap">
            <div className="text-red-600 font-medium">{formatPercent(allRefundLossPercent)}</div>
            <div className="text-[10px] text-slate-400">{formatMoney(totals.refundLoss)}</div>
          </td>
          <td className="px-3 py-3 text-right bg-red-50/30 border-r border-slate-100 whitespace-nowrap">
            {totals.vat > 0 ? (
              <>
                <div className="text-red-600 font-medium">{formatPercent(allVatPercent)}</div>
                <div className="text-[10px] text-slate-400">{formatMoney(totals.vat)}</div>
              </>
            ) : (
              <span className="text-slate-300">-</span>
            )}
          </td>
          <td className="px-3 py-3 text-right bg-pink-50/30 whitespace-nowrap">
            <div className="text-pink-600 font-medium">{formatPercent(allAdvertisingPercent)}</div>
            <div className="text-[10px] text-slate-400">{formatMoney(totals.advertisingCost)}</div>
          </td>
          <td className="px-3 py-3 text-right bg-indigo-50/30 whitespace-nowrap">
            <div className="text-indigo-600 font-medium">{formatPercent(allFbaCostPercent)}</div>
            <div className="text-[10px] text-slate-400">{formatMoney(totals.fbaCost)}</div>
          </td>
          <td className="px-3 py-3 text-right bg-cyan-50/30 border-r border-slate-100 whitespace-nowrap">
            <div className="text-cyan-600 font-medium">{formatPercent(allFbmCostPercent)}</div>
            <div className="text-[10px] text-slate-400">{formatMoney(totals.fbmCost)}</div>
          </td>
          <td className="px-3 py-3 text-right whitespace-nowrap">
            <div className="text-slate-800 font-medium">{formatMoney(totals.totalProductCost)}</div>
            <div className="text-[10px] text-slate-400">{formatPercent(allProductCostPercent)}</div>
          </td>
          <td className="px-3 py-3 text-right whitespace-nowrap">
            <div className="text-slate-800 font-medium">{formatMoney(totals.shippingCost)}</div>
            <div className="text-[10px] text-slate-400">{formatPercent(allShippingCostPercent)}</div>
          </td>
          <td className="px-3 py-3 text-right bg-amber-50/30 whitespace-nowrap">
            {totals.customsDuty > 0 ? (
              <>
                <div className="text-amber-700 font-medium">{formatPercent(allCustomsDutyPercent)}</div>
                <div className="text-[10px] text-slate-400">{formatMoney(totals.customsDuty)}</div>
              </>
            ) : (
              <span className="text-slate-300">-</span>
            )}
          </td>
          <td className="px-3 py-3 text-right bg-amber-50/30 whitespace-nowrap">
            {totals.ddpFee > 0 ? (
              <>
                <div className="text-amber-700 font-medium">{formatPercent(allDdpFeePercent)}</div>
                <div className="text-[10px] text-slate-400">{formatMoney(totals.ddpFee)}</div>
              </>
            ) : (
              <span className="text-slate-300">-</span>
            )}
          </td>
          <td className="px-3 py-3 text-right bg-amber-50/30 whitespace-nowrap">
            {totals.warehouseCost > 0 ? (
              <>
                <div className="text-amber-700 font-medium">{formatPercent(allWarehouseCostPercent)}</div>
                <div className="text-[10px] text-slate-400">{formatMoney(totals.warehouseCost)}</div>
              </>
            ) : (
              <span className="text-slate-300">-</span>
            )}
          </td>
          <td className="px-3 py-3 text-right bg-orange-50/30 whitespace-nowrap">
            {totals.gstCost > 0 ? (
              <>
                <div className="text-orange-600 font-medium">{formatPercent(allGstCostPercent)}</div>
                <div className="text-[10px] text-slate-400">{formatMoney(totals.gstCost)}</div>
              </>
            ) : (
              <span className="text-slate-300">-</span>
            )}
          </td>
          <td className="px-3 py-3 text-right bg-purple-50/30 whitespace-nowrap">
            {totals.replacementCount > 0 ? (
              <span className="text-purple-600 font-medium">{totals.replacementCount}</span>
            ) : (
              <span className="text-slate-300">-</span>
            )}
          </td>
          <td className="px-3 py-3 text-right bg-purple-50/30 whitespace-nowrap">
            {totals.mscfCount > 0 ? (
              <span className="text-purple-600 font-medium">{totals.mscfCount}</span>
            ) : (
              <span className="text-slate-300">-</span>
            )}
          </td>
        </tr>
        {/* Individual Category Rows */}
        {displayCategories.map(cat => (
          <tr
            key={cat.category}
            className="hover:bg-slate-50"
          >
            <td
              className="px-3 py-2 text-left sticky left-0 bg-white z-10 min-w-[200px] border-r border-slate-200 cursor-pointer hover:bg-amber-50"
              onClick={() => onSelectItem({ type: 'category', data: cat })}
            >
              <div className="font-medium text-amber-600">{cat.category}</div>
            </td>
            <td className="px-3 py-2 text-center text-slate-600">{cat.totalParents}</td>
            <td className="px-3 py-2 text-center text-slate-600 border-r border-slate-100">{cat.totalProducts}</td>
            <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">{formatMoney(cat.totalRevenue)}</td>
            <td className={`px-3 py-2 text-right font-bold bg-green-50/30 whitespace-nowrap ${cat.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatMoney(cat.netProfit)}
            </td>
            <td className={`px-3 py-2 text-right font-medium bg-green-50/30 border-r border-slate-100 whitespace-nowrap ${cat.profitMargin >= 10 ? 'text-green-600' : cat.profitMargin >= 0 ? 'text-yellow-700' : 'text-red-600'}`}>
              {formatPercent(cat.profitMargin)}
            </td>
            <td className="px-3 py-2 text-right text-slate-600">{cat.totalOrders}</td>
            <td className="px-3 py-2 text-right text-slate-600">{cat.totalQuantity}</td>
            <td className="px-3 py-2 text-right text-red-500 border-r border-slate-100">{cat.refundedQuantity > 0 ? cat.refundedQuantity : '-'}</td>
            <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
              <div className="text-red-600 font-medium">{formatPercent(cat.sellingFeePercent)}</div>
              <div className="text-[10px] text-slate-400">{formatMoney(cat.sellingFees)}</div>
            </td>
            <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
              <div className="text-red-600 font-medium">{formatPercent(cat.fbaFeePercent)}</div>
              <div className="text-[10px] text-slate-400">{formatMoney(cat.fbaFees)}</div>
            </td>
            <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
              <div className="text-red-600 font-medium">{formatPercent(cat.refundLossPercent)}</div>
              <div className="text-[10px] text-slate-400">{formatMoney(cat.refundLoss)}</div>
            </td>
            <td className="px-3 py-2 text-right bg-red-50/30 border-r border-slate-100 whitespace-nowrap">
              {cat.vat > 0 ? (
                <>
                  <div className="text-red-600 font-medium">{formatPercent(cat.vatPercent)}</div>
                  <div className="text-[10px] text-slate-400">{formatMoney(cat.vat)}</div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-pink-50/30 whitespace-nowrap">
              <div className="text-pink-600 font-medium">{formatPercent(cat.advertisingPercent)}</div>
              <div className="text-[10px] text-slate-400">{formatMoney(cat.advertisingCost)}</div>
            </td>
            <td className="px-3 py-2 text-right bg-indigo-50/30 whitespace-nowrap">
              <div className="text-indigo-600 font-medium">{formatPercent(cat.fbaCostPercent)}</div>
              <div className="text-[10px] text-slate-400">{formatMoney(cat.fbaCost)}</div>
            </td>
            <td className="px-3 py-2 text-right bg-cyan-50/30 border-r border-slate-100 whitespace-nowrap">
              <div className="text-cyan-600 font-medium">{formatPercent(cat.fbmCostPercent)}</div>
              <div className="text-[10px] text-slate-400">{formatMoney(cat.fbmCost)}</div>
            </td>
            <td className="px-3 py-2 text-right whitespace-nowrap">
              <div className="text-slate-800 font-medium">{formatMoney(cat.totalProductCost)}</div>
              <div className="text-[10px] text-slate-400">{formatPercent(cat.productCostPercent)}</div>
            </td>
            <td className="px-3 py-2 text-right whitespace-nowrap">
              <div className="text-slate-800 font-medium">{formatMoney(cat.shippingCost)}</div>
              <div className="text-[10px] text-slate-400">{formatPercent(cat.shippingCostPercent)}</div>
            </td>
            <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
              {cat.customsDuty > 0 ? (
                <>
                  <div className="text-amber-700 font-medium">{formatMoney(cat.customsDuty)}</div>
                  <div className="text-[10px] text-slate-400">{formatPercent(cat.totalRevenue > 0 ? (cat.customsDuty / cat.totalRevenue) * 100 : 0)}</div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
              {cat.ddpFee > 0 ? (
                <>
                  <div className="text-amber-700 font-medium">{formatMoney(cat.ddpFee)}</div>
                  <div className="text-[10px] text-slate-400">{formatPercent(cat.totalRevenue > 0 ? (cat.ddpFee / cat.totalRevenue) * 100 : 0)}</div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
              {cat.warehouseCost > 0 ? (
                <>
                  <div className="text-amber-700 font-medium">{formatMoney(cat.warehouseCost)}</div>
                  <div className="text-[10px] text-slate-400">{formatPercent(cat.totalRevenue > 0 ? (cat.warehouseCost / cat.totalRevenue) * 100 : 0)}</div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-orange-50/30 whitespace-nowrap">
              {cat.gstCost > 0 ? (
                <>
                  <div className="text-orange-600 font-medium">{formatMoney(cat.gstCost)}</div>
                  <div className="text-[10px] text-slate-400">{formatPercent(cat.gstCostPercent)}</div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-purple-50/30 whitespace-nowrap">
              {cat.replacementCount > 0 ? (
                <span className="text-purple-600 font-medium">{cat.replacementCount}</span>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-purple-50/30 whitespace-nowrap">
              {cat.mscfCount > 0 ? (
                <span className="text-purple-600 font-medium">{cat.mscfCount}</span>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
