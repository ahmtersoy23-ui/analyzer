/**
 * Top Movers Section - Extracted from PeriodComparisonAnalyzer
 * Shows top gainers and losers with quantity changes between periods
 */

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface TopMoverItem {
  key: string;
  label: string;
  period1Value: number;
  period2Value: number;
  change: number;
  changePercent: number;
}

interface TopMoversSectionProps {
  topMovers: {
    gainers: TopMoverItem[];
    losers: TopMoverItem[];
    totalGainers: number;
    totalLosers: number;
  };
  topMoversGroupBy: 'product' | 'parent';
  topMoversLimit: number;
  setTopMoversGroupBy: (value: 'product' | 'parent') => void;
  setTopMoversLimit: (value: number) => void;
}

export const TopMoversSection: React.FC<TopMoversSectionProps> = ({
  topMovers,
  topMoversGroupBy,
  topMoversLimit,
  setTopMoversGroupBy,
  setTopMoversLimit,
}) => {
  if (topMovers.gainers.length === 0 && topMovers.losers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Toggle Header */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-sm font-medium text-slate-700">
            Top Movers (Quantity)
            <span className="text-xs text-slate-400 ml-2">
              {topMovers.totalGainers} gainers, {topMovers.totalLosers} losers
            </span>
          </h3>
          <div className="flex items-center gap-4">
            {/* Limit Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Show:</span>
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                {[10, 20, 50, 100, 500].map(limit => (
                  <button
                    key={limit}
                    onClick={() => setTopMoversLimit(limit)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      topMoversLimit === limit
                        ? 'bg-white text-indigo-700 shadow-sm font-medium'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    {limit}
                  </button>
                ))}
              </div>
            </div>
            {/* Group By Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Group by:</span>
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setTopMoversGroupBy('product')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    topMoversGroupBy === 'product'
                      ? 'bg-white text-indigo-700 shadow-sm font-medium'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Product
                </button>
                <button
                  onClick={() => setTopMoversGroupBy('parent')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    topMoversGroupBy === 'parent'
                      ? 'bg-white text-indigo-700 shadow-sm font-medium'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Parent
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Gainers */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-medium text-green-700 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Top {topMovers.gainers.length} Gainers
          {topMovers.totalGainers > topMovers.gainers.length && (
            <span className="text-xs text-slate-400 font-normal">
              (of {topMovers.totalGainers})
            </span>
          )}
        </h3>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-medium text-slate-600">{topMoversGroupBy === 'parent' ? 'Parent' : 'Product'}</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600 whitespace-nowrap">P1</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600 whitespace-nowrap">P2</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600 whitespace-nowrap">Qty</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600 whitespace-nowrap">%</th>
              </tr>
            </thead>
            <tbody>
              {topMovers.gainers.map((item) => (
                <tr key={item.key} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-3 text-left text-slate-700">
                    {item.label}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap">{item.period1Value.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap">{item.period2Value.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-green-600 font-medium whitespace-nowrap">
                    +{item.change.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right text-green-600 font-medium whitespace-nowrap">
                    {item.changePercent > 999 ? '>999' : item.changePercent.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {topMovers.gainers.length === 0 && (
            <div className="text-center py-4 text-slate-400 text-sm">No gainers found</div>
          )}
        </div>
      </div>

      {/* Top Losers */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-medium text-red-700 mb-3 flex items-center gap-2">
          <TrendingDown className="w-4 h-4" />
          Top {topMovers.losers.length} Losers
          {topMovers.totalLosers > topMovers.losers.length && (
            <span className="text-xs text-slate-400 font-normal">
              (of {topMovers.totalLosers})
            </span>
          )}
        </h3>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-medium text-slate-600">{topMoversGroupBy === 'parent' ? 'Parent' : 'Product'}</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600 whitespace-nowrap">P1</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600 whitespace-nowrap">P2</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600 whitespace-nowrap">Qty</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600 whitespace-nowrap">%</th>
              </tr>
            </thead>
            <tbody>
              {topMovers.losers.map((item) => (
                <tr key={item.key} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-3 text-left text-slate-700">
                    {item.label}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap">{item.period1Value.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap">{item.period2Value.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-red-600 font-medium whitespace-nowrap">
                    {item.change.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right text-red-600 font-medium whitespace-nowrap">
                    {item.changePercent < -999 ? '<-999' : item.changePercent.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {topMovers.losers.length === 0 && (
            <div className="text-center py-4 text-slate-400 text-sm">No losers found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopMoversSection;
