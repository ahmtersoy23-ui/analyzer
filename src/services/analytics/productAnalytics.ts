/**
 * Product Analytics Service
 * Handles all product-level calculations (Name, Category, Parent based)
 */

import { TransactionData } from '../../types/transaction';
import { MARKETPLACE_CONFIGS } from '../../constants/marketplaces';
import { convertCurrency, getMarketplaceCurrency } from '../../utils/currencyExchange';

/**
 * Helper function to convert transaction values to USD when needed
 * When viewing "All" marketplaces, we need to convert all currencies to USD
 */
const convertValue = (
  value: number,
  transaction: TransactionData,
  marketplaceCode: string | null
): number => {
  // If specific marketplace is selected, no conversion needed (all same currency)
  if (marketplaceCode !== null && marketplaceCode !== 'all') {
    return value;
  }

  // For "All" marketplaces, convert to USD
  if (!transaction.marketplaceCode) {
    return value; // No marketplace info, can't convert
  }

  const sourceCurrency = getMarketplaceCurrency(transaction.marketplaceCode);
  return convertCurrency(value, sourceCurrency, 'USD');
};

// ============================================================================
// TYPES
// ============================================================================

export interface ProductAnalytics {
  name: string;
  asin: string;
  parent: string;
  category: string;

  // Sales & Orders (filterable by date/marketplace/fulfillment)
  totalOrders: number;
  totalRefunds: number;
  totalSales: number;
  totalRefundAmount: number;
  totalRefundLoss: number; // Refund amount with marketplace recovery rates applied

  // Fulfillment breakdown
  fbaOrders: number;
  fbmOrders: number;
  fbaSales: number;
  fbmSales: number;

  // Fees (from Order/Refund transactions)
  sellingFees: number;
  fbaFees: number;

  // Calculated metrics
  avgOrderValue: number;
  netSales: number; // sales - refunds
  profitMargin: number;

  // Variants (SKUs grouped by name)
  variants: Array<{
    sku: string;
    fulfillment: string;
    orders: number;
    quantity: number;  // Total quantity sold
    sales: number;
    refunds: number;   // Total refund count
  }>;
}

export interface CategoryAnalytics {
  category: string;

  // Aggregated metrics
  totalProducts: number;
  totalOrders: number;
  totalSales: number;
  totalRefundAmount: number;
  totalRefundLoss: number; // Refund loss with marketplace recovery rates applied

  // Fulfillment breakdown
  fbaSales: number;
  fbmSales: number;

  // Fees
  sellingFees: number;
  fbaFees: number;

  // Percentages for summary
  fbaFeePercentage: number;      // FBA fees / FBA sales
  sellingFeePercentage: number;  // Selling fees / Total sales
  refundLossPercentage: number;  // Refund loss / Total sales
  vatPercentage: number;         // VAT / Total sales (if applicable)

  // Top products
  topProducts: Array<{
    name: string;
    sales: number;
    orders: number;
  }>;
}

export interface ParentAnalytics {
  parent: string;
  category: string;

  totalProducts: number;
  totalOrders: number;
  totalSales: number;
  fbaSales: number;
  fbmSales: number;

  // Variants (products grouped under this parent)
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

// ============================================================================
// COST HELPERS
// ============================================================================

/**
 * Check if a transaction is advertising-related (multi-language support)
 */
const isAdvertising = (desc: string | undefined): boolean => {
  if (!desc) return false;
  return desc.includes('cost of advertising') ||  // EN
         desc.includes('werbekosten') ||          // DE
         desc.includes('prix de la publicité') ||  // FR
         desc.includes('pubblicità') ||           // IT
         desc.includes('gastos de publicidad');   // ES
};

/**
 * Calculate total advertising cost from ALL transactions (unfiltered)
 */
export const calculateAdvertisingCost = (transactions: TransactionData[], marketplaceCode: string | null = null): number => {
  return transactions
    .filter(t => t.categoryType === 'Service Fee' && isAdvertising(t.descriptionLower))
    .reduce((sum, t) => sum + convertValue(Math.abs(t.total), t, marketplaceCode), 0);
};

/**
 * Calculate FBA costs from ALL transactions (unfiltered)
 * Includes: Adjustments, FBA Inventory Fees, Chargebacks, Service Fees (non-advertising),
 * FBA Transaction Fees, Fee Adjustments, SAFE-T Reimbursements, Liquidations
 */
export const calculateFBACosts = (transactions: TransactionData[], marketplaceCode: string | null = null): number => {
  const costs = transactions.filter(t => {
    const cat = t.categoryType;

    // Adjustment costs
    if (cat === 'Adjustment') return true;

    // FBA Inventory Fees (storage, etc)
    if (cat === 'FBA Inventory Fee') return true;

    // Chargebacks
    if (cat === 'Chargeback Refund') return true;

    // Service fees (excluding advertising)
    if (cat === 'Service Fee' && !isAdvertising(t.descriptionLower)) return true;

    // FBA Transaction Fees
    if (cat === 'FBA Transaction Fee') return true;

    // Fee Adjustments
    if (cat === 'Fee Adjustment') return true;

    // SAFE-T Reimbursements
    if (cat === 'SAFE-T Reimbursement') return true;

    // Liquidations (if applicable)
    if (cat === 'Liquidations') return true;

    return false;
  });

  return Math.abs(costs.reduce((sum, t) => sum + convertValue(t.total, t, marketplaceCode), 0));
};

/**
 * Calculate FBM costs from ALL transactions (unfiltered)
 * Primarily shipping/delivery costs (multi-language support)
 */
export const calculateFBMCosts = (transactions: TransactionData[], marketplaceCode: string | null = null): number => {
  const costs = transactions.filter(t => {
    const cat = t.categoryType;
    return cat === 'Shipping Services' ||      // US, CA, MX, JP
           cat === 'Delivery Services' ||      // UK
           cat === 'Lieferdienste' ||          // DE
           cat === 'Services de livraison' ||  // FR
           cat === 'Servizi di consegna' ||    // IT
           cat === 'Servicios de entrega';     // ES
  });

  return Math.abs(costs.reduce((sum, t) => sum + convertValue(t.total, t, marketplaceCode), 0));
};

/**
 * Calculate total VAT from ALL transactions (unfiltered)
 */
export const calculateVAT = (transactions: TransactionData[], marketplaceCode: string | null = null): number => {
  return transactions.reduce((sum, t) => sum + convertValue(t.vat || 0, t, marketplaceCode), 0);
};

/**
 * Calculate all global costs (from ALL transactions, unfiltered)
 */
export const calculateGlobalCosts = (transactions: TransactionData[], marketplaceCode: string | null = null): GlobalCosts => {
  return {
    advertising: calculateAdvertisingCost(transactions, marketplaceCode),
    fba: calculateFBACosts(transactions, marketplaceCode),
    fbm: calculateFBMCosts(transactions, marketplaceCode),
    vat: calculateVAT(transactions, marketplaceCode)
  };
};

// ============================================================================
// PRODUCT ANALYTICS
// ============================================================================

/**
 * Calculate product analytics (NAME-based grouping, not SKU-based)
 * IMPORTANT: This works on FILTERED transactions (date, marketplace, fulfillment)
 * @param transactions - Filtered transactions
 * @param marketplaceCode - Selected marketplace or 'all' for currency conversion
 */
export const calculateProductAnalytics = (
  transactions: TransactionData[],
  marketplaceCode: string | null = null
): ProductAnalytics[] => {
  // Group by NAME (not SKU)
  const productMap = new Map<string, ProductAnalytics>();

  transactions.forEach(t => {
    // Use name from Google Sheets, fallback to SKU if not found
    const name = t.name || t.sku;

    // Category logic:
    // 1. If productCategory exists from Google Sheets, use it
    // 2. If SKU starts with "AMZN.GR" or "AMZN,GR" (case-insensitive), categorize as "Grade and Resell"
    // 3. Otherwise, categorize as "Deleted" (products not in Google Sheets anymore)
    let category = t.productCategory;
    if (!category) {
      const skuUpper = t.sku.toUpperCase();
      category = (skuUpper.startsWith('AMZN.GR') || skuUpper.startsWith('AMZN,GR'))
        ? 'Grade and Resell'
        : 'Deleted';
    }

    if (!productMap.has(name)) {
      productMap.set(name, {
        name,
        asin: t.asin || 'Unknown',
        parent: t.parent || 'Unknown',
        category,
        totalOrders: 0,
        totalRefunds: 0,
        totalSales: 0,
        totalRefundAmount: 0,
        totalRefundLoss: 0,
        fbaOrders: 0,
        fbmOrders: 0,
        fbaSales: 0,
        fbmSales: 0,
        sellingFees: 0,
        fbaFees: 0,
        avgOrderValue: 0,
        netSales: 0,
        profitMargin: 0,
        variants: []
      });
    }

    const product = productMap.get(name)!;

    // Orders
    if (t.categoryType === 'Order') {
      const convertedSales = convertValue(t.productSales, t, marketplaceCode);
      const convertedSellingFees = convertValue(Math.abs(t.sellingFees), t, marketplaceCode);
      const convertedFbaFees = convertValue(Math.abs(t.fbaFees), t, marketplaceCode);

      product.totalOrders++;
      product.totalSales += convertedSales;
      product.sellingFees += convertedSellingFees;
      product.fbaFees += convertedFbaFees;

      if (t.fulfillment === 'FBA') {
        product.fbaOrders++;
        product.fbaSales += convertedSales;
      } else {
        // All non-FBA orders are counted as FBM (including 'Unknown', 'FBM', 'Merchant', etc.)
        product.fbmOrders++;
        product.fbmSales += convertedSales;
      }

      // Track variant
      const existingVariant = product.variants.find(v => v.sku === t.sku);
      if (existingVariant) {
        existingVariant.orders++;
        existingVariant.quantity += t.quantity;
        existingVariant.sales += convertedSales;
      } else {
        product.variants.push({
          sku: t.sku,
          fulfillment: t.fulfillment,
          orders: 1,
          quantity: t.quantity,
          sales: convertedSales,
          refunds: 0
        });
      }
    }

    // Refunds
    if (t.categoryType === 'Refund') {
      product.totalRefunds++;
      const refundAmount = convertValue(Math.abs(t.total), t, marketplaceCode);
      product.totalRefundAmount += refundAmount;

      // Calculate refund loss with marketplace recovery rate
      // Loss = Refund Amount × (1 - Recovery Rate)
      const mpConfig = MARKETPLACE_CONFIGS[t.marketplaceCode as keyof typeof MARKETPLACE_CONFIGS];
      const lossRate = mpConfig ? (1 - mpConfig.refundRecoveryRate) : 0.70; // Default 70% loss
      product.totalRefundLoss += refundAmount * lossRate;

      // Track refund in variant
      const refundVariant = product.variants.find(v => v.sku === t.sku);
      if (refundVariant) {
        refundVariant.refunds++;
      }
    }
  });

  // Calculate derived metrics
  productMap.forEach(product => {
    product.avgOrderValue = product.totalOrders > 0
      ? product.totalSales / product.totalOrders
      : 0;

    // Net Sales = Sales - Refund Loss (not total refund amount, but actual loss after recovery)
    product.netSales = product.totalSales - product.totalRefundLoss;

    product.profitMargin = product.totalSales > 0
      ? ((product.netSales - product.sellingFees - product.fbaFees) / product.totalSales) * 100
      : 0;

    // Sort variants by sales
    product.variants.sort((a, b) => b.sales - a.sales);
  });

  const result = Array.from(productMap.values())
    .sort((a, b) => b.totalSales - a.totalSales);

  return result;
};

// ============================================================================
// CATEGORY ANALYTICS
// ============================================================================

/**
 * Calculate category analytics from product analytics
 */
export const calculateCategoryAnalytics = (
  products: ProductAnalytics[],
  transactions: TransactionData[]
): CategoryAnalytics[] => {
  const categoryMap = new Map<string, CategoryAnalytics>();

  products.forEach(product => {
    if (!categoryMap.has(product.category)) {
      categoryMap.set(product.category, {
        category: product.category,
        totalProducts: 0,
        totalOrders: 0,
        totalSales: 0,
        totalRefundAmount: 0,
        totalRefundLoss: 0,
        fbaSales: 0,
        fbmSales: 0,
        sellingFees: 0,
        fbaFees: 0,
        fbaFeePercentage: 0,
        sellingFeePercentage: 0,
        refundLossPercentage: 0,
        vatPercentage: 0,
        topProducts: []
      });
    }

    const cat = categoryMap.get(product.category)!;
    cat.totalProducts++;
    cat.totalOrders += product.totalOrders;
    cat.totalSales += product.totalSales;
    cat.totalRefundAmount += product.totalRefundAmount;
    cat.totalRefundLoss += product.totalRefundLoss;
    cat.fbaSales += product.fbaSales || 0;
    cat.fbmSales += product.fbmSales || 0;
    cat.sellingFees += product.sellingFees;
    cat.fbaFees += product.fbaFees;
  });

  // Calculate percentages
  categoryMap.forEach(cat => {
    const categoryProducts = products.filter(p => p.category === cat.category);
    const categoryFBASales = categoryProducts.reduce((sum, p) => sum + p.fbaSales, 0);

    cat.fbaFeePercentage = categoryFBASales > 0
      ? (cat.fbaFees / categoryFBASales) * 100
      : 0;

    cat.sellingFeePercentage = cat.totalSales > 0
      ? (cat.sellingFees / cat.totalSales) * 100
      : 0;

    cat.refundLossPercentage = cat.totalSales > 0
      ? (cat.totalRefundLoss / cat.totalSales) * 100
      : 0;

    // VAT percentage (from filtered transactions)
    const categoryTransactions = transactions.filter(t =>
      t.productCategory === cat.category && t.categoryType === 'Order'
    );
    const categoryVAT = categoryTransactions.reduce((sum, t) => sum + (t.vat || 0), 0);
    cat.vatPercentage = cat.totalSales > 0
      ? (categoryVAT / cat.totalSales) * 100
      : 0;

    // Top 5 products
    cat.topProducts = categoryProducts
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        sales: p.totalSales,
        orders: p.totalOrders
      }));
  });

  return Array.from(categoryMap.values())
    .sort((a, b) => b.totalSales - a.totalSales);
};

// ============================================================================
// PARENT ANALYTICS
// ============================================================================

/**
 * Calculate parent ASIN analytics from product analytics
 */
export const calculateParentAnalytics = (
  products: ProductAnalytics[]
): ParentAnalytics[] => {
  const parentMap = new Map<string, ParentAnalytics>();

  products.forEach(product => {
    if (!parentMap.has(product.parent)) {
      parentMap.set(product.parent, {
        parent: product.parent,
        category: product.category,
        totalProducts: 0,
        totalOrders: 0,
        totalSales: 0,
        fbaSales: 0,
        fbmSales: 0,
        variants: []
      });
    }

    const parent = parentMap.get(product.parent)!;
    parent.totalProducts++;
    parent.totalOrders += product.totalOrders;
    parent.totalSales += product.totalSales;
    parent.fbaSales += product.fbaSales || 0;
    parent.fbmSales += product.fbmSales || 0;

    parent.variants.push({
      name: product.name,
      asin: product.asin,
      sales: product.totalSales,
      orders: product.totalOrders
    });
  });

  // Sort variants and filter parents
  parentMap.forEach(parent => {
    parent.variants.sort((a, b) => b.sales - a.sales);
  });

  return Array.from(parentMap.values())
    .filter(p => p.totalProducts > 1) // Only parents with multiple variants
    .sort((a, b) => b.totalSales - a.totalSales);
};
