/**
 * ProfitabilityDetailsTable - Details table for profitability analysis
 * Displays SKU, Product, Parent, and Category level profitability data
 */

import React, { useRef } from 'react';
import { Tag } from 'lucide-react';
import { formatPercent } from '../../utils/formatters';
import { useProfitabilityFilters } from '../../contexts/ProfitabilityFilterContext';
import { SortableHeader } from '../shared/SortableHeader';
import type { SelectedItemType } from './PieChartModal';
import type {
  SKUProfitAnalysis,
  ProductProfitAnalysis,
  ParentProfitAnalysis,
  CategoryProfitAnalysis,
} from '../../services/profitability/profitabilityAnalytics';

interface ProfitabilityDetailsTableProps {
  displaySkus: SKUProfitAnalysis[];
  displayProducts: ProductProfitAnalysis[];
  displayParents: ParentProfitAnalysis[];
  displayCategories: CategoryProfitAnalysis[];
  categoryNames: string[];
  parentNames: string[];
  productNames: string[];
  formatMoney: (amount: number) => string;
  onSelectItem: (item: SelectedItemType | null) => void;
}

export const ProfitabilityDetailsTable: React.FC<ProfitabilityDetailsTableProps> = ({
  displaySkus,
  displayProducts,
  displayParents,
  displayCategories,
  categoryNames,
  parentNames,
  productNames,
  formatMoney,
  onSelectItem,
}) => {
  // Get filter state from context
  const {
    filterCategory,
    filterParent,
    filterName,
    detailsViewMode,
    showPerUnit,
    sortColumn,
    sortDirection,
    currentPage,
    itemsPerPage,
    setFilterCategory,
    setFilterParent,
    setFilterName,
    setDetailsViewMode,
    setShowPerUnit,
    setCurrentPage,
    handleSort,
  } = useProfitabilityFilters();

  // Drag-to-scroll state using ref (not state to avoid re-renders)
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({ isDragging: false, startX: 0, scrollLeft: 0 });

  // Drag-to-scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tableContainerRef.current) return;
    dragStateRef.current = {
      isDragging: true,
      startX: e.pageX - tableContainerRef.current.offsetLeft,
      scrollLeft: tableContainerRef.current.scrollLeft,
    };
    tableContainerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseUp = () => {
    if (!tableContainerRef.current) return;
    dragStateRef.current.isDragging = false;
    tableContainerRef.current.style.cursor = 'grab';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStateRef.current.isDragging || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - dragStateRef.current.startX) * 1.5;
    tableContainerRef.current.scrollLeft = dragStateRef.current.scrollLeft - walk;
  };

  const handleMouseLeave = () => {
    if (!tableContainerRef.current) return;
    dragStateRef.current.isDragging = false;
    tableContainerRef.current.style.cursor = 'grab';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            Details
          </h2>
          {/* Toplam / Birim Toggle - Sadece SKU ve Name için */}
          {(detailsViewMode === 'sku' || detailsViewMode === 'name') && (
            <div className="inline-flex items-center rounded-full bg-slate-100 p-0.5 text-xs">
              <button
                onClick={() => setShowPerUnit(false)}
                className={`px-3 py-1 rounded-full font-medium transition-all ${
                  !showPerUnit
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Toplam
              </button>
              <button
                onClick={() => setShowPerUnit(true)}
                className={`px-3 py-1 rounded-full font-medium transition-all ${
                  showPerUnit
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Birim
              </button>
            </div>
          )}
        </div>
        {/* SKU/Name/Parent/Category Segmented Control - Bottom-up hierarchy */}
        <div className="inline-flex rounded-lg border border-slate-300 p-1 bg-slate-50">
          <button
            onClick={() => setDetailsViewMode('sku')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              detailsViewMode === 'sku'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            SKU
          </button>
          <button
            onClick={() => setDetailsViewMode('name')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              detailsViewMode === 'name'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Product
          </button>
          <button
            onClick={() => setDetailsViewMode('parent')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              detailsViewMode === 'parent'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Parent
          </button>
          <button
            onClick={() => setDetailsViewMode('category')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              detailsViewMode === 'category'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Category
          </button>
        </div>
      </div>

      {/* Filter dropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All Categories</option>
            {categoryNames.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Parent ASIN</label>
          <select
            value={filterParent}
            onChange={(e) => setFilterParent(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All Parents</option>
            {parentNames.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
          <select
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All Products</option>
            {productNames.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Header showing count */}
      <div className="text-sm font-semibold text-slate-700 mb-3">
        {detailsViewMode === 'sku'
          ? `${displaySkus.length} SKUs`
          : detailsViewMode === 'name'
          ? `${displayProducts.length} products`
          : detailsViewMode === 'parent'
          ? `${displayParents.length} parents`
          : `${displayCategories.length} categories`}
      </div>

      {/* Table with Drag-to-Scroll */}
      <div
        ref={tableContainerRef}
        className="overflow-x-auto overflow-y-auto max-h-[600px] border border-slate-200 rounded-lg cursor-grab select-none"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {detailsViewMode === 'sku' ? (
          <SKUTable
            displaySkus={displaySkus}
            showPerUnit={showPerUnit}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            formatMoney={formatMoney}
            onSort={handleSort}
            onSelectItem={onSelectItem}
          />
        ) : detailsViewMode === 'category' ? (
          <CategoryTable
            displayCategories={displayCategories}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            formatMoney={formatMoney}
            onSort={handleSort}
            onSelectItem={onSelectItem}
          />
        ) : detailsViewMode === 'parent' ? (
          <ParentTable
            displayParents={displayParents}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            formatMoney={formatMoney}
            onSort={handleSort}
            onSelectItem={onSelectItem}
          />
        ) : (
          <ProductTable
            displayProducts={displayProducts}
            showPerUnit={showPerUnit}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            formatMoney={formatMoney}
            onSort={handleSort}
            onSelectItem={onSelectItem}
          />
        )}
      </div>

      {/* Pagination Controls - for SKU and Product views */}
      {((detailsViewMode === 'sku' && displaySkus.length > itemsPerPage) ||
        (detailsViewMode === 'name' && displayProducts.length > itemsPerPage)) && (
        <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
          <div className="text-sm text-slate-600">
            {detailsViewMode === 'sku' ? (
              <>Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, displaySkus.length)} of {displaySkus.length} SKUs</>
            ) : (
              <>Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, displayProducts.length)} of {displayProducts.length} products</>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Page {currentPage} of {Math.ceil((detailsViewMode === 'sku' ? displaySkus.length : displayProducts.length) / itemsPerPage)}
            </span>
            <button
              onClick={() => {
                const totalItems = detailsViewMode === 'sku' ? displaySkus.length : displayProducts.length;
                setCurrentPage(Math.min(Math.ceil(totalItems / itemsPerPage), currentPage + 1));
              }}
              disabled={currentPage >= Math.ceil((detailsViewMode === 'sku' ? displaySkus.length : displayProducts.length) / itemsPerPage)}
              className="px-3 py-1 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// SKU TABLE SUB-COMPONENT
// ============================================
interface SKUTableProps {
  displaySkus: SKUProfitAnalysis[];
  showPerUnit: boolean;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  itemsPerPage: number;
  formatMoney: (amount: number) => string;
  onSort: (column: string) => void;
  onSelectItem: (item: SelectedItemType | null) => void;
}

const SKUTable: React.FC<SKUTableProps> = ({
  displaySkus,
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
          <SortableHeader column="sku" label="SKU" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} color="green" className="sticky left-0 bg-slate-50 z-30 min-w-[150px] border-r border-slate-200" />
          <SortableHeader column="name" label="Name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} color="green" className="min-w-[200px]" />
          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">FF</th>
          <SortableHeader column="totalRevenue" label="Revenue" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" />
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
          <SortableHeader column="gstCost" label="GST" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-orange-50 border-r border-slate-200" />
          <SortableHeader column="netProfit" label="Net Profit" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-green-50" />
          <SortableHeader column="profitMargin" label="Margin" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="green" className="bg-green-50" />
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-slate-100">
        {displaySkus
          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
          .map(sku => (
          <tr
            key={sku.sku}
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
            <td className="px-3 py-2 text-center border-r border-slate-100">
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
            <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
              {showPerUnit
                ? formatMoney(sku.avgSalePrice)
                : formatMoney(sku.totalRevenue)}
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
            <td className="px-3 py-2 text-right bg-orange-50/30 border-r border-slate-100 whitespace-nowrap">
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
            <td className={`px-3 py-2 text-right font-bold bg-green-50/30 whitespace-nowrap ${sku.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {showPerUnit
                ? formatMoney(sku.totalQuantity > 0 ? sku.netProfit / sku.totalQuantity : 0)
                : formatMoney(sku.netProfit)}
            </td>
            <td className={`px-3 py-2 text-right font-medium bg-green-50/30 whitespace-nowrap ${sku.profitMargin >= 10 ? 'text-green-600' : sku.profitMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
              {formatPercent(sku.profitMargin)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ============================================
// CATEGORY TABLE SUB-COMPONENT
// ============================================
interface CategoryTableProps {
  displayCategories: CategoryProfitAnalysis[];
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  formatMoney: (amount: number) => string;
  onSort: (column: string) => void;
  onSelectItem: (item: SelectedItemType | null) => void;
}

const CategoryTable: React.FC<CategoryTableProps> = ({
  displayCategories,
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
          <SortableHeader column="category" label="Category" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} color="amber" className="sticky left-0 bg-slate-50 z-30 min-w-[200px] border-r border-slate-200" />
          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">#Parents</th>
          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">#Products</th>
          <SortableHeader column="totalRevenue" label="Revenue" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" />
          <SortableHeader column="totalOrders" label="Orders" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" />
          <SortableHeader column="totalQuantity" label="Qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="border-r border-slate-200" />
          <SortableHeader column="sellingFees" label="Selling" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-red-50" />
          <SortableHeader column="fbaFees" label="FBA Fee" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-red-50" />
          <SortableHeader column="refundLoss" label="Refund" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-red-50" />
          <SortableHeader column="vat" label="VAT" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-red-50 border-r border-slate-200" />
          <SortableHeader column="advertisingCost" label="Ads" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-pink-50" />
          <SortableHeader column="fbaCost" label="FBA Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-indigo-50" />
          <SortableHeader column="fbmCost" label="FBM Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-cyan-50 border-r border-slate-200" />
          <SortableHeader column="totalProductCost" label="Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" />
          <SortableHeader column="shippingCost" label="Ship" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="border-r border-slate-200" />
          <SortableHeader column="netProfit" label="Net Profit" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-green-50" />
          <SortableHeader column="profitMargin" label="Margin" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="amber" className="bg-green-50" />
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-slate-100">
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
            <td className="px-3 py-2 text-right text-slate-600">{cat.totalOrders}</td>
            <td className="px-3 py-2 text-right text-slate-600 border-r border-slate-100">{cat.totalQuantity}</td>
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
            <td className="px-3 py-2 text-right border-r border-slate-100 whitespace-nowrap">
              <div className="text-slate-800 font-medium">{formatMoney(cat.shippingCost)}</div>
              <div className="text-[10px] text-slate-400">{formatPercent(cat.shippingCostPercent)}</div>
            </td>
            <td className={`px-3 py-2 text-right font-bold bg-green-50/30 whitespace-nowrap ${cat.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatMoney(cat.netProfit)}
            </td>
            <td className={`px-3 py-2 text-right font-medium bg-green-50/30 whitespace-nowrap ${cat.profitMargin >= 10 ? 'text-green-600' : cat.profitMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
              {formatPercent(cat.profitMargin)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ============================================
// PARENT TABLE SUB-COMPONENT
// ============================================
interface ParentTableProps {
  displayParents: ParentProfitAnalysis[];
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  formatMoney: (amount: number) => string;
  onSort: (column: string) => void;
  onSelectItem: (item: SelectedItemType | null) => void;
}

const ParentTable: React.FC<ParentTableProps> = ({
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
          <SortableHeader column="totalOrders" label="Orders" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" />
          <SortableHeader column="totalQuantity" label="Qty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="border-r border-slate-200" />
          <SortableHeader column="sellingFees" label="Selling" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-red-50" />
          <SortableHeader column="fbaFees" label="FBA Fee" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-red-50" />
          <SortableHeader column="refundLoss" label="Refund" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-red-50" />
          <SortableHeader column="vat" label="VAT" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-red-50 border-r border-slate-200" />
          <SortableHeader column="advertisingCost" label="Ads" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-pink-50" />
          <SortableHeader column="fbaCost" label="FBA Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-indigo-50" />
          <SortableHeader column="fbmCost" label="FBM Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-cyan-50 border-r border-slate-200" />
          <SortableHeader column="totalProductCost" label="Cost" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" />
          <SortableHeader column="shippingCost" label="Ship" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="border-r border-slate-200" />
          <SortableHeader column="netProfit" label="Net Profit" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-green-50" />
          <SortableHeader column="profitMargin" label="Margin" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="purple" className="bg-green-50" />
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
            <td className="px-3 py-2 text-right text-slate-600">{par.totalOrders}</td>
            <td className="px-3 py-2 text-right text-slate-600 border-r border-slate-100">{par.totalQuantity}</td>
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
              <div className="text-[10px] par.text-slate-400">{formatMoney(par.refundLoss)}</div>
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
            <td className="px-3 py-2 text-right border-r border-slate-100 whitespace-nowrap">
              <div className="text-slate-800 font-medium">{formatMoney(par.shippingCost)}</div>
              <div className="text-[10px] text-slate-400">{formatPercent(par.shippingCostPercent)}</div>
            </td>
            <td className={`px-3 py-2 text-right font-bold bg-green-50/30 whitespace-nowrap ${par.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatMoney(par.netProfit)}
            </td>
            <td className={`px-3 py-2 text-right font-medium bg-green-50/30 whitespace-nowrap ${par.profitMargin >= 10 ? 'text-green-600' : par.profitMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
              {formatPercent(par.profitMargin)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ============================================
// PRODUCT TABLE SUB-COMPONENT
// ============================================
interface ProductTableProps {
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

const ProductTable: React.FC<ProductTableProps> = ({
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
          <SortableHeader column="name" label="Product Name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} color="blue" className="sticky left-0 bg-slate-50 z-30 min-w-[200px] border-r border-slate-200" />
          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">FF</th>
          <SortableHeader column="totalRevenue" label="Revenue" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" />
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
          <SortableHeader column="gstCost" label="GST" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-orange-50 border-r border-slate-200" />
          <SortableHeader column="netProfit" label="Net Profit" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-green-50" />
          <SortableHeader column="profitMargin" label="Margin" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" color="blue" className="bg-green-50" />
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
                className="px-3 py-2 text-left sticky left-0 bg-white z-10 min-w-[200px] border-r border-slate-200 cursor-pointer hover:bg-blue-50"
                onClick={() => onSelectItem({ type: 'product', data: product })}
              >
                <div className="font-medium text-blue-600 text-xs truncate max-w-[200px]" title={product.name}>{product.name}</div>
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
              <td className="px-3 py-2 text-right bg-orange-50/30 border-r border-slate-100 whitespace-nowrap">
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
              <td className={`px-3 py-2 text-right font-bold bg-green-50/30 whitespace-nowrap ${product.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {showPerUnit
                  ? formatMoney(product.totalQuantity > 0 ? product.netProfit / product.totalQuantity : 0)
                  : formatMoney(product.netProfit)}
              </td>
              <td className={`px-3 py-2 text-right font-medium bg-green-50/30 whitespace-nowrap ${product.profitMargin >= 10 ? 'text-green-600' : product.profitMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                {formatPercent(product.profitMargin)}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
};

export default React.memo(ProfitabilityDetailsTable);
