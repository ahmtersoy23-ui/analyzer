/**
 * Product Analyzer - Clean Version
 * Shows product analytics with NAME-based grouping (not SKU-based)
 * Data comes pre-enriched from TransactionAnalyzer
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Package,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Tag
} from 'lucide-react';
import { TransactionData } from '../types/transaction';
import {
  calculateGlobalCosts,
  calculateProductAnalytics,
  calculateCategoryAnalytics,
  calculateParentAnalytics,
  GlobalCosts
} from '../services/analytics/productAnalytics';
import { formatPercent, createMoneyFormatter } from '../utils/formatters';
import { ComparisonBadge } from './shared/ComparisonBadge';
import { ProductFilters } from './product-analyzer/ProductFilters';
import { CategorySummary } from './product-analyzer/CategorySummary';
import { DetailsTable } from './product-analyzer/DetailsTable';

// ============================================================================
// PROPS
// ============================================================================

interface ProductAnalyzerProps {
  transactionData: TransactionData[];
}

// ============================================================================
// HELPER FUNCTIONS (most moved to utils/formatters.ts)
// ============================================================================

// ============================================================================
// COMPONENT
// ============================================================================

const ProductAnalyzer: React.FC<ProductAnalyzerProps> = ({
  transactionData
}) => {
  // ============================================================================
  // STATE - Filters (independent from Transaction Analyzer)
  // ============================================================================

  // Load saved filters from localStorage (independent state)
  interface ProductSavedFilters {
    startDate?: string;
    endDate?: string;
    selectedMarketplace?: string;
    selectedFulfillment?: string;
    comparisonMode?: 'none' | 'previous-period' | 'previous-year';
  }

  const loadSavedFilters = (): ProductSavedFilters => {
    try {
      const saved = localStorage.getItem('productAnalyzerFilters');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const [startDate, setStartDate] = useState<string>(() => loadSavedFilters().startDate || '');
  const [endDate, setEndDate] = useState<string>(() => loadSavedFilters().endDate || '');
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>(() => loadSavedFilters().selectedMarketplace || 'all');
  const [selectedFulfillment, setSelectedFulfillment] = useState<string>(() => loadSavedFilters().selectedFulfillment || 'all');
  const [comparisonMode, setComparisonMode] = useState<'none' | 'previous-period' | 'previous-year'>(() => loadSavedFilters().comparisonMode || 'none');

  // Details table filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedParent, setSelectedParent] = useState<string>('all');
  const [selectedName, setSelectedName] = useState<string>('all');

  // Details table sorting
  const [sortColumn, setSortColumn] = useState<string>('totalSales');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Expanded sections
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Collapsible sections
  const [showTop20Products, setShowTop20Products] = useState(false);
  const [showTop20Parents, setShowTop20Parents] = useState(false);

  // Details view mode
  const [detailsViewMode, setDetailsViewMode] = useState<'category' | 'parent' | 'name'>('name');

  // ============================================================================
  // CURRENCY FORMATTING
  // ============================================================================

  // Format money based on selected marketplace (memoized formatter)
  const formatMoney = useMemo(() => createMoneyFormatter(selectedMarketplace), [selectedMarketplace]);

  // ============================================================================
  // COMPARISON HELPERS
  // ============================================================================

  const calculateComparisonDateRange = (): { start: Date; end: Date } | null => {
    if (!startDate || !endDate || comparisonMode === 'none') return null;

    const currentStart = new Date(startDate);
    const currentEnd = new Date(endDate);
    const daysDiff = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));

    if (comparisonMode === 'previous-period') {
      const prevEnd = new Date(currentStart);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - daysDiff + 1);
      return { start: prevStart, end: prevEnd };
    } else {
      // previous-year
      const prevStart = new Date(currentStart);
      prevStart.setFullYear(prevStart.getFullYear() - 1);
      const prevEnd = new Date(currentEnd);
      prevEnd.setFullYear(prevEnd.getFullYear() - 1);
      return { start: prevStart, end: prevEnd };
    }
  };

  const comparisonDateRange = calculateComparisonDateRange();

  // ============================================================================
  // COMPUTED - Global Costs (with proportional advertising based on fulfillment)
  // ============================================================================

  const globalCosts: GlobalCosts = useMemo(() => {
    const mpCode = selectedMarketplace === 'all' ? null : selectedMarketplace;

    // Step 1: Get ALL transactions for date + marketplace (no fulfillment filter)
    // This is for calculating the advertising percentage
    const allTransactionsForPeriod = transactionData.filter(t => {
      // Date filtering
      if (startDate || endDate) {
        const transactionDate = new Date(t.date);
        if (startDate && transactionDate < new Date(startDate)) return false;
        if (endDate && transactionDate > new Date(endDate)) return false;
      }
      // Marketplace filtering
      if (selectedMarketplace !== 'all' && t.marketplaceCode !== selectedMarketplace) return false;
      return true;
    });

    // Step 2: Calculate total sales for the period (all fulfillment types)
    const allOrders = allTransactionsForPeriod.filter(t => t.categoryType === 'Order' && t.sku);
    const totalSalesAllFulfillment = allOrders.reduce((sum, t) => {
      const sourceCurrency = t.marketplaceCode ?
        (mpCode ? t.productSales : t.productSales) : t.productSales;
      return sum + sourceCurrency;
    }, 0);

    // Step 3: Calculate raw costs from all transactions (no fulfillment filter for ads)
    const rawCosts = calculateGlobalCosts(allTransactionsForPeriod, mpCode);

    // Step 4: Calculate advertising percentage
    const advertisingPercentage = totalSalesAllFulfillment > 0
      ? rawCosts.advertising / totalSalesAllFulfillment
      : 0;

    // Step 5: If fulfillment filter is applied, adjust advertising proportionally
    // But FBA/FBM costs stay the same (they're not per-order, they're global costs)
    if (selectedFulfillment !== 'all') {
      // Calculate filtered sales for proportional advertising
      const filteredOrders = allOrders.filter(t => t.fulfillment === selectedFulfillment);
      const filteredSales = filteredOrders.reduce((sum, t) => sum + t.productSales, 0);

      // Proportional advertising = filtered sales * advertising percentage
      const proportionalAdvertising = filteredSales * advertisingPercentage;

      // Calculate filtered VAT
      const filteredVat = filteredOrders.reduce((sum, t) => sum + (t.vat || 0), 0);

      return {
        advertising: proportionalAdvertising,
        // FBA/FBM costs are global - show the relevant one, hide the other
        fba: selectedFulfillment === 'FBA' ? rawCosts.fba : 0,
        fbm: selectedFulfillment === 'FBM' ? rawCosts.fbm : 0,
        vat: filteredVat
      };
    }

    return rawCosts;
  }, [transactionData, startDate, endDate, selectedMarketplace, selectedFulfillment]);

  // ============================================================================
  // COMPUTED - Filtered Transactions
  // ============================================================================

  const filteredTransactions = useMemo(() => {
    return transactionData.filter(t => {
      // SKU validation
      if (!t.sku) return false;

      // Date filtering
      if (startDate || endDate) {
        const transactionDate = new Date(t.date);
        if (startDate && transactionDate < new Date(startDate)) return false;
        if (endDate && transactionDate > new Date(endDate)) return false;
      }

      // Marketplace filtering
      if (selectedMarketplace !== 'all' && t.marketplaceCode !== selectedMarketplace) return false;

      // Fulfillment filtering
      if (selectedFulfillment !== 'all' && t.fulfillment !== selectedFulfillment) return false;

      return true;
    });
  }, [transactionData, startDate, endDate, selectedMarketplace, selectedFulfillment]);

  // ============================================================================
  // COMPUTED - Analytics
  // ============================================================================

  const products = useMemo(() => {
    // Pass marketplace for currency conversion (null or 'all' means convert to USD)
    const mpCode = selectedMarketplace === 'all' ? null : selectedMarketplace;
    return calculateProductAnalytics(filteredTransactions, mpCode);
  }, [filteredTransactions, selectedMarketplace]);

  // Calculate FBA and FBM sales separately for percentage calculations
  // IMPORTANT: These must be calculated from unfiltered transactions (date + marketplace only)
  // so that percentages remain constant regardless of fulfillment filter
  const salesByFulfillment = useMemo(() => {
    // Filter by date and marketplace only (no fulfillment filter)
    const allTransactionsForPeriod = transactionData.filter(t => {
      if (!t.sku) return false;
      // Date filtering
      if (startDate || endDate) {
        const transactionDate = new Date(t.date);
        if (startDate && transactionDate < new Date(startDate)) return false;
        if (endDate && transactionDate > new Date(endDate)) return false;
      }
      // Marketplace filtering
      if (selectedMarketplace !== 'all' && t.marketplaceCode !== selectedMarketplace) return false;
      return true;
    });

    // Get all orders
    const allOrders = allTransactionsForPeriod.filter(t => t.categoryType === 'Order');

    // Calculate sales by fulfillment type
    const fbaSales = allOrders
      .filter(t => t.fulfillment === 'FBA')
      .reduce((sum, t) => sum + t.productSales, 0);

    // All non-FBA orders are counted as FBM (including 'Unknown', 'FBM', 'Merchant', etc.)
    const fbmSales = allOrders
      .filter(t => t.fulfillment !== 'FBA')
      .reduce((sum, t) => sum + t.productSales, 0);

    const totalSales = fbaSales + fbmSales;

    return { totalSales, fbaSales, fbmSales };
  }, [transactionData, startDate, endDate, selectedMarketplace]);

  const categories = useMemo(() =>
    calculateCategoryAnalytics(products, filteredTransactions),
    [products, filteredTransactions]
  );

  // Comparison analytics (for previous period/year)
  const comparisonTransactions = useMemo(() => {
    if (!comparisonDateRange) return [];

    return transactionData.filter(t => {
      if (!t.sku) return false;

      const transactionDate = new Date(t.date);
      if (transactionDate < comparisonDateRange.start || transactionDate > comparisonDateRange.end) return false;

      if (selectedMarketplace !== 'all' && t.marketplaceCode !== selectedMarketplace) return false;
      if (selectedFulfillment !== 'all' && t.fulfillment !== selectedFulfillment) return false;

      return true;
    });
  }, [transactionData, comparisonDateRange, selectedMarketplace, selectedFulfillment]);

  const comparisonProducts = useMemo(() => {
    if (!comparisonDateRange) return [];
    const mpCode = selectedMarketplace === 'all' ? null : selectedMarketplace;
    return calculateProductAnalytics(comparisonTransactions, mpCode);
  }, [comparisonTransactions, comparisonDateRange, selectedMarketplace]);

  const comparisonCategories = useMemo(() =>
    comparisonDateRange ? calculateCategoryAnalytics(comparisonProducts, comparisonTransactions) : [],
    [comparisonProducts, comparisonTransactions, comparisonDateRange]
  );

  const parents = useMemo(() =>
    calculateParentAnalytics(products),
    [products]
  );

  // ============================================================================
  // COMPUTED - Filter Options
  // ============================================================================

  const marketplaces = useMemo(() =>
    Array.from(new Set(transactionData.map(t => t.marketplaceCode).filter(Boolean))).sort(),
    [transactionData]
  );

  const categoryNames = useMemo(() =>
    Array.from(new Set(products.map(p => p.category))).sort(),
    [products]
  );

  // Filtered parent names based on selected category
  const parentNames = useMemo(() => {
    const filteredProducts = selectedCategory !== 'all'
      ? products.filter(p => p.category === selectedCategory)
      : products;
    return Array.from(new Set(filteredProducts.map(p => p.parent))).sort();
  }, [products, selectedCategory]);

  // Filtered product names based on selected category and parent
  const productNames = useMemo(() => {
    let filteredProducts = products;
    if (selectedCategory !== 'all') {
      filteredProducts = filteredProducts.filter(p => p.category === selectedCategory);
    }
    if (selectedParent !== 'all') {
      filteredProducts = filteredProducts.filter(p => p.parent === selectedParent);
    }
    return Array.from(new Set(filteredProducts.map(p => p.name))).sort();
  }, [products, selectedCategory, selectedParent]);

  // ============================================================================
  // COMPUTED - Top 20 Products & Parents
  // ============================================================================

  const top20Products = useMemo(() => products.slice(0, 20), [products]);
  const top20Parents = useMemo(() => parents.slice(0, 20), [parents]);

  // Comparison parents (for previous period/year)
  const comparisonParents = useMemo(() =>
    comparisonDateRange ? calculateParentAnalytics(comparisonProducts) : [],
    [comparisonProducts, comparisonDateRange]
  );

  // ============================================================================
  // COMPUTED - Comparison Lookup Maps (O(1) lookup instead of O(n) find)
  // ============================================================================

  const comparisonProductMap = useMemo(() =>
    new Map(comparisonProducts.map(p => [p.name, p])),
    [comparisonProducts]
  );

  const comparisonParentMap = useMemo(() =>
    new Map(comparisonParents.map(p => [p.parent, p])),
    [comparisonParents]
  );

  const comparisonCategoryMap = useMemo(() =>
    new Map(comparisonCategories.map(c => [c.category, c])),
    [comparisonCategories]
  );

  // ============================================================================
  // COMPUTED - Details Table Data (all products with filtering & sorting)
  // ============================================================================

  const detailsProducts = useMemo(() => {
    // Start with all products
    let filtered = [...products];

    // Apply filters
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (selectedParent !== 'all') {
      filtered = filtered.filter(p => p.parent === selectedParent);
    }

    if (selectedName !== 'all') {
      filtered = filtered.filter(p => p.name === selectedName);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: number = 0;
      let bValue: number = 0;

      switch (sortColumn) {
        case 'name':
          return sortDirection === 'asc'
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        case 'category':
          return sortDirection === 'asc'
            ? a.category.localeCompare(b.category)
            : b.category.localeCompare(a.category);
        case 'totalSales':
          aValue = a.totalSales;
          bValue = b.totalSales;
          break;
        case 'change':
          // For change, we need to compare with comparison data (O(1) Map lookup)
          const aPrev = comparisonProductMap.get(a.name);
          const bPrev = comparisonProductMap.get(b.name);
          aValue = aPrev ? ((a.totalSales - aPrev.totalSales) / aPrev.totalSales) * 100 : 0;
          bValue = bPrev ? ((b.totalSales - bPrev.totalSales) / bPrev.totalSales) * 100 : 0;
          break;
        case 'totalOrders':
          aValue = a.totalOrders;
          bValue = b.totalOrders;
          break;
        case 'quantity':
          aValue = a.variants.reduce((sum, v) => sum + v.quantity, 0);
          bValue = b.variants.reduce((sum, v) => sum + v.quantity, 0);
          break;
        case 'avgOrderValue':
          aValue = a.avgOrderValue;
          bValue = b.avgOrderValue;
          break;
        case 'fbaRate':
          aValue = a.totalSales > 0 ? (a.fbaSales / a.totalSales) * 100 : 0;
          bValue = b.totalSales > 0 ? (b.fbaSales / b.totalSales) * 100 : 0;
          break;
        case 'fbaFees':
          aValue = a.fbaFees;
          bValue = b.fbaFees;
          break;
        case 'sellingFees':
          aValue = a.sellingFees;
          bValue = b.sellingFees;
          break;
        case 'totalRefundLoss':
          // Sort by refund loss percentage (refund loss / total sales)
          aValue = a.totalSales > 0 ? (a.totalRefundLoss / a.totalSales) * 100 : 0;
          bValue = b.totalSales > 0 ? (b.totalRefundLoss / b.totalSales) * 100 : 0;
          break;
        default:
          aValue = a.totalSales;
          bValue = b.totalSales;
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return filtered;
  }, [products, selectedCategory, selectedParent, selectedName, sortColumn, sortDirection, comparisonProductMap]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSort = useCallback((column: string) => {
    setSortColumn(prev => {
      if (prev === column) {
        // Toggle direction if same column
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      } else {
        // New column, default to descending for numbers, ascending for text
        setSortDirection(column === 'name' || column === 'category' ? 'asc' : 'desc');
        return column;
      }
    });
  }, []);

  const toggleProduct = (name: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedProducts(newExpanded);
  };

  const toggleParent = (parent: string) => {
    const newExpanded = new Set(expandedParents);
    if (newExpanded.has(parent)) {
      newExpanded.delete(parent);
    } else {
      newExpanded.add(parent);
    }
    setExpandedParents(newExpanded);
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Save filters to localStorage whenever they change
  useEffect(() => {
    const filters = {
      startDate,
      endDate,
      selectedMarketplace,
      selectedFulfillment,
      comparisonMode
    };
    localStorage.setItem('productAnalyzerFilters', JSON.stringify(filters));
  }, [startDate, endDate, selectedMarketplace, selectedFulfillment, comparisonMode]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!transactionData.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Data Available</h3>
            <p className="text-slate-500">
              Load transaction data from Phase 1 to see product analytics.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2 flex items-center gap-3">
                <Package className="w-8 h-8 text-green-600" />
                Product Analyzer
              </h1>
              <p className="text-slate-600">
                Name-based product analytics with category, parent, and variant insights
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <ProductFilters
          startDate={startDate}
          endDate={endDate}
          selectedMarketplace={selectedMarketplace}
          selectedFulfillment={selectedFulfillment}
          comparisonMode={comparisonMode}
          marketplaces={marketplaces}
          comparisonDateRange={comparisonDateRange}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onMarketplaceChange={setSelectedMarketplace}
          onFulfillmentChange={setSelectedFulfillment}
          onComparisonModeChange={setComparisonMode}
        />

        {/* Category Summary */}
        <CategorySummary
          categories={categories}
          comparisonCategories={comparisonCategories}
          comparisonMode={comparisonMode}
          selectedMarketplace={selectedMarketplace}
          selectedFulfillment={selectedFulfillment}
          startDate={startDate}
          endDate={endDate}
          expandedCategories={expandedCategories}
          formatMoney={formatMoney}
          onToggleCategory={toggleCategory}
        />

        {/* Financial Overview */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm p-4 mb-6 border border-blue-100">
          <h2 className="text-base font-semibold text-slate-800 mb-3">
            💰 Financial Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600">Advertising Cost</span>
                <TrendingUp className="w-4 h-4 text-red-500" />
              </div>
              <div className="text-lg font-bold text-red-600">
                {formatMoney(globalCosts.advertising)}
              </div>
              <div className="text-xs text-slate-500">
                {salesByFulfillment.totalSales > 0
                  ? formatPercent((globalCosts.advertising / salesByFulfillment.totalSales) * 100)
                  : '0.0%'} of total sales
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600">FBA Cost</span>
                <Package className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-lg font-bold text-orange-600">
                {formatMoney(globalCosts.fba)}
              </div>
              <div className="text-xs text-slate-500">
                {salesByFulfillment.fbaSales > 0
                  ? formatPercent((globalCosts.fba / salesByFulfillment.fbaSales) * 100)
                  : '0.0%'} of FBA sales
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600">FBM Cost</span>
                <Package className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-lg font-bold text-purple-600">
                {formatMoney(globalCosts.fbm)}
              </div>
              <div className="text-xs text-slate-500">
                {salesByFulfillment.fbmSales > 0
                  ? formatPercent((globalCosts.fbm / salesByFulfillment.fbmSales) * 100)
                  : '0.0%'} of FBM sales
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600">VAT/GST</span>
                <Tag className="w-4 h-4 text-green-500" />
              </div>
              <div className="text-lg font-bold text-green-600">
                {formatMoney(globalCosts.vat)}
              </div>
              <div className="text-xs text-slate-500">
                {salesByFulfillment.totalSales > 0
                  ? formatPercent((globalCosts.vat / salesByFulfillment.totalSales) * 100)
                  : '0.0%'} of total sales
              </div>
            </div>
          </div>
        </div>

        {/* Top 20 Products - Collapsible */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <button
            onClick={() => setShowTop20Products(!showTop20Products)}
            className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-xl"
          >
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Top 20 Products
            </h2>
            {showTop20Products ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {showTop20Products && (
          <div className="px-6 pb-6 space-y-2">
            {top20Products.map((product, idx) => {
              const prevProduct = comparisonProductMap.get(product.name);

              return (
              <div key={product.name}>
                <div
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition"
                  onClick={() => toggleProduct(product.name)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-sm font-bold text-slate-400 w-8">#{idx + 1}</div>
                    <div className="text-left">
                      <div className="font-medium text-slate-800">{product.name}</div>
                      <div className="text-xs text-slate-500">
                        {product.category} · ASIN: {product.asin}
                      </div>
                    </div>
                  </div>
                  <div className="text-right mr-4 flex items-center gap-2">
                    <div>
                      <div className="font-bold text-slate-800">{formatMoney(product.totalSales)}</div>
                      <div className="text-xs text-slate-500">
                        {product.totalOrders} orders · {product.variants.length} variants
                      </div>
                    </div>
                    {comparisonMode !== 'none' && prevProduct && (
                      <ComparisonBadge current={product.totalSales} previous={prevProduct.totalSales} />
                    )}
                  </div>
                  {expandedProducts.has(product.name) ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                {/* Expanded: Variants */}
                {expandedProducts.has(product.name) && (
                  <div className="mt-2 ml-12 p-4 bg-white border border-slate-200 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-2">Variants (SKUs):</div>
                    <div className="space-y-1">
                      {product.variants.map((v, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-slate-600">
                            {v.sku} ({v.fulfillment})
                          </span>
                          <span className="text-slate-800 font-medium">
                            {formatMoney(v.sales)} ({v.quantity} qty, {v.orders} orders)
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
          )}
        </div>

        {/* Top 20 Parents - Collapsible */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <button
            onClick={() => setShowTop20Parents(!showTop20Parents)}
            className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-xl"
          >
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Top 20 Parents
            </h2>
            {showTop20Parents ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {showTop20Parents && (
          <div className="px-6 pb-6 space-y-2">
            {top20Parents.map((parent, idx) => {
              const prevParent = comparisonParentMap.get(parent.parent);

              return (
              <div key={parent.parent}>
                <div
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition"
                  onClick={() => toggleParent(parent.parent)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-sm font-bold text-slate-400 w-8">#{idx + 1}</div>
                    <div className="text-left">
                      <div className="font-medium text-slate-800">{parent.parent}</div>
                      <div className="text-xs text-slate-500">
                        {parent.category} · {parent.totalProducts} products
                      </div>
                    </div>
                  </div>
                  <div className="text-right mr-4 flex items-center gap-2">
                    <div>
                      <div className="font-bold text-slate-800">{formatMoney(parent.totalSales)}</div>
                      <div className="text-xs text-slate-500">
                        {parent.totalOrders} orders
                      </div>
                    </div>
                    {comparisonMode !== 'none' && prevParent && (
                      <ComparisonBadge current={parent.totalSales} previous={prevParent.totalSales} />
                    )}
                  </div>
                  {expandedParents.has(parent.parent) ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                {/* Expanded: Products under this parent */}
                {expandedParents.has(parent.parent) && (
                  <div className="mt-2 ml-12 p-4 bg-white border border-slate-200 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-2">Products:</div>
                    <div className="space-y-1">
                      {parent.variants.map((v, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-slate-600">
                            {v.name} (ASIN: {v.asin})
                          </span>
                          <span className="text-slate-800 font-medium">
                            {formatMoney(v.sales)} ({v.orders} orders)
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
          )}
        </div>

        {/* Details Table */}
        <DetailsTable
          detailsProducts={detailsProducts}
          comparisonProducts={comparisonProducts}
          comparisonParents={comparisonParents}
          comparisonCategories={comparisonCategories}
          comparisonProductMap={comparisonProductMap}
          comparisonParentMap={comparisonParentMap}
          comparisonCategoryMap={comparisonCategoryMap}
          comparisonMode={comparisonMode}
          detailsViewMode={detailsViewMode}
          selectedCategory={selectedCategory}
          selectedParent={selectedParent}
          selectedName={selectedName}
          categoryNames={categoryNames}
          parentNames={parentNames}
          productNames={productNames}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          formatMoney={formatMoney}
          marketplace={selectedMarketplace}
          transactionData={transactionData}
          dateRange={{ start: startDate, end: endDate }}
          comparisonDateRange={comparisonDateRange}
          globalCosts={globalCosts}
          salesByFulfillment={salesByFulfillment}
          onViewModeChange={setDetailsViewMode}
          onCategoryChange={(value) => {
            setSelectedCategory(value);
            setSelectedParent('all');
            setSelectedName('all');
          }}
          onParentChange={(value) => {
            setSelectedParent(value);
            setSelectedName('all');
          }}
          onNameChange={setSelectedName}
          onSort={handleSort}
        />
      </div>
    </div>
  );
};

export default ProductAnalyzer;
