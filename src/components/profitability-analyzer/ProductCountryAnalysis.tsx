/**
 * Product Country Analysis Component
 * Shows NAME-based product analysis across different marketplaces
 * Only visible in "All Marketplaces" mode
 */

import React, { useMemo, useState, useRef, useCallback } from 'react';
import { Globe, TrendingDown, Trophy, ChevronLeft, ChevronRight as ChevronRightIcon, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { SKUProfitAnalysis } from '../../types/profitabilityAnalysis';
import { MARKETPLACE_CONFIGS } from '../../constants/marketplaces';
import type { MarketplaceCode } from '../../types/transaction';
import { formatPercent } from '../../utils/formatters';

interface ProductCountryAnalysisProps {
  skuProfitability: SKUProfitAnalysis[];
  formatMoney: (value: number) => string;
  // Global filters from parent
  filterFulfillment: string;
  startDate: string;
  endDate: string;
}

interface CountryData {
  marketplace: MarketplaceCode;
  revenue: number;
  quantity: number;
  refundedQuantity: number;
  orders: number;
  avgPrice: number;
  netProfit: number;
  profitMargin: number;
  hasCostData: boolean;
  // FBA/FBM/Mixed breakdown
  fbaRevenue: number;
  fbaQuantity: number;
  fbaRefundedQuantity: number;
  fbmRevenue: number;
  fbmQuantity: number;
  fbmRefundedQuantity: number;
  mixedRevenue: number;
  mixedQuantity: number;
  mixedRefundedQuantity: number;
}

interface ProductCountryData {
  name: string;
  category: string;
  parent: string;
  totalRevenue: number;
  totalQuantity: number;
  totalRefundedQuantity: number;
  totalOrders: number;
  avgTotalPrice: number;
  totalNetProfit: number;
  avgProfitMargin: number;
  countries: CountryData[];
  bestCountry: MarketplaceCode | null;
  worstCountry: MarketplaceCode | null;
  // Fulfillment totals for filtering
  totalFbaQuantity: number;
  totalFbaRefundedQuantity: number;
  totalFbmQuantity: number;
  totalFbmRefundedQuantity: number;
  totalMixedQuantity: number;
  totalMixedRefundedQuantity: number;
}

// Pagination
const ITEMS_PER_PAGE = 25;

// Fallback marketplace order if revenue-based sorting not possible
const FALLBACK_MARKETPLACE_ORDER: MarketplaceCode[] = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'AE', 'SA'];

// Marketplace flags
const MARKETPLACE_FLAGS: Record<MarketplaceCode, string> = {
  US: '🇺🇸',
  UK: '🇬🇧',
  DE: '🇩🇪',
  FR: '🇫🇷',
  IT: '🇮🇹',
  ES: '🇪🇸',
  CA: '🇨🇦',
  AU: '🇦🇺',
  AE: '🇦🇪',
  SA: '🇸🇦',
};

const ProductCountryAnalysis: React.FC<ProductCountryAnalysisProps> = ({
  skuProfitability,
  formatMoney,
  filterFulfillment,
  startDate,
  endDate,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showOnlyMultiCountry, setShowOnlyMultiCountry] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  // Dropdown filters (like Details table)
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterParent, setFilterParent] = useState<string>('all');
  const [filterName, setFilterName] = useState<string>('all');
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<Set<MarketplaceCode>>(new Set());

  // Drag-to-scroll refs
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const scrollLeft = useRef(0);
  const scrollTop = useRef(0);

  // Drag-to-scroll handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!tableContainerRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - tableContainerRef.current.offsetLeft;
    startY.current = e.pageY - tableContainerRef.current.offsetTop;
    scrollLeft.current = tableContainerRef.current.scrollLeft;
    scrollTop.current = tableContainerRef.current.scrollTop;
    tableContainerRef.current.style.cursor = 'grabbing';
    tableContainerRef.current.style.userSelect = 'none';
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    if (tableContainerRef.current) {
      tableContainerRef.current.style.cursor = 'grab';
      tableContainerRef.current.style.userSelect = '';
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const y = e.pageY - tableContainerRef.current.offsetTop;
    const walkX = (x - startX.current) * 1.5;
    const walkY = (y - startY.current) * 1.5;
    tableContainerRef.current.scrollLeft = scrollLeft.current - walkX;
    tableContainerRef.current.scrollTop = scrollTop.current - walkY;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDragging.current = false;
    if (tableContainerRef.current) {
      tableContainerRef.current.style.cursor = 'grab';
      tableContainerRef.current.style.userSelect = '';
    }
  }, []);

  // Apply fulfillment filter to SKUs before any calculations
  // Include Mixed SKUs when FBA or FBM is selected (they contain both)
  const filteredSkuProfitability = useMemo(() => {
    if (filterFulfillment === 'all') return skuProfitability;
    // Include both exact match AND Mixed SKUs (which have both FBA and FBM)
    return skuProfitability.filter(sku =>
      sku.fulfillment === filterFulfillment || sku.fulfillment === 'Mixed'
    );
  }, [skuProfitability, filterFulfillment]);

  // Calculate marketplace revenue totals for sorting columns (using filtered data)
  const marketplaceRevenueTotals = useMemo(() => {
    const totals = new Map<MarketplaceCode, number>();
    filteredSkuProfitability.forEach(sku => {
      const mp = (sku as any).marketplace as MarketplaceCode | undefined;
      if (!mp) return;
      totals.set(mp, (totals.get(mp) || 0) + sku.totalRevenue);
    });
    return totals;
  }, [filteredSkuProfitability]);

  // Get unique marketplaces sorted by revenue (descending) - using filtered data
  const availableMarketplaces = useMemo(() => {
    const mps = new Set<MarketplaceCode>();
    filteredSkuProfitability.forEach(sku => {
      if ((sku as any).marketplace) {
        mps.add((sku as any).marketplace as MarketplaceCode);
      }
    });

    // Sort by revenue (descending), fallback to predefined order
    return Array.from(mps).sort((a, b) => {
      const revenueA = marketplaceRevenueTotals.get(a) || 0;
      const revenueB = marketplaceRevenueTotals.get(b) || 0;
      if (revenueA !== revenueB) return revenueB - revenueA;
      // Fallback to predefined order
      return FALLBACK_MARKETPLACE_ORDER.indexOf(a) - FALLBACK_MARKETPLACE_ORDER.indexOf(b);
    });
  }, [filteredSkuProfitability, marketplaceRevenueTotals]);

  // Filtered marketplaces based on selection (empty = all)
  const displayedMarketplaces = useMemo(() => {
    if (selectedMarketplaces.size === 0) return availableMarketplaces;
    return availableMarketplaces.filter(mp => selectedMarketplaces.has(mp));
  }, [availableMarketplaces, selectedMarketplaces]);

  // Toggle marketplace selection
  const toggleMarketplace = useCallback((mp: MarketplaceCode) => {
    setSelectedMarketplaces(prev => {
      const next = new Set(prev);
      if (next.has(mp)) {
        next.delete(mp);
      } else {
        next.add(mp);
      }
      return next;
    });
  }, []);

  // Aggregate SKU data by NAME and marketplace
  const productCountryData = useMemo((): ProductCountryData[] => {
    // Group by NAME
    const nameMap = new Map<string, {
      name: string;
      category: string;
      parent: string;
      byMarketplace: Map<MarketplaceCode, {
        revenue: number;
        quantity: number;
        refundedQuantity: number;
        orders: number;
        netProfit: number;
        hasCostData: boolean;
        fbaRevenue: number;
        fbaQuantity: number;
        fbaRefundedQuantity: number;
        fbmRevenue: number;
        fbmQuantity: number;
        fbmRefundedQuantity: number;
        mixedRevenue: number;
        mixedQuantity: number;
        mixedRefundedQuantity: number;
      }>;
    }>();

    filteredSkuProfitability.forEach(sku => {
      const mp = (sku as any).marketplace as MarketplaceCode | undefined;
      if (!mp) return;

      const isFBA = sku.fulfillment === 'FBA';
      const isFBM = sku.fulfillment === 'FBM';
      const isMixed = sku.fulfillment === 'Mixed';

      const existing = nameMap.get(sku.name);
      if (!existing) {
        nameMap.set(sku.name, {
          name: sku.name,
          category: sku.category,
          parent: sku.parent,
          byMarketplace: new Map([[mp, {
            revenue: sku.totalRevenue,
            quantity: sku.totalQuantity,
            refundedQuantity: sku.refundedQuantity,
            orders: sku.totalOrders,
            netProfit: sku.netProfit,
            hasCostData: sku.hasCostData,
            fbaRevenue: isFBA ? sku.totalRevenue : 0,
            fbaQuantity: isFBA ? sku.totalQuantity : 0,
            fbaRefundedQuantity: isFBA ? sku.refundedQuantity : 0,
            fbmRevenue: isFBM ? sku.totalRevenue : 0,
            fbmQuantity: isFBM ? sku.totalQuantity : 0,
            fbmRefundedQuantity: isFBM ? sku.refundedQuantity : 0,
            mixedRevenue: isMixed ? sku.totalRevenue : 0,
            mixedQuantity: isMixed ? sku.totalQuantity : 0,
            mixedRefundedQuantity: isMixed ? sku.refundedQuantity : 0,
          }]]),
        });
      } else {
        const mpData = existing.byMarketplace.get(mp);
        if (mpData) {
          mpData.revenue += sku.totalRevenue;
          mpData.quantity += sku.totalQuantity;
          mpData.refundedQuantity += sku.refundedQuantity;
          mpData.orders += sku.totalOrders;
          mpData.netProfit += sku.netProfit;
          mpData.hasCostData = mpData.hasCostData && sku.hasCostData;
          if (isFBA) {
            mpData.fbaRevenue += sku.totalRevenue;
            mpData.fbaQuantity += sku.totalQuantity;
            mpData.fbaRefundedQuantity += sku.refundedQuantity;
          }
          if (isFBM) {
            mpData.fbmRevenue += sku.totalRevenue;
            mpData.fbmQuantity += sku.totalQuantity;
            mpData.fbmRefundedQuantity += sku.refundedQuantity;
          }
          if (isMixed) {
            mpData.mixedRevenue += sku.totalRevenue;
            mpData.mixedQuantity += sku.totalQuantity;
            mpData.mixedRefundedQuantity += sku.refundedQuantity;
          }
        } else {
          existing.byMarketplace.set(mp, {
            revenue: sku.totalRevenue,
            quantity: sku.totalQuantity,
            refundedQuantity: sku.refundedQuantity,
            orders: sku.totalOrders,
            netProfit: sku.netProfit,
            hasCostData: sku.hasCostData,
            fbaRevenue: isFBA ? sku.totalRevenue : 0,
            fbaQuantity: isFBA ? sku.totalQuantity : 0,
            fbaRefundedQuantity: isFBA ? sku.refundedQuantity : 0,
            fbmRevenue: isFBM ? sku.totalRevenue : 0,
            fbmQuantity: isFBM ? sku.totalQuantity : 0,
            fbmRefundedQuantity: isFBM ? sku.refundedQuantity : 0,
            mixedRevenue: isMixed ? sku.totalRevenue : 0,
            mixedQuantity: isMixed ? sku.totalQuantity : 0,
            mixedRefundedQuantity: isMixed ? sku.refundedQuantity : 0,
          });
        }
      }
    });

    // Convert to ProductCountryData
    const results: ProductCountryData[] = [];

    nameMap.forEach(({ name, category, parent, byMarketplace }) => {
      const countries: CountryData[] = [];
      let totalRevenue = 0;
      let totalQuantity = 0;
      let totalRefundedQuantity = 0;
      let totalOrders = 0;
      let totalNetProfit = 0;
      let weightedMarginSum = 0;

      byMarketplace.forEach((data, mp) => {
        const avgPrice = data.quantity > 0 ? data.revenue / data.quantity : 0;
        const profitMargin = data.revenue > 0 && data.hasCostData ? (data.netProfit / data.revenue) * 100 : 0;

        countries.push({
          marketplace: mp,
          revenue: data.revenue,
          quantity: data.quantity,
          refundedQuantity: data.refundedQuantity,
          orders: data.orders,
          avgPrice,
          netProfit: data.netProfit,
          profitMargin,
          hasCostData: data.hasCostData,
          fbaRevenue: data.fbaRevenue,
          fbaQuantity: data.fbaQuantity,
          fbaRefundedQuantity: data.fbaRefundedQuantity,
          fbmRevenue: data.fbmRevenue,
          fbmQuantity: data.fbmQuantity,
          fbmRefundedQuantity: data.fbmRefundedQuantity,
          mixedRevenue: data.mixedRevenue,
          mixedQuantity: data.mixedQuantity,
          mixedRefundedQuantity: data.mixedRefundedQuantity,
        });

        totalRevenue += data.revenue;
        totalQuantity += data.quantity;
        totalRefundedQuantity += data.refundedQuantity;
        totalOrders += data.orders;
        totalNetProfit += data.netProfit;

        if (data.hasCostData && data.revenue > 0) {
          weightedMarginSum += profitMargin * data.revenue;
        }
      });

      // Sort countries by revenue desc
      countries.sort((a, b) => b.revenue - a.revenue);

      // Find best/worst country by profit margin (only from countries with cost data)
      const countriesWithCostData = countries.filter(c => c.hasCostData && c.revenue > 100);
      let bestCountry: MarketplaceCode | null = null;
      let worstCountry: MarketplaceCode | null = null;

      if (countriesWithCostData.length >= 2) {
        const sorted = [...countriesWithCostData].sort((a, b) => b.profitMargin - a.profitMargin);
        bestCountry = sorted[0].marketplace;
        worstCountry = sorted[sorted.length - 1].marketplace;
      }

      // Calculate total FBA/FBM/Mixed quantities and refunds
      const totalFbaQuantity = countries.reduce((sum, c) => sum + c.fbaQuantity, 0);
      const totalFbaRefundedQuantity = countries.reduce((sum, c) => sum + c.fbaRefundedQuantity, 0);
      const totalFbmQuantity = countries.reduce((sum, c) => sum + c.fbmQuantity, 0);
      const totalFbmRefundedQuantity = countries.reduce((sum, c) => sum + c.fbmRefundedQuantity, 0);
      const totalMixedQuantity = countries.reduce((sum, c) => sum + c.mixedQuantity, 0);
      const totalMixedRefundedQuantity = countries.reduce((sum, c) => sum + c.mixedRefundedQuantity, 0);

      results.push({
        name,
        category,
        parent,
        totalRevenue,
        totalQuantity,
        totalRefundedQuantity,
        totalOrders,
        avgTotalPrice: totalQuantity > 0 ? totalRevenue / totalQuantity : 0,
        totalNetProfit,
        avgProfitMargin: totalRevenue > 0 ? weightedMarginSum / totalRevenue : 0,
        countries,
        bestCountry,
        worstCountry,
        totalFbaQuantity,
        totalFbaRefundedQuantity,
        totalFbmQuantity,
        totalFbmRefundedQuantity,
        totalMixedQuantity,
        totalMixedRefundedQuantity,
      });
    });

    return results;
  }, [filteredSkuProfitability]);

  // Dropdown options for filters
  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    productCountryData.forEach(p => categories.add(p.category));
    return Array.from(categories).sort();
  }, [productCountryData]);

  const parentOptions = useMemo(() => {
    let data = productCountryData;
    if (filterCategory !== 'all') {
      data = data.filter(p => p.category === filterCategory);
    }
    const parents = new Set<string>();
    data.forEach(p => parents.add(p.parent));
    return Array.from(parents).sort();
  }, [productCountryData, filterCategory]);

  const nameOptions = useMemo(() => {
    let data = productCountryData;
    if (filterCategory !== 'all') {
      data = data.filter(p => p.category === filterCategory);
    }
    if (filterParent !== 'all') {
      data = data.filter(p => p.parent === filterParent);
    }
    return data.map(p => p.name).sort();
  }, [productCountryData, filterCategory, filterParent]);

  // Apply filters and sorting
  // Note: Fulfillment filtering is already applied at parent level via global filters
  const filteredAndSortedData = useMemo(() => {
    let result = [...productCountryData];

    // Filter by category
    if (filterCategory !== 'all') {
      result = result.filter(p => p.category === filterCategory);
    }

    // Filter by parent
    if (filterParent !== 'all') {
      result = result.filter(p => p.parent === filterParent);
    }

    // Filter by name
    if (filterName !== 'all') {
      result = result.filter(p => p.name === filterName);
    }

    // Filter by multi-country
    if (showOnlyMultiCountry) {
      result = result.filter(p => p.countries.length >= 2);
    }

    // Sort by revenue descending
    result.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return result;
  }, [productCountryData, showOnlyMultiCountry, filterCategory, filterParent, filterName]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedData, currentPage]);

  // Reset page when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    setCurrentPage(1);
  }, [showOnlyMultiCountry, filterCategory, filterParent, filterName]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const multiCountryProducts = productCountryData.filter(p => p.countries.length >= 2);

    // Calculate Mixed totals from original skuProfitability (not filtered)
    const mixedSkus = skuProfitability.filter(sku => sku.fulfillment === 'Mixed');
    const totalMixedRevenue = mixedSkus.reduce((sum, sku) => sum + sku.totalRevenue, 0);
    const totalMixedQuantity = mixedSkus.reduce((sum, sku) => sum + sku.totalQuantity, 0);
    const totalRevenue = skuProfitability.reduce((sum, sku) => sum + sku.totalRevenue, 0);

    return {
      totalProducts: productCountryData.length,
      multiCountryProducts: multiCountryProducts.length,
      avgCountriesPerProduct: productCountryData.length > 0
        ? productCountryData.reduce((sum, p) => sum + p.countries.length, 0) / productCountryData.length
        : 0,
      // Mixed stats
      mixedRevenue: totalMixedRevenue,
      mixedQuantity: totalMixedQuantity,
      mixedRevenuePercent: totalRevenue > 0 ? (totalMixedRevenue / totalRevenue) * 100 : 0,
    };
  }, [productCountryData, skuProfitability]);

  // Export to Excel - one sheet per country
  const handleExportExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // Create "All" sheet with totals
    const allSheetData = filteredAndSortedData.map(product => ({
      'Product Name': product.name,
      'Category': product.category,
      'Parent ASIN': product.parent,
      'Total Revenue (USD)': product.totalRevenue,
      'Total Quantity': product.totalQuantity,
      'Refunded Quantity': product.totalRefundedQuantity,
      'Refund Rate %': product.totalQuantity > 0 ? Number(((product.totalRefundedQuantity / product.totalQuantity) * 100).toFixed(1)) : 0,
      'Total Orders': product.totalOrders,
      'Avg Price (USD)': product.avgTotalPrice,
      'Net Profit (USD)': product.totalNetProfit,
      'Profit Margin %': product.avgProfitMargin,
      'FBA Quantity': product.totalFbaQuantity,
      'FBA Refunds': product.totalFbaRefundedQuantity,
      'FBM Quantity': product.totalFbmQuantity,
      'FBM Refunds': product.totalFbmRefundedQuantity,
      'Mixed Quantity': product.totalMixedQuantity,
      'Mixed Refunds': product.totalMixedRefundedQuantity,
      'Countries': product.countries.length,
      'Best Country': product.bestCountry || '-',
      'Worst Country': product.worstCountry || '-',
    }));
    const allSheet = XLSX.utils.json_to_sheet(allSheetData);
    XLSX.utils.book_append_sheet(wb, allSheet, 'All');

    // Create one sheet per marketplace
    availableMarketplaces.forEach(mp => {
      const config = MARKETPLACE_CONFIGS[mp];
      const sheetData = filteredAndSortedData
        .filter(product => product.countries.some(c => c.marketplace === mp))
        .map(product => {
          const countryData = product.countries.find(c => c.marketplace === mp);
          if (!countryData) return null;

          return {
            'Product Name': product.name,
            'Category': product.category,
            'Parent ASIN': product.parent,
            [`Revenue (${config.currency})`]: countryData.revenue,
            'Quantity': countryData.quantity,
            'Refunds': countryData.refundedQuantity,
            'Refund Rate %': countryData.quantity > 0 ? Number(((countryData.refundedQuantity / countryData.quantity) * 100).toFixed(1)) : 0,
            'Orders': countryData.orders,
            [`Avg Price (${config.currency})`]: countryData.avgPrice,
            'Net Profit': countryData.netProfit,
            'Profit Margin %': countryData.hasCostData ? countryData.profitMargin : 'N/A',
            'FBA Quantity': countryData.fbaQuantity,
            'FBA Refunds': countryData.fbaRefundedQuantity,
            'FBM Quantity': countryData.fbmQuantity,
            'FBM Refunds': countryData.fbmRefundedQuantity,
            'Mixed Quantity': countryData.mixedQuantity,
            'Mixed Refunds': countryData.mixedRefundedQuantity,
            'Is Best Country': product.bestCountry === mp ? 'Yes' : '',
            'Is Worst Country': product.worstCountry === mp ? 'Yes' : '',
          };
        })
        .filter(Boolean);

      if (sheetData.length > 0) {
        const sheet = XLSX.utils.json_to_sheet(sheetData as any[]);
        XLSX.utils.book_append_sheet(wb, sheet, `${mp} (${config.name})`);
      }
    });

    // Create "Comparison" sheet - multi-country products with margin comparison
    const multiCountryProducts = filteredAndSortedData.filter(p => p.countries.length >= 2);
    if (multiCountryProducts.length > 0) {
      // Build dynamic columns based on available marketplaces
      const comparisonData = multiCountryProducts.map(product => {
        const row: Record<string, any> = {
          'Product Name': product.name,
          'Category': product.category,
          'Countries': product.countries.length,
          'Best': product.bestCountry || '-',
          'Worst': product.worstCountry || '-',
        };

        // Add margin for each available marketplace
        availableMarketplaces.forEach(mp => {
          const countryData = product.countries.find(c => c.marketplace === mp);
          if (countryData && countryData.hasCostData) {
            row[`${MARKETPLACE_FLAGS[mp]} ${mp} Margin %`] = Number(countryData.profitMargin.toFixed(1));
          } else if (countryData) {
            row[`${MARKETPLACE_FLAGS[mp]} ${mp} Margin %`] = '-';
          } else {
            row[`${MARKETPLACE_FLAGS[mp]} ${mp} Margin %`] = '';
          }
        });

        // Add margin spread (best - worst)
        const marginsWithData = product.countries.filter(c => c.hasCostData && c.revenue > 100);
        if (marginsWithData.length >= 2) {
          const maxMargin = Math.max(...marginsWithData.map(c => c.profitMargin));
          const minMargin = Math.min(...marginsWithData.map(c => c.profitMargin));
          row['Margin Spread %'] = Number((maxMargin - minMargin).toFixed(1));
        } else {
          row['Margin Spread %'] = '-';
        }

        return row;
      });

      const comparisonSheet = XLSX.utils.json_to_sheet(comparisonData);
      XLSX.utils.book_append_sheet(wb, comparisonSheet, 'Comparison');
    }

    // Generate filename
    const parts = ['ProductCountryAnalysis'];
    if (filterCategory !== 'all') parts.push(filterCategory);
    if (filterFulfillment !== 'all') parts.push(filterFulfillment);
    if (startDate) parts.push(startDate.replace(/-/g, ''));
    if (endDate) parts.push(endDate.replace(/-/g, ''));
    const fileName = parts.join('_') + '.xlsx';

    XLSX.writeFile(wb, fileName);
  }, [filteredAndSortedData, availableMarketplaces, filterCategory, filterFulfillment, startDate, endDate]);

  if (productCountryData.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      {/* Header - matches CategoryCardsSection style */}
      <div
        className="flex items-center justify-between cursor-pointer hover:bg-slate-50 -mx-6 -mt-6 px-6 py-4 rounded-t-xl transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-600" />
          Product Country Analysis
          <ChevronRightIcon className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </h2>
        <div className="flex items-center gap-4">
          {/* Filter info - same style as CategoryCardsSection */}
          <div className="text-sm text-slate-600">
            {(startDate || endDate) && (
              <span>
                {startDate && new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {startDate && endDate && ' - '}
                {endDate && new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            {(startDate || endDate) && filterFulfillment !== 'all' && <span className="mx-2">•</span>}
            {filterFulfillment !== 'all' && <span className="font-medium">{filterFulfillment}</span>}
            {!startDate && !endDate && filterFulfillment === 'all' && (
              <span className="text-slate-400">All data</span>
            )}
          </div>
          {/* Summary when collapsed */}
          {!isExpanded && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600">{summaryStats.totalProducts} products</span>
              <span className="text-indigo-600 font-medium">{summaryStats.multiCountryProducts} multi-country</span>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="pt-0 mt-4">
          {/* Filters Row - Compact horizontal layout */}
          <div className="bg-slate-50 rounded-lg p-3 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Category Filter */}
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-slate-600">Category:</label>
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setFilterParent('all');
                    setFilterName('all');
                  }}
                  className="px-2 py-1 border border-slate-300 rounded text-xs bg-white min-w-[120px]"
                >
                  <option value="all">All ({categoryOptions.length})</option>
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Parent Filter */}
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-slate-600">Parent:</label>
                <select
                  value={filterParent}
                  onChange={(e) => {
                    setFilterParent(e.target.value);
                    setFilterName('all');
                  }}
                  className="px-2 py-1 border border-slate-300 rounded text-xs bg-white min-w-[120px]"
                >
                  <option value="all">All ({parentOptions.length})</option>
                  {parentOptions.map(parent => (
                    <option key={parent} value={parent}>{parent}</option>
                  ))}
                </select>
              </div>

              {/* Product Filter */}
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-slate-600">Product:</label>
                <select
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="px-2 py-1 border border-slate-300 rounded text-xs bg-white min-w-[150px]"
                >
                  <option value="all">All ({nameOptions.length})</option>
                  {nameOptions.map(name => (
                    <option key={name} value={name} title={name}>
                      {name.length > 30 ? name.substring(0, 30) + '...' : name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Separator */}
              <div className="h-6 w-px bg-slate-300" />

              {/* Marketplace Multi-Select */}
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-slate-600">Countries:</label>
                <div className="flex flex-wrap gap-1">
                  {availableMarketplaces.map(mp => (
                    <button
                      key={mp}
                      onClick={() => toggleMarketplace(mp)}
                      className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                        selectedMarketplaces.size === 0 || selectedMarketplaces.has(mp)
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                      title={`Toggle ${mp}`}
                    >
                      {MARKETPLACE_FLAGS[mp]} {mp}
                    </button>
                  ))}
                  {selectedMarketplaces.size > 0 && (
                    <button
                      onClick={() => setSelectedMarketplaces(new Set())}
                      className="px-1.5 py-0.5 text-[10px] text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Separator */}
              <div className="h-6 w-px bg-slate-300" />

              {/* Multi-country checkbox */}
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyMultiCountry}
                  onChange={(e) => setShowOnlyMultiCountry(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                Multi-country
              </label>

              {/* Stats & Export - pushed to right */}
              <div className="flex items-center gap-3 ml-auto">
                <span className="text-xs text-slate-500">
                  {filteredAndSortedData.length} products
                </span>
                <button
                  onClick={handleExportExcel}
                  className="px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded flex items-center gap-1 transition-colors"
                  title="Export to Excel"
                >
                  <Download className="w-3 h-3" />
                  Export
                </button>
              </div>
            </div>
          </div>

          {/* Table Container with scroll */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div
              ref={tableContainerRef}
              className="overflow-auto max-h-[700px] cursor-grab"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left py-3 px-3 font-semibold text-slate-700 sticky left-0 top-0 bg-slate-100 min-w-[280px] z-40 border-b border-r border-slate-200 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.15)]">
                      Product
                    </th>
                    {/* All column - totals, first column */}
                    <th className="text-center py-3 px-2 font-semibold text-indigo-700 min-w-[140px] sticky top-0 bg-indigo-50 z-20 border-b border-slate-200">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-base">🌍</span>
                          <span>All</span>
                        </div>
                        <span className="text-[10px] text-indigo-500 font-normal">
                          {formatMoney(Array.from(marketplaceRevenueTotals.values()).reduce((sum, r) => sum + r, 0))}
                        </span>
                      </div>
                    </th>
                    {/* Country columns - filtered by selection */}
                    {displayedMarketplaces.map(mp => (
                      <th
                        key={mp}
                        className="text-center py-3 px-2 font-semibold text-slate-700 min-w-[140px] sticky top-0 bg-slate-100 z-20 border-b border-slate-200"
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-base">{MARKETPLACE_FLAGS[mp]}</span>
                            <span>{mp}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {formatMoney(marketplaceRevenueTotals.get(mp) || 0)}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((product, idx) => (
                    <tr
                      key={product.name}
                      className={`border-b border-slate-100 hover:bg-blue-50/50 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                      }`}
                    >
                      {/* Product Name */}
                      <td
                        className="py-3 px-3 sticky left-0 z-20 border-r border-slate-200 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.15)]"
                        style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}
                      >
                        <div
                          className="font-medium text-blue-700 leading-tight line-clamp-2"
                          title={product.name}
                        >
                          {product.name}
                        </div>
                      </td>

                      {/* All cell - totals in same format as country cells, no best/worst */}
                      <td className="py-3 px-2">
                        <div className="p-2 rounded-lg text-xs bg-indigo-50 border border-indigo-200">
                          {/* Revenue row */}
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-indigo-700">
                              {formatMoney(product.totalRevenue)}
                            </span>
                          </div>

                          {/* Qty & Margin row */}
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-indigo-600">
                              {product.totalQuantity}
                              {product.totalRefundedQuantity > 0 && (
                                <span className="text-red-500">/{product.totalRefundedQuantity}</span>
                              )}
                            </span>
                            <span className={`font-medium px-1.5 py-0.5 rounded ${
                              product.avgProfitMargin >= 20 ? 'bg-green-100 text-green-700' :
                              product.avgProfitMargin >= 10 ? 'bg-amber-100 text-amber-700' :
                              product.avgProfitMargin > 0 ? 'bg-orange-100 text-orange-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {formatPercent(product.avgProfitMargin)}
                            </span>
                          </div>

                          {/* FBA/FBM/Mixed breakdown */}
                          <div className="flex items-center gap-1 mt-1.5 text-[10px] flex-wrap">
                            {product.totalFbaQuantity > 0 && (
                              <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded">
                                FBA {product.totalFbaQuantity}
                                {product.totalFbaRefundedQuantity > 0 && (
                                  <span className="text-red-500">/{product.totalFbaRefundedQuantity}</span>
                                )}
                              </span>
                            )}
                            {product.totalFbmQuantity > 0 && (
                              <span className="px-1 py-0.5 bg-orange-100 text-orange-700 rounded">
                                FBM {product.totalFbmQuantity}
                                {product.totalFbmRefundedQuantity > 0 && (
                                  <span className="text-red-500">/{product.totalFbmRefundedQuantity}</span>
                                )}
                              </span>
                            )}
                            {product.totalMixedQuantity > 0 && (
                              <span className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded">
                                Mixed {product.totalMixedQuantity}
                                {product.totalMixedRefundedQuantity > 0 && (
                                  <span className="text-red-500">/{product.totalMixedRefundedQuantity}</span>
                                )}
                              </span>
                            )}
                          </div>

                          {/* Avg price row */}
                          <div className="text-[10px] text-indigo-500 mt-1 border-t border-indigo-200/50 pt-1">
                            Avg: {formatMoney(product.avgTotalPrice)}
                          </div>
                        </div>
                      </td>

                      {/* Country cells - filtered by selection */}
                      {displayedMarketplaces.map(mp => {
                        const countryData = product.countries.find(c => c.marketplace === mp);
                        const isBest = product.bestCountry === mp;
                        const isWorst = product.worstCountry === mp;

                        if (!countryData) {
                          return (
                            <td key={mp} className="py-3 px-2 text-center">
                              <div className="text-slate-300 text-xs">—</div>
                            </td>
                          );
                        }

                        return (
                          <td key={mp} className="py-3 px-2">
                            <div className={`p-2 rounded-lg text-xs ${
                              isBest ? 'bg-green-50 border border-green-200' :
                              isWorst ? 'bg-red-50 border border-red-200' :
                              'bg-slate-50 border border-slate-100'
                            }`}>
                              {/* Revenue row */}
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-semibold text-slate-700">
                                  {formatMoney(countryData.revenue)}
                                </span>
                                {isBest && (
                                  <Trophy className="w-3.5 h-3.5 text-green-500" />
                                )}
                                {isWorst && (
                                  <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                                )}
                              </div>

                              {/* Qty & Margin row */}
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-500">
                                  {countryData.quantity}
                                  {countryData.refundedQuantity > 0 && (
                                    <span className="text-red-500">/{countryData.refundedQuantity}</span>
                                  )}
                                </span>
                                {countryData.hasCostData ? (
                                  <span className={`font-medium px-1.5 py-0.5 rounded ${
                                    countryData.profitMargin >= 20 ? 'bg-green-100 text-green-700' :
                                    countryData.profitMargin >= 10 ? 'bg-amber-100 text-amber-700' :
                                    countryData.profitMargin > 0 ? 'bg-orange-100 text-orange-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {formatPercent(countryData.profitMargin)}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </div>

                              {/* FBA/FBM/Mixed breakdown */}
                              <div className="flex items-center gap-1 mt-1.5 text-[10px] flex-wrap">
                                {countryData.fbaQuantity > 0 && (
                                  <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded" title={`FBA: ${formatMoney(countryData.fbaRevenue)}`}>
                                    FBA {countryData.fbaQuantity}
                                    {countryData.fbaRefundedQuantity > 0 && (
                                      <span className="text-red-500">/{countryData.fbaRefundedQuantity}</span>
                                    )}
                                  </span>
                                )}
                                {countryData.fbmQuantity > 0 && (
                                  <span className="px-1 py-0.5 bg-orange-100 text-orange-700 rounded" title={`FBM: ${formatMoney(countryData.fbmRevenue)}`}>
                                    FBM {countryData.fbmQuantity}
                                    {countryData.fbmRefundedQuantity > 0 && (
                                      <span className="text-red-500">/{countryData.fbmRefundedQuantity}</span>
                                    )}
                                  </span>
                                )}
                                {countryData.mixedQuantity > 0 && (
                                  <span className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded" title={`Mixed: ${formatMoney(countryData.mixedRevenue)}`}>
                                    Mixed {countryData.mixedQuantity}
                                    {countryData.mixedRefundedQuantity > 0 && (
                                      <span className="text-red-500">/{countryData.mixedRefundedQuantity}</span>
                                    )}
                                  </span>
                                )}
                              </div>

                              {/* Avg price row */}
                              <div className="text-[10px] text-slate-400 mt-1 border-t border-slate-200/50 pt-1">
                                Avg: {formatMoney(countryData.avgPrice)}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
              <div className="text-sm text-slate-500">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedData.length)} of {filteredAndSortedData.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-lg transition-colors ${
                    currentPage === 1
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-lg transition-colors ${
                    currentPage === totalPages
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Info & Legend - compact */}
          <div className="mt-3 pt-3 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
              <div className="flex items-center gap-1">
                <Trophy className="w-3 h-3 text-green-500" />
                <span>Best</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-red-500" />
                <span>Worst</span>
              </div>
              <span>🌍 All</span>
              <span className="text-slate-600">Qty<span className="text-red-500">/Refund</span></span>
              <span className="text-slate-400">Drag to scroll</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCountryAnalysis;
