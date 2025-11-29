/**
 * Helper functions for Transaction Analyzer
 * Includes parsing, normalization, and detection functions
 */

import type { MarketplaceCode } from '../../types/transaction';

/**
 * Normalize column name for matching
 */
export const normalizeColumnName = (name: string): string => {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/[_\s-]/g, '');
};

/**
 * Find column in headers with multi-language support
 */
export const findColumn = (headers: string[], possibleNames: string[]): string | null => {
  const normalizedHeaders = headers.map((h: string) => normalizeColumnName(h));

  // Önce exact match dene
  for (let name of possibleNames) {
    const normalized = normalizeColumnName(name);
    const index = normalizedHeaders.findIndex((h: string) => h === normalized);
    if (index !== -1) return headers[index];
  }

  // Exact match bulamazsa partial match dene
  for (let name of possibleNames) {
    const normalized = normalizeColumnName(name);
    const index = normalizedHeaders.findIndex((h: string) => h.includes(normalized) || normalized.includes(h));
    if (index !== -1) return headers[index];
  }

  return null;
};

/**
 * Detect fulfillment type from value (multi-language)
 */
export const detectFulfillment = (value: unknown): string => {
  if (!value) return 'Unknown';
  const str = String(value).toLowerCase();

  // FBA detection (multi-language)
  if (str.includes('amazon') || str.includes('afn')) return 'FBA';

  // FBM detection (multi-language)
  if (str.includes('seller') ||       // EN
      str.includes('merchant') ||     // EN
      str.includes('mfn') ||          // EN
      str.includes('verkäufer') ||    // DE
      str.includes('vendeur') ||      // FR
      str.includes('venditore') ||    // IT
      str.includes('vendedor')) {     // ES
    return 'FBM';
  }

  return 'Unknown';
};

/**
 * Categorize transaction type (multi-language)
 */
export const categorizeTransactionType = (type: unknown): string | null => {
  if (!type) return null;
  const typeStr = String(type).toLowerCase().trim();

  // Transfer transactions = Disbursement (multi-language)
  if ((typeStr.includes('transfer') ||        // EN
       typeStr.includes('übertrag') ||        // DE
       typeStr.includes('transfert') ||       // FR
       typeStr.includes('trasferimento') ||   // IT
       typeStr.includes('transferir')) &&     // ES
      !typeStr.includes('retrocharge')) {
    return 'Disbursement';
  }

  // Order (multi-language)
  if ((typeStr.includes('order') ||          // EN
       typeStr.includes('bestellung') ||     // DE
       typeStr.includes('commande') ||       // FR
       typeStr.includes('ordine') ||         // IT
       typeStr.includes('pedido')) &&        // ES
      !typeStr.includes('removal')) {
    return 'Order';
  }

  // Refund (multi-language)
  if ((typeStr.includes('refund') ||         // EN
       typeStr.includes('erstattung') ||     // DE
       typeStr.includes('remboursement') ||  // FR
       typeStr.includes('rimborso') ||       // IT
       typeStr.includes('reembolso')) &&     // ES
      !typeStr.includes('chargeback')) {
    return 'Refund';
  }

  // Adjustment (multi-language)
  if (typeStr.includes('adjustment') ||      // EN
      typeStr.includes('anpassung') ||       // DE
      typeStr.includes('ajustement') ||      // FR
      typeStr.includes('rettifica')) {       // IT
    return 'Adjustment';
  }

  // Amazon Fees
  if (typeStr.includes('amazon fees')) return 'Amazon Fees';

  // Chargeback Refund
  if (typeStr.includes('chargeback')) return 'Chargeback Refund';

  // FBA Inventory Fee (multi-language)
  if (typeStr.includes('fba inventory fee') ||
      typeStr.includes('fulfilment by amazon inventory fee') ||
      typeStr.includes('versand durch amazon lagergebühr') ||
      typeStr.includes('frais de stock expédié par amazon') ||
      typeStr.includes('costo di stoccaggio logistica di amazon') ||
      typeStr.includes('tarifas de inventario de logística de amazon')) {
    return 'FBA Inventory Fee';
  }

  // FBA Customer Return Fee
  if (typeStr.includes('fba customer return fee')) return 'FBA Customer Return Fee';

  // FBA Transaction Fee
  if (typeStr.includes('fba transaction fee')) return 'FBA Transaction Fee';

  // Fee Adjustment
  if (typeStr.includes('fee adjustment')) return 'Fee Adjustment';

  // SAFE-T Reimbursement
  if (typeStr.includes('safe-t') || typeStr.includes('safet')) return 'SAFE-T Reimbursement';

  // Shipping Services
  if (typeStr.includes('shipping services')) return 'Shipping Services';

  // Delivery Services (UK, FR, IT, ES)
  if (typeStr.includes('delivery services') || typeStr.includes('lieferdienste')) {
    return 'Delivery Services';
  }

  // Liquidations (multi-language)
  if (typeStr.includes('liquidations') ||
      typeStr.includes('liquidationen') ||
      typeStr.includes('liquidationsanpassungen')) {
    return 'Liquidations';
  }

  // Commingling VAT (UK)
  if (typeStr.includes('commingling vat')) return 'Commingling VAT';

  // Service Fee (multi-language)
  if (typeStr.includes('service fee') ||
      typeStr.includes('servicegebühr') ||
      typeStr.includes('frais de service') ||
      typeStr.includes('commissione di servizio') ||
      typeStr.includes('tarifa de prestación de servicio')) {
    return 'Service Fee';
  }

  // Others
  if (typeStr.includes('others')) return 'Others';

  return 'Other';
};

/**
 * Parse number from various formats (EN, DE, FR, IT, ES)
 */
export const parseNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  let str = String(value).trim();

  // Count dots and commas to determine format
  const dotCount = (str.match(/\./g) || []).length;
  const commaCount = (str.match(/,/g) || []).length;

  const lastDotIndex = str.lastIndexOf('.');
  const lastCommaIndex = str.lastIndexOf(',');

  if (commaCount > 0 && (dotCount === 0 || lastCommaIndex > lastDotIndex)) {
    // European format: comma is decimal separator
    str = str.replace(/[\s.]/g, '').replace(',', '.');
  } else {
    // English/US format: dot is decimal separator
    str = str.replace(/[\s,]/g, '');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

/**
 * Parse date from various formats
 */
export const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  try {
    let str = String(value).trim();

    // French month abbreviations
    const frenchMonths: Record<string, string> = {
      'janv': 'Jan', 'févr': 'Feb', 'mars': 'Mar', 'avr': 'Apr',
      'mai': 'May', 'juin': 'Jun', 'juil': 'Jul', 'août': 'Aug',
      'sept': 'Sep', 'oct': 'Oct', 'nov': 'Nov', 'déc': 'Dec'
    };

    for (const [fr, en] of Object.entries(frenchMonths)) {
      const regex = new RegExp(`\\b${fr}\\.?\\b`, 'gi');
      str = str.replace(regex, en);
    }

    // Italian month abbreviations
    const italianMonths: Record<string, string> = {
      'gen': 'Jan', 'feb': 'Feb', 'mar': 'Mar', 'apr': 'Apr',
      'mag': 'May', 'giu': 'Jun', 'lug': 'Jul', 'ago': 'Aug',
      'set': 'Sep', 'ott': 'Oct', 'nov': 'Nov', 'dic': 'Dec'
    };

    for (const [it, en] of Object.entries(italianMonths)) {
      const regex = new RegExp(`\\b${it}\\b`, 'gi');
      str = str.replace(regex, en);
    }

    // Fix Canadian format
    str = str.replace(/a,m,/gi, 'AM').replace(/p,m,/gi, 'PM');

    // Remove extra dots after months
    str = str.replace(/\b([A-Z][a-z]{2})\.\s+/g, '$1 ');

    // European format: DD.MM.YYYY
    const europeanMatch = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (europeanMatch) {
      const day = parseInt(europeanMatch[1], 10);
      const month = parseInt(europeanMatch[2], 10) - 1;
      const year = parseInt(europeanMatch[3], 10);

      const timeMatch = str.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})/);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1], 10);
        const minute = parseInt(timeMatch[2], 10);
        const second = parseInt(timeMatch[3], 10);
        return new Date(year, month, day, hour, minute, second);
      }

      return new Date(year, month, day);
    }

    // Default: Try standard JS date parsing
    const date = new Date(str);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

/**
 * Detect marketplace from URL
 */
export const detectMarketplace = (marketplaceValue: string): MarketplaceCode | null => {
  const normalized = marketplaceValue.toLowerCase().trim().replace(/,/g, '.');

  // Check more specific domains FIRST
  if (normalized.includes('amazon.com.au')) return 'AU';
  if (normalized.includes('amazon.co.uk')) return 'UK';
  if (normalized.includes('amazon.de')) return 'DE';
  if (normalized.includes('amazon.fr')) return 'FR';
  if (normalized.includes('amazon.it')) return 'IT';
  if (normalized.includes('amazon.es')) return 'ES';
  if (normalized.includes('amazon.ca')) return 'CA';
  if (normalized.includes('amazon.ae')) return 'AE';
  if (normalized.includes('amazon.sa')) return 'SA';
  // Check amazon.com LAST
  if (normalized.includes('amazon.com') || normalized.includes('www.amazon.com')) return 'US';

  return null;
};

/**
 * Translate description to English
 */
export const translateDescription = (desc: string): string => {
  if (!desc) return desc;

  const translations: Record<string, string> = {
    // German
    'werbekosten': 'Cost of Advertising',
    'versand durch amazon gebühr für entsorgung': 'FBA Disposal Fee',
    'versand durch amazon erstattung für lagerbestand': 'FBA Inventory Reimbursement',
    'versand durch amazon erstattung für lagerbestand - kundenrücksendung': 'FBA Inventory Reimbursement - Customer Return',
    'versand durch amazon lagergebühr': 'FBA Storage Fee',
    'fba-lagergebühr': 'FBA Storage Fee',
    'versand durch amazon langzeitlagergebühr': 'Long-Term Storage Fee',

    // French
    'frais de disposition expédié par amazon': 'FBA Disposal Fee',
    'prix de la publicité': 'Cost of Advertising',
    'remboursement de stock expédié par amazon': 'FBA Inventory Reimbursement',
    'remboursement stock expédié par amazon - retour client': 'FBA Inventory Reimbursement - Customer Return',
    'frais de stockage fba': 'FBA Storage Fee',
    'frais de stockage de longue durée expédié par amazon': 'Long-Term Storage Fee',

    // Italian
    'costo della pubblicità': 'Cost of Advertising',
    'tariffa per mettere l\'inventario a disposizione di amazon': 'FBA Inventory Fee',
    'rimborso inventario logistica di amazon': 'FBA Inventory Reimbursement',
    'tariffa di stoccaggio di logistica di amazon': 'FBA Storage Fee',
    'tariffa di stoccaggio a lungo termine logistica di amazon': 'Long-Term Storage Fee',

    // Spanish
    'gastos de publicidad': 'Cost of Advertising',
    'tarifa por devolución de inventario': 'Inventory Return Fee',
    'tarifa por eliminación de inventario': 'Inventory Disposal Fee',
    'reembolso de inventario de logística de amazon': 'FBA Inventory Reimbursement',
    'tarifa por almacenamiento de logística de amazon': 'FBA Storage Fee',
    'tarifa por almacenamiento prolongado': 'Long-Term Storage Fee',

    // Australian
    'fulfilment by amazon inventory fee': 'FBA Inventory Fee'
  };

  const lowerDesc = desc.toLowerCase().trim();
  return translations[lowerDesc] || desc;
};

/**
 * Format date in human readable format (Turkish style)
 */
export const formatDateHuman = (dt: Date): string => {
  if (!dt || isNaN(dt.getTime())) return "";
  const d = dt.getDate();
  const m = dt.getMonth() + 1;
  const y = dt.getFullYear();
  return `${d}.${m}.${y}`;
};

/**
 * Get column map for Excel parsing (multi-language)
 */
export const getColumnMap = (headers: string[]): Record<string, string | null> => {
  return {
    date: findColumn(headers, [
      'date/time', 'date', 'datetime', 'posted date',
      'datum/uhrzeit', 'date/heure', 'data/ora:', 'fecha y hora'
    ]),
    type: findColumn(headers, [
      'type', 'transaction type', 'typ', 'tipo'
    ]),
    orderId: findColumn(headers, [
      'order id', 'orderid', 'amazon order id',
      'bestellnummer', 'numéro de la commande', 'numero ordine', 'número de pedido'
    ]),
    sku: findColumn(headers, ['sku', 'seller sku']),
    description: findColumn(headers, [
      'description', 'desc', 'beschreibung', 'descrizione', 'descripción'
    ]),
    marketplace: findColumn(headers, [
      'marketplace', 'market', 'web de amazon'
    ]),
    fulfillment: findColumn(headers, [
      'fulfillment', 'fulfillment channel', 'fulfilment',
      'versand', 'traitement', 'gestione', 'gestión logística'
    ]),
    orderPostal: findColumn(headers, [
      'order postal', 'postal code', 'zip',
      'postleitzahl', 'code postal de la commande', 'cap dell\'ordine', 'código postal de procedencia del pedido'
    ]),
    quantity: findColumn(headers, [
      'quantity', 'qty', 'menge', 'quantité', 'quantità', 'cantidad'
    ]),
    productSalesTax: findColumn(headers, [
      'product sales tax', 'productsalestax', 'sales tax collection',
      'produktumsatzsteuer', 'taxes sur la vente des produits', 'imposta sulle vendite dei prodotti', 'impuesto de ventas de productos'
    ]),
    productSales: findColumn(headers, [
      'product sales', 'productsales', 'principal',
      'umsätze', 'ventes de produits', 'vendite', 'ventas de productos'
    ]),
    promotionalRebates: findColumn(headers, [
      'promotional rebates', 'promotions', 'promo',
      'rabatte aus werbeaktionen', 'rabais promotionnels', 'sconti promozionali', 'devoluciones promocionales'
    ]),
    sellingFees: findColumn(headers, [
      'selling fees', 'sellingfees', 'commission',
      'verkaufsgebühren', 'frais de vente', 'commissioni di vendita', 'tarifas de venta'
    ]),
    fbaFees: findColumn(headers, [
      'fba fees', 'fbafees', 'fulfillment fee', 'fulfilment by amazon fees',
      'gebühren zu versand durch amazon', 'frais expédié par amazon', 'costi del servizio logistica di amazon', 'tarifas de logística de amazon'
    ]),
    otherTransactionFees: findColumn(headers, [
      'other transaction fees', 'otherfees', 'other fees',
      'andere transaktionsgebühren', 'autres frais de transaction', 'altri costi relativi alle transazioni', 'tarifas de otras transacciones'
    ]),
    other: findColumn(headers, ['other', 'andere', 'autre', 'altro', 'otro']),
    marketplaceWithheldTax: findColumn(headers, [
      'marketplace withheld tax', 'tax withheld', 'vat withheld',
      'einbehaltene steuer auf marketplace', 'taxes retenues sur le site de vente', 'trattenuta iva del marketplace', 'impuesto retenido en el sitio web'
    ]),
    total: findColumn(headers, [
      'total', 'net proceeds', 'net amount',
      'gesamt', 'totale'
    ])
  };
};
