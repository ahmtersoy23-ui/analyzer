/**
 * Pricing Calculator Export Service
 * Generates export data from Profit Analyzer for use in Pricing Calculator
 */

import type {
  CategoryProfitAnalysis,
  SKUProfitAnalysis,
  GlobalCostPercentages,
  PricingCalculatorExport,
  PricingCategoryExpense,
} from '../../types/profitabilityAnalysis';
import type { MarketplaceCode } from '../../types/transaction';
import * as XLSX from 'xlsx';

const EXPORT_VERSION = 1;

/**
 * Helper to build a single category expense entry
 */
const buildCategoryExpense = (
  cat: CategoryProfitAnalysis,
  categorySkus: SKUProfitAnalysis[],
  marketplace: string,
  dateRange: { start: Date; end: Date },
  fulfillmentType: 'FBA' | 'FBM',
  revenue: number,
  quantity: number
): PricingCategoryExpense => {
  // Filter SKUs by fulfillment type for accurate cost calculation
  const filteredSkus = categorySkus.filter(s => s.fulfillment === fulfillmentType);

  const totalCustomsDuty = filteredSkus.reduce((sum, s) => sum + (s.customsDuty || 0), 0);
  const totalDdpFee = filteredSkus.reduce((sum, s) => sum + (s.ddpFee || 0), 0);
  const totalWarehouseCost = filteredSkus.reduce((sum, s) => sum + (s.warehouseCost || 0), 0);
  const totalGstCost = filteredSkus.reduce((sum, s) => sum + (s.gstCost || 0), 0);

  const customsDutyPercent = revenue > 0 ? (totalCustomsDuty / revenue) * 100 : 0;
  const ddpFeePercent = revenue > 0 ? (totalDdpFee / revenue) * 100 : 0;
  const warehouseCostPercent = revenue > 0 ? (totalWarehouseCost / revenue) * 100 : 0;
  const gstCostPercent = revenue > 0 ? (totalGstCost / revenue) * 100 : 0;

  // Calculate avg product cost from SKUs that have cost data
  const skusWithCost = filteredSkus.filter(s => s.hasCostData && s.productCost > 0);
  const avgProductCost = skusWithCost.length > 0
    ? skusWithCost.reduce((sum, s) => sum + s.productCost, 0) / skusWithCost.length
    : 0;

  // Calculate profit margin from filtered SKUs (not category-level which is combined FBA+FBM)
  const totalFilteredRevenue = filteredSkus.reduce((sum, s) => sum + s.totalRevenue, 0);
  const totalFilteredProfit = filteredSkus.reduce((sum, s) => sum + s.netProfit, 0);
  const avgProfitMargin = totalFilteredRevenue > 0
    ? (totalFilteredProfit / totalFilteredRevenue) * 100
    : cat.profitMargin; // Fallback to category margin if no SKU data

  // For FBM, shipping cost is more relevant; for FBA, FBA fees are more relevant
  // Use fulfillment-specific percentages
  const fbaFeePercent = fulfillmentType === 'FBA' ? cat.fbaFeePercent : 0;
  const shippingCostPercent = fulfillmentType === 'FBM' ? cat.shippingCostPercent : cat.shippingCostPercent;

  return {
    category: cat.category,
    marketplace,
    fulfillmentType,

    // Sample info
    sampleSize: filteredSkus.length > 0 ? filteredSkus.reduce((sum, s) => sum + s.totalOrders, 0) : cat.totalOrders,
    totalRevenue: revenue,
    totalQuantity: quantity,
    periodStart: dateRange.start.toISOString().split('T')[0],
    periodEnd: dateRange.end.toISOString().split('T')[0],

    // Amazon Fee Percentages
    sellingFeePercent: cat.sellingFeePercent,
    fbaFeePercent,
    refundLossPercent: cat.refundLossPercent,
    vatPercent: cat.vatPercent,

    // Cost Percentages
    productCostPercent: cat.productCostPercent,
    shippingCostPercent,
    customsDutyPercent,
    ddpFeePercent,
    warehouseCostPercent,
    gstCostPercent,

    // Global Cost Percentages
    advertisingPercent: cat.advertisingPercent,
    fbaCostPercent: fulfillmentType === 'FBA' ? cat.fbaCostPercent : 0,
    fbmCostPercent: fulfillmentType === 'FBM' ? cat.fbmCostPercent : 0,

    // Profitability
    avgProfitMargin,
    avgROI: cat.roi,
    avgSalePrice: cat.avgSalePrice,
    avgProductCost,

    // Fulfillment breakdown (100% for single type)
    fbaPercent: fulfillmentType === 'FBA' ? 100 : 0,
    fbmPercent: fulfillmentType === 'FBM' ? 100 : 0,
  };
};

/**
 * Generate pricing export data from category profitability analysis
 * For Mixed categories, creates separate FBA and FBM entries
 */
export const generatePricingExport = (
  categoryProfitability: CategoryProfitAnalysis[],
  skuProfitability: SKUProfitAnalysis[],
  globalCosts: GlobalCostPercentages,
  marketplace: string,
  dateRange: { start: Date; end: Date }
): PricingCalculatorExport => {
  // Build category expense data - separate FBA and FBM for Mixed categories
  const categories: PricingCategoryExpense[] = [];

  for (const cat of categoryProfitability) {
    const categorySkus = skuProfitability.filter(s => s.category === cat.category);

    if (cat.fulfillment === 'FBA') {
      // Pure FBA category
      categories.push(buildCategoryExpense(
        cat, categorySkus, marketplace, dateRange,
        'FBA', cat.totalRevenue, cat.totalQuantity
      ));
    } else if (cat.fulfillment === 'FBM') {
      // Pure FBM category
      categories.push(buildCategoryExpense(
        cat, categorySkus, marketplace, dateRange,
        'FBM', cat.totalRevenue, cat.totalQuantity
      ));
    } else {
      // Mixed category - create separate FBA and FBM entries
      if (cat.fbaQuantity > 0 && cat.fbaRevenue > 0) {
        categories.push(buildCategoryExpense(
          cat, categorySkus, marketplace, dateRange,
          'FBA', cat.fbaRevenue, cat.fbaQuantity
        ));
      }
      if (cat.fbmQuantity > 0 && cat.fbmRevenue > 0) {
        categories.push(buildCategoryExpense(
          cat, categorySkus, marketplace, dateRange,
          'FBM', cat.fbmRevenue, cat.fbmQuantity
        ));
      }
    }
  }

  // Calculate summary
  const totalRevenue = categoryProfitability.reduce((sum, c) => sum + c.totalRevenue, 0);
  const totalOrders = categoryProfitability.reduce((sum, c) => sum + c.totalOrders, 0);
  const totalProfit = categoryProfitability.reduce((sum, c) => sum + c.netProfit, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    sourceApp: 'amazon-analyzer',

    marketplace,
    dateRange: {
      start: dateRange.start.toISOString().split('T')[0],
      end: dateRange.end.toISOString().split('T')[0],
    },

    globalSettings: {
      advertisingPercent: globalCosts.advertisingPercent,
      fbaCostPercent: globalCosts.fbaCostPercent,
      fbmCostPercent: globalCosts.fbmCostPercent,
      refundRecoveryRate: globalCosts.refundRecoveryRate,
    },

    categories,

    summary: {
      totalCategories: categories.length,
      totalRevenue,
      totalOrders,
      avgMargin,
    },
  };
};

/**
 * Download export as JSON file
 */
export const downloadPricingExport = (exportData: PricingCalculatorExport): void => {
  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  const filename = `pricing-export-${exportData.marketplace}-${date}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Generate and download pricing export in one step
 */
export const exportForPricingCalculator = (
  categoryProfitability: CategoryProfitAnalysis[],
  skuProfitability: SKUProfitAnalysis[],
  globalCosts: GlobalCostPercentages,
  marketplace: string,
  dateRange: { start: Date; end: Date }
): PricingCalculatorExport => {
  const exportData = generatePricingExport(
    categoryProfitability,
    skuProfitability,
    globalCosts,
    marketplace,
    dateRange
  );

  downloadPricingExport(exportData);

  return exportData;
};

// ============================================
// BULK EXPORT FOR ALL MARKETPLACES
// ============================================

/**
 * Multi-marketplace export data structure
 */
export interface BulkPricingExport {
  version: number;
  exportedAt: string;
  sourceApp: 'amazon-analyzer';
  dateRange: {
    start: string;
    end: string;
  };
  marketplaces: {
    [key: string]: PricingCalculatorExport;
  };
  summary: {
    totalMarketplaces: number;
    totalCategories: number;
    totalRevenue: number;
  };
}

/**
 * Calculate cost percentages for a specific marketplace from SKU data
 */
const calculateMarketplaceCostPercentages = (
  skus: SKUProfitAnalysis[],
  marketplace: MarketplaceCode
): GlobalCostPercentages => {
  const mpSkus = skus.filter(s => (s as any).marketplace === marketplace);

  const totalRevenue = mpSkus.reduce((sum, s) => sum + s.totalRevenue, 0);
  const fbaRevenue = mpSkus
    .filter(s => s.fulfillment === 'FBA' || s.fulfillment === 'Mixed')
    .reduce((sum, s) => sum + s.totalRevenue, 0);
  const fbmRevenue = mpSkus
    .filter(s => s.fulfillment === 'FBM' || s.fulfillment === 'Mixed')
    .reduce((sum, s) => sum + s.totalRevenue, 0);

  const totalAds = mpSkus.reduce((sum, s) => sum + s.advertisingCost, 0);
  const totalFbaCost = mpSkus
    .filter(s => s.fulfillment === 'FBA' || s.fulfillment === 'Mixed')
    .reduce((sum, s) => sum + s.fbaCost, 0);
  const totalFbmCost = mpSkus
    .filter(s => s.fulfillment === 'FBM' || s.fulfillment === 'Mixed')
    .reduce((sum, s) => sum + s.fbmCost, 0);

  // Default refund recovery rates by marketplace
  const refundRecoveryRates: Record<string, number> = {
    US: 0.50,
    UK: 0.30,
    DE: 0.30,
    FR: 0.30,
    IT: 0.30,
    ES: 0.30,
    CA: 0.40,
    AU: 0.40,
    AE: 0.30,
    SA: 0.30,
  };

  return {
    advertisingPercent: totalRevenue > 0 ? (totalAds / totalRevenue) * 100 : 0,
    fbaCostPercent: fbaRevenue > 0 ? (totalFbaCost / fbaRevenue) * 100 : 0,
    fbmCostPercent: fbmRevenue > 0 ? (totalFbmCost / fbmRevenue) * 100 : 0,
    refundRecoveryRate: refundRecoveryRates[marketplace] ?? 0.30,
  };
};

/**
 * Generate bulk export for all marketplaces
 * Creates separate analysis per marketplace from All Marketplaces data
 */
export const generateBulkPricingExport = (
  skuProfitability: SKUProfitAnalysis[],
  dateRange: { start: Date; end: Date }
): BulkPricingExport => {
  // Group SKUs by marketplace
  const marketplaceSkus = new Map<MarketplaceCode, SKUProfitAnalysis[]>();

  skuProfitability.forEach(sku => {
    const mp = (sku as any).marketplace as MarketplaceCode;
    if (!mp) return;

    if (!marketplaceSkus.has(mp)) {
      marketplaceSkus.set(mp, []);
    }
    marketplaceSkus.get(mp)!.push(sku);
  });

  // Generate export for each marketplace
  const marketplaceExports: { [key: string]: PricingCalculatorExport } = {};
  let totalCategories = 0;
  let totalRevenue = 0;

  // Import the analytics function dynamically to avoid circular dependency
  const { calculateCategoryProfitability, calculateProductProfitability, calculateParentProfitability } = require('./profitabilityAnalytics');

  marketplaceSkus.forEach((skus, marketplace) => {
    // Calculate category profitability for this marketplace
    const products = calculateProductProfitability(skus);
    const parents = calculateParentProfitability(products);
    const categories = calculateCategoryProfitability(parents, products);

    // Calculate marketplace-specific cost percentages
    const globalCosts = calculateMarketplaceCostPercentages(skuProfitability, marketplace);

    // Generate export
    const exportData = generatePricingExport(
      categories,
      skus,
      globalCosts,
      marketplace,
      dateRange
    );

    marketplaceExports[marketplace] = exportData;
    totalCategories += exportData.summary.totalCategories;
    totalRevenue += exportData.summary.totalRevenue;
  });

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    sourceApp: 'amazon-analyzer',
    dateRange: {
      start: dateRange.start.toISOString().split('T')[0],
      end: dateRange.end.toISOString().split('T')[0],
    },
    marketplaces: marketplaceExports,
    summary: {
      totalMarketplaces: marketplaceSkus.size,
      totalCategories,
      totalRevenue,
    },
  };
};

/**
 * Download bulk export as Excel file with one sheet per marketplace
 * Format optimized for PriceLab import
 */
export const downloadBulkPricingExportAsExcel = (bulkData: BulkPricingExport): void => {
  const wb = XLSX.utils.book_new();

  // Create a sheet for each marketplace
  Object.entries(bulkData.marketplaces).forEach(([marketplace, data]) => {
    // Build rows for this marketplace
    const rows: any[][] = [];

    // Header row
    rows.push([
      'Category',
      'Fulfillment',
      'Sample Size',
      'Revenue',
      'Quantity',
      'Avg Price',
      'Selling Fee %',
      'FBA Fee %',
      'Refund Loss %',
      'VAT %',
      'Product Cost %',
      'Shipping %',
      'Customs %',
      'DDP Fee %',
      'Warehouse %',
      'GST %',
      'Ads %',
      'FBA Cost %',
      'FBM Cost %',
      'Profit Margin %',
      'ROI %',
      'Avg Product Cost',
    ]);

    // Data rows - sorted by category then fulfillment
    const sortedCategories = [...data.categories].sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.fulfillmentType.localeCompare(b.fulfillmentType);
    });

    sortedCategories.forEach(cat => {
      rows.push([
        cat.category,
        cat.fulfillmentType,
        cat.sampleSize,
        Math.round(cat.totalRevenue * 100) / 100,
        cat.totalQuantity,
        Math.round(cat.avgSalePrice * 100) / 100,
        Math.round(cat.sellingFeePercent * 100) / 100,
        Math.round(cat.fbaFeePercent * 100) / 100,
        Math.round(cat.refundLossPercent * 100) / 100,
        Math.round(cat.vatPercent * 100) / 100,
        Math.round(cat.productCostPercent * 100) / 100,
        Math.round(cat.shippingCostPercent * 100) / 100,
        Math.round(cat.customsDutyPercent * 100) / 100,
        Math.round(cat.ddpFeePercent * 100) / 100,
        Math.round(cat.warehouseCostPercent * 100) / 100,
        Math.round(cat.gstCostPercent * 100) / 100,
        Math.round(cat.advertisingPercent * 100) / 100,
        Math.round(cat.fbaCostPercent * 100) / 100,
        Math.round(cat.fbmCostPercent * 100) / 100,
        Math.round(cat.avgProfitMargin * 100) / 100,
        Math.round(cat.avgROI * 100) / 100,
        Math.round(cat.avgProductCost * 100) / 100,
      ]);
    });

    // Add summary row
    rows.push([]); // Empty row
    rows.push(['--- Summary ---']);
    rows.push(['Total Categories', data.summary.totalCategories]);
    rows.push(['Total Revenue', Math.round(data.summary.totalRevenue * 100) / 100]);
    rows.push(['Total Orders', data.summary.totalOrders]);
    rows.push(['Avg Margin %', Math.round(data.summary.avgMargin * 100) / 100]);
    rows.push(['Period', `${data.dateRange.start} to ${data.dateRange.end}`]);

    // Add global settings
    rows.push([]);
    rows.push(['--- Global Settings ---']);
    rows.push(['Advertising %', Math.round(data.globalSettings.advertisingPercent * 100) / 100]);
    rows.push(['FBA Cost %', Math.round(data.globalSettings.fbaCostPercent * 100) / 100]);
    rows.push(['FBM Cost %', Math.round(data.globalSettings.fbmCostPercent * 100) / 100]);
    rows.push(['Refund Recovery Rate', Math.round(data.globalSettings.refundRecoveryRate * 100) + '%']);

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // Category
      { wch: 12 }, // Fulfillment
      { wch: 12 }, // Sample Size
      { wch: 12 }, // Revenue
      { wch: 10 }, // Quantity
      { wch: 10 }, // Avg Price
      { wch: 12 }, // Selling Fee
      { wch: 10 }, // FBA Fee
      { wch: 12 }, // Refund Loss
      { wch: 8 },  // VAT
      { wch: 12 }, // Product Cost
      { wch: 10 }, // Shipping
      { wch: 10 }, // Customs
      { wch: 10 }, // DDP
      { wch: 12 }, // Warehouse
      { wch: 8 },  // GST
      { wch: 8 },  // Ads
      { wch: 10 }, // FBA Cost
      { wch: 10 }, // FBM Cost
      { wch: 12 }, // Profit Margin
      { wch: 8 },  // ROI
      { wch: 14 }, // Avg Product Cost
    ];

    // Add to workbook - use marketplace code as sheet name
    XLSX.utils.book_append_sheet(wb, ws, marketplace);
  });

  // Add a summary sheet
  const summaryRows: any[][] = [
    ['PriceLab Bulk Export Summary'],
    [],
    ['Export Date', bulkData.exportedAt],
    ['Period', `${bulkData.dateRange.start} to ${bulkData.dateRange.end}`],
    [],
    ['Total Marketplaces', bulkData.summary.totalMarketplaces],
    ['Total Categories', bulkData.summary.totalCategories],
    ['Total Revenue (USD)', Math.round(bulkData.summary.totalRevenue * 100) / 100],
    [],
    ['Marketplace Breakdown:'],
  ];

  Object.entries(bulkData.marketplaces).forEach(([mp, data]) => {
    summaryRows.push([
      mp,
      `${data.summary.totalCategories} categories`,
      `$${Math.round(data.summary.totalRevenue).toLocaleString()} revenue`,
      `${Math.round(data.summary.avgMargin * 10) / 10}% avg margin`,
    ]);
  });

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  summaryWs['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // Download
  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `pricelab-bulk-export-${date}.xlsx`);
};

/**
 * Download bulk export as JSON (alternative format)
 */
export const downloadBulkPricingExportAsJson = (bulkData: BulkPricingExport): void => {
  const jsonString = JSON.stringify(bulkData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  const filename = `pricelab-bulk-export-${date}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Generate and download bulk export in one step
 */
export const bulkExportForPriceLab = (
  skuProfitability: SKUProfitAnalysis[],
  dateRange: { start: Date; end: Date },
  format: 'excel' | 'json' = 'excel'
): BulkPricingExport => {
  const bulkData = generateBulkPricingExport(skuProfitability, dateRange);

  if (format === 'excel') {
    downloadBulkPricingExportAsExcel(bulkData);
  } else {
    downloadBulkPricingExportAsJson(bulkData);
  }

  return bulkData;
};
