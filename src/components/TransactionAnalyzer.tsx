import React, { useState, useMemo, useEffect } from 'react';
import { Upload, FileSpreadsheet, Package, RefreshCw, AlertCircle, Save, Database, Trash2, Sparkles, ChevronDown, ChevronUp, BarChart3, Download, FolderUp } from 'lucide-react';
import * as DB from '../utils/indexedDB';
import { exportTransactionsToExcel } from '../utils/excelExport';
import { getMarketplaceCurrency, CURRENCY_SYMBOLS } from '../utils/currencyExchange';
import type { MarketplaceCode, TransactionData, MarketplaceConfig } from '../types/transaction';
import { MARKETPLACE_CONFIGS, ZONE_NAMES } from '../constants/marketplaces';
import { calculateAnalytics } from '../services/analytics/analyticsEngine';
import { processExcelFile, detectMarketplaceFromFile } from '../services/fileProcessor';
import AdvancedDashboard from './dashboard/AdvancedDashboard';
import { fetchProductMapping, createProductMap, enrichTransaction } from '../services/productMapping';

// Import extracted helpers and components
import { formatDateHuman, translateDescription } from './transaction-analyzer/helpers';
import { PieChart } from './transaction-analyzer/PieChart';
import { SummaryCards } from './transaction-analyzer/SummaryCards';
import { TransactionFilters } from './transaction-analyzer/TransactionFilters';
import { OrderDetailsCards } from './transaction-analyzer/OrderDetailsCards';
import { FulfillmentStatsCards } from './transaction-analyzer/FulfillmentStatsCards';
import { FeeDetailsSection } from './transaction-analyzer/FeeDetailsSection';
// Note: PostalZoneMap is extracted but currently inline due to zone data handling
// import { PostalZoneMap } from './transaction-analyzer/PostalZoneMap';

// Component-specific types that aren't in shared types
interface TransactionAnalyzerProps {
  onDataLoaded?: (data: TransactionData[]) => void;
}

// Legacy: Keep CONFIGS alias for backwards compatibility during refactor
const CONFIGS = MARKETPLACE_CONFIGS;

// Removed duplicate type/constant definitions - now imported from:
// - types/transaction.ts: MarketplaceCode, TransactionData, MarketplaceConfig, GroupData, PostalZone
// - constants/marketplaces.ts: MARKETPLACE_CONFIGS, ZONE_NAMES

// LEGACY_ZONE_NAMES moved to constants/marketplaces.ts - use ZONE_NAMES instead

// PostalZoneMap moved to ./transaction-analyzer/PostalZoneMap.tsx

interface TransactionSavedFilters {
  marketplaceCode?: MarketplaceCode | null;
  startDate?: string;
  endDate?: string;
  dateRange?: { start: string; end: string };
  selectedFulfillment?: string;
  comparisonMode?: 'none' | 'previous-period' | 'previous-year';
}

const AmazonTransactionAnalyzer: React.FC<TransactionAnalyzerProps> = ({
  onDataLoaded
}) => {
  // Load saved filters from localStorage (only on initial mount)
  const loadSavedFilters = (): TransactionSavedFilters => {
    try {
      const saved = localStorage.getItem('amazonAnalyzerFilters');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const [marketplaceCode, setMarketplaceCode] = useState<MarketplaceCode | null>(() => {
    const saved = loadSavedFilters();
    return saved.marketplaceCode || null;
  });

  // "Tümü" modunda varsayılan config (tüm marketplacelar için genel ayarlar)
  // IMPORTANT: Memoize config to prevent infinite re-renders
  const config = useMemo(() => {
    return marketplaceCode ? CONFIGS[marketplaceCode] : {
      code: 'ALL',
      name: 'Tümü',
      currency: 'Mixed',
      currencySymbol: '',
      hasVAT: true,  // Tümü modunda VAT göster (bazı ülkelerde var)
      vatIncludedInPrice: true,  // FIXED: Tümü modunda comparison için VAT dahil et
      refundRecoveryRate: 0.20,
      grossSalesFormula: (s: number, v: number) => s,
      hasLiquidations: false,
      fbmShippingCategory: 'Shipping Services',
      fbmShippingSource: 'total',
      hasPostalZones: false,
    } as const;
  }, [marketplaceCode]);
  // Removed: const [files, setFiles] - we now use storedFiles (marketplace metadata) instead
  const [allData, setAllData] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const saved = loadSavedFilters();
    return saved.dateRange || { start: '', end: '' };
  });
  const [selectedFulfillment, setSelectedFulfillment] = useState<string>(() => {
    const saved = loadSavedFilters();
    return saved.selectedFulfillment || 'all';
  });
  const [comparisonMode, setComparisonMode] = useState<'none' | 'previous-period' | 'previous-year'>(() => {
    const saved = loadSavedFilters();
    return saved.comparisonMode || 'none';
  });

  // IndexedDB states
  const [storedFiles, setStoredFiles] = useState<DB.StoredFileMetadata[]>([]);
  const [saveToDBAfterLoad, setSaveToDBAfterLoad] = useState<boolean>(true);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Currency display - auto based on marketplace (USD for 'all', native for specific)
  // Removed manual selection - now automatic like ProductAnalyzer

  // Comparison modal state
  type ComparisonDetailType = 'adjustments' | 'inventory' | 'service' | 'fbaCostBreakdown';
  const [comparisonDetailOpen, setComparisonDetailOpen] = useState<boolean>(false);
  const [comparisonDetailType, setComparisonDetailType] = useState<ComparisonDetailType | null>(null);

  // Advanced Dashboard toggle
  const [showAdvancedDashboard, setShowAdvancedDashboard] = useState<boolean>(false);

  // Collapsible sections
  const [showFileUpload, setShowFileUpload] = useState<boolean>(false);
  const [showStoredMarketplaces, setShowStoredMarketplaces] = useState<boolean>(false);
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState<boolean>(false);

  // Her marketplace için native currency'yi belirle
  const nativeCurrency = useMemo(() => {
    if (!marketplaceCode) {
      // Birden fazla marketplace varsa, ilk marketplace'in currency'sini kullan
      if (allData.length > 0) {
        const firstMarketplace = allData[0].marketplace;
        const code = Object.entries(CONFIGS).find(([_, cfg]) =>
          firstMarketplace.toLowerCase().includes(cfg.code.toLowerCase())
        )?.[0] as MarketplaceCode | undefined;
        return code ? getMarketplaceCurrency(code) : null;
      }
      return null;
    }
    return getMarketplaceCurrency(marketplaceCode);
  }, [marketplaceCode, allData]);

  const formatMoney = (value: number): string => {
    if (value === null || value === undefined || isNaN(value)) return '$0';

    // Auto currency: USD for 'all' marketplaces, native for specific marketplace
    // This matches ProductAnalyzer behavior
    const targetCurrency = marketplaceCode ? nativeCurrency : 'USD';

    // Format with appropriate currency symbol
    const currencyToUse = targetCurrency || 'USD';
    const symbol = CURRENCY_SYMBOLS[currencyToUse];

    const absValue = Math.abs(value);
    if (absValue >= 100) {
      return `${symbol}${value.toFixed(0)}`;
    }
    return `${symbol}${value.toFixed(2)}`;
  };

  // Helper functions (findColumn, detectFulfillment, categorizeTransactionType, parseNumber,
  // translateDescription, parseDate, detectMarketplace, formatDateHuman) are now imported from
  // ./transaction-analyzer/helpers.ts

  // Shared helper to enrich transactions with product mapping
  // Generic type to handle both TransactionData and DB.TransactionData
  const enrichTransactionsWithProductData = async <T extends TransactionData>(data: T[]): Promise<T[]> => {
    try {
      console.log(`[Enrichment] Starting enrichment for ${data.length} transactions`);
      const productInfo = await fetchProductMapping();
      console.log(`[Enrichment] Got ${productInfo.length} products from mapping`);

      if (productInfo.length > 0) {
        const productMap = createProductMap(productInfo);

        // Debug: Check a few SKUs from transactions against the map
        const sampleTx = data.slice(0, 5);
        console.log('[Enrichment] Sample transaction SKUs:', sampleTx.map(t => `${t.marketplaceCode}:${t.sku}`));
        sampleTx.forEach(t => {
          const found = productMap.get(`${t.marketplaceCode}:${t.sku}`) || productMap.get(t.sku);
          console.log(`[Enrichment] SKU ${t.sku} (${t.marketplaceCode}): ${found ? 'FOUND - ' + found.category : 'NOT FOUND'}`);
        });

        const enriched = data.map(transaction => enrichTransaction(transaction, productMap) as T);

        // Count enriched transactions
        const withCategory = enriched.filter(t => t.productCategory).length;
        const withCost = enriched.filter(t => t.productCost !== null && t.productCost !== undefined).length;
        console.log(`[Enrichment] Results: ${withCategory}/${data.length} with category, ${withCost}/${data.length} with cost`);

        return enriched;
      }
    } catch (err) {
      console.error('[Enrichment] Failed:', err);
    }
    return data;
  };

  // processFile now uses the extracted fileProcessor service
  const processFile = async (file: File, detectedMarketplace?: MarketplaceCode): Promise<TransactionData[]> => {
    return processExcelFile(file, detectedMarketplace);
  };

  // Quick marketplace detection (for file upload preview)
  const detectMarketplaceQuick = async (file: File): Promise<MarketplaceCode | null> => {
    return detectMarketplaceFromFile(file);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || []);
    if (uploadedFiles.length === 0) return;

    setLoading(true);
    setError(null);
    setValidationWarnings([]);

    try {
      const warnings: string[] = [];
      const detectedMarketplaces = new Set<MarketplaceCode>();
      let totalAdded = 0;
      let totalSkipped = 0;

      for (const file of uploadedFiles) {
        // Use extracted service for marketplace detection
        const quickRead = await detectMarketplaceFromFile(file);

        if (!quickRead) {
          throw new Error(`${file.name}: Marketplace tespit edilemedi. Dosyanın Amazon transaction raporu olduğundan emin olun.`);
        }

        detectedMarketplaces.add(quickRead);

        // Şimdi tam dosyayı işle
        let data = await processFile(file, quickRead);

        // Enrich transactions with product mapping from Google Sheets
        data = await enrichTransactionsWithProductData(data);

        // LIMIT: Prevent loading files that are too large
        if (data.length > 150000) {
          throw new Error(
            `❌ Dosya çok büyük: ${file.name}\n\n` +
            `Bu dosyada ${data.length.toLocaleString()} işlem var.\n` +
            `Maksimum 150,000 işlem yüklenebilir.\n\n` +
            `Lütfen daha küçük bir tarih aralığı için rapor indirin veya\n` +
            `dosyayı Excel'de parçalara bölün.`
          );
        }

        // Validation: Check marketplace match
        const marketplaceValidation = DB.validateMarketplaceData(quickRead, data);
        if (!marketplaceValidation.isValid) {
          throw new Error(
            `Dosya uyumsuzluğu: ${file.name}\n${marketplaceValidation.errors.join('\n')}`
          );
        }

        if (marketplaceValidation.warnings.length > 0) {
          warnings.push(...marketplaceValidation.warnings.map(w => `${file.name}: ${w}`));
        }

        // Save to IndexedDB with automatic deduplication
        if (saveToDBAfterLoad && data.length > 0) {
          try {
            const result = await DB.saveTransactions(quickRead, data, file.name);
            totalAdded += result.added;
            totalSkipped += result.skipped;

            if (result.skipped > 0) {
              warnings.push(`${file.name}: ${result.skipped} duplicate işlem atlandı`);
            }

            // Auto-save to localStorage after successful DB save
            // Auto-backup disabled - not needed
          } catch {
            warnings.push(`${file.name} veritabanına kaydedilemedi (devam edildi)`);
          }
        }
      }

      // Tespit edilen marketplace'leri bildir
      if (detectedMarketplaces.size > 0) {
        const marketplaceNames = Array.from(detectedMarketplaces)
          .map(code => CONFIGS[code].name)
          .join(', ');

        // İlk marketplace'i seç (birden fazla varsa kullanıcıya bildir)
        if (detectedMarketplaces.size === 1) {
          setMarketplaceCode(Array.from(detectedMarketplaces)[0]);
        } else if (!marketplaceCode) {
          // Birden fazla marketplace var, ilkini seç
          setMarketplaceCode(Array.from(detectedMarketplaces)[0]);
          warnings.push(`Birden fazla marketplace tespit edildi (${marketplaceNames}). Filtrelerden seçim yapabilirsiniz.`);
        }
      }

      // Success message
      if (totalAdded > 0 || totalSkipped > 0) {
        warnings.unshift(`✅ Toplam: ${totalAdded} yeni işlem eklendi, ${totalSkipped} duplicate atlandı`);
      }

      if (warnings.length > 0) {
        setValidationWarnings(warnings);
      }

      // Reload data from IndexedDB
      await loadDataFromIndexedDB();

      // Stored files listesini yenile (marketplace metadata'dan)
      const allFiles = await DB.getAllFiles();
      setStoredFiles(allFiles);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load data from IndexedDB based on marketplace selection
  // notifyParent: only call onDataLoaded when loading ALL data (initial load), not for filtered views
  const loadDataFromIndexedDB = async (notifyParent: boolean = false) => {
    try {
      setLoading(true);

      let transactions: DB.TransactionData[];

      if (marketplaceCode) {
        // Load specific marketplace
        transactions = await DB.getTransactionsByMarketplace(marketplaceCode);
      } else {
        // Load all marketplaces (Tümü mode - when marketplaceCode is null)
        transactions = await DB.getAllTransactions();
      }

      // Enrich transactions with product mapping from Google Sheets
      transactions = await enrichTransactionsWithProductData(transactions);

      setAllData(transactions);

      // Only notify parent when loading ALL data initially (not when switching marketplace filter)
      if (notifyParent && onDataLoaded) {
        onDataLoaded(transactions);
      }
    } catch {
      setError('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Load all stored data on mount (NEW: marketplace-based auto-load)
  useEffect(() => {
    const loadAllStoredData = async () => {
      try {
        setLoading(true);

        // Auto-backup disabled - not needed

        // Get all marketplace metadata
        const metadataList = await DB.getAllMarketplaceMetadata();

        // Convert to file format for UI compatibility
        const files = metadataList.map(metadata => ({
          id: metadata.code,
          marketplace: metadata.code,
          fileName: `${metadata.code} - ${metadata.transactionCount} transactions`,
          uploadDate: metadata.lastUpdate,
          dataCount: metadata.transactionCount,
          dateRange: metadata.dateRange,
          sizeInBytes: 0
        }));

        setStoredFiles(files);

        // Load all transactions
        if (metadataList.length > 0) {
          const allTransactions = await DB.getAllTransactions();

          if (allTransactions.length > 0) {
            // EMERGENCY: Prevent loading very large datasets all at once
            if (allTransactions.length > 200000) {
              alert(`⚠️ Çok büyük veri seti tespit edildi (${allTransactions.length} işlem).\n\nPerformans sorunlarını önlemek için lütfen yukarıdan belirli bir ülke (marketplace) seçin.\n\nTümü modunda bu kadar büyük veri işlenemez.`);

              // Still set the data but user must select a marketplace
              setAllData(allTransactions);

              // Don't auto-select, force user to choose
              if (metadataList.length === 1) {
                setMarketplaceCode(metadataList[0].code as MarketplaceCode);
              }
            } else {
              setAllData(allTransactions);

              // If only one marketplace exists, select it
              if (metadataList.length === 1) {
                setMarketplaceCode(metadataList[0].code as MarketplaceCode);
              }
              // Otherwise keep as "Tümü" (null or ALL)

              // Notify parent component (App.tsx) about loaded data
              if (onDataLoaded) {
                onDataLoaded(allTransactions);
              }
            }
          }
        }
      } catch {
        // Silent fail - stored data couldn't be loaded
      } finally {
        setLoading(false);
      }
    };

    loadAllStoredData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - only run on mount

  // Marketplace seçimi değiştiğinde veriyi yeniden yükle
  // IMPORTANT: Don't notify parent - parent (ProductAnalyzer) should always have ALL data
  useEffect(() => {
    // İlk mount'u atla (ilk useEffect zaten veriyi yüklüyor)
    // Sadece marketplace seçimi değiştiğinde yükle
    if (allData.length > 0) {
      loadDataFromIndexedDB(false); // false = don't notify parent
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketplaceCode]);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    const filters = {
      marketplaceCode,
      dateRange,
      selectedFulfillment,
      comparisonMode,
    };
    localStorage.setItem('amazonAnalyzerFilters', JSON.stringify(filters));
  }, [marketplaceCode, dateRange, selectedFulfillment, comparisonMode]);

  // Filters are now independent - no sync needed

  const removeMarketplace = async (marketplaceCode: string) => {
    if (!window.confirm(`${marketplaceCode} marketplace'indeki tüm işlemler silinecek. Emin misiniz?`)) {
      return;
    }

    try {
      setLoading(true);
      await DB.deleteMarketplaceTransactions(marketplaceCode);

      // Reload stored files and data
      const allFiles = await DB.getAllFiles();
      setStoredFiles(allFiles);
      await loadDataFromIndexedDB();
    } catch (err: any) {
      setError(`Silme hatası: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!analytics || !config) return;
    window.print();
  };

  const exportToExcel = () => {
    if (!analytics || !config) return;
    exportTransactionsToExcel({
      analytics,
      config,
      dateRange,
      selectedFulfillment,
      filteredData,
    });
  };

  // NOTE: filteredData does NOT apply fulfillment filter
  // Fulfillment filtering is handled inside calculateAnalytics for proper advertising distribution
  const filteredData = useMemo(() => {
    return allData.filter(item => {
      if (dateRange.start && item.date < new Date(dateRange.start)) return false;
      if (dateRange.end && item.date > new Date(dateRange.end)) return false;

      // Marketplace filtresi - marketplace seçiliyse sadece o marketplace'i göster
      if (marketplaceCode) {
        // Yeni yapıda marketplaceCode direkt kullanılabilir
        if (item.marketplaceCode !== marketplaceCode) return false;
      }

      return true;
    });
  }, [allData, dateRange.start, dateRange.end, marketplaceCode]);

  // formatDateHuman is now imported from ./transaction-analyzer/helpers.ts

  const derivedRange = useMemo(() => {
    if (dateRange.start && dateRange.end) {
      return {
        startStr: formatDateHuman(new Date(dateRange.start)),
        endStr: formatDateHuman(new Date(dateRange.end)),
      };
    }

    if (allData && allData.length > 0) {
      // For large datasets, manually find min/max to avoid call stack overflow
      let minTime = Infinity;
      let maxTime = -Infinity;

      for (const item of allData) {
        if (item.date) {
          const time = new Date(item.date).getTime();
          if (time < minTime) minTime = time;
          if (time > maxTime) maxTime = time;
        }
      }

      if (minTime !== Infinity && maxTime !== -Infinity) {
        return {
          startStr: formatDateHuman(new Date(minTime)),
          endStr: formatDateHuman(new Date(maxTime)),
        };
      }
    }

  return { startStr: "", endStr: "" };
}, [dateRange.start, dateRange.end, allData]);

  // Karşılaştırma dönemleri hesaplama
  const comparisonRanges = useMemo(() => {
    if (!dateRange.start || !dateRange.end || comparisonMode === 'none') return null;

    const currentStart = new Date(dateRange.start);
    const currentEnd = new Date(dateRange.end);
    const periodDays = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));

    if (comparisonMode === 'previous-period') {
      // Önceki dönem: aynı uzunlukta bir önceki dönem
      const prevEnd = new Date(currentStart);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - periodDays + 1);

      return {
        previousPeriod: {
          start: prevStart,
          end: prevEnd,
          label: `${formatDateHuman(prevStart)} - ${formatDateHuman(prevEnd)}`
        }
      };
    } else if (comparisonMode === 'previous-year') {
      // Önceki yıl aynı dönem
      const prevYearStart = new Date(currentStart);
      prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);
      const prevYearEnd = new Date(currentEnd);
      prevYearEnd.setFullYear(prevYearEnd.getFullYear() - 1);

      return {
        previousYear: {
          start: prevYearStart,
          end: prevYearEnd,
          label: `${formatDateHuman(prevYearStart)} - ${formatDateHuman(prevYearEnd)}`
        }
      };
    }

    return null;
  }, [dateRange.start, dateRange.end, comparisonMode]);

  // Calculate analytics using centralized analytics engine
  const analytics = useMemo(() => {
    return calculateAnalytics({
      data: filteredData,
      marketplaceCode,
      selectedFulfillment: selectedFulfillment as 'all' | 'FBA' | 'FBM',
      dateRange: {
        start: dateRange.start ? new Date(dateRange.start) : null,
        end: dateRange.end ? new Date(dateRange.end) : null
      },
      config: config as MarketplaceConfig
    });
  }, [filteredData, marketplaceCode, selectedFulfillment, dateRange.start, dateRange.end, config]);

  // Karşılaştırma analytics'i hesapla - analytics engine kullanarak
  const comparisonAnalytics = useMemo(() => {
    if (!comparisonRanges || !config) return null;
    if (comparisonMode === 'none') return null;

    const range = comparisonMode === 'previous-period'
      ? comparisonRanges.previousPeriod
      : comparisonRanges.previousYear;

    if (!range) return null;

    // Analytics engine'i kullanarak karşılaştırma analytics'ini hesapla
    const result = calculateAnalytics({
      data: allData,
      marketplaceCode,
      selectedFulfillment: selectedFulfillment as 'all' | 'FBA' | 'FBM',
      dateRange: {
        start: range.start,
        end: range.end
      },
      config: config as MarketplaceConfig
    });

    // Add label from comparison range
    if (result) {
      return { ...result, label: range.label };
    }
    return result;
  }, [comparisonMode, comparisonRanges, config, allData, marketplaceCode, selectedFulfillment]);

  // Filter comparison period raw data for chart visualization
  const comparisonFilteredData = useMemo(() => {
    if (!comparisonRanges) return [];

    const range = comparisonMode === 'previous-period'
      ? comparisonRanges.previousPeriod
      : comparisonRanges.previousYear;

    if (!range) return [];

    let filtered = allData.filter(item => {
      // Date range filter
      if (item.date < range.start || item.date > range.end) return false;

      // Marketplace filter
      if (marketplaceCode && item.marketplaceCode !== marketplaceCode) return false;

      // Fulfillment filter
      if (selectedFulfillment !== 'all' && item.fulfillment !== selectedFulfillment) return false;

      return true;
    });

    return filtered;
  }, [comparisonRanges, comparisonMode, allData, marketplaceCode, selectedFulfillment]);

  // Marketplace artık otomatik tespit edilecek, başlangıçta seçim yok

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <style>{`
        @media print {
          body { 
            background: white !important; 
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            margin: 0;
            padding: 0;
          }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          
          /* Sayfa düzeni */
          @page {
            size: A4;
            margin: 1.5cm;
          }
          
          /* Blokları bölme */
          .print-block {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          /* Grid'leri tek kolon yap */
          .print-single-col {
            grid-template-columns: 1fr !important;
          }
          
          /* Kartları küçült */
          .print-card {
            padding: 0.75rem !important;
            margin-bottom: 0.5rem !important;
          }
          
          .print-card h3 {
            font-size: 0.875rem !important;
            margin-bottom: 0.5rem !important;
          }
          
          .print-card .text-2xl {
            font-size: 1.25rem !important;
          }
          
          .print-card .text-lg {
            font-size: 0.875rem !important;
          }
          
          /* Grafikleri küçült */
          svg { 
            max-width: 100%; 
            height: auto;
            max-height: 200px;
          }
          
          /* Başlık */
          .print-header {
            margin-bottom: 1rem !important;
            padding-bottom: 0.5rem !important;
            border-bottom: 2px solid #e2e8f0;
          }
          
          /* Detay satırları daha kompakt */
          .space-y-3 > * {
            margin-top: 0.25rem !important;
            margin-bottom: 0.25rem !important;
            padding-top: 0.25rem !important;
            padding-bottom: 0.25rem !important;
          }
        }
      `}</style>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 no-print">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2 flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-blue-600" />
                Transaction Analyzer
              </h1>
              <p className="text-slate-600">Upload your transaction reports and analyze them in detail</p>
            </div>

            {/* Action Buttons - Two Rows */}
            <div className="flex flex-col gap-2">
              {/* First Row: Upload, Stored, Refresh, Clear */}
              <div className="flex items-center gap-2 justify-end">
                {/* File Upload Toggle */}
                <button
                  onClick={() => setShowFileUpload(!showFileUpload)}
                  className="flex items-center justify-center gap-2 px-4 py-2 min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  title="Excel dosyalarını yükle"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">Yükle</span>
                  {showFileUpload ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {/* Stored Marketplaces Toggle */}
                {storedFiles.length > 0 && (
                  <button
                    onClick={() => setShowStoredMarketplaces(!showStoredMarketplaces)}
                    className="flex items-center justify-center gap-2 px-4 py-2 min-w-[120px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                    title="Kayıtlı marketplaces"
                  >
                    <Database className="w-4 h-4" />
                    <span className="text-sm font-medium">Kayıtlı ({storedFiles.length})</span>
                    {showStoredMarketplaces ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}

              {/* Backup Download */}
              <button
                onClick={async () => {
                  try {
                    await DB.downloadBackupFile();
                  } catch {
                    window.alert('❌ Yedekleme indirilirken hata oluştu!');
                  }
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 min-w-[100px] bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                title="Verileri JSON olarak indir"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">Yedekle</span>
              </button>

              {/* Backup Restore */}
              <label
                className="flex items-center justify-center gap-2 px-4 py-2 min-w-[100px] bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors cursor-pointer"
                title="JSON yedekten geri yükle"
              >
                <FolderUp className="w-4 h-4" />
                <span className="text-sm font-medium">Geri Yükle</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    if (!window.confirm('⚠️ Mevcut veriler silinecek ve yedekten geri yüklenecek. Devam etmek istiyor musunuz?')) {
                      e.target.value = '';
                      return;
                    }

                    try {
                      const result = await DB.importBackupFile(file);
                      const total = result.imported.transactions + result.imported.metadata;
                      window.alert(`✅ Yedek başarıyla yüklendi! ${total} kayıt geri yüklendi. Sayfa yenilenecek...`);
                      window.location.reload();
                    } catch {
                      window.alert('❌ Yedek yüklenirken hata oluştu! Dosya formatını kontrol edin.');
                    }
                    e.target.value = '';
                  }}
                />
              </label>

              {/* Clear All Data */}
              <button
                onClick={async () => {
                  if (window.confirm('⚠️ Tüm veriler silinecek! Devam etmek istiyor musunuz?\n\n- Tüm transactions (IndexedDB)\n- Product mapping cache (localStorage)\n- Sayfa yenilenecek')) {
                    try {
                      // First close any existing DB connections
                      await DB.clearAllData();

                      // Delete the entire database using Promise wrapper
                      await new Promise<void>((resolve, reject) => {
                        const deleteRequest = indexedDB.deleteDatabase('AmazonAnalyzerDB');
                        deleteRequest.onsuccess = () => {
                          console.log('✅ Database deleted successfully');
                          resolve();
                        };
                        deleteRequest.onerror = () => {
                          console.log('❌ Database delete error');
                          reject(new Error('Failed to delete database'));
                        };
                        deleteRequest.onblocked = () => {
                          console.log('⚠️ Database delete blocked - forcing reload');
                          resolve(); // Continue anyway
                        };
                      });

                      // Clear ALL localStorage items related to the app
                      localStorage.removeItem('productMapping_cache');
                      localStorage.removeItem('productMapping_timestamp');
                      localStorage.removeItem('profitability_filters');
                      localStorage.removeItem('amazonAnalyzerFilters');
                      // IMPORTANT: Clear auto-backup to prevent restore on reload
                      localStorage.removeItem('amazonAnalyzerAutoBackup');
                      localStorage.removeItem('amazonAnalyzerLastBackup');

                      // Also clear React state before reload
                      setAllData([]);
                      setStoredFiles([]);

                      window.alert('✅ Tüm veriler temizlendi! Sayfa yenilenecek...');

                      // Force hard reload to clear any cached state
                      window.location.href = window.location.href;
                    } catch (err) {
                      console.error('Clear error:', err);
                      // Even if there's an error, try to reload
                      window.alert('⚠️ Bazı veriler temizlenemedi, sayfa yenilenecek...');
                      window.location.href = window.location.href;
                    }
                  }
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 min-w-[100px] bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                title="Tüm verileri temizle (IndexedDB + Cache)"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm font-medium">Temizle</span>
              </button>
              </div>

              {/* Second Row: PDF, Excel, Advanced - Only show when data exists */}
              {allData.length > 0 && (
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={exportToPDF}
                    className="flex items-center justify-center gap-2 px-4 py-2 min-w-[120px] bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    title="PDF olarak indir"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="text-sm font-medium">PDF</span>
                  </button>

                  <button
                    onClick={exportToExcel}
                    className="flex items-center justify-center gap-2 px-4 py-2 min-w-[120px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                    title="Excel olarak indir"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="text-sm font-medium">Excel</span>
                  </button>

                  <button
                    onClick={() => setShowAdvancedDashboard(!showAdvancedDashboard)}
                    className={`flex items-center justify-center gap-2 px-4 py-2 min-w-[120px] rounded-lg transition-colors ${
                      showAdvancedDashboard
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                    title="Gelişmiş görünümü aç/kapat"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-medium">Gelişmiş</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* File Upload Section - Collapsible */}
          {showFileUpload && (
            <div className="mt-4 border-t-2 border-dashed border-slate-300 pt-6">
              <div className="p-8 text-center bg-slate-50 rounded-lg hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={loading}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-lg font-medium text-slate-700 mb-1">
                    Excel dosyalarını yükleyin
                  </p>
                  <p className="text-sm text-slate-500">
                    Transaction raporlarınızı yükleyin (.xlsx, .xls)
                  </p>
                </label>

                <div className="mt-4 pt-4 border-t border-slate-200">
                  <label className="flex items-center justify-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveToDBAfterLoad}
                      onChange={(e) => setSaveToDBAfterLoad(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-slate-600">
                      <Save className="w-4 h-4 inline mr-1" />
                      Dosyaları otomatik kaydet
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Stored Marketplaces Section - Collapsible */}
          {showStoredMarketplaces && storedFiles.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {storedFiles.map((stored) => {
                  const mpConfig = CONFIGS[stored.marketplace as MarketplaceCode];
                  const dateStart = new Date(stored.dateRange.start).toLocaleDateString('tr-TR');
                  const dateEnd = new Date(stored.dateRange.end).toLocaleDateString('tr-TR');

                  return (
                    <div
                      key={stored.id}
                      className="bg-white border-2 border-slate-200 rounded-xl p-4 hover:shadow-lg hover:border-blue-400 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-50 rounded-lg">
                            <Database className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-slate-800">
                              {mpConfig?.name || stored.marketplace}
                            </h3>
                            <span className="text-xs font-medium text-blue-600">
                              {stored.marketplace}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeMarketplace(stored.marketplace)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Bu marketplace'i sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2 mt-4">
                        <div className="flex items-center justify-between py-2 border-t border-slate-100">
                          <span className="text-xs text-slate-500">İşlem Sayısı</span>
                          <span className="text-sm font-semibold text-slate-800">
                            {stored.dataCount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-t border-slate-100">
                          <span className="text-xs text-slate-500">Tarih Aralığı</span>
                          <span className="text-xs text-slate-700">
                            {dateStart}
                          </span>
                        </div>
                        <div className="flex items-center justify-end pb-1">
                          <span className="text-xs text-slate-700">
                            {dateEnd}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loading && (
            <div className="mt-4 flex items-center gap-2 text-blue-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Dosyalar işleniyor...</span>
            </div>
          )}

          {validationWarnings.length > 0 && (
            <div className="mt-4 space-y-2">
              {validationWarnings.map((warning, idx) => (
                <div key={idx} className="flex items-center gap-2 text-yellow-600 bg-yellow-50 p-3 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Transaction Filters - Extracted Component */}
        {allData.length > 0 && (
          <TransactionFilters
            marketplaceCode={marketplaceCode}
            dateRange={dateRange}
            selectedFulfillment={selectedFulfillment}
            comparisonMode={comparisonMode}
            storedFiles={storedFiles}
            comparisonDateRange={
              comparisonMode === 'previous-period'
                ? comparisonRanges?.previousPeriod
                : comparisonMode === 'previous-year'
                ? comparisonRanges?.previousYear
                : null
            }
            onMarketplaceChange={setMarketplaceCode}
            onDateRangeChange={setDateRange}
            onFulfillmentChange={setSelectedFulfillment}
            onComparisonModeChange={setComparisonMode}
          />
        )}

        {loading && allData.length > 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-lg font-medium text-slate-700">Analiz ediliyor...</p>
              <p className="text-sm text-slate-500 mt-2">{allData.length} kayıt işleniyor</p>
            </div>
          </div>
        )}

        {!loading && analytics && (
          <>
          <div className="hidden print:block mb-6 print-header">
            <h1 className="text-2xl font-bold text-slate-800">
              Amazon Transaction Analyzer Report
            </h1>

            <p className="text-slate-600 mt-1">
            {[
                config?.name,
                derivedRange.startStr && derivedRange.endStr
                  ? `${derivedRange.startStr} - ${derivedRange.endStr}`
                  : "All Time",
                selectedFulfillment !== "all" ? selectedFulfillment : null
              ]
                .filter(Boolean)
                .join("  ")}
            </p>

            <p className="text-slate-500 text-sm">
              Generated: {new Date().toLocaleString()}
            </p>
          </div>

            {/* Advanced Dashboard (v1.5) */}
            {showAdvancedDashboard && (
              <div className="mb-6 no-print">
                <AdvancedDashboard
                  analytics={analytics}
                  comparisonAnalytics={comparisonAnalytics}
                  filteredData={filteredData}
                  comparisonFilteredData={comparisonFilteredData}
                  selectedFulfillment={selectedFulfillment as 'all' | 'FBA' | 'FBM'}
                  currency={config?.currencySymbol || '$'}
                  isLoading={loading}
                  dateRange={dateRange}
                  comparisonMode={comparisonMode}
                  onComparisonModeChange={setComparisonMode}
                />
              </div>
            )}

            {/* Summary Cards - Extracted Component */}
            <SummaryCards
              analytics={analytics}
              comparisonAnalytics={comparisonAnalytics}
              selectedFulfillment={selectedFulfillment}
              formatMoney={formatMoney}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 print-single-col">
              <div className="bg-white rounded-xl shadow-sm p-6 print-card print-block">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 print-header">
                  Gelir Dağılımı (Order Sales = 100%)
                </h3>
                <PieChart
                  data={analytics.pieChartData.values}
                  labels={analytics.pieChartData.labels}
                  colors={analytics.pieChartData.colors}
                  comparisonData={comparisonAnalytics ? (() => {
                    // Karşılaştırma için aynı sırada pie chart datası oluştur
                    if (selectedFulfillment === 'FBA') {
                      const baseCosts = [
                        comparisonAnalytics.fbaSellingFees,
                        comparisonAnalytics.totalFbaFees,
                        comparisonAnalytics.totalFBACost,
                        comparisonAnalytics.fbaAdvertisingCost,
                        comparisonAnalytics.actualRefundLoss
                      ];
                      if (config?.vatIncludedInPrice) baseCosts.push(comparisonAnalytics.totalVAT);
                      const netRemaining = Math.max(0, comparisonAnalytics.fbaOrderSales - baseCosts.reduce((sum, val) => sum + val, 0));
                      baseCosts.push(netRemaining);
                      return baseCosts;
                    } else if (selectedFulfillment === 'FBM') {
                      const baseCosts = [
                        comparisonAnalytics.fbmSellingFees,
                        comparisonAnalytics.totalFBMCost,
                        comparisonAnalytics.fbmAdvertisingCost,
                        comparisonAnalytics.actualRefundLoss
                      ];
                      if (config?.vatIncludedInPrice) baseCosts.push(comparisonAnalytics.totalVAT);
                      const netRemaining = Math.max(0, comparisonAnalytics.fbmOrderSales - baseCosts.reduce((sum, val) => sum + val, 0));
                      baseCosts.push(netRemaining);
                      return baseCosts;
                    } else {
                      const baseCosts = [
                        comparisonAnalytics.totalSellingFees,
                        comparisonAnalytics.totalFbaFees,
                        comparisonAnalytics.totalFBACost,
                        comparisonAnalytics.totalFBMCost,
                        comparisonAnalytics.advertisingCost,
                        comparisonAnalytics.actualRefundLoss
                      ];
                      if (config?.vatIncludedInPrice) baseCosts.push(comparisonAnalytics.totalVAT);
                      const netRemaining = Math.max(0, comparisonAnalytics.totalSales - baseCosts.reduce((sum, val) => sum + val, 0));
                      baseCosts.push(netRemaining);
                      return baseCosts;
                    }
                  })() : undefined}
                  comparisonTotalSales={comparisonAnalytics ? (
                    selectedFulfillment === 'FBA' ? comparisonAnalytics.fbaOrderSales :
                    selectedFulfillment === 'FBM' ? comparisonAnalytics.fbmOrderSales :
                    comparisonAnalytics.totalSales
                  ) : undefined}
                  formatMoney={formatMoney}
                />
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500">
                    Toplam Order Sales: {formatMoney(analytics.totalSales)}
                  </p>
                </div>
              </div>

              {/* Ülke Bazlı Satış Dağılımı - Sadece Tümü modunda */}
              {!marketplaceCode && analytics.marketplaceSalesDistribution && Object.keys(analytics.marketplaceSalesDistribution).length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6 print-card print-block">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 print-header">
                    Ülke Bazlı Satış Dağılımı
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(analytics.marketplaceSalesDistribution)
                      .sort((a, b) => (b[1] as any).sales - (a[1] as any).sales)
                      .map(([code, data]: [string, any]) => {
                        const configData = CONFIGS[code as MarketplaceCode];
                        const percentage = ((data.sales / analytics.totalSales) * 100).toFixed(1);

                        // Comparison data
                        const comparisonData = comparisonAnalytics?.marketplaceSalesDistribution?.[code];
                        const prevSales = comparisonData?.sales || 0;
                        const salesChange = prevSales > 0 ? ((data.sales - prevSales) / prevSales) * 100 : 0;

                        return (
                          <div key={code} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">
                                {configData ? configData.name : code}
                              </span>
                              <span className="text-xs text-slate-500">({data.orders} orders)</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-slate-800">
                                {formatMoney(data.sales)}
                              </span>
                              <span className="text-xs text-slate-500 w-12 text-right">
                                {percentage}%
                              </span>
                              {comparisonAnalytics && prevSales > 0 && (
                                <span className={`text-xs font-medium w-16 text-right ${salesChange > 0 ? 'text-green-600' : salesChange < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                                  {salesChange > 0 ? '↑' : salesChange < 0 ? '↓' : ''}
                                  {Math.abs(salesChange).toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* FBA Cost Kırılımı - Marketplace seçiliyken pasta grafiğin yanında */}
              {marketplaceCode && (selectedFulfillment === 'all' || selectedFulfillment === 'FBA') && (
                <div className="bg-white rounded-xl shadow-sm p-6 print-card print-block">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">FBA Cost Kırılımı</h3>
                    {comparisonAnalytics && (
                      <button
                        onClick={() => {
                          setComparisonDetailType('fbaCostBreakdown');
                          setComparisonDetailOpen(true);
                        }}
                        className="no-print px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                      >
                        📊 Detay
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">Adjustment</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {formatMoney(analytics.adjustmentTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">FBA Inventory Fee</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {formatMoney(analytics.inventoryTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">Chargeback Refund</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {formatMoney(analytics.chargebackTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">Service Fee</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {formatMoney(analytics.serviceTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">FBA Customer Return Fee</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {formatMoney(analytics.fbaCustomerReturnTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">FBA Transaction Fee</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {formatMoney(analytics.fbaTransactionTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">Fee Adjustment</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {formatMoney(analytics.feeAdjustments)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">SAFE-T Reimbursement</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {formatMoney(analytics.safetReimbursements)}
                      </span>
                    </div>
                    {config?.hasLiquidations && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-700">Liquidations</span>
                        <span className="text-sm font-semibold text-slate-800">
                          {formatMoney(analytics.liquidationsTotal)}
                        </span>
                      </div>
                    )}
                    <div className="pt-3 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Total FBA Cost</span>
                        <span className="text-lg font-bold text-orange-600">
                          {formatMoney(analytics.totalFBACost)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Her Ülke İçin Maliyet Dağılımı - Sadece Tümü modunda */}
            {!marketplaceCode && analytics.marketplacePieCharts && Object.keys(analytics.marketplacePieCharts).length > 0 && (
              <div className="mb-6 print:break-inside-avoid">
                <h2 className="text-xl font-semibold text-slate-800 mb-4 print:text-base print:mb-2">Ülke Bazlı Maliyet Dağılımı</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-2">
                  {Object.entries(analytics.marketplacePieCharts)
                    .sort((a, b) => (b[1] as any).totalSales - (a[1] as any).totalSales)
                    .map(([mpCode, chartData]: [string, any]) => {
                      const mpConfig = CONFIGS[mpCode as MarketplaceCode];
                      if (!mpConfig) return null;

                      // Comparison data for this marketplace
                      const prevChartData = comparisonAnalytics?.marketplacePieCharts?.[mpCode];
                      const prevSales = prevChartData?.totalSales || 0;
                      const salesChange = prevSales > 0 ? ((chartData.totalSales - prevSales) / prevSales) * 100 : 0;

                      return (
                        <div key={mpCode} className="bg-white rounded-xl shadow-sm p-4 print:p-2 print:shadow-none print:border print:border-slate-200 flex flex-col print:break-inside-avoid">
                          <h3 className="text-base font-semibold text-slate-800 mb-3 print:text-xs print:mb-1 print:text-center">
                            {mpConfig.name}
                          </h3>
                          <div className="flex justify-center flex-grow">
                            <div style={{ transform: 'scale(0.7)', transformOrigin: 'center' }} className="print:!transform-none print:scale-50">
                              <PieChart
                                data={chartData.values}
                                labels={chartData.labels}
                                colors={chartData.colors}
                                formatMoney={formatMoney}
                              />
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-200 print:mt-1 print:pt-1">
                            <div className="text-center">
                              <p className="text-xs text-slate-500 print:text-[9px]">
                                Total Sales: {formatMoney(chartData.totalSales)}
                              </p>
                              {comparisonAnalytics && prevSales > 0 && (
                                <p className={`text-xs font-medium mt-1 ${salesChange > 0 ? 'text-green-600' : salesChange < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                                  {salesChange > 0 ? '↑' : salesChange < 0 ? '↓' : ''}
                                  {Math.abs(salesChange).toFixed(1)}% vs prev
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {config?.hasPostalZones && analytics.postalZones && Object.keys(analytics.postalZones).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6 print-block print-card">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Postal Zone Distribution (Top 10)</h3>
                <div className="space-y-3">
                  {Object.entries(analytics.postalZones)
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 10)
                    .map(([zone, data]) => {
                      const zoneName = ZONE_NAMES[config?.code || 'US']?.[zone] || `Zone ${zone}`;
                      const percentage = ((data.count / analytics.totalOrders) * 100).toFixed(1);
                      return (
                        <div key={zone} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                          <span className="text-sm font-medium text-slate-700">{zoneName}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-base font-bold text-slate-800">
                              {data.count.toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-500 w-12 text-right">
                              ({percentage}%)
                            </span>
                            <span className="text-sm font-semibold text-blue-600 w-24 text-right">
                              {formatMoney(data.sales)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Order Details Cards - Extracted Component */}
            <OrderDetailsCards
              analytics={analytics}
              selectedFulfillment={selectedFulfillment}
              formatMoney={formatMoney}
            />

            {/* Fulfillment Stats Cards - Extracted Component */}
            <FulfillmentStatsCards
              analytics={analytics}
              selectedFulfillment={selectedFulfillment}
              formatMoney={formatMoney}
            />

            {/* Detailed Breakdown Section - Collapsible */}
            <div className="mb-6 no-print">
              <button
                onClick={() => setShowDetailedBreakdown(!showDetailedBreakdown)}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200 rounded-lg border border-slate-200 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-slate-800">Detaylı Gider Kırılımları</h3>
                    <p className="text-xs text-slate-600">Fee detayları, adjustment'lar ve daha fazlası</p>
                  </div>
                </div>
                {showDetailedBreakdown ? (
                  <ChevronUp className="w-5 h-5 text-slate-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-600" />
                )}
              </button>
            </div>

            {/* Fee Details Section - Extracted Component */}
            {showDetailedBreakdown && (
              <FeeDetailsSection
                analytics={analytics}
                comparisonAnalytics={comparisonAnalytics}
                selectedFulfillment={selectedFulfillment}
                marketplaceCode={marketplaceCode}
                formatMoney={formatMoney}
                onOpenComparisonDetail={(type) => {
                  setComparisonDetailType(type);
                  setComparisonDetailOpen(true);
                }}
              />
            )}
          </>
        )}

        {allData.length === 0 && !loading && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <FileSpreadsheet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-800 mb-2">
              Henüz dosya yüklenmedi
            </h3>
            <p className="text-slate-600">
              Başlamak için yukarıdan transaction raporlarınızı yükleyin
            </p>
          </div>
        )}
      </div>

      {/* Comparison Detail Modal */}
      {comparisonDetailOpen && comparisonDetailType && comparisonAnalytics && analytics && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print" onClick={() => setComparisonDetailOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800">
                {comparisonDetailType === 'adjustments' && 'Adjustment Karşılaştırması'}
                {comparisonDetailType === 'inventory' && 'FBA Inventory Fee Karşılaştırması'}
                {comparisonDetailType === 'service' && 'Service Fee Karşılaştırması'}
                {comparisonDetailType === 'fbaCostBreakdown' && 'FBA Cost Kırılımı Karşılaştırması'}
              </h2>
              <button
                onClick={() => setComparisonDetailOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">Mevcut dönem vs {comparisonAnalytics.label}</p>

              {/* Detailed Cost Breakdown */}
              <div className="space-y-3">
                {(() => {
                  // Calculate current period costs
                  const compRange = comparisonMode === 'previous-period'
                    ? comparisonRanges?.previousPeriod
                    : comparisonRanges?.previousYear;

                  if (!compRange) return null;

                  let costItems: { label: string; current: number; prev: number }[] = [];

                  if (comparisonDetailType === 'adjustments') {
                    // Calculate adjustment details
                    const currentData = allData.filter(item => {
                      if (dateRange.start && item.date < new Date(dateRange.start)) return false;
                      if (dateRange.end && item.date > new Date(dateRange.end)) return false;
                      return item.categoryType === 'Adjustment';
                    });

                    const prevData = allData.filter(item =>
                      item.date >= compRange.start && item.date <= compRange.end && item.categoryType === 'Adjustment'
                    );

                    // Group by description
                    const currentGroups: Record<string, number> = {};
                    currentData.forEach(item => {
                      const key = item.description || 'Other';
                      currentGroups[key] = (currentGroups[key] || 0) + item.total;
                    });

                    const prevGroups: Record<string, number> = {};
                    prevData.forEach(item => {
                      const key = item.description || 'Other';
                      prevGroups[key] = (prevGroups[key] || 0) + item.total;
                    });

                    const allKeys = new Set([...Object.keys(currentGroups), ...Object.keys(prevGroups)]);
                    costItems = Array.from(allKeys).map(key => ({
                      label: key,
                      current: Math.abs(currentGroups[key] || 0),
                      prev: Math.abs(prevGroups[key] || 0)
                    }));
                  } else if (comparisonDetailType === 'inventory') {
                    // Calculate inventory fee details
                    const currentData = allData.filter(item => {
                      if (dateRange.start && item.date < new Date(dateRange.start)) return false;
                      if (dateRange.end && item.date > new Date(dateRange.end)) return false;
                      return item.categoryType === 'FBA Inventory Fee';
                    });

                    const prevData = allData.filter(item =>
                      item.date >= compRange.start && item.date <= compRange.end && item.categoryType === 'FBA Inventory Fee'
                    );

                    const currentGroups: Record<string, number> = {};
                    currentData.forEach(item => {
                      const key = item.description || 'Partner Carrier Fee';
                      currentGroups[key] = (currentGroups[key] || 0) + item.total;
                    });

                    const prevGroups: Record<string, number> = {};
                    prevData.forEach(item => {
                      const key = item.description || 'Partner Carrier Fee';
                      prevGroups[key] = (prevGroups[key] || 0) + item.total;
                    });

                    const allKeys = new Set([...Object.keys(currentGroups), ...Object.keys(prevGroups)]);
                    costItems = Array.from(allKeys).map(key => ({
                      label: key,
                      current: Math.abs(currentGroups[key] || 0),
                      prev: Math.abs(prevGroups[key] || 0)
                    }));
                  } else if (comparisonDetailType === 'service') {
                    // Calculate service fee details (excluding advertising)
                    const currentData = allData.filter(item => {
                      if (dateRange.start && item.date < new Date(dateRange.start)) return false;
                      if (dateRange.end && item.date > new Date(dateRange.end)) return false;
                      if (item.categoryType !== 'Service Fee') return false;
                      const isAd = item.descriptionLower.includes('cost of advertising') ||
                                   item.descriptionLower.includes('werbekosten') ||
                                   item.descriptionLower.includes('prix de la publicité') ||
                                   item.descriptionLower.includes('pubblicità') ||
                                   item.descriptionLower.includes('gastos de publicidad');
                      return !isAd;
                    });

                    const prevData = allData.filter(item => {
                      if (item.date < compRange.start || item.date > compRange.end) return false;
                      if (item.categoryType !== 'Service Fee') return false;
                      const isAd = item.descriptionLower.includes('cost of advertising') ||
                                   item.descriptionLower.includes('werbekosten') ||
                                   item.descriptionLower.includes('prix de la publicité') ||
                                   item.descriptionLower.includes('pubblicità') ||
                                   item.descriptionLower.includes('gastos de publicidad');
                      return !isAd;
                    });

                    const currentGroups: Record<string, number> = {};
                    currentData.forEach(item => {
                      const key = item.description || 'Other';
                      currentGroups[key] = (currentGroups[key] || 0) + item.total;
                    });

                    const prevGroups: Record<string, number> = {};
                    prevData.forEach(item => {
                      const key = item.description || 'Other';
                      prevGroups[key] = (prevGroups[key] || 0) + item.total;
                    });

                    const allKeys = new Set([...Object.keys(currentGroups), ...Object.keys(prevGroups)]);
                    costItems = Array.from(allKeys).map(key => ({
                      label: key,
                      current: Math.abs(currentGroups[key] || 0),
                      prev: Math.abs(prevGroups[key] || 0)
                    }));
                  } else if (comparisonDetailType === 'fbaCostBreakdown') {
                    // Calculate FBA Cost breakdown - aggregate categories
                    const currentData = allData.filter(item => {
                      if (dateRange.start && item.date < new Date(dateRange.start)) return false;
                      if (dateRange.end && item.date > new Date(dateRange.end)) return false;
                      return true;
                    });

                    const prevData = allData.filter(item =>
                      item.date >= compRange.start && item.date <= compRange.end
                    );

                    // Calculate current period costs
                    const currentAdjustment = Math.abs(currentData.filter(d => d.categoryType === 'Adjustment').reduce((sum, d) => sum + d.total, 0));
                    const currentInventory = Math.abs(currentData.filter(d => d.categoryType === 'FBA Inventory Fee').reduce((sum, d) => sum + d.total, 0));
                    const currentChargeback = Math.abs(currentData.filter(d => d.categoryType === 'Chargeback Refund').reduce((sum, d) => sum + d.total, 0));
                    const currentService = Math.abs(currentData.filter(d => {
                      if (d.categoryType !== 'Service Fee') return false;
                      const isAd = d.descriptionLower.includes('cost of advertising') ||
                                   d.descriptionLower.includes('werbekosten') ||
                                   d.descriptionLower.includes('prix de la publicité') ||
                                   d.descriptionLower.includes('pubblicità') ||
                                   d.descriptionLower.includes('gastos de publicidad');
                      return !isAd;
                    }).reduce((sum, d) => sum + d.total, 0));
                    const currentFbaTransactionFees = Math.abs(currentData.filter(d => d.categoryType === 'FBA Transaction Fee').reduce((sum, d) => sum + d.total, 0));
                    const currentFeeAdjustments = Math.abs(currentData.filter(d => d.categoryType === 'Fee Adjustment').reduce((sum, d) => sum + d.total, 0));
                    const currentSafet = Math.abs(currentData.filter(d => d.categoryType === 'SAFE-T Reimbursement').reduce((sum, d) => sum + d.total, 0));
                    const currentLiquidations = config?.hasLiquidations
                      ? Math.abs(currentData.filter(d => d.categoryType === 'Liquidations').reduce((sum, d) => sum + d.total, 0))
                      : 0;

                    // Calculate previous period costs
                    const prevAdjustment = Math.abs(prevData.filter(d => d.categoryType === 'Adjustment').reduce((sum, d) => sum + d.total, 0));
                    const prevInventory = Math.abs(prevData.filter(d => d.categoryType === 'FBA Inventory Fee').reduce((sum, d) => sum + d.total, 0));
                    const prevChargeback = Math.abs(prevData.filter(d => d.categoryType === 'Chargeback Refund').reduce((sum, d) => sum + d.total, 0));
                    const prevService = Math.abs(prevData.filter(d => {
                      if (d.categoryType !== 'Service Fee') return false;
                      const isAd = d.descriptionLower.includes('cost of advertising') ||
                                   d.descriptionLower.includes('werbekosten') ||
                                   d.descriptionLower.includes('prix de la publicité') ||
                                   d.descriptionLower.includes('pubblicità') ||
                                   d.descriptionLower.includes('gastos de publicidad');
                      return !isAd;
                    }).reduce((sum, d) => sum + d.total, 0));
                    const prevFbaTransactionFees = Math.abs(prevData.filter(d => d.categoryType === 'FBA Transaction Fee').reduce((sum, d) => sum + d.total, 0));
                    const prevFeeAdjustments = Math.abs(prevData.filter(d => d.categoryType === 'Fee Adjustment').reduce((sum, d) => sum + d.total, 0));
                    const prevSafet = Math.abs(prevData.filter(d => d.categoryType === 'SAFE-T Reimbursement').reduce((sum, d) => sum + d.total, 0));
                    const prevLiquidations = config?.hasLiquidations
                      ? Math.abs(prevData.filter(d => d.categoryType === 'Liquidations').reduce((sum, d) => sum + d.total, 0))
                      : 0;

                    costItems = [
                      { label: 'Adjustment', current: currentAdjustment, prev: prevAdjustment },
                      { label: 'FBA Inventory Fee', current: currentInventory, prev: prevInventory },
                      { label: 'Chargeback Refund', current: currentChargeback, prev: prevChargeback },
                      { label: 'Service Fee', current: currentService, prev: prevService },
                      { label: 'FBA Transaction Fee', current: currentFbaTransactionFees, prev: prevFbaTransactionFees },
                      { label: 'Fee Adjustment', current: currentFeeAdjustments, prev: prevFeeAdjustments },
                      { label: 'SAFE-T Reimbursement', current: currentSafet, prev: prevSafet },
                    ];

                    if (config?.hasLiquidations) {
                      costItems.push({ label: 'Liquidations', current: currentLiquidations, prev: prevLiquidations });
                    }

                    // Filter out zero items
                    costItems = costItems.filter(item => item.current > 0 || item.prev > 0);
                  }

                  // Sort by current value
                  costItems.sort((a, b) => b.current - a.current);

                  return costItems.map((item, idx) => {
                    const change = item.prev !== 0 ? ((item.current - item.prev) / item.prev * 100) : 0;
                    const isIncrease = item.current > item.prev;

                    return (
                      <div key={idx} className="bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-slate-700 text-sm">{translateDescription(item.label)}</h5>
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            isIncrease ? 'bg-red-100 text-red-700' : item.current < item.prev ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {item.prev !== 0 ? `${isIncrease ? '+' : ''}${change.toFixed(1)}%` : 'N/A'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-blue-50 rounded p-3">
                            <p className="text-xs text-blue-600 mb-1">Mevcut Dönem</p>
                            <p className="text-lg font-bold text-blue-900">{formatMoney(item.current)}</p>
                          </div>
                          <div className="bg-slate-100 rounded p-3">
                            <p className="text-xs text-slate-600 mb-1">Önceki Dönem</p>
                            <p className="text-lg font-bold text-slate-700">{formatMoney(item.prev)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AmazonTransactionAnalyzer as typeof AmazonTransactionAnalyzer & { displayName: 'TransactionAnalyzer' };

// Alternative named export
export { AmazonTransactionAnalyzer as TransactionAnalyzer };