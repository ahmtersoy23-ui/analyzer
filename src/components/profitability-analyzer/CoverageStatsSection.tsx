import React from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { SKUProfitAnalysis } from '../../services/profitability/profitabilityAnalytics';

interface CoverageStats {
  totalSkus: number;
  calculatedSkus: number;
  excludedCount: number;
  coveragePercent: number;
  totalRevenue: number;
  calculatedRevenue: number;
  excludedRevenue: number;
  revenueCoveragePercent: number;
  gradeResellCount: number;
  gradeResellRevenue: number;
}

interface CoverageStatsSectionProps {
  coverageStats: CoverageStats;
  excludedSkus: SKUProfitAnalysis[];
  excludeGradeResell: boolean;
  setExcludeGradeResell: (value: boolean) => void;
  showExcludedProducts: boolean;
  setShowExcludedProducts: (value: boolean) => void;
  filterMarketplace: string;
  formatMoney: (amount: number) => string;
}

export const CoverageStatsSection: React.FC<CoverageStatsSectionProps> = React.memo(({
  coverageStats,
  excludedSkus,
  excludeGradeResell,
  setExcludeGradeResell,
  showExcludedProducts,
  setShowExcludedProducts,
  filterMarketplace,
  formatMoney,
}) => {
  const handleExportExcluded = () => {
    const data = excludedSkus.map(sku => ({
      SKU: sku.sku,
      Name: sku.name,
      Parent: sku.parent,
      Category: sku.category,
      Revenue: sku.totalRevenue,
      Orders: sku.totalOrders,
      Quantity: sku.totalQuantity,
      'Missing Cost': !sku.hasCostData ? 'Yes' : '',
      'Missing Size': !sku.hasSizeData ? 'Yes' : '',
      Fulfillment: sku.fulfillment,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Excluded SKUs');
    XLSX.writeFile(wb, `excluded-skus-${filterMarketplace}-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <span className="font-semibold text-amber-800">Data Coverage: </span>
                <span className="text-amber-700">
                  {coverageStats.calculatedSkus} of {coverageStats.totalSkus} SKUs ({coverageStats.coveragePercent.toFixed(1)}%)
                </span>
              </div>
              {/* Grade & Resell Toggle */}
              <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-white/60 rounded-lg border border-amber-200">
                <label className="text-xs text-amber-700 font-medium cursor-pointer flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={excludeGradeResell}
                    onChange={(e) => setExcludeGradeResell(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Grade & Resell hariç tut</span>
                  {coverageStats.gradeResellCount > 0 && (
                    <span className="text-[10px] text-amber-500">
                      ({coverageStats.gradeResellCount} SKU, {formatMoney(coverageStats.gradeResellRevenue)})
                    </span>
                  )}
                </label>
              </div>
            </div>
            <div className="text-sm text-amber-600">
              {formatMoney(coverageStats.calculatedRevenue)} of {formatMoney(coverageStats.totalRevenue)} revenue ({coverageStats.revenueCoveragePercent.toFixed(1)}%)
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-amber-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all"
                style={{ width: `${coverageStats.revenueCoveragePercent}%` }}
              />
            </div>
          </div>
          {coverageStats.excludedCount > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowExcludedProducts(!showExcludedProducts)}
                  className="flex items-center gap-2 text-xs text-amber-700 hover:text-amber-900 font-medium"
                >
                  {showExcludedProducts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {coverageStats.excludedCount} SKUs excluded (missing cost or size data) - {formatMoney(coverageStats.excludedRevenue)} revenue not analyzed
                </button>
                <button
                  onClick={handleExportExcluded}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 rounded transition-colors"
                  title="Export excluded SKUs to Excel"
                >
                  <Download className="w-3 h-3" />
                  Excel
                </button>
              </div>

              {showExcludedProducts && excludedSkus.length > 0 && (
                <div className="mt-3 bg-white/50 rounded-lg border border-amber-200 overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-amber-100/50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-amber-800">SKU</th>
                          <th className="text-left px-3 py-2 font-medium text-amber-800">Name</th>
                          <th className="text-right px-3 py-2 font-medium text-amber-800">Revenue</th>
                          <th className="text-center px-3 py-2 font-medium text-amber-800">Missing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excludedSkus.map((sku, idx) => (
                          <tr key={sku.sku} className={idx % 2 === 0 ? 'bg-white/30' : 'bg-amber-50/30'}>
                            <td className="px-3 py-1.5 font-mono text-slate-700">{sku.sku}</td>
                            <td className="px-3 py-1.5 text-slate-600 truncate max-w-xs" title={sku.name}>{sku.name}</td>
                            <td className="px-3 py-1.5 text-right text-slate-700">{formatMoney(sku.totalRevenue)}</td>
                            <td className="px-3 py-1.5 text-center">
                              <span className="inline-flex gap-1">
                                {!sku.hasCostData && (
                                  <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px]">Cost</span>
                                )}
                                {!sku.hasSizeData && (
                                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px]">Size</span>
                                )}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-3 py-2 bg-amber-100/30 border-t border-amber-200 text-xs text-amber-700">
                    💡 Cost data: Add product costs in "Cost Data" section • Size data: Add desi values and shipping rates
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

CoverageStatsSection.displayName = 'CoverageStatsSection';
