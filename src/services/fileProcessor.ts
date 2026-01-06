/**
 * File Processor Service
 * Handles Excel file parsing and transaction data extraction
 */

import * as XLSX from 'xlsx';
import type { MarketplaceCode, TransactionData, MarketplaceConfig } from '../types/transaction';
import { MARKETPLACE_CONFIGS } from '../constants/marketplaces';
import {
  findColumn,
  detectFulfillment,
  categorizeTransactionType,
  parseNumber,
  parseDate,
  extractDateOnly,
  extractTimeOnly,
  detectMarketplace,
} from '../components/transaction-analyzer/helpers';

/**
 * Detect marketplace from an Excel file's first few rows
 */
export const detectMarketplaceFromFile = async (file: File): Promise<MarketplaceCode | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

        // Find header row with multi-language support
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
          const row = jsonData[i];
          if (row && Array.isArray(row) && row.some((cell) => {
            const normalized = String(cell).toLowerCase();
            return normalized.includes('marketplace') ||
                   normalized.includes('web de amazon') ||
                   normalized.includes('market');
          })) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          resolve(null);
          return;
        }

        const headers = jsonData[headerRowIndex] as string[];
        const marketplaceColIndex = headers.findIndex(h => {
          const normalized = String(h).toLowerCase();
          return normalized.includes('marketplace') ||
                 normalized.includes('web de amazon') ||
                 normalized.includes('market');
        });

        if (marketplaceColIndex === -1) {
          resolve(null);
          return;
        }

        // Detect marketplace from first few data rows
        for (let i = headerRowIndex + 1; i < Math.min(headerRowIndex + 10, jsonData.length); i++) {
          const row = jsonData[i] as unknown[];
          if (row && row[marketplaceColIndex]) {
            const detected = detectMarketplace(String(row[marketplaceColIndex]));
            if (detected) {
              resolve(detected);
              return;
            }
          }
        }

        resolve(null);
      } catch {
        resolve(null);
      }
    };
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Process an Excel file and extract transaction data
 */
export const processExcelFile = async (
  file: File,
  detectedMarketplace?: MarketplaceCode
): Promise<TransactionData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const fileConfig = detectedMarketplace ? MARKETPLACE_CONFIGS[detectedMarketplace] : null;

        if (!fileConfig) {
          throw new Error('Marketplace tespit edilemedi');
        }

        if (!e.target?.result) throw new Error('Dosya okunamadı');
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
          const row = jsonData[i];
          if (row && Array.isArray(row) && row.length > 5 && row.some((cell) =>
            String(cell).toLowerCase().includes('date') ||
            String(cell).toLowerCase().includes('type') ||
            String(cell).toLowerCase().includes('sku')
          )) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          throw new Error('Header satırı bulunamadı');
        }

        const headers = jsonData[headerRowIndex] as string[];
        const dataRows = jsonData.slice(headerRowIndex + 1).filter((row) =>
          row && Array.isArray(row) && row.length > 0 && row.some((cell) => cell !== '' && cell !== null)
        ) as unknown[][];

        // Multi-language column mapping
        const columnMap = buildColumnMap(headers);

        const processedData: TransactionData[] = dataRows.map((row, index) => {
          return processRow(row, index, headers, columnMap, fileConfig, file.name, detectedMarketplace);
        }).filter((item): item is TransactionData => item !== null && item.date !== null);

        resolve(processedData);
      } catch (err) {
        reject(new Error(`Dosya işlenirken hata: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`));
      }
    };

    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Build column mapping for multi-language Excel files
 */
function buildColumnMap(headers: string[]): Record<string, string | null> {
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
}

/**
 * Process a single row from the Excel file
 */
function processRow(
  row: unknown[],
  index: number,
  headers: string[],
  columnMap: Record<string, string | null>,
  fileConfig: MarketplaceConfig,
  fileName: string,
  detectedMarketplace?: MarketplaceCode
): TransactionData | null {
  const getCell = (colName: string): unknown => {
    if (!columnMap[colName]) return null;
    const colIndex = headers.indexOf(columnMap[colName]!);
    return colIndex !== -1 ? row[colIndex] : null;
  };

  const typeValue = getCell('type') as string | null;
  const categoryType = categorizeTransactionType(typeValue);

  if (categoryType === null) return null;

  const description = String(getCell('description') || '').trim();
  const descriptionLower = description.toLowerCase();

  const productSalesValue = parseNumber(getCell('productSales'));
  const productSalesTaxValue = parseNumber(getCell('productSalesTax'));

  // VAT calculation for UK
  let vat = 0;
  if (fileConfig.hasVAT) {
    vat = productSalesTaxValue;
  }

  // Liquidations for UK
  const liquidations = (fileConfig.hasLiquidations && typeValue === 'Liquidations')
    ? parseNumber(getCell('total'))
    : 0;

  const other = parseNumber(getCell('other'));

  // Marketplace info
  const marketplaceValue = getCell('marketplace') as string | null;
  const finalMarketplace = marketplaceValue || (detectedMarketplace ? `Amazon.${detectedMarketplace.toLowerCase()}` : 'Unknown');

  const rowMarketplaceCode = marketplaceValue ? detectMarketplace(marketplaceValue) : null;
  const finalMarketplaceCode = rowMarketplaceCode || detectedMarketplace || '';

  const rawDateValue = getCell('date');
  const parsedDate = parseDate(rawDateValue);

  if (!parsedDate) return null;

  return {
    id: `${fileName}-${index}`,
    fileName: fileName,
    date: parsedDate,
    dateOnly: extractDateOnly(rawDateValue),
    timeOnly: extractTimeOnly(rawDateValue),
    type: String(typeValue || ''),
    categoryType,
    orderId: String(getCell('orderId') || ''),
    sku: String(getCell('sku') || ''),
    description,
    descriptionLower,
    marketplace: finalMarketplace,
    marketplaceCode: finalMarketplaceCode,
    fulfillment: detectFulfillment(getCell('fulfillment')),
    orderPostal: String(getCell('orderPostal') || ''),
    quantity: parseNumber(getCell('quantity')),
    productSales: fileConfig.grossSalesFormula(productSalesValue, productSalesTaxValue),
    promotionalRebates: parseNumber(getCell('promotionalRebates')),
    sellingFees: parseNumber(getCell('sellingFees')),
    fbaFees: parseNumber(getCell('fbaFees')),
    otherTransactionFees: parseNumber(getCell('otherTransactionFees')),
    other,
    vat,
    liquidations,
    total: parseNumber(getCell('total'))
  };
}
