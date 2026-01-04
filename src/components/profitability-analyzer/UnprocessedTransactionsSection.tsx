import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, HelpCircle, CheckCircle } from 'lucide-react';
import type { TransactionData } from '../../types/transaction';

interface UnprocessedTransactionsSectionProps {
  transactions: TransactionData[];
  formatMoney: (amount: number) => string;
}

interface UnprocessedGroup {
  categoryType: string;
  count: number;
  total: number;
  descriptions: Map<string, { count: number; total: number }>;
}

// Known/expected category types in the system (including multi-language variations)
const KNOWN_CATEGORY_TYPES = new Set([
  'Order',
  'Refund',
  'Disbursement',
  'Adjustment',
  'Amazon Fees',
  'Chargeback Refund',
  'FBA Inventory Fee',
  'FBA Customer Return Fee',
  'FBA Transaction Fee',
  'Fee Adjustment',
  'SAFE-T Reimbursement',
  'Shipping Services',
  'Delivery Services',
  'Lieferdienste',            // DE
  'Services de livraison',    // FR
  'Servizi di consegna',      // IT
  'Servicios de entrega',     // ES
  'Liquidations',
  'Commingling VAT',
  'Service Fee',
  'Others',
  'Other',
]);

export const UnprocessedTransactionsSection: React.FC<UnprocessedTransactionsSectionProps> = React.memo(({
  transactions,
  formatMoney,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Find unknown/unexpected category types
  const unknownCategoryData = useMemo(() => {
    const unknownMap = new Map<string, UnprocessedGroup>();
    let totalUnknown = 0;
    let totalCount = 0;

    transactions.forEach(t => {
      const categoryType = t.categoryType || 'Unknown';

      // Skip known category types
      if (KNOWN_CATEGORY_TYPES.has(categoryType)) return;

      const description = t.description || 'No description';
      const total = t.total || 0;

      totalUnknown += total;
      totalCount++;

      if (!unknownMap.has(categoryType)) {
        unknownMap.set(categoryType, {
          categoryType,
          count: 0,
          total: 0,
          descriptions: new Map(),
        });
      }

      const group = unknownMap.get(categoryType)!;
      group.count++;
      group.total += total;

      // Group by description within category
      if (!group.descriptions.has(description)) {
        group.descriptions.set(description, { count: 0, total: 0 });
      }
      const descGroup = group.descriptions.get(description)!;
      descGroup.count++;
      descGroup.total += total;
    });

    // Convert to array and sort by count (most frequent first)
    const categories = Array.from(unknownMap.values())
      .sort((a, b) => b.count - a.count);

    return {
      totalUnknown,
      totalCount,
      categories,
    };
  }, [transactions]);

  // Don't render if no unknown categories found - show success state instead
  if (unknownCategoryData.totalCount === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 mb-4">
        <CheckCircle className="w-4 h-4" />
        <span>Tüm satırlar bilinen kategorilerde ({transactions.length.toLocaleString()} satır)</span>
      </div>
    );
  }

  const toggleCategory = (categoryType: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryType)) {
        next.delete(categoryType);
      } else {
        next.add(categoryType);
      }
      return next;
    });
  };

  // Determine color based on total value
  const totalColor = unknownCategoryData.totalUnknown >= 0 ? 'text-green-700' : 'text-red-700';

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl mb-4">
      {/* Clickable Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/30 rounded-xl transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <HelpCircle className="w-5 h-5 text-amber-600" />
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-800">Bilinmeyen Kategoriler</span>
          <ChevronRight className={`w-4 h-4 text-amber-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
        {/* Summary - always visible */}
        <div className="flex-1 flex items-center justify-between">
          <span className="text-sm text-amber-700">
            {unknownCategoryData.totalCount.toLocaleString()} satır, {unknownCategoryData.categories.length} yeni kategori
          </span>
          <span className={`text-sm font-semibold ${totalColor}`}>
            {formatMoney(unknownCategoryData.totalUnknown)}
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="text-xs text-amber-700 mb-3">
            Bu kategoriler sistemde tanımlı değil. Amazon yeni bir işlem tipi eklemiş olabilir. Kod güncellemesi gerekebilir.
          </div>

          <div className="bg-white/50 rounded-lg border border-amber-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-amber-100/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-amber-800">Category (type)</th>
                  <th className="text-right px-3 py-2 font-medium text-amber-800">Rows</th>
                  <th className="text-right px-3 py-2 font-medium text-amber-800">Total</th>
                </tr>
              </thead>
              <tbody>
                {unknownCategoryData.categories.map((category, idx) => {
                  const isExpanded = expandedCategories.has(category.categoryType);
                  const categoryTotalColor = category.total >= 0 ? 'text-green-700' : 'text-red-700';

                  // Sort descriptions by count
                  const sortedDescriptions = Array.from(category.descriptions.entries())
                    .sort((a, b) => b[1].count - a[1].count);

                  return (
                    <React.Fragment key={category.categoryType}>
                      {/* Category Row */}
                      <tr
                        className={`${idx % 2 === 0 ? 'bg-white/30' : 'bg-amber-50/30'} hover:bg-blue-50/50 cursor-pointer`}
                        onClick={() => toggleCategory(category.categoryType)}
                      >
                        <td className="px-3 py-2 font-medium text-slate-800">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-amber-500" />
                            )}
                            <code className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px]">
                              {category.categoryType}
                            </code>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {category.count.toLocaleString()}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${categoryTotalColor}`}>
                          {formatMoney(category.total)}
                        </td>
                      </tr>

                      {/* Description Rows (when expanded) */}
                      {isExpanded && sortedDescriptions.map(([description, data], descIdx) => {
                        const descTotalColor = data.total >= 0 ? 'text-green-600' : 'text-red-600';
                        return (
                          <tr
                            key={`${category.categoryType}-${descIdx}`}
                            className="bg-amber-50/30"
                          >
                            <td className="px-3 py-1.5 pl-8 text-slate-600 truncate max-w-[300px]" title={description}>
                              {description}
                            </td>
                            <td className="px-3 py-1.5 text-right text-slate-500">
                              {data.count.toLocaleString()}
                            </td>
                            <td className={`px-3 py-1.5 text-right ${descTotalColor}`}>
                              {formatMoney(data.total)}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-amber-100/50 border-t border-amber-200">
                <tr>
                  <td className="px-3 py-2 font-semibold text-amber-800">Total</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-700">
                    {unknownCategoryData.totalCount.toLocaleString()}
                  </td>
                  <td className={`px-3 py-2 text-right font-bold ${totalColor}`}>
                    {formatMoney(unknownCategoryData.totalUnknown)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});

UnprocessedTransactionsSection.displayName = 'UnprocessedTransactionsSection';
