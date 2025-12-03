import React from 'react';
import { Filter } from 'lucide-react';

// Marketplace flags
const MARKETPLACE_FLAGS: Record<string, string> = {
  US: '🇺🇸', UK: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸',
  CA: '🇨🇦', AU: '🇦🇺', AE: '🇦🇪', SA: '🇸🇦', SG: '🇸🇬', TR: '🇹🇷',
};

interface FiltersSectionProps {
  startDate: string;
  endDate: string;
  filterMarketplace: string;
  selectedMarketplaces: Set<string>;
  filterFulfillment: string;
  marketplaces: string[];
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  setFilterMarketplace: (marketplace: string) => void;
  setSelectedMarketplaces: (marketplaces: Set<string>) => void;
  toggleMarketplace: (marketplace: string) => void;
  setFilterFulfillment: (fulfillment: string) => void;
  setFilterCategory: (category: string) => void;
}

export const FiltersSection: React.FC<FiltersSectionProps> = React.memo(({
  startDate,
  endDate,
  filterMarketplace,
  selectedMarketplaces,
  filterFulfillment,
  marketplaces,
  setStartDate,
  setEndDate,
  setFilterMarketplace,
  setSelectedMarketplaces,
  toggleMarketplace,
  setFilterFulfillment,
  setFilterCategory,
}) => {
  const hasActiveFilters = startDate || endDate || filterMarketplace !== 'all' || selectedMarketplaces.size > 0 || filterFulfillment !== 'all';

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setFilterMarketplace('all');
    setSelectedMarketplaces(new Set());
    setFilterFulfillment('all');
    setFilterCategory('all');
  };

  // When single marketplace is selected from dropdown, clear multi-select
  const handleMarketplaceDropdownChange = (value: string) => {
    setFilterMarketplace(value);
    if (value !== 'all') {
      setSelectedMarketplaces(new Set());
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-6 sticky top-[68px] z-40">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-slate-600" />
        <h2 className="text-base font-semibold text-slate-800">Filters</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        {/* Marketplace Dropdown */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Marketplace
          </label>
          <select
            value={selectedMarketplaces.size > 0 ? 'multi' : filterMarketplace}
            onChange={(e) => {
              if (e.target.value !== 'multi') {
                handleMarketplaceDropdownChange(e.target.value);
              }
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All Marketplaces</option>
            {selectedMarketplaces.size > 0 && (
              <option value="multi" disabled>
                {selectedMarketplaces.size} selected
              </option>
            )}
            {marketplaces.map(mp => (
              <option key={mp} value={mp}>{MARKETPLACE_FLAGS[mp] || '🌍'} {mp}</option>
            ))}
          </select>
        </div>

        {/* Fulfillment */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Fulfillment
          </label>
          <select
            value={filterFulfillment}
            onChange={(e) => setFilterFulfillment(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All</option>
            <option value="FBA">FBA</option>
            <option value="FBM">FBM</option>
          </select>
        </div>
      </div>

      {/* Multi-Select Marketplace Buttons - Show when multiple marketplaces available */}
      {marketplaces.length > 1 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Quick select:</span>
            <div className="flex flex-wrap gap-1">
              {marketplaces.map(mp => (
                <button
                  key={mp}
                  onClick={() => toggleMarketplace(mp)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedMarketplaces.size === 0
                      ? filterMarketplace === mp
                        ? 'bg-purple-100 text-purple-700 border border-purple-300'
                        : filterMarketplace === 'all'
                        ? 'bg-purple-50 text-purple-600 border border-purple-200'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                      : selectedMarketplaces.has(mp)
                      ? 'bg-purple-100 text-purple-700 border border-purple-300'
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}
                >
                  {MARKETPLACE_FLAGS[mp] || '🌍'} {mp}
                </button>
              ))}
            </div>
            {selectedMarketplaces.size > 0 && (
              <>
                <span className="text-xs text-slate-400">
                  ({selectedMarketplaces.size} selected)
                </span>
                <button
                  onClick={() => setSelectedMarketplaces(new Set())}
                  className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleClearFilters}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
});

FiltersSection.displayName = 'FiltersSection';
