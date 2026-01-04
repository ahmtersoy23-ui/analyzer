/**
 * FulfillmentStatsCards - Fulfillment distribution and refund statistics
 */

import React from 'react';
import type { DetailedAnalytics } from '../../services/analytics/analyticsEngine';

interface FulfillmentStatsCardsProps {
  analytics: DetailedAnalytics;
  selectedFulfillment: string;
  formatMoney: (amount: number) => string;
}

export const FulfillmentStatsCards: React.FC<FulfillmentStatsCardsProps> = ({
  analytics,
  selectedFulfillment,
  formatMoney
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Fulfillment Distribution - FBA mode or All mode */}
      {selectedFulfillment !== 'FBM' && (
        <div className="bg-white rounded-xl shadow-sm p-6 print-card print-block">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Fulfillment Distribution</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">FBA</span>
                <span className="text-sm font-bold text-blue-600">
                  {analytics.fbaOrders} orders ({analytics.fbaPercentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${analytics.fbaPercentage}%` }}
                />
              </div>
            </div>

            {selectedFulfillment === 'all' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">FBM</span>
                  <span className="text-sm font-bold text-green-600">
                    {analytics.fbmOrders} orders ({analytics.fbmPercentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all"
                    style={{ width: `${analytics.fbmPercentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fulfillment Distribution - FBM only mode */}
      {selectedFulfillment !== 'FBA' && selectedFulfillment === 'FBM' && (
        <div className="bg-white rounded-xl shadow-sm p-6 print-card print-block">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Fulfillment Distribution</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">FBM</span>
                <span className="text-sm font-bold text-green-600">
                  {analytics.fbmOrders} orders (100%)
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Statistics */}
      <div className="bg-white rounded-xl shadow-sm p-6 print-card print-block">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Refund Statistics</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Total Refund</span>
            <div className="text-right">
              <span className="text-sm font-semibold text-red-600">
                {formatMoney(analytics.totalRefundAmount)}
              </span>
              <span className="text-xs text-slate-500 ml-2">
                ({analytics.totalRefunds} items, {analytics.totalSales > 0 ? ((analytics.totalRefundAmount / analytics.totalSales) * 100).toFixed(1) : '0'}%)
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Recovered</span>
            <div className="text-right">
              <span className="text-sm font-semibold text-green-600">
                {formatMoney(analytics.recoveredRefunds)}
              </span>
              <span className="text-xs text-slate-500 ml-2">
                ({analytics.totalSales > 0 ? ((analytics.recoveredRefunds / analytics.totalSales) * 100).toFixed(1) : '0'}%)
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Refund Loss</span>
            <div className="text-right">
              <span className="text-sm font-semibold text-red-600">
                {formatMoney(analytics.actualRefundLoss)}
              </span>
              <span className="text-xs text-slate-500 ml-2">
                ({analytics.totalSales > 0 ? ((analytics.actualRefundLoss / analytics.totalSales) * 100).toFixed(1) : '0'}%)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(FulfillmentStatsCards);
