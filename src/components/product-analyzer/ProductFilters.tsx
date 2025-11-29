/**
 * ProductFilters - Filter controls for Product Analyzer
 */

import React from 'react';
import { Filter } from 'lucide-react';

interface ProductFiltersProps {
  startDate: string;
  endDate: string;
  selectedMarketplace: string;
  selectedFulfillment: string;
  comparisonMode: 'none' | 'previous-period' | 'previous-year';
  marketplaces: string[];
  comparisonDateRange: { start: Date; end: Date } | null;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onMarketplaceChange: (value: string) => void;
  onFulfillmentChange: (value: string) => void;
  onComparisonModeChange: (value: 'none' | 'previous-period' | 'previous-year') => void;
}

export const ProductFilters: React.FC<ProductFiltersProps> = ({
  startDate,
  endDate,
  selectedMarketplace,
  selectedFulfillment,
  comparisonMode,
  marketplaces,
  comparisonDateRange,
  onStartDateChange,
  onEndDateChange,
  onMarketplaceChange,
  onFulfillmentChange,
  onComparisonModeChange
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-slate-600" />
        <h2 className="text-lg font-semibold text-slate-800">Filters</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        {/* Marketplace */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Marketplace
          </label>
          <select
            value={selectedMarketplace}
            onChange={(e) => onMarketplaceChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All Marketplaces</option>
            {marketplaces.map(m => (
              <option key={m} value={m}>{m}</option>
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
            Comparison
          </label>
          <select
            value={comparisonMode}
            onChange={(e) => onComparisonModeChange(e.target.value as 'none' | 'previous-period' | 'previous-year')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            disabled={!startDate || !endDate}
          >
            <option value="none">None</option>
            <option value="previous-period">Previous Period</option>
            <option value="previous-year">Previous Year</option>
          </select>
        </div>
      </div>

      {/* Comparison Info */}
      {comparisonMode !== 'none' && comparisonDateRange && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <span className="font-semibold">Comparing:</span>
            {' '}
            {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' - '}
            {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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

export default React.memo(ProductFilters);
