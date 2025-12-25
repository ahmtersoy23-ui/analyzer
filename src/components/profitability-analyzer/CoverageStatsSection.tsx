import React, { useState, useCallback } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ChevronRight, Download, Check, X, Edit2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { SKUProfitAnalysis } from '../../services/profitability/profitabilityAnalytics';
import type { ProductCostData } from '../../types/profitability';

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

// Update for a single SKU's cost/size data (including override fields for FBM)
interface CostSizeUpdate {
  sku: string;
  name: string;
  cost: number | null;
  size: number | null;
  customShipping?: number | null;
  fbmSource?: 'TR' | 'US' | 'BOTH' | null;
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
  // New props for inline editing
  costData?: ProductCostData[];
  onCostDataUpdate?: (updates: CostSizeUpdate[]) => void;
}

// Inline edit row component
const EditableRow: React.FC<{
  sku: SKUProfitAnalysis;
  existingCost: number | null;
  existingSize: number | null;
  existingCustomShipping: number | null;
  existingFbmSource: 'TR' | 'US' | 'BOTH' | null;
  onSave: (update: CostSizeUpdate) => void;
  formatMoney: (amount: number) => string;
  idx: number;
}> = ({ sku, existingCost, existingSize, existingCustomShipping, existingFbmSource, onSave, formatMoney, idx }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [cost, setCost] = useState<string>(existingCost?.toString() || '');
  const [size, setSize] = useState<string>(existingSize?.toString() || '');
  const [customShipping, setCustomShipping] = useState<string>(existingCustomShipping?.toString() || '');
  const [fbmSource, setFbmSource] = useState<'TR' | 'US' | 'BOTH' | ''>(existingFbmSource || '');

  const isFBM = sku.fulfillment === 'FBM';

  const handleSave = () => {
    const costValue = cost.trim() ? parseFloat(cost) : null;
    const sizeValue = size.trim() ? parseFloat(size) : null;
    const customShippingValue = customShipping.trim() ? parseFloat(customShipping) : null;
    const fbmSourceValue = fbmSource || null;

    // Only save if at least one value is provided
    if (costValue !== null || sizeValue !== null || customShippingValue !== null || fbmSourceValue !== null) {
      onSave({
        sku: sku.sku,
        name: sku.name,
        cost: costValue,
        size: sizeValue,
        customShipping: customShippingValue,
        fbmSource: fbmSourceValue,
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setCost(existingCost?.toString() || '');
    setSize(existingSize?.toString() || '');
    setCustomShipping(existingCustomShipping?.toString() || '');
    setFbmSource(existingFbmSource || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <tr className="bg-blue-50/50">
        <td className="px-3 py-1.5 font-mono text-slate-700">{sku.sku}</td>
        <td className="px-3 py-1.5 text-slate-600 truncate max-w-[150px]" title={sku.name}>{sku.name}</td>
        <td className="px-3 py-1.5 text-right text-slate-700">{formatMoney(sku.totalRevenue)}</td>
        <td className="px-3 py-1.5 text-center text-[10px] text-slate-500">{sku.fulfillment}</td>
        <td className="px-2 py-1">
          <input
            type="number"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Cost"
            className={`w-16 px-1.5 py-0.5 text-xs border rounded text-right ${
              !sku.hasCostData ? 'border-red-300 bg-red-50' : 'border-slate-300'
            }`}
            autoFocus
          />
        </td>
        <td className="px-2 py-1">
          <input
            type="number"
            step="0.1"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Desi"
            className={`w-14 px-1.5 py-0.5 text-xs border rounded text-right ${
              !sku.hasSizeData ? 'border-orange-300 bg-orange-50' : 'border-slate-300'
            }`}
          />
        </td>
        {/* FBM Override fields */}
        <td className="px-2 py-1">
          {isFBM ? (
            <input
              type="number"
              step="0.1"
              value={customShipping}
              onChange={(e) => setCustomShipping(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="$"
              className="w-14 px-1.5 py-0.5 text-xs border border-purple-300 bg-purple-50 rounded text-right"
              title="Manuel kargo ücreti"
            />
          ) : (
            <span className="text-slate-300">-</span>
          )}
        </td>
        <td className="px-2 py-1">
          {isFBM ? (
            <select
              value={fbmSource}
              onChange={(e) => setFbmSource(e.target.value as 'TR' | 'US' | 'BOTH' | '')}
              className="w-16 px-1 py-0.5 text-xs border border-purple-300 bg-purple-50 rounded"
              title="Gönderim kaynağı"
            >
              <option value="">-</option>
              <option value="TR">TR</option>
              <option value="US">US</option>
              <option value="BOTH">BOTH</option>
            </select>
          ) : (
            <span className="text-slate-300">-</span>
          )}
        </td>
        <td className="px-2 py-1">
          <div className="flex items-center gap-1">
            <button
              onClick={handleSave}
              className="p-1 text-green-600 hover:bg-green-100 rounded"
              title="Kaydet"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1 text-red-600 hover:bg-red-100 rounded"
              title="İptal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className={`${idx % 2 === 0 ? 'bg-white/30' : 'bg-amber-50/30'} hover:bg-blue-50/50 cursor-pointer group`}
      onClick={() => setIsEditing(true)}
    >
      <td className="px-3 py-1.5 font-mono text-slate-700">{sku.sku}</td>
      <td className="px-3 py-1.5 text-slate-600 truncate max-w-[150px]" title={sku.name}>{sku.name}</td>
      <td className="px-3 py-1.5 text-right text-slate-700">{formatMoney(sku.totalRevenue)}</td>
      <td className="px-3 py-1.5 text-center text-[10px] text-slate-500">{sku.fulfillment}</td>
      <td className="px-3 py-1.5 text-center">
        {existingCost !== null ? (
          <span className="text-green-700">${existingCost.toFixed(2)}</span>
        ) : (
          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px]">Eksik</span>
        )}
      </td>
      <td className="px-3 py-1.5 text-center">
        {existingSize !== null ? (
          <span className="text-green-700">{existingSize}</span>
        ) : (
          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px]">Eksik</span>
        )}
      </td>
      {/* FBM Override display */}
      <td className="px-3 py-1.5 text-center">
        {isFBM ? (
          existingCustomShipping !== null ? (
            <span className="text-purple-700">${existingCustomShipping}</span>
          ) : (
            <span className="text-slate-300">-</span>
          )
        ) : (
          <span className="text-slate-300">-</span>
        )}
      </td>
      <td className="px-3 py-1.5 text-center">
        {isFBM ? (
          existingFbmSource ? (
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px]">{existingFbmSource}</span>
          ) : (
            <span className="text-slate-300">-</span>
          )
        ) : (
          <span className="text-slate-300">-</span>
        )}
      </td>
      <td className="px-2 py-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Düzenle"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
};

export const CoverageStatsSection: React.FC<CoverageStatsSectionProps> = React.memo(({
  coverageStats,
  excludedSkus,
  excludeGradeResell,
  setExcludeGradeResell,
  showExcludedProducts,
  setShowExcludedProducts,
  filterMarketplace,
  formatMoney,
  costData = [],
  onCostDataUpdate,
}) => {
  // Section collapsed state - collapsed by default
  const [sectionExpanded, setSectionExpanded] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<CostSizeUpdate[]>([]);

  // Get existing cost/size/override for a SKU
  const getExistingData = useCallback((sku: string) => {
    const existing = costData.find(c => c.sku === sku);
    return {
      cost: existing?.cost ?? null,
      size: existing?.size ?? null,
      customShipping: existing?.customShipping ?? null,
      fbmSource: existing?.fbmSource ?? null,
    };
  }, [costData]);

  // Handle individual row save
  const handleRowSave = useCallback((update: CostSizeUpdate) => {
    setPendingUpdates(prev => {
      // Replace if exists, otherwise add
      const filtered = prev.filter(u => u.sku !== update.sku);
      return [...filtered, update];
    });

    // Auto-save immediately if callback provided
    if (onCostDataUpdate) {
      onCostDataUpdate([update]);
    }
  }, [onCostDataUpdate]);

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

  // Check if inline editing is enabled
  const canEdit = !!onCostDataUpdate;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl mb-6">
      {/* Clickable Header - toggles section expansion */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-amber-100/30 rounded-xl transition-colors"
        onClick={() => setSectionExpanded(!sectionExpanded)}
      >
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-800">Data Coverage</span>
          <ChevronRight className={`w-4 h-4 text-amber-500 transition-transform ${sectionExpanded ? 'rotate-90' : ''}`} />
        </div>
        {/* Summary - always visible */}
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-amber-700">
              {coverageStats.calculatedSkus}/{coverageStats.totalSkus} SKUs ({coverageStats.coveragePercent.toFixed(1)}%)
            </span>
            {/* Excluded breakdown */}
            {(coverageStats.excludedCount > 0 || coverageStats.gradeResellCount > 0) && (
              <div className="flex items-center gap-2 text-xs">
                {coverageStats.excludedCount > 0 && (
                  <span className="text-red-600" title="Missing cost or size data">
                    Excluded: {formatMoney(coverageStats.excludedRevenue)}
                  </span>
                )}
                {coverageStats.gradeResellCount > 0 && (
                  <span className="text-orange-600" title="Grade & Resell products">
                    G&R: {formatMoney(coverageStats.gradeResellRevenue)}
                  </span>
                )}
              </div>
            )}
          </div>
          <span className="text-sm text-amber-600">
            {formatMoney(coverageStats.calculatedRevenue)} / {formatMoney(coverageStats.totalRevenue)} ({coverageStats.revenueCoveragePercent.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Collapsible Content */}
      {sectionExpanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              {/* Grade & Resell Toggle */}
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/60 rounded-lg border border-amber-200">
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

              {/* Progress Bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-amber-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all"
                    style={{ width: `${coverageStats.revenueCoveragePercent}%` }}
                  />
                </div>
              </div>

              {coverageStats.excludedCount > 0 && (
                <div className="mt-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowExcludedProducts(!showExcludedProducts);
                      }}
                      className="flex items-center gap-2 text-xs text-amber-700 hover:text-amber-900 font-medium"
                    >
                      {showExcludedProducts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {coverageStats.excludedCount} SKUs excluded (missing cost or size data) - {formatMoney(coverageStats.excludedRevenue)} revenue not analyzed
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportExcluded();
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 rounded transition-colors"
                      title="Export excluded SKUs to Excel"
                    >
                      <Download className="w-3 h-3" />
                      Excel
                    </button>
                  </div>

                  {showExcludedProducts && excludedSkus.length > 0 && (
                    <div className="mt-3 bg-white/50 rounded-lg border border-amber-200 overflow-hidden">
                      {canEdit && (
                        <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 flex items-center gap-2">
                          <Edit2 className="w-3.5 h-3.5" />
                          Satıra tıklayarak Cost, Size ve FBM override değerlerini doğrudan girebilirsiniz
                        </div>
                      )}
                      <div className="max-h-80 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-amber-100/50 sticky top-0">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium text-amber-800">SKU</th>
                              <th className="text-left px-3 py-2 font-medium text-amber-800">Name</th>
                              <th className="text-right px-3 py-2 font-medium text-amber-800">Revenue</th>
                              <th className="text-center px-3 py-2 font-medium text-amber-800">Type</th>
                              <th className="text-center px-3 py-2 font-medium text-amber-800">Cost ($)</th>
                              <th className="text-center px-3 py-2 font-medium text-amber-800">Desi</th>
                              <th className="text-center px-3 py-2 font-medium text-purple-700" title="FBM Manuel Kargo">Kargo $</th>
                              <th className="text-center px-3 py-2 font-medium text-purple-700" title="FBM Gönderim Kaynağı">Kaynak</th>
                              <th className="w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {excludedSkus.map((sku, idx) => {
                              const existing = getExistingData(sku.sku);
                              // Check if there's a pending update
                              const pending = pendingUpdates.find(u => u.sku === sku.sku);
                              const effectiveCost = pending?.cost ?? existing.cost;
                              const effectiveSize = pending?.size ?? existing.size;
                              const effectiveCustomShipping = pending?.customShipping ?? existing.customShipping;
                              const effectiveFbmSource = pending?.fbmSource ?? existing.fbmSource;

                              if (canEdit) {
                                return (
                                  <EditableRow
                                    key={`${sku.sku}::${sku.marketplace || 'ALL'}`}
                                    sku={sku}
                                    existingCost={effectiveCost}
                                    existingSize={effectiveSize}
                                    existingCustomShipping={effectiveCustomShipping}
                                    existingFbmSource={effectiveFbmSource}
                                    onSave={handleRowSave}
                                    formatMoney={formatMoney}
                                    idx={idx}
                                  />
                                );
                              }

                              const isFBM = sku.fulfillment === 'FBM';
                              return (
                                <tr key={`${sku.sku}::${sku.marketplace || 'ALL'}`} className={idx % 2 === 0 ? 'bg-white/30' : 'bg-amber-50/30'}>
                                  <td className="px-3 py-1.5 font-mono text-slate-700">{sku.sku}</td>
                                  <td className="px-3 py-1.5 text-slate-600 truncate max-w-xs" title={sku.name}>{sku.name}</td>
                                  <td className="px-3 py-1.5 text-right text-slate-700">{formatMoney(sku.totalRevenue)}</td>
                                  <td className="px-3 py-1.5 text-center text-[10px] text-slate-500">{sku.fulfillment}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    {!sku.hasCostData && (
                                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px]">Eksik</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-center">
                                    {!sku.hasSizeData && (
                                      <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px]">Eksik</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-center text-slate-300">{isFBM ? '-' : '-'}</td>
                                  <td className="px-3 py-1.5 text-center text-slate-300">{isFBM ? '-' : '-'}</td>
                                  <td></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-3 py-2 bg-amber-100/30 border-t border-amber-200 text-xs text-amber-700">
                        {canEdit
                          ? 'Değerler otomatik kaydedilir. Tabloya topluca eklemek için Cost Data sekmesini kullanabilirsiniz.'
                          : 'Cost data: Add product costs in "Cost Data" section - Size data: Add desi values and shipping rates'
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

CoverageStatsSection.displayName = 'CoverageStatsSection';
