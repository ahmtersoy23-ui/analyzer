/**
 * Period Comparison Analyzer
 * Compares two custom date periods with daily data visualization
 * Useful for comparing sales seasons (e.g., Hijri calendar periods)
 */

import React, { useState, useMemo, useRef } from 'react';
import { Calendar, Filter, CalendarDays, TrendingUp, TrendingDown, Minus, FileDown, Rewind, History } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { TransactionData } from '../../types/transaction';
import { convertCurrency, getMarketplaceCurrency } from '../../utils/currencyExchange';
import { createMoneyFormatter } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

interface DailyData {
  dayIndex: number;
  date: string;
  label: string;
  [key: string]: number | string;
}

type MetricType = 'orders' | 'quantity' | 'revenue';

interface PeriodComparisonAnalyzerProps {
  transactionData: TransactionData[];
}

interface PeriodSummary {
  totalOrders: number;
  totalQuantity: number;
  totalRevenue: number;
  avgDailyOrders: number;
  avgDailyRevenue: number;
  days: number;
}

// ============================================
// CONSTANTS
// ============================================

const COUNTRY_COLORS: Record<string, string> = {
  US: '#22c55e', // green
  UK: '#eab308', // yellow
  DE: '#3b82f6', // blue
  FR: '#8b5cf6', // purple
  IT: '#f97316', // orange
  ES: '#ef4444', // red
  CA: '#ec4899', // pink
  AU: '#06b6d4', // cyan
  AE: '#84cc16', // lime
  SA: '#6366f1', // indigo
  SG: '#14b8a6', // teal
  TR: '#f43f5e', // rose
};

// Dynamic grouping colors (for category, parent, product)
const DYNAMIC_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#8b5cf6', // purple
  '#ef4444', // red
  '#eab308', // yellow
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#6366f1', // indigo
];
const OTHER_COLOR = '#94a3b8'; // slate for "Other"

type GroupByType = 'country' | 'category' | 'parent' | 'product';

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatDateForDisplay = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getDaysBetween = (start: string, end: string): string[] => {
  const days: string[] = [];
  const startDate = new Date(start);
  const endDate = new Date(end);

  const current = new Date(startDate);
  while (current <= endDate) {
    days.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return days;
};

// ============================================
// COMPONENT
// ============================================

const PeriodComparisonAnalyzer: React.FC<PeriodComparisonAnalyzerProps> = ({ transactionData }) => {
  // Ref for PDF export
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Period 1 (Top chart)
  const [period1Start, setPeriod1Start] = useState<string>('');
  const [period1End, setPeriod1End] = useState<string>('');

  // Period 2 (Bottom chart)
  const [period2Start, setPeriod2Start] = useState<string>('');
  const [period2End, setPeriod2End] = useState<string>('');

  // Shared filters
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedParentAsins, setSelectedParentAsins] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedFulfillment, setSelectedFulfillment] = useState<string>('all');
  const [metric, setMetric] = useState<MetricType>('orders');

  // Chart grouping - auto-determined or user override
  const [groupByOverride, setGroupByOverride] = useState<GroupByType | null>(null);

  // UI state
  const [showMarketplaceDropdown, setShowMarketplaceDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showParentAsinDropdown, setShowParentAsinDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Ref for PDF export content (excludes filters)
  const pdfContentRef = useRef<HTMLDivElement>(null);

  const formatMoney = createMoneyFormatter('USD');

  // Get date range from transactions
  const dateRange = useMemo(() => {
    let minDate: string | null = null;
    let maxDate: string | null = null;

    transactionData.forEach(tx => {
      const dateStr = tx.dateOnly || (tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : new Date(tx.date).toISOString().split('T')[0]);
      if (!minDate || dateStr < minDate) minDate = dateStr;
      if (!maxDate || dateStr > maxDate) maxDate = dateStr;
    });

    return { minDate, maxDate };
  }, [transactionData]);

  // Get unique values for filters
  const { marketplaces, categories, parentAsins, products } = useMemo(() => {
    const mpSet = new Set<string>();
    const catSet = new Set<string>();
    const parentSet = new Set<string>();
    const skuSet = new Set<string>();

    transactionData.forEach(tx => {
      if (tx.marketplaceCode) mpSet.add(tx.marketplaceCode);
      if (tx.productCategory) catSet.add(tx.productCategory);
      if (tx.parent) parentSet.add(tx.parent);
      if (tx.name) skuSet.add(tx.name);
    });

    return {
      marketplaces: Array.from(mpSet).sort(),
      categories: Array.from(catSet).sort(),
      parentAsins: Array.from(parentSet).sort(),
      products: Array.from(skuSet).sort(),
    };
  }, [transactionData]);

  // Filter orders based on shared filters (excluding date)
  const baseFilteredOrders = useMemo(() => {
    return transactionData.filter(tx => {
      if (tx.categoryType !== 'Order') return false;
      if (selectedMarketplaces.length > 0 && !selectedMarketplaces.includes(tx.marketplaceCode || '')) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(tx.productCategory || '')) return false;
      if (selectedParentAsins.length > 0 && !selectedParentAsins.includes(tx.parent || '')) return false;
      if (selectedProducts.length > 0 && !selectedProducts.includes(tx.name || '')) return false;
      if (selectedFulfillment !== 'all' && tx.fulfillment !== selectedFulfillment) return false;
      return true;
    });
  }, [transactionData, selectedMarketplaces, selectedCategories, selectedParentAsins, selectedProducts, selectedFulfillment]);

  // Toggle functions
  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat)
        ? prev.filter(c => c !== cat)
        : [...prev, cat]
    );
  };

  const toggleParentAsin = (asin: string) => {
    setSelectedParentAsins(prev =>
      prev.includes(asin)
        ? prev.filter(a => a !== asin)
        : [...prev, asin]
    );
  };

  const toggleProduct = (product: string) => {
    setSelectedProducts(prev =>
      prev.includes(product)
        ? prev.filter(p => p !== product)
        : [...prev, product]
    );
  };

  // Close all dropdowns
  const closeAllDropdowns = () => {
    setShowMarketplaceDropdown(false);
    setShowCategoryDropdown(false);
    setShowParentAsinDropdown(false);
    setShowProductDropdown(false);
  };

  // Period 2 quick select: Previous Period (same duration, right before period 1)
  const setPeriod2AsPreviousPeriod = () => {
    if (!period1Start || !period1End) return;

    const start = new Date(period1Start);
    const end = new Date(period1End);
    const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1; // days

    const newEnd = new Date(start);
    newEnd.setDate(newEnd.getDate() - 1); // day before period1Start

    const newStart = new Date(newEnd);
    newStart.setDate(newStart.getDate() - duration + 1);

    setPeriod2Start(newStart.toISOString().split('T')[0]);
    setPeriod2End(newEnd.toISOString().split('T')[0]);
  };

  // Period 2 quick select: Previous Year (same dates, 1 year earlier)
  const setPeriod2AsPreviousYear = () => {
    if (!period1Start || !period1End) return;

    const start = new Date(period1Start);
    const end = new Date(period1End);

    start.setFullYear(start.getFullYear() - 1);
    end.setFullYear(end.getFullYear() - 1);

    setPeriod2Start(start.toISOString().split('T')[0]);
    setPeriod2End(end.toISOString().split('T')[0]);
  };

  // Determine chart groupBy based on filter state
  const effectiveGroupBy = useMemo((): GroupByType => {
    if (groupByOverride) return groupByOverride;

    // Hierarchy: product selected → country, parent selected → product, category selected → parent, else → country
    if (selectedProducts.length > 0) return 'country';
    if (selectedParentAsins.length > 0) return 'product';
    if (selectedCategories.length > 0) return 'parent';
    return 'country';
  }, [groupByOverride, selectedProducts, selectedParentAsins, selectedCategories]);

  // Available groupBy options based on filter state
  const availableGroupByOptions = useMemo((): GroupByType[] => {
    if (selectedProducts.length > 0) return ['country'];
    if (selectedParentAsins.length > 0) return ['country', 'product'];
    if (selectedCategories.length > 0) return ['country', 'parent'];
    return ['country', 'category'];
  }, [selectedProducts, selectedParentAsins, selectedCategories]);

  // Build filter status text for PDF
  const filterStatusText = useMemo(() => {
    const parts: string[] = [];

    if (selectedMarketplaces.length > 0) {
      parts.push(`Countries: ${selectedMarketplaces.join(', ')}`);
    }
    if (selectedCategories.length > 0) {
      parts.push(`Categories: ${selectedCategories.join(', ')}`);
    }
    if (selectedParentAsins.length > 0) {
      parts.push(`Parent: ${selectedParentAsins.length > 2 ? `${selectedParentAsins.length} selected` : selectedParentAsins.join(', ')}`);
    }
    if (selectedProducts.length > 0) {
      parts.push(`Products: ${selectedProducts.length > 2 ? `${selectedProducts.length} selected` : selectedProducts.join(', ')}`);
    }
    if (selectedFulfillment !== 'all') {
      parts.push(`Channel: ${selectedFulfillment}`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'All Data';
  }, [selectedMarketplaces, selectedCategories, selectedParentAsins, selectedProducts, selectedFulfillment]);

  // Get top N items by order count for dynamic grouping
  const getTopGroupItems = useMemo(() => {
    const countByGroup = new Map<string, number>();

    baseFilteredOrders.forEach(tx => {
      let key: string | null = null;

      if (effectiveGroupBy === 'country') {
        key = tx.marketplaceCode || 'Unknown';
      } else if (effectiveGroupBy === 'category') {
        key = tx.productCategory || 'Unknown';
      } else if (effectiveGroupBy === 'parent') {
        key = tx.parent || 'Unknown';
      } else if (effectiveGroupBy === 'product') {
        key = tx.name || 'Unknown';
      }

      if (key) {
        countByGroup.set(key, (countByGroup.get(key) || 0) + 1);
      }
    });

    // Sort by count and get top 10
    const sorted = Array.from(countByGroup.entries())
      .sort((a, b) => b[1] - a[1]);

    const top10 = sorted.slice(0, 10).map(([key]) => key);
    const hasOther = sorted.length > 10;

    return { top10, hasOther };
  }, [baseFilteredOrders, effectiveGroupBy]);

  // Calculate daily data for a period with dynamic grouping
  const calculatePeriodData = (orders: TransactionData[], startDate: string, endDate: string): DailyData[] => {
    if (!startDate || !endDate) return [];

    const days = getDaysBetween(startDate, endDate);
    const { top10, hasOther } = getTopGroupItems;
    const allGroups = hasOther ? [...top10, 'Other'] : top10;

    const data: DailyData[] = days.map((date, index) => {
      const item: DailyData = {
        dayIndex: index + 1,
        date,
        label: formatDateForDisplay(date),
      };
      // Initialize all groups with 0
      allGroups.forEach(group => {
        item[group] = 0;
      });
      return item;
    });

    // Aggregate data by date and group
    orders.forEach(tx => {
      const txDate = tx.dateOnly || (tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : new Date(tx.date).toISOString().split('T')[0]);

      if (txDate < startDate || txDate > endDate) return;

      const dayIndex = days.indexOf(txDate);
      if (dayIndex === -1) return;

      // Determine group key
      let groupKey: string;
      if (effectiveGroupBy === 'country') {
        groupKey = tx.marketplaceCode || 'Unknown';
      } else if (effectiveGroupBy === 'category') {
        groupKey = tx.productCategory || 'Unknown';
      } else if (effectiveGroupBy === 'parent') {
        groupKey = tx.parent || 'Unknown';
      } else {
        groupKey = tx.name || 'Unknown';
      }

      // Map to "Other" if not in top 10
      if (!top10.includes(groupKey)) {
        groupKey = 'Other';
      }

      const current = (data[dayIndex][groupKey] as number) || 0;
      const country = tx.marketplaceCode || 'US';

      if (metric === 'orders') {
        data[dayIndex][groupKey] = current + 1;
      } else if (metric === 'quantity') {
        data[dayIndex][groupKey] = current + Math.abs(tx.quantity || 0);
      } else {
        const sourceCurrency = getMarketplaceCurrency(country);
        const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
        const usdRevenue = convertCurrency(localRevenue, sourceCurrency, 'USD');
        data[dayIndex][groupKey] = current + usdRevenue;
      }
    });

    return data;
  };

  // Calculate period summaries
  const calculateSummary = (orders: TransactionData[], startDate: string, endDate: string): PeriodSummary => {
    if (!startDate || !endDate) {
      return { totalOrders: 0, totalQuantity: 0, totalRevenue: 0, avgDailyOrders: 0, avgDailyRevenue: 0, days: 0 };
    }

    const days = getDaysBetween(startDate, endDate).length;
    let totalOrders = 0;
    let totalQuantity = 0;
    let totalRevenue = 0;

    orders.forEach(tx => {
      const txDate = tx.dateOnly || (tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : new Date(tx.date).toISOString().split('T')[0]);

      if (txDate < startDate || txDate > endDate) return;

      totalOrders++;
      totalQuantity += Math.abs(tx.quantity || 0);

      const country = tx.marketplaceCode || 'US';
      const sourceCurrency = getMarketplaceCurrency(country);
      const localRevenue = (tx.productSales || 0) - Math.abs(tx.promotionalRebates || 0);
      totalRevenue += convertCurrency(localRevenue, sourceCurrency, 'USD');
    });

    return {
      totalOrders,
      totalQuantity,
      totalRevenue,
      avgDailyOrders: days > 0 ? totalOrders / days : 0,
      avgDailyRevenue: days > 0 ? totalRevenue / days : 0,
      days,
    };
  };

  // Period 1 data
  const period1Data = useMemo(() => {
    return calculatePeriodData(baseFilteredOrders, period1Start, period1End);
  }, [baseFilteredOrders, period1Start, period1End, metric, getTopGroupItems, effectiveGroupBy]);

  // Period 2 data
  const period2Data = useMemo(() => {
    return calculatePeriodData(baseFilteredOrders, period2Start, period2End);
  }, [baseFilteredOrders, period2Start, period2End, metric, getTopGroupItems, effectiveGroupBy]);

  // Period summaries
  const period1Summary = useMemo(() => {
    return calculateSummary(baseFilteredOrders, period1Start, period1End);
  }, [baseFilteredOrders, period1Start, period1End]);

  const period2Summary = useMemo(() => {
    return calculateSummary(baseFilteredOrders, period2Start, period2End);
  }, [baseFilteredOrders, period2Start, period2End]);

  // Get active groups (groups with data) - dynamically based on groupBy
  const activeGroups = useMemo(() => {
    const { top10, hasOther } = getTopGroupItems;
    const allPossibleGroups = hasOther ? [...top10, 'Other'] : top10;
    const groupSet = new Set<string>();

    [...period1Data, ...period2Data].forEach(day => {
      allPossibleGroups.forEach(group => {
        if ((day[group] as number) > 0) {
          groupSet.add(group);
        }
      });
    });

    // Sort by total value across both periods (keep Other at end)
    const groupTotals = new Map<string, number>();
    [...period1Data, ...period2Data].forEach(day => {
      Array.from(groupSet).forEach(group => {
        const current = groupTotals.get(group) || 0;
        groupTotals.set(group, current + ((day[group] as number) || 0));
      });
    });

    return Array.from(groupSet).sort((a, b) => {
      // Keep "Other" at the end
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return (groupTotals.get(b) || 0) - (groupTotals.get(a) || 0);
    });
  }, [period1Data, period2Data, getTopGroupItems]);

  // Get color for a group
  const getGroupColor = (group: string, index: number): string => {
    if (group === 'Other') return OTHER_COLOR;
    if (effectiveGroupBy === 'country') {
      return COUNTRY_COLORS[group] || DYNAMIC_COLORS[index % DYNAMIC_COLORS.length];
    }
    return DYNAMIC_COLORS[index % DYNAMIC_COLORS.length];
  };

  // Calculate comparison metrics
  const comparison = useMemo(() => {
    if (period1Summary.days === 0 || period2Summary.days === 0) return null;

    const ordersChange = period1Summary.avgDailyOrders > 0
      ? ((period2Summary.avgDailyOrders - period1Summary.avgDailyOrders) / period1Summary.avgDailyOrders) * 100
      : 0;
    const revenueChange = period1Summary.avgDailyRevenue > 0
      ? ((period2Summary.avgDailyRevenue - period1Summary.avgDailyRevenue) / period1Summary.avgDailyRevenue) * 100
      : 0;

    // Absolute differences
    const ordersDiff = period2Summary.totalOrders - period1Summary.totalOrders;
    const revenueDiff = period2Summary.totalRevenue - period1Summary.totalRevenue;
    const avgOrdersDiff = period2Summary.avgDailyOrders - period1Summary.avgDailyOrders;
    const avgRevenueDiff = period2Summary.avgDailyRevenue - period1Summary.avgDailyRevenue;

    return { ordersChange, revenueChange, ordersDiff, revenueDiff, avgOrdersDiff, avgRevenueDiff };
  }, [period1Summary, period2Summary]);

  // Calculate shared Y-axis max for synchronized scales
  const sharedYAxisMax = useMemo(() => {
    let maxValue = 0;

    // Find max daily total from both periods
    const allData = [...period1Data, ...period2Data];
    allData.forEach(day => {
      const dayTotal = activeGroups.reduce((sum, group) => {
        return sum + ((day[group] as number) || 0);
      }, 0);
      if (dayTotal > maxValue) maxValue = dayTotal;
    });

    // Round up to nice number for better readability
    if (maxValue === 0) return 100;
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
    return Math.ceil(maxValue / magnitude) * magnitude;
  }, [period1Data, period2Data, activeGroups]);

  // PDF Export function
  const handleExportPDF = async () => {
    if (!pdfContentRef.current) return;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(pdfContentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Calculate dimensions to fit page with margins
      const marginX = 10;
      const marginY = 10;
      const availableWidth = pageWidth - (marginX * 2);
      const availableHeight = pageHeight - (marginY * 2);

      const imgRatio = canvas.width / canvas.height;
      const pageRatio = availableWidth / availableHeight;

      let finalWidth, finalHeight;

      if (imgRatio > pageRatio) {
        // Image is wider than page ratio - fit to width
        finalWidth = availableWidth;
        finalHeight = availableWidth / imgRatio;
      } else {
        // Image is taller than page ratio - fit to height
        finalHeight = availableHeight;
        finalWidth = availableHeight * imgRatio;
      }

      // Center the image
      const xOffset = marginX + (availableWidth - finalWidth) / 2;
      const yOffset = marginY + (availableHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);

      const fileName = `period-comparison-${period1Start}-vs-${period2Start}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Toggle marketplace selection
  const toggleMarketplace = (mp: string) => {
    setSelectedMarketplaces(prev =>
      prev.includes(mp)
        ? prev.filter(m => m !== mp)
        : [...prev, mp]
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);

    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
        <div className="font-medium text-slate-800 mb-2">{label}</div>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            entry.value > 0 && (
              <div key={index} className="flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: entry.fill }}
                  />
                  <span className="text-slate-600">{entry.dataKey}</span>
                </div>
                <span className="font-medium text-slate-800">
                  {metric === 'revenue' ? formatMoney(entry.value) : entry.value.toLocaleString()}
                </span>
              </div>
            )
          ))}
        </div>
        <div className="border-t border-slate-100 mt-2 pt-2 flex justify-between text-sm font-medium">
          <span className="text-slate-600">Total</span>
          <span className="text-slate-800">
            {metric === 'revenue' ? formatMoney(total) : total.toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  const renderChangeIcon = (change: number) => {
    if (change > 5) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (change < -5) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="space-y-6" ref={contentRef}>
      {/* Header with Filters - NOT included in PDF */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Period Comparison Analysis</h2>
              <p className="text-sm text-slate-500">
                Compare two custom date ranges with daily breakdown by country
              </p>
            </div>
          </div>
          {/* PDF Export Button */}
          <button
            onClick={handleExportPDF}
            disabled={isExporting || (period1Data.length === 0 && period2Data.length === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileDown className="w-4 h-4" />
            {isExporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>

        {/* Shared Filters */}
        <div className="flex flex-wrap gap-4 mb-4">
          {/* Metric Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Metric:</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as MetricType)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="orders">Order Count</option>
              <option value="quantity">Product Quantity</option>
              <option value="revenue">Revenue (USD)</option>
            </select>
          </div>

          {/* Marketplace Multi-Select */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <button
                onClick={() => { closeAllDropdowns(); setShowMarketplaceDropdown(!showMarketplaceDropdown); }}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-[140px] text-left"
              >
                {selectedMarketplaces.length === 0
                  ? 'All Countries'
                  : `${selectedMarketplaces.length} selected`}
              </button>
            </div>
            {showMarketplaceDropdown && (
              <div className="absolute z-10 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px] max-h-64 overflow-y-auto">
                <button
                  onClick={() => setSelectedMarketplaces([])}
                  className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                    selectedMarketplaces.length === 0 ? 'text-indigo-600 font-medium' : 'text-slate-600'
                  }`}
                >
                  All Countries
                </button>
                <div className="border-t border-slate-100 my-1" />
                {marketplaces.map(mp => (
                  <label
                    key={mp}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMarketplaces.includes(mp)}
                      onChange={() => toggleMarketplace(mp)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: COUNTRY_COLORS[mp] || '#94a3b8' }}
                      />
                      <span className="text-sm text-slate-700">{mp}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Category Multi-Select */}
          {categories.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { closeAllDropdowns(); setShowCategoryDropdown(!showCategoryDropdown); }}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-[130px] text-left"
              >
                {selectedCategories.length === 0
                  ? 'All Categories'
                  : `${selectedCategories.length} cat.`}
              </button>
              {showCategoryDropdown && (
                <div className="absolute z-10 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[200px] max-h-64 overflow-y-auto">
                  <button
                    onClick={() => setSelectedCategories([])}
                    className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                      selectedCategories.length === 0 ? 'text-indigo-600 font-medium' : 'text-slate-600'
                    }`}
                  >
                    All Categories
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  {categories.map(cat => (
                    <label
                      key={cat}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat)}
                        onChange={() => toggleCategory(cat)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700 truncate">{cat}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Parent ASIN Multi-Select */}
          {parentAsins.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { closeAllDropdowns(); setShowParentAsinDropdown(!showParentAsinDropdown); }}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-[120px] text-left"
              >
                {selectedParentAsins.length === 0
                  ? 'All Parents'
                  : `${selectedParentAsins.length} parent`}
              </button>
              {showParentAsinDropdown && (
                <div className="absolute z-10 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[200px] max-h-64 overflow-y-auto">
                  <button
                    onClick={() => setSelectedParentAsins([])}
                    className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                      selectedParentAsins.length === 0 ? 'text-indigo-600 font-medium' : 'text-slate-600'
                    }`}
                  >
                    All Parent ASINs
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  {parentAsins.map(asin => (
                    <label
                      key={asin}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedParentAsins.includes(asin)}
                        onChange={() => toggleParentAsin(asin)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700 font-mono truncate">{asin}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Product Multi-Select */}
          {products.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { closeAllDropdowns(); setShowProductDropdown(!showProductDropdown); }}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-[120px] text-left"
              >
                {selectedProducts.length === 0
                  ? 'All Products'
                  : `${selectedProducts.length} product`}
              </button>
              {showProductDropdown && (
                <div className="absolute z-10 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[300px] max-h-64 overflow-y-auto">
                  <button
                    onClick={() => setSelectedProducts([])}
                    className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                      selectedProducts.length === 0 ? 'text-indigo-600 font-medium' : 'text-slate-600'
                    }`}
                  >
                    All Products
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  {products.map(product => (
                    <label
                      key={product}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product)}
                        onChange={() => toggleProduct(product)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
                      />
                      <span className="text-sm text-slate-700 truncate" title={product}>{product}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fulfillment Filter */}
          <select
            value={selectedFulfillment}
            onChange={(e) => setSelectedFulfillment(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Channels</option>
            <option value="FBA">FBA</option>
            <option value="FBM">FBM</option>
          </select>
        </div>
      </div>

      {/* PDF CONTENT START - This is what gets exported */}
      <div ref={pdfContentRef} className="space-y-4 bg-slate-50 p-4 rounded-xl">
        {/* PDF Header - Title + Filter Status */}
        <div className="bg-white rounded-lg p-4 text-center">
          <h1 className="text-xl font-bold text-slate-800">Period Comparison Analysis</h1>
          <p className="text-sm text-slate-500 mt-1">{filterStatusText}</p>
          <p className="text-xs text-slate-400 mt-1">
            {metric === 'orders' ? 'Order Count' : metric === 'quantity' ? 'Product Quantity' : 'Revenue (USD)'}
          </p>
        </div>

      {/* Comparison Summary */}
      {comparison && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-sm text-slate-500 mb-1">Period 1 Total</div>
            <div className="text-xl font-bold text-slate-800">
              {period1Summary.totalOrders.toLocaleString()} orders
            </div>
            <div className="text-sm text-slate-500">{formatMoney(period1Summary.totalRevenue)}</div>
            <div className="text-xs text-slate-400 mt-1">
              ({period1Summary.days} days, avg {Math.round(period1Summary.avgDailyOrders)}/day)
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-sm text-slate-500 mb-1">Period 2 Total</div>
            <div className="text-xl font-bold text-slate-800">
              {period2Summary.totalOrders.toLocaleString()} orders
            </div>
            <div className="text-sm text-slate-500">{formatMoney(period2Summary.totalRevenue)}</div>
            <div className="text-xs text-slate-400 mt-1">
              ({period2Summary.days} days, avg {Math.round(period2Summary.avgDailyOrders)}/day)
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-sm text-slate-500 mb-1">Orders Change</div>
            <div className="flex items-center gap-2">
              {renderChangeIcon(comparison.ordersChange)}
              <span className={`text-xl font-bold ${
                comparison.ordersChange > 5 ? 'text-green-600' :
                comparison.ordersChange < -5 ? 'text-red-600' : 'text-slate-600'
              }`}>
                {comparison.ordersChange > 0 ? '+' : ''}{comparison.ordersChange.toFixed(1)}%
              </span>
            </div>
            <div className={`text-sm mt-1 ${comparison.ordersDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {comparison.ordersDiff >= 0 ? '+' : ''}{comparison.ordersDiff.toLocaleString()} orders
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-sm text-slate-500 mb-1">Revenue Change</div>
            <div className="flex items-center gap-2">
              {renderChangeIcon(comparison.revenueChange)}
              <span className={`text-xl font-bold ${
                comparison.revenueChange > 5 ? 'text-green-600' :
                comparison.revenueChange < -5 ? 'text-red-600' : 'text-slate-600'
              }`}>
                {comparison.revenueChange > 0 ? '+' : ''}{comparison.revenueChange.toFixed(1)}%
              </span>
            </div>
            <div className={`text-sm mt-1 ${comparison.revenueDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {comparison.revenueDiff >= 0 ? '+' : ''}{formatMoney(comparison.revenueDiff)}
            </div>
          </div>
        </div>
      )}

      {/* Period 1 Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
            Period 1
          </h3>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={period1Start}
              onChange={(e) => setPeriod1Start(e.target.value)}
              min={dateRange.minDate || undefined}
              max={dateRange.maxDate || undefined}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={period1End}
              onChange={(e) => setPeriod1End(e.target.value)}
              min={period1Start || dateRange.minDate || undefined}
              max={dateRange.maxDate || undefined}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {period1Summary.days > 0 && (
              <span className="text-xs text-slate-500 ml-2">
                ({period1Summary.days} days)
              </span>
            )}
          </div>
        </div>

        {period1Data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={period1Data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              barCategoryGap="5%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#64748b' }}
                interval={Math.max(0, Math.floor(period1Data.length / 15))}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                domain={[0, sharedYAxisMax]}
                tickFormatter={(value) => metric === 'revenue' ? `$${(value/1000).toFixed(0)}k` : value.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              {activeGroups.map((group, index) => (
                <Bar
                  key={group}
                  dataKey={group}
                  stackId="a"
                  fill={getGroupColor(group, index)}
                  maxBarSize={20}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-slate-400">
            Select date range for Period 1
          </div>
        )}
      </div>

      {/* Legend with GroupBy Toggle - Between Charts */}
      {activeGroups.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-center gap-6 mb-3">
            <span className="text-sm text-slate-500">Group by:</span>
            {availableGroupByOptions.map(opt => (
              <button
                key={opt}
                onClick={() => setGroupByOverride(opt)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  effectiveGroupBy === opt
                    ? 'bg-indigo-100 text-indigo-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt === 'country' ? 'Country' : opt === 'category' ? 'Category' : opt === 'parent' ? 'Parent' : 'Product'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {activeGroups.map((group, index) => (
              <div key={group} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: getGroupColor(group, index) }}
                />
                <span className="text-sm font-medium text-slate-700 truncate max-w-[150px]" title={group}>{group}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Period 2 Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            Period 2
          </h3>
          <div className="flex items-center gap-2">
            {/* Quick Select Buttons */}
            {period1Start && period1End && (
              <>
                <button
                  onClick={setPeriod2AsPreviousPeriod}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-50 text-orange-700 rounded hover:bg-orange-100 transition-colors"
                  title="Set to the period immediately before Period 1"
                >
                  <Rewind className="w-3 h-3" />
                  Prev Period
                </button>
                <button
                  onClick={setPeriod2AsPreviousYear}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors"
                  title="Set to the same dates one year earlier"
                >
                  <History className="w-3 h-3" />
                  Prev Year
                </button>
                <span className="text-slate-300">|</span>
              </>
            )}
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={period2Start}
              onChange={(e) => setPeriod2Start(e.target.value)}
              min={dateRange.minDate || undefined}
              max={dateRange.maxDate || undefined}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={period2End}
              onChange={(e) => setPeriod2End(e.target.value)}
              min={period2Start || dateRange.minDate || undefined}
              max={dateRange.maxDate || undefined}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {period2Summary.days > 0 && (
              <span className="text-xs text-slate-500 ml-2">
                ({period2Summary.days} days)
              </span>
            )}
          </div>
        </div>

        {period2Data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={period2Data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              barCategoryGap="5%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#64748b' }}
                interval={Math.max(0, Math.floor(period2Data.length / 15))}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                domain={[0, sharedYAxisMax]}
                tickFormatter={(value) => metric === 'revenue' ? `$${(value/1000).toFixed(0)}k` : value.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              {activeGroups.map((group, index) => (
                <Bar
                  key={group}
                  dataKey={group}
                  stackId="a"
                  fill={getGroupColor(group, index)}
                  maxBarSize={20}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-slate-400">
            Select date range for Period 2
          </div>
        )}
      </div>
      </div>{/* PDF CONTENT END */}
    </div>
  );
};

export default PeriodComparisonAnalyzer;
