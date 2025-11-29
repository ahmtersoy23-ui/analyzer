import React from 'react';
import { Filter } from 'lucide-react';

interface FiltersSectionProps {
  startDate: string;
  endDate: string;
  filterMarketplace: string;
  filterFulfillment: string;
  marketplaces: string[];
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  setFilterMarketplace: (marketplace: string) => void;
  setFilterFulfillment: (fulfillment: string) => void;
  setFilterCategory: (category: string) => void;
}

export const FiltersSection: React.FC<FiltersSectionProps> = React.memo(({
  startDate,
  endDate,
  filterMarketplace,
  filterFulfillment,
  marketplaces,
  setStartDate,
  setEndDate,
  setFilterMarketplace,
  setFilterFulfillment,
  setFilterCategory,
}) => {
  const hasActiveFilters = startDate || endDate || filterMarketplace !== 'all' || filterFulfillment !== 'all';

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setFilterMarketplace('all');
    setFilterFulfillment('all');
    setFilterCategory('all');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-slate-600" />
        <h2 className="text-lg font-semibold text-slate-800">Filters</h2>
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

        {/* Marketplace */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Marketplace
          </label>
          <select
            value={filterMarketplace}
            onChange={(e) => setFilterMarketplace(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All Marketplaces</option>
            {marketplaces.map(mp => (
              <option key={mp} value={mp}>{mp}</option>
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

      {/* Clear Filters */}
      {hasActiveFilters && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
});

FiltersSection.displayName = 'FiltersSection';
