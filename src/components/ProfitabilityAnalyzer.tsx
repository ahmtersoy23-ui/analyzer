/**
 * Phase 3: Profitability Analyzer
 * Transaction-based profit analysis like Phase 2
 * Shows actual profit/loss from historical data with cost analysis
 */

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { ChevronDown, ChevronUp, DollarSign, Truck, Settings, BarChart3, Filter, PieChart as PieChartIcon, AlertTriangle, Download } from 'lucide-react';
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
import { ProfitabilityDetailsTable } from './profitability-analyzer/ProfitabilityDetailsTable';

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
