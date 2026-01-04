/**
 * Data Consistency Check Component
 * Shows warnings when analyzer calculations don't match
 */

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, XCircle, Info } from 'lucide-react';
import { TransactionData, MarketplaceCode } from '../types/transaction';
import {
  calculateBaseMetrics,
  compareMetrics,
  ConsistencyCheckResult,
  AnalyzerMetrics
} from '../services/analytics/consistencyCheck';

interface DataConsistencyCheckProps {
  transactions: TransactionData[];
  analyzerMetrics: {
    transaction?: AnalyzerMetrics;
    profitability?: AnalyzerMetrics;
    product?: AnalyzerMetrics;
  };
  marketplace: MarketplaceCode | 'all';
  startDate: string | null;
  endDate: string | null;
}

const DataConsistencyCheck: React.FC<DataConsistencyCheckProps> = ({
  transactions,
  analyzerMetrics,
  marketplace,
  startDate,
  endDate
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate consistency check results
  const checkResults = useMemo(() => {
    if (transactions.length === 0) return null;

    const baseMetrics = calculateBaseMetrics(transactions, marketplace, startDate, endDate);
    const results: { name: string; result: ConsistencyCheckResult }[] = [];

    if (analyzerMetrics.transaction) {
      results.push({
        name: 'Transaction Analyzer',
        result: compareMetrics(baseMetrics, analyzerMetrics.transaction, 'Transaction Analyzer')
      });
    }

    if (analyzerMetrics.profitability) {
      results.push({
        name: 'Profitability Analyzer',
        result: compareMetrics(baseMetrics, analyzerMetrics.profitability, 'Profitability Analyzer')
      });
    }

    if (analyzerMetrics.product) {
      results.push({
        name: 'Product Analyzer',
        result: compareMetrics(baseMetrics, analyzerMetrics.product, 'Product Analyzer')
      });
    }

    return {
      baseMetrics,
      results,
      overallConsistent: results.every(r => r.result.isConsistent),
      hasErrors: results.some(r => r.result.checks.some(c => c.severity === 'error')),
      hasWarnings: results.some(r => r.result.checks.some(c => c.severity === 'warning'))
    };
  }, [transactions, analyzerMetrics, marketplace, startDate, endDate]);

  if (!checkResults || checkResults.results.length === 0) {
    return null;
  }

  // Don't show if everything is consistent
  if (checkResults.overallConsistent && !isExpanded) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm cursor-pointer hover:bg-green-100"
        onClick={() => setIsExpanded(true)}
      >
        <CheckCircle className="w-4 h-4" />
        <span>Data Consistent</span>
        <ChevronDown className="w-4 h-4 ml-auto" />
      </div>
    );
  }

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  return (
    <div className={`rounded-lg border ${
      checkResults.hasErrors ? 'bg-red-50 border-red-200' :
      checkResults.hasWarnings ? 'bg-amber-50 border-amber-200' :
      'bg-green-50 border-green-200'
    }`}>
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-4 py-2 cursor-pointer ${
          checkResults.hasErrors ? 'text-red-700' :
          checkResults.hasWarnings ? 'text-amber-700' :
          'text-green-700'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {checkResults.hasErrors ? (
          <XCircle className="w-5 h-5" />
        ) : checkResults.hasWarnings ? (
          <AlertTriangle className="w-5 h-5" />
        ) : (
          <CheckCircle className="w-5 h-5" />
        )}
        <span className="font-medium">
          {checkResults.hasErrors ? 'Data Consistency Issues Detected' :
           checkResults.hasWarnings ? 'Minor Data Discrepancies' :
           'Data Consistent'}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 ml-auto" />
        ) : (
          <ChevronDown className="w-4 h-4 ml-auto" />
        )}
      </div>

      {/* Details */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Base Metrics */}
          <div className="bg-white/50 rounded-lg p-3">
            <div className="text-xs font-medium text-slate-500 mb-2">Reference Values (from raw data)</div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-slate-500">Revenue</div>
                <div className="font-mono font-medium">{formatMoney(checkResults.baseMetrics.totalRevenue)}</div>
              </div>
              <div>
                <div className="text-slate-500">Orders</div>
                <div className="font-mono font-medium">{checkResults.baseMetrics.totalOrders.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-slate-500">Advertising</div>
                <div className="font-mono font-medium">{formatMoney(checkResults.baseMetrics.advertisingCost)}</div>
              </div>
            </div>
          </div>

          {/* Per-Analyzer Results */}
          {checkResults.results.map(({ name, result }) => (
            <div key={name} className="bg-white/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                {result.isConsistent ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span className="text-sm font-medium text-slate-700">{name}</span>
              </div>

              <div className="space-y-1">
                {result.checks.map(check => (
                  <div
                    key={check.name}
                    className={`flex items-center gap-2 text-xs ${
                      check.severity === 'error' ? 'text-red-600' :
                      check.severity === 'warning' ? 'text-amber-600' :
                      'text-slate-500'
                    }`}
                  >
                    {check.passed ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : check.severity === 'error' ? (
                      <XCircle className="w-3 h-3" />
                    ) : check.severity === 'warning' ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : (
                      <Info className="w-3 h-3" />
                    )}
                    <span className="font-medium">{check.name}:</span>
                    <span className="font-mono">
                      {check.name.includes('Count')
                        ? check.actual.toLocaleString()
                        : formatMoney(check.actual)
                      }
                    </span>
                    {!check.passed && (
                      <span className="text-slate-400">
                        (diff: {check.differencePercent.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Help Text */}
          <div className="text-xs text-slate-500 flex items-start gap-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              This check compares calculations across different analyzers.
              Small discrepancies (&lt;1% for revenue, &lt;5% for costs) are normal due to rounding.
              Larger differences may indicate a bug or data inconsistency.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataConsistencyCheck;
