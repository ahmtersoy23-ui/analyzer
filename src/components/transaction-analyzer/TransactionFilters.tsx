/**
 * TransactionFilters - Filter controls for Transaction Analyzer
 * Updated to match ProductFilters layout (Faz 2)
 */

import React from 'react';
import { Filter, GitCompare } from 'lucide-react';
import type { MarketplaceCode } from '../../types/transaction';

// Marketplace flags for consistent display
const MARKETPLACE_FLAGS: Record<string, string> = {
  US: '🇺🇸', UK: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸',
  CA: '🇨🇦', AU: '🇦🇺', AE: '🇦🇪', SA: '🇸🇦', SG: '🇸🇬', TR: '🇹🇷',
};

interface TransactionFiltersProps {
  marketplaceCode: MarketplaceCode | null;
  dateRange: { start: string; end: string };
  selectedFulfillment: string;
  comparisonMode: 'none' | 'previous-period' | 'previous-year';
  storedFiles: Array<{ marketplace: string }>;
  comparisonDateRange?: { start: Date; end: Date } | null;
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
  comparisonDateRange,
  onMarketplaceChange,
  onDateRangeChange,
  onFulfillmentChange,
  onComparisonModeChange
}) => {
  const marketplaceCodes = storedFiles.map(f => f.marketplace as MarketplaceCode);

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-6 sticky top-[68px] z-40 no-print">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-slate-600" />
        <h2 className="text-base font-semibold text-slate-800">Filters</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Date Range - First (like ProductFilters) */}
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

        {/* Marketplace - Always visible (like ProductFilters) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Marketplace
          </label>
          <select
            value={marketplaceCode || 'all'}
            onChange={(e) => onMarketplaceChange(e.target.value === 'all' ? null : e.target.value as MarketplaceCode)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All Marketplaces</option>
            {marketplaceCodes.map(code => (
              <option key={code} value={code}>
                {MARKETPLACE_FLAGS[code] || '🌍'} {code}
              </option>
            ))}
          </select>
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
            <GitCompare className="w-3.5 h-3.5 inline mr-1" />
            Comparison
          </label>
          <select
            value={comparisonMode}
            onChange={(e) => onComparisonModeChange(e.target.value as 'none' | 'previous-period' | 'previous-year')}
            className={`w-full px-3 py-2 border rounded-lg text-sm ${
              !dateRange.start || !dateRange.end
                ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                : comparisonMode !== 'none'
                ? 'border-purple-300 bg-purple-50 text-purple-700'
                : 'border-slate-300'
            }`}
            disabled={!dateRange.start || !dateRange.end}
          >
            <option value="none">None</option>
            <option value="previous-period">Previous Period</option>
            <option value="previous-year">Previous Year</option>
          </select>
        </div>
      </div>

      {/* Comparison Info - Same format as ProductFilters */}
      {comparisonMode !== 'none' && comparisonDateRange && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <span className="font-semibold">Comparing:</span>
            {' '}
            {new Date(dateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' - '}
            {new Date(dateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' '}
            <span className="text-blue-600">vs</span>
            {' '}
            {comparisonDateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' - '}
            {comparisonDateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(TransactionFilters);
