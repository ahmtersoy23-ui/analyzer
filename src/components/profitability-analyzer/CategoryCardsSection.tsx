import React, { useCallback, useState, useMemo } from 'react';
import { PieChart as PieChartIcon, ChevronUp, ChevronDown, ChevronRight, Download, Globe } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { CategoryProfitAnalysis, SKUProfitAnalysis } from '../../services/profitability/profitabilityAnalytics';

// Country flags mapping
const COUNTRY_FLAGS: Record<string, string> = {
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
  SG: '🇸🇬',
  TR: '🇹🇷',
};

// Marketplace breakdown for a category
interface MarketplaceCategoryBreakdown {
  marketplace: string;
  revenue: number;
  netProfit: number;
  profitMargin: number;
  orders: number;
  quantity: number;
  sellingFees: number;
  fbaFees: number;
  refundLoss: number;
  vat: number;
  advertisingCost: number;
  fbaCost: number;
  fbmCost: number;
  totalProductCost: number;
  shippingCost: number;
  customsDuty: number;
  othersCost: number;
  gstCost: number;
}

interface CategoryCardsSectionProps {
  categoryProfitability: CategoryProfitAnalysis[];
  skuProfitability: SKUProfitAnalysis[];  // For marketplace breakdown
  expandedCategories: Set<string>;
  setExpandedCategories: React.Dispatch<React.SetStateAction<Set<string>>>;
  filterCategory: string;
  setFilterCategory: (category: string) => void;
  filterMarketplace: string;
  filterFulfillment: string;
  startDate: string;
  endDate: string;
  formatMoney: (amount: number) => string;
  formatPercent: (value: number) => string;
}

export const CategoryCardsSection: React.FC<CategoryCardsSectionProps> = React.memo(({
  categoryProfitability,
  skuProfitability,
  expandedCategories,
  setExpandedCategories,
  filterCategory,
  setFilterCategory,
  filterMarketplace,
  filterFulfillment,
  startDate,
  endDate,
  formatMoney,
  formatPercent,
}) => {
  // Section collapsed state - collapsed by default
  const [sectionExpanded, setSectionExpanded] = useState(false);

  // Expanded category blocks state (for All Marketplaces mode - shows country cards)
  const [expandedCategoryBlocks, setExpandedCategoryBlocks] = useState<Set<string>>(new Set());

  // Show marketplace breakdown only when All Marketplaces is selected
  const showMarketplaceBreakdown = filterMarketplace === 'all';

  // Calculate marketplace breakdown for each category
  const categoryMarketplaceBreakdowns = useMemo(() => {
    if (!showMarketplaceBreakdown) return new Map<string, MarketplaceCategoryBreakdown[]>();

    const breakdowns = new Map<string, MarketplaceCategoryBreakdown[]>();

    // Group SKUs by category and marketplace
    const categoryGroups = new Map<string, Map<string, SKUProfitAnalysis[]>>();

    skuProfitability.forEach(sku => {
      const category = sku.category || 'Unknown';
      const marketplace = sku.marketplace || 'Unknown';

      if (!categoryGroups.has(category)) {
        categoryGroups.set(category, new Map());
      }
      const marketplaceMap = categoryGroups.get(category)!;

      if (!marketplaceMap.has(marketplace)) {
        marketplaceMap.set(marketplace, []);
      }
      marketplaceMap.get(marketplace)!.push(sku);
    });

    // Calculate breakdown for each category
    categoryGroups.forEach((marketplaceMap, category) => {
      const marketplaceBreakdowns: MarketplaceCategoryBreakdown[] = [];

      marketplaceMap.forEach((skus, marketplace) => {
        const revenue = skus.reduce((sum, s) => sum + s.totalRevenue, 0);
        const netProfit = skus.reduce((sum, s) => sum + s.netProfit, 0);

        marketplaceBreakdowns.push({
          marketplace,
          revenue,
          netProfit,
          profitMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
          orders: skus.reduce((sum, s) => sum + s.totalOrders, 0),
          quantity: skus.reduce((sum, s) => sum + s.totalQuantity, 0),
          sellingFees: skus.reduce((sum, s) => sum + s.sellingFees, 0),
          fbaFees: skus.reduce((sum, s) => sum + s.fbaFees, 0),
          refundLoss: skus.reduce((sum, s) => sum + s.refundLoss, 0),
          vat: skus.reduce((sum, s) => sum + s.vat, 0),
          advertisingCost: skus.reduce((sum, s) => sum + s.advertisingCost, 0),
          fbaCost: skus.reduce((sum, s) => sum + s.fbaCost, 0),
          fbmCost: skus.reduce((sum, s) => sum + s.fbmCost, 0),
          totalProductCost: skus.reduce((sum, s) => sum + s.totalProductCost, 0),
          shippingCost: skus.reduce((sum, s) => sum + s.shippingCost, 0),
          customsDuty: skus.reduce((sum, s) => sum + s.customsDuty, 0),
          othersCost: skus.reduce((sum, s) => sum + s.othersCost, 0),
          gstCost: skus.reduce((sum, s) => sum + s.gstCost, 0),
        });
      });

      // Sort by revenue descending
      marketplaceBreakdowns.sort((a, b) => b.revenue - a.revenue);
      breakdowns.set(category, marketplaceBreakdowns);
    });

    return breakdowns;
  }, [showMarketplaceBreakdown, skuProfitability]);

  // Calculate "All Categories" marketplace breakdown
  const allCategoriesMarketplaceBreakdown = useMemo(() => {
    if (!showMarketplaceBreakdown) return [];

    const marketplaceMap = new Map<string, SKUProfitAnalysis[]>();

    skuProfitability.forEach(sku => {
      const marketplace = sku.marketplace || 'Unknown';
      if (!marketplaceMap.has(marketplace)) {
        marketplaceMap.set(marketplace, []);
      }
      marketplaceMap.get(marketplace)!.push(sku);
    });

    const breakdowns: MarketplaceCategoryBreakdown[] = [];

    marketplaceMap.forEach((skus, marketplace) => {
      const revenue = skus.reduce((sum, s) => sum + s.totalRevenue, 0);
      const netProfit = skus.reduce((sum, s) => sum + s.netProfit, 0);

      breakdowns.push({
        marketplace,
        revenue,
        netProfit,
        profitMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
        orders: skus.reduce((sum, s) => sum + s.totalOrders, 0),
        quantity: skus.reduce((sum, s) => sum + s.totalQuantity, 0),
        sellingFees: skus.reduce((sum, s) => sum + s.sellingFees, 0),
        fbaFees: skus.reduce((sum, s) => sum + s.fbaFees, 0),
        refundLoss: skus.reduce((sum, s) => sum + s.refundLoss, 0),
        vat: skus.reduce((sum, s) => sum + s.vat, 0),
        advertisingCost: skus.reduce((sum, s) => sum + s.advertisingCost, 0),
        fbaCost: skus.reduce((sum, s) => sum + s.fbaCost, 0),
        fbmCost: skus.reduce((sum, s) => sum + s.fbmCost, 0),
        totalProductCost: skus.reduce((sum, s) => sum + s.totalProductCost, 0),
        shippingCost: skus.reduce((sum, s) => sum + s.shippingCost, 0),
        customsDuty: skus.reduce((sum, s) => sum + s.customsDuty, 0),
        othersCost: skus.reduce((sum, s) => sum + s.othersCost, 0),
        gstCost: skus.reduce((sum, s) => sum + s.gstCost, 0),
      });
    });

    return breakdowns.sort((a, b) => b.revenue - a.revenue);
  }, [showMarketplaceBreakdown, skuProfitability]);

  // Toggle category block expansion
  const toggleCategoryBlock = useCallback((categoryKey: string) => {
    setExpandedCategoryBlocks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryKey)) {
        newSet.delete(categoryKey);
      } else {
        newSet.add(categoryKey);
      }
      return newSet;
    });
  }, []);
  // Generate filename based on filters - must be before early return
  const generateFileName = useCallback(() => {
    const parts = ['Faz3', 'CategoryProfitability'];
    if (filterMarketplace !== 'all') parts.push(filterMarketplace);
    if (filterFulfillment !== 'all') parts.push(filterFulfillment);
    if (startDate) parts.push(startDate.replace(/-/g, ''));
    if (endDate) parts.push(endDate.replace(/-/g, ''));
    return parts.join('_') + '.xlsx';
  }, [filterMarketplace, filterFulfillment, startDate, endDate]);

  // Export to Excel - must be before early return
  const handleExportExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Categories
    const categoriesData = categoryProfitability.map(cat => ({
      'Category': cat.category,
      'Revenue': cat.totalRevenue,
      'Net Profit': cat.netProfit,
      'Margin %': cat.profitMargin,
      'Orders': cat.totalOrders,
      'Parents': cat.totalParents,
      'Products': cat.totalProducts,
      'Selling Fees': cat.sellingFees,
      'FBA Fees': cat.fbaFees,
      'Refund Loss': cat.refundLoss,
      'VAT': cat.vat,
      'Advertising': cat.advertisingCost,
      'FBA Cost': cat.fbaCost,
      'FBM Cost': cat.fbmCost,
      'Product Cost': cat.totalProductCost,
      'Shipping': cat.shippingCost,
      'Customs': cat.customsDuty,
      'DDP Fee': cat.ddpFee,
      'Warehouse': cat.warehouseCost,
      'GST': cat.gstCost,
    }));
    const categoriesSheet = XLSX.utils.json_to_sheet(categoriesData);
    XLSX.utils.book_append_sheet(wb, categoriesSheet, 'Categories');

    // Sheet 2: Countries - aggregate by marketplace with expense breakdown
    const marketplaceMap = new Map<string, {
      revenue: number;
      netProfit: number;
      orders: number;
      quantity: number;
      // Amazon expenses
      sellingFees: number;
      fbaFees: number;
      refundLoss: number;
      vat: number;
      advertisingCost: number;
      fbaCost: number;
      fbmCost: number;
      // Non-Amazon expenses
      totalProductCost: number;
      shippingCost: number;
      customsDuty: number;
      ddpFee: number;
      warehouseCost: number;
      gstCost: number;
      othersCost: number;
      // For refund recovered calculation
      refundedQuantity: number;
      avgSalePrice: number;
    }>();

    skuProfitability.forEach(sku => {
      const mp = sku.marketplace || 'Unknown';
      const existing = marketplaceMap.get(mp);
      if (existing) {
        existing.revenue += sku.totalRevenue;
        existing.netProfit += sku.netProfit;
        existing.orders += sku.totalOrders;
        existing.quantity += sku.totalQuantity;
        existing.sellingFees += sku.sellingFees;
        existing.fbaFees += sku.fbaFees;
        existing.refundLoss += sku.refundLoss;
        existing.vat += sku.vat;
        existing.advertisingCost += sku.advertisingCost;
        existing.fbaCost += sku.fbaCost;
        existing.fbmCost += sku.fbmCost;
        existing.totalProductCost += sku.totalProductCost;
        existing.shippingCost += sku.shippingCost;
        existing.customsDuty += sku.customsDuty;
        existing.ddpFee += sku.ddpFee;
        existing.warehouseCost += sku.warehouseCost;
        existing.gstCost += sku.gstCost;
        existing.othersCost += sku.othersCost;
        existing.refundedQuantity += sku.refundedQuantity;
      } else {
        marketplaceMap.set(mp, {
          revenue: sku.totalRevenue,
          netProfit: sku.netProfit,
          orders: sku.totalOrders,
          quantity: sku.totalQuantity,
          sellingFees: sku.sellingFees,
          fbaFees: sku.fbaFees,
          refundLoss: sku.refundLoss,
          vat: sku.vat,
          advertisingCost: sku.advertisingCost,
          fbaCost: sku.fbaCost,
          fbmCost: sku.fbmCost,
          totalProductCost: sku.totalProductCost,
          shippingCost: sku.shippingCost,
          customsDuty: sku.customsDuty,
          ddpFee: sku.ddpFee,
          warehouseCost: sku.warehouseCost,
          gstCost: sku.gstCost,
          othersCost: sku.othersCost,
          refundedQuantity: sku.refundedQuantity,
          avgSalePrice: sku.avgSalePrice,
        });
      }
    });

    // Convert to array and sort by revenue
    const countriesData = Array.from(marketplaceMap.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([mp, data]) => {
        const amazonExpenses = data.sellingFees + data.fbaFees + data.refundLoss + data.vat + data.advertisingCost + data.fbaCost + data.fbmCost;
        const nonAmazonExpenses = data.totalProductCost + data.shippingCost + data.customsDuty + data.ddpFee + data.warehouseCost + data.gstCost;
        const margin = data.revenue > 0 ? (data.netProfit / data.revenue) * 100 : 0;

        // Calculate refund recovered based on loss rate
        // US: 50% loss rate → recovered = loss (equal amounts)
        // EU/Others: 70% loss rate → recovered = loss * (30/70) ≈ 0.43x
        const isUS = mp === 'US';
        const refundRecovered = isUS ? data.refundLoss : data.refundLoss * (30 / 70);

        // Calculate percentages (as % of revenue)
        const amazonPct = data.revenue > 0 ? (amazonExpenses / data.revenue) * 100 : 0;
        const sellingFeesPct = data.revenue > 0 ? (data.sellingFees / data.revenue) * 100 : 0;
        const fbaFeesPct = data.revenue > 0 ? (data.fbaFees / data.revenue) * 100 : 0;
        const refundLossPct = data.revenue > 0 ? (data.refundLoss / data.revenue) * 100 : 0;
        const refundRecoveredPct = data.revenue > 0 ? (refundRecovered / data.revenue) * 100 : 0;
        const vatPct = data.revenue > 0 ? (data.vat / data.revenue) * 100 : 0;
        const advertisingPct = data.revenue > 0 ? (data.advertisingCost / data.revenue) * 100 : 0;
        const fbaCostPct = data.revenue > 0 ? (data.fbaCost / data.revenue) * 100 : 0;
        const fbmCostPct = data.revenue > 0 ? (data.fbmCost / data.revenue) * 100 : 0;

        const nonAmazonPct = data.revenue > 0 ? (nonAmazonExpenses / data.revenue) * 100 : 0;
        const productCostPct = data.revenue > 0 ? (data.totalProductCost / data.revenue) * 100 : 0;
        const shippingPct = data.revenue > 0 ? (data.shippingCost / data.revenue) * 100 : 0;
        const customsDutyPct = data.revenue > 0 ? (data.customsDuty / data.revenue) * 100 : 0;
        const ddpFeePct = data.revenue > 0 ? (data.ddpFee / data.revenue) * 100 : 0;
        const warehousePct = data.revenue > 0 ? (data.warehouseCost / data.revenue) * 100 : 0;
        const gstPct = data.revenue > 0 ? (data.gstCost / data.revenue) * 100 : 0;

        return {
          'Country': `${COUNTRY_FLAGS[mp] || '🌐'} ${mp}`,
          'Revenue': Number(data.revenue.toFixed(2)),
          'Net Profit': Number(data.netProfit.toFixed(2)),
          'Margin %': Number(margin.toFixed(1)),
          'Orders': data.orders,
          'Quantity': data.quantity,
          // Amazon Expenses Total (percentage)
          'Amazon %': Number(amazonPct.toFixed(1)),
          '  Selling Fees %': Number(sellingFeesPct.toFixed(1)),
          '  FBA Fees %': Number(fbaFeesPct.toFixed(1)),
          '  Refund Loss %': Number(refundLossPct.toFixed(1)),
          '  Refund Recovered %': Number(refundRecoveredPct.toFixed(1)),
          '  VAT %': Number(vatPct.toFixed(1)),
          '  Advertising %': Number(advertisingPct.toFixed(1)),
          '  FBA Cost %': Number(fbaCostPct.toFixed(1)),
          '  FBM Cost %': Number(fbmCostPct.toFixed(1)),
          // Non-Amazon Expenses Total (percentage)
          'Non-Amazon %': Number(nonAmazonPct.toFixed(1)),
          '  Product Cost %': Number(productCostPct.toFixed(1)),
          '  Shipping %': Number(shippingPct.toFixed(1)),
          '  Customs Duty %': Number(customsDutyPct.toFixed(1)),
          '  DDP Fee %': Number(ddpFeePct.toFixed(1)),
          '  Warehouse %': Number(warehousePct.toFixed(1)),
          '  GST %': Number(gstPct.toFixed(1)),
        };
      });

    if (countriesData.length > 0) {
      // Calculate "All" totals
      const allTotals = Array.from(marketplaceMap.values()).reduce((acc, data) => ({
        revenue: acc.revenue + data.revenue,
        netProfit: acc.netProfit + data.netProfit,
        orders: acc.orders + data.orders,
        quantity: acc.quantity + data.quantity,
        sellingFees: acc.sellingFees + data.sellingFees,
        fbaFees: acc.fbaFees + data.fbaFees,
        refundLoss: acc.refundLoss + data.refundLoss,
        vat: acc.vat + data.vat,
        advertisingCost: acc.advertisingCost + data.advertisingCost,
        fbaCost: acc.fbaCost + data.fbaCost,
        fbmCost: acc.fbmCost + data.fbmCost,
        totalProductCost: acc.totalProductCost + data.totalProductCost,
        shippingCost: acc.shippingCost + data.shippingCost,
        customsDuty: acc.customsDuty + data.customsDuty,
        ddpFee: acc.ddpFee + data.ddpFee,
        warehouseCost: acc.warehouseCost + data.warehouseCost,
        gstCost: acc.gstCost + data.gstCost,
        othersCost: acc.othersCost + data.othersCost,
      }), {
        revenue: 0, netProfit: 0, orders: 0, quantity: 0,
        sellingFees: 0, fbaFees: 0, refundLoss: 0, vat: 0,
        advertisingCost: 0, fbaCost: 0, fbmCost: 0,
        totalProductCost: 0, shippingCost: 0, customsDuty: 0,
        ddpFee: 0, warehouseCost: 0, gstCost: 0, othersCost: 0,
      });

      // Calculate All percentages
      const allAmazonExpenses = allTotals.sellingFees + allTotals.fbaFees + allTotals.refundLoss + allTotals.vat + allTotals.advertisingCost + allTotals.fbaCost + allTotals.fbmCost;
      const allNonAmazonExpenses = allTotals.totalProductCost + allTotals.shippingCost + allTotals.customsDuty + allTotals.ddpFee + allTotals.warehouseCost + allTotals.gstCost;
      const allMargin = allTotals.revenue > 0 ? (allTotals.netProfit / allTotals.revenue) * 100 : 0;

      // Weighted refund recovered (approximate based on US vs non-US split)
      const usData = marketplaceMap.get('US');
      const usRefundLoss = usData?.refundLoss || 0;
      const nonUsRefundLoss = allTotals.refundLoss - usRefundLoss;
      const allRefundRecovered = usRefundLoss + (nonUsRefundLoss * 30 / 70);

      const allRow = {
        'Country': '🌍 All',
        'Revenue': Number(allTotals.revenue.toFixed(2)),
        'Net Profit': Number(allTotals.netProfit.toFixed(2)),
        'Margin %': Number(allMargin.toFixed(1)),
        'Orders': allTotals.orders,
        'Quantity': allTotals.quantity,
        'Amazon %': Number((allTotals.revenue > 0 ? (allAmazonExpenses / allTotals.revenue) * 100 : 0).toFixed(1)),
        '  Selling Fees %': Number((allTotals.revenue > 0 ? (allTotals.sellingFees / allTotals.revenue) * 100 : 0).toFixed(1)),
        '  FBA Fees %': Number((allTotals.revenue > 0 ? (allTotals.fbaFees / allTotals.revenue) * 100 : 0).toFixed(1)),
        '  Refund Loss %': Number((allTotals.revenue > 0 ? (allTotals.refundLoss / allTotals.revenue) * 100 : 0).toFixed(1)),
        '  Refund Recovered %': Number((allTotals.revenue > 0 ? (allRefundRecovered / allTotals.revenue) * 100 : 0).toFixed(1)),
        '  VAT %': Number((allTotals.revenue > 0 ? (allTotals.vat / allTotals.revenue) * 100 : 0).toFixed(1)),
        '  Advertising %': Number((allTotals.revenue > 0 ? (allTotals.advertisingCost / allTotals.revenue) * 100 : 0).toFixed(1)),
        '  FBA Cost %': Number((allTotals.revenue > 0 ? (allTotals.fbaCost / allTotals.revenue) * 100 : 0).toFixed(1)),
        '  FBM Cost %': Number((allTotals.revenue > 0 ? (allTotals.fbmCost / allTotals.revenue) * 100 : 0).toFixed(1)),
        'Non-Amazon %': Number((allTotals.revenue > 0 ? (allNonAmazonExpenses / allTotals.revenue) * 100 : 0).toFixed(1)),
        '  Product Cost %': Number((allTotals.revenue > 0 ? (allTotals.totalProductCost / allTotals.revenue) * 100 : 0).toFixed(1)),
        '  Shipping %': Number((allTotals.revenue > 0 ? (allTotals.shippingCost / allTotals.revenue) * 100 : 0).toFixed(1)),
        '  Customs Duty %': Number((allTotals.revenue > 0 ? (allTotals.customsDuty / allTotals.revenue) * 100 : 0).toFixed(1)),
        '  DDP Fee %': Number((allTotals.revenue > 0 ? (allTotals.ddpFee / allTotals.revenue) * 100 : 0).toFixed(1)),
        '  Warehouse %': Number((allTotals.revenue > 0 ? (allTotals.warehouseCost / allTotals.revenue) * 100 : 0).toFixed(1)),
        '  GST %': Number((allTotals.revenue > 0 ? (allTotals.gstCost / allTotals.revenue) * 100 : 0).toFixed(1)),
      };

      // Add All row at the beginning
      const countriesSheet = XLSX.utils.json_to_sheet([allRow, ...countriesData]);
      XLSX.utils.book_append_sheet(wb, countriesSheet, 'Countries');
    }

    XLSX.writeFile(wb, generateFileName());
  }, [categoryProfitability, skuProfitability, generateFileName]);

  if (categoryProfitability.length === 0) return null;

  // Calculate totals for "All Categories" card
  const totalRevenue = categoryProfitability.reduce((sum, c) => sum + c.totalRevenue, 0);
  const totalProfit = categoryProfitability.reduce((sum, c) => sum + c.netProfit, 0);
  const totalProducts = categoryProfitability.reduce((sum, c) => sum + c.totalProducts, 0);
  const totalOrders = categoryProfitability.reduce((sum, c) => sum + c.totalOrders, 0);
  const totalParents = categoryProfitability.reduce((sum, c) => sum + c.totalParents, 0);
  const totalQuantity = categoryProfitability.reduce((sum, c) => sum + c.totalQuantity, 0);
  const totalFbaQuantity = categoryProfitability.reduce((sum, c) => sum + c.fbaQuantity, 0);
  const totalFbmQuantity = categoryProfitability.reduce((sum, c) => sum + c.fbmQuantity, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Calculate overall fulfillment type
  const overallFulfillment = totalFbmQuantity === 0 ? 'FBA' : totalFbaQuantity === 0 ? 'FBM' : 'Mixed';

  // Amazon Expenses
  const totalSellingFees = categoryProfitability.reduce((sum, c) => sum + c.sellingFees, 0);
  const totalFbaFees = categoryProfitability.reduce((sum, c) => sum + c.fbaFees, 0);
  const totalRefundLoss = categoryProfitability.reduce((sum, c) => sum + c.refundLoss, 0);
  const totalVat = categoryProfitability.reduce((sum, c) => sum + c.vat, 0);
  const totalAds = categoryProfitability.reduce((sum, c) => sum + c.advertisingCost, 0);
  const totalFbaCost = categoryProfitability.reduce((sum, c) => sum + c.fbaCost, 0);
  const totalFbmCost = categoryProfitability.reduce((sum, c) => sum + c.fbmCost, 0);
  const amazonExpenses = totalSellingFees + totalFbaFees + totalRefundLoss + totalVat + totalAds + totalFbaCost + totalFbmCost;

  // Non-Amazon Expenses
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

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      {/* Clickable Header - toggles section expansion */}
      <div
        className="flex items-center justify-between cursor-pointer hover:bg-slate-50 -mx-6 -mt-6 px-6 py-4 rounded-t-xl transition-colors"
        onClick={() => setSectionExpanded(!sectionExpanded)}
      >
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <PieChartIcon className="w-5 h-5 text-purple-600" />
          Category Profitability
          <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${sectionExpanded ? 'rotate-90' : ''}`} />
        </h2>
        <div className="flex items-center gap-4">
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
          {/* Summary when collapsed */}
          {!sectionExpanded && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-purple-600 font-semibold">{formatMoney(totalRevenue)}</span>
              <span className={`font-semibold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(totalProfit)}
              </span>
              <span className={`font-medium ${avgMargin >= 10 ? 'text-green-600' : avgMargin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                {formatPercent(avgMargin)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Content */}
      {sectionExpanded && (
        <>
          {/* Export Button Row */}
          <div className="flex justify-end mb-4 mt-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExportExcel();
              }}
              className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-1.5 transition-colors"
              title="Export to Excel"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
        {/* ALL Categories Card - Expandable Block in All Marketplaces mode */}
        <div className="flex flex-col">
          {/* Main All Categories Card */}
          <div
            className={`border-2 border-indigo-400 rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-white flex flex-col shadow-md ${expandedCategoryBlocks.has('__ALL__') ? 'rounded-b-none' : ''}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-indigo-800 text-base">All Categories</h3>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    overallFulfillment === 'FBA' ? 'bg-blue-100 text-blue-700' :
                    overallFulfillment === 'FBM' ? 'bg-green-100 text-green-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {overallFulfillment}
                  </span>
                </div>
                <div className="text-xs text-indigo-600 mt-1">
                  {categoryProfitability.length} categories · {totalParents} parents · {totalProducts} products
                </div>
                {/* Mixed breakdown - show FBA/FBM percentages */}
                {overallFulfillment === 'Mixed' && totalQuantity > 0 && (
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {formatPercent((totalFbaQuantity / totalQuantity) * 100)} FBA · {formatPercent((totalFbmQuantity / totalQuantity) * 100)} FBM
                  </div>
                )}
              </div>
              <button
                onClick={() => toggleExpanded('__ALL__')}
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

            <div className="mt-3 pt-3 border-t border-indigo-200 space-y-1.5">
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
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-blue-600">Share</span>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-1.5 bg-indigo-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full w-full" />
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 w-10 text-right">100.0%</span>
                </div>
              </div>
              {/* Marketplace Breakdown Toggle Button - only in All Marketplaces mode */}
              {showMarketplaceBreakdown && (
                <button
                  onClick={() => toggleCategoryBlock('__ALL__')}
                  className={`w-full mt-2 px-3 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                    expandedCategoryBlocks.has('__ALL__')
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  {expandedCategoryBlocks.has('__ALL__') ? 'Hide Countries' : 'Show Countries'}
                </button>
              )}
            </div>
          </div>

          {/* Expanded Marketplace Cards for All Categories */}
          {showMarketplaceBreakdown && expandedCategoryBlocks.has('__ALL__') && (
            <div className="border-2 border-t-0 border-indigo-400 rounded-b-xl bg-indigo-50/50 p-3">
              <div className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                Marketplace Breakdown
              </div>
              <div className="grid grid-cols-2 gap-2">
                {allCategoriesMarketplaceBreakdown.map(mp => {
                  const mpAmazonExpenses = mp.sellingFees + mp.fbaFees + mp.refundLoss + mp.vat + mp.advertisingCost + mp.fbaCost + mp.fbmCost;
                  const mpNonAmazonExpenses = mp.totalProductCost + mp.shippingCost + mp.customsDuty + mp.gstCost;
                  const mpAmazonPct = mp.revenue > 0 ? (mpAmazonExpenses / mp.revenue) * 100 : 0;
                  const mpNonAmazonPct = mp.revenue > 0 ? (mpNonAmazonExpenses / mp.revenue) * 100 : 0;
                  const mpShare = totalRevenue > 0 ? (mp.revenue / totalRevenue) * 100 : 0;

                  return (
                    <div
                      key={mp.marketplace}
                      className="bg-white rounded-lg p-2.5 border border-indigo-200 hover:border-indigo-400 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-base">{COUNTRY_FLAGS[mp.marketplace] || '🌍'}</span>
                        <span className="font-semibold text-slate-800 text-xs">{mp.marketplace}</span>
                      </div>
                      <div className="text-sm font-bold text-indigo-600 mb-1">{formatMoney(mp.revenue)}</div>
                      <div className="text-[10px] text-slate-500 mb-1.5">{mp.orders} orders</div>
                      <div className="space-y-1 text-[9px]">
                        <div className="flex justify-between">
                          <span className="text-red-500">Amazon</span>
                          <span className="text-red-500 font-medium">{formatPercent(mpAmazonPct)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Non-Amazon</span>
                          <span className="text-slate-500 font-medium">{formatPercent(mpNonAmazonPct)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-100">
                          <span className={mp.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>Profit</span>
                          <span className={`font-medium ${mp.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatMoney(mp.netProfit)} ({formatPercent(mp.profitMargin)})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-500">Share</span>
                          <span className="text-blue-500 font-medium">{formatPercent(mpShare)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Individual Category Cards */}
        {categoryProfitability.slice(0, 11).map(cat => {
          const allCatRevenue = categoryProfitability.reduce((sum, c) => sum + c.totalRevenue, 0);
          const categoryPercentage = allCatRevenue > 0 ? (cat.totalRevenue / allCatRevenue) * 100 : 0;

          // Amazon Expenses (including VAT)
          const catAmazonExpenses = cat.sellingFees + cat.fbaFees + cat.refundLoss + cat.vat + cat.advertisingCost + cat.fbaCost + cat.fbmCost;
          const catAmazonPct = cat.totalRevenue > 0 ? (catAmazonExpenses / cat.totalRevenue) * 100 : 0;

          // Non-Amazon Expenses (including GST)
          const catNonAmazonExpenses = cat.totalProductCost + cat.shippingCost + cat.customsDuty + cat.ddpFee + cat.warehouseCost + cat.gstCost;
          const catNonAmazonPct = cat.totalRevenue > 0 ? (catNonAmazonExpenses / cat.totalRevenue) * 100 : 0;

          const isExpanded = expandedCategories.has(cat.category);
          const isBlockExpanded = expandedCategoryBlocks.has(cat.category);
          const categoryMarketplaces = categoryMarketplaceBreakdowns.get(cat.category) || [];

          return (
            <div key={cat.category} className="flex flex-col">
              <div
                className={`border-2 rounded-xl p-4 cursor-pointer transition-all flex flex-col ${
                  filterCategory === cat.category
                    ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-white shadow-lg'
                    : 'border-slate-200 hover:border-purple-400 hover:shadow-md bg-gradient-to-br from-white to-slate-50'
                } ${isBlockExpanded ? 'rounded-b-none' : ''}`}
                onClick={() => setFilterCategory(filterCategory === cat.category ? 'all' : cat.category)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-base">{cat.category}</h3>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        cat.fulfillment === 'FBA' ? 'bg-blue-100 text-blue-700' :
                        cat.fulfillment === 'FBM' ? 'bg-green-100 text-green-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {cat.fulfillment}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {cat.totalParents} parents · {cat.totalProducts} products
                    </div>
                    {/* Mixed breakdown - show FBA/FBM percentages when category is Mixed */}
                    {cat.fulfillment === 'Mixed' && cat.totalQuantity > 0 && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {formatPercent((cat.fbaQuantity / cat.totalQuantity) * 100)} FBA · {formatPercent((cat.fbmQuantity / cat.totalQuantity) * 100)} FBM
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(cat.category);
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
                    <span className="font-bold text-red-600">{formatPercent(catAmazonPct)} <span className="text-slate-400 font-normal">({formatMoney(catAmazonExpenses)})</span></span>
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
                    <span className="font-bold text-slate-700">{formatPercent(catNonAmazonPct)} <span className="text-slate-400 font-normal">({formatMoney(catNonAmazonExpenses)})</span></span>
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
                      {cat.customsDuty > 0 && (
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-amber-500">Customs</span>
                          <span className="text-amber-500">{formatPercent(cat.totalRevenue > 0 ? (cat.customsDuty / cat.totalRevenue) * 100 : 0)} ({formatMoney(cat.customsDuty)})</span>
                        </div>
                      )}
                      {cat.ddpFee > 0 && (
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-amber-500">DDP</span>
                          <span className="text-amber-500">{formatPercent(cat.totalRevenue > 0 ? (cat.ddpFee / cat.totalRevenue) * 100 : 0)} ({formatMoney(cat.ddpFee)})</span>
                        </div>
                      )}
                      {cat.warehouseCost > 0 && (
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-amber-500">Warehouse</span>
                          <span className="text-amber-500">{formatPercent(cat.totalRevenue > 0 ? (cat.warehouseCost / cat.totalRevenue) * 100 : 0)} ({formatMoney(cat.warehouseCost)})</span>
                        </div>
                      )}
                      {cat.gstCost > 0 && (
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-orange-500">GST</span>
                          <span className="text-orange-500">{formatPercent(cat.gstCostPercent)} ({formatMoney(cat.gstCost)})</span>
                        </div>
                      )}
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
                  {/* Marketplace Breakdown Toggle Button - only in All Marketplaces mode */}
                  {showMarketplaceBreakdown && categoryMarketplaces.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategoryBlock(cat.category);
                      }}
                      className={`w-full mt-2 px-3 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                        isBlockExpanded
                          ? 'bg-purple-600 text-white'
                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {isBlockExpanded ? 'Hide Countries' : 'Show Countries'}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Marketplace Cards for this Category */}
              {showMarketplaceBreakdown && isBlockExpanded && categoryMarketplaces.length > 0 && (
                <div className={`border-2 border-t-0 rounded-b-xl p-3 ${
                  filterCategory === cat.category ? 'border-purple-500 bg-purple-50/50' : 'border-slate-200 bg-slate-50/50'
                }`}>
                  <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-purple-500" />
                    Marketplace Breakdown
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {categoryMarketplaces.map(mp => {
                      const mpAmazonExpenses = mp.sellingFees + mp.fbaFees + mp.refundLoss + mp.vat + mp.advertisingCost + mp.fbaCost + mp.fbmCost;
                      const mpNonAmazonExpenses = mp.totalProductCost + mp.shippingCost + mp.customsDuty + mp.gstCost;
                      const mpAmazonPct = mp.revenue > 0 ? (mpAmazonExpenses / mp.revenue) * 100 : 0;
                      const mpNonAmazonPct = mp.revenue > 0 ? (mpNonAmazonExpenses / mp.revenue) * 100 : 0;
                      const mpShare = cat.totalRevenue > 0 ? (mp.revenue / cat.totalRevenue) * 100 : 0;

                      return (
                        <div
                          key={mp.marketplace}
                          className="bg-white rounded-lg p-2.5 border border-purple-200 hover:border-purple-400 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-base">{COUNTRY_FLAGS[mp.marketplace] || '🌍'}</span>
                            <span className="font-semibold text-slate-800 text-xs">{mp.marketplace}</span>
                          </div>
                          <div className="text-sm font-bold text-purple-600 mb-1">{formatMoney(mp.revenue)}</div>
                          <div className="text-[10px] text-slate-500 mb-1.5">{mp.orders} orders</div>
                          <div className="space-y-1 text-[9px]">
                            <div className="flex justify-between">
                              <span className="text-red-500">Amazon</span>
                              <span className="text-red-500 font-medium">{formatPercent(mpAmazonPct)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Non-Amazon</span>
                              <span className="text-slate-500 font-medium">{formatPercent(mpNonAmazonPct)}</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-slate-100">
                              <span className={mp.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>Profit</span>
                              <span className={`font-medium ${mp.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatMoney(mp.netProfit)} ({formatPercent(mp.profitMargin)})
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-blue-500">Share</span>
                              <span className="text-blue-500 font-medium">{formatPercent(mpShare)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>
      </>
      )}
    </div>
  );
});

CategoryCardsSection.displayName = 'CategoryCardsSection';
