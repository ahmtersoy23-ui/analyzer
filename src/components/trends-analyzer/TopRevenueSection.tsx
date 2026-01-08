/**
 * Top Revenue Section - Extracted from PeriodComparisonAnalyzer
 * Shows top revenue items for Period 1 with percentage of total
 */

import React from 'react';
import { DollarSign } from 'lucide-react';

export interface TopRevenueItem {
  key: string;
  label: string;
  revenue: number;
  quantity: number;
  revenuePercent: number;
}

interface TopRevenueSectionProps {
  topRevenue: {
    items: TopRevenueItem[];
    totalRevenue: number;
    totalCount: number;
  };
  groupBy: 'product' | 'parent';
}

export const TopRevenueSection: React.FC<TopRevenueSectionProps> = ({
  topRevenue,
  groupBy,
}) => {
  if (topRevenue.items.length === 0) {
    return null;
  }

  // Calculate sum of displayed items' revenue
  const displayedRevenue = topRevenue.items.reduce((sum, i) => sum + i.revenue, 0);
  const displayedPercent = topRevenue.totalRevenue > 0
    ? ((displayedRevenue / topRevenue.totalRevenue) * 100).toFixed(1)
    : '0';

  return (
    <div className="mt-6">
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-medium text-blue-700 mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Top {topRevenue.items.length} Revenue (Period 1)
          {topRevenue.totalCount > topRevenue.items.length && (
            <span className="text-xs text-slate-400 font-normal">
              (of {topRevenue.totalCount})
            </span>
          )}
          <span className="text-xs text-blue-500 font-normal ml-2">
            = {displayedPercent}% of total (${topRevenue.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })})
          </span>
        </h3>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-medium text-slate-600">
                  {groupBy === 'parent' ? 'Parent' : 'Product'}
                </th>
                <th className="text-right py-2 px-3 font-medium text-slate-600 whitespace-nowrap">Revenue</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600 whitespace-nowrap">% of Total</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600 whitespace-nowrap">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {topRevenue.items.map((item) => (
                <tr key={item.key} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-3 text-left text-slate-700">{item.label}</td>
                  <td className="py-2 px-3 text-right text-blue-600 font-medium whitespace-nowrap">
                    ${item.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap">
                    {item.revenuePercent.toFixed(1)}%
                  </td>
                  <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap">
                    {item.quantity.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TopRevenueSection;
