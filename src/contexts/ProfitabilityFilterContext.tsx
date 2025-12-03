/**
 * ProfitabilityFilterContext
 * Centralized filter state management for Profitability Analyzer
 * Reduces prop drilling and improves component composition
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

// ============================================
// TYPES
// ============================================

export type DetailsViewMode = 'category' | 'parent' | 'name' | 'sku';
export type SortDirection = 'asc' | 'desc';

interface SavedFilters {
  startDate?: string;
  endDate?: string;
  filterMarketplace?: string;
  filterFulfillment?: string;
  selectedMarketplaces?: string[]; // Array for JSON serialization
}

interface ProfitabilityFilterState {
  // Date filters
  startDate: string;
  endDate: string;

  // Main filters
  filterMarketplace: string;
  selectedMarketplaces: Set<string>; // Multi-select marketplaces
  filterFulfillment: string;
  filterCategory: string;
  filterParent: string;
  filterName: string;

  // View options
  detailsViewMode: DetailsViewMode;
  showPerUnit: boolean;
  excludeGradeResell: boolean;

  // Sorting
  sortColumn: string;
  sortDirection: SortDirection;

  // Pagination
  currentPage: number;
  itemsPerPage: number;
}

interface ProfitabilityFilterActions {
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  setFilterMarketplace: (marketplace: string) => void;
  setSelectedMarketplaces: (marketplaces: Set<string>) => void;
  toggleMarketplace: (marketplace: string) => void;
  setFilterFulfillment: (fulfillment: string) => void;
  setFilterCategory: (category: string) => void;
  setFilterParent: (parent: string) => void;
  setFilterName: (name: string) => void;
  setDetailsViewMode: (mode: DetailsViewMode) => void;
  setShowPerUnit: (show: boolean) => void;
  setExcludeGradeResell: (exclude: boolean) => void;
  setSortColumn: (column: string) => void;
  setSortDirection: (direction: SortDirection) => void;
  setCurrentPage: (page: number) => void;
  handleSort: (column: string) => void;
  resetFilters: () => void;
}

type ProfitabilityFilterContextType = ProfitabilityFilterState & ProfitabilityFilterActions;

// ============================================
// CONTEXT
// ============================================

const ProfitabilityFilterContext = createContext<ProfitabilityFilterContextType | undefined>(undefined);

// ============================================
// STORAGE
// ============================================

const STORAGE_KEY = 'profitabilityAnalyzerFilters';

const loadSavedFilters = (): SavedFilters => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const saveFilters = (filters: SavedFilters) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Ignore storage errors
  }
};

// ============================================
// PROVIDER
// ============================================

interface ProfitabilityFilterProviderProps {
  children: ReactNode;
}

export const ProfitabilityFilterProvider: React.FC<ProfitabilityFilterProviderProps> = ({ children }) => {
  // Initialize from localStorage
  const savedFilters = useMemo(() => loadSavedFilters(), []);

  // Date filters
  const [startDate, setStartDate] = useState<string>(savedFilters.startDate || '');
  const [endDate, setEndDate] = useState<string>(savedFilters.endDate || '');

  // Main filters
  const [filterMarketplace, setFilterMarketplace] = useState<string>(savedFilters.filterMarketplace || 'all');
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<Set<string>>(() =>
    new Set(savedFilters.selectedMarketplaces || [])
  );
  const [filterFulfillment, setFilterFulfillment] = useState<string>(savedFilters.filterFulfillment || 'all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterParent, setFilterParent] = useState<string>('all');
  const [filterName, setFilterName] = useState<string>('all');

  // Toggle marketplace in multi-select
  const toggleMarketplace = useCallback((marketplace: string) => {
    setSelectedMarketplaces(prev => {
      const next = new Set(prev);
      if (next.has(marketplace)) {
        next.delete(marketplace);
      } else {
        next.add(marketplace);
      }
      return next;
    });
    // Clear single marketplace filter when using multi-select
    setFilterMarketplace('all');
  }, []);

  // View options
  const [detailsViewMode, setDetailsViewMode] = useState<DetailsViewMode>('sku');
  const [showPerUnit, setShowPerUnit] = useState(false);
  const [excludeGradeResell, setExcludeGradeResell] = useState(true);

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>('totalRevenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  // Save to localStorage when main filters change
  useEffect(() => {
    saveFilters({
      startDate,
      endDate,
      filterMarketplace,
      filterFulfillment,
      selectedMarketplaces: Array.from(selectedMarketplaces)
    });
  }, [startDate, endDate, filterMarketplace, filterFulfillment, selectedMarketplaces]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterMarketplace, selectedMarketplaces, filterFulfillment, filterCategory, filterParent, filterName, startDate, endDate]);

  // Sort handler with smart direction toggle
  const handleSort = useCallback((column: string) => {
    setSortColumn(prev => {
      if (prev === column) {
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      } else {
        // Default: text columns asc, numeric columns desc
        setSortDirection(column === 'name' || column === 'sku' || column === 'category' || column === 'parent' ? 'asc' : 'desc');
        return column;
      }
    });
  }, []);

  // Reset all filters to defaults
  const resetFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setFilterMarketplace('all');
    setSelectedMarketplaces(new Set());
    setFilterFulfillment('all');
    setFilterCategory('all');
    setFilterParent('all');
    setFilterName('all');
    setSortColumn('totalRevenue');
    setSortDirection('desc');
    setCurrentPage(1);
  }, []);

  // Memoized context value
  const value = useMemo<ProfitabilityFilterContextType>(() => ({
    // State
    startDate,
    endDate,
    filterMarketplace,
    selectedMarketplaces,
    filterFulfillment,
    filterCategory,
    filterParent,
    filterName,
    detailsViewMode,
    showPerUnit,
    excludeGradeResell,
    sortColumn,
    sortDirection,
    currentPage,
    itemsPerPage,

    // Actions
    setStartDate,
    setEndDate,
    setFilterMarketplace,
    setSelectedMarketplaces,
    toggleMarketplace,
    setFilterFulfillment,
    setFilterCategory,
    setFilterParent,
    setFilterName,
    setDetailsViewMode,
    setShowPerUnit,
    setExcludeGradeResell,
    setSortColumn,
    setSortDirection,
    setCurrentPage,
    handleSort,
    resetFilters,
  }), [
    startDate,
    endDate,
    filterMarketplace,
    selectedMarketplaces,
    filterFulfillment,
    filterCategory,
    filterParent,
    filterName,
    detailsViewMode,
    showPerUnit,
    excludeGradeResell,
    sortColumn,
    sortDirection,
    currentPage,
    handleSort,
    resetFilters,
    toggleMarketplace,
  ]);

  return (
    <ProfitabilityFilterContext.Provider value={value}>
      {children}
    </ProfitabilityFilterContext.Provider>
  );
};

// ============================================
// HOOK
// ============================================

export const useProfitabilityFilters = (): ProfitabilityFilterContextType => {
  const context = useContext(ProfitabilityFilterContext);
  if (context === undefined) {
    throw new Error('useProfitabilityFilters must be used within a ProfitabilityFilterProvider');
  }
  return context;
};

export default ProfitabilityFilterContext;
