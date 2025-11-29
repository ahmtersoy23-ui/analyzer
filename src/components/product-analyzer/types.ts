/**
 * Shared types for Product Analyzer components
 */

export interface CategoryAnalytics {
  category: string;
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  fbaFeePercentage: number;
  sellingFeePercentage: number;
  refundLossPercentage: number;
  vatPercentage: number;
  topProducts: Array<{ name: string; sales: number }>;
}

export interface ProductAnalytics {
  name: string;
  asin: string;
  parent: string;
  category: string;
  totalSales: number;
  totalOrders: number;
  fbaSales: number;
  fbmSales: number;
  fbaFees: number;
  sellingFees: number;
  totalRefundLoss: number;
  avgOrderValue: number;
  variants: Array<{
    sku: string;
    fulfillment: string;
    sales: number;
    quantity: number;
    orders: number;
  }>;
}

export interface ParentAnalytics {
  parent: string;
  category: string;
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  variants: Array<{
    name: string;
    asin: string;
    sales: number;
    orders: number;
  }>;
}

export interface GlobalCosts {
  advertising: number;
  fba: number;
  fbm: number;
  vat: number;
}

export interface SalesByFulfillment {
  totalSales: number;
  fbaSales: number;
  fbmSales: number;
}
