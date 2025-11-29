/**
 * CategorySummary - Category cards with sales breakdown
 */

import React from 'react';
import { PieChart as PieChartIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { formatPercent } from '../../utils/formatters';
import { ComparisonBadge } from '../shared/ComparisonBadge';
import { CategoryAnalytics } from './types';

interface CategorySummaryProps {
  categories: CategoryAnalytics[];
  comparisonCategories: CategoryAnalytics[];
  comparisonMode: 'none' | 'previous-period' | 'previous-year';
  selectedMarketplace: string;
  selectedFulfillment: string;
  startDate: string;
  endDate: string;
  expandedCategories: Set<string>;
  formatMoney: (amount: number) => string;
  onToggleCategory: (category: string) => void;
}

export const CategorySummary: React.FC<CategorySummaryProps> = ({
  categories,
  comparisonCategories,
  comparisonMode,
  selectedMarketplace,
  selectedFulfillment,
  startDate,
  endDate,
  expandedCategories,
  formatMoney,
  onToggleCategory
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <PieChartIcon className="w-5 h-5 text-green-600" />
          Category Summary
        </h2>
        <div className="text-sm text-slate-600">
          {selectedMarketplace !== 'all' && <span className="font-medium">{selectedMarketplace}</span>}
          {selectedMarketplace !== 'all' && (startDate || endDate || selectedFulfillment !== 'all' || comparisonMode !== 'none') && <span className="mx-2">•</span>}
          {(startDate || endDate) && (
            <span>
              {startDate && new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {startDate && endDate && ' - '}
              {endDate && new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          {(startDate || endDate) && (selectedFulfillment !== 'all' || comparisonMode !== 'none') && <span className="mx-2">•</span>}
          {selectedFulfillment !== 'all' && <span className="font-medium">{selectedFulfillment}</span>}
          {selectedFulfillment !== 'all' && comparisonMode !== 'none' && <span className="mx-2">•</span>}
          {comparisonMode !== 'none' && (
            <span className="font-medium text-blue-600">
              {comparisonMode === 'previous-period' ? 'vs Prev Period' : 'vs Prev Year'}
            </span>
          )}
          {selectedMarketplace === 'all' && !startDate && !endDate && selectedFulfillment === 'all' && comparisonMode === 'none' && (
            <span className="text-slate-400">All data</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* ALL Categories Card */}
        {categories.length > 0 && (() => {
          const totalSales = categories.reduce((sum, c) => sum + c.totalSales, 0);
          const totalOrders = categories.reduce((sum, c) => sum + c.totalOrders, 0);
          const totalProducts = categories.reduce((sum, c) => sum + c.totalProducts, 0);
          const avgFbaFee = categories.length > 0 ? categories.reduce((sum, c) => sum + c.fbaFeePercentage, 0) / categories.length : 0;
          const avgSellingFee = categories.length > 0 ? categories.reduce((sum, c) => sum + c.sellingFeePercentage, 0) / categories.length : 0;
          const avgRefundLoss = categories.length > 0 ? categories.reduce((sum, c) => sum + c.refundLossPercentage, 0) / categories.length : 0;
          const avgVat = categories.length > 0 ? categories.reduce((sum, c) => sum + c.vatPercentage, 0) / categories.length : 0;

          // Comparison data for All Categories
          const prevTotalSales = comparisonCategories.reduce((sum, c) => sum + c.totalSales, 0);

          return (
            <div className="border-2 border-indigo-400 rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-white h-72 flex flex-col shadow-md">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-indigo-800 text-base mb-1">All Categories</h3>
                  <div className="text-xs text-indigo-600">
                    {totalProducts} products · {totalOrders} orders
                  </div>
                </div>
              </div>

              {/* Sales */}
              <div className="mb-3 pb-3 border-b border-indigo-200">
                {comparisonMode === 'none' ? (
                  <div className="text-2xl font-bold text-indigo-600 text-center">{formatMoney(totalSales)}</div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-indigo-600">{formatMoney(totalSales)}</div>
                    {prevTotalSales > 0 && (
                      <ComparisonBadge current={totalSales} previous={prevTotalSales} />
                    )}
                  </div>
                )}
              </div>

              {/* Fee Percentages (Averages) */}
              <div className="space-y-2 flex-grow">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-indigo-600">FBA Fee (avg)</span>
                  <span className="font-semibold text-indigo-800">{formatPercent(avgFbaFee)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-indigo-600">Selling Fee (avg)</span>
                  <span className="font-semibold text-indigo-800">{formatPercent(avgSellingFee)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-indigo-600">Refund Loss (avg)</span>
                  <span className="font-semibold text-red-600">{formatPercent(avgRefundLoss)}</span>
                </div>
                {avgVat > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-indigo-600">VAT (avg)</span>
                    <span className="font-semibold text-indigo-800">{formatPercent(avgVat)}</span>
                  </div>
                )}
              </div>

              {/* Share of Total Sales - Always 100% */}
              <div className="mt-3 pt-3 border-t border-indigo-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-blue-600 font-medium">Share of Total</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-indigo-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full w-full" />
                    </div>
                    <span className="text-xs font-bold text-blue-600 w-12 text-right">100.0%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {categories.slice(0, 11).map(cat => {
          const prevCat = comparisonCategories.find(c => c.category === cat.category);
          const totalSales = categories.reduce((sum, c) => sum + c.totalSales, 0);
          const categoryPercentage = totalSales > 0 ? (cat.totalSales / totalSales) * 100 : 0;

          return (
          <div key={cat.category}>
            <div
              className="border-2 border-slate-200 rounded-xl p-4 hover:border-green-400 hover:shadow-md cursor-pointer transition-all bg-gradient-to-br from-white to-slate-50 h-72 flex flex-col"
              onClick={() => onToggleCategory(cat.category)}
            >
              {/* Category Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 text-base mb-1">{cat.category}</h3>
                  <div className="text-xs text-slate-500">
                    {cat.totalProducts} products · {cat.totalOrders} orders
                  </div>
                </div>
                {expandedCategories.has(cat.category) ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
                )}
              </div>

              {/* Sales */}
              <div className="mb-3 pb-3 border-b border-slate-200">
                {comparisonMode === 'none' ? (
                  <div className="text-2xl font-bold text-green-600 text-center">{formatMoney(cat.totalSales)}</div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-green-600">{formatMoney(cat.totalSales)}</div>
                    {prevCat && (
                      <ComparisonBadge current={cat.totalSales} previous={prevCat.totalSales} />
                    )}
                  </div>
                )}
              </div>

              {/* Fee Percentages - Flexible height */}
              <div className="space-y-2 flex-grow">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">FBA Fee</span>
                  <span className="font-semibold text-slate-800">{formatPercent(cat.fbaFeePercentage)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Selling Fee</span>
                  <span className="font-semibold text-slate-800">{formatPercent(cat.sellingFeePercentage)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Refund Loss</span>
                  <span className="font-semibold text-red-600">{formatPercent(cat.refundLossPercentage)}</span>
                </div>
                {cat.vatPercentage > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600">VAT</span>
                    <span className="font-semibold text-slate-800">{formatPercent(cat.vatPercentage)}</span>
                  </div>
                )}
              </div>

              {/* Share of Total Sales - Fixed at bottom */}
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-blue-600 font-medium">Share of Total</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                        style={{ width: `${Math.min(categoryPercentage, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-blue-600 w-12 text-right">
                      {formatPercent(categoryPercentage)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded: Top Products */}
            {expandedCategories.has(cat.category) && (
              <div className="mt-2 p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                <div className="text-sm font-semibold text-slate-700 mb-2">Top Products:</div>
                <div className="space-y-1">
                  {cat.topProducts.map((p, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-slate-600 text-left">{p.name}</span>
                      <span className="text-slate-800 font-medium ml-2">
                        {formatMoney(p.sales)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(CategorySummary);
