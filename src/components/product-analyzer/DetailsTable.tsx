/**
 * DetailsTable - Product/Parent details with filters and sorting
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Tag, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatPercent } from '../../utils/formatters';
import { ComparisonBadge } from '../shared/ComparisonBadge';
import { SortableHeader } from '../shared/SortableHeader';
import { calculateParentAnalytics, calculateCategoryAnalytics } from '../../services/analytics/productAnalytics';
import { ProductDetailModal } from './ProductDetailModal';

// Using 'any' for detailsProducts to match the existing ProductAnalytics type from service
// This is a temporary solution - ideally we'd export and reuse the type from productAnalytics.ts

interface ParentData {
  parent: string;
  category: string;
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
}

interface CategoryData {
  category: string;
  totalProducts: number;
  totalOrders: number;
  totalSales: number;
  totalRefundLoss: number;
  sellingFees: number;
  fbaFees: number;
}

interface DetailsTableProps {
  detailsProducts: any[];
  comparisonProducts: any[];
  comparisonParents: ParentData[];
  comparisonCategories: CategoryData[];
  comparisonProductMap: Map<string, any>;
  comparisonParentMap: Map<string, ParentData>;
  comparisonCategoryMap: Map<string, CategoryData>;
  comparisonMode: 'none' | 'previous-period' | 'previous-year';
  detailsViewMode: 'category' | 'parent' | 'name';
  selectedCategory: string;
  selectedParent: string;
  selectedName: string;
  categoryNames: string[];
  parentNames: string[];
  productNames: string[];
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  formatMoney: (amount: number) => string;
  marketplace: string;
  transactionData: any[];
  dateRange: { start: string; end: string };
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
  // Filter display props
  filterMarketplace: string;
  filterFulfillment: string;
  onViewModeChange: (mode: 'category' | 'parent' | 'name') => void;
  onCategoryChange: (value: string) => void;
  onParentChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSort: (column: string) => void;
}

export const DetailsTable: React.FC<DetailsTableProps> = ({
  detailsProducts,
  comparisonProducts,
  comparisonParents,
  comparisonCategories,
  comparisonProductMap,
  comparisonParentMap,
  comparisonCategoryMap,
  comparisonMode,
  detailsViewMode,
  selectedCategory,
  selectedParent,
  selectedName,
  categoryNames,
  parentNames,
  productNames,
  sortColumn,
  sortDirection,
  formatMoney,
  marketplace,
  transactionData,
  dateRange,
  comparisonDateRange,
  globalCosts,
  salesByFulfillment,
  filterMarketplace,
  filterFulfillment,
  onViewModeChange,
  onCategoryChange,
  onParentChange,
  onNameChange,
  onSort
}) => {
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProductData, setSelectedProductData] = useState<any>(null);
  const [modalViewType, setModalViewType] = useState<'category' | 'parent' | 'name'>('name');

  const handleProductClick = (productData: any, viewType: 'category' | 'parent' | 'name') => {
    setSelectedProductData(productData);
    setModalViewType(viewType);
    setModalOpen(true);
  };

  // Memoize expensive calculations to prevent recalculation on every render
  const filteredParents = useMemo(
    () => calculateParentAnalytics(detailsProducts),
    [detailsProducts]
  );

  const filteredCategories = useMemo(
    () => calculateCategoryAnalytics(detailsProducts, transactionData),
    [detailsProducts, transactionData]
  );

  // Generate filename based on filters
  const generateFileName = useCallback(() => {
    const parts = ['Faz2', 'Details'];

    // Add view mode
    const viewModeLabels: Record<string, string> = {
      'category': 'Category',
      'parent': 'Parent',
      'name': 'Product'
    };
    parts.push(viewModeLabels[detailsViewMode] || detailsViewMode);

    // Add filters
    if (filterMarketplace !== 'all') parts.push(filterMarketplace);
    if (filterFulfillment !== 'all') parts.push(filterFulfillment);
    if (dateRange.start) parts.push(dateRange.start.replace(/-/g, ''));
    if (dateRange.end) parts.push(dateRange.end.replace(/-/g, ''));

    return parts.join('_') + '.xlsx';
  }, [detailsViewMode, filterMarketplace, filterFulfillment, dateRange]);

  // Export to Excel
  const handleExportExcel = useCallback(() => {
    let data: any[] = [];
    let sheetName = 'Data';

    if (detailsViewMode === 'category') {
      sheetName = 'Categories';
      data = filteredCategories.map(cat => ({
        'Category': cat.category,
        'Total Sales': cat.totalSales,
        'Orders': cat.totalOrders,
        'Products': cat.totalProducts,
        'FBA Fee': cat.fbaFees,
        'FBA Fee %': cat.fbaFeePercentage,
        'Selling Fee': cat.sellingFees,
        'Selling Fee %': cat.sellingFeePercentage,
        'Refund Loss': cat.totalRefundLoss,
        'Refund Loss %': cat.refundLossPercentage,
      }));
    } else if (detailsViewMode === 'parent') {
      sheetName = 'Parents';
      data = filteredParents.map(par => ({
        'Parent ASIN': par.parent,
        'Category': par.category,
        'Total Sales': par.totalSales,
        'Orders': par.totalOrders,
        'Products': par.totalProducts,
      }));
    } else {
      sheetName = 'Products';
      data = detailsProducts.map((p: any) => ({
        'Name': p.name,
        'ASIN': p.asin,
        'Parent': p.parent,
        'Category': p.category,
        'Total Sales': p.totalSales,
        'Orders': p.totalOrders,
        'FBA Sales': p.fbaSales || 0,
        'FBM Sales': p.fbmSales || 0,
        'FBA Fees': p.fbaFees || 0,
        'Selling Fees': p.sellingFees || 0,
        'Refund Loss': p.totalRefundLoss || 0,
        'Avg Order Value': p.avgOrderValue || 0,
      }));
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, generateFileName());
  }, [detailsViewMode, filteredCategories, filteredParents, detailsProducts, generateFileName]);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Tag className="w-5 h-5 text-indigo-600" />
          Details
        </h2>
        {/* Filter Info Display */}
        <div className="text-sm text-slate-600">
          {filterMarketplace !== 'all' && <span className="font-medium">{filterMarketplace}</span>}
          {filterMarketplace !== 'all' && (dateRange.start || dateRange.end || filterFulfillment !== 'all' || comparisonMode !== 'none') && <span className="mx-2">•</span>}
          {(dateRange.start || dateRange.end) && (
            <span>
              {dateRange.start && new Date(dateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {dateRange.start && dateRange.end && ' - '}
              {dateRange.end && new Date(dateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          {(dateRange.start || dateRange.end) && (filterFulfillment !== 'all' || comparisonMode !== 'none') && <span className="mx-2">•</span>}
          {filterFulfillment !== 'all' && <span className="font-medium">{filterFulfillment}</span>}
          {filterFulfillment !== 'all' && comparisonMode !== 'none' && <span className="mx-2">•</span>}
          {comparisonMode !== 'none' && (
            <span className="font-medium text-blue-600">
              {comparisonMode === 'previous-period' ? 'vs Prev Period' : 'vs Prev Year'}
            </span>
          )}
          {filterMarketplace === 'all' && !dateRange.start && !dateRange.end && filterFulfillment === 'all' && comparisonMode === 'none' && (
            <span className="text-slate-400">All data</span>
          )}
        </div>
      </div>
      {/* Toggle & Export Row */}
      <div className="flex items-center justify-between mb-4">
        {/* Category/Parent/Name Segmented Control */}
        <div className="inline-flex rounded-lg border border-slate-300 p-1 bg-slate-50">
          <button
            onClick={() => onViewModeChange('category')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              detailsViewMode === 'category'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Category
          </button>
          <button
            onClick={() => onViewModeChange('parent')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              detailsViewMode === 'parent'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Parent
          </button>
          <button
            onClick={() => onViewModeChange('name')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              detailsViewMode === 'name'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Name
          </button>
        </div>
        <button
          onClick={handleExportExcel}
          className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-1.5 transition-colors"
          title="Export to Excel"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All Categories</option>
            {categoryNames.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Parent */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Parent ASIN
          </label>
          <select
            value={selectedParent}
            onChange={(e) => onParentChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All Parents</option>
            {parentNames.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Product Name
          </label>
          <select
            value={selectedName}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All Products</option>
            {productNames.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Product/Parent/Category Table */}
      <div className="mt-6">
        <div className="text-sm font-semibold text-slate-700 mb-3">
          {detailsViewMode === 'name'
            ? `${detailsProducts.length} products`
            : detailsViewMode === 'parent'
            ? `${filteredParents.length} parents`
            : `${filteredCategories.length} categories`}
        </div>
        <div className="overflow-x-auto">
          {detailsViewMode === 'category' ? (
          /* Category-based Table */
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <SortableHeader column="category" label="Category" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
                <SortableHeader column="totalSales" label="Sales" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" />
                {comparisonMode !== 'none' && (
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-700 min-w-[80px]">Change</th>
                )}
                <SortableHeader column="totalOrders" label="Orders" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" />
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700">Quantity</th>
                <SortableHeader column="totalProducts" label="Products" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" />
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700">FBA Fee</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700">Selling Fee</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700">Refund Loss</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {/* All Categories Summary Row */}
              {(() => {
                // Calculate totals for All Categories
                const allTotalSales = filteredCategories.reduce((sum, c) => sum + c.totalSales, 0);
                const allTotalOrders = filteredCategories.reduce((sum, c) => sum + c.totalOrders, 0);
                const allTotalProducts = filteredCategories.reduce((sum, c) => sum + c.totalProducts, 0);
                const allTotalQuantity = detailsProducts.reduce((sum: number, p: any) =>
                  sum + p.variants.reduce((s: number, v: any) => s + v.quantity, 0), 0);
                const allFbaFees = filteredCategories.reduce((sum, c) => sum + c.fbaFees, 0);
                const allSellingFees = filteredCategories.reduce((sum, c) => sum + c.sellingFees, 0);
                const allRefundLoss = filteredCategories.reduce((sum, c) => sum + c.totalRefundLoss, 0);
                const allFbaSales = detailsProducts.reduce((sum: number, p: any) => sum + (p.fbaSales || 0), 0);

                const allFbaFeePercent = allFbaSales > 0 ? (allFbaFees / allFbaSales) * 100 : 0;
                const allSellingFeePercent = allTotalSales > 0 ? (allSellingFees / allTotalSales) * 100 : 0;
                const allRefundLossPercent = allTotalSales > 0 ? (allRefundLoss / allTotalSales) * 100 : 0;

                // Comparison data for All Categories
                const prevTotalSales = comparisonCategories.reduce((sum, c) => sum + c.totalSales, 0);

                // All Categories data for modal
                const allCategoriesData = {
                  name: 'All Categories',
                  category: 'All Categories',
                  totalSales: allTotalSales,
                  totalOrders: allTotalOrders,
                  variants: detailsProducts.flatMap((p: any) => p.variants),
                  sellingFees: allSellingFees,
                  fbaFees: allFbaFees,
                  fbaSales: allFbaSales,
                  totalRefundLoss: allRefundLoss
                };

                return (
                  <tr className="hover:bg-indigo-50 bg-indigo-50/30 border-b-2 border-indigo-200">
                    <td className="px-3 py-3 text-left">
                      <div
                        className="font-bold text-indigo-700 cursor-pointer text-sm hover:underline"
                        onClick={() => handleProductClick(allCategoriesData, 'category')}
                      >
                        All Categories
                      </div>
                      <div className="text-[10px] text-indigo-500">Click for breakdown</div>
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-indigo-700 text-sm">
                      {formatMoney(allTotalSales)}
                    </td>
                    {comparisonMode !== 'none' && (
                      <td className="px-3 py-3 text-center">
                        {prevTotalSales > 0 && (
                          <ComparisonBadge current={allTotalSales} previous={prevTotalSales} />
                        )}
                      </td>
                    )}
                    <td className="px-3 py-3 text-right text-sm text-slate-600">{allTotalOrders}</td>
                    <td className="px-3 py-3 text-right text-sm text-slate-600">{allTotalQuantity}</td>
                    <td className="px-3 py-3 text-right text-sm text-slate-600">{allTotalProducts}</td>
                    <td className="px-3 py-3 text-right text-sm">
                      <div className="text-slate-800">{formatMoney(allFbaFees)}</div>
                      <div className="text-xs text-slate-500">{formatPercent(allFbaFeePercent)}</div>
                    </td>
                    <td className="px-3 py-3 text-right text-sm">
                      <div className="text-slate-800">{formatMoney(allSellingFees)}</div>
                      <div className="text-xs text-slate-500">{formatPercent(allSellingFeePercent)}</div>
                    </td>
                    <td className="px-3 py-3 text-right text-sm">
                      <div className="text-red-600">{formatMoney(allRefundLoss)}</div>
                      <div className="text-xs text-red-500">{formatPercent(allRefundLossPercent)}</div>
                    </td>
                  </tr>
                );
              })()}
              {/* Individual Category Rows */}
              {(() => {
                // Use memoized filteredCategories
                return filteredCategories
                .slice()
                .sort((a, b) => {
                  let aVal: any, bVal: any;
                  switch (sortColumn) {
                    case 'category': aVal = a.category; bVal = b.category; break;
                    case 'totalSales': aVal = a.totalSales; bVal = b.totalSales; break;
                    case 'totalOrders': aVal = a.totalOrders; bVal = b.totalOrders; break;
                    case 'totalProducts': aVal = a.totalProducts; bVal = b.totalProducts; break;
                    default: aVal = a.totalSales; bVal = b.totalSales;
                  }
                  if (typeof aVal === 'string') {
                    return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                  }
                  return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                })
                .map(category => {
                const prevCategory = comparisonCategoryMap.get(category.category);

                // Get aggregated data from products under this category
                const categoryProducts = detailsProducts.filter((p: any) => p.category === category.category);
                const totalQuantity = categoryProducts.reduce((sum: number, p: any) =>
                  sum + p.variants.reduce((s: number, v: any) => s + v.quantity, 0), 0);

                const fbaFeePercent = category.totalSales > 0 ? (category.fbaFees / category.totalSales) * 100 : 0;
                const sellingFeePercent = category.totalSales > 0 ? (category.sellingFees / category.totalSales) * 100 : 0;
                const refundLossPercent = category.totalSales > 0 ? (category.totalRefundLoss / category.totalSales) * 100 : 0;

                return (
                  <tr key={category.category} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-left">
                      <div
                        className="font-medium text-amber-600 hover:text-amber-800 cursor-pointer text-sm hover:underline"
                        onClick={() => {
                          // Create a synthetic product data for category
                          const categoryData = {
                            name: category.category,
                            category: category.category,
                            totalSales: category.totalSales,
                            totalOrders: category.totalOrders,
                            variants: categoryProducts.flatMap((p: any) => p.variants),
                            sellingFees: category.sellingFees,
                            fbaFees: category.fbaFees,
                            fbaSales: category.totalSales,
                            totalRefundLoss: category.totalRefundLoss
                          };
                          handleProductClick(categoryData, 'category');
                        }}
                      >
                        {category.category}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800 text-sm">
                      {formatMoney(category.totalSales)}
                    </td>
                    {comparisonMode !== 'none' && (
                      <td className="px-3 py-2 text-center">
                        {prevCategory && (
                          <ComparisonBadge current={category.totalSales} previous={prevCategory.totalSales} />
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right text-sm text-slate-600">{category.totalOrders}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-600">{totalQuantity}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-600">{category.totalProducts}</td>
                    <td className="px-3 py-2 text-right text-sm">
                      <div className="text-slate-800">{formatMoney(category.fbaFees)}</div>
                      <div className="text-xs text-slate-500">{formatPercent(fbaFeePercent)}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-sm">
                      <div className="text-slate-800">{formatMoney(category.sellingFees)}</div>
                      <div className="text-xs text-slate-500">{formatPercent(sellingFeePercent)}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-sm">
                      <div className="text-red-600">{formatMoney(category.totalRefundLoss)}</div>
                      <div className="text-xs text-red-500">{formatPercent(refundLossPercent)}</div>
                    </td>
                  </tr>
                );
              });
              })()}
            </tbody>
          </table>
          ) : detailsViewMode === 'name' ? (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th
                  className="px-3 py-2 text-left text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => onSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Product
                    {sortColumn === 'name' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => onSort('category')}
                >
                  <div className="flex items-center gap-1">
                    Category
                    {sortColumn === 'category' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-right text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => onSort('totalSales')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Sales
                    {sortColumn === 'totalSales' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                {comparisonMode !== 'none' && (
                  <th
                    className="px-3 py-2 text-center text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition min-w-[80px]"
                    onClick={() => onSort('change')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Change
                      {sortColumn === 'change' && (
                        <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                )}
                <th
                  className="px-3 py-2 text-right text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => onSort('totalOrders')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Orders
                    {sortColumn === 'totalOrders' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-right text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => onSort('quantity')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Quantity
                    {sortColumn === 'quantity' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-right text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => onSort('avgOrderValue')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Avg Price
                    {sortColumn === 'avgOrderValue' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-right text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => onSort('fbaRate')}
                >
                  <div className="flex items-center justify-end gap-1">
                    FBA Rate
                    {sortColumn === 'fbaRate' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-right text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => onSort('fbaFees')}
                >
                  <div className="flex items-center justify-end gap-1">
                    FBA Fee
                    {sortColumn === 'fbaFees' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-right text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => onSort('sellingFees')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Selling Fee
                    {sortColumn === 'sellingFees' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-3 py-2 text-right text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                  onClick={() => onSort('totalRefundLoss')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Refund Loss
                    {sortColumn === 'totalRefundLoss' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {detailsProducts.map(product => {
                  const fbaRate = product.totalSales > 0 ? (product.fbaSales / product.totalSales) * 100 : 0;
                  const fbaFeePercent = product.fbaSales > 0 ? (product.fbaFees / product.fbaSales) * 100 : 0;
                  const sellingFeePercent = product.totalSales > 0 ? (product.sellingFees / product.totalSales) * 100 : 0;
                  const refundLossPercent = product.totalSales > 0 ? (product.totalRefundLoss / product.totalSales) * 100 : 0;

                  // Calculate quantity from variants
                  const totalQuantity = product.variants.reduce((sum: number, v: any) => sum + v.quantity, 0);
                  const avgPrice = totalQuantity > 0 ? product.totalSales / totalQuantity : 0;

                  // Find comparison product (O(1) Map lookup)
                  const prevProduct = comparisonProductMap.get(product.name);

                  return (
                    <tr key={product.name} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-left">
                        <div
                          className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer text-sm hover:underline"
                          onClick={() => handleProductClick(product, 'name')}
                        >
                          {product.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          Parent: {product.parent}
                        </div>
                        <div className="text-xs text-slate-500">
                          ASIN: {product.asin}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-left text-sm text-slate-600">{product.category}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800 text-sm">
                        {formatMoney(product.totalSales)}
                      </td>
                      {comparisonMode !== 'none' && (
                        <td className="px-3 py-2 text-center">
                          {prevProduct && (
                            <ComparisonBadge current={product.totalSales} previous={prevProduct.totalSales} />
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right text-sm text-slate-600">{product.totalOrders}</td>
                      <td className="px-3 py-2 text-right text-sm text-slate-600">{totalQuantity}</td>
                      <td className="px-3 py-2 text-right text-sm text-slate-700">{formatMoney(avgPrice)}</td>
                      <td className="px-3 py-2 text-right text-sm">
                        <span className="text-slate-800 font-medium">{formatPercent(fbaRate)}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-sm">
                        <div className="text-slate-800">{formatMoney(product.fbaFees)}</div>
                        <div className="text-xs text-slate-500">{formatPercent(fbaFeePercent)}</div>
                      </td>
                      <td className="px-3 py-2 text-right text-sm">
                        <div className="text-slate-800">{formatMoney(product.sellingFees)}</div>
                        <div className="text-xs text-slate-500">{formatPercent(sellingFeePercent)}</div>
                      </td>
                      <td className="px-3 py-2 text-right text-sm">
                        <div className="text-red-600">{formatMoney(product.totalRefundLoss)}</div>
                        <div className="text-xs text-red-500">{formatPercent(refundLossPercent)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
          /* Parent-based Table */
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <SortableHeader column="parent" label="Parent ASIN" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
                <SortableHeader column="category" label="Category" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
                <SortableHeader column="totalSales" label="Sales" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" />
                {comparisonMode !== 'none' && (
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-700 min-w-[80px]">Change</th>
                )}
                <SortableHeader column="totalOrders" label="Orders" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" />
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700">Quantity</th>
                <SortableHeader column="totalProducts" label="Products" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" />
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700">FBA Fee</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700">Selling Fee</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700">Refund Loss</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {(() => {
                // Use memoized filteredParents
                return filteredParents
                .slice()
                .sort((a, b) => {
                  let aVal: any, bVal: any;
                  switch (sortColumn) {
                    case 'parent': aVal = a.parent; bVal = b.parent; break;
                    case 'category': aVal = a.category; bVal = b.category; break;
                    case 'totalSales': aVal = a.totalSales; bVal = b.totalSales; break;
                    case 'totalOrders': aVal = a.totalOrders; bVal = b.totalOrders; break;
                    case 'totalProducts': aVal = a.totalProducts; bVal = b.totalProducts; break;
                    default: aVal = a.totalSales; bVal = b.totalSales;
                  }
                  if (typeof aVal === 'string') {
                    return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                  }
                  return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                })
                .map(parent => {
                const prevParent = comparisonParentMap.get(parent.parent);

                // Get aggregated data from products under this parent
                const parentProducts = detailsProducts.filter((p: any) => p.parent === parent.parent);
                const totalQuantity = parentProducts.reduce((sum: number, p: any) =>
                  sum + p.variants.reduce((s: number, v: any) => s + v.quantity, 0), 0);
                const totalFbaFees = parentProducts.reduce((sum: number, p: any) => sum + p.fbaFees, 0);
                const totalSellingFees = parentProducts.reduce((sum: number, p: any) => sum + p.sellingFees, 0);
                const totalRefundLoss = parentProducts.reduce((sum: number, p: any) => sum + p.totalRefundLoss, 0);
                const totalFbaSales = parentProducts.reduce((sum: number, p: any) => sum + p.fbaSales, 0);

                const fbaFeePercent = totalFbaSales > 0 ? (totalFbaFees / totalFbaSales) * 100 : 0;
                const sellingFeePercent = parent.totalSales > 0 ? (totalSellingFees / parent.totalSales) * 100 : 0;
                const refundLossPercent = parent.totalSales > 0 ? (totalRefundLoss / parent.totalSales) * 100 : 0;

                return (
                  <tr key={parent.parent} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-left">
                      <div
                        className="font-medium text-purple-600 hover:text-purple-800 cursor-pointer text-sm hover:underline"
                        onClick={() => {
                          // Create a synthetic product data for parent
                          const parentData = {
                            name: parent.parent,
                            parent: parent.parent,
                            category: parent.category,
                            totalSales: parent.totalSales,
                            totalOrders: parent.totalOrders,
                            variants: parentProducts.flatMap((p: any) => p.variants),
                            sellingFees: totalSellingFees,
                            fbaFees: totalFbaFees,
                            fbaSales: totalFbaSales,
                            totalRefundLoss: totalRefundLoss
                          };
                          handleProductClick(parentData, 'parent');
                        }}
                      >
                        {parent.parent}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-left text-sm text-slate-600">{parent.category}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800 text-sm">
                      {formatMoney(parent.totalSales)}
                    </td>
                    {comparisonMode !== 'none' && (
                      <td className="px-3 py-2 text-center">
                        {prevParent && (
                          <ComparisonBadge current={parent.totalSales} previous={prevParent.totalSales} />
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right text-sm text-slate-600">{parent.totalOrders}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-600">{totalQuantity}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-600">{parent.totalProducts}</td>
                    <td className="px-3 py-2 text-right text-sm">
                      <div className="text-slate-800">{formatMoney(totalFbaFees)}</div>
                      <div className="text-xs text-slate-500">{formatPercent(fbaFeePercent)}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-sm">
                      <div className="text-slate-800">{formatMoney(totalSellingFees)}</div>
                      <div className="text-xs text-slate-500">{formatPercent(sellingFeePercent)}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-sm">
                      <div className="text-red-600">{formatMoney(totalRefundLoss)}</div>
                      <div className="text-xs text-red-500">{formatPercent(refundLossPercent)}</div>
                    </td>
                  </tr>
                );
              });
              })()}
            </tbody>
          </table>
          )}
          </div>
        </div>

        {/* Product Detail Modal */}
        {selectedProductData && (
          <ProductDetailModal
            isOpen={modalOpen}
            onClose={() => {
              setModalOpen(false);
              setSelectedProductData(null);
            }}
            productData={selectedProductData}
            marketplace={marketplace}
            viewType={modalViewType}
            transactionData={transactionData}
            dateRange={dateRange}
            comparisonMode={comparisonMode}
            comparisonDateRange={comparisonDateRange}
            globalCosts={globalCosts}
            salesByFulfillment={salesByFulfillment}
          />
        )}
    </div>
  );
};

export default React.memo(DetailsTable);
