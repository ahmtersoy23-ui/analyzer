/**
 * QueryBuilder - Natural language query interface for Trends Analyzer
 * Rule-based query system with predefined templates
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Search, Sparkles, ArrowRight, X, Clock, TrendingDown, TrendingUp, Globe, Package, Layers } from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type QueryMetric =
  | 'revenue'
  | 'profit'
  | 'orders'
  | 'quantity'
  | 'refundRate'
  | 'avgOrderValue'
  | 'sellingFees'
  | 'fbaFees';

export type QueryGroupBy = 'country' | 'category' | 'sku' | 'product' | 'fulfillment';
export type QuerySort = 'asc' | 'desc';
export type QueryDatePreset = 'last7days' | 'last30days' | 'last90days' | 'lastMonth' | 'last3months' | 'lastYear' | 'custom';

export interface QueryParams {
  metric: QueryMetric;
  groupBy: QueryGroupBy;
  filters: {
    marketplace?: string[];
    fulfillment?: 'FBA' | 'FBM';
    category?: string;
  };
  sort: QuerySort;
  limit: number;
  datePreset: QueryDatePreset;
  customDateRange?: { start: string; end: string };
}

export interface QueryTemplate {
  id: string;
  label: string;
  labelTR: string;  // Turkish label
  description: string;
  icon: React.ReactNode;
  query: QueryParams;
  keywords: string[];  // For search matching
}

// ============================================
// QUERY TEMPLATES
// ============================================

export const QUERY_TEMPLATES: QueryTemplate[] = [
  // Top Performers
  {
    id: 'top-revenue-products',
    label: 'Top Revenue Products',
    labelTR: 'En Çok Gelir Getiren Ürünler',
    description: 'Products with highest revenue in selected period',
    icon: <TrendingUp className="w-4 h-4 text-green-500" />,
    query: {
      metric: 'revenue',
      groupBy: 'product',
      filters: {},
      sort: 'desc',
      limit: 10,
      datePreset: 'last30days'
    },
    keywords: ['top', 'best', 'revenue', 'gelir', 'en çok', 'ürün', 'product']
  },
  {
    id: 'top-revenue-countries',
    label: 'Top Revenue Countries',
    labelTR: 'En Çok Gelir Getiren Ülkeler',
    description: 'Marketplaces ranked by revenue',
    icon: <Globe className="w-4 h-4 text-blue-500" />,
    query: {
      metric: 'revenue',
      groupBy: 'country',
      filters: {},
      sort: 'desc',
      limit: 10,
      datePreset: 'last30days'
    },
    keywords: ['country', 'marketplace', 'ülke', 'pazar', 'revenue', 'gelir']
  },
  {
    id: 'top-categories',
    label: 'Top Categories',
    labelTR: 'En İyi Kategoriler',
    description: 'Best performing product categories',
    icon: <Layers className="w-4 h-4 text-purple-500" />,
    query: {
      metric: 'revenue',
      groupBy: 'category',
      filters: {},
      sort: 'desc',
      limit: 10,
      datePreset: 'last30days'
    },
    keywords: ['category', 'kategori', 'top', 'best', 'en iyi']
  },

  // Worst Performers (Loss Analysis)
  {
    id: 'worst-profit-products',
    label: 'Most Unprofitable Products',
    labelTR: 'En Çok Zarar Eden Ürünler',
    description: 'Products with lowest/negative profit margin',
    icon: <TrendingDown className="w-4 h-4 text-red-500" />,
    query: {
      metric: 'profit',
      groupBy: 'product',
      filters: {},
      sort: 'asc',
      limit: 10,
      datePreset: 'last30days'
    },
    keywords: ['loss', 'zarar', 'worst', 'kötü', 'unprofitable', 'negative']
  },
  {
    id: 'worst-profit-italy',
    label: 'Losing Products in Italy',
    labelTR: 'İtalya\'da Zarar Eden Ürünler',
    description: 'Products losing money in Italian marketplace',
    icon: <TrendingDown className="w-4 h-4 text-red-500" />,
    query: {
      metric: 'profit',
      groupBy: 'product',
      filters: { marketplace: ['IT'] },
      sort: 'asc',
      limit: 10,
      datePreset: 'last3months'
    },
    keywords: ['italy', 'italya', 'it', 'loss', 'zarar', 'losing']
  },
  {
    id: 'worst-profit-germany',
    label: 'Losing Products in Germany',
    labelTR: 'Almanya\'da Zarar Eden Ürünler',
    description: 'Products losing money in German marketplace',
    icon: <TrendingDown className="w-4 h-4 text-red-500" />,
    query: {
      metric: 'profit',
      groupBy: 'product',
      filters: { marketplace: ['DE'] },
      sort: 'asc',
      limit: 10,
      datePreset: 'last3months'
    },
    keywords: ['germany', 'almanya', 'de', 'loss', 'zarar', 'losing']
  },
  {
    id: 'worst-profit-uk',
    label: 'Losing Products in UK',
    labelTR: 'İngiltere\'de Zarar Eden Ürünler',
    description: 'Products losing money in UK marketplace',
    icon: <TrendingDown className="w-4 h-4 text-red-500" />,
    query: {
      metric: 'profit',
      groupBy: 'product',
      filters: { marketplace: ['UK'] },
      sort: 'asc',
      limit: 10,
      datePreset: 'last3months'
    },
    keywords: ['uk', 'ingiltere', 'loss', 'zarar', 'losing', 'britain']
  },

  // Refund Analysis
  {
    id: 'high-refund-rate',
    label: 'High Refund Rate Products',
    labelTR: 'Yüksek İade Oranlı Ürünler',
    description: 'Products with highest refund rates',
    icon: <TrendingDown className="w-4 h-4 text-orange-500" />,
    query: {
      metric: 'refundRate',
      groupBy: 'product',
      filters: {},
      sort: 'desc',
      limit: 10,
      datePreset: 'last30days'
    },
    keywords: ['refund', 'iade', 'return', 'high', 'yüksek']
  },
  {
    id: 'refund-by-country',
    label: 'Refund Rates by Country',
    labelTR: 'Ülkelere Göre İade Oranları',
    description: 'Compare refund rates across marketplaces',
    icon: <Globe className="w-4 h-4 text-orange-500" />,
    query: {
      metric: 'refundRate',
      groupBy: 'country',
      filters: {},
      sort: 'desc',
      limit: 10,
      datePreset: 'last30days'
    },
    keywords: ['refund', 'iade', 'country', 'ülke', 'compare']
  },

  // FBA vs FBM Analysis
  {
    id: 'fba-vs-fbm',
    label: 'FBA vs FBM Performance',
    labelTR: 'FBA vs FBM Performansı',
    description: 'Compare fulfillment method performance',
    icon: <Package className="w-4 h-4 text-cyan-500" />,
    query: {
      metric: 'revenue',
      groupBy: 'fulfillment',
      filters: {},
      sort: 'desc',
      limit: 10,
      datePreset: 'last30days'
    },
    keywords: ['fba', 'fbm', 'fulfillment', 'karşılaştır', 'compare']
  },
  {
    id: 'fba-profit',
    label: 'FBA Only Profits',
    labelTR: 'Sadece FBA Kârları',
    description: 'Profit analysis for FBA products',
    icon: <Package className="w-4 h-4 text-blue-500" />,
    query: {
      metric: 'profit',
      groupBy: 'product',
      filters: { fulfillment: 'FBA' },
      sort: 'desc',
      limit: 10,
      datePreset: 'last30days'
    },
    keywords: ['fba', 'profit', 'kâr', 'only', 'sadece']
  },

  // Time-based Queries
  {
    id: 'last-week-summary',
    label: 'Last 7 Days Summary',
    labelTR: 'Son 7 Günün Özeti',
    description: 'Quick summary of last week performance',
    icon: <Clock className="w-4 h-4 text-slate-500" />,
    query: {
      metric: 'revenue',
      groupBy: 'country',
      filters: {},
      sort: 'desc',
      limit: 10,
      datePreset: 'last7days'
    },
    keywords: ['week', 'hafta', '7', 'son', 'last', 'recent']
  },
  {
    id: 'last-month-products',
    label: 'Last Month Top Products',
    labelTR: 'Geçen Ay En İyi Ürünler',
    description: 'Best selling products in the last month',
    icon: <Clock className="w-4 h-4 text-slate-500" />,
    query: {
      metric: 'quantity',
      groupBy: 'product',
      filters: {},
      sort: 'desc',
      limit: 10,
      datePreset: 'lastMonth'
    },
    keywords: ['month', 'ay', 'geçen', 'last', 'product', 'ürün']
  },
  {
    id: 'quarterly-analysis',
    label: 'Last 3 Months Analysis',
    labelTR: 'Son 3 Ay Analizi',
    description: 'Quarterly performance breakdown',
    icon: <Clock className="w-4 h-4 text-slate-500" />,
    query: {
      metric: 'revenue',
      groupBy: 'category',
      filters: {},
      sort: 'desc',
      limit: 10,
      datePreset: 'last3months'
    },
    keywords: ['quarter', 'çeyrek', '3', 'month', 'ay', 'son']
  },

  // Fee Analysis
  {
    id: 'highest-fees',
    label: 'Highest Fee Products',
    labelTR: 'En Yüksek Komisyonlu Ürünler',
    description: 'Products with highest Amazon fees',
    icon: <TrendingDown className="w-4 h-4 text-red-500" />,
    query: {
      metric: 'sellingFees',
      groupBy: 'product',
      filters: {},
      sort: 'desc',
      limit: 10,
      datePreset: 'last30days'
    },
    keywords: ['fee', 'komisyon', 'ücret', 'highest', 'yüksek']
  },
];

// Country-specific template generator
export const getCountrySpecificTemplates = (marketplace: string): QueryTemplate[] => {
  const countryNames: Record<string, { en: string; tr: string }> = {
    US: { en: 'United States', tr: 'Amerika' },
    UK: { en: 'United Kingdom', tr: 'İngiltere' },
    DE: { en: 'Germany', tr: 'Almanya' },
    FR: { en: 'France', tr: 'Fransa' },
    IT: { en: 'Italy', tr: 'İtalya' },
    ES: { en: 'Spain', tr: 'İspanya' },
    CA: { en: 'Canada', tr: 'Kanada' },
    AU: { en: 'Australia', tr: 'Avustralya' },
  };

  const country = countryNames[marketplace] || { en: marketplace, tr: marketplace };

  return [
    {
      id: `loss-${marketplace.toLowerCase()}`,
      label: `Losing Products in ${country.en}`,
      labelTR: `${country.tr}'da Zarar Eden Ürünler`,
      description: `Products losing money in ${country.en}`,
      icon: <TrendingDown className="w-4 h-4 text-red-500" />,
      query: {
        metric: 'profit',
        groupBy: 'product',
        filters: { marketplace: [marketplace] },
        sort: 'asc',
        limit: 10,
        datePreset: 'last3months'
      },
      keywords: [marketplace.toLowerCase(), country.en.toLowerCase(), country.tr.toLowerCase(), 'loss', 'zarar']
    },
    {
      id: `top-${marketplace.toLowerCase()}`,
      label: `Top Products in ${country.en}`,
      labelTR: `${country.tr}'da En İyi Ürünler`,
      description: `Best selling products in ${country.en}`,
      icon: <TrendingUp className="w-4 h-4 text-green-500" />,
      query: {
        metric: 'revenue',
        groupBy: 'product',
        filters: { marketplace: [marketplace] },
        sort: 'desc',
        limit: 10,
        datePreset: 'last30days'
      },
      keywords: [marketplace.toLowerCase(), country.en.toLowerCase(), country.tr.toLowerCase(), 'top', 'best', 'en iyi']
    }
  ];
};

// ============================================
// PROPS
// ============================================

interface QueryBuilderProps {
  onQuerySelect: (query: QueryParams) => void;
  availableMarketplaces: string[];
  recentQueries?: QueryParams[];
}

// ============================================
// COMPONENT
// ============================================

export const QueryBuilder: React.FC<QueryBuilderProps> = ({
  onQuerySelect,
  availableMarketplaces,
  recentQueries = []
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate all templates including country-specific ones
  const allTemplates = useMemo(() => {
    const countryTemplates = availableMarketplaces.flatMap(mp => getCountrySpecificTemplates(mp));
    return [...QUERY_TEMPLATES, ...countryTemplates];
  }, [availableMarketplaces]);

  // Filter templates based on search input
  const filteredTemplates = useMemo(() => {
    if (!searchInput.trim()) {
      return QUERY_TEMPLATES.slice(0, 6); // Show first 6 default templates
    }

    const searchTerms = searchInput.toLowerCase().split(/\s+/);

    return allTemplates.filter(template => {
      const searchText = [
        template.label.toLowerCase(),
        template.labelTR.toLowerCase(),
        template.description.toLowerCase(),
        ...template.keywords
      ].join(' ');

      return searchTerms.every(term => searchText.includes(term));
    }).slice(0, 8);
  }, [searchInput, allTemplates]);

  const handleTemplateClick = useCallback((template: QueryTemplate) => {
    onQuerySelect(template.query);
    setSearchInput('');
    setIsExpanded(false);
  }, [onQuerySelect]);

  const handleInputFocus = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleClear = useCallback(() => {
    setSearchInput('');
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
      {/* Search Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Quick Analysis</h2>
          <p className="text-sm text-slate-500">Search or select a query template</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onFocus={handleInputFocus}
          placeholder="Search... (e.g., 'italya zarar' or 'top products germany')"
          className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        />
        {searchInput && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Query Templates Grid */}
      {(isExpanded || searchInput) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTemplates.map(template => (
            <button
              key={template.id}
              onClick={() => handleTemplateClick(template)}
              className="flex items-start gap-3 p-3 text-left bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-lg transition-all group"
            >
              <div className="flex-shrink-0 p-2 bg-white rounded-lg shadow-sm group-hover:shadow">
                {template.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-800 group-hover:text-purple-700 truncate">
                  {template.labelTR}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {template.label}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-500 flex-shrink-0 mt-1" />
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {searchInput && filteredTemplates.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No matching queries found</p>
          <p className="text-xs text-slate-400 mt-1">Try different keywords like "zarar", "top", "refund"</p>
        </div>
      )}

      {/* Quick Suggestions when not expanded */}
      {!isExpanded && !searchInput && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-500 py-1">Popular:</span>
          {QUERY_TEMPLATES.slice(0, 4).map(template => (
            <button
              key={template.id}
              onClick={() => handleTemplateClick(template)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-700 rounded-full transition-colors"
            >
              {template.icon}
              {template.labelTR}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default QueryBuilder;
