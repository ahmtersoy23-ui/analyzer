/**
 * ProductTable - Product (Name) level profitability table
 */

import React from 'react';
import { formatPercent } from '../../../utils/formatters';
import { SortableHeader } from '../../shared/SortableHeader';
import type { SelectedItemType } from '../PieChartModal';
import type { ProductProfitAnalysis } from '../../../services/profitability/profitabilityAnalytics';

export interface ProductTableProps {
  displayProducts: ProductProfitAnalysis[];
  showPerUnit: boolean;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  itemsPerPage: number;
  formatMoney: (amount: number) => string;
  onSort: (column: string) => void;
  onSelectItem: (item: SelectedItemType | null) => void;
}

export const ProductTable: React.FC<ProductTableProps> = ({
  displayProducts,
  showPerUnit,
  sortColumn,
  sortDirection,
  currentPage,
  itemsPerPage,
  formatMoney,
  onSort,
  onSelectItem,
}) => {
  return (
    <table className="w-full min-w-max divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50 sticky top-0 z-20">
        <tr>
          <SortableHeader column="name" label="Product Name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} color="blue" className="sticky left-0 bg-slate-50 z-30 min-w-[300px] border-r border-slate-200" />
          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">FF</th>
          <SortableHeader column="totalRevenue" label="Revenue" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" />
          <SortableHeader column="netProfit" label="Net Profit" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-green-50" />
          <SortableHeader column="profitMargin" label="Margin" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-green-50 border-r border-slate-200" />
          <SortableHeader column="totalOrders" label="Orders" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" />
          <SortableHeader column="totalQuantity" label="Qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" />
          <SortableHeader column="refundedQuantity" label="RQty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="border-r border-slate-200" />
          <SortableHeader column="sellingFees" label="Selling" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-red-50" />
          <SortableHeader column="fbaFees" label="FBA Fee" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-red-50" />
          <SortableHeader column="refundLoss" label="Refund" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-red-50" />
          <SortableHeader column="vat" label="VAT" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-red-50 border-r border-slate-200" />
          <SortableHeader column="advertisingCost" label="Ads" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-pink-50" />
          <SortableHeader column="fbaCost" label="FBA Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-indigo-50" />
          <SortableHeader column="fbmCost" label="FBM Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-cyan-50 border-r border-slate-200" />
          <SortableHeader column="productCost" label="Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" />
          <SortableHeader column="shippingCost" label="Ship" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" />
          <SortableHeader column="customsDuty" label="Customs" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-amber-50" />
          <SortableHeader column="ddpFee" label="DDP" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-amber-50" />
          <SortableHeader column="warehouseCost" label="Warehouse" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-amber-50" />
          <SortableHeader column="gstCost" label="GST" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-orange-50" />
          <SortableHeader column="replacementCount" label="Replace" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-purple-50" />
          <SortableHeader column="mscfCount" label="MCF" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-purple-50" />
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-slate-100">
        {displayProducts
          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
          .map(product => (
            <tr
              key={product.name}
              className="hover:bg-slate-50"
            >
              <td
                className="px-3 py-2 text-left sticky left-0 bg-white z-10 min-w-[300px] border-r border-slate-200 cursor-pointer hover:bg-blue-50"
                onClick={() => onSelectItem({ type: 'product', data: product })}
              >
                <div className="font-medium text-blue-600 text-xs whitespace-normal">{product.name}</div>
                <div className="text-[10px] text-slate-400">{product.category}</div>
              </td>
              <td className="px-3 py-2 text-center border-r border-slate-100">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  product.fulfillment === 'FBA'
                    ? 'bg-blue-100 text-blue-700'
                    : product.fulfillment === 'FBM'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {product.fulfillment}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
                {showPerUnit
                  ? formatMoney(product.avgSalePrice)
                  : formatMoney(product.totalRevenue)}
              </td>
              <td className={`px-3 py-2 text-right font-bold bg-green-50/30 whitespace-nowrap ${product.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {showPerUnit
                  ? formatMoney(product.totalQuantity > 0 ? product.netProfit / product.totalQuantity : 0)
                  : formatMoney(product.netProfit)}
              </td>
              <td className={`px-3 py-2 text-right font-medium bg-green-50/30 border-r border-slate-100 whitespace-nowrap ${product.profitMargin >= 10 ? 'text-green-600' : product.profitMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                {formatPercent(product.profitMargin)}
              </td>
              <td className="px-3 py-2 text-right text-slate-600">{product.totalOrders}</td>
              <td className="px-3 py-2 text-right text-slate-600">{product.totalQuantity}</td>
              <td className="px-3 py-2 text-right text-red-500 border-r border-slate-100">{product.refundedQuantity > 0 ? product.refundedQuantity : '-'}</td>
              <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
                <div className="text-red-600 font-medium">{formatPercent(product.sellingFeePercent)}</div>
                <div className="text-[10px] text-slate-400">
                  {showPerUnit
                    ? formatMoney(product.totalQuantity > 0 ? product.sellingFees / product.totalQuantity : 0)
                    : formatMoney(product.sellingFees)}
                </div>
              </td>
              <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
                <div className="text-red-600 font-medium">{formatPercent(product.fbaFeePercent)}</div>
                <div className="text-[10px] text-slate-400">
                  {showPerUnit
                    ? formatMoney(product.totalQuantity > 0 ? product.fbaFees / product.totalQuantity : 0)
                    : formatMoney(product.fbaFees)}
                </div>
              </td>
              <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
                <div className="text-red-600 font-medium">{formatPercent(product.refundLossPercent)}</div>
                <div className="text-[10px] text-slate-400">
                  {showPerUnit
                    ? formatMoney(product.totalQuantity > 0 ? product.refundLoss / product.totalQuantity : 0)
                    : formatMoney(product.refundLoss)}
                </div>
              </td>
              {/* VAT - EU marketplaces */}
              <td className="px-3 py-2 text-right bg-red-50/30 border-r border-slate-100 whitespace-nowrap">
                {product.vat > 0 ? (
                  <>
                    <div className="text-red-600 font-medium">{formatPercent(product.vatPercent)}</div>
                    <div className="text-[10px] text-slate-400">
                      {showPerUnit
                        ? formatMoney(product.totalQuantity > 0 ? product.vat / product.totalQuantity : 0)
                        : formatMoney(product.vat)}
                    </div>
                  </>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
              {/* Ads */}
              <td className="px-3 py-2 text-right bg-pink-50/30 whitespace-nowrap">
                <div className="text-pink-600 font-medium">{formatPercent(product.advertisingPercent)}</div>
                <div className="text-[10px] text-slate-400">
                  {showPerUnit
                    ? formatMoney(product.totalQuantity > 0 ? product.advertisingCost / product.totalQuantity : 0)
                    : formatMoney(product.advertisingCost)}
                </div>
              </td>
              {/* FBA Cost */}
              <td className="px-3 py-2 text-right bg-indigo-50/30 whitespace-nowrap">
                {(product.fulfillment === 'FBA' || product.fulfillment === 'Mixed') ? (
                  <>
                    <div className="text-indigo-600 font-medium">{formatPercent(product.fbaCostPercent)}</div>
                    <div className="text-[10px] text-slate-400">
                      {showPerUnit
                        ? formatMoney(product.totalQuantity > 0 ? product.fbaCost / product.totalQuantity : 0)
                        : formatMoney(product.fbaCost)}
                    </div>
                  </>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
              {/* FBM Cost */}
              <td className="px-3 py-2 text-right bg-cyan-50/30 border-r border-slate-100 whitespace-nowrap">
                {(product.fulfillment === 'FBM' || product.fulfillment === 'Mixed') ? (
                  <>
                    <div className="text-cyan-600 font-medium">{formatPercent(product.fbmCostPercent)}</div>
                    <div className="text-[10px] text-slate-400">
                      {showPerUnit
                        ? formatMoney(product.totalQuantity > 0 ? product.fbmCost / product.totalQuantity : 0)
                        : formatMoney(product.fbmCost)}
                    </div>
                  </>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <div className="text-slate-800 font-medium">
                  {showPerUnit
                    ? formatMoney(product.productCost)
                    : formatMoney(product.totalProductCost)}
                </div>
                <div className="text-[10px] text-slate-400">{formatPercent(product.productCostPercent)}</div>
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <div className="text-slate-800 font-medium">
                  {showPerUnit
                    ? formatMoney(product.totalQuantity > 0 ? product.shippingCost / product.totalQuantity : 0)
                    : formatMoney(product.shippingCost)}
                </div>
                <div className="text-[10px] text-slate-400">{formatPercent(product.shippingCostPercent)}</div>
              </td>
              <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
                {product.customsDuty > 0 ? (
                  <>
                    <div className="text-amber-600 font-medium">
                      {showPerUnit
                        ? formatMoney(product.totalQuantity > 0 ? product.customsDuty / product.totalQuantity : 0)
                        : formatMoney(product.customsDuty)}
                    </div>
                    <div className="text-[10px] text-slate-400">{formatPercent((product.customsDuty / product.totalRevenue) * 100)}</div>
                  </>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
                {product.ddpFee > 0 ? (
                  <>
                    <div className="text-amber-600 font-medium">
                      {showPerUnit
                        ? formatMoney(product.totalQuantity > 0 ? product.ddpFee / product.totalQuantity : 0)
                        : formatMoney(product.ddpFee)}
                    </div>
                    <div className="text-[10px] text-slate-400">{formatPercent((product.ddpFee / product.totalRevenue) * 100)}</div>
                  </>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
                {product.warehouseCost > 0 ? (
                  <>
                    <div className="text-amber-600 font-medium">
                      {showPerUnit
                        ? formatMoney(product.totalQuantity > 0 ? product.warehouseCost / product.totalQuantity : 0)
                        : formatMoney(product.warehouseCost)}
                    </div>
                    <div className="text-[10px] text-slate-400">{formatPercent((product.warehouseCost / product.totalRevenue) * 100)}</div>
                  </>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-right bg-orange-50/30 whitespace-nowrap">
                {product.gstCost > 0 ? (
                  <>
                    <div className="text-orange-600 font-medium">
                      {showPerUnit
                        ? formatMoney(product.totalQuantity > 0 ? product.gstCost / product.totalQuantity : 0)
                        : formatMoney(product.gstCost)}
                    </div>
                    <div className="text-[10px] text-slate-400">{formatPercent((product.gstCost / product.totalRevenue) * 100)}</div>
                  </>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-right bg-purple-50/30 whitespace-nowrap">
                {product.replacementCount > 0 ? (
                  <span className="text-purple-600 font-medium">{product.replacementCount}</span>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-right bg-purple-50/30 whitespace-nowrap">
                {product.mscfCount > 0 ? (
                  <span className="text-purple-600 font-medium">{product.mscfCount}</span>
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
