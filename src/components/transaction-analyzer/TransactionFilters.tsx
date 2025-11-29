/**
 * TransactionFilters - Filter controls for Transaction Analyzer
 */

import React from 'react';
import { Filter } from 'lucide-react';
import type { MarketplaceCode, MarketplaceConfig } from '../../types/transaction';
import { MARKETPLACE_CONFIGS } from '../../constants/marketplaces';

interface TransactionFiltersProps {
  marketplaceCode: MarketplaceCode | null;
  dateRange: { start: string; end: string };
  selectedFulfillment: string;
  comparisonMode: 'none' | 'previous-period' | 'previous-year';
  storedFiles: Array<{ marketplace: string }>;
  comparisonLabel?: string;
  onMarketplaceChange: (value: MarketplaceCode | null) => void;
  onDateRangeChange: (range: { start: string; end: string }) => void;
  onFulfillmentChange: (value: string) => void;
  onComparisonModeChange: (value: 'none' | 'previous-period' | 'previous-year') => void;
}

export const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  marketplaceCode,
  dateRange,
  selectedFulfillment,
  comparisonMode,
  storedFiles,
  comparisonLabel,
  onMarketplaceChange,
  onDateRangeChange,
  onFulfillmentChange,
  onComparisonModeChange
}) => {
  const marketplaceCodes = storedFiles.map(f => f.marketplace as MarketplaceCode);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6 no-print">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-slate-600" />
        <h2 className="text-lg font-semibold text-slate-800">Filters</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Marketplace Filter - Show only if multiple marketplaces */}
        {marketplaceCodes.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Marketplace
            </label>
            <select
              value={marketplaceCode || ''}
              onChange={(e) => onMarketplaceChange(e.target.value as MarketplaceCode || null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">All</option>
              {marketplaceCodes.map(code => (
                <option key={code} value={code}>
                  {MARKETPLACE_CONFIGS[code].currencySymbol} {MARKETPLACE_CONFIGS[code].name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        {/* Fulfillment */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Fulfillment
          </label>
          <select
            value={selectedFulfillment}
            onChange={(e) => onFulfillmentChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All</option>
            <option value="FBA">FBA</option>
            <option value="FBM">FBM</option>
          </select>
        </div>

        {/* Comparison Mode */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Comparison
          </label>
          <select
            value={comparisonMode}
            onChange={(e) => onComparisonModeChange(e.target.value as 'none' | 'previous-period' | 'previous-year')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            disabled={!dateRange.start || !dateRange.end}
          >
            <option value="none">None</option>
            <option value="previous-period">Previous Period</option>
            <option value="previous-year">Previous Year</option>
          </select>
        </div>
      </div>

      {/* Comparison Info */}
      {comparisonMode !== 'none' && comparisonLabel && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <span className="font-semibold">Comparing:</span> {comparisonLabel}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(TransactionFilters);
