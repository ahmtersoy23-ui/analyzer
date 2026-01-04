/**
 * SKUTable - SKU level profitability table
 */

import React from 'react';
import { formatPercent } from '../../../utils/formatters';
import { SortableHeader } from '../../shared/SortableHeader';
import type { SelectedItemType } from '../PieChartModal';
import type { SKUProfitAnalysis } from '../../../services/profitability/profitabilityAnalytics';

// Country flags mapping
export const COUNTRY_FLAGS: Record<string, string> = {
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

export interface SKUTableProps {
  displaySkus: SKUProfitAnalysis[];
  showPerUnit: boolean;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  itemsPerPage: number;
  formatMoney: (amount: number) => string;
  onSort: (column: string) => void;
  onSelectItem: (item: SelectedItemType | null) => void;
  showCountry?: boolean;
}

export const SKUTable: React.FC<SKUTableProps> = ({
  displaySkus,
  showPerUnit,
  sortColumn,
  sortDirection,
  currentPage,
  itemsPerPage,
  formatMoney,
  onSort,
  onSelectItem,
  showCountry = false,
}) => {
  return (
    <table className="w-full min-w-max divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50 sticky top-0 z-20">
        <tr>
          <SortableHeader column="sku" label="SKU" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} color="green" className="sticky left-0 bg-slate-50 z-30 min-w-[150px] border-r border-slate-200" />
          <SortableHeader column="name" label="Name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} color="green" className="min-w-[200px]" />
          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">FF</th>
          {showCountry && (
            <SortableHeader column="marketplace" label="Country" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="center" color="green" className="border-r border-slate-200" />
          )}
          {!showCountry && <th className="border-r border-slate-200 w-0 p-0"></th>}
          <SortableHeader column="totalRevenue" label="Revenue" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" />
          <SortableHeader column="netProfit" label="Net Profit" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-green-50" />
          <SortableHeader column="profitMargin" label="Margin" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-green-50 border-r border-slate-200" />
          <SortableHeader column="totalOrders" label="Orders" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" />
          <SortableHeader column="totalQuantity" label="Qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" />
          <SortableHeader column="refundedQuantity" label="RQty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="border-r border-slate-200" />
          <SortableHeader column="sellingFees" label="Selling" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-red-50" />
          <SortableHeader column="fbaFees" label="FBA Fee" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-red-50" />
          <SortableHeader column="refundLoss" label="Refund" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-red-50" />
          <SortableHeader column="vat" label="VAT" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-red-50 border-r border-slate-200" />
          <SortableHeader column="advertisingCost" label="Ads" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-pink-50" />
          <SortableHeader column="fbaCost" label="FBA Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-indigo-50" />
          <SortableHeader column="fbmCost" label="FBM Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-cyan-50 border-r border-slate-200" />
          <SortableHeader column="productCost" label="Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" />
          <SortableHeader column="shippingCost" label="Ship" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" />
          <SortableHeader column="customsDuty" label="Customs" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-amber-50" />
          <SortableHeader column="ddpFee" label="DDP" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-amber-50" />
          <SortableHeader column="warehouseCost" label="Warehouse" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-amber-50" />
          <SortableHeader column="gstCost" label="GST" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-orange-50" />
          <SortableHeader column="replacementCount" label="Replace" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-purple-50" />
          <SortableHeader column="mscfCount" label="MCF" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-purple-50" />
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-slate-100">
        {displaySkus
          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
          .map(sku => (
          <tr
            key={`${sku.sku}::${sku.marketplace || 'ALL'}`}
            className="hover:bg-slate-50"
          >
            <td
              className="px-3 py-2 text-left sticky left-0 bg-white z-10 min-w-[150px] border-r border-slate-200 cursor-pointer hover:bg-green-50"
              onClick={() => onSelectItem({ type: 'sku', data: sku })}
            >
              <div className="font-medium text-green-600 text-xs">{sku.sku}</div>
              <div className="text-[10px] text-slate-400">{sku.category}</div>
            </td>
            <td className="px-3 py-2 text-left text-slate-700 text-xs min-w-[200px]">
              <div className="truncate max-w-[200px]" title={sku.name}>{sku.name}</div>
            </td>
            <td className="px-3 py-2 text-center">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                sku.fulfillment === 'FBA'
                  ? 'bg-blue-100 text-blue-700'
                  : sku.fulfillment === 'FBM'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-purple-100 text-purple-700'
              }`}>
                {sku.fulfillment}
              </span>
            </td>
            {showCountry && (
              <td className="px-3 py-2 text-center border-r border-slate-100">
                <span className="text-sm" title={sku.marketplace || 'Unknown'}>
                  {COUNTRY_FLAGS[sku.marketplace || ''] || '🌍'}
                </span>
                <span className="ml-1 text-[10px] text-slate-500">{sku.marketplace || '?'}</span>
              </td>
            )}
            {!showCountry && <td className="border-r border-slate-100 w-0 p-0"></td>}
            <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
              {showPerUnit
                ? formatMoney(sku.avgSalePrice)
                : formatMoney(sku.totalRevenue)}
            </td>
            <td className={`px-3 py-2 text-right font-bold bg-green-50/30 whitespace-nowrap ${sku.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {showPerUnit
                ? formatMoney(sku.totalQuantity > 0 ? sku.netProfit / sku.totalQuantity : 0)
                : formatMoney(sku.netProfit)}
            </td>
            <td className={`px-3 py-2 text-right font-medium bg-green-50/30 border-r border-slate-100 whitespace-nowrap ${sku.profitMargin >= 10 ? 'text-green-600' : sku.profitMargin >= 0 ? 'text-yellow-700' : 'text-red-600'}`}>
              {formatPercent(sku.profitMargin)}
            </td>
            <td className="px-3 py-2 text-right text-slate-600">{sku.totalOrders}</td>
            <td className="px-3 py-2 text-right text-slate-600">{sku.totalQuantity}</td>
            <td className="px-3 py-2 text-right text-red-500 border-r border-slate-100">{sku.refundedQuantity > 0 ? sku.refundedQuantity : '-'}</td>
            <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
              <div className="text-red-600 font-medium">{formatPercent(sku.sellingFeePercent)}</div>
              <div className="text-[10px] text-slate-400">
                {showPerUnit
                  ? formatMoney(sku.totalQuantity > 0 ? sku.sellingFees / sku.totalQuantity : 0)
                  : formatMoney(sku.sellingFees)}
              </div>
            </td>
            <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
              <div className="text-red-600 font-medium">{formatPercent(sku.fbaFeePercent)}</div>
              <div className="text-[10px] text-slate-400">
                {showPerUnit
                  ? formatMoney(sku.totalQuantity > 0 ? sku.fbaFees / sku.totalQuantity : 0)
                  : formatMoney(sku.fbaFees)}
              </div>
            </td>
            <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
              <div className="text-red-600 font-medium">{formatPercent(sku.refundLossPercent)}</div>
              <div className="text-[10px] text-slate-400">
                {showPerUnit
                  ? formatMoney(sku.totalQuantity > 0 ? sku.refundLoss / sku.totalQuantity : 0)
                  : formatMoney(sku.refundLoss)}
              </div>
            </td>
            {/* VAT - EU marketplaces */}
            <td className="px-3 py-2 text-right bg-red-50/30 border-r border-slate-100 whitespace-nowrap">
              {sku.vat > 0 ? (
                <>
                  <div className="text-red-600 font-medium">{formatPercent(sku.vatPercent)}</div>
                  <div className="text-[10px] text-slate-400">
                    {showPerUnit
                      ? formatMoney(sku.totalQuantity > 0 ? sku.vat / sku.totalQuantity : 0)
                      : formatMoney(sku.vat)}
                  </div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            {/* Ads - applies to all SKUs */}
            <td className="px-3 py-2 text-right bg-pink-50/30 whitespace-nowrap">
              <div className="text-pink-600 font-medium">{formatPercent(sku.advertisingPercent)}</div>
              <div className="text-[10px] text-slate-400">
                {showPerUnit
                  ? formatMoney(sku.totalQuantity > 0 ? sku.advertisingCost / sku.totalQuantity : 0)
                  : formatMoney(sku.advertisingCost)}
              </div>
            </td>
            {/* FBA Cost - only for FBA SKUs */}
            <td className="px-3 py-2 text-right bg-indigo-50/30 whitespace-nowrap">
              {(sku.fulfillment === 'FBA' || sku.fulfillment === 'Mixed') ? (
                <>
                  <div className="text-indigo-600 font-medium">{formatPercent(sku.fbaCostPercent)}</div>
                  <div className="text-[10px] text-slate-400">
                    {showPerUnit
                      ? formatMoney(sku.totalQuantity > 0 ? sku.fbaCost / sku.totalQuantity : 0)
                      : formatMoney(sku.fbaCost)}
                  </div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            {/* FBM Cost - only for FBM SKUs */}
            <td className="px-3 py-2 text-right bg-cyan-50/30 border-r border-slate-100 whitespace-nowrap">
              {(sku.fulfillment === 'FBM' || sku.fulfillment === 'Mixed') ? (
                <>
                  <div className="text-cyan-600 font-medium">{formatPercent(sku.fbmCostPercent)}</div>
                  <div className="text-[10px] text-slate-400">
                    {showPerUnit
                      ? formatMoney(sku.totalQuantity > 0 ? sku.fbmCost / sku.totalQuantity : 0)
                      : formatMoney(sku.fbmCost)}
                  </div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right whitespace-nowrap">
              <div className="text-slate-800 font-medium">
                {showPerUnit
                  ? formatMoney(sku.productCost)
                  : formatMoney(sku.totalProductCost)}
              </div>
              <div className="text-[10px] text-slate-400">{formatPercent(sku.productCostPercent)}</div>
            </td>
            <td className="px-3 py-2 text-right whitespace-nowrap">
              <div className="text-slate-800 font-medium">
                {showPerUnit
                  ? formatMoney(sku.totalQuantity > 0 ? sku.shippingCost / sku.totalQuantity : 0)
                  : formatMoney(sku.shippingCost)}
              </div>
              <div className="text-[10px] text-slate-400">{formatPercent(sku.shippingCostPercent)}</div>
            </td>
            <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
              {sku.customsDuty > 0 ? (
                <>
                  <div className="text-amber-600 font-medium">
                    {showPerUnit
                      ? formatMoney(sku.totalQuantity > 0 ? sku.customsDuty / sku.totalQuantity : 0)
                      : formatMoney(sku.customsDuty)}
                  </div>
                  <div className="text-[10px] text-slate-400">{formatPercent((sku.customsDuty / sku.totalRevenue) * 100)}</div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
              {sku.ddpFee > 0 ? (
                <>
                  <div className="text-amber-600 font-medium">
                    {showPerUnit
                      ? formatMoney(sku.totalQuantity > 0 ? sku.ddpFee / sku.totalQuantity : 0)
                      : formatMoney(sku.ddpFee)}
                  </div>
                  <div className="text-[10px] text-slate-400">{formatPercent((sku.ddpFee / sku.totalRevenue) * 100)}</div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
              {sku.warehouseCost > 0 ? (
                <>
                  <div className="text-amber-600 font-medium">
                    {showPerUnit
                      ? formatMoney(sku.totalQuantity > 0 ? sku.warehouseCost / sku.totalQuantity : 0)
                      : formatMoney(sku.warehouseCost)}
                  </div>
                  <div className="text-[10px] text-slate-400">{formatPercent((sku.warehouseCost / sku.totalRevenue) * 100)}</div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-orange-50/30 whitespace-nowrap">
              {sku.gstCost > 0 ? (
                <>
                  <div className="text-orange-600 font-medium">
                    {showPerUnit
                      ? formatMoney(sku.totalQuantity > 0 ? sku.gstCost / sku.totalQuantity : 0)
                      : formatMoney(sku.gstCost)}
                  </div>
                  <div className="text-[10px] text-slate-400">{formatPercent((sku.gstCost / sku.totalRevenue) * 100)}</div>
                </>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-purple-50/30 whitespace-nowrap">
              {sku.replacementCount > 0 ? (
                <span className="text-purple-600 font-medium">{sku.replacementCount}</span>
              ) : (
                <span className="text-slate-300">-</span>
              )}
            </td>
            <td className="px-3 py-2 text-right bg-purple-50/30 border-r border-slate-100 whitespace-nowrap">
              {sku.mscfCount > 0 ? (
                <span className="text-purple-600 font-medium">{sku.mscfCount}</span>
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
