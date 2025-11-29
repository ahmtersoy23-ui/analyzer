/**
 * Phase 3: Profitability Analyzer
 * Transaction-based profit analysis like Phase 2
 * Shows actual profit/loss from historical data with cost analysis
 */

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { ChevronDown, ChevronUp, DollarSign, Truck, Settings, BarChart3, Filter } from 'lucide-react';
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
import { ProfitabilityDetailsTable } from './profitability-analyzer/ProfitabilityDetailsTable';
import { CategoryCardsSection } from './profitability-analyzer/CategoryCardsSection';
import { CoverageStatsSection } from './profitability-analyzer/CoverageStatsSection';

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
    excludeGradeResell,
    sortColumn,
    sortDirection,
    setStartDate,
    setEndDate,
    setFilterMarketplace,
    setFilterFulfillment,
    setFilterCategory,
    setExcludeGradeResell,
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

        {/* Coverage Stats - Extracted Component */}
        {allProducts.length > 0 && (
          <CoverageStatsSection
            coverageStats={coverageStats}
            excludedSkus={excludedSkus}
            excludeGradeResell={excludeGradeResell}
            setExcludeGradeResell={setExcludeGradeResell}
            showExcludedProducts={showExcludedProducts}
            setShowExcludedProducts={setShowExcludedProducts}
            filterMarketplace={filterMarketplace}
            formatMoney={formatMoney}
          />
        )}

        {/* Category Cards - Extracted Component */}
        <CategoryCardsSection
          categoryProfitability={categoryProfitability}
          expandedCategories={expandedCategories}
          setExpandedCategories={setExpandedCategories}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          filterMarketplace={filterMarketplace}
          filterFulfillment={filterFulfillment}
          startDate={startDate}
          endDate={endDate}
          formatMoney={formatMoney}
          formatPercent={formatPercent}
        />

        {/* Details Table - Extracted Component */}
        {profitabilityProducts.length > 0 && (
          <ProfitabilityDetailsTable
            displaySkus={displaySkus}
            displayProducts={displayProducts}
            displayParents={displayParents}
            displayCategories={displayCategories}
            categoryNames={categoryNames}
            parentNames={parentNames}
            productNames={productNames}
            formatMoney={formatMoney}
            onSelectItem={setSelectedItem}
          />
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
