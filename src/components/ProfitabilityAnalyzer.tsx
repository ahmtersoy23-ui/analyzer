/**
 * Phase 3: Profitability Analyzer
 * Transaction-based profit analysis like Phase 2
 * Shows actual profit/loss from historical data with cost analysis
 */

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { ChevronDown, ChevronUp, DollarSign, Truck, Settings, BarChart3, AlertTriangle, RefreshCw, Download } from 'lucide-react';
import { logger } from '../utils/logger';
import { TransactionData, MarketplaceCode } from '../types/transaction';
import {
  ProductCostData,
  CostDataSummary,
  ShippingRateTable,
  AllCountryConfigs,
} from '../types/profitability';
import {
  loadShippingRatesAsync,
  loadCountryConfigsAsync,
  createEmptyShippingRates,
  createDefaultCountryConfigs,
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
import { exportForPricingCalculator, exportAmazonExpensesV2ForPriceLab } from '../services/profitability/pricingExport';
import {
  calculateAdvertisingCost,
  calculateFBACosts,
  calculateFBMCosts,
  calculateProductAnalytics,
} from '../services/analytics/productAnalytics';
import { createMoneyFormatter, formatPercent, getDateOnly } from '../utils/formatters';
import { isDateInRange } from '../services/analytics/calculations';
import { MARKETPLACE_CONFIGS } from '../constants/marketplaces';
import { convertCurrency, getMarketplaceCurrency, fetchLiveRates, type ExchangeRateStatus } from '../utils/currencyExchange';
import { ProfitabilityDetailsTable } from './profitability-analyzer/ProfitabilityDetailsTable';
import { CategoryCardsSection } from './profitability-analyzer/CategoryCardsSection';
import { FiltersSection } from './profitability-analyzer/FiltersSection';
import { CoverageStatsSection } from './profitability-analyzer/CoverageStatsSection';
import { exportMissingSKUsToPriceLab, type MissingSKUInfo } from '../services/productMapping';
import { fetchFbmOverrides, saveFbmOverridesBulk, type FbmOverride } from '../services/api/configApi';

// Types needed for lazy components
import type { NameOverride, FBMNameInfo } from './profitability-analyzer/CostUploadTab';
import type { SelectedItemType } from './profitability-analyzer/PieChartModal';

// Context
import { ProfitabilityFilterProvider, useProfitabilityFilters } from '../contexts/ProfitabilityFilterContext';
import { useAuth } from '../contexts/AuthContext';

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
const COST_DATA_STORAGE_KEY = 'amazon-analyzer-cost-data';

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
  const { isAdmin } = useAuth();

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
  const [costData, setCostData] = useState<ProductCostData[]>(() => {
    try {
      const saved = localStorage.getItem(COST_DATA_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [costSummary, setCostSummary] = useState<CostDataSummary | null>(null);
  const [shippingRates, setShippingRates] = useState<ShippingRateTable | null>(null);
  const [countryConfigs, setCountryConfigs] = useState<AllCountryConfigs | null>(null);

  // NAME Overrides - NAME bazlı manuel girilen özel kargo ve FBM kaynak bilgileri
  // Bir NAME'e girilen değer, o NAME altındaki tüm FBM SKU'lara uygulanır
  // Loaded from API on mount, saved to API on change
  const [nameOverrides, setNameOverrides] = useState<NameOverride[]>([]);
  const [fbmOverridesLoaded, setFbmOverridesLoaded] = useState(false);
  const fbmOverridesInitialLoadRef = React.useRef(true);

  // Raw SKU-level FBM overrides from API - used to merge with costData
  const [rawSkuOverrides, setRawSkuOverrides] = useState<Map<string, FbmOverride>>(new Map());

  // Load FBM overrides from API and convert to nameOverrides format
  useEffect(() => {
    const loadFbmOverrides = async () => {
      try {
        const apiOverrides = await fetchFbmOverrides();
        if (apiOverrides.length > 0) {
          // Store raw SKU-level overrides for merging with costData
          const skuOverrideMap = new Map<string, FbmOverride>();
          apiOverrides.forEach(o => skuOverrideMap.set(o.sku, o));
          setRawSkuOverrides(skuOverrideMap);

          logger.log(`[FBM Overrides] Loaded ${apiOverrides.length} SKU overrides from API`);

          // Also build nameOverrides for UI display (using SKU as name placeholder)
          const nameMap = new Map<string, { skus: string[]; customShipping: number | null; fbmSource: 'TR' | 'US' | 'BOTH' | null }>();

          apiOverrides.forEach(o => {
            const name = o.sku; // Use SKU as name key for now
            if (!nameMap.has(name)) {
              nameMap.set(name, { skus: [o.sku], customShipping: o.shippingCost, fbmSource: o.shipFromCountry });
            } else {
              const existing = nameMap.get(name)!;
              if (!existing.skus.includes(o.sku)) {
                existing.skus.push(o.sku);
              }
            }
          });

          // Convert nameMap to NameOverride array for UI
          const apiNameOverrides: NameOverride[] = Array.from(nameMap.entries()).map(([name, data]) => ({
            name,
            customShipping: data.customShipping,
            fbmSource: data.fbmSource,
            fbmSkuCount: data.skus.length,
          }));

          if (apiNameOverrides.length > 0) {
            setNameOverrides(apiNameOverrides);
            logger.log(`[FBM Overrides] Applied ${apiNameOverrides.length} overrides from API`);
          } else {
            // Fallback to localStorage if API had no data
            try {
              const savedLocal = localStorage.getItem(NAME_OVERRIDES_STORAGE_KEY);
              if (savedLocal) {
                const localOverrides = JSON.parse(savedLocal);
                setNameOverrides(localOverrides);
              }
            } catch {
              // Ignore localStorage errors
            }
          }
        } else {
          // No API data - try localStorage fallback and migrate to API
          try {
            const savedLocal = localStorage.getItem(NAME_OVERRIDES_STORAGE_KEY);
            if (savedLocal) {
              const localOverrides = JSON.parse(savedLocal);
              setNameOverrides(localOverrides);

              // MIGRATION: If localStorage has data but API is empty, migrate to API
              // Note: We use NAME as SKU placeholder since costData isn't loaded yet
              // The proper SKU mapping happens in the save effect when costData is available
              if (localOverrides.length > 0) {
                logger.log(`[FBM Overrides] Migrating ${localOverrides.length} overrides from localStorage to API...`);

                // Build overrides using NAME as SKU placeholder
                // When costData loads, the save effect will update with proper SKUs
                const skuOverrides: FbmOverride[] = localOverrides.map((override: NameOverride) => ({
                  sku: override.name, // Use NAME as placeholder - will be expanded when costData loads
                  marketplace: 'US',
                  shippingCost: override.customShipping,
                  shipFromCountry: override.fbmSource,
                }));

                if (skuOverrides.length > 0) {
                  saveFbmOverridesBulk(skuOverrides)
                    .then(() => logger.log(`[FBM Overrides] Migration complete: ${skuOverrides.length} overrides saved to API`))
                    .catch(err => console.error('[FBM Overrides] Migration failed:', err));
                }
              }
            }
          } catch {
            // Ignore
          }
        }
      } catch (error) {
        console.error('[FBM Overrides] Error loading from API:', error);
        // Fallback to localStorage
        try {
          const savedLocal = localStorage.getItem(NAME_OVERRIDES_STORAGE_KEY);
          if (savedLocal) {
            setNameOverrides(JSON.parse(savedLocal));
          }
        } catch {
          // Ignore
        }
      } finally {
        setFbmOverridesLoaded(true);
      }
    };

    loadFbmOverrides();
  }, []);

  // Ref to access costData without causing effect re-runs
  const costDataRef = React.useRef(costData);
  React.useEffect(() => {
    costDataRef.current = costData;
  }, [costData]);

  // Save NAME overrides to both localStorage and API
  useEffect(() => {
    // Skip initial load
    if (fbmOverridesInitialLoadRef.current) {
      if (fbmOverridesLoaded) {
        fbmOverridesInitialLoadRef.current = false;
      }
      return;
    }

    // Save to localStorage immediately
    localStorage.setItem(NAME_OVERRIDES_STORAGE_KEY, JSON.stringify(nameOverrides));

    // Save to API - expand nameOverrides to SKU-level using costData
    const saveToApi = async () => {
      if (nameOverrides.length === 0) return;

      // Use ref to get current costData without dependency
      const currentCostData = costDataRef.current;

      // Build SKU-level overrides from nameOverrides
      const skuOverrides: FbmOverride[] = [];

      nameOverrides.forEach(override => {
        // Find all SKUs for this NAME from costData
        const skusForName = currentCostData.filter(c => c.name === override.name).map(c => c.sku);

        if (skusForName.length > 0) {
          skusForName.forEach(sku => {
            skuOverrides.push({
              sku,
              marketplace: 'US', // FBM overrides are primarily for US
              shippingCost: override.customShipping,
              shipFromCountry: override.fbmSource,
            });
          });
        } else {
          // If no SKUs found (shouldn't happen normally), use name as placeholder
          skuOverrides.push({
            sku: override.name, // Use name as SKU placeholder
            marketplace: 'US',
            shippingCost: override.customShipping,
            shipFromCountry: override.fbmSource,
          });
        }
      });

      if (skuOverrides.length > 0) {
        try {
          await saveFbmOverridesBulk(skuOverrides);
          logger.log(`[FBM Overrides] Saved ${skuOverrides.length} overrides to API`);
        } catch (error) {
          console.error('[FBM Overrides] Error saving to API:', error);
        }
      }
    };

    // Debounce API save to avoid too many requests
    const timeoutId = setTimeout(saveToApi, 1000);
    return () => clearTimeout(timeoutId);
  }, [nameOverrides, fbmOverridesLoaded]);

  // Save cost data to localStorage (only when it has actual uploaded data, not extracted data)
  useEffect(() => {
    // Only save if we have cost data and it wasn't just extracted from transactions
    if (costData.length > 0) {
      try {
        localStorage.setItem(COST_DATA_STORAGE_KEY, JSON.stringify(costData));
      } catch (e) {
        console.warn('Cost data too large for localStorage, skipping save');
      }
    }
  }, [costData]);

  // Pie Chart Modal State (type imported from PieChartModal)
  const [selectedItem, setSelectedItem] = useState<SelectedItemType>(null);

  // ============================================
  // LOAD CONFIGS ON MOUNT (from API)
  // ============================================
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        // Load configs from API in parallel
        const [rates, configs] = await Promise.all([
          loadShippingRatesAsync(),
          loadCountryConfigsAsync(),
        ]);
        setShippingRates(rates);
        setCountryConfigs(configs);
        logger.log('✅ Configs loaded from API');
      } catch (error) {
        console.error('Error loading configs from API:', error);
        // Fallback to empty/default configs
        setShippingRates(createEmptyShippingRates());
        setCountryConfigs(createDefaultCountryConfigs());
      }
    };

    loadConfigs();

    // Fetch live exchange rates from Frankfurter API
    fetchLiveRates().then(({ status }) => {
      setExchangeRateStatus(status);
    });
  }, []);

  // Auto-extract cost data from enriched transactions (from PriceLab API)
  // Merge with existing localStorage data - enriched data fills gaps but doesn't override manual entries
  useEffect(() => {
    if (transactionData.length > 0) {
      const extractedCostData = extractCostDataFromTransactions(transactionData);

      // Debug: Log extraction results
      const extractedWithCost = extractedCostData.filter(c => c.cost !== null).length;
      const extractedWithSize = extractedCostData.filter(c => c.size !== null).length;
      logger.log(`[ProfitabilityAnalyzer] Extracted ${extractedCostData.length} SKUs: ${extractedWithCost} with cost, ${extractedWithSize} with size`);

      if (extractedCostData.length > 0) {
        setCostData(prevCostData => {
          // Create a map of existing cost data (from localStorage/Excel upload)
          const existingMap = new Map<string, ProductCostData>();
          prevCostData.forEach(item => existingMap.set(item.sku, item));

          // Create a map of extracted data (from enriched transactions)
          const extractedMap = new Map<string, ProductCostData>();
          extractedCostData.forEach(item => extractedMap.set(item.sku, item));

          // Merge: For each SKU, use existing data if it has cost/size, otherwise use extracted
          // This ensures manual Excel uploads are preserved while API data fills gaps
          const mergedData: ProductCostData[] = [];
          const allSkus = new Set([...Array.from(existingMap.keys()), ...Array.from(extractedMap.keys())]);

          allSkus.forEach(sku => {
            const existing = existingMap.get(sku);
            const extracted = extractedMap.get(sku);

            if (existing && extracted) {
              // Both exist - merge, preferring non-null values from existing (manual) over extracted (API)
              mergedData.push({
                ...extracted, // Base from API (has name, parent, category, etc.)
                ...existing,  // Override with manual entries
                // But fill gaps from API if manual entry is null
                cost: existing.cost ?? extracted.cost,
                size: existing.size ?? extracted.size,
              });
            } else if (existing) {
              mergedData.push(existing);
            } else if (extracted) {
              mergedData.push(extracted);
            }
          });

          // Debug: Log merge results
          const mergedWithCost = mergedData.filter(c => c.cost !== null).length;
          const mergedWithSize = mergedData.filter(c => c.size !== null).length;
          logger.log(`[ProfitabilityAnalyzer] After merge: ${mergedData.length} SKUs: ${mergedWithCost} with cost, ${mergedWithSize} with size`);

          // Only update if there's a change (to prevent infinite loops)
          const hasChanges = mergedData.length !== prevCostData.length ||
            mergedData.some(item => {
              const oldItem = prevCostData.find(c => c.sku === item.sku);
              return !oldItem || oldItem.cost !== item.cost || oldItem.size !== item.size;
            });

          if (hasChanges) {
            logger.log(`[ProfitabilityAnalyzer] Cost data updated (was ${prevCostData.length} SKUs, now ${mergedData.length})`);
          }

          return hasChanges ? mergedData : prevCostData;
        });
      }
    }
  }, [transactionData]);

  // Merge costData with:
  // 1. Sibling SKU matching - aynı NAME altındaki başka SKU'dan cost/size al
  // 2. NAME-level overrides - SADECE US pazarı için geçerli
  const mergedCostData = useMemo((): ProductCostData[] => {
    if (costData.length === 0) return costData;

    // Debug: Log input cost data stats
    const inputWithCost = costData.filter(c => c.cost !== null).length;
    const inputWithSize = costData.filter(c => c.size !== null).length;
    logger.log(`[mergedCostData] Input: ${costData.length} SKUs, ${inputWithCost} with cost, ${inputWithSize} with size`);

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

    // Debug: Log output stats after sibling matching
    const outputWithCost = result.filter(c => c.cost !== null).length;
    const outputWithSize = result.filter(c => c.size !== null).length;
    logger.log(`[mergedCostData] After sibling matching: ${result.length} SKUs, ${outputWithCost} with cost, ${outputWithSize} with size`);

    // Step 4: Apply raw SKU overrides from API (fbm_overrides table)
    // This fills customShipping and fbmSource for SKUs that have overrides
    if (rawSkuOverrides.size > 0) {
      let appliedCount = 0;
      result = result.map(item => {
        const override = rawSkuOverrides.get(item.sku);
        if (!override) return item;

        // Apply override values if not already set
        const needsShipping = item.customShipping === null && override.shippingCost !== null;
        const needsSource = !item.fbmSource && override.shipFromCountry !== null;

        if (!needsShipping && !needsSource) return item;

        appliedCount++;
        return {
          ...item,
          customShipping: needsShipping ? override.shippingCost : item.customShipping,
          fbmSource: needsSource ? override.shipFromCountry : item.fbmSource,
        };
      });
      logger.log(`[mergedCostData] Applied ${appliedCount} FBM overrides from API`);
    }

    return result;
  }, [costData, rawSkuOverrides]);

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

      // Date filtering - use dateOnly string comparison (YYYY-MM-DD), with fallback
      if (!isDateInRange(getDateOnly(t), startDate, endDate)) return false;

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
      // Date filtering - use dateOnly string comparison (YYYY-MM-DD), with fallback
      if (!isDateInRange(getDateOnly(t), startDate, endDate)) return false;

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

  // ============================================
  // MISSING SKU DETECTION
  // ============================================
  // Detect SKUs in transactions that don't have PriceLab mapping
  // A SKU is "missing" if productCategory is undefined (not enriched from PriceLab)
  const missingSKUs = useMemo((): MissingSKUInfo[] => {
    const missingMap = new Map<string, MissingSKUInfo>();

    // Only check Order transactions (not refunds, fees, etc.)
    const orderTransactions = filteredTransactions.filter(t =>
      t.categoryType === 'Order' && t.sku && t.productSales > 0
    );

    orderTransactions.forEach(t => {
      // Skip Grade & Resell products - they're handled separately
      if (isGradeResellSku(t.sku)) return;

      // If productCategory is missing, SKU is not in PriceLab
      if (!t.productCategory) {
        const marketplaceCode = t.marketplaceCode || 'Unknown';
        const key = `${marketplaceCode}:${t.sku}`;

        const existing = missingMap.get(key);
        if (existing) {
          existing.transactionCount++;
          existing.totalRevenue += t.productSales || 0;
          // Update fulfillment if mixed
          if (existing.fulfillment !== t.fulfillment) {
            existing.fulfillment = 'Mixed';
          }
        } else {
          missingMap.set(key, {
            sku: t.sku,
            asin: t.asin,
            name: t.name,
            marketplace: marketplaceCode,
            category: undefined,
            fulfillment: t.fulfillment || 'Unknown',
            transactionCount: 1,
            totalRevenue: t.productSales || 0,
          });
        }
      }
    });

    // Sort by revenue (highest first)
    return Array.from(missingMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredTransactions]);

  // Handler to send missing SKUs to PriceLab
  const handleSendMissingSKUsToPriceLab = useCallback(async () => {
    if (missingSKUs.length === 0) {
      return { added: 0, skipped: 0 };
    }
    return exportMissingSKUsToPriceLab(missingSKUs);
  }, [missingSKUs]);

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
    // Exclude if: missing cost OR missing size OR has shipping issue (FBM/Mixed with $0 shipping)
    const included = nonGrSkus.filter(s => s.hasCostData && s.hasSizeData && !s.hasShippingIssue);
    const excluded = nonGrSkus
      .filter(s => !s.hasCostData || !s.hasSizeData || s.hasShippingIssue)
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

  // Filter SKUs by fulfillment for category cards calculation
  // FBA filter: FBA + Mixed, FBM filter: only FBM
  const filteredByFulfillmentSkus = useMemo(() => {
    if (filterFulfillment === 'all') return skuProfitability;
    if (filterFulfillment === 'FBA') {
      return skuProfitability.filter(s => s.fulfillment === 'FBA' || s.fulfillment === 'Mixed');
    }
    // FBM: only pure FBM, no Mixed
    return skuProfitability.filter(s => s.fulfillment === 'FBM');
  }, [skuProfitability, filterFulfillment]);

  // Products from fulfillment-filtered SKUs (for category cards)
  const filteredProducts = useMemo(() => {
    if (filteredByFulfillmentSkus.length === 0) return EMPTY_ARRAY;
    return calculateProductProfitability(filteredByFulfillmentSkus);
  }, [filteredByFulfillmentSkus]);

  const parentProfitability = useMemo(() => {
    return calculateParentProfitability(profitabilityProducts);
  }, [profitabilityProducts]);

  // Parent profitability from filtered products (for category cards)
  const filteredParentProfitability = useMemo(() => {
    return calculateParentProfitability(filteredProducts);
  }, [filteredProducts]);

  const categoryProfitability = useMemo(() => {
    return calculateCategoryProfitability(parentProfitability, profitabilityProducts);
  }, [parentProfitability, profitabilityProducts]);

  // Category profitability from filtered parents (for category cards)
  const filteredCategoryProfitability = useMemo(() => {
    return calculateCategoryProfitability(filteredParentProfitability, filteredProducts);
  }, [filteredParentProfitability, filteredProducts]);
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

    // Fulfillment filter - FBA shows FBA+Mixed, FBM shows only FBM
    if (filterFulfillment === 'FBA') {
      filtered = filtered.filter(p => p.fulfillment === 'FBA' || p.fulfillment === 'Mixed');
    } else if (filterFulfillment === 'FBM') {
      filtered = filtered.filter(p => p.fulfillment === 'FBM');
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

    // Fulfillment filter - FBA shows FBA+Mixed, FBM shows only FBM
    if (filterFulfillment === 'FBA') {
      filtered = filtered.filter(c => c.fulfillment === 'FBA' || c.fulfillment === 'Mixed');
    } else if (filterFulfillment === 'FBM') {
      filtered = filtered.filter(c => c.fulfillment === 'FBM');
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

    // FBM/Mixed SKUs with $0 shipping cost - this is an error condition
    const shippingIssueSkus = [...skuProfitability, ...excludedSkus].filter(s => s.hasShippingIssue);
    const shippingIssueCount = shippingIssueSkus.length;
    const shippingIssueRevenue = shippingIssueSkus.reduce((sum, s) => sum + s.totalRevenue, 0);

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
      shippingIssueCount,
      shippingIssueRevenue,
      shippingIssueSkus,
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

    // Fulfillment filter - FBA shows FBA+Mixed, FBM shows only FBM
    if (filterFulfillment === 'FBA') {
      filtered = filtered.filter(p => p.fulfillment === 'FBA' || p.fulfillment === 'Mixed');
    } else if (filterFulfillment === 'FBM') {
      filtered = filtered.filter(p => p.fulfillment === 'FBM');
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

    // Fulfillment filter - FBA shows FBA+Mixed, FBM shows only FBM
    if (filterFulfillment === 'FBA') {
      filtered = filtered.filter(s => s.fulfillment === 'FBA' || s.fulfillment === 'Mixed');
    } else if (filterFulfillment === 'FBM') {
      filtered = filtered.filter(s => s.fulfillment === 'FBM');
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
        case 'refundedQuantity':
          aValue = a.refundedQuantity;
          bValue = b.refundedQuantity;
          break;
        case 'vat':
          aValue = a.vat;
          bValue = b.vat;
          break;
        case 'customsDuty':
          aValue = a.customsDuty;
          bValue = b.customsDuty;
          break;
        case 'ddpFee':
          aValue = a.ddpFee;
          bValue = b.ddpFee;
          break;
        case 'warehouseCost':
          aValue = a.warehouseCost;
          bValue = b.warehouseCost;
          break;
        case 'gstCost':
          aValue = a.gstCost;
          bValue = b.gstCost;
          break;
        case 'replacementCount':
          aValue = a.replacementCount;
          bValue = b.replacementCount;
          break;
        case 'mscfCount':
          aValue = a.mscfCount;
          bValue = b.mscfCount;
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

  // Handle inline cost/size/override updates from CoverageStatsSection
  // When FBM override is set for a SKU, also apply to all other SKUs with the same NAME
  const handleInlineCostUpdate = useCallback((updates: { sku: string; name: string; cost: number | null; size: number | null; customShipping?: number | null; fbmSource?: 'TR' | 'US' | 'BOTH' | null }[]) => {
    // Track all SKUs that need FBM override updates (including siblings with same NAME)
    const allFbmOverrides: FbmOverride[] = [];

    setCostData(prev => {
      const newData = [...prev];

      updates.forEach(update => {
        const existingIndex = newData.findIndex(item => item.sku === update.sku);

        if (existingIndex >= 0) {
          // Update existing entry
          newData[existingIndex] = {
            ...newData[existingIndex],
            cost: update.cost ?? newData[existingIndex].cost,
            size: update.size ?? newData[existingIndex].size,
            // Also update override fields if provided
            ...(update.customShipping !== undefined && { customShipping: update.customShipping }),
            ...(update.fbmSource !== undefined && { fbmSource: update.fbmSource }),
          };
        } else {
          // Add new entry
          newData.push({
            sku: update.sku,
            name: update.name,
            cost: update.cost,
            size: update.size,
            customShipping: update.customShipping ?? null,
            fbmSource: update.fbmSource ?? null,
          });
        }

        // If FBM override provided, find all SKUs with same NAME and apply to them too
        if (update.customShipping !== undefined || update.fbmSource !== undefined) {
          // Find all SKUs with same NAME from costData
          const siblingSKUs = newData.filter(item => item.name === update.name).map(item => item.sku);

          // If no siblings found in costData, at least include the current SKU
          const skusToUpdate = siblingSKUs.length > 0 ? siblingSKUs : [update.sku];

          // Apply FBM override to all sibling SKUs
          skusToUpdate.forEach(sku => {
            // Update in costData
            const siblingIndex = newData.findIndex(item => item.sku === sku);
            if (siblingIndex >= 0 && sku !== update.sku) {
              // Update sibling's override fields (not cost/size)
              newData[siblingIndex] = {
                ...newData[siblingIndex],
                ...(update.customShipping !== undefined && { customShipping: update.customShipping }),
                ...(update.fbmSource !== undefined && { fbmSource: update.fbmSource }),
              };
            }

            // Add to database update list
            allFbmOverrides.push({
              sku,
              marketplace: 'US',
              shippingCost: update.customShipping ?? null,
              shipFromCountry: update.fbmSource ?? null,
            });
          });

          if (skusToUpdate.length > 1) {
            logger.log(`[FBM Overrides] Applying override to ${skusToUpdate.length} SKUs with NAME: ${update.name}`);
          }
        }
      });

      return newData;
    });

    // Save all FBM overrides to database
    if (allFbmOverrides.length > 0) {
      saveFbmOverridesBulk(allFbmOverrides)
        .then(() => logger.log(`[FBM Overrides] Saved ${allFbmOverrides.length} overrides from Data Coverage`))
        .catch(err => console.error('[FBM Overrides] Error saving from Data Coverage:', err));
    }
  }, []);

  // Handle SKU-level override updates from CostUploadTab
  // This directly updates costData with customShipping and fbmSource for each SKU
  const handleSkuOverrideUpdate = useCallback((updates: { sku: string; name: string; customShipping: number | null; fbmSource: 'TR' | 'US' | 'BOTH' | null }[]) => {
    setCostData(prev => {
      const newData = [...prev];

      updates.forEach(update => {
        const existingIndex = newData.findIndex(item => item.sku === update.sku);

        if (existingIndex >= 0) {
          // Update existing entry - preserve cost/size, update override fields
          newData[existingIndex] = {
            ...newData[existingIndex],
            customShipping: update.customShipping,
            fbmSource: update.fbmSource,
          };
        } else {
          // Add new entry with override fields
          newData.push({
            sku: update.sku,
            name: update.name,
            cost: null,
            size: null,
            customShipping: update.customShipping,
            fbmSource: update.fbmSource,
          });
        }
      });

      return newData;
    });
  }, []);

  // NOTE: Shipping rates and country configs are now read-only
  // Editing is done through PriceLab

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

            {/* Config Buttons - Data only for Admin, Shipping/Settings for all */}
            <div className="flex items-center gap-2">
              {/* Data Button - Admin Only */}
              {isAdmin && (
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
              )}

              {/* Shipping Button - All Users (read-only for viewers) */}
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

              {/* Settings Button - All Users (read-only for viewers) */}
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
                  onSkuOverrideUpdate={handleSkuOverrideUpdate}
                />
              </Suspense>
            </div>
          )}

          {showShippingRates && shippingRates && (
            <div className="mt-4 border-t-2 border-dashed border-slate-300 pt-6">
              <Suspense fallback={<TabLoadingFallback />}>
                <ShippingRatesTab
                  shippingRates={shippingRates}
                  isAdmin={isAdmin}
                />
              </Suspense>
            </div>
          )}

          {showCountrySettings && countryConfigs && (
            <div className="mt-4 border-t-2 border-dashed border-slate-300 pt-6">
              <Suspense fallback={<TabLoadingFallback />}>
                <CountrySettingsTab
                  countryConfigs={countryConfigs}
                  availableCategories={availableCategories}
                  isAdmin={isAdmin}
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
          costData={costData}
          onCostDataUpdate={handleInlineCostUpdate}
          missingSKUs={missingSKUs}
          onSendMissingSKUsToPriceLab={handleSendMissingSKUsToPriceLab}
        />

        {/* Category Cards - Extracted Component */}
        <CategoryCardsSection
          categoryProfitability={filteredCategoryProfitability}
          skuProfitability={filteredByFulfillmentSkus}
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

        {/* Amazon Expenses Export for PriceLab - Show when All Marketplaces selected - Admin Only */}
        {isAdmin && filterMarketplace === 'all' && skuProfitability.length > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Download className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-purple-800">Amazon Expenses Export</h3>
                  <p className="text-sm text-purple-600">
                    Tüm pazaryerleri için Amazon masrafları (Selling Fees, FBA Fees, Ads, Refunds...) ·
                    {startDate || endDate ? ` ${startDate || '∞'} - ${endDate || '∞'}` : ' Tüm dönem'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const dates = filteredTransactions.map(t => new Date(t.date).getTime());
                  const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
                  const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : new Date();
                  const dateRange = {
                    start: startDate ? new Date(startDate) : minDate,
                    end: endDate ? new Date(endDate) : maxDate,
                  };
                  exportAmazonExpensesV2ForPriceLab(skuProfitability, dateRange);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                JSON İndir
              </button>
            </div>
            <p className="text-xs text-purple-500 mt-2">
              PriceLab'a yüklemek için Amazon masraflarını (kategori bazlı) JSON olarak indirin. Ülke → Fulfillment → Kategori yapısında, margin ve ROI dahil.
            </p>
          </div>
        )}

        {/* Export for Pricing Calculator - Show only when single marketplace selected and has category data - Admin Only */}
        {isAdmin && filterMarketplace !== 'all' && selectedMarketplaces.size === 0 && categoryProfitability.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Download className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-800">Pricing Calculator Export</h3>
                  <p className="text-sm text-blue-600">
                    {categoryProfitability.length} kategori · {filterMarketplace} pazarı ·
                    {startDate || endDate ? ` ${startDate || '∞'} - ${endDate || '∞'}` : ' Tüm dönem'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  // Calculate date range from filtered transactions
                  const dates = filteredTransactions.map(t => new Date(t.date).getTime());
                  const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
                  const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : new Date();

                  // Use filter dates if specified, otherwise use transaction date range
                  const dateRange = {
                    start: startDate ? new Date(startDate) : minDate,
                    end: endDate ? new Date(endDate) : maxDate,
                  };

                  exportForPricingCalculator(
                    categoryProfitability,
                    skuProfitability,
                    costPercentages,
                    filterMarketplace,
                    dateRange
                  );
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </button>
            </div>
            <p className="text-xs text-blue-500 mt-2">
              Bu dosyayı Pricing Calculator'a import ederek kategori bazlı gider yüzdelerini ve ortalama marjları kullanabilirsiniz.
            </p>
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
            isAdmin={isAdmin}
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
            transactionData={transactionData}
            marketplace={filterMarketplace}
            selectedMarketplaces={selectedMarketplaces}
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
