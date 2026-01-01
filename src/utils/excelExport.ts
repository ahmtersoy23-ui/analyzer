/**
 * Excel Export Utilities for Transaction Analyzer
 */

import * as XLSX from 'xlsx';
import { ZONE_NAMES } from '../constants/marketplaces';
import type { TransactionData } from '../types/transaction';
import type { DetailedAnalytics } from '../services/analytics/analyticsEngine';

// Extended config type that also accepts the "ALL" marketplace
interface ExportConfig {
  code: string;
  name: string;
  currency: string;
  hasPostalZones: boolean;
  vatIncludedInPrice: boolean;
  hasLiquidations: boolean;
}

export interface ExportOptions {
  analytics: DetailedAnalytics;
  config: ExportConfig;
  dateRange: { start: string; end: string };
  selectedFulfillment: string;
  filteredData: TransactionData[];
}

/**
 * Export transaction analytics to Excel file
 */
export const exportTransactionsToExcel = ({
  analytics,
  config,
  dateRange,
  selectedFulfillment,
  filteredData,
}: ExportOptions): void => {
  const workbook = XLSX.utils.book_new();

  // 1. SUMMARY SHEET
  const summaryData = [
    ['Amazon Transaction Analyzer - Summary Report'],
    ['Marketplace', config.name],
    ['Currency', config.currency],
    ['Report Date', new Date().toLocaleDateString()],
    ['Date Range', dateRange.start && dateRange.end ? `${dateRange.start} to ${dateRange.end}` : 'All Time'],
    ['Fulfillment Filter', selectedFulfillment === 'all' ? 'All' : selectedFulfillment],
    [],
    ['SALES SUMMARY'],
    ['Total Orders', analytics.totalOrders],
    ['Total Sales', analytics.totalSales],
    ['FBA Orders', analytics.fbaOrders],
    ['FBA Sales', analytics.fbaOrderSales],
    ['FBM Orders', analytics.fbmOrders],
    ['FBM Sales', analytics.fbmOrderSales],
    [],
    ['COSTS SUMMARY'],
    ['Total Selling Fees', analytics.totalSellingFees],
    ['Total FBA Fees', analytics.totalFbaFees],
    ['Total FBA Cost', analytics.totalFBACost],
    ['Total FBM Cost', analytics.totalFBMCost],
    ['Advertising Cost', analytics.displayAdvertisingCost],
    [],
    ['REFUND SUMMARY'],
    ['Total Refunds', analytics.totalRefunds],
    ['Refund Rate (%)', analytics.refundRate],
    ['Total Refund Amount', analytics.totalRefundAmount],
    ['Recovered Refunds', analytics.recoveredRefunds],
    ['Actual Refund Loss', analytics.actualRefundLoss],
    [],
    ['NET SUMMARY'],
    ['Total Net', analytics.totalNet],
    ...(config.vatIncludedInPrice ? [['Total VAT', analytics.totalVAT]] : [])
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // 2. POSTAL ZONES SHEET
  if (config.hasPostalZones && analytics.postalZones && Object.keys(analytics.postalZones).length > 0) {
    const zonesData = [
      ['Zone', 'Zone Name', 'Order Count', 'Sales', 'Percentage'],
      ...Object.entries(analytics.postalZones)
        .sort((a, b) => b[1].sales - a[1].sales)
        .map(([zone, data]) => [
          zone,
          (ZONE_NAMES[config.code as keyof typeof ZONE_NAMES]?.[zone]) || '-',
          data.count,
          data.sales,
          ((data.count / analytics.totalOrders) * 100).toFixed(2) + '%'
        ])
    ];
    const zonesSheet = XLSX.utils.aoa_to_sheet(zonesData);
    XLSX.utils.book_append_sheet(workbook, zonesSheet, 'Postal Zones');
  }

  // 3. FBA COSTS DETAIL SHEET
  if (selectedFulfillment !== 'FBM') {
    const fbaCostsData = [
      ['FBA COSTS BREAKDOWN'],
      [],
      ['ADJUSTMENTS'],
      ['Description', 'Count', 'Total'],
      ...(analytics.adjustmentGroups ? Object.entries(analytics.adjustmentGroups).map(([key, val]) => [key, val.count, val.total]) : []),
      [],
      ['INVENTORY FEES'],
      ['Description', 'Count', 'Total'],
      ...(analytics.inventoryGroups ? Object.entries(analytics.inventoryGroups).map(([key, val]) => [key, val.count, val.total]) : []),
      [],
      ['SERVICE FEES'],
      ['Description', 'Count', 'Total'],
      ...(analytics.serviceGroups ? Object.entries(analytics.serviceGroups).map(([key, val]) => [key, val.count, val.total]) : []),
      [],
      ['CHARGEBACKS'],
      ['SKU', 'Count', 'Total'],
      ...(analytics.chargebackGroups ? Object.entries(analytics.chargebackGroups).map(([key, val]) => [key, val.count, val.total]) : []),
      [],
      ['SUMMARY'],
      ['Adjustment Total', analytics.adjustmentTotal],
      ['Inventory Total', analytics.inventoryTotal],
      ['Service Total', analytics.serviceTotal],
      ['Chargeback Total', analytics.chargebackTotal],
      ['FBA Transaction Fees', analytics.fbaTransactionFees],
      ['Fee Adjustments', analytics.feeAdjustments],
      ['SAFE-T Reimbursements', analytics.safetReimbursements],
      ...(config.hasLiquidations ? [['Liquidations Total', analytics.liquidationsTotal]] : []),
      ['TOTAL FBA COST', analytics.totalFBACost]
    ];
    const fbaCostsSheet = XLSX.utils.aoa_to_sheet(fbaCostsData);
    XLSX.utils.book_append_sheet(workbook, fbaCostsSheet, 'FBA Costs');
  }

  // 4. TOP 100 BEST SELLING SKUs
  const orders = filteredData.filter(d => d.categoryType === 'Order');
  const refunds = filteredData.filter(d => d.categoryType === 'Refund');

  // Calculate sales by SKU
  const skuSales: Record<string, { sku: string; totalSales: number; orderCount: number; totalQuantity: number }> = {};
  orders.forEach(order => {
    if (!order.sku) return;
    if (!skuSales[order.sku]) {
      skuSales[order.sku] = { sku: order.sku, totalSales: 0, orderCount: 0, totalQuantity: 0 };
    }
    skuSales[order.sku].totalSales += order.productSales;
    skuSales[order.sku].orderCount += 1;
    skuSales[order.sku].totalQuantity += order.quantity;
  });

  // Sort by total sales and take top 100
  const top100BestSellers = Object.values(skuSales)
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, 100)
    .map(item => ({
      'SKU': item.sku,
      'Total Sales': item.totalSales,
      'Order Count': item.orderCount,
      'Total Quantity': item.totalQuantity,
      'Avg Order Value': item.orderCount > 0 ? item.totalSales / item.orderCount : 0
    }));

  if (top100BestSellers.length > 0) {
    const bestSellersSheet = XLSX.utils.json_to_sheet(top100BestSellers);
    XLSX.utils.book_append_sheet(workbook, bestSellersSheet, 'Top 100 Best Sellers');
  }

  // 5. TOP 100 MOST REFUNDED SKUs
  // Calculate refunds by SKU
  const skuRefunds: Record<string, { sku: string; totalRefundAmount: number; refundCount: number; totalQuantity: number }> = {};
  refunds.forEach(refund => {
    if (!refund.sku) return;
    if (!skuRefunds[refund.sku]) {
      skuRefunds[refund.sku] = { sku: refund.sku, totalRefundAmount: 0, refundCount: 0, totalQuantity: 0 };
    }
    skuRefunds[refund.sku].totalRefundAmount += Math.abs(refund.total);
    skuRefunds[refund.sku].refundCount += 1;
    skuRefunds[refund.sku].totalQuantity += Math.abs(refund.quantity);
  });

  // Sort by refund count and take top 100
  const top100MostRefunded = Object.values(skuRefunds)
    .sort((a, b) => b.refundCount - a.refundCount)
    .slice(0, 100)
    .map(item => ({
      'SKU': item.sku,
      'Refund Count': item.refundCount,
      'Total Refund Amount': item.totalRefundAmount,
      'Total Quantity': item.totalQuantity,
      'Avg Refund Value': item.refundCount > 0 ? item.totalRefundAmount / item.refundCount : 0
    }));

  if (top100MostRefunded.length > 0) {
    const mostRefundedSheet = XLSX.utils.json_to_sheet(top100MostRefunded);
    XLSX.utils.book_append_sheet(workbook, mostRefundedSheet, 'Top 100 Most Refunded');
  }

  // Download
  const fileName = `Amazon_Analysis_${config.code}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
