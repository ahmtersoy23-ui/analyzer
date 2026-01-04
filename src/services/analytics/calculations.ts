// Analytics Calculation Service
// Pure functions for Amazon transaction analysis

import { TransactionData, MarketplaceConfig, GroupData } from '../../types/transaction';
import { MARKETPLACE_CONFIGS } from '../../constants/marketplaces';
import type { MarketplaceCode } from '../../types/transaction';
import { convertCurrency, getMarketplaceCurrency } from '../../utils/currencyExchange';

/**
 * Consolidate small groups (abs total < threshold) into "Miscellaneous"
 * @param groups - Original grouped data
 * @param threshold - Amount threshold (default $10)
 * @returns Consolidated groups with small items merged
 */
export const consolidateSmallGroups = (
  groups: Record<string, GroupData>,
  threshold: number = 10
): Record<string, GroupData> => {
  const result: Record<string, GroupData> = {};
  let miscCount = 0;
  let miscTotal = 0;

  // Sort entries by absolute total (descending) to get consistent ordering
  const sortedEntries = Object.entries(groups).sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total));

  sortedEntries.forEach(([key, data]) => {
    if (Math.abs(data.total) < threshold) {
      miscCount += data.count;
      miscTotal += data.total;
    } else {
      result[key] = data;
    }
  });

  // Add Miscellaneous at the end (will appear last due to iteration order)
  if (miscCount > 0) {
    result['Miscellaneous'] = { count: miscCount, total: miscTotal };
  }

  return result;
};

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
 * Normalize adjustment descriptions across languages
 */
export const normalizeAdjustmentDescription = (description: string): string => {
  // Ensure description is a string (might be number from Excel)
  const descStr = description ? String(description) : '';
  if (!descStr || descStr.trim() === '') return 'Other';
  const lower = descStr.toLowerCase().trim();

  // Failed disbursement
  if (lower.includes('failed disbursement') ||
      lower.includes('fehlgeschlagene auszahlung') ||   // DE
      lower.includes('echec du versement') ||           // FR
      lower.includes('esborso non riuscito') ||         // IT
      lower.includes('desembolso fallido')) {           // ES
    return 'Failed disbursement';
  }

  // Buyer Recharge
  if (lower.includes('buyer recharge') ||
      lower.includes('käufer wiedereinzug') ||          // DE
      lower.includes('facturation du client') ||        // FR
      lower.includes('riaddebito acquirente') ||        // IT
      lower.includes('recargo al comprador')) {         // ES
    return 'Buyer Recharge';
  }

  // A-to-z Guarantee Recovery
  if (lower.includes('a-to-z guarantee recovery') ||
      lower.includes('recouvrement de la garantie a-à-z') ||  // FR
      lower.includes('rückforderung der a-bis-z') ||          // DE
      lower.includes('recupero garanzia dalla a alla z') ||   // IT
      lower.includes('recuperación de garantía de la a a la z')) { // ES
    return 'A-to-z Guarantee Recovery';
  }

  // Other (multi-language)
  if (lower === 'other' ||
      lower === 'autre' ||                              // FR
      lower === 'sonstiges' ||                          // DE
      lower === 'altro' ||                              // IT
      lower === 'otro') {                               // ES
    return 'Other';
  }

  // FBA Inventory Reimbursement standardization
  if (lower.includes('versand durch amazon erstattung') ||     // DE
      lower.includes('remboursement stock expédié par amazon')) { // FR
    // Extract the type and translate
    if (lower.includes('verloren') || lower.includes('lost') || lower.includes('perdu')) {
      if (lower.includes('auslieferung') || lower.includes('outbound')) {
        return 'FBA Inventory Reimbursement - Lost:Outbound';
      }
      return 'FBA Inventory Reimbursement - Lost:Warehouse';
    }
    if (lower.includes('beschädigt') || lower.includes('damaged') || lower.includes('endommagé')) {
      return 'FBA Inventory Reimbursement - Damaged:Warehouse';
    }
    if (lower.includes('allgemeine anpassung') || lower.includes('ajustement général') || lower.includes('general adjustment')) {
      return 'FBA Inventory Reimbursement - General Adjustment';
    }
    if (lower.includes('customer return') || lower.includes('kundenrücksendung') || lower.includes('retour client')) {
      return 'FBA Inventory Reimbursement - Customer Return';
    }
    return 'FBA Inventory Reimbursement - Other';
  }

  return descStr;  // Return the stringified description
};

/**
 * Normalize inventory fee descriptions across languages
 * @param description - The fee description text
 * @param orderId - Optional order ID (may contain shipment ID for carrier fees)
 */
export const normalizeInventoryFeeDescription = (description: string, orderId?: string): string => {
  // Ensure description is a string (might be number from Excel)
  const descStr = description ? String(description) : '';

  // Check for empty description with FBA shipment ID pattern (e.g., FBA194PTBZ6H)
  // These are Amazon-Partnered Carrier fees for inbound shipments
  if (!descStr || descStr.trim() === '') {
    if (orderId && /^FBA[0-9A-Z]+$/i.test(String(orderId).trim())) {
      return 'Partnered Carrier Fee';
    }
    return 'Other';
  }
  const lower = descStr.toLowerCase().trim();

  // FBA Amazon-Partnered Carrier Shipment Fee (all languages)
  if (lower.includes('partnered carrier') ||
      lower.includes('amazon-partnered carrier') ||
      lower.includes('carrier shipment fee') ||
      lower.includes('corriere convenzionato') ||           // IT: Corriere convenzionato Amazon
      lower.includes('transporteur partenaire') ||          // FR: Transporteur partenaire Amazon
      lower.includes('amazon-partnerversand') ||            // DE: Amazon-Partnerversand
      lower.includes('transportista asociado') ||           // ES: Transportista asociado de Amazon
      lower.includes('partnertransporteur') ||              // NL/BE
      lower.includes('frachtkosten für den transport') ||   // DE: Frachtkosten für den Transport zum Amazon-Versandzentrum
      lower.includes('transportpartner-programm')) {        // DE: Gebühr für die Teilnahme am Amazon Transportpartner-Programm
    return 'Partnered Carrier Fee';
  }

  // Long-Term Storage Fee (check first, before general storage)
  if (lower.includes('long-term storage') ||
      lower.includes('long term storage') ||
      lower.includes('fba long-term storage') ||
      lower.includes('stoccaggio a lungo termine') ||  // IT
      lower.includes('langzeitlagergebühr') ||         // DE
      lower.includes('stockage à long terme') ||       // FR
      lower.includes('almacenamiento a largo plazo') || // ES
      lower.includes('almacenamiento prolongado') ||   // ES: Tarifa por almacenamiento prolongado
      lower === 'long-term storage fee') {
    return 'Long-Term Storage Fee';
  }

  // Standard Storage Fee
  if (lower.includes('storage fee') ||
      (lower.includes('storage') && lower.includes('fee')) ||
      lower.includes('tariffa di stoccaggio') ||       // IT
      lower.includes('lagergebühr') ||                 // DE
      lower.includes('frais de stockage') ||           // FR
      lower.includes('tarifa de almacenamiento') ||    // ES
      lower.includes('tarifa por almacenamiento de logística')) {  // ES: Tarifa por almacenamiento de Logística de Amazon
    return 'Storage Fee';
  }

  // Disposal Fee
  if (lower.includes('disposal') ||
      lower.includes('removal order: disposal') ||     // FBA Removal Order: Disposal Fee / Fulfilment by Amazon removal order: disposal fee
      lower.includes('entsorgung') ||                  // DE
      lower.includes('élimination') ||                 // FR
      lower.includes('disposition expédié par amazon') ||  // FR: Frais de disposition Expédié par Amazon
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
      lower.includes('removal order: return') ||       // FBA Removal Order: Return Fee
      lower.includes('restituzione') ||                // IT
      lower.includes('retour') ||                      // FR
      lower.includes('rückgabe') ||                    // DE
      lower.includes('rücksendung') ||                 // DE: Versand durch Amazon Gebühr für Rücksendung
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

  return descStr;  // Return the stringified description
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
