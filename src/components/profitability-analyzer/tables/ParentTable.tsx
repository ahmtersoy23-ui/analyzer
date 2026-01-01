/**
 * ParentTable - Parent ASIN level profitability table
 */

import React from 'react';
import { formatPercent } from '../../../utils/formatters';
import { SortableHeader } from '../../shared/SortableHeader';
import type { SelectedItemType } from '../PieChartModal';
import type { ParentProfitAnalysis } from '../../../services/profitability/profitabilityAnalytics';

export interface ParentTableProps {
  displayParents: ParentProfitAnalysis[];
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  formatMoney: (amount: number) => string;
  onSort: (column: string) => void;
  onSelectItem: (item: SelectedItemType | null) => void;
}

export const ParentTable: React.FC<ParentTableProps> = ({
  displayParents,
  sortColumn,
  sortDirection,
  formatMoney,
  onSort,
  onSelectItem,
}) => {
  return (
    <table className="w-full min-w-max divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50 sticky top-0 z-20">
        <tr>
          <SortableHeader column="parent" label="Parent ASIN" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} color="purple" className="sticky left-0 bg-slate-50 z-30 min-w-[150px] border-r border-slate-200" />
          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Category</th>
          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">#Products</th>
          <SortableHeader column="totalRevenue" label="Revenue" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" />
          <SortableHeader column="netProfit" label="Net Profit" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-green-50" />
          <SortableHeader column="profitMargin" label="Margin" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-green-50 border-r border-slate-200" />
          <SortableHeader column="totalOrders" label="Orders" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" />
          <SortableHeader column="totalQuantity" label="Qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" />
          <SortableHeader column="refundedQuantity" label="RQty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="border-r border-slate-200" />
          <SortableHeader column="sellingFees" label="Selling" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-red-50" />
          <SortableHeader column="fbaFees" label="FBA Fee" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-red-50" />
          <SortableHeader column="refundLoss" label="Refund" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-red-50" />
          <SortableHeader column="vat" label="VAT" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-red-50 border-r border-slate-200" />
          <SortableHeader column="advertisingCost" label="Ads" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-pink-50" />
          <SortableHeader column="fbaCost" label="FBA Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-indigo-50" />
          <SortableHeader column="fbmCost" label="FBM Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-cyan-50 border-r border-slate-200" />
          <SortableHeader column="totalProductCost" label="Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" />
          <SortableHeader column="shippingCost" label="Ship" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" />
          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap bg-amber-50">Customs</th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap bg-amber-50">DDP</th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap bg-amber-50">Warehouse</th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap bg-orange-50">GST</th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap bg-purple-50">Replace</th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap bg-purple-50">MCF</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-slate-100">
        {displayParents.map(par => (
          <tr
            key={par.parent}
            className="hover:bg-slate-50"
          >
            <td
              className="px-3 py-2 text-left sticky left-0 bg-white z-10 min-w-[150px] border-r border-slate-200 cursor-pointer hover:bg-purple-50"
              onClick={() => onSelectItem({ type: 'parent', data: par })}
            >
              <div className="font-medium text-purple-600 text-xs">{par.parent}</div>
            </td>
            <td className="px-3 py-2 text-left text-slate-600 text-xs">{par.category}</td>
            <td className="px-3 py-2 text-center text-slate-600 border-r border-slate-100">{par.totalProducts}</td>
            <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">{formatMoney(par.totalRevenue)}</td>
            <td className={`px-3 py-2 text-right font-bold bg-green-50/30 whitespace-nowrap ${par.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatMoney(par.netProfit)}
            </td>
            <td className={`px-3 py-2 text-right font-medium bg-green-50/30 border-r border-slate-100 whitespace-nowrap ${par.profitMargin >= 10 ? 'text-green-600' : par.profitMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
              {formatPercent(par.profitMargin)}
            </td>
            <td className="px-3 py-2 text-right text-slate-600">{par.totalOrders}</td>
            <td className="px-3 py-2 text-right text-slate-600">{par.totalQuantity}</td>
            <td className="px-3 py-2 text-right text-red-500 border-r border-slate-100">{par.refundedQuantity > 0 ? par.refundedQuantity : '-'}</td>
            <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
              <div className="text-red-600 font-medium">{formatPercent(par.sellingFeePercent)}</div>
              <div className="text-[10px] text-slate-400">{formatMoney(par.sellingFees)}</div>
            </td>
            <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
              <div className="text-red-600 font-medium">{formatPercent(par.fbaFeePercent)}</div>
              <div className="text-[10px] text-slate-400">{formatMoney(par.fbaFees)}</div>
            </td>
            <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
              <div className="text-red-600 font-medium">{formatPercent(par.refundLossPercent)}</div>
              <div className="text-[10px] text-slate-400">{formatMoney(par.refundLoss)}</div>
            </td>
            <td className="px-3 py-2 text-right bg-red-50/30 border-r border-slate-100 whitespace-nowrap">
              {par.vat > 0 ? (
                <>
                  <div className="text-red-600 font-medium">{formatPercent(par.vatPercent)}</div>
                  <div className="text-[10px] text-slate-400">{formatMoney(par.vat)}</div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-pink-50/30 whitespace-nowrap">
              <div className="text-pink-600 font-medium">{formatPercent(par.advertisingPercent)}</div>
              <div className="text-[10px] text-slate-400">{formatMoney(par.advertisingCost)}</div>
            </td>
            <td className="px-3 py-2 text-right bg-indigo-50/30 whitespace-nowrap">
              <div className="text-indigo-600 font-medium">{formatPercent(par.fbaCostPercent)}</div>
              <div className="text-[10px] text-slate-400">{formatMoney(par.fbaCost)}</div>
            </td>
            <td className="px-3 py-2 text-right bg-cyan-50/30 border-r border-slate-100 whitespace-nowrap">
              <div className="text-cyan-600 font-medium">{formatPercent(par.fbmCostPercent)}</div>
              <div className="text-[10px] text-slate-400">{formatMoney(par.fbmCost)}</div>
            </td>
            <td className="px-3 py-2 text-right whitespace-nowrap">
              <div className="text-slate-800 font-medium">{formatMoney(par.totalProductCost)}</div>
              <div className="text-[10px] text-slate-400">{formatPercent(par.productCostPercent)}</div>
            </td>
            <td className="px-3 py-2 text-right whitespace-nowrap">
              <div className="text-slate-800 font-medium">{formatMoney(par.shippingCost)}</div>
              <div className="text-[10px] text-slate-400">{formatPercent(par.shippingCostPercent)}</div>
            </td>
            <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
              {par.customsDuty > 0 ? (
                <>
                  <div className="text-amber-700 font-medium">{formatMoney(par.customsDuty)}</div>
                  <div className="text-[10px] text-slate-400">{formatPercent(par.totalRevenue > 0 ? (par.customsDuty / par.totalRevenue) * 100 : 0)}</div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
              {par.ddpFee > 0 ? (
                <>
                  <div className="text-amber-700 font-medium">{formatMoney(par.ddpFee)}</div>
                  <div className="text-[10px] text-slate-400">{formatPercent(par.totalRevenue > 0 ? (par.ddpFee / par.totalRevenue) * 100 : 0)}</div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
              {par.warehouseCost > 0 ? (
                <>
                  <div className="text-amber-700 font-medium">{formatMoney(par.warehouseCost)}</div>
                  <div className="text-[10px] text-slate-400">{formatPercent(par.totalRevenue > 0 ? (par.warehouseCost / par.totalRevenue) * 100 : 0)}</div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-orange-50/30 whitespace-nowrap">
              {par.gstCost > 0 ? (
                <>
                  <div className="text-orange-600 font-medium">{formatMoney(par.gstCost)}</div>
                  <div className="text-[10px] text-slate-400">{formatPercent(par.gstCostPercent)}</div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-purple-50/30 whitespace-nowrap">
              {par.replacementCount > 0 ? (
                <span className="text-purple-600 font-medium">{par.replacementCount}</span>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-purple-50/30 whitespace-nowrap">
              {par.mscfCount > 0 ? (
                <span className="text-purple-600 font-medium">{par.mscfCount}</span>
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
