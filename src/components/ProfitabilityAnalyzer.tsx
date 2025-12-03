/**
 * Phase 3: Profitability Analyzer
 * Transaction-based profit analysis like Phase 2
 * Shows actual profit/loss from historical data with cost analysis
 */

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { ChevronDown, ChevronUp, DollarSign, Truck, Settings, BarChart3, AlertTriangle, RefreshCw } from 'lucide-react';
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
import { convertCurrency, getMarketplaceCurrency, fetchLiveRates, getExchangeRateStatus, type ExchangeRateStatus } from '../utils/currencyExchange';

// Sub-components - StatusBadge is small, keep it sync
import StatusBadge from './profitability-analyzer/StatusBadge';
import { ProfitabilityDetailsTable } from './profitability-analyzer/ProfitabilityDetailsTable';
import { CategoryCardsSection } from './profitability-analyzer/CategoryCardsSection';
import { FiltersSection } from './profitability-analyzer/FiltersSection';
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
const ProductCountryAnalysis = lazy(() => import('./profitability-analyzer/ProductCountryAnalysis'));

// Tab loading fallback
const TabLoadingFallback = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
  </div>
);

// Storage key for NAME overrides
const NAME_OVERRIDES_STORAGE_KEY = 'amazon-analyzer-name-overrides';
const TOTAL_CATALOG_PRODUCTS_KEY = 'amazon-analyzer-total-catalog-products';

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
    selectedMarketplaces,
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
    setSelectedMarketplaces,
    toggleMarketplace,
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

  // Exchange rate status for warning display
  const [exchangeRateStatus, setExchangeRateStatus] = useState<ExchangeRateStatus | null>(null);

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

  // Total catalog products - manually entered
  const [totalCatalogProducts, setTotalCatalogProducts] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(TOTAL_CATALOG_PRODUCTS_KEY);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Save total catalog products to localStorage
  useEffect(() => {
    localStorage.setItem(TOTAL_CATALOG_PRODUCTS_KEY, totalCatalogProducts.toString());
  }, [totalCatalogProducts]);

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

    // Fetch live exchange rates from Frankfurter API
    fetchLiveRates().then(({ status }) => {
      setExchangeRateStatus(status);
    });
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

    // Step 4: Apply NAME-level overrides
    // These are US-specific (customShipping, fbmSource) but should be applied
    // even in All Marketplaces mode so calculateSKUProfitability can use them
    // for US entries. The function handles marketplace-specific logic internally.
    if (nameOverrides.length > 0) {
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
  }, [costData, nameOverrides]);

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
  // NOTE: Fulfillment filtering is NOT applied here - it's applied at display level
  // This ensures SKU's true fulfillment type is calculated from ALL its transactions
  // (not just filtered ones), preventing Mixed SKUs from appearing as FBA/FBM-only
  const filteredTransactions = useMemo(() => {
    const filtered = transactionData.filter(t => {
      if (!t.sku) return false;

      // Date filtering
      if (startDate || endDate) {
        const transactionDate = new Date(t.date);
        if (startDate && transactionDate < new Date(startDate)) return false;
        if (endDate && transactionDate > new Date(endDate)) return false;
      }

      // Marketplace filtering - support multi-select
      if (selectedMarketplaces.size > 0) {
        // Multi-select mode: filter by selected marketplaces
        if (!t.marketplaceCode || !selectedMarketplaces.has(t.marketplaceCode)) return false;
      } else if (filterMarketplace !== 'all' && t.marketplaceCode !== filterMarketplace) {
        // Single select mode
        return false;
      }

      // NOTE: Fulfillment filtering removed from here - applied at displaySkus level
      // This ensures SKU fulfillment type is calculated from all transactions

      return true;
    });

    return filtered;
  }, [transactionData, startDate, endDate, filterMarketplace, selectedMarketplaces]);

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

      // Marketplace filtering - support multi-select
      if (selectedMarketplaces.size > 0) {
        if (!t.marketplaceCode || !selectedMarketplaces.has(t.marketplaceCode)) return false;
      } else if (filterMarketplace !== 'all' && t.marketplaceCode !== filterMarketplace) {
        return false;
      }

      return true;
    });
  }, [transactionData, startDate, endDate, filterMarketplace, selectedMarketplaces]);

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

  // Helper: Calculate costPercentages for a specific marketplace
  const calculateMarketplaceCostPercentages = useCallback((mpCode: MarketplaceCode | null) => {
    // Filter transactions for this marketplace
    const mpTransactions = mpCode
      ? costTransactions.filter(t => t.marketplaceCode === mpCode)
      : costTransactions;

    const advertisingCost = calculateAdvertisingCost(mpTransactions, mpCode);
    const fbaCost = calculateFBACosts(mpTransactions, mpCode);
    const fbmCost = calculateFBMCosts(mpTransactions, mpCode);

    const orders = mpTransactions.filter(t => t.categoryType === 'Order');
    const totalRevenue = orders.reduce((sum, t) => sum + (t.productSales || 0), 0);

    const fbaRevenue = orders
      .filter(t => t.fulfillment === 'FBA' || t.fulfillment === 'AFN')
      .reduce((sum, t) => sum + (t.productSales || 0), 0);

    const fbmRevenue = orders
      .filter(t => t.fulfillment !== 'FBA' && t.fulfillment !== 'AFN')
      .reduce((sum, t) => sum + (t.productSales || 0), 0);

    const mpConfig = mpCode ? MARKETPLACE_CONFIGS[mpCode] : null;
    const refundRecoveryRate = mpConfig?.refundRecoveryRate ?? 0.30;

    return {
      advertisingPercent: totalRevenue > 0 ? (advertisingCost / totalRevenue) * 100 : 0,
      fbaCostPercent: fbaRevenue > 0 ? (fbaCost / fbaRevenue) * 100 : 0,
      fbmCostPercent: fbmRevenue > 0 ? (fbmCost / fbmRevenue) * 100 : 0,
      refundRecoveryRate,
    };
  }, [costTransactions]);

  // SKU-level profitability (most granular - shows FBA/FBM clearly)
  // Uses costPercentages to apply global costs (Ads, FBA Cost, FBM Cost)
  // For "All Marketplaces" or multi-select: Calculate separately per marketplace with marketplace-specific costPercentages
  // This ensures shipping/customs/GST and global costs are calculated correctly per marketplace
  const { skuProfitability, excludedSkus, gradeResellSkus } = useMemo(() => {
    if (filteredTransactions.length === 0) return EMPTY_SKU_RESULT;

    let allSkus;

    // Multi-marketplace mode: either "all" selected OR multiple marketplaces in multi-select
    const isMultiMarketplace = filterMarketplace === 'all' || selectedMarketplaces.size > 1;

    if (isMultiMarketplace) {
      // All Marketplaces or Multi-select: Calculate per marketplace with marketplace-specific costPercentages
      // This ensures Ads%, FBA Cost%, FBM Cost% are calculated correctly for each marketplace

      // Get unique marketplaces from transactions
      const marketplaces = Array.from(new Set(
        filteredTransactions
          .map(t => t.marketplaceCode)
          .filter((mp): mp is MarketplaceCode => mp !== undefined && mp !== null)
      ));

      // Calculate SKUs for each marketplace with its own costPercentages
      const allMarketplaceSkus: ReturnType<typeof calculateSKUProfitability> = [];

      marketplaces.forEach(mpCode => {
        const mpTransactions = filteredTransactions.filter(t => t.marketplaceCode === mpCode);
        if (mpTransactions.length === 0) return;

        // Calculate marketplace-specific costPercentages
        const mpCostPercentages = calculateMarketplaceCostPercentages(mpCode);

        // Calculate SKUs for this marketplace
        const mpSkus = calculateSKUProfitability(
          mpTransactions,
          mergedCostData,
          shippingRates,
          countryConfigs,
          mpCode,
          mpCostPercentages
        );

        // Add marketplace info and convert to USD for All Marketplaces aggregation
        const sourceCurrency = getMarketplaceCurrency(mpCode);

        mpSkus.forEach(sku => {
          // Add marketplace info
          (sku as any).marketplace = mpCode;

          // Convert all monetary values to USD for proper aggregation
          if (sourceCurrency !== 'USD') {
            const convert = (val: number) => convertCurrency(val, sourceCurrency, 'USD');

            sku.totalRevenue = convert(sku.totalRevenue);
            sku.avgSalePrice = convert(sku.avgSalePrice);
            sku.sellingFees = convert(sku.sellingFees);
            sku.fbaFees = convert(sku.fbaFees);
            sku.refundLoss = convert(sku.refundLoss);
            sku.vat = convert(sku.vat);
            sku.totalAmazonFees = convert(sku.totalAmazonFees);
            sku.productCost = convert(sku.productCost);
            sku.totalProductCost = convert(sku.totalProductCost);
            sku.shippingCost = convert(sku.shippingCost);
            sku.customsDuty = convert(sku.customsDuty);
            sku.ddpFee = convert(sku.ddpFee);
            sku.warehouseCost = convert(sku.warehouseCost);
            sku.othersCost = convert(sku.othersCost);
            sku.gstCost = convert(sku.gstCost);
            sku.advertisingCost = convert(sku.advertisingCost);
            sku.fbaCost = convert(sku.fbaCost);
            sku.fbmCost = convert(sku.fbmCost);
            sku.grossProfit = convert(sku.grossProfit);
            sku.netProfit = convert(sku.netProfit);
            // Note: Percentages (profitMargin, roi, etc.) don't need conversion
          }
        });

        allMarketplaceSkus.push(...mpSkus);
      });

      allSkus = allMarketplaceSkus;
    } else {
      // Single marketplace: Calculate normally
      allSkus = calculateSKUProfitability(
        filteredTransactions,
        mergedCostData,
        shippingRates,
        countryConfigs,
        filterMarketplace as MarketplaceCode,
        costPercentages
      );
    }

    // Separate Grade & Resell SKUs
    const grSkus = allSkus.filter(s => isGradeResellSku(s.sku));
    const nonGrSkus = excludeGradeResell ? allSkus.filter(s => !isGradeResellSku(s.sku)) : allSkus;

    // Filter SKUs with complete data vs excluded
    const included = nonGrSkus.filter(s => s.hasCostData && s.hasSizeData);
    const excluded = nonGrSkus
      .filter(s => !s.hasCostData || !s.hasSizeData)
      .sort((a, b) => b.totalRevenue - a.totalRevenue); // Sort by revenue desc
    return { skuProfitability: included, excludedSkus: excluded, gradeResellSkus: grSkus };
  }, [filteredTransactions, mergedCostData, shippingRates, countryConfigs, filterMarketplace, selectedMarketplaces, costPercentages, excludeGradeResell, calculateMarketplaceCostPercentages]);

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

    // Fulfillment filter - show only exact matches
    if (filterFulfillment !== 'all') {
      filtered = filtered.filter(p => p.fulfillment === filterFulfillment);
    }

    // Sort by revenue descending
    filtered.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return filtered;
  }, [parentProfitability, filterCategory, filterParent, filterFulfillment]);

  const displayCategories = useMemo(() => {
    let filtered = [...categoryProfitability];

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(c => c.category === filterCategory);
    }

    // Fulfillment filter - show only exact matches
    if (filterFulfillment !== 'all') {
      filtered = filtered.filter(c => c.fulfillment === filterFulfillment);
    }

    // Sort by revenue descending
    filtered.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return filtered;
  }, [categoryProfitability, filterCategory, filterFulfillment]);

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
    // Grade & Resell stats (calculate first for totalRevenue)
    const gradeResellCount = gradeResellSkus.length;
    const gradeResellRevenue = gradeResellSkus.reduce((sum, s) => sum + s.totalRevenue, 0);

    const totalSkus = skuProfitability.length + excludedSkus.length + gradeResellCount;
    const calculatedSkus = skuProfitability.length;
    const excludedCount = excludedSkus.length;
    const coveragePercent = totalSkus > 0 ? (calculatedSkus / totalSkus) * 100 : 0;

    // Revenue coverage - include gradeResellRevenue in total for consistency with other views
    const totalRevenue = [...skuProfitability, ...excludedSkus].reduce((sum, s) => sum + s.totalRevenue, 0) + gradeResellRevenue;
    const calculatedRevenue = skuProfitability.reduce((sum, s) => sum + s.totalRevenue, 0);
    const excludedRevenue = excludedSkus.reduce((sum, s) => sum + s.totalRevenue, 0);
    const revenueCoveragePercent = totalRevenue > 0 ? (calculatedRevenue / totalRevenue) * 100 : 0;

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

    // Fulfillment filter - show only exact matches
    if (filterFulfillment !== 'all') {
      filtered = filtered.filter(p => p.fulfillment === filterFulfillment);
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
  }, [profitabilityProducts, filterCategory, filterParent, filterName, filterFulfillment, sortColumn, sortDirection]);

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

    // Fulfillment filter - show only exact matches, exclude Mixed from single-type filters
    if (filterFulfillment !== 'all') {
      filtered = filtered.filter(s => {
        // Only show exact fulfillment matches - Mixed SKUs are excluded from FBA/FBM-only filters
        return s.fulfillment === filterFulfillment;
      });
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
  }, [skuProfitability, filterCategory, filterParent, filterName, filterFulfillment, sortColumn, sortDirection]);

  // ============================================
  // HELPER: FORMAT MONEY (memoized)
  // ============================================
  // Use 'all' (USD) formatting when multiple marketplaces are selected
  const effectiveMarketplace = selectedMarketplaces.size > 1 ? 'all' : filterMarketplace;
  const formatMoney = useMemo(() => createMoneyFormatter(effectiveMarketplace), [effectiveMarketplace]);

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
                  totalCatalogProducts={totalCatalogProducts}
                  onTotalCatalogProductsChange={setTotalCatalogProducts}
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

        {/* Exchange Rate Warning - shows when API fetch failed */}
        {exchangeRateStatus?.error && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-red-800 mb-1">Döviz Kuru Uyarısı</div>
              <div className="text-sm text-red-700">{exchangeRateStatus.error}</div>
              {exchangeRateStatus.source === 'fallback' && (
                <div className="text-xs text-red-600 mt-1">
                  Fallback kurlar kullanılıyor. All Marketplaces modunda USD dönüşümleri güncel olmayabilir.
                </div>
              )}
            </div>
            <button
              onClick={async () => {
                const { status } = await fetchLiveRates();
                setExchangeRateStatus(status);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Tekrar Dene
            </button>
          </div>
        )}

        {/* Exchange Rate Success Info - subtle indicator when using live rates */}
        {exchangeRateStatus?.source === 'api' && filterMarketplace === 'all' && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-4 flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-green-700">
              Canlı döviz kurları aktif (ECB/Frankfurter) - Son güncelleme: {exchangeRateStatus.lastUpdate ? new Date(exchangeRateStatus.lastUpdate).toLocaleString('tr-TR') : '-'}
            </span>
          </div>
        )}

        {/* Filters Section - Extracted Component */}
        <FiltersSection
          startDate={startDate}
          endDate={endDate}
          filterMarketplace={filterMarketplace}
          selectedMarketplaces={selectedMarketplaces}
          filterFulfillment={filterFulfillment}
          marketplaces={marketplaces}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          setFilterMarketplace={setFilterMarketplace}
          setSelectedMarketplaces={setSelectedMarketplaces}
          toggleMarketplace={toggleMarketplace}
          setFilterFulfillment={setFilterFulfillment}
          setFilterCategory={setFilterCategory}
        />

        {/* Coverage Stats - Data Coverage Section */}
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

        {/* Category Cards - Extracted Component */}
        <CategoryCardsSection
          categoryProfitability={categoryProfitability}
          skuProfitability={skuProfitability}
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
            totalCatalogProducts={totalCatalogProducts}
            productsWithSales={allProducts.filter(p => p.totalQuantity > 0).length}
          />
        )}

        {/* Product Country Analysis - Only visible in All Marketplaces mode, after Details */}
        {filterMarketplace === 'all' && skuProfitability.length > 0 && (
          <Suspense fallback={<TabLoadingFallback />}>
            <ProductCountryAnalysis
              skuProfitability={skuProfitability}
              formatMoney={formatMoney}
              filterFulfillment={filterFulfillment}
              startDate={startDate}
              endDate={endDate}
            />
          </Suspense>
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
