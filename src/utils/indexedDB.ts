// IndexedDB utility for Amazon Transaction Analyzer
// Stores transactions by marketplace with automatic deduplication

const DB_NAME = 'AmazonAnalyzerDB';
const DB_VERSION = 3; // New version for marketplace-based structure
const TRANSACTIONS_STORE = 'transactions';
const METADATA_STORE = 'marketplace_metadata';

// Transaction Data Type
export interface TransactionData {
  // Unique identifier for deduplication
  uniqueKey: string;

  // Core transaction fields
  id: string;
  fileName: string;
  date: Date;
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

  // Metadata
  uploadDate: Date;
  marketplaceCode: string; // US, UK, DE, etc.
}

// Marketplace Metadata
export interface MarketplaceMetadata {
  code: string; // US, UK, DE, FR, IT, ES, CA, AU, AE, SA
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

// For legacy compatibility
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

// Initialize IndexedDB with new structure
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Delete old stores if they exist
      if (db.objectStoreNames.contains('files')) {
        db.deleteObjectStore('files');
      }
      if (db.objectStoreNames.contains('transactionData')) {
        db.deleteObjectStore('transactionData');
      }

      // Create transactions store
      if (!db.objectStoreNames.contains(TRANSACTIONS_STORE)) {
        const transactionStore = db.createObjectStore(TRANSACTIONS_STORE, { keyPath: 'uniqueKey' });

        // Create indexes for efficient querying
        transactionStore.createIndex('marketplaceCode', 'marketplaceCode', { unique: false });
        transactionStore.createIndex('date', 'date', { unique: false });
        transactionStore.createIndex('categoryType', 'categoryType', { unique: false });
        transactionStore.createIndex('uploadDate', 'uploadDate', { unique: false });
      }

      // Create metadata store
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        const metadataStore = db.createObjectStore(METADATA_STORE, { keyPath: 'code' });
        metadataStore.createIndex('lastUpdate', 'lastUpdate', { unique: false });
      }

      console.log('✅ IndexedDB upgraded to marketplace-based structure');
    };
  });
};

// Generate unique key for transaction
export const generateUniqueKey = (transaction: Partial<TransactionData>): string => {
  const date = transaction.date instanceof Date ? transaction.date.toISOString() : String(transaction.date);
  const orderId = String(transaction.orderId || '').trim();
  const sku = String(transaction.sku || '').trim();
  const type = String(transaction.type || '').trim();
  const total = String(transaction.total || 0);

  // Create a hash-like unique key
  return `${date}-${orderId}-${sku}-${type}-${total}`.replace(/[^a-zA-Z0-9-_.]/g, '_');
};

// Save transactions to IndexedDB with deduplication
export interface SaveTransactionsResult {
  added: number;
  skipped: number;
  total: number;
}

export const saveTransactions = async (
  marketplaceCode: string,
  transactions: Partial<TransactionData>[],
  fileName: string
): Promise<SaveTransactionsResult> => {
  const db = await initDB();

  // Use object to avoid closure issues in loop
  const counters = { added: 0, skipped: 0 };

  return new Promise(async (resolve, reject) => {
    const transaction = db.transaction([TRANSACTIONS_STORE, METADATA_STORE], 'readwrite');
    const transactionStore = transaction.objectStore(TRANSACTIONS_STORE);
    const metadataStore = transaction.objectStore(METADATA_STORE);

    // Process each transaction
    const uploadDate = new Date();

    for (const trans of transactions) {
      const uniqueKey = generateUniqueKey(trans);

      // Check if already exists
      const existingRequest = transactionStore.get(uniqueKey);

      await new Promise<void>((resolveCheck) => {
        existingRequest.onsuccess = () => {
          if (existingRequest.result) {
            // Already exists, skip
            counters.skipped++;
            resolveCheck();
          } else {
            // New transaction, add it
            const fullTransaction: TransactionData = {
              ...trans as TransactionData,
              uniqueKey,
              uploadDate,
              marketplaceCode
            };

            const addRequest = transactionStore.add(fullTransaction);
            addRequest.onsuccess = () => {
              counters.added++;
              resolveCheck();
            };
            addRequest.onerror = () => {
              resolveCheck();
            };
          }
        };
        existingRequest.onerror = () => {
          resolveCheck();
        };
      });
    }

    // Update metadata
    const metadataRequest = metadataStore.get(marketplaceCode);
    metadataRequest.onsuccess = () => {
      let metadata: MarketplaceMetadata = metadataRequest.result;

      if (!metadata) {
        // Create new metadata
        const dates = transactions.map(t => t.date).filter(Boolean) as Date[];
        metadata = {
          code: marketplaceCode,
          name: marketplaceCode,
          transactionCount: counters.added,
          lastUpdate: uploadDate,
          dateRange: {
            start: new Date(Math.min(...dates.map(d => d.getTime()))),
            end: new Date(Math.max(...dates.map(d => d.getTime())))
          },
          uploadHistory: []
        };
      } else {
        // Update existing metadata
        metadata.transactionCount += counters.added;
        metadata.lastUpdate = uploadDate;

        // Update date range
        const dates = transactions.map(t => t.date).filter(Boolean) as Date[];
        if (dates.length > 0) {
          const newStart = new Date(Math.min(...dates.map(d => d.getTime())));
          const newEnd = new Date(Math.max(...dates.map(d => d.getTime())));

          if (newStart < metadata.dateRange.start) {
            metadata.dateRange.start = newStart;
          }
          if (newEnd > metadata.dateRange.end) {
            metadata.dateRange.end = newEnd;
          }
        }
      }

      // Add upload history
      metadata.uploadHistory.push({
        date: uploadDate,
        fileName,
        addedCount: counters.added,
        skippedCount: counters.skipped
      });

      // Keep only last 20 upload history entries
      if (metadata.uploadHistory.length > 20) {
        metadata.uploadHistory = metadata.uploadHistory.slice(-20);
      }

      metadataStore.put(metadata);
    };

    transaction.oncomplete = () => {
      resolve({ added: counters.added, skipped: counters.skipped, total: transactions.length });
    };

    transaction.onerror = () => reject(transaction.error);
  });
};

// Get all transactions for a marketplace
export const getTransactionsByMarketplace = async (marketplaceCode: string): Promise<TransactionData[]> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([TRANSACTIONS_STORE], 'readonly');
    const objectStore = transaction.objectStore(TRANSACTIONS_STORE);
    const index = objectStore.index('marketplaceCode');
    const request = index.getAll(marketplaceCode);

    request.onsuccess = () => {
      const transactions: TransactionData[] = request.result.map((trans: any) => ({
        ...trans,
        date: new Date(trans.date),
        uploadDate: new Date(trans.uploadDate)
      }));

      resolve(transactions);
    };
    request.onerror = () => reject(request.error);
  });
};

// Get all transactions (all marketplaces)
export const getAllTransactions = async (): Promise<TransactionData[]> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([TRANSACTIONS_STORE], 'readonly');
    const objectStore = transaction.objectStore(TRANSACTIONS_STORE);
    const request = objectStore.getAll();

    request.onsuccess = () => {
      const transactions: TransactionData[] = request.result.map((trans: any) => ({
        ...trans,
        date: new Date(trans.date),
        uploadDate: new Date(trans.uploadDate)
      }));

      resolve(transactions);
    };
    request.onerror = () => reject(request.error);
  });
};

// Get marketplace metadata
export const getMarketplaceMetadata = async (marketplaceCode: string): Promise<MarketplaceMetadata | null> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], 'readonly');
    const objectStore = transaction.objectStore(METADATA_STORE);
    const request = objectStore.get(marketplaceCode);

    request.onsuccess = () => {
      const metadata = request.result;
      if (metadata) {
        metadata.lastUpdate = new Date(metadata.lastUpdate);
        metadata.dateRange.start = new Date(metadata.dateRange.start);
        metadata.dateRange.end = new Date(metadata.dateRange.end);
        metadata.uploadHistory = metadata.uploadHistory.map((h: any) => ({
          ...h,
          date: new Date(h.date)
        }));
      }
      resolve(metadata || null);
    };
    request.onerror = () => reject(request.error);
  });
};

// Get all marketplace metadata
export const getAllMarketplaceMetadata = async (): Promise<MarketplaceMetadata[]> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], 'readonly');
    const objectStore = transaction.objectStore(METADATA_STORE);
    const request = objectStore.getAll();

    request.onsuccess = () => {
      const metadataList: MarketplaceMetadata[] = request.result.map((metadata: any) => ({
        ...metadata,
        lastUpdate: new Date(metadata.lastUpdate),
        dateRange: {
          start: new Date(metadata.dateRange.start),
          end: new Date(metadata.dateRange.end)
        },
        uploadHistory: metadata.uploadHistory.map((h: any) => ({
          ...h,
          date: new Date(h.date)
        }))
      }));

      // Sort by last update (newest first)
      metadataList.sort((a, b) => b.lastUpdate.getTime() - a.lastUpdate.getTime());

      resolve(metadataList);
    };
    request.onerror = () => reject(request.error);
  });
};

// Delete all transactions for a marketplace
export const deleteMarketplaceTransactions = async (marketplaceCode: string): Promise<number> => {
  const db = await initDB();

  return new Promise(async (resolve, reject) => {
    const transaction = db.transaction([TRANSACTIONS_STORE, METADATA_STORE], 'readwrite');
    const transactionStore = transaction.objectStore(TRANSACTIONS_STORE);
    const metadataStore = transaction.objectStore(METADATA_STORE);
    const index = transactionStore.index('marketplaceCode');

    let deletedCount = 0;

    // Get all transactions for this marketplace
    const getRequest = index.getAll(marketplaceCode);

    getRequest.onsuccess = () => {
      const transactions = getRequest.result;
      deletedCount = transactions.length;

      // Delete each transaction
      transactions.forEach((trans: any) => {
        transactionStore.delete(trans.uniqueKey);
      });

      // Delete metadata
      metadataStore.delete(marketplaceCode);

      transaction.oncomplete = () => {
        console.log(`✅ Deleted ${deletedCount} transactions from ${marketplaceCode}`);
        resolve(deletedCount);
      };
    };

    transaction.onerror = () => reject(transaction.error);
  });
};

// Clear all data
export const clearAllData = async (): Promise<void> => {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([TRANSACTIONS_STORE, METADATA_STORE], 'readwrite');
    const transactionStore = transaction.objectStore(TRANSACTIONS_STORE);
    const metadataStore = transaction.objectStore(METADATA_STORE);

    transactionStore.clear();
    metadataStore.clear();

    transaction.oncomplete = () => {
      console.log('✅ All data cleared');
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

// Get storage stats
export const getStorageStats = async (): Promise<{
  totalTransactions: number;
  byMarketplace: Record<string, { count: number; dateRange: { start: Date; end: Date } }>;
  lastUpdate: Date | null;
}> => {
  const metadataList = await getAllMarketplaceMetadata();

  const byMarketplace: Record<string, { count: number; dateRange: { start: Date; end: Date } }> = {};
  let totalTransactions = 0;
  let lastUpdate: Date | null = null;

  metadataList.forEach(metadata => {
    byMarketplace[metadata.code] = {
      count: metadata.transactionCount,
      dateRange: metadata.dateRange
    };
    totalTransactions += metadata.transactionCount;

    if (!lastUpdate || metadata.lastUpdate > lastUpdate) {
      lastUpdate = metadata.lastUpdate;
    }
  });

  return {
    totalTransactions,
    byMarketplace,
    lastUpdate
  };
};

// Format bytes to human readable size (keep for compatibility)
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

// Legacy compatibility: Get all files (convert metadata to file format)
export const getAllFiles = async (): Promise<StoredFileMetadata[]> => {
  const metadataList = await getAllMarketplaceMetadata();

  return metadataList.map(metadata => ({
    id: metadata.code,
    marketplace: metadata.code,
    fileName: `${metadata.code} - ${metadata.transactionCount} transactions`,
    uploadDate: metadata.lastUpdate,
    dataCount: metadata.transactionCount,
    dateRange: metadata.dateRange,
    sizeInBytes: 0 // Not applicable in new structure
  }));
};

// Legacy compatibility: Delete file
export const deleteFile = async (id: string): Promise<void> => {
  await deleteMarketplaceTransactions(id);
};

// Legacy compatibility: Load stored file
export const loadStoredFile = async (id: string): Promise<File | null> => {
  // Not applicable in new structure - transactions are loaded directly
  console.warn('loadStoredFile is deprecated - use getTransactionsByMarketplace instead');
  return null;
};

// Validation helpers (keep for compatibility)
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
  // In new structure, overlaps are handled automatically by deduplication
  return { hasOverlap: false, overlappingFiles: [] };
};

// ============================================
// JSON EXPORT/IMPORT (Persistent Backup)
// ============================================

export interface AnalyzerBackup {
  version: number;
  exportedAt: string;
  data: {
    transactions: TransactionData[];
    metadata: MarketplaceMetadata[];
  };
}

const BACKUP_VERSION = 1;
const AUTO_BACKUP_KEY = 'amazonAnalyzerAutoBackup';
const LAST_BACKUP_KEY = 'amazonAnalyzerLastBackup';

/**
 * Export all database data to JSON
 */
export const exportDatabaseToJSON = async (): Promise<AnalyzerBackup> => {
  const transactions = await getAllTransactions();
  const metadata = await getAllMarketplaceMetadata();

  const backup: AnalyzerBackup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      transactions,
      metadata,
    },
  };

  return backup;
};

/**
 * Import database from JSON backup
 */
export const importDatabaseFromJSON = async (backup: AnalyzerBackup, clearExisting: boolean = true): Promise<{
  imported: {
    transactions: number;
    metadata: number;
  };
}> => {
  const db = await initDB();

  const imported = {
    transactions: 0,
    metadata: 0,
  };

  // Clear existing data if requested
  if (clearExisting) {
    await clearAllData();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([TRANSACTIONS_STORE, METADATA_STORE], 'readwrite');
    const transactionStore = transaction.objectStore(TRANSACTIONS_STORE);
    const metadataStore = transaction.objectStore(METADATA_STORE);

    // Import transactions
    if (backup.data.transactions?.length > 0) {
      for (const trans of backup.data.transactions) {
        transactionStore.put({
          ...trans,
          date: new Date(trans.date),
          uploadDate: new Date(trans.uploadDate),
        });
        imported.transactions++;
      }
    }

    // Import metadata
    if (backup.data.metadata?.length > 0) {
      for (const meta of backup.data.metadata) {
        metadataStore.put({
          ...meta,
          lastUpdate: new Date(meta.lastUpdate),
          dateRange: {
            start: new Date(meta.dateRange.start),
            end: new Date(meta.dateRange.end),
          },
          uploadHistory: meta.uploadHistory.map(h => ({
            ...h,
            date: new Date(h.date),
          })),
        });
        imported.metadata++;
      }
    }

    transaction.oncomplete = () => {
      console.log('✅ Database imported from JSON backup');
      resolve({ imported });
    };

    transaction.onerror = () => reject(transaction.error);
  });
};

/**
 * Save backup to localStorage (auto-save)
 */
export const saveAutoBackup = async (): Promise<void> => {
  try {
    const backup = await exportDatabaseToJSON();
    const jsonString = JSON.stringify(backup);

    // Save to localStorage
    localStorage.setItem(AUTO_BACKUP_KEY, jsonString);
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());

    console.log('✅ Auto-backup saved to localStorage');
  } catch (error) {
    console.error('❌ Auto-backup failed:', error);
  }
};

/**
 * Load backup from localStorage (auto-load on startup)
 */
export const loadAutoBackup = async (): Promise<boolean> => {
  try {
    const jsonString = localStorage.getItem(AUTO_BACKUP_KEY);
    if (!jsonString) {
      console.log('ℹ️ No auto-backup found in localStorage');
      return false;
    }

    const backup = JSON.parse(jsonString) as AnalyzerBackup;

    // Check if IndexedDB is empty
    const currentTransactions = await getAllTransactions();

    // Only restore if IndexedDB is empty (browser was cleared)
    if (currentTransactions.length === 0) {
      await importDatabaseFromJSON(backup, true);
      console.log('✅ Auto-backup restored from localStorage');
      return true;
    }

    console.log('ℹ️ IndexedDB has data, skipping auto-restore');
    return false;
  } catch (error) {
    console.error('❌ Auto-backup load failed:', error);
    return false;
  }
};

/**
 * Get last backup timestamp
 */
export const getLastBackupTime = (): Date | null => {
  const timestamp = localStorage.getItem(LAST_BACKUP_KEY);
  return timestamp ? new Date(timestamp) : null;
};

/**
 * Download backup as JSON file
 */
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

/**
 * Import backup from file
 */
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

        const result = await importDatabaseFromJSON(backup, true);

        // Save to localStorage as well
        await saveAutoBackup();

        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};
