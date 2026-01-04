/**
 * Transaction Storage - PostgreSQL API based storage
 * Replaces IndexedDB with server-side storage
 * Maintains same interface for minimal code changes
 */

import {
  fetchTransactions,
  saveTransactions as apiSaveTransactions,
  fetchTransactionStats,
  deleteAllTransactions,
  deleteTransactionsByFile,
  TransactionApiData,
} from '../services/api/configApi';
import { logger } from './logger';

// Re-export types for compatibility
export interface TransactionData {
  id: string;
  fileName: string;
  date: Date;
  dateOnly: string;
  type: string;
  categoryType: string;
  orderId: string;
  sku: string;
  description: string;
  descriptionLower: string;
  marketplace: string;
  fulfillment: string;
  orderPostal: string;
  quantity: number;
  productSales: number;
  promotionalRebates: number;
  sellingFees: number;
  fbaFees: number;
  otherTransactionFees: number;
  other: number;
  vat: number;
  liquidations: number;
  total: number;
  marketplaceCode: string;

  // Product enrichment fields (from PriceLab API)
  // NOTE: Using 'productCategory' to avoid conflict with 'categoryType' (transaction category)
  asin?: string;
  name?: string;
  parent?: string;
  productCategory?: string;
  productCost?: number | null;    // Ürün maliyeti
  productSize?: number | null;    // Desi (hacimsel ağırlık)
  productCustomShipping?: number | null;  // SKU bazlı özel kargo (USD)
  productFbmSource?: string | null;       // TR, LOCAL, BOTH
}

export interface MarketplaceMetadata {
  code: string;
  name: string;
  transactionCount: number;
  lastUpdate: Date;
  dateRange: {
    start: Date;
    end: Date;
  };
  uploadHistory: {
    date: Date;
    fileName: string;
    addedCount: number;
    skippedCount: number;
  }[];
}

export interface StoredFileMetadata {
  id: string;
  marketplace: string;
  fileName: string;
  uploadDate: Date;
  dataCount: number;
  dateRange: {
    start: Date;
    end: Date;
  };
  sizeInBytes: number;
}

export interface SaveTransactionsResult {
  added: number;
  skipped: number;
  total: number;
}

// Generate unique key for transaction (same logic as IndexedDB)
export const generateUniqueKey = (transaction: Partial<TransactionData>): string => {
  const date = transaction.date instanceof Date ? transaction.date.toISOString() : String(transaction.date);
  const orderId = String(transaction.orderId || '').trim();
  const sku = String(transaction.sku || '').trim();
  const type = String(transaction.type || '').trim();
  const total = String(transaction.total || 0);
  return `${date}-${orderId}-${sku}-${type}-${total}`.replace(/[^a-zA-Z0-9-_.]/g, '_');
};

// Helper to extract YYYY-MM-DD from date string or timestamp
const extractDateOnly = (value: any): string => {
  if (!value) return '';
  const str = String(value);
  // If already YYYY-MM-DD format
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  // Try to parse as Date
  try {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // ignore
  }
  return '';
};

// Convert API data to TransactionData format
// Note: PostgreSQL returns lowercase field names, so we handle both cases
const apiToTransactionData = (apiData: any): TransactionData => ({
  id: apiData.id || '',
  fileName: apiData.fileName || apiData.filename || '',
  date: new Date(apiData.date),
  dateOnly: extractDateOnly(apiData.dateOnly || apiData.dateonly),
  type: apiData.type || '',
  categoryType: apiData.categoryType || apiData.categorytype || '',
  orderId: apiData.orderId || apiData.orderid || '',
  sku: apiData.sku || '',
  description: apiData.description || '',
  descriptionLower: (apiData.description || '').toLowerCase(),
  marketplace: apiData.marketplace || '',
  fulfillment: apiData.fulfillment || '',
  orderPostal: apiData.orderPostal || apiData.orderpostal || '',
  quantity: Number(apiData.quantity) || 0,
  productSales: Number(apiData.productSales || apiData.productsales) || 0,
  promotionalRebates: Number(apiData.promotionalRebates || apiData.promotionalrebates) || 0,
  sellingFees: Number(apiData.sellingFees || apiData.sellingfees) || 0,
  fbaFees: Number(apiData.fbaFees || apiData.fbafees) || 0,
  otherTransactionFees: Number(apiData.otherTransactionFees || apiData.othertransactionfees) || 0,
  other: Number(apiData.other) || 0,
  vat: Number(apiData.vat) || 0,
  liquidations: Number(apiData.liquidations) || 0,
  total: Number(apiData.total) || 0,
  marketplaceCode: apiData.marketplaceCode || apiData.marketplacecode || '',
});

// Convert TransactionData to API format
const transactionToApiData = (t: Partial<TransactionData>): TransactionApiData => ({
  id: t.id || generateUniqueKey(t),
  fileName: t.fileName || '',
  date: t.date instanceof Date ? t.date.toISOString() : String(t.date || ''),
  dateOnly: t.dateOnly || '',
  type: t.type || '',
  categoryType: t.categoryType || '',
  orderId: t.orderId || '',
  sku: t.sku || '',
  description: t.description || '',
  marketplace: t.marketplace || '',
  fulfillment: t.fulfillment || '',
  orderPostal: t.orderPostal || '',
  quantity: t.quantity || 0,
  productSales: t.productSales || 0,
  promotionalRebates: t.promotionalRebates || 0,
  sellingFees: t.sellingFees || 0,
  fbaFees: t.fbaFees || 0,
  otherTransactionFees: t.otherTransactionFees || 0,
  other: t.other || 0,
  vat: t.vat || 0,
  liquidations: t.liquidations || 0,
  total: t.total || 0,
  marketplaceCode: t.marketplaceCode || '',
});

/**
 * Save transactions to PostgreSQL via API
 */
export const saveTransactions = async (
  marketplaceCode: string,
  transactions: Partial<TransactionData>[],
  fileName: string
): Promise<SaveTransactionsResult> => {
  logger.log(`[TransactionStorage] Saving ${transactions.length} transactions for ${marketplaceCode}...`);

  // Prepare transactions with IDs
  const apiTransactions = transactions.map(t => {
    const id = generateUniqueKey(t);
    return transactionToApiData({
      ...t,
      id,
      fileName,
      marketplaceCode,
    });
  });

  try {
    // Send to API in chunks (5000 at a time to avoid timeout)
    const CHUNK_SIZE = 5000;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    for (let i = 0; i < apiTransactions.length; i += CHUNK_SIZE) {
      const chunk = apiTransactions.slice(i, i + CHUNK_SIZE);
      logger.log(`[TransactionStorage] Sending chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(apiTransactions.length / CHUNK_SIZE)}...`);

      const result = await apiSaveTransactions(chunk);
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      totalErrors += result.errors;
    }

    logger.log(`[TransactionStorage] Complete: ${totalInserted} inserted, ${totalUpdated} updated, ${totalErrors} errors`);

    return {
      added: totalInserted,
      skipped: totalUpdated, // Updated = already existed = skipped
      total: transactions.length,
    };
  } catch (error) {
    console.error('[TransactionStorage] Error saving transactions:', error);
    throw error;
  }
};

/**
 * Get all transactions for a specific marketplace
 */
export const getTransactionsByMarketplace = async (marketplaceCode: string): Promise<TransactionData[]> => {
  logger.log(`[TransactionStorage] Fetching transactions for ${marketplaceCode}...`);

  try {
    const result = await fetchTransactions({ marketplace: marketplaceCode, limit: 500000 });
    const transactions = result.data.map(apiToTransactionData);
    logger.log(`[TransactionStorage] Fetched ${transactions.length} transactions for ${marketplaceCode}`);
    return transactions;
  } catch (error) {
    console.error('[TransactionStorage] Error fetching transactions:', error);
    return [];
  }
};

/**
 * Get all transactions (all marketplaces)
 */
export const getAllTransactions = async (): Promise<TransactionData[]> => {
  logger.log('[TransactionStorage] Fetching all transactions...');

  try {
    const result = await fetchTransactions({ limit: 500000 });
    const transactions = result.data.map(apiToTransactionData);
    logger.log(`[TransactionStorage] Fetched ${transactions.length} total transactions`);
    return transactions;
  } catch (error) {
    console.error('[TransactionStorage] Error fetching all transactions:', error);
    return [];
  }
};

/**
 * Get marketplace metadata from stats
 */
export const getMarketplaceMetadata = async (marketplaceCode: string): Promise<MarketplaceMetadata | null> => {
  try {
    const stats = await fetchTransactionStats();
    const mpStats = stats.byMarketplace.find(m => m.marketplace_code === marketplaceCode);

    if (!mpStats) return null;

    return {
      code: marketplaceCode,
      name: marketplaceCode,
      transactionCount: parseInt(String(mpStats.count)),
      lastUpdate: new Date(),
      dateRange: {
        start: new Date(mpStats.min_date),
        end: new Date(mpStats.max_date),
      },
      uploadHistory: [],
    };
  } catch (error) {
    console.error('[TransactionStorage] Error fetching marketplace metadata:', error);
    return null;
  }
};

/**
 * Get all marketplace metadata
 */
export const getAllMarketplaceMetadata = async (): Promise<MarketplaceMetadata[]> => {
  try {
    const stats = await fetchTransactionStats();

    return stats.byMarketplace.map(mp => ({
      code: mp.marketplace_code,
      name: mp.marketplace_code,
      transactionCount: parseInt(String(mp.count)),
      lastUpdate: new Date(),
      dateRange: {
        start: new Date(mp.min_date),
        end: new Date(mp.max_date),
      },
      uploadHistory: [],
    }));
  } catch (error) {
    console.error('[TransactionStorage] Error fetching all marketplace metadata:', error);
    return [];
  }
};

/**
 * Delete all transactions for a marketplace
 */
export const deleteMarketplaceTransactions = async (marketplaceCode: string): Promise<number> => {
  // Note: Current API doesn't support marketplace-specific deletion
  // For now, this would need a new endpoint
  console.warn('[TransactionStorage] deleteMarketplaceTransactions not fully implemented yet');
  return 0;
};

/**
 * Clear all data
 */
export const clearAllData = async (): Promise<void> => {
  logger.log('[TransactionStorage] Clearing all data...');
  await deleteAllTransactions();
  logger.log('[TransactionStorage] All data cleared');
};

/**
 * Get storage stats
 */
export const getStorageStats = async (): Promise<{
  totalTransactions: number;
  byMarketplace: Record<string, { count: number; dateRange: { start: Date; end: Date } }>;
  lastUpdate: Date | null;
}> => {
  try {
    const stats = await fetchTransactionStats();

    const byMarketplace: Record<string, { count: number; dateRange: { start: Date; end: Date } }> = {};

    for (const mp of stats.byMarketplace) {
      byMarketplace[mp.marketplace_code] = {
        count: parseInt(String(mp.count)),
        dateRange: {
          start: new Date(mp.min_date),
          end: new Date(mp.max_date),
        },
      };
    }

    return {
      totalTransactions: stats.total,
      byMarketplace,
      lastUpdate: stats.maxDate ? new Date(stats.maxDate) : null,
    };
  } catch (error) {
    console.error('[TransactionStorage] Error fetching storage stats:', error);
    return {
      totalTransactions: 0,
      byMarketplace: {},
      lastUpdate: null,
    };
  }
};

// Legacy compatibility functions
export const getAllFiles = async (): Promise<StoredFileMetadata[]> => {
  const metadataList = await getAllMarketplaceMetadata();

  return metadataList.map(metadata => ({
    id: metadata.code,
    marketplace: metadata.code,
    fileName: `${metadata.code} - ${metadata.transactionCount} transactions`,
    uploadDate: metadata.lastUpdate,
    dataCount: metadata.transactionCount,
    dateRange: metadata.dateRange,
    sizeInBytes: 0,
  }));
};

export const deleteFile = async (id: string): Promise<void> => {
  await deleteMarketplaceTransactions(id);
};

export const loadStoredFile = async (id: string): Promise<File | null> => {
  console.warn('[TransactionStorage] loadStoredFile is deprecated');
  return null;
};

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const validateMarketplaceData = (
  expectedMarketplace: string,
  transactionsData: any[]
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!transactionsData || transactionsData.length === 0) {
    errors.push('Dosya boş veya okunamadı');
    return { isValid: false, errors, warnings };
  }

  return { isValid: true, errors, warnings };
};

export const checkDateRangeOverlap = async (
  marketplace: string,
  newStart: Date,
  newEnd: Date
): Promise<{ hasOverlap: boolean; overlappingFiles: any[] }> => {
  return { hasOverlap: false, overlappingFiles: [] };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

// Migration helper - imports from old IndexedDB
export const migrateFromIndexedDB = async (): Promise<{
  migrated: number;
  errors: number;
}> => {
  // Import old IndexedDB functions dynamically to avoid circular deps
  const oldDB = await import('./indexedDB');

  logger.log('[TransactionStorage] Starting migration from IndexedDB...');

  try {
    const allTransactions = await oldDB.getAllTransactions();

    if (allTransactions.length === 0) {
      logger.log('[TransactionStorage] No transactions to migrate');
      return { migrated: 0, errors: 0 };
    }

    logger.log(`[TransactionStorage] Migrating ${allTransactions.length} transactions...`);

    // Group by marketplace for progress tracking
    const byMarketplace = new Map<string, typeof allTransactions>();
    for (const t of allTransactions) {
      const mp = t.marketplaceCode || 'UNKNOWN';
      if (!byMarketplace.has(mp)) {
        byMarketplace.set(mp, []);
      }
      byMarketplace.get(mp)!.push(t);
    }

    let totalMigrated = 0;
    let totalErrors = 0;

    const entries = Array.from(byMarketplace.entries());
    for (let i = 0; i < entries.length; i++) {
      const [marketplace, transactions] = entries[i];
      logger.log(`[TransactionStorage] Migrating ${marketplace}: ${transactions.length} transactions`);

      try {
        const result = await saveTransactions(marketplace, transactions, 'migration');
        totalMigrated += result.added;
      } catch (err) {
        console.error(`[TransactionStorage] Error migrating ${marketplace}:`, err);
        totalErrors += transactions.length;
      }
    }

    logger.log(`[TransactionStorage] Migration complete: ${totalMigrated} migrated, ${totalErrors} errors`);

    return { migrated: totalMigrated, errors: totalErrors };
  } catch (error) {
    console.error('[TransactionStorage] Migration failed:', error);
    throw error;
  }
};

// Export/Import for backup (same interface as IndexedDB)
export interface AnalyzerBackup {
  version: number;
  exportedAt: string;
  data: {
    transactions: TransactionData[];
    metadata: MarketplaceMetadata[];
  };
}

export const exportDatabaseToJSON = async (): Promise<AnalyzerBackup> => {
  const transactions = await getAllTransactions();
  const metadata = await getAllMarketplaceMetadata();

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      transactions,
      metadata,
    },
  };
};

export const downloadBackupFile = async (): Promise<void> => {
  const backup = await exportDatabaseToJSON();
  const jsonString = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  const filename = `amazon-analyzer-backup-${date}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importBackupFile = async (file: File): Promise<{
  imported: {
    transactions: number;
    metadata: number;
  };
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const jsonString = e.target?.result as string;
        const backup = JSON.parse(jsonString) as AnalyzerBackup;

        // Validate backup structure
        if (!backup.version || !backup.data) {
          throw new Error('Invalid backup file format');
        }

        // Group transactions by marketplace
        const byMarketplace = new Map<string, TransactionData[]>();
        for (const t of backup.data.transactions) {
          const mp = t.marketplaceCode || 'UNKNOWN';
          if (!byMarketplace.has(mp)) {
            byMarketplace.set(mp, []);
          }
          byMarketplace.get(mp)!.push(t);
        }

        let totalImported = 0;
        const importEntries = Array.from(byMarketplace.entries());
        for (let i = 0; i < importEntries.length; i++) {
          const [marketplace, transactions] = importEntries[i];
          const result = await saveTransactions(marketplace, transactions, 'backup-import');
          totalImported += result.added;
        }

        resolve({
          imported: {
            transactions: totalImported,
            metadata: backup.data.metadata?.length || 0,
          },
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};
