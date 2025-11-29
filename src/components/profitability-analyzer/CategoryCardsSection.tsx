import React from 'react';
import { PieChart as PieChartIcon, ChevronUp, ChevronDown } from 'lucide-react';
import type { CategoryProfitAnalysis } from '../../services/profitability/profitabilityAnalytics';

interface CategoryCardsSectionProps {
  categoryProfitability: CategoryProfitAnalysis[];
  expandedCategories: Set<string>;
  setExpandedCategories: React.Dispatch<React.SetStateAction<Set<string>>>;
  filterCategory: string;
  setFilterCategory: (category: string) => void;
  filterMarketplace: string;
  filterFulfillment: string;
  startDate: string;
  endDate: string;
  formatMoney: (amount: number) => string;
  formatPercent: (value: number) => string;
}

export const CategoryCardsSection: React.FC<CategoryCardsSectionProps> = React.memo(({
  categoryProfitability,
  expandedCategories,
  setExpandedCategories,
  filterCategory,
  setFilterCategory,
  filterMarketplace,
  filterFulfillment,
  startDate,
  endDate,
  formatMoney,
  formatPercent,
}) => {
  if (categoryProfitability.length === 0) return null;

  // Calculate totals for "All Categories" card
  const totalRevenue = categoryProfitability.reduce((sum, c) => sum + c.totalRevenue, 0);
  const totalProfit = categoryProfitability.reduce((sum, c) => sum + c.netProfit, 0);
  const totalProducts = categoryProfitability.reduce((sum, c) => sum + c.totalProducts, 0);
  const totalOrders = categoryProfitability.reduce((sum, c) => sum + c.totalOrders, 0);
  const totalParents = categoryProfitability.reduce((sum, c) => sum + c.totalParents, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Amazon Expenses
  const totalSellingFees = categoryProfitability.reduce((sum, c) => sum + c.sellingFees, 0);
  const totalFbaFees = categoryProfitability.reduce((sum, c) => sum + c.fbaFees, 0);
  const totalRefundLoss = categoryProfitability.reduce((sum, c) => sum + c.refundLoss, 0);
  const totalVat = categoryProfitability.reduce((sum, c) => sum + c.vat, 0);
  const totalAds = categoryProfitability.reduce((sum, c) => sum + c.advertisingCost, 0);
  const totalFbaCost = categoryProfitability.reduce((sum, c) => sum + c.fbaCost, 0);
  const totalFbmCost = categoryProfitability.reduce((sum, c) => sum + c.fbmCost, 0);
  const amazonExpenses = totalSellingFees + totalFbaFees + totalRefundLoss + totalVat + totalAds + totalFbaCost + totalFbmCost;

  // Non-Amazon Expenses
  const totalProductCost = categoryProfitability.reduce((sum, c) => sum + c.totalProductCost, 0);
  const totalShipping = categoryProfitability.reduce((sum, c) => sum + c.shippingCost, 0);
  const totalCustomsDuty = categoryProfitability.reduce((sum, c) => sum + c.customsDuty, 0);
  const totalDdpFee = categoryProfitability.reduce((sum, c) => sum + c.ddpFee, 0);
  const totalWarehouse = categoryProfitability.reduce((sum, c) => sum + c.warehouseCost, 0);
  const totalGst = categoryProfitability.reduce((sum, c) => sum + c.gstCost, 0);
  const nonAmazonExpenses = totalProductCost + totalShipping + totalCustomsDuty + totalDdpFee + totalWarehouse + totalGst;

  // Percentages
  const amazonPct = totalRevenue > 0 ? (amazonExpenses / totalRevenue) * 100 : 0;
  const nonAmazonPct = totalRevenue > 0 ? (nonAmazonExpenses / totalRevenue) * 100 : 0;
  const sellingPct = totalRevenue > 0 ? (totalSellingFees / totalRevenue) * 100 : 0;
  const fbaPct = totalRevenue > 0 ? (totalFbaFees / totalRevenue) * 100 : 0;
  const refundPct = totalRevenue > 0 ? (totalRefundLoss / totalRevenue) * 100 : 0;
  const vatPct = totalRevenue > 0 ? (totalVat / totalRevenue) * 100 : 0;
  const adsPct = totalRevenue > 0 ? (totalAds / totalRevenue) * 100 : 0;
  const fbaCostPct = totalRevenue > 0 ? (totalFbaCost / totalRevenue) * 100 : 0;
  const fbmCostPct = totalRevenue > 0 ? (totalFbmCost / totalRevenue) * 100 : 0;
  const productCostPct = totalRevenue > 0 ? (totalProductCost / totalRevenue) * 100 : 0;
  const shipPct = totalRevenue > 0 ? (totalShipping / totalRevenue) * 100 : 0;
  const customsPct = totalRevenue > 0 ? (totalCustomsDuty / totalRevenue) * 100 : 0;
  const ddpPct = totalRevenue > 0 ? (totalDdpFee / totalRevenue) * 100 : 0;
  const warehousePct = totalRevenue > 0 ? (totalWarehouse / totalRevenue) * 100 : 0;
  const gstPct = totalRevenue > 0 ? (totalGst / totalRevenue) * 100 : 0;

  const isAllExpanded = expandedCategories.has('__ALL__');

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <PieChartIcon className="w-5 h-5 text-purple-600" />
          Category Profitability
        </h2>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* ALL Categories Card */}
        <div className="border-2 border-indigo-400 rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-white flex flex-col shadow-md">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-bold text-indigo-800 text-base mb-1">All Categories</h3>
              <div className="text-xs text-indigo-600">
                {categoryProfitability.length} categories · {totalParents} parents · {totalProducts} products
              </div>
            </div>
            <button
              onClick={() => toggleExpanded('__ALL__')}
              className="p-1 hover:bg-indigo-100 rounded transition-colors"
            >
              {isAllExpanded ? (
                <ChevronUp className="w-4 h-4 text-indigo-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-indigo-400" />
              )}
            </button>
          </div>

          <div className="mb-3 pb-3 border-b border-indigo-200">
            <div className="text-2xl font-bold text-indigo-600 text-center">{formatMoney(totalRevenue)}</div>
            <div className="text-xs text-indigo-500 text-center mt-1">{totalOrders} orders</div>
          </div>

          <div className="space-y-2 flex-grow text-[11px]">
            {/* Amazon Expenses Group */}
            <div className="flex justify-between items-center">
              <span className="text-red-600 font-medium">Amazon Expenses</span>
              <span className="font-bold text-red-600">{formatPercent(amazonPct)} <span className="text-slate-400 font-normal">({formatMoney(amazonExpenses)})</span></span>
            </div>
            {isAllExpanded && (
              <div className="pl-3 space-y-1 border-l-2 border-red-100">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-red-500">Selling Fee</span>
                  <span className="text-red-500">{formatPercent(sellingPct)} ({formatMoney(totalSellingFees)})</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-red-500">FBA Fee</span>
                  <span className="text-red-500">{formatPercent(fbaPct)} ({formatMoney(totalFbaFees)})</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-red-500">Refund</span>
                  <span className="text-red-500">{formatPercent(refundPct)} ({formatMoney(totalRefundLoss)})</span>
                </div>
                {totalVat > 0 && (
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-red-500">VAT</span>
                    <span className="text-red-500">{formatPercent(vatPct)} ({formatMoney(totalVat)})</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-pink-500">Ads</span>
                  <span className="text-pink-500">{formatPercent(adsPct)} ({formatMoney(totalAds)})</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-indigo-500">FBA Cost</span>
                  <span className="text-indigo-500">{formatPercent(fbaCostPct)} ({formatMoney(totalFbaCost)})</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-cyan-500">FBM Cost</span>
                  <span className="text-cyan-500">{formatPercent(fbmCostPct)} ({formatMoney(totalFbmCost)})</span>
                </div>
              </div>
            )}

            {/* Non-Amazon Expenses Group */}
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Non-Amazon Expenses</span>
              <span className="font-bold text-slate-700">{formatPercent(nonAmazonPct)} <span className="text-slate-400 font-normal">({formatMoney(nonAmazonExpenses)})</span></span>
            </div>
            {isAllExpanded && (
              <div className="pl-3 space-y-1 border-l-2 border-slate-200">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500">Product Cost</span>
                  <span className="text-slate-500">{formatPercent(productCostPct)} ({formatMoney(totalProductCost)})</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500">Shipping</span>
                  <span className="text-slate-500">{formatPercent(shipPct)} ({formatMoney(totalShipping)})</span>
                </div>
                {totalCustomsDuty > 0 && (
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-amber-500">Customs</span>
                    <span className="text-amber-500">{formatPercent(customsPct)} ({formatMoney(totalCustomsDuty)})</span>
                  </div>
                )}
                {totalDdpFee > 0 && (
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-amber-500">DDP</span>
                    <span className="text-amber-500">{formatPercent(ddpPct)} ({formatMoney(totalDdpFee)})</span>
                  </div>
                )}
                {totalWarehouse > 0 && (
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-amber-500">Warehouse</span>
                    <span className="text-amber-500">{formatPercent(warehousePct)} ({formatMoney(totalWarehouse)})</span>
                  </div>
                )}
                {totalGst > 0 && (
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-orange-500">GST</span>
                    <span className="text-orange-500">{formatPercent(gstPct)} ({formatMoney(totalGst)})</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-indigo-200 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-indigo-700 font-medium">Net Profit</span>
              <span className={`font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(totalProfit)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-indigo-700 font-medium">Margin</span>
              <span className={`font-bold ${avgMargin >= 10 ? 'text-green-600' : avgMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                {formatPercent(avgMargin)}
              </span>
            </div>
          </div>
        </div>

        {/* Individual Category Cards */}
        {categoryProfitability.slice(0, 11).map(cat => {
          const allCatRevenue = categoryProfitability.reduce((sum, c) => sum + c.totalRevenue, 0);
          const categoryPercentage = allCatRevenue > 0 ? (cat.totalRevenue / allCatRevenue) * 100 : 0;

          // Amazon Expenses (including VAT)
          const catAmazonExpenses = cat.sellingFees + cat.fbaFees + cat.refundLoss + cat.vat + cat.advertisingCost + cat.fbaCost + cat.fbmCost;
          const catAmazonPct = cat.totalRevenue > 0 ? (catAmazonExpenses / cat.totalRevenue) * 100 : 0;

          // Non-Amazon Expenses (including GST)
          const catNonAmazonExpenses = cat.totalProductCost + cat.shippingCost + cat.othersCost + cat.gstCost;
          const catNonAmazonPct = cat.totalRevenue > 0 ? (catNonAmazonExpenses / cat.totalRevenue) * 100 : 0;

          const isExpanded = expandedCategories.has(cat.category);

          return (
            <div key={cat.category}>
              <div
                className={`border-2 rounded-xl p-4 cursor-pointer transition-all flex flex-col ${
                  filterCategory === cat.category
                    ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-white shadow-lg'
                    : 'border-slate-200 hover:border-purple-400 hover:shadow-md bg-gradient-to-br from-white to-slate-50'
                }`}
                onClick={() => setFilterCategory(filterCategory === cat.category ? 'all' : cat.category)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-800 text-base">{cat.category}</h3>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        cat.fulfillment === 'FBA' ? 'bg-blue-100 text-blue-700' :
                        cat.fulfillment === 'FBM' ? 'bg-green-100 text-green-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {cat.fulfillment}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {cat.totalParents} parents · {cat.totalProducts} products
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(cat.category);
                    }}
                    className="p-1 hover:bg-slate-100 rounded transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>

                <div className="mb-3 pb-3 border-b border-slate-200">
                  <div className="text-2xl font-bold text-purple-600 text-center">{formatMoney(cat.totalRevenue)}</div>
                  <div className="text-xs text-slate-500 text-center mt-1">{cat.totalOrders} orders</div>
                </div>

                <div className="space-y-2 flex-grow text-[11px]">
                  {/* Amazon Expenses Group */}
                  <div className="flex justify-between items-center">
                    <span className="text-red-600 font-medium">Amazon Expenses</span>
                    <span className="font-bold text-red-600">{formatPercent(catAmazonPct)} <span className="text-slate-400 font-normal">({formatMoney(catAmazonExpenses)})</span></span>
                  </div>
                  {isExpanded && (
                    <div className="pl-3 space-y-1 border-l-2 border-red-100">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-red-500">Selling Fee</span>
                        <span className="text-red-500">{formatPercent(cat.sellingFeePercent)} ({formatMoney(cat.sellingFees)})</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-red-500">FBA Fee</span>
                        <span className="text-red-500">{formatPercent(cat.fbaFeePercent)} ({formatMoney(cat.fbaFees)})</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-red-500">Refund</span>
                        <span className="text-red-500">{formatPercent(cat.refundLossPercent)} ({formatMoney(cat.refundLoss)})</span>
                      </div>
                      {cat.vat > 0 && (
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-red-500">VAT</span>
                          <span className="text-red-500">{formatPercent(cat.vatPercent)} ({formatMoney(cat.vat)})</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-pink-500">Ads</span>
                        <span className="text-pink-500">{formatPercent(cat.advertisingPercent)} ({formatMoney(cat.advertisingCost)})</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-indigo-500">FBA Cost</span>
                        <span className="text-indigo-500">{formatPercent(cat.fbaCostPercent)} ({formatMoney(cat.fbaCost)})</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-cyan-500">FBM Cost</span>
                        <span className="text-cyan-500">{formatPercent(cat.fbmCostPercent)} ({formatMoney(cat.fbmCost)})</span>
                      </div>
                    </div>
                  )}

                  {/* Non-Amazon Expenses Group */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Non-Amazon Expenses</span>
                    <span className="font-bold text-slate-700">{formatPercent(catNonAmazonPct)} <span className="text-slate-400 font-normal">({formatMoney(catNonAmazonExpenses)})</span></span>
                  </div>
                  {isExpanded && (
                    <div className="pl-3 space-y-1 border-l-2 border-slate-200">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500">Product Cost</span>
                        <span className="text-slate-500">{formatPercent(cat.productCostPercent)} ({formatMoney(cat.totalProductCost)})</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500">Shipping</span>
                        <span className="text-slate-500">{formatPercent(cat.shippingCostPercent)} ({formatMoney(cat.shippingCost)})</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-amber-500">Others</span>
                        <span className="text-amber-500">{formatPercent(cat.othersCostPercent)} ({formatMoney(cat.othersCost)})</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-700 font-medium">Net Profit</span>
                    <span className={`font-bold ${!cat.hasCostData ? 'text-slate-400' : cat.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {cat.hasCostData ? formatMoney(cat.netProfit) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-700 font-medium">Margin</span>
                    <span className={`font-bold ${!cat.hasCostData ? 'text-slate-400' : cat.profitMargin >= 10 ? 'text-green-600' : cat.profitMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {cat.hasCostData ? formatPercent(cat.profitMargin) : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-blue-600">Share</span>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                          style={{ width: `${Math.min(categoryPercentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 w-10 text-right">
                        {formatPercent(categoryPercentage)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

CategoryCardsSection.displayName = 'CategoryCardsSection';
