/**
 * Phase 3: Profitability Analyzer
 * Transaction-based profit analysis like Phase 2
 * Shows actual profit/loss from historical data with cost analysis
 */

import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { ChevronDown, ChevronUp, DollarSign, Truck, Settings, BarChart3, Filter, PieChart as PieChartIcon, AlertTriangle, Tag, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { TransactionData, MarketplaceCode } from '../types/transaction';
import {
  ProductCostData,
  CostDataSummary,
  ShippingRateTable,
  AllCountryConfigs,
} from '../types/profitability';
import {
  loadShippingRates,
  saveShippingRates,
  loadCountryConfigs,
  saveCountryConfigs,
  createEmptyShippingRates,
  parseShippingRatesFromExcel,
} from '../services/profitability/configService';
import {
  extractCostDataFromTransactions,
  parseCostDataFromExcel,
  matchCostData,
  extractPhase2NameData,
} from '../services/profitability/profitabilityEngine';
import {
  calculateProductProfitability,
  calculateCategoryProfitability,
  calculateParentProfitability,
  calculateSKUProfitability,
} from '../services/profitability/profitabilityAnalytics';
import {
  calculateAdvertisingCost,
  calculateFBACosts,
  calculateFBMCosts,
  calculateProductAnalytics,
} from '../services/analytics/productAnalytics';
import { createMoneyFormatter, formatPercent } from '../utils/formatters';
import { MARKETPLACE_CONFIGS } from '../constants/marketplaces';

// Sub-components - StatusBadge is small, keep it sync
import StatusBadge from './profitability-analyzer/StatusBadge';

// Types needed for lazy components
import type { NameOverride, FBMNameInfo } from './profitability-analyzer/CostUploadTab';
import type { SelectedItemType } from './profitability-analyzer/PieChartModal';

// Context
import { ProfitabilityFilterProvider, useProfitabilityFilters } from '../contexts/ProfitabilityFilterContext';

// Lazy load heavy tab components and modal
const CostUploadTab = lazy(() => import('./profitability-analyzer/CostUploadTab'));
const ShippingRatesTab = lazy(() => import('./profitability-analyzer/ShippingRatesTab'));
const CountrySettingsTab = lazy(() => import('./profitability-analyzer/CountrySettingsTab'));
const PieChartModal = lazy(() => import('./profitability-analyzer/PieChartModal'));

// Tab loading fallback
const TabLoadingFallback = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
  </div>
);

// Storage key for NAME overrides
const NAME_OVERRIDES_STORAGE_KEY = 'amazon-analyzer-name-overrides';

// Empty result constants for stable references (prevents unnecessary re-renders)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EMPTY_SKU_RESULT: { skuProfitability: any[]; excludedSkus: any[]; gradeResellSkus: any[] } = {
  skuProfitability: [],
  excludedSkus: [],
  gradeResellSkus: []
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EMPTY_ARRAY: any[] = [];

interface ProfitabilityAnalyzerProps {
  transactionData: TransactionData[];
  selectedMarketplace: MarketplaceCode;
}

// Inner component that uses context
const ProfitabilityAnalyzerInner: React.FC<ProfitabilityAnalyzerProps> = ({
  transactionData,
  selectedMarketplace,
}) => {
  // ============================================
  // FILTER STATES FROM CONTEXT
  // ============================================
  const {
    startDate,
    endDate,
    filterMarketplace,
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
    setStartDate,
    setEndDate,
    setFilterMarketplace,
    setFilterFulfillment,
    setFilterCategory,
    setFilterParent,
    setFilterName,
    setDetailsViewMode,
    setShowPerUnit,
    setExcludeGradeResell,
    setCurrentPage,
    handleSort,
  } = useProfitabilityFilters();

  // ============================================
  // COLLAPSIBLE SECTIONS STATE
  // ============================================
  const [showCostData, setShowCostData] = useState(false);
  const [showShippingRates, setShowShippingRates] = useState(false);
  const [showCountrySettings, setShowCountrySettings] = useState(false);
  const [showExcludedProducts, setShowExcludedProducts] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // ============================================
  // CONFIG DATA STATES
  // ============================================
  const [costData, setCostData] = useState<ProductCostData[]>([]);
  const [costSummary, setCostSummary] = useState<CostDataSummary | null>(null);
  const [shippingRates, setShippingRates] = useState<ShippingRateTable | null>(null);
  const [countryConfigs, setCountryConfigs] = useState<AllCountryConfigs | null>(null);

  // NAME Overrides - NAME bazlı manuel girilen özel kargo ve FBM kaynak bilgileri
  // Bir NAME'e girilen değer, o NAME altındaki tüm FBM SKU'lara uygulanır
  const [nameOverrides, setNameOverrides] = useState<NameOverride[]>(() => {
    try {
      const saved = localStorage.getItem(NAME_OVERRIDES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save NAME overrides to localStorage
  useEffect(() => {
    localStorage.setItem(NAME_OVERRIDES_STORAGE_KEY, JSON.stringify(nameOverrides));
  }, [nameOverrides]);

  // Pie Chart Modal State (type imported from PieChartModal)
  const [selectedItem, setSelectedItem] = useState<SelectedItemType>(null);

  // ============================================
  // DRAG TO SCROLL REF & HANDLERS
  // Using refs instead of state to avoid re-renders during drag
  // ============================================
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({ isDragging: false, startX: 0, scrollLeft: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!tableContainerRef.current) return;
    dragStateRef.current.isDragging = true;
    dragStateRef.current.startX = e.pageX - tableContainerRef.current.offsetLeft;
    dragStateRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    tableContainerRef.current.style.cursor = 'grabbing';
  }, []);

  const handleMouseUp = useCallback(() => {
    dragStateRef.current.isDragging = false;
    if (tableContainerRef.current) {
      tableContainerRef.current.style.cursor = 'grab';
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragStateRef.current.isDragging || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - dragStateRef.current.startX) * 1.5;
    tableContainerRef.current.scrollLeft = dragStateRef.current.scrollLeft - walk;
  }, []);

  const handleMouseLeave = useCallback(() => {
    dragStateRef.current.isDragging = false;
    if (tableContainerRef.current) {
      tableContainerRef.current.style.cursor = 'grab';
    }
  }, []);

  // ============================================
  // LOAD CONFIGS ON MOUNT
  // ============================================
  useEffect(() => {
    const savedRates = loadShippingRates();
    setShippingRates(savedRates || createEmptyShippingRates());

    const savedConfigs = loadCountryConfigs();
    setCountryConfigs(savedConfigs);
  }, []);

  // Auto-extract cost data from enriched transactions (from Google Sheets)
  useEffect(() => {
    if (transactionData.length > 0 && costData.length === 0) {
      const extractedCostData = extractCostDataFromTransactions(transactionData);
      if (extractedCostData.length > 0) {
        setCostData(extractedCostData);
      }
    }
  }, [transactionData, costData.length]);

  // Merge costData with:
  // 1. Sibling SKU matching - aynı NAME altındaki başka SKU'dan cost/size al
  // 2. NAME-level overrides - SADECE US pazarı için geçerli
  const mergedCostData = useMemo((): ProductCostData[] => {
    if (costData.length === 0) return costData;

    // Step 1: Group SKUs by NAME to enable sibling matching
    const nameToSkus = new Map<string, ProductCostData[]>();
    costData.forEach(item => {
      const existing = nameToSkus.get(item.name);
      if (existing) {
        existing.push(item);
      } else {
        nameToSkus.set(item.name, [item]);
      }
    });

    // Step 2: For each NAME, find the "best" cost and size from siblings
    const nameToBestData = new Map<string, { cost: number | null; size: number | null }>();
    nameToSkus.forEach((skus, name) => {
      // Find first non-null cost and size from siblings
      const bestCost = skus.find(s => s.cost !== null)?.cost ?? null;
      const bestSize = skus.find(s => s.size !== null)?.size ?? null;
      nameToBestData.set(name, { cost: bestCost, size: bestSize });
    });

    // Step 3: Apply sibling matching - fill missing cost/size from siblings
    let result = costData.map(item => {
      const bestData = nameToBestData.get(item.name);
      if (!bestData) return item;

      // Only fill if missing
      const newCost = item.cost ?? bestData.cost;
      const newSize = item.size ?? bestData.size;

      if (newCost === item.cost && newSize === item.size) return item;

      return {
        ...item,
        cost: newCost,
        size: newSize,
      };
    });

    // Step 4: Apply NAME-level overrides (US only)
    if (filterMarketplace === 'US' && nameOverrides.length > 0) {
      const overrideByName = new Map<string, NameOverride>();
      nameOverrides.forEach(o => overrideByName.set(o.name, o));

      result = result.map(item => {
        const override = overrideByName.get(item.name);
        if (!override) return item;

        return {
          ...item,
          customShipping: override.customShipping ?? item.customShipping,
          fbmSource: override.fbmSource ?? item.fbmSource,
        };
      });
    }

    return result;
  }, [costData, nameOverrides, filterMarketplace]);

  // ============================================
  // AVAILABLE CATEGORIES (from transactions)
  // ============================================
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    transactionData.forEach(t => {
      if (t.productCategory) {
        categories.add(t.productCategory);
      }
    });
    // Sort alphabetically
    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }, [transactionData]);

  // ============================================
  // FILTERED TRANSACTIONS
  // ============================================
  const filteredTransactions = useMemo(() => {
    return transactionData.filter(t => {
      if (!t.sku) return false;

      // Date filtering
      if (startDate || endDate) {
        const transactionDate = new Date(t.date);
        if (startDate && transactionDate < new Date(startDate)) return false;
        if (endDate && transactionDate > new Date(endDate)) return false;
      }

      // Marketplace filtering
      if (filterMarketplace !== 'all' && t.marketplaceCode !== filterMarketplace) return false;

      // Fulfillment filtering
      if (filterFulfillment !== 'all' && t.fulfillment !== filterFulfillment) return false;

      return true;
    });
  }, [transactionData, startDate, endDate, filterMarketplace, filterFulfillment]);

  // ============================================
  // PROFITABILITY CALCULATIONS
  // ============================================
  // NOTE: NAME-level calculations moved after SKU calculations below

  // Transactions filtered ONLY by date/marketplace (NOT by fulfillment)
  // Cost transactions (Service Fee, FBA Inventory Fee, etc.) don't have fulfillment field
  const costTransactions = useMemo(() => {
    return transactionData.filter(t => {
      // Date filtering
      if (startDate || endDate) {
        const transactionDate = new Date(t.date);
        if (startDate && transactionDate < new Date(startDate)) return false;
        if (endDate && transactionDate > new Date(endDate)) return false;
      }

      // Marketplace filtering only
      if (filterMarketplace !== 'all' && t.marketplaceCode !== filterMarketplace) return false;

      return true;
    });
  }, [transactionData, startDate, endDate, filterMarketplace]);

  // Additional costs from Phase 1 calculations (filtered by date/marketplace)
  // Calculate percentages to apply to SKU level
  // FBA Cost % = FBA expenses / FBA sales
  // FBM Cost % = FBM expenses / FBM sales
  // Ads % = Advertising cost / Total sales
  const costPercentages = useMemo(() => {
    const mpCode = filterMarketplace === 'all' ? null : filterMarketplace;

    // Calculate costs from ALL transactions (not fulfillment-filtered)
    const advertisingCost = calculateAdvertisingCost(costTransactions, mpCode);
    const fbaCost = calculateFBACosts(costTransactions, mpCode);
    const fbmCost = calculateFBMCosts(costTransactions, mpCode);

    // Calculate revenue from Order transactions (for percentage calculation)
    const orders = costTransactions.filter(t => t.categoryType === 'Order');
    const totalRevenue = orders.reduce((sum, t) => sum + (t.productSales || 0), 0);

    // FBA revenue = sales from FBA orders only
    const fbaRevenue = orders
      .filter(t => t.fulfillment === 'FBA' || t.fulfillment === 'AFN')
      .reduce((sum, t) => sum + (t.productSales || 0), 0);

    // FBM revenue = sales from FBM orders only
    const fbmRevenue = orders
      .filter(t => t.fulfillment !== 'FBA' && t.fulfillment !== 'AFN')
      .reduce((sum, t) => sum + (t.productSales || 0), 0);

    // Get refund recovery rate from marketplace config
    // Default 0.30 (30% recovery) if marketplace is 'all' or not found
    const mpConfig = mpCode ? MARKETPLACE_CONFIGS[mpCode as MarketplaceCode] : null;
    const refundRecoveryRate = mpConfig?.refundRecoveryRate ?? 0.30;

    return {
      advertisingPercent: totalRevenue > 0 ? (advertisingCost / totalRevenue) * 100 : 0,
      fbaCostPercent: fbaRevenue > 0 ? (fbaCost / fbaRevenue) * 100 : 0,
      fbmCostPercent: fbmRevenue > 0 ? (fbmCost / fbmRevenue) * 100 : 0,
      refundRecoveryRate,
    };
  }, [costTransactions, filterMarketplace]);

  // Helper: Check if SKU is Grade & Resell
  const isGradeResellSku = (sku: string) => {
    const skuUpper = sku.toUpperCase();
    return skuUpper.startsWith('AMZN.GR') || skuUpper.startsWith('AMZN,GR');
  };

  // SKU-level profitability (most granular - shows FBA/FBM clearly)
  // Uses costPercentages to apply global costs (Ads, FBA Cost, FBM Cost)
  const { skuProfitability, excludedSkus, gradeResellSkus } = useMemo(() => {
    if (filteredTransactions.length === 0) return EMPTY_SKU_RESULT;
    const mpCode = filterMarketplace === 'all' ? null : filterMarketplace as MarketplaceCode;
    const allSkus = calculateSKUProfitability(
      filteredTransactions,
      mergedCostData, // Use merged data with overrides
      shippingRates,
      countryConfigs,
      mpCode,
      costPercentages // Pass global cost percentages
    );

    // Separate Grade & Resell SKUs
    const grSkus = allSkus.filter(s => isGradeResellSku(s.sku));
    const nonGrSkus = excludeGradeResell ? allSkus.filter(s => !isGradeResellSku(s.sku)) : allSkus;

    // Filter SKUs with complete data vs excluded
    const included = nonGrSkus.filter(s => s.hasCostData && s.hasSizeData);
    const excluded = nonGrSkus
      .filter(s => !s.hasCostData || !s.hasSizeData)
      .sort((a, b) => b.totalRevenue - a.totalRevenue); // Sort by revenue desc
    return { skuProfitability: included, excludedSkus: excluded, gradeResellSkus: grSkus };
  }, [filteredTransactions, mergedCostData, shippingRates, countryConfigs, filterMarketplace, costPercentages, excludeGradeResell]);

  // NAME-level profitability - calculated products from SKUs with cost data only
  // This ensures revenue matches between coverage stats and category cards
  const profitabilityProducts = useMemo(() => {
    if (skuProfitability.length === 0) return EMPTY_ARRAY;
    return calculateProductProfitability(skuProfitability);
  }, [skuProfitability]);

  // Excluded products - NAME-level from SKUs without cost data
  const excludedProducts = useMemo(() => {
    if (excludedSkus.length === 0) return EMPTY_ARRAY;
    return calculateProductProfitability(excludedSkus);
  }, [excludedSkus]);

  // All products combined (for dropdowns and other uses)
  const allProducts = useMemo(() => {
    return [...profitabilityProducts, ...excludedProducts];
  }, [profitabilityProducts, excludedProducts]);

  const parentProfitability = useMemo(() => {
    return calculateParentProfitability(profitabilityProducts);
  }, [profitabilityProducts]);

  const categoryProfitability = useMemo(() => {
    return calculateCategoryProfitability(parentProfitability, profitabilityProducts);
  }, [parentProfitability, profitabilityProducts]);

  // Filtered Parent and Category profitability (for detail tables)
  const displayParents = useMemo(() => {
    let filtered = [...parentProfitability];

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(p => p.category === filterCategory);
    }

    // Parent filter
    if (filterParent !== 'all') {
      filtered = filtered.filter(p => p.parent === filterParent);
    }

    // Sort by revenue descending
    filtered.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return filtered;
  }, [parentProfitability, filterCategory, filterParent]);

  const displayCategories = useMemo(() => {
    let filtered = [...categoryProfitability];

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(c => c.category === filterCategory);
    }

    // Sort by revenue descending
    filtered.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return filtered;
  }, [categoryProfitability, filterCategory]);

  // FBM Name Info - FBM/Mixed satışları olan NAME'leri çıkar (Override editörü için)
  // SADECE US pazarı için geçerli - diğer pazarlarda FBM zaten TR'den gönderilir
  const fbmNameInfo = useMemo((): FBMNameInfo[] => {
    // US dışındaki pazarlarda FBM override'a gerek yok
    if (filterMarketplace !== 'US') return [];

    const allSkus = [...skuProfitability, ...excludedSkus];
    const nameMap = new Map<string, FBMNameInfo>();

    allSkus.forEach(sku => {
      const name = sku.name;
      if (!nameMap.has(name)) {
        nameMap.set(name, {
          name,
          skus: [],
          fbmSkus: [],
          fulfillmentBreakdown: { fba: 0, fbm: 0, mixed: 0 },
        });
      }

      const info = nameMap.get(name)!;
      info.skus.push(sku.sku);

      // Fulfillment breakdown ve FBM SKU listesi
      if (sku.fulfillment === 'FBA') {
        info.fulfillmentBreakdown.fba++;
      } else if (sku.fulfillment === 'FBM') {
        info.fulfillmentBreakdown.fbm++;
        info.fbmSkus.push(sku.sku);
      } else if (sku.fulfillment === 'Mixed') {
        info.fulfillmentBreakdown.mixed++;
        info.fbmSkus.push(sku.sku);
      }
    });

    // Sadece FBM SKU'ları olan NAME'leri döndür, FBM SKU sayısına göre sırala
    return Array.from(nameMap.values())
      .filter(info => info.fbmSkus.length > 0)
      .sort((a, b) => b.fbmSkus.length - a.fbmSkus.length);
  }, [skuProfitability, excludedSkus, filterMarketplace]);

  // Dropdown lists for filters
  const categoryNames = useMemo(() =>
    Array.from(new Set(profitabilityProducts.map(p => p.category))).sort(),
    [profitabilityProducts]
  );

  const parentNames = useMemo(() =>
    Array.from(new Set(profitabilityProducts.map(p => p.parent))).sort(),
    [profitabilityProducts]
  );

  const productNames = useMemo(() =>
    profitabilityProducts.map(p => p.name).sort(),
    [profitabilityProducts]
  );

  // Coverage stats - now uses SKU-level data for accuracy
  const coverageStats = useMemo(() => {
    const totalSkus = skuProfitability.length + excludedSkus.length;
    const calculatedSkus = skuProfitability.length;
    const excludedCount = excludedSkus.length;
    const coveragePercent = totalSkus > 0 ? (calculatedSkus / totalSkus) * 100 : 0;

    // Revenue coverage
    const totalRevenue = [...skuProfitability, ...excludedSkus].reduce((sum, s) => sum + s.totalRevenue, 0);
    const calculatedRevenue = skuProfitability.reduce((sum, s) => sum + s.totalRevenue, 0);
    const excludedRevenue = excludedSkus.reduce((sum, s) => sum + s.totalRevenue, 0);
    const revenueCoveragePercent = totalRevenue > 0 ? (calculatedRevenue / totalRevenue) * 100 : 0;

    // Grade & Resell stats
    const gradeResellCount = gradeResellSkus.length;
    const gradeResellRevenue = gradeResellSkus.reduce((sum, s) => sum + s.totalRevenue, 0);

    return {
      totalSkus,
      calculatedSkus,
      excludedCount,
      coveragePercent,
      totalRevenue,
      calculatedRevenue,
      excludedRevenue,
      revenueCoveragePercent,
      gradeResellCount,
      gradeResellRevenue,
    };
  }, [skuProfitability, excludedSkus, gradeResellSkus]);

  // ============================================
  // FILTERED & SORTED PRODUCTS
  // ============================================
  const displayProducts = useMemo(() => {
    let filtered = [...profitabilityProducts];

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(p => p.category === filterCategory);
    }

    // Parent filter
    if (filterParent !== 'all') {
      filtered = filtered.filter(p => p.parent === filterParent);
    }

    // Name filter
    if (filterName !== 'all') {
      filtered = filtered.filter(p => p.name === filterName);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      switch (sortColumn) {
        case 'name':
          return sortDirection === 'asc'
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        case 'totalRevenue':
          aValue = a.totalRevenue;
          bValue = b.totalRevenue;
          break;
        case 'netProfit':
          aValue = a.netProfit;
          bValue = b.netProfit;
          break;
        case 'profitMargin':
          aValue = a.profitMargin;
          bValue = b.profitMargin;
          break;
        case 'totalOrders':
          aValue = a.totalOrders;
          bValue = b.totalOrders;
          break;
        case 'sellingFees':
          aValue = a.sellingFees;
          bValue = b.sellingFees;
          break;
        case 'fbaFees':
          aValue = a.fbaFees;
          bValue = b.fbaFees;
          break;
        case 'totalQuantity':
          aValue = a.totalQuantity;
          bValue = b.totalQuantity;
          break;
        case 'refundLoss':
          aValue = a.refundLoss;
          bValue = b.refundLoss;
          break;
        case 'totalProductCost':
          aValue = a.totalProductCost;
          bValue = b.totalProductCost;
          break;
        case 'shippingCost':
          aValue = a.shippingCost;
          bValue = b.shippingCost;
          break;
        default:
          aValue = a.totalRevenue;
          bValue = b.totalRevenue;
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return filtered;
  }, [profitabilityProducts, filterCategory, filterParent, filterName, sortColumn, sortDirection]);

  // Filtered & Sorted SKUs
  const displaySkus = useMemo(() => {
    let filtered = [...skuProfitability];

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(s => s.category === filterCategory);
    }

    // Parent filter
    if (filterParent !== 'all') {
      filtered = filtered.filter(s => s.parent === filterParent);
    }

    // Name filter
    if (filterName !== 'all') {
      filtered = filtered.filter(s => s.name === filterName);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      switch (sortColumn) {
        case 'sku':
          return sortDirection === 'asc'
            ? a.sku.localeCompare(b.sku)
            : b.sku.localeCompare(a.sku);
        case 'name':
          return sortDirection === 'asc'
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        case 'totalRevenue':
          aValue = a.totalRevenue;
          bValue = b.totalRevenue;
          break;
        case 'netProfit':
          aValue = a.netProfit;
          bValue = b.netProfit;
          break;
        case 'profitMargin':
          aValue = a.profitMargin;
          bValue = b.profitMargin;
          break;
        case 'totalOrders':
          aValue = a.totalOrders;
          bValue = b.totalOrders;
          break;
        case 'sellingFees':
          aValue = a.sellingFees;
          bValue = b.sellingFees;
          break;
        case 'fbaFees':
          aValue = a.fbaFees;
          bValue = b.fbaFees;
          break;
        case 'totalQuantity':
          aValue = a.totalQuantity;
          bValue = b.totalQuantity;
          break;
        case 'refundLoss':
          aValue = a.refundLoss;
          bValue = b.refundLoss;
          break;
        case 'advertisingCost':
          aValue = a.advertisingCost;
          bValue = b.advertisingCost;
          break;
        case 'fbaCost':
          aValue = a.fbaCost;
          bValue = b.fbaCost;
          break;
        case 'fbmCost':
          aValue = a.fbmCost;
          bValue = b.fbmCost;
          break;
        case 'productCost':
          aValue = a.productCost ?? 0;
          bValue = b.productCost ?? 0;
          break;
        case 'shippingCost':
          aValue = a.shippingCost;
          bValue = b.shippingCost;
          break;
        case 'othersCost':
          aValue = a.othersCost;
          bValue = b.othersCost;
          break;
        default:
          aValue = a.totalRevenue;
          bValue = b.totalRevenue;
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return filtered;
  }, [skuProfitability, filterCategory, filterParent, filterName, sortColumn, sortDirection]);

  // ============================================
  // HELPER: FORMAT MONEY (memoized)
  // ============================================
  const formatMoney = useMemo(() => createMoneyFormatter(filterMarketplace), [filterMarketplace]);

  // Update cost summary when cost data or phase2 data changes
  useEffect(() => {
    if (mergedCostData.length > 0 && filteredTransactions.length > 0) {
      const phase2Data = extractPhase2NameData(
        calculateProductAnalytics(
          filteredTransactions,
          filterMarketplace === 'all' ? null : filterMarketplace
        )
      );
      const summary = matchCostData(mergedCostData, phase2Data);
      setCostSummary(summary);
    }
  }, [mergedCostData, filteredTransactions, filterMarketplace]);

  // Handle cost file upload
  const handleCostFileUpload = useCallback((data: Record<string, any>[]) => {
    try {
      const parsed = parseCostDataFromExcel(data);
      setCostData(parsed);
    } catch {
      // Parse error - invalid file format
    }
  }, []);

  // Handle shipping rates upload
  const handleShippingRatesUpload = useCallback((data: Record<string, any>[]) => {
    try {
      const parsed = parseShippingRatesFromExcel(data);
      setShippingRates(parsed);
      saveShippingRates(parsed);
    } catch {
      // Parse error - invalid file format
    }
  }, []);

  const handleShippingRatesUpdate = useCallback((rates: ShippingRateTable) => {
    setShippingRates(rates);
    saveShippingRates(rates);
  }, []);

  const handleCountryConfigUpdate = useCallback((configs: AllCountryConfigs) => {
    setCountryConfigs(configs);
    saveCountryConfigs(configs);
  }, []);

  // ============================================
  // DERIVED VALUES
  // ============================================
  const marketplaces = useMemo(() =>
    Array.from(new Set(transactionData.map(t => t.marketplaceCode).filter(Boolean))).sort(),
    [transactionData]
  );

  // Cost data stats - GROUP BY NAME (use merged data with overrides)
  const costDataByName = useMemo(() => {
    const grouped = new Map<string, { cost: number | null; size: number | null }>();
    mergedCostData.forEach(item => {
      const name = item.name || 'Unknown';
      if (!grouped.has(name)) {
        grouped.set(name, { cost: item.cost, size: item.size });
      } else {
        const existing = grouped.get(name)!;
        if (existing.cost === null && item.cost !== null) existing.cost = item.cost;
        if (existing.size === null && item.size !== null) existing.size = item.size;
      }
    });
    return grouped;
  }, [mergedCostData]);

  const totalNames = costDataByName.size;
  const completeData = Array.from(costDataByName.values()).filter(item => item.cost !== null && item.size !== null).length;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2 flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-purple-600" />
                Profitability Analyzer
              </h1>
              <p className="text-slate-600">
                Transaction-based profit analysis with cost breakdown
              </p>
            </div>

            {/* Config Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowCostData(!showCostData);
                  setShowShippingRates(false);
                  setShowCountrySettings(false);
                }}
                className={`flex items-center justify-center gap-2 px-4 py-2 min-w-[100px] rounded-lg transition-colors ${
                  showCostData
                    ? 'bg-green-600 text-white'
                    : totalNames > 0
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-medium">Data</span>
                {showCostData ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              <button
                onClick={() => {
                  setShowShippingRates(!showShippingRates);
                  setShowCostData(false);
                  setShowCountrySettings(false);
                }}
                className={`flex items-center justify-center gap-2 px-4 py-2 min-w-[100px] rounded-lg transition-colors ${
                  showShippingRates
                    ? 'bg-blue-600 text-white'
                    : shippingRates && shippingRates.routes['US-TR'].rates.length > 0
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span className="text-sm font-medium">Shipping</span>
                {showShippingRates ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              <button
                onClick={() => {
                  setShowCountrySettings(!showCountrySettings);
                  setShowCostData(false);
                  setShowShippingRates(false);
                }}
                className={`flex items-center justify-center gap-2 px-4 py-2 min-w-[100px] rounded-lg transition-colors ${
                  showCountrySettings
                    ? 'bg-orange-600 text-white'
                    : countryConfigs
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">Settings</span>
                {showCountrySettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex flex-wrap gap-3 mt-4">
            <StatusBadge
              label="Cost Data"
              value={`${completeData}/${totalNames}`}
              isReady={completeData > 0}
            />
            <StatusBadge
              label="Shipping"
              value={shippingRates?.routes['US-TR'].rates.length || 0}
              isReady={(shippingRates?.routes['US-TR'].rates.length || 0) > 0}
            />
            <StatusBadge
              label="Config"
              value={countryConfigs ? 'OK' : '-'}
              isReady={!!countryConfigs}
            />
          </div>

          {/* Collapsible Sections - Lazy loaded */}
          {showCostData && (
            <div className="mt-4 border-t-2 border-dashed border-slate-300 pt-6">
              <Suspense fallback={<TabLoadingFallback />}>
                <CostUploadTab
                  costData={costData}
                  costSummary={costSummary}
                  onFileUpload={handleCostFileUpload}
                  nameOverrides={nameOverrides}
                  onOverridesChange={setNameOverrides}
                  fbmNameInfo={fbmNameInfo}
                />
              </Suspense>
            </div>
          )}

          {showShippingRates && shippingRates && (
            <div className="mt-4 border-t-2 border-dashed border-slate-300 pt-6">
              <Suspense fallback={<TabLoadingFallback />}>
                <ShippingRatesTab
                  shippingRates={shippingRates}
                  onFileUpload={handleShippingRatesUpload}
                  onUpdate={handleShippingRatesUpdate}
                />
              </Suspense>
            </div>
          )}

          {showCountrySettings && countryConfigs && (
            <div className="mt-4 border-t-2 border-dashed border-slate-300 pt-6">
              <Suspense fallback={<TabLoadingFallback />}>
                <CountrySettingsTab
                  countryConfigs={countryConfigs}
                  onUpdate={handleCountryConfigUpdate}
                  availableCategories={availableCategories}
                />
              </Suspense>
            </div>
          )}
        </div>

        {/* Filters Section - Phase 2 Style */}
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
          {(startDate || endDate || filterMarketplace !== 'all' || filterFulfillment !== 'all') && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setFilterMarketplace('all');
                  setFilterFulfillment('all');
                  setFilterCategory('all');
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Coverage Stats - Shows how much data is being calculated */}
        {allProducts.length > 0 && (
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
                        onClick={() => {
                          // Export excluded SKUs to Excel
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
        )}

        {/* Category Cards - Phase 2 Style */}
        {categoryProfitability.length > 0 && (
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
              {(() => {
                const totalRevenue = categoryProfitability.reduce((sum, c) => sum + c.totalRevenue, 0);
                const totalProfit = categoryProfitability.reduce((sum, c) => sum + c.netProfit, 0);
                const totalProducts = categoryProfitability.reduce((sum, c) => sum + c.totalProducts, 0);
                const totalOrders = categoryProfitability.reduce((sum, c) => sum + c.totalOrders, 0);
                const totalParents = categoryProfitability.reduce((sum, c) => sum + c.totalParents, 0);
                const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

                // Amazon Expenses (Selling Fee, FBA Fee, Refund, VAT, Ads, FBA Cost, FBM Cost)
                const totalSellingFees = categoryProfitability.reduce((sum, c) => sum + c.sellingFees, 0);
                const totalFbaFees = categoryProfitability.reduce((sum, c) => sum + c.fbaFees, 0);
                const totalRefundLoss = categoryProfitability.reduce((sum, c) => sum + c.refundLoss, 0);
                const totalVat = categoryProfitability.reduce((sum, c) => sum + c.vat, 0);
                const totalAds = categoryProfitability.reduce((sum, c) => sum + c.advertisingCost, 0);
                const totalFbaCost = categoryProfitability.reduce((sum, c) => sum + c.fbaCost, 0);
                const totalFbmCost = categoryProfitability.reduce((sum, c) => sum + c.fbmCost, 0);
                const amazonExpenses = totalSellingFees + totalFbaFees + totalRefundLoss + totalVat + totalAds + totalFbaCost + totalFbmCost;

                // Non-Amazon Expenses (Product Cost, Shipping, Customs, DDP, Warehouse, GST)
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

                return (
                  <div className="border-2 border-indigo-400 rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-white flex flex-col shadow-md">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-indigo-800 text-base mb-1">All Categories</h3>
                        <div className="text-xs text-indigo-600">
                          {categoryProfitability.length} categories · {totalParents} parents · {totalProducts} products
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedCategories);
                          if (newExpanded.has('__ALL__')) {
                            newExpanded.delete('__ALL__');
                          } else {
                            newExpanded.add('__ALL__');
                          }
                          setExpandedCategories(newExpanded);
                        }}
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
                );
              })()}

              {categoryProfitability.slice(0, 11).map(cat => {
                const allCatRevenue = categoryProfitability.reduce((sum, c) => sum + c.totalRevenue, 0);
                const categoryPercentage = allCatRevenue > 0 ? (cat.totalRevenue / allCatRevenue) * 100 : 0;

                // Amazon Expenses (including VAT)
                const amazonExpenses = cat.sellingFees + cat.fbaFees + cat.refundLoss + cat.vat + cat.advertisingCost + cat.fbaCost + cat.fbmCost;
                const amazonPct = cat.totalRevenue > 0 ? (amazonExpenses / cat.totalRevenue) * 100 : 0;

                // Non-Amazon Expenses (including GST)
                const nonAmazonExpenses = cat.totalProductCost + cat.shippingCost + cat.othersCost + cat.gstCost;
                const nonAmazonPct = cat.totalRevenue > 0 ? (nonAmazonExpenses / cat.totalRevenue) * 100 : 0;

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
                            const newExpanded = new Set(expandedCategories);
                            if (newExpanded.has(cat.category)) {
                              newExpanded.delete(cat.category);
                            } else {
                              newExpanded.add(cat.category);
                            }
                            setExpandedCategories(newExpanded);
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
                          <span className="font-bold text-red-600">{formatPercent(amazonPct)} <span className="text-slate-400 font-normal">({formatMoney(amazonExpenses)})</span></span>
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
                          <span className="font-bold text-slate-700">{formatPercent(nonAmazonPct)} <span className="text-slate-400 font-normal">({formatMoney(nonAmazonExpenses)})</span></span>
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
        )}

        {/* Details Table - Phase 2 Style */}
        {profitabilityProducts.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-indigo-600" />
                  Details
                </h2>
                {/* Toplam / Birim Toggle - Sadece SKU ve Name için */}
                {(detailsViewMode === 'sku' || detailsViewMode === 'name') && (
                  <div className="inline-flex items-center rounded-full bg-slate-100 p-0.5 text-xs">
                    <button
                      onClick={() => setShowPerUnit(false)}
                      className={`px-3 py-1 rounded-full font-medium transition-all ${
                        !showPerUnit
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Toplam
                    </button>
                    <button
                      onClick={() => setShowPerUnit(true)}
                      className={`px-3 py-1 rounded-full font-medium transition-all ${
                        showPerUnit
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Birim
                    </button>
                  </div>
                )}
              </div>
              {/* SKU/Name/Parent/Category Segmented Control - Bottom-up hierarchy */}
              <div className="inline-flex rounded-lg border border-slate-300 p-1 bg-slate-50">
                <button
                  onClick={() => setDetailsViewMode('sku')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    detailsViewMode === 'sku'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  SKU
                </button>
                <button
                  onClick={() => setDetailsViewMode('name')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    detailsViewMode === 'name'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Product
                </button>
                <button
                  onClick={() => setDetailsViewMode('parent')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    detailsViewMode === 'parent'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Parent
                </button>
                <button
                  onClick={() => setDetailsViewMode('category')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    detailsViewMode === 'category'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Category
                </button>
              </div>
            </div>

            {/* Filter dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="all">All Categories</option>
                  {categoryNames.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent ASIN</label>
                <select
                  value={filterParent}
                  onChange={(e) => setFilterParent(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="all">All Parents</option>
                  {parentNames.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                <select
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="all">All Products</option>
                  {productNames.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table Header showing count */}
            <div className="text-sm font-semibold text-slate-700 mb-3">
              {detailsViewMode === 'sku'
                ? `${displaySkus.length} SKUs`
                : detailsViewMode === 'name'
                ? `${displayProducts.length} products`
                : detailsViewMode === 'parent'
                ? `${displayParents.length} parents`
                : `${displayCategories.length} categories`}
            </div>

            {/* Table with Drag-to-Scroll */}
            <div
              ref={tableContainerRef}
              className="overflow-x-auto overflow-y-auto max-h-[600px] border border-slate-200 rounded-lg cursor-grab select-none"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {detailsViewMode === 'sku' ? (
                /* SKU Table - Most granular level with FBA/FBM distinction */
                <table className="w-full min-w-max divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 sticky top-0 z-20">
                    <tr>
                      <th
                        className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky left-0 bg-slate-50 z-30 cursor-pointer hover:bg-slate-100 min-w-[150px] border-r border-slate-200"
                        onClick={() => handleSort('sku')}
                      >
                        <div className="flex items-center gap-1">
                          SKU
                          {sortColumn === 'sku' && <span className="text-green-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-left text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap min-w-[200px]"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          Name
                          {sortColumn === 'name' && <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">FF</th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                        onClick={() => handleSort('totalRevenue')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Revenue
                          {sortColumn === 'totalRevenue' && <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                        onClick={() => handleSort('totalOrders')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Orders
                          {sortColumn === 'totalOrders' && <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                        onClick={() => handleSort('totalQuantity')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Qty
                          {sortColumn === 'totalQuantity' && <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-red-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap border-r border-slate-200"
                        onClick={() => handleSort('refundedQuantity')}
                        title="Refunded Quantity"
                      >
                        <div className="flex items-center justify-end gap-1">
                          RQty
                          {sortColumn === 'refundedQuantity' && <span className="text-red-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
                        onClick={() => handleSort('sellingFees')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Selling
                          {sortColumn === 'sellingFees' && <span className="text-red-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
                        onClick={() => handleSort('fbaFees')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          FBA Fee
                          {sortColumn === 'fbaFees' && <span className="text-red-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
                        onClick={() => handleSort('refundLoss')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Refund
                          {sortColumn === 'refundLoss' && <span className="text-red-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap border-r border-slate-200"
                        onClick={() => handleSort('vat')}
                        title="VAT (EU marketplaces)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          VAT
                          {sortColumn === 'vat' && <span className="text-red-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-pink-700 bg-pink-50 cursor-pointer hover:bg-pink-100 whitespace-nowrap"
                        onClick={() => handleSort('advertisingCost')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Ads
                          {sortColumn === 'advertisingCost' && <span className="text-pink-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-indigo-700 bg-indigo-50 cursor-pointer hover:bg-indigo-100 whitespace-nowrap"
                        onClick={() => handleSort('fbaCost')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          FBA Cost
                          {sortColumn === 'fbaCost' && <span className="text-indigo-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-cyan-700 bg-cyan-50 cursor-pointer hover:bg-cyan-100 whitespace-nowrap border-r border-slate-200"
                        onClick={() => handleSort('fbmCost')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          FBM Cost
                          {sortColumn === 'fbmCost' && <span className="text-cyan-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                        onClick={() => handleSort('productCost')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Cost
                          {sortColumn === 'productCost' && <span className="text-slate-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                        onClick={() => handleSort('shippingCost')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Ship
                          {sortColumn === 'shippingCost' && <span className="text-slate-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 cursor-pointer hover:bg-amber-100 whitespace-nowrap"
                        onClick={() => handleSort('customsDuty')}
                        title="Gümrük Vergisi (FBM-TR)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Customs
                          {sortColumn === 'customsDuty' && <span className="text-amber-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 cursor-pointer hover:bg-amber-100 whitespace-nowrap"
                        onClick={() => handleSort('ddpFee')}
                        title="DDP Ücreti (FBM-TR)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          DDP
                          {sortColumn === 'ddpFee' && <span className="text-amber-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 cursor-pointer hover:bg-amber-100 whitespace-nowrap"
                        onClick={() => handleSort('warehouseCost')}
                        title="Depo+İşçilik (FBA veya FBM-Local)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Warehouse
                          {sortColumn === 'warehouseCost' && <span className="text-amber-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-orange-700 bg-orange-50 cursor-pointer hover:bg-orange-100 whitespace-nowrap border-r border-slate-200"
                        onClick={() => handleSort('gstCost')}
                        title="GST/VAT (AU vb.)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          GST
                          {sortColumn === 'gstCost' && <span className="text-orange-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 cursor-pointer hover:bg-green-100 whitespace-nowrap"
                        onClick={() => handleSort('netProfit')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Net Profit
                          {sortColumn === 'netProfit' && <span className="text-green-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 cursor-pointer hover:bg-green-100 whitespace-nowrap"
                        onClick={() => handleSort('profitMargin')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Margin
                          {sortColumn === 'profitMargin' && <span className="text-green-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {displaySkus
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map(sku => (
                      <tr
                        key={sku.sku}
                        className="hover:bg-slate-50"
                      >
                        <td
                          className="px-3 py-2 text-left sticky left-0 bg-white z-10 min-w-[150px] border-r border-slate-200 cursor-pointer hover:bg-green-50"
                          onClick={() => setSelectedItem({ type: 'sku', data: sku })}
                        >
                          <div className="font-medium text-green-600 text-xs">{sku.sku}</div>
                          <div className="text-[10px] text-slate-400">{sku.category}</div>
                        </td>
                        <td className="px-3 py-2 text-left text-slate-700 text-xs min-w-[200px]">
                          <div className="truncate max-w-[200px]" title={sku.name}>{sku.name}</div>
                        </td>
                        <td className="px-3 py-2 text-center border-r border-slate-100">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            sku.fulfillment === 'FBA'
                              ? 'bg-blue-100 text-blue-700'
                              : sku.fulfillment === 'FBM'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {sku.fulfillment}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {showPerUnit
                            ? formatMoney(sku.avgSalePrice)
                            : formatMoney(sku.totalRevenue)}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">{sku.totalOrders}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{sku.totalQuantity}</td>
                        <td className="px-3 py-2 text-right text-red-500 border-r border-slate-100">{sku.refundedQuantity > 0 ? sku.refundedQuantity : '-'}</td>
                        <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
                          <div className="text-red-600 font-medium">{formatPercent(sku.sellingFeePercent)}</div>
                          <div className="text-[10px] text-slate-400">
                            {showPerUnit
                              ? formatMoney(sku.totalQuantity > 0 ? sku.sellingFees / sku.totalQuantity : 0)
                              : formatMoney(sku.sellingFees)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
                          <div className="text-red-600 font-medium">{formatPercent(sku.fbaFeePercent)}</div>
                          <div className="text-[10px] text-slate-400">
                            {showPerUnit
                              ? formatMoney(sku.totalQuantity > 0 ? sku.fbaFees / sku.totalQuantity : 0)
                              : formatMoney(sku.fbaFees)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
                          <div className="text-red-600 font-medium">{formatPercent(sku.refundLossPercent)}</div>
                          <div className="text-[10px] text-slate-400">
                            {showPerUnit
                              ? formatMoney(sku.totalQuantity > 0 ? sku.refundLoss / sku.totalQuantity : 0)
                              : formatMoney(sku.refundLoss)}
                          </div>
                        </td>
                        {/* VAT - EU marketplaces */}
                        <td className="px-3 py-2 text-right bg-red-50/30 border-r border-slate-100 whitespace-nowrap">
                          {sku.vat > 0 ? (
                            <>
                              <div className="text-red-600 font-medium">{formatPercent(sku.vatPercent)}</div>
                              <div className="text-[10px] text-slate-400">
                                {showPerUnit
                                  ? formatMoney(sku.totalQuantity > 0 ? sku.vat / sku.totalQuantity : 0)
                                  : formatMoney(sku.vat)}
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        {/* Ads - applies to all SKUs */}
                        <td className="px-3 py-2 text-right bg-pink-50/30 whitespace-nowrap">
                          <div className="text-pink-600 font-medium">{formatPercent(sku.advertisingPercent)}</div>
                          <div className="text-[10px] text-slate-400">
                            {showPerUnit
                              ? formatMoney(sku.totalQuantity > 0 ? sku.advertisingCost / sku.totalQuantity : 0)
                              : formatMoney(sku.advertisingCost)}
                          </div>
                        </td>
                        {/* FBA Cost - only for FBA SKUs */}
                        <td className="px-3 py-2 text-right bg-indigo-50/30 whitespace-nowrap">
                          {(sku.fulfillment === 'FBA' || sku.fulfillment === 'Mixed') ? (
                            <>
                              <div className="text-indigo-600 font-medium">{formatPercent(sku.fbaCostPercent)}</div>
                              <div className="text-[10px] text-slate-400">
                                {showPerUnit
                                  ? formatMoney(sku.totalQuantity > 0 ? sku.fbaCost / sku.totalQuantity : 0)
                                  : formatMoney(sku.fbaCost)}
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        {/* FBM Cost - only for FBM SKUs */}
                        <td className="px-3 py-2 text-right bg-cyan-50/30 border-r border-slate-100 whitespace-nowrap">
                          {(sku.fulfillment === 'FBM' || sku.fulfillment === 'Mixed') ? (
                            <>
                              <div className="text-cyan-600 font-medium">{formatPercent(sku.fbmCostPercent)}</div>
                              <div className="text-[10px] text-slate-400">
                                {showPerUnit
                                  ? formatMoney(sku.totalQuantity > 0 ? sku.fbmCost / sku.totalQuantity : 0)
                                  : formatMoney(sku.fbmCost)}
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className="text-slate-800 font-medium">
                            {showPerUnit
                              ? formatMoney(sku.productCost)
                              : formatMoney(sku.totalProductCost)}
                          </div>
                          <div className="text-[10px] text-slate-400">{formatPercent(sku.productCostPercent)}</div>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className="text-slate-800 font-medium">
                            {showPerUnit
                              ? formatMoney(sku.totalQuantity > 0 ? sku.shippingCost / sku.totalQuantity : 0)
                              : formatMoney(sku.shippingCost)}
                          </div>
                          <div className="text-[10px] text-slate-400">{formatPercent(sku.shippingCostPercent)}</div>
                        </td>
                        <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
                          {sku.customsDuty > 0 ? (
                            <>
                              <div className="text-amber-600 font-medium">
                                {showPerUnit
                                  ? formatMoney(sku.totalQuantity > 0 ? sku.customsDuty / sku.totalQuantity : 0)
                                  : formatMoney(sku.customsDuty)}
                              </div>
                              <div className="text-[10px] text-slate-400">{formatPercent((sku.customsDuty / sku.totalRevenue) * 100)}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
                          {sku.ddpFee > 0 ? (
                            <>
                              <div className="text-amber-600 font-medium">
                                {showPerUnit
                                  ? formatMoney(sku.totalQuantity > 0 ? sku.ddpFee / sku.totalQuantity : 0)
                                  : formatMoney(sku.ddpFee)}
                              </div>
                              <div className="text-[10px] text-slate-400">{formatPercent((sku.ddpFee / sku.totalRevenue) * 100)}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
                          {sku.warehouseCost > 0 ? (
                            <>
                              <div className="text-amber-600 font-medium">
                                {showPerUnit
                                  ? formatMoney(sku.totalQuantity > 0 ? sku.warehouseCost / sku.totalQuantity : 0)
                                  : formatMoney(sku.warehouseCost)}
                              </div>
                              <div className="text-[10px] text-slate-400">{formatPercent((sku.warehouseCost / sku.totalRevenue) * 100)}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right bg-orange-50/30 border-r border-slate-100 whitespace-nowrap">
                          {sku.gstCost > 0 ? (
                            <>
                              <div className="text-orange-600 font-medium">
                                {showPerUnit
                                  ? formatMoney(sku.totalQuantity > 0 ? sku.gstCost / sku.totalQuantity : 0)
                                  : formatMoney(sku.gstCost)}
                              </div>
                              <div className="text-[10px] text-slate-400">{formatPercent((sku.gstCost / sku.totalRevenue) * 100)}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold bg-green-50/30 whitespace-nowrap ${sku.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {showPerUnit
                            ? formatMoney(sku.totalQuantity > 0 ? sku.netProfit / sku.totalQuantity : 0)
                            : formatMoney(sku.netProfit)}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium bg-green-50/30 whitespace-nowrap ${sku.profitMargin >= 10 ? 'text-green-600' : sku.profitMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {formatPercent(sku.profitMargin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : detailsViewMode === 'category' ? (
                /* Category Table - Same columns as SKU/NAME/Parent table */
                <table className="w-full min-w-max divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 sticky top-0 z-20">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky left-0 bg-slate-50 z-30 min-w-[150px] border-r border-slate-300">Category</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">FF</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700 whitespace-nowrap">Revenue</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Orders</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Qty</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-red-600 whitespace-nowrap border-r border-slate-200" title="Refunded Quantity">RQty</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 whitespace-nowrap">Selling</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 whitespace-nowrap">FBA Fee</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 whitespace-nowrap">Refund</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 whitespace-nowrap border-r border-slate-200" title="VAT (EU marketplaces)">VAT</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-pink-700 bg-pink-50 whitespace-nowrap">Ads</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-indigo-700 bg-indigo-50 whitespace-nowrap">FBA Cost</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-cyan-700 bg-cyan-50 whitespace-nowrap border-r border-slate-200">FBM Cost</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Cost</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Ship</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 whitespace-nowrap" title="Gümrük Vergisi (FBM-TR)">Customs</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 whitespace-nowrap" title="DDP Ücreti (FBM-TR)">DDP</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 whitespace-nowrap" title="Depo+İşçilik (FBA veya FBM-Local)">Warehouse</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-orange-700 bg-orange-50 whitespace-nowrap border-r border-slate-200" title="GST/VAT (AU vb.)">GST</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 whitespace-nowrap">Net Profit</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 whitespace-nowrap">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {displayCategories.map(cat => (
                      <tr
                        key={cat.category}
                        className={`hover:bg-slate-50 ${!cat.hasCostData ? 'bg-yellow-50/30' : ''}`}
                      >
                        <td
                          className="px-3 py-2 text-left sticky left-0 bg-white z-10 min-w-[150px] border-r border-slate-300 cursor-pointer hover:bg-amber-50"
                          onClick={() => setSelectedItem({ type: 'category', data: cat })}
                        >
                          <div className="font-medium text-amber-600">{cat.category}</div>
                          <div className="text-[10px] text-slate-400">{cat.totalParents} parents, {cat.totalProducts} products</div>
                        </td>
                        <td className="px-3 py-2 text-center border-r border-slate-200">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            cat.fulfillment === 'FBA' ? 'bg-blue-100 text-blue-700' :
                            cat.fulfillment === 'FBM' ? 'bg-green-100 text-green-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {cat.fulfillment}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">{formatMoney(cat.totalRevenue)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{cat.totalOrders}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{cat.totalQuantity}</td>
                        <td className="px-3 py-2 text-right text-red-500 border-r border-slate-200">{cat.refundedQuantity > 0 ? cat.refundedQuantity : '-'}</td>
                        <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
                          <div className="text-red-600 font-medium">{formatPercent(cat.sellingFeePercent)}</div>
                          <div className="text-[10px] text-slate-400">{formatMoney(cat.sellingFees)}</div>
                        </td>
                        <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
                          <div className="text-red-600 font-medium">{formatPercent(cat.fbaFeePercent)}</div>
                          <div className="text-[10px] text-slate-400">{formatMoney(cat.fbaFees)}</div>
                        </td>
                        <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
                          <div className="text-red-600 font-medium">{formatPercent(cat.refundLossPercent)}</div>
                          <div className="text-[10px] text-slate-400">{formatMoney(cat.refundLoss)}</div>
                        </td>
                        <td className="px-3 py-2 text-right bg-red-50/30 border-r border-slate-200 whitespace-nowrap">
                          {cat.vat > 0 ? (
                            <>
                              <div className="text-red-600 font-medium">{formatPercent(cat.vatPercent)}</div>
                              <div className="text-[10px] text-slate-400">{formatMoney(cat.vat)}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right bg-pink-50/30 whitespace-nowrap">
                          <div className="text-pink-600 font-medium">{formatPercent(cat.advertisingPercent)}</div>
                          <div className="text-[10px] text-slate-400">{formatMoney(cat.advertisingCost)}</div>
                        </td>
                        <td className="px-3 py-2 text-right bg-indigo-50/30 whitespace-nowrap">
                          <div className="text-indigo-600 font-medium">{formatPercent(cat.fbaCostPercent)}</div>
                          <div className="text-[10px] text-slate-400">{formatMoney(cat.fbaCost)}</div>
                        </td>
                        <td className="px-3 py-2 text-right bg-cyan-50/30 border-r border-slate-200 whitespace-nowrap">
                          <div className="text-cyan-600 font-medium">{formatPercent(cat.fbmCostPercent)}</div>
                          <div className="text-[10px] text-slate-400">{formatMoney(cat.fbmCost)}</div>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className="text-slate-800 font-medium">{formatMoney(cat.totalProductCost)}</div>
                          <div className="text-[10px] text-slate-400">{formatPercent(cat.productCostPercent)}</div>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className="text-slate-800 font-medium">{formatMoney(cat.shippingCost)}</div>
                          <div className="text-[10px] text-slate-400">{formatPercent(cat.shippingCostPercent)}</div>
                        </td>
                        <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
                          {cat.customsDuty > 0 ? (
                            <>
                              <div className="text-amber-600 font-medium">{formatMoney(cat.customsDuty)}</div>
                              <div className="text-[10px] text-slate-400">{formatPercent((cat.customsDuty / cat.totalRevenue) * 100)}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
                          {cat.ddpFee > 0 ? (
                            <>
                              <div className="text-amber-600 font-medium">{formatMoney(cat.ddpFee)}</div>
                              <div className="text-[10px] text-slate-400">{formatPercent((cat.ddpFee / cat.totalRevenue) * 100)}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
                          {cat.warehouseCost > 0 ? (
                            <>
                              <div className="text-amber-600 font-medium">{formatMoney(cat.warehouseCost)}</div>
                              <div className="text-[10px] text-slate-400">{formatPercent((cat.warehouseCost / cat.totalRevenue) * 100)}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right bg-orange-50/30 border-r border-slate-200 whitespace-nowrap">
                          {cat.gstCost > 0 ? (
                            <>
                              <div className="text-orange-600 font-medium">{formatMoney(cat.gstCost)}</div>
                              <div className="text-[10px] text-slate-400">{formatPercent((cat.gstCost / cat.totalRevenue) * 100)}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold bg-green-50/30 whitespace-nowrap ${!cat.hasCostData ? 'text-slate-400' : cat.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {cat.hasCostData ? formatMoney(cat.netProfit) : '-'}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium bg-green-50/30 whitespace-nowrap ${!cat.hasCostData ? 'text-slate-400' : cat.profitMargin >= 10 ? 'text-green-600' : cat.profitMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {cat.hasCostData ? formatPercent(cat.profitMargin) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : detailsViewMode === 'parent' ? (
                /* Parent Table - Same columns as SKU/NAME table */
                <table className="w-full min-w-max divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 sticky top-0 z-20">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky left-0 bg-slate-50 z-30 min-w-[280px] max-w-[400px] border-r border-slate-200">Parent</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">FF</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700 whitespace-nowrap">Revenue</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Orders</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Qty</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-red-600 whitespace-nowrap border-r border-slate-200" title="Refunded Quantity">RQty</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 whitespace-nowrap">Selling</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 whitespace-nowrap">FBA Fee</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 whitespace-nowrap">Refund</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 whitespace-nowrap border-r border-slate-200" title="VAT (EU marketplaces)">VAT</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-pink-700 bg-pink-50 whitespace-nowrap">Ads</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-indigo-700 bg-indigo-50 whitespace-nowrap">FBA Cost</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-cyan-700 bg-cyan-50 whitespace-nowrap border-r border-slate-200">FBM Cost</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Cost</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Ship</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 whitespace-nowrap" title="Gümrük Vergisi (FBM-TR)">Customs</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 whitespace-nowrap" title="DDP Ücreti (FBM-TR)">DDP</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 whitespace-nowrap" title="Depo+İşçilik (FBA veya FBM-Local)">Warehouse</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-orange-700 bg-orange-50 whitespace-nowrap border-r border-slate-200" title="GST/VAT (AU vb.)">GST</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 whitespace-nowrap">Net Profit</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 whitespace-nowrap">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {displayParents.map(par => (
                      <tr
                        key={par.parent}
                        className={`hover:bg-slate-50 ${!par.hasCostData ? 'bg-yellow-50/30' : ''}`}
                      >
                        <td
                          className="px-3 py-2 text-left sticky left-0 bg-white z-10 min-w-[280px] max-w-[400px] border-r border-slate-200 cursor-pointer hover:bg-purple-50"
                          onClick={() => setSelectedItem({ type: 'parent', data: par })}
                        >
                          <div className="font-medium text-purple-600 break-words" title={par.parent}>{par.parent}</div>
                          <div className="text-[10px] text-slate-400">{par.category} ({par.totalProducts} products)</div>
                        </td>
                        <td className="px-3 py-2 text-center border-r border-slate-200">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            par.fulfillment === 'FBA' ? 'bg-blue-100 text-blue-700' :
                            par.fulfillment === 'FBM' ? 'bg-green-100 text-green-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {par.fulfillment}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">{formatMoney(par.totalRevenue)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{par.totalOrders}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{par.totalQuantity}</td>
                        <td className="px-3 py-2 text-right text-red-500 border-r border-slate-200">{par.refundedQuantity > 0 ? par.refundedQuantity : '-'}</td>
                        <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
                          <div className="text-red-600 font-medium">{formatPercent(par.sellingFeePercent)}</div>
                          <div className="text-[10px] text-slate-400">{formatMoney(par.sellingFees)}</div>
                        </td>
                        <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
                          <div className="text-red-600 font-medium">{formatPercent(par.fbaFeePercent)}</div>
                          <div className="text-[10px] text-slate-400">{formatMoney(par.fbaFees)}</div>
                        </td>
                        <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
                          <div className="text-red-600 font-medium">{formatPercent(par.refundLossPercent)}</div>
                          <div className="text-[10px] text-slate-400">{formatMoney(par.refundLoss)}</div>
                        </td>
                        <td className="px-3 py-2 text-right bg-red-50/30 border-r border-slate-200 whitespace-nowrap">
                          {par.vat > 0 ? (
                            <>
                              <div className="text-red-600 font-medium">{formatPercent(par.vatPercent)}</div>
                              <div className="text-[10px] text-slate-400">{formatMoney(par.vat)}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right bg-pink-50/30 whitespace-nowrap">
                          <div className="text-pink-600 font-medium">{formatPercent(par.advertisingPercent)}</div>
                          <div className="text-[10px] text-slate-400">{formatMoney(par.advertisingCost)}</div>
                        </td>
                        <td className="px-3 py-2 text-right bg-indigo-50/30 whitespace-nowrap">
                          <div className="text-indigo-600 font-medium">{formatPercent(par.fbaCostPercent)}</div>
                          <div className="text-[10px] text-slate-400">{formatMoney(par.fbaCost)}</div>
                        </td>
                        <td className="px-3 py-2 text-right bg-cyan-50/30 border-r border-slate-200 whitespace-nowrap">
                          <div className="text-cyan-600 font-medium">{formatPercent(par.fbmCostPercent)}</div>
                          <div className="text-[10px] text-slate-400">{formatMoney(par.fbmCost)}</div>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className="text-slate-800 font-medium">{formatMoney(par.totalProductCost)}</div>
                          <div className="text-[10px] text-slate-400">{formatPercent(par.productCostPercent)}</div>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className="text-slate-800 font-medium">{formatMoney(par.shippingCost)}</div>
                          <div className="text-[10px] text-slate-400">{formatPercent(par.shippingCostPercent)}</div>
                        </td>
                        <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
                          {par.customsDuty > 0 ? (
                            <>
                              <div className="text-amber-600 font-medium">{formatMoney(par.customsDuty)}</div>
                              <div className="text-[10px] text-slate-400">{formatPercent((par.customsDuty / par.totalRevenue) * 100)}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
                          {par.ddpFee > 0 ? (
                            <>
                              <div className="text-amber-600 font-medium">{formatMoney(par.ddpFee)}</div>
                              <div className="text-[10px] text-slate-400">{formatPercent((par.ddpFee / par.totalRevenue) * 100)}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
                          {par.warehouseCost > 0 ? (
                            <>
                              <div className="text-amber-600 font-medium">{formatMoney(par.warehouseCost)}</div>
                              <div className="text-[10px] text-slate-400">{formatPercent((par.warehouseCost / par.totalRevenue) * 100)}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right bg-orange-50/30 border-r border-slate-200 whitespace-nowrap">
                          {par.gstCost > 0 ? (
                            <>
                              <div className="text-orange-600 font-medium">{formatMoney(par.gstCost)}</div>
                              <div className="text-[10px] text-slate-400">{formatPercent((par.gstCost / par.totalRevenue) * 100)}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold bg-green-50/30 whitespace-nowrap ${!par.hasCostData ? 'text-slate-400' : par.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {par.hasCostData ? formatMoney(par.netProfit) : '-'}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium bg-green-50/30 whitespace-nowrap ${!par.hasCostData ? 'text-slate-400' : par.profitMargin >= 10 ? 'text-green-600' : par.profitMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {par.hasCostData ? formatPercent(par.profitMargin) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                /* Product Table - Same columns as SKU table */
                <table className="w-full min-w-max divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 sticky top-0 z-20">
                    <tr>
                      <th
                        className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky left-0 bg-slate-50 z-30 cursor-pointer hover:bg-slate-100 min-w-[280px] max-w-[400px] border-r border-slate-200"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          Product
                          {sortColumn === 'name' && <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">FF</th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                        onClick={() => handleSort('totalRevenue')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Revenue
                          {sortColumn === 'totalRevenue' && <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                        onClick={() => handleSort('totalOrders')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Orders
                          {sortColumn === 'totalOrders' && <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                        onClick={() => handleSort('totalQuantity')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Qty
                          {sortColumn === 'totalQuantity' && <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-red-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap border-r border-slate-200"
                        onClick={() => handleSort('refundedQuantity')}
                        title="Refunded Quantity"
                      >
                        <div className="flex items-center justify-end gap-1">
                          RQty
                          {sortColumn === 'refundedQuantity' && <span className="text-red-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
                        onClick={() => handleSort('sellingFees')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Selling
                          {sortColumn === 'sellingFees' && <span className="text-red-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
                        onClick={() => handleSort('fbaFees')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          FBA Fee
                          {sortColumn === 'fbaFees' && <span className="text-red-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap"
                        onClick={() => handleSort('refundLoss')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Refund
                          {sortColumn === 'refundLoss' && <span className="text-red-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-red-700 bg-red-50 cursor-pointer hover:bg-red-100 whitespace-nowrap border-r border-slate-200"
                        onClick={() => handleSort('vat')}
                        title="VAT (EU marketplaces)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          VAT
                          {sortColumn === 'vat' && <span className="text-red-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-pink-700 bg-pink-50 cursor-pointer hover:bg-pink-100 whitespace-nowrap"
                        onClick={() => handleSort('advertisingCost')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Ads
                          {sortColumn === 'advertisingCost' && <span className="text-pink-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-indigo-700 bg-indigo-50 cursor-pointer hover:bg-indigo-100 whitespace-nowrap"
                        onClick={() => handleSort('fbaCost')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          FBA Cost
                          {sortColumn === 'fbaCost' && <span className="text-indigo-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-cyan-700 bg-cyan-50 cursor-pointer hover:bg-cyan-100 whitespace-nowrap border-r border-slate-200"
                        onClick={() => handleSort('fbmCost')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          FBM Cost
                          {sortColumn === 'fbmCost' && <span className="text-cyan-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                        onClick={() => handleSort('productCost')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Cost
                          {sortColumn === 'productCost' && <span className="text-slate-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 whitespace-nowrap"
                        onClick={() => handleSort('shippingCost')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Ship
                          {sortColumn === 'shippingCost' && <span className="text-slate-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 cursor-pointer hover:bg-amber-100 whitespace-nowrap"
                        onClick={() => handleSort('customsDuty')}
                        title="Gümrük Vergisi (FBM-TR)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Customs
                          {sortColumn === 'customsDuty' && <span className="text-amber-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 cursor-pointer hover:bg-amber-100 whitespace-nowrap"
                        onClick={() => handleSort('ddpFee')}
                        title="DDP Ücreti (FBM-TR)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          DDP
                          {sortColumn === 'ddpFee' && <span className="text-amber-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50 cursor-pointer hover:bg-amber-100 whitespace-nowrap"
                        onClick={() => handleSort('warehouseCost')}
                        title="Depo+İşçilik (FBA veya FBM-Local)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Warehouse
                          {sortColumn === 'warehouseCost' && <span className="text-amber-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-orange-700 bg-orange-50 cursor-pointer hover:bg-orange-100 whitespace-nowrap border-r border-slate-200"
                        onClick={() => handleSort('gstCost')}
                        title="GST/VAT (AU vb.)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          GST
                          {sortColumn === 'gstCost' && <span className="text-orange-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 cursor-pointer hover:bg-green-100 whitespace-nowrap"
                        onClick={() => handleSort('netProfit')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Net Profit
                          {sortColumn === 'netProfit' && <span className="text-green-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                      <th
                        className="px-3 py-2 text-right text-xs font-semibold text-green-700 bg-green-50 cursor-pointer hover:bg-green-100 whitespace-nowrap"
                        onClick={() => handleSort('profitMargin')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Margin
                          {sortColumn === 'profitMargin' && <span className="text-green-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {displayProducts
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map(product => (
                        <tr
                          key={product.name}
                          className="hover:bg-slate-50"
                        >
                          <td
                            className="px-3 py-2 text-left sticky left-0 bg-white z-10 min-w-[280px] max-w-[400px] border-r border-slate-200 cursor-pointer hover:bg-blue-50"
                            onClick={() => setSelectedItem({ type: 'product', data: product })}
                          >
                            <div className="font-medium text-blue-600 text-xs break-words" title={product.name}>{product.name}</div>
                            <div className="text-[10px] text-slate-400">{product.category} • {product.skus.length} SKUs</div>
                          </td>
                          <td className="px-3 py-2 text-center border-r border-slate-200">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              product.fulfillment === 'FBA' ? 'bg-blue-100 text-blue-700' :
                              product.fulfillment === 'FBM' ? 'bg-orange-100 text-orange-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {product.fulfillment}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
                            {showPerUnit
                              ? formatMoney(product.totalQuantity > 0 ? product.totalRevenue / product.totalQuantity : 0)
                              : formatMoney(product.totalRevenue)}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-600">{product.totalOrders}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{product.totalQuantity}</td>
                          <td className="px-3 py-2 text-right text-red-500 border-r border-slate-100">{product.refundedQuantity > 0 ? product.refundedQuantity : '-'}</td>
                          <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
                            <div className="text-red-600 font-medium">{formatPercent(product.sellingFeePercent)}</div>
                            <div className="text-[10px] text-slate-400">
                              {showPerUnit
                                ? formatMoney(product.totalQuantity > 0 ? product.sellingFees / product.totalQuantity : 0)
                                : formatMoney(product.sellingFees)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
                            <div className="text-red-600 font-medium">{formatPercent(product.fbaFeePercent)}</div>
                            <div className="text-[10px] text-slate-400">
                              {showPerUnit
                                ? formatMoney(product.totalQuantity > 0 ? product.fbaFees / product.totalQuantity : 0)
                                : formatMoney(product.fbaFees)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right bg-red-50/30 whitespace-nowrap">
                            <div className="text-red-600 font-medium">{formatPercent(product.refundLossPercent)}</div>
                            <div className="text-[10px] text-slate-400">
                              {showPerUnit
                                ? formatMoney(product.totalQuantity > 0 ? product.refundLoss / product.totalQuantity : 0)
                                : formatMoney(product.refundLoss)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right bg-red-50/30 border-r border-slate-100 whitespace-nowrap">
                            {product.vat > 0 ? (
                              <>
                                <div className="text-red-600 font-medium">{formatPercent(product.vatPercent)}</div>
                                <div className="text-[10px] text-slate-400">
                                  {showPerUnit
                                    ? formatMoney(product.totalQuantity > 0 ? product.vat / product.totalQuantity : 0)
                                    : formatMoney(product.vat)}
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right bg-pink-50/30 whitespace-nowrap">
                            <div className="text-pink-600 font-medium">{formatPercent(product.advertisingPercent)}</div>
                            <div className="text-[10px] text-slate-400">
                              {showPerUnit
                                ? formatMoney(product.totalQuantity > 0 ? product.advertisingCost / product.totalQuantity : 0)
                                : formatMoney(product.advertisingCost)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right bg-indigo-50/30 whitespace-nowrap">
                            <div className="text-indigo-600 font-medium">{formatPercent(product.fbaCostPercent)}</div>
                            <div className="text-[10px] text-slate-400">
                              {showPerUnit
                                ? formatMoney(product.totalQuantity > 0 ? product.fbaCost / product.totalQuantity : 0)
                                : formatMoney(product.fbaCost)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right bg-cyan-50/30 border-r border-slate-100 whitespace-nowrap">
                            <div className="text-cyan-600 font-medium">{formatPercent(product.fbmCostPercent)}</div>
                            <div className="text-[10px] text-slate-400">
                              {showPerUnit
                                ? formatMoney(product.totalQuantity > 0 ? product.fbmCost / product.totalQuantity : 0)
                                : formatMoney(product.fbmCost)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <div className="text-slate-800 font-medium">
                              {showPerUnit
                                ? formatMoney(product.totalQuantity > 0 ? product.totalProductCost / product.totalQuantity : 0)
                                : formatMoney(product.totalProductCost)}
                            </div>
                            <div className="text-[10px] text-slate-400">{formatPercent(product.productCostPercent)}</div>
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <div className="text-slate-800 font-medium">
                              {showPerUnit
                                ? formatMoney(product.totalQuantity > 0 ? product.shippingCost / product.totalQuantity : 0)
                                : formatMoney(product.shippingCost)}
                            </div>
                            <div className="text-[10px] text-slate-400">{formatPercent(product.shippingCostPercent)}</div>
                          </td>
                          <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
                            {product.customsDuty > 0 ? (
                              <>
                                <div className="text-amber-600 font-medium">
                                  {showPerUnit
                                    ? formatMoney(product.totalQuantity > 0 ? product.customsDuty / product.totalQuantity : 0)
                                    : formatMoney(product.customsDuty)}
                                </div>
                                <div className="text-[10px] text-slate-400">{formatPercent((product.customsDuty / product.totalRevenue) * 100)}</div>
                              </>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
                            {product.ddpFee > 0 ? (
                              <>
                                <div className="text-amber-600 font-medium">
                                  {showPerUnit
                                    ? formatMoney(product.totalQuantity > 0 ? product.ddpFee / product.totalQuantity : 0)
                                    : formatMoney(product.ddpFee)}
                                </div>
                                <div className="text-[10px] text-slate-400">{formatPercent((product.ddpFee / product.totalRevenue) * 100)}</div>
                              </>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right bg-amber-50/30 whitespace-nowrap">
                            {product.warehouseCost > 0 ? (
                              <>
                                <div className="text-amber-600 font-medium">
                                  {showPerUnit
                                    ? formatMoney(product.totalQuantity > 0 ? product.warehouseCost / product.totalQuantity : 0)
                                    : formatMoney(product.warehouseCost)}
                                </div>
                                <div className="text-[10px] text-slate-400">{formatPercent((product.warehouseCost / product.totalRevenue) * 100)}</div>
                              </>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right bg-orange-50/30 border-r border-slate-100 whitespace-nowrap">
                            {product.gstCost > 0 ? (
                              <>
                                <div className="text-orange-600 font-medium">
                                  {showPerUnit
                                    ? formatMoney(product.totalQuantity > 0 ? product.gstCost / product.totalQuantity : 0)
                                    : formatMoney(product.gstCost)}
                                </div>
                                <div className="text-[10px] text-slate-400">{formatPercent((product.gstCost / product.totalRevenue) * 100)}</div>
                              </>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className={`px-3 py-2 text-right font-bold bg-green-50/30 whitespace-nowrap ${product.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {showPerUnit
                              ? formatMoney(product.totalQuantity > 0 ? product.netProfit / product.totalQuantity : 0)
                              : formatMoney(product.netProfit)}
                          </td>
                          <td className={`px-3 py-2 text-right font-medium bg-green-50/30 whitespace-nowrap ${product.profitMargin >= 10 ? 'text-green-600' : product.profitMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {formatPercent(product.profitMargin)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls - for SKU and Product views */}
            {((detailsViewMode === 'sku' && displaySkus.length > itemsPerPage) ||
              (detailsViewMode === 'name' && displayProducts.length > itemsPerPage)) && (
              <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
                <div className="text-sm text-slate-600">
                  {detailsViewMode === 'sku' ? (
                    <>Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, displaySkus.length)} of {displaySkus.length} SKUs</>
                  ) : (
                    <>Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, displayProducts.length)} of {displayProducts.length} products</>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600">
                    Page {currentPage} of {Math.ceil((detailsViewMode === 'sku' ? displaySkus.length : displayProducts.length) / itemsPerPage)}
                  </span>
                  <button
                    onClick={() => {
                      const totalItems = detailsViewMode === 'sku' ? displaySkus.length : displayProducts.length;
                      setCurrentPage(Math.min(Math.ceil(totalItems / itemsPerPage), currentPage + 1));
                    }}
                    disabled={currentPage >= Math.ceil((detailsViewMode === 'sku' ? displaySkus.length : displayProducts.length) / itemsPerPage)}
                    className="px-3 py-1 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {allProducts.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Analysis Data</h3>
            <p className="text-slate-500 mb-6">
              Load transaction data and adjust filters to see profitability analysis
            </p>
          </div>
        )}

        {/* Pie Chart Modal - Lazy loaded */}
        <Suspense fallback={null}>
          <PieChartModal
            selectedItem={selectedItem}
            onClose={() => setSelectedItem(null)}
            formatMoney={formatMoney}
          />
        </Suspense>
      </div>
    </div>
  );
};

// Wrapper component with Provider
const ProfitabilityAnalyzer: React.FC<ProfitabilityAnalyzerProps> = (props) => (
  <ProfitabilityFilterProvider>
    <ProfitabilityAnalyzerInner {...props} />
  </ProfitabilityFilterProvider>
);

export default ProfitabilityAnalyzer;
