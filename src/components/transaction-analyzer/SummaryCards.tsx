/**
 * SummaryCards - Top metric cards (Total Sales, Net Income, Disbursement)
 */

import React from 'react';
import { DollarSign, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';
import type { DetailedAnalytics } from '../../services/analytics/analyticsEngine';

interface SummaryCardsProps {
  analytics: DetailedAnalytics;
  comparisonAnalytics: DetailedAnalytics | null;
  selectedFulfillment: string;
  formatMoney: (amount: number) => string;
}

// Inline ComparisonBadge for this component
const ComparisonBadge: React.FC<{ current: number; previous: number }> = ({ current, previous }) => {
  if (previous === 0) return null;

  const change = ((current - previous) / Math.abs(previous)) * 100;
  const isPositive = change > 0;
  const isNegative = change < 0;

  if (Math.abs(change) < 0.1) return null;

  return (
    <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${
      isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-slate-500'
    }`}>
      {isPositive && <ArrowUp className="w-3 h-3" />}
      {isNegative && <ArrowDown className="w-3 h-3" />}
      <span>{Math.abs(change).toFixed(1)}%</span>
    </div>
  );
};

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  analytics,
  comparisonAnalytics,
  selectedFulfillment,
  formatMoney
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 print:gap-2 print:mb-4">
      {/* Total Sales */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-md p-6 border border-green-100 print:p-2 print:shadow-none print:border print:border-slate-200">
        <div className="flex items-center justify-between mb-3 print:mb-1">
          <span className="text-base font-semibold text-green-800 print:text-xs print:text-slate-700">Toplam Satış</span>
          <DollarSign className="w-6 h-6 text-green-600 print:hidden" />
        </div>
        <p className="text-3xl font-bold text-green-900 mb-2 print:text-base print:font-semibold print:mb-0">
          {formatMoney(analytics.totalSales)}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-sm text-green-700 print:text-[10px]">{analytics.totalOrders} sipariş</p>
          {comparisonAnalytics && (
            <ComparisonBadge
              current={analytics.totalSales}
              previous={comparisonAnalytics.totalSales}
            />
          )}
        </div>
      </div>

      {/* Net Income - Only show when 'all' filter is selected */}
      {selectedFulfillment === 'all' && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-md p-6 border border-blue-100 print:p-2 print:shadow-none print:border print:border-slate-200">
          <div className="flex items-center justify-between mb-3 print:mb-1">
            <span className="text-base font-semibold text-blue-800 print:text-xs print:text-slate-700">Net Gelir</span>
            <TrendingUp className="w-6 h-6 text-blue-600 print:hidden" />
          </div>
          <p className="text-3xl font-bold text-blue-900 mb-2 print:text-base print:font-semibold print:mb-0">
            {formatMoney(analytics.totalNet)}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-700 print:text-[10px]">
              {analytics.totalAllSales > 0 ? `${((analytics.totalNet / analytics.totalAllSales) * 100).toFixed(1)}% net oran` : 'Total - Tüm Giderler'}
            </p>
            {comparisonAnalytics && (
              <ComparisonBadge
                current={analytics.totalNet}
                previous={comparisonAnalytics.totalNet}
              />
            )}
          </div>
        </div>
      )}

      {/* Disbursement - Only show when 'all' filter and has disbursements */}
      {selectedFulfillment === 'all' && analytics.disbursements.length > 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl shadow-md p-6 border border-purple-100 print:p-2 print:shadow-none print:border print:border-slate-200">
          <div className="flex items-center justify-between mb-3 print:mb-1">
            <span className="text-base font-semibold text-purple-800 print:text-xs print:text-slate-700">Disbursement</span>
            <TrendingUp className="w-6 h-6 text-purple-600 print:hidden" />
          </div>
          <p className="text-3xl font-bold text-purple-900 mb-2 print:text-base print:font-semibold print:mb-0">
            {formatMoney(analytics.totalDisbursement)}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-purple-700 print:text-[10px]">
              {analytics.disbursements.length} transfer
            </p>
            {comparisonAnalytics && (
              <ComparisonBadge
                current={analytics.totalDisbursement}
                previous={comparisonAnalytics.totalDisbursement}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SummaryCards);
