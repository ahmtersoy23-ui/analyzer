/**
 * ProfitabilityDetailsTable - Details table for profitability analysis
 * Displays SKU, Product, Parent, and Category level profitability data
 */

import React, { useRef, useCallback, useState } from 'react';
import { Tag, Download, ChevronRight, Package, Filter, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useProfitabilityFilters } from '../../contexts/ProfitabilityFilterContext';
import type { SelectedItemType } from './PieChartModal';
import type {
  SKUProfitAnalysis,
  ProductProfitAnalysis,
  ParentProfitAnalysis,
  CategoryProfitAnalysis,
} from '../../services/profitability/profitabilityAnalytics';

// Import table sub-components
import { SKUTable, CategoryTable, ParentTable, ProductTable } from './tables';

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
  isAdmin?: boolean;
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
  isAdmin = false,
}) => {
  // Get filter state from context
  const {
    startDate,
    endDate,
    filterMarketplace,
    filterFulfillment,
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
    columnFilters,
    setColumnFilter,
    activeFilterCount,
    clearAllColumnFilters,
  } = useProfitabilityFilters();

  // Collapse state
  const [isExpanded, setIsExpanded] = useState(true);

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

  // Generate filename based on filters
  const generateFileName = useCallback(() => {
    const parts = ['Faz3', 'Details'];

    // Add view mode
    const viewModeLabels: Record<string, string> = {
      'sku': 'SKU',
      'name': 'Product',
      'parent': 'Parent',
      'category': 'Category'
    };
    parts.push(viewModeLabels[detailsViewMode] || detailsViewMode);

    // Add filters
    if (filterMarketplace !== 'all') parts.push(filterMarketplace);
    if (filterFulfillment !== 'all') parts.push(filterFulfillment);
    if (startDate) parts.push(startDate.replace(/-/g, ''));
    if (endDate) parts.push(endDate.replace(/-/g, ''));

    return parts.join('_') + '.xlsx';
  }, [detailsViewMode, filterMarketplace, filterFulfillment, startDate, endDate]);

  // Export to Excel
  const handleExportExcel = useCallback(() => {
    let data: Record<string, unknown>[] = [];
    let sheetName = 'Data';

    if (detailsViewMode === 'sku') {
      sheetName = 'SKUs';
      data = displaySkus.map(sku => ({
        'SKU': sku.sku,
        'Name': sku.name,
        'Category': sku.category,
        'Fulfillment': sku.fulfillment,
        'Revenue': sku.totalRevenue,
        'Net Profit': sku.netProfit,
        'Margin %': sku.profitMargin,
        'Orders': sku.totalOrders,
        'Quantity': sku.totalQuantity,
        'Refunded Qty': sku.refundedQuantity,
        'Selling Fee': sku.sellingFees,
        'Selling Fee %': sku.sellingFeePercent,
        'FBA Fee': sku.fbaFees,
        'FBA Fee %': sku.fbaFeePercent,
        'Refund Loss': sku.refundLoss,
        'Refund Loss %': sku.refundLossPercent,
        'VAT': sku.vat,
        'VAT %': sku.vatPercent,
        'Ads': sku.advertisingCost,
        'Ads %': sku.advertisingPercent,
        'FBA Cost': sku.fbaCost,
        'FBA Cost %': sku.fbaCostPercent,
        'FBM Cost': sku.fbmCost,
        'FBM Cost %': sku.fbmCostPercent,
        'Product Cost': sku.totalProductCost,
        'Product Cost %': sku.productCostPercent,
        'Shipping Cost': sku.shippingCost,
        'Shipping Cost %': sku.shippingCostPercent,
      }));
    } else if (detailsViewMode === 'name') {
      sheetName = 'Products';
      data = displayProducts.map(p => ({
        'Name': p.name,
        'Category': p.category,
        'Fulfillment': p.fulfillment,
        'Revenue': p.totalRevenue,
        'Net Profit': p.netProfit,
        'Margin %': p.profitMargin,
        'Orders': p.totalOrders,
        'Quantity': p.totalQuantity,
        'Refunded Qty': p.refundedQuantity,
        'Selling Fee': p.sellingFees,
        'Selling Fee %': p.sellingFeePercent,
        'FBA Fee': p.fbaFees,
        'FBA Fee %': p.fbaFeePercent,
        'Refund Loss': p.refundLoss,
        'Refund Loss %': p.refundLossPercent,
        'VAT': p.vat,
        'VAT %': p.vatPercent,
        'Ads': p.advertisingCost,
        'Ads %': p.advertisingPercent,
        'FBA Cost': p.fbaCost,
        'FBA Cost %': p.fbaCostPercent,
        'FBM Cost': p.fbmCost,
        'FBM Cost %': p.fbmCostPercent,
        'Product Cost': p.totalProductCost,
        'Product Cost %': p.productCostPercent,
        'Shipping Cost': p.shippingCost,
        'Shipping Cost %': p.shippingCostPercent,
      }));
    } else if (detailsViewMode === 'parent') {
      sheetName = 'Parents';
      data = displayParents.map(par => ({
        'Parent ASIN': par.parent,
        'Category': par.category,
        'Products': par.totalProducts,
        'Revenue': par.totalRevenue,
        'Net Profit': par.netProfit,
        'Margin %': par.profitMargin,
        'Orders': par.totalOrders,
        'Quantity': par.totalQuantity,
        'Selling Fee': par.sellingFees,
        'FBA Fee': par.fbaFees,
        'Refund Loss': par.refundLoss,
        'VAT': par.vat,
        'Ads': par.advertisingCost,
        'FBA Cost': par.fbaCost,
        'FBM Cost': par.fbmCost,
        'Product Cost': par.totalProductCost,
        'Shipping Cost': par.shippingCost,
      }));
    } else {
      sheetName = 'Categories';
      data = displayCategories.map(cat => ({
        'Category': cat.category,
        'Parents': cat.totalParents,
        'Products': cat.totalProducts,
        'Revenue': cat.totalRevenue,
        'Net Profit': cat.netProfit,
        'Margin %': cat.profitMargin,
        'Orders': cat.totalOrders,
        'Quantity': cat.totalQuantity,
        'Selling Fee': cat.sellingFees,
        'FBA Fee': cat.fbaFees,
        'Refund Loss': cat.refundLoss,
        'VAT': cat.vat,
        'Ads': cat.advertisingCost,
        'FBA Cost': cat.fbaCost,
        'FBM Cost': cat.fbmCost,
        'Product Cost': cat.totalProductCost,
        'Shipping Cost': cat.shippingCost,
      }));
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, generateFileName());
  }, [detailsViewMode, displaySkus, displayProducts, displayParents, displayCategories, generateFileName]);

  // Get item count for collapsed summary
  const getItemCount = () => {
    switch (detailsViewMode) {
      case 'sku': return displaySkus.length;
      case 'name': return displayProducts.length;
      case 'parent': return displayParents.length;
      case 'category': return displayCategories.length;
      default: return 0;
    }
  };

  const viewModeLabels: Record<string, string> = {
    'sku': 'SKUs',
    'name': 'Products',
    'parent': 'Parents',
    'category': 'Categories'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      {/* Collapsible Header */}
      <div
        className="flex items-center justify-between cursor-pointer hover:bg-slate-50 -mx-6 -mt-6 px-6 py-4 rounded-t-xl transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Tag className="w-5 h-5 text-indigo-600" />
          Details
          <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </h2>
        <div className="flex items-center gap-4">
          {/* Filter Info Display */}
          <div className="text-sm text-slate-600">
            {filterMarketplace !== 'all' && <span className="font-medium">{filterMarketplace}</span>}
            {filterMarketplace !== 'all' && (startDate || endDate || filterFulfillment !== 'all') && <span className="mx-2">•</span>}
            {(startDate || endDate) && (
              <span>
                {startDate && new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {startDate && endDate && ' - '}
                {endDate && new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            {(startDate || endDate) && filterFulfillment !== 'all' && <span className="mx-2">•</span>}
            {filterFulfillment !== 'all' && <span className="font-medium">{filterFulfillment}</span>}
            {filterMarketplace === 'all' && !startDate && !endDate && filterFulfillment === 'all' && (
              <span className="text-slate-400">All data</span>
            )}
          </div>
          {/* Summary when collapsed */}
          {!isExpanded && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600">{getItemCount()} {viewModeLabels[detailsViewMode]}</span>
              <span className={`font-medium ${
                detailsViewMode === 'sku' ? 'text-green-600' :
                detailsViewMode === 'name' ? 'text-blue-600' :
                detailsViewMode === 'parent' ? 'text-purple-600' : 'text-amber-600'
              }`}>{viewModeLabels[detailsViewMode]} view</span>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="pt-4">
      {/* Toggle & Export Row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
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
          {/* Total / Per Unit Toggle - Only for SKU and Name views */}
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
                Total
              </button>
              <button
                onClick={() => setShowPerUnit(true)}
                className={`px-3 py-1 rounded-full font-medium transition-all ${
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
        {isAdmin && (
          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-1.5 transition-colors"
            title="Export to Excel"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        )}
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

      {/* Table Header showing count and column filters */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-700">
          {detailsViewMode === 'sku'
            ? `${displaySkus.length} SKUs`
            : detailsViewMode === 'name'
            ? `${displayProducts.length} products`
            : detailsViewMode === 'parent'
            ? `${displayParents.length} parents`
            : `${displayCategories.length} categories`}
        </div>
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-600 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              {activeFilterCount} column filter{activeFilterCount > 1 ? 's' : ''} active
            </span>
            <button
              onClick={clearAllColumnFilters}
              className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors"
              title="Clear all column filters"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {getItemCount() === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-slate-200 rounded-lg bg-slate-50">
          <Package className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-600 mb-2">No Data Found</h3>
          <p className="text-sm text-slate-500 max-w-md">
            No {viewModeLabels[detailsViewMode]?.toLowerCase() || 'items'} match your current filters.
            Try adjusting the date range, marketplace, or category filters.
          </p>
        </div>
      ) : (
      /* Table with Drag-to-Scroll */
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
            showCountry={true}
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
            columnFilters={columnFilters}
            onFilterChange={setColumnFilter}
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
      )}

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
      )}
    </div>
  );
};

export default React.memo(ProfitabilityDetailsTable);
