/**
 * ProfitabilityDetailsTable - Details table for profitability analysis
 * Displays SKU, Product, Parent, and Category level profitability data
 */

import React, { useRef } from 'react';
import { Tag } from 'lucide-react';
import { formatPercent } from '../../utils/formatters';
import { useProfitabilityFilters } from '../../contexts/ProfitabilityFilterContext';
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
  const SortIndicator = ({ column }: { column: string }) => (
    sortColumn === column ? (
      <span className="text-green-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
    ) : null
  );

  return (
    <table className="w-full min-w-max divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50 sticky top-0 z-20">
        <tr>
          <th
            className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky left-0 bg-slate-50 z-30 cursor-pointer hover:bg-slate-100 min-w-[150px] border-r border-slate-200"
            onClick={() => onSort('sku')}
          >
            <div className="flex items-center gap-1">
              SKU
              <SortIndicator column="sku" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-left text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap min-w-[200px]"
            onClick={() => onSort('name')}
          >
            <div className="flex items-center gap-1">
              Name
              <SortIndicator column="name" />
            </div>
          </th>
          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">FF</th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('totalRevenue')}
          >
            <div className="flex items-center justify-end gap-1">
              Revenue
              <SortIndicator column="totalRevenue" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('totalOrders')}
          >
            <div className="flex items-center justify-end gap-1">
              Orders
              <SortIndicator column="totalOrders" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('totalQuantity')}
          >
            <div className="flex items-center justify-end gap-1">
              Qty
              <SortIndicator column="totalQuantity" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('refundedQuantity')}
            title="Refunded Quantity"
          >
            <div className="flex items-center justify-end gap-1">
              RQty
              <SortIndicator column="refundedQuantity" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
            onClick={() => onSort('sellingFees')}
          >
            <div className="flex items-center justify-end gap-1">
              Selling
              <SortIndicator column="sellingFees" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
            onClick={() => onSort('fbaFees')}
          >
            <div className="flex items-center justify-end gap-1">
              FBA Fee
              <SortIndicator column="fbaFees" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
            onClick={() => onSort('refundLoss')}
          >
            <div className="flex items-center justify-end gap-1">
              Refund
              <SortIndicator column="refundLoss" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('vat')}
            title="VAT (EU marketplaces)"
          >
            <div className="flex items-center justify-end gap-1">
              VAT
              <SortIndicator column="vat" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-pink-700 bg-pink-50 cursor-pointer hover:bg-pink-100 whitespace-nowrap"
            onClick={() => onSort('advertisingCost')}
          >
            <div className="flex items-center justify-end gap-1">
              Ads
              <SortIndicator column="advertisingCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-indigo-700 bg-indigo-50 cursor-pointer hover:bg-indigo-100 whitespace-nowrap"
            onClick={() => onSort('fbaCost')}
          >
            <div className="flex items-center justify-end gap-1">
              FBA Cost
              <SortIndicator column="fbaCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-cyan-700 bg-cyan-50 cursor-pointer hover:bg-cyan-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('fbmCost')}
          >
            <div className="flex items-center justify-end gap-1">
              FBM Cost
              <SortIndicator column="fbmCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('productCost')}
          >
            <div className="flex items-center justify-end gap-1">
              Cost
              <SortIndicator column="productCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('shippingCost')}
          >
            <div className="flex items-center justify-end gap-1">
              Ship
              <SortIndicator column="shippingCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 cursor-pointer hover:bg-amber-100 whitespace-nowrap"
            onClick={() => onSort('customsDuty')}
            title="Gümrük Vergisi (FBM-TR)"
          >
            <div className="flex items-center justify-end gap-1">
              Customs
              <SortIndicator column="customsDuty" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 cursor-pointer hover:bg-amber-100 whitespace-nowrap"
            onClick={() => onSort('ddpFee')}
            title="DDP Ücreti (FBM-TR)"
          >
            <div className="flex items-center justify-end gap-1">
              DDP
              <SortIndicator column="ddpFee" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 cursor-pointer hover:bg-amber-100 whitespace-nowrap"
            onClick={() => onSort('warehouseCost')}
            title="Depo+İşçilik (FBA veya FBM-Local)"
          >
            <div className="flex items-center justify-end gap-1">
              Warehouse
              <SortIndicator column="warehouseCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-orange-700 bg-orange-50 cursor-pointer hover:bg-orange-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('gstCost')}
            title="GST/VAT (AU vb.)"
          >
            <div className="flex items-center justify-end gap-1">
              GST
              <SortIndicator column="gstCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 cursor-pointer hover:bg-green-100 whitespace-nowrap"
            onClick={() => onSort('netProfit')}
          >
            <div className="flex items-center justify-end gap-1">
              Net Profit
              <SortIndicator column="netProfit" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 cursor-pointer hover:bg-green-100 whitespace-nowrap"
            onClick={() => onSort('profitMargin')}
          >
            <div className="flex items-center justify-end gap-1">
              Margin
              <SortIndicator column="profitMargin" />
            </div>
          </th>
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
  const SortIndicator = ({ column }: { column: string }) => (
    sortColumn === column ? (
      <span className="text-amber-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
    ) : null
  );

  return (
    <table className="w-full min-w-max divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50 sticky top-0 z-20">
        <tr>
          <th
            className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky left-0 bg-slate-50 z-30 cursor-pointer hover:bg-slate-100 min-w-[200px] border-r border-slate-200"
            onClick={() => onSort('category')}
          >
            <div className="flex items-center gap-1">
              Category
              <SortIndicator column="category" />
            </div>
          </th>
          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">#Parents</th>
          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">#Products</th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('totalRevenue')}
          >
            <div className="flex items-center justify-end gap-1">
              Revenue
              <SortIndicator column="totalRevenue" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('totalOrders')}
          >
            <div className="flex items-center justify-end gap-1">
              Orders
              <SortIndicator column="totalOrders" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('totalQuantity')}
          >
            <div className="flex items-center justify-end gap-1">
              Qty
              <SortIndicator column="totalQuantity" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
            onClick={() => onSort('sellingFees')}
          >
            <div className="flex items-center justify-end gap-1">
              Selling
              <SortIndicator column="sellingFees" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
            onClick={() => onSort('fbaFees')}
          >
            <div className="flex items-center justify-end gap-1">
              FBA Fee
              <SortIndicator column="fbaFees" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
            onClick={() => onSort('refundLoss')}
          >
            <div className="flex items-center justify-end gap-1">
              Refund
              <SortIndicator column="refundLoss" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('vat')}
          >
            <div className="flex items-center justify-end gap-1">
              VAT
              <SortIndicator column="vat" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-pink-700 bg-pink-50 cursor-pointer hover:bg-pink-100 whitespace-nowrap"
            onClick={() => onSort('advertisingCost')}
          >
            <div className="flex items-center justify-end gap-1">
              Ads
              <SortIndicator column="advertisingCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-indigo-700 bg-indigo-50 cursor-pointer hover:bg-indigo-100 whitespace-nowrap"
            onClick={() => onSort('fbaCost')}
          >
            <div className="flex items-center justify-end gap-1">
              FBA Cost
              <SortIndicator column="fbaCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-cyan-700 bg-cyan-50 cursor-pointer hover:bg-cyan-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('fbmCost')}
          >
            <div className="flex items-center justify-end gap-1">
              FBM Cost
              <SortIndicator column="fbmCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('totalProductCost')}
          >
            <div className="flex items-center justify-end gap-1">
              Cost
              <SortIndicator column="totalProductCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('shippingCost')}
          >
            <div className="flex items-center justify-end gap-1">
              Ship
              <SortIndicator column="shippingCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 cursor-pointer hover:bg-green-100 whitespace-nowrap"
            onClick={() => onSort('netProfit')}
          >
            <div className="flex items-center justify-end gap-1">
              Net Profit
              <SortIndicator column="netProfit" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 cursor-pointer hover:bg-green-100 whitespace-nowrap"
            onClick={() => onSort('profitMargin')}
          >
            <div className="flex items-center justify-end gap-1">
              Margin
              <SortIndicator column="profitMargin" />
            </div>
          </th>
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
  const SortIndicator = ({ column }: { column: string }) => (
    sortColumn === column ? (
      <span className="text-purple-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
    ) : null
  );

  return (
    <table className="w-full min-w-max divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50 sticky top-0 z-20">
        <tr>
          <th
            className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky left-0 bg-slate-50 z-30 cursor-pointer hover:bg-slate-100 min-w-[150px] border-r border-slate-200"
            onClick={() => onSort('parent')}
          >
            <div className="flex items-center gap-1">
              Parent ASIN
              <SortIndicator column="parent" />
            </div>
          </th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Category</th>
          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">#Products</th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('totalRevenue')}
          >
            <div className="flex items-center justify-end gap-1">
              Revenue
              <SortIndicator column="totalRevenue" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('totalOrders')}
          >
            <div className="flex items-center justify-end gap-1">
              Orders
              <SortIndicator column="totalOrders" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('totalQuantity')}
          >
            <div className="flex items-center justify-end gap-1">
              Qty
              <SortIndicator column="totalQuantity" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
            onClick={() => onSort('sellingFees')}
          >
            <div className="flex items-center justify-end gap-1">
              Selling
              <SortIndicator column="sellingFees" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
            onClick={() => onSort('fbaFees')}
          >
            <div className="flex items-center justify-end gap-1">
              FBA Fee
              <SortIndicator column="fbaFees" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
            onClick={() => onSort('refundLoss')}
          >
            <div className="flex items-center justify-end gap-1">
              Refund
              <SortIndicator column="refundLoss" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('vat')}
          >
            <div className="flex items-center justify-end gap-1">
              VAT
              <SortIndicator column="vat" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-pink-700 bg-pink-50 cursor-pointer hover:bg-pink-100 whitespace-nowrap"
            onClick={() => onSort('advertisingCost')}
          >
            <div className="flex items-center justify-end gap-1">
              Ads
              <SortIndicator column="advertisingCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-indigo-700 bg-indigo-50 cursor-pointer hover:bg-indigo-100 whitespace-nowrap"
            onClick={() => onSort('fbaCost')}
          >
            <div className="flex items-center justify-end gap-1">
              FBA Cost
              <SortIndicator column="fbaCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-cyan-700 bg-cyan-50 cursor-pointer hover:bg-cyan-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('fbmCost')}
          >
            <div className="flex items-center justify-end gap-1">
              FBM Cost
              <SortIndicator column="fbmCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('totalProductCost')}
          >
            <div className="flex items-center justify-end gap-1">
              Cost
              <SortIndicator column="totalProductCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('shippingCost')}
          >
            <div className="flex items-center justify-end gap-1">
              Ship
              <SortIndicator column="shippingCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 cursor-pointer hover:bg-green-100 whitespace-nowrap"
            onClick={() => onSort('netProfit')}
          >
            <div className="flex items-center justify-end gap-1">
              Net Profit
              <SortIndicator column="netProfit" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 cursor-pointer hover:bg-green-100 whitespace-nowrap"
            onClick={() => onSort('profitMargin')}
          >
            <div className="flex items-center justify-end gap-1">
              Margin
              <SortIndicator column="profitMargin" />
            </div>
          </th>
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
  const SortIndicator = ({ column }: { column: string }) => (
    sortColumn === column ? (
      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
    ) : null
  );

  return (
    <table className="w-full min-w-max divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50 sticky top-0 z-20">
        <tr>
          <th
            className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky left-0 bg-slate-50 z-30 cursor-pointer hover:bg-slate-100 min-w-[200px] border-r border-slate-200"
            onClick={() => onSort('name')}
          >
            <div className="flex items-center gap-1">
              Product Name
              <SortIndicator column="name" />
            </div>
          </th>
          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">FF</th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('totalRevenue')}
          >
            <div className="flex items-center justify-end gap-1">
              Revenue
              <SortIndicator column="totalRevenue" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('totalOrders')}
          >
            <div className="flex items-center justify-end gap-1">
              Orders
              <SortIndicator column="totalOrders" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('totalQuantity')}
          >
            <div className="flex items-center justify-end gap-1">
              Qty
              <SortIndicator column="totalQuantity" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('refundedQuantity')}
            title="Refunded Quantity"
          >
            <div className="flex items-center justify-end gap-1">
              RQty
              <SortIndicator column="refundedQuantity" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
            onClick={() => onSort('sellingFees')}
          >
            <div className="flex items-center justify-end gap-1">
              Selling
              <SortIndicator column="sellingFees" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
            onClick={() => onSort('fbaFees')}
          >
            <div className="flex items-center justify-end gap-1">
              FBA Fee
              <SortIndicator column="fbaFees" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
            onClick={() => onSort('refundLoss')}
          >
            <div className="flex items-center justify-end gap-1">
              Refund
              <SortIndicator column="refundLoss" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('vat')}
            title="VAT (EU marketplaces)"
          >
            <div className="flex items-center justify-end gap-1">
              VAT
              <SortIndicator column="vat" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-pink-700 bg-pink-50 cursor-pointer hover:bg-pink-100 whitespace-nowrap"
            onClick={() => onSort('advertisingCost')}
          >
            <div className="flex items-center justify-end gap-1">
              Ads
              <SortIndicator column="advertisingCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-indigo-700 bg-indigo-50 cursor-pointer hover:bg-indigo-100 whitespace-nowrap"
            onClick={() => onSort('fbaCost')}
          >
            <div className="flex items-center justify-end gap-1">
              FBA Cost
              <SortIndicator column="fbaCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-cyan-700 bg-cyan-50 cursor-pointer hover:bg-cyan-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('fbmCost')}
          >
            <div className="flex items-center justify-end gap-1">
              FBM Cost
              <SortIndicator column="fbmCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('productCost')}
          >
            <div className="flex items-center justify-end gap-1">
              Cost
              <SortIndicator column="productCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
            onClick={() => onSort('shippingCost')}
          >
            <div className="flex items-center justify-end gap-1">
              Ship
              <SortIndicator column="shippingCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 cursor-pointer hover:bg-amber-100 whitespace-nowrap"
            onClick={() => onSort('customsDuty')}
            title="Gümrük Vergisi (FBM-TR)"
          >
            <div className="flex items-center justify-end gap-1">
              Customs
              <SortIndicator column="customsDuty" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 cursor-pointer hover:bg-amber-100 whitespace-nowrap"
            onClick={() => onSort('ddpFee')}
            title="DDP Ücreti (FBM-TR)"
          >
            <div className="flex items-center justify-end gap-1">
              DDP
              <SortIndicator column="ddpFee" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 cursor-pointer hover:bg-amber-100 whitespace-nowrap"
            onClick={() => onSort('warehouseCost')}
            title="Depo+İşçilik (FBA veya FBM-Local)"
          >
            <div className="flex items-center justify-end gap-1">
              Warehouse
              <SortIndicator column="warehouseCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-orange-700 bg-orange-50 cursor-pointer hover:bg-orange-100 whitespace-nowrap border-r border-slate-200"
            onClick={() => onSort('gstCost')}
            title="GST/VAT (AU vb.)"
          >
            <div className="flex items-center justify-end gap-1">
              GST
              <SortIndicator column="gstCost" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 cursor-pointer hover:bg-green-100 whitespace-nowrap"
            onClick={() => onSort('netProfit')}
          >
            <div className="flex items-center justify-end gap-1">
              Net Profit
              <SortIndicator column="netProfit" />
            </div>
          </th>
          <th
            className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 cursor-pointer hover:bg-green-100 whitespace-nowrap"
            onClick={() => onSort('profitMargin')}
          >
            <div className="flex items-center justify-end gap-1">
              Margin
              <SortIndicator column="profitMargin" />
            </div>
          </th>
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
