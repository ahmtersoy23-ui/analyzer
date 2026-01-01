// Analytics Calculation Service
// Pure functions for Amazon transaction analysis

import { TransactionData, MarketplaceConfig, GroupData } from '../../types/transaction';
import { MARKETPLACE_CONFIGS } from '../../constants/marketplaces';
import type { MarketplaceCode } from '../../types/transaction';
import { convertCurrency, getMarketplaceCurrency } from '../../utils/currencyExchange';

/**
 * Detect if a transaction is advertising-related (multi-language support)
 */
export const isAdvertisingTransaction = (descriptionLower: string): boolean => {
  return descriptionLower.includes('cost of advertising') ||  // EN
         descriptionLower.includes('werbekosten') ||          // DE
         descriptionLower.includes('prix de la publicité') ||  // FR
         descriptionLower.includes('pubblicità') ||           // IT
         descriptionLower.includes('gastos de publicidad');   // ES
};

/**
 * Normalize inventory fee descriptions across languages
 */
export const normalizeInventoryFeeDescription = (description: string): string => {
  if (!description) return 'Other';
  const lower = description.toLowerCase().trim();

  // Long-Term Storage Fee (check first, before general storage)
  if (lower.includes('long-term storage') ||
      lower.includes('long term storage') ||
      lower.includes('fba long-term storage') ||
      lower.includes('stoccaggio a lungo termine') ||  // IT
      lower.includes('langzeitlagergebühr') ||         // DE
      lower.includes('stockage à long terme') ||       // FR
      lower.includes('almacenamiento a largo plazo') || // ES
      lower === 'long-term storage fee') {
    return 'Long-Term Storage Fee';
  }

  // Standard Storage Fee
  if (lower.includes('storage fee') ||
      (lower.includes('storage') && lower.includes('fee')) ||
      lower.includes('tariffa di stoccaggio') ||       // IT
      lower.includes('lagergebühr') ||                 // DE
      lower.includes('frais de stockage') ||           // FR
      lower.includes('tarifa de almacenamiento')) {    // ES
    return 'Storage Fee';
  }

  // Disposal Fee
  if (lower.includes('disposal') ||
      lower.includes('entsorgung') ||                  // DE
      lower.includes('élimination') ||                 // FR
      lower.includes('smaltimento') ||                 // IT
      lower.includes('eliminación')) {                 // ES
    return 'Disposal Fee';
  }

  // Inbound/Inventory Placement
  if (lower.includes('inbound') ||
      lower.includes("mettere l'inventario a disposizione") ||  // IT
      lower.includes('inventory placement') ||
      lower.includes('inbound transportation')) {
    return 'Inbound/Placement Fee';
  }

  // Return Fee
  if (lower.includes('return fee') ||
      lower.includes('restituzione') ||                // IT
      lower.includes('retour') ||                      // FR
      lower.includes('rückgabe') ||                    // DE
      lower.includes('devolución')) {                  // ES
    return 'Return Fee';
  }

  // Capacity Reservation
  if (lower.includes('capacity reservation') ||
      (lower.includes('capacità') && lower.includes('prenotazione'))) {  // IT
    return 'Capacity Reservation Fee';
  }

  // Generic FBA Inventory Fee
  if (lower.includes('fba inventory fee') &&
      !lower.includes('storage') &&
      !lower.includes('disposal') &&
      !lower.includes('return')) {
    return 'FBA Inventory Fee (Other)';
  }

  return description;
};

/**
 * Calculate refund loss considering different recovery rates per marketplace
 */
export const calculateRefundLoss = (
  refunds: TransactionData[],
  marketplaceCode: MarketplaceCode | null,
  config: MarketplaceConfig
): { totalRefundAmount: number; recoveredRefunds: number; actualRefundLoss: number } => {
  // FIXED: Use 'total' (net impact) for refund loss calculation
  // total = net loss after fees are recovered, which is what we actually lose
  const totalRefundAmount = Math.abs(refunds.reduce((sum, d) => sum + d.total, 0));

  if (!marketplaceCode) {
    // "Tümü" mode: Calculate recovery rate per marketplace
    const refundsByMarketplace = refunds.reduce((acc, refund) => {
      const mpCode = (refund as any).marketplaceCode || (refund as any).marketplace || 'UNKNOWN';
      if (!acc[mpCode]) acc[mpCode] = 0;
      acc[mpCode] += Math.abs(refund.total);  // Use total (net impact)
      return acc;
    }, {} as Record<string, number>);

    let recoveredRefunds = 0;
    let actualRefundLoss = 0;

    Object.entries(refundsByMarketplace).forEach(([mpCode, refundAmount]) => {
      const mpConfig = MARKETPLACE_CONFIGS[mpCode as MarketplaceCode];
      if (mpConfig) {
        const recovered = refundAmount * mpConfig.refundRecoveryRate;
        const loss = refundAmount - recovered;
        recoveredRefunds += recovered;
        actualRefundLoss += loss;
      } else {
        // Unknown marketplace: default 30% recovery
        recoveredRefunds += refundAmount * 0.30;
        actualRefundLoss += refundAmount * 0.70;
      }
    });

    return { totalRefundAmount, recoveredRefunds, actualRefundLoss };
  } else {
    // Single marketplace mode
    const recoveredRefunds = totalRefundAmount * config.refundRecoveryRate;
    const actualRefundLoss = totalRefundAmount - recoveredRefunds;
    return { totalRefundAmount, recoveredRefunds, actualRefundLoss };
  }
};

/**
 * Calculate advertising cost proportionally based on fulfillment filter
 */
export const calculateAdvertisingCost = (
  allAdvertisingCost: number,
  fbaOrderSales: number,
  fbmOrderSales: number,
  fulfillmentFilter: 'all' | 'FBA' | 'FBM'
): number => {
  if (fulfillmentFilter === 'all') {
    return allAdvertisingCost;
  }

  const totalAllSales = fbaOrderSales + fbmOrderSales;
  if (totalAllSales === 0) return 0;

  if (fulfillmentFilter === 'FBA') {
    return allAdvertisingCost * (fbaOrderSales / totalAllSales);
  } else {
    return allAdvertisingCost * (fbmOrderSales / totalAllSales);
  }
};

/**
 * Group transactions by a key function
 */
export const groupTransactions = (
  transactions: TransactionData[],
  keyFn: (t: TransactionData) => string
): Record<string, GroupData> => {
  const groups: Record<string, GroupData> = {};

  transactions.forEach(item => {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = { count: 0, total: 0 };
    groups[key].count++;
    groups[key].total += item.total;
  });

  return groups;
};

/**
 * Parse filter start date string (YYYY-MM-DD)
 * Simply returns the string for dateOnly comparison
 */
export const parseStartDate = (dateStr: string): string => {
  // Input is already in YYYY-MM-DD format from date picker
  return dateStr;
};

/**
 * Parse filter end date string (YYYY-MM-DD)
 * Simply returns the string for dateOnly comparison
 */
export const parseEndDate = (dateStr: string): string => {
  // Input is already in YYYY-MM-DD format from date picker
  return dateStr;
};

/**
 * Check if transaction dateOnly is within filter range
 * Uses string comparison on YYYY-MM-DD format (works correctly for date ordering)
 */
export const isDateInRange = (dateOnly: string, startDate: string | null, endDate: string | null): boolean => {
  if (!dateOnly) return true; // No dateOnly = include (backwards compatibility)
  if (startDate && dateOnly < startDate) return false;
  if (endDate && dateOnly > endDate) return false;
  return true;
};

/**
 * Filter transactions by date range
 */
export const filterByDateRange = (
  transactions: TransactionData[],
  startDate: Date | null,
  endDate: Date | null
): TransactionData[] => {
  return transactions.filter(item => {
    if (startDate && item.date < startDate) return false;
    if (endDate && item.date > endDate) return false;
    return true;
  });
};

/**
 * Filter transactions by marketplace
 */
export const filterByMarketplace = (
  transactions: TransactionData[],
  marketplaceCode: MarketplaceCode | null
): TransactionData[] => {
  if (!marketplaceCode) return transactions;
  return transactions.filter(item => item.marketplaceCode === marketplaceCode);
};

/**
 * Filter transactions by fulfillment method
 */
export const filterByFulfillment = (
  transactions: TransactionData[],
  fulfillmentFilter: 'all' | 'FBA' | 'FBM'
): TransactionData[] => {
  if (fulfillmentFilter === 'all') return transactions;
  return transactions.filter(item => item.fulfillment === fulfillmentFilter);
};

/**
 * Calculate total from transactions
 */
export const sumTransactions = (
  transactions: TransactionData[],
  field: keyof TransactionData = 'total'
): number => {
  return transactions.reduce((sum, t) => sum + (t[field] as number), 0);
};

/**
 * Calculate postal zones distribution from orders
 * Returns zones with proper validation per marketplace
 */
export const calculatePostalZones = (
  orders: TransactionData[]
): Record<string, { count: number; sales: number }> => {
  const zones: Record<string, { count: number; sales: number }> = {};

  orders.forEach(order => {
    const postal = order.orderPostal || '';
    if (!postal) return;

    // Extract first character (zone code)
    let zone = postal.charAt(0).toUpperCase();
    if (!zone) return;

    // Validate zone based on marketplace
    const mpCode = order.marketplaceCode;

    // For US (0-9 digits only), UK (A-Z letters), DE (0-9), FR (0-9), IT (0-9), ES (0-9), CA (A-Z)
    if (mpCode === 'US' || mpCode === 'DE' || mpCode === 'FR' || mpCode === 'IT' || mpCode === 'ES') {
      // Only accept digits 0-9, others are international
      if (!/^[0-9]$/.test(zone)) {
        zone = 'INT';
      }
    } else if (mpCode === 'UK' || mpCode === 'CA') {
      // Only accept letters A-Z, others are international
      if (!/^[A-Z]$/.test(zone)) {
        zone = 'INT';
      }
    }

    if (!zones[zone]) {
      zones[zone] = { count: 0, sales: 0 };
    }

    zones[zone].count++;
    zones[zone].sales += order.productSales;
  });

  return zones;
};

/**
 * Calculate marketplace sales distribution
 * IMPORTANT: Convert all sales to USD for multi-marketplace comparison
 */
export const calculateMarketplaceSalesDistribution = (
  orders: TransactionData[]
): Record<string, { orders: number; sales: number }> => {
  const distribution: Record<string, { orders: number; sales: number }> = {};

  orders.forEach(order => {
    const mpCode = order.marketplaceCode || 'UNKNOWN';

    if (!distribution[mpCode]) {
      distribution[mpCode] = { orders: 0, sales: 0 };
    }

    distribution[mpCode].orders++;

    // FIXED: Convert to USD for "Tümü" mode
    const sourceCurrency = getMarketplaceCurrency(mpCode as MarketplaceCode);
    const salesInUSD = convertCurrency(order.productSales, sourceCurrency, 'USD');
    distribution[mpCode].sales += salesInUSD;
  });

  return distribution;
};

/**
 * Calculate FBA-specific costs
 */
export const calculateFBACost = (
  transactions: TransactionData[],
  config: MarketplaceConfig
): number => {
  const adjustmentTotal = sumTransactions(
    transactions.filter(d => d.categoryType === 'Adjustment')
  );

  const inventoryTotal = sumTransactions(
    transactions.filter(d => d.categoryType === 'FBA Inventory Fee')
  );

  const chargebackTotal = sumTransactions(
    transactions.filter(d => d.categoryType === 'Chargeback Refund')
  );

  // Service fees excluding advertising
  const serviceTotal = sumTransactions(
    transactions
      .filter(d => d.categoryType === 'Service Fee')
      .filter(d => !isAdvertisingTransaction(d.descriptionLower))
  );

  const fbaTransactionFeesTotal = Math.abs(
    sumTransactions(transactions.filter(d => d.categoryType === 'FBA Transaction Fee'))
  );

  const feeAdjustments = Math.abs(
    sumTransactions(transactions.filter(d => d.categoryType === 'Fee Adjustment'))
  );

  const safetReimbursements = Math.abs(
    sumTransactions(transactions.filter(d => d.categoryType === 'SAFE-T Reimbursement'))
  );

  const liquidationsTotal = config.hasLiquidations
    ? sumTransactions(transactions.filter(d => d.categoryType === 'Liquidations'))
    : 0;

  if (config.hasLiquidations) {
    return Math.abs(
      adjustmentTotal + inventoryTotal + chargebackTotal + serviceTotal +
      fbaTransactionFeesTotal + feeAdjustments + safetReimbursements + liquidationsTotal
    );
  } else {
    return Math.abs(
      adjustmentTotal + inventoryTotal + chargebackTotal + serviceTotal +
      fbaTransactionFeesTotal + feeAdjustments + safetReimbursements
    );
  }
};

/**
 * Calculate FBM-specific costs (shipping)
 */
export const calculateFBMCost = (
  transactions: TransactionData[],
  config: MarketplaceConfig
): number => {
  return Math.abs(
    transactions
      .filter(d => d.categoryType === config.fbmShippingCategory)
      .reduce((sum, d) => {
        const value = d[config.fbmShippingSource as keyof TransactionData];
        return sum + (typeof value === 'number' ? value : 0);
      }, 0)
  );
};
