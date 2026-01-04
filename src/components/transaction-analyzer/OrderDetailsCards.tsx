/**
 * OrderDetailsCards - FBA and FBM order details display
 */

import React from 'react';
import type { DetailedAnalytics } from '../../services/analytics/analyticsEngine';

interface OrderDetailsCardsProps {
  analytics: DetailedAnalytics;
  selectedFulfillment: string;
  formatMoney: (amount: number) => string;
}

export const OrderDetailsCards: React.FC<OrderDetailsCardsProps> = ({
  analytics,
  selectedFulfillment,
  formatMoney
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* FBA Order Details */}
      {(selectedFulfillment === 'all' || selectedFulfillment === 'FBA') && analytics.fbaOrders > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 print-card print-block">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">FBA Order Details</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Product Sales</span>
              <span className="text-sm font-semibold text-green-600">
                {formatMoney(analytics.fbaOrderSales)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Selling Fees</span>
              <span className="text-sm font-semibold text-red-600">
                -{formatMoney(analytics.fbaSellingFees)} ({analytics.fbaOrderSales > 0 ? ((analytics.fbaSellingFees / analytics.fbaOrderSales) * 100).toFixed(1) : '0'}%)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">FBA Fees</span>
              <span className="text-sm font-semibold text-red-600">
                -{formatMoney(analytics.fbaOrderFees)} ({analytics.fbaOrderSales > 0 ? ((analytics.fbaOrderFees / analytics.fbaOrderSales) * 100).toFixed(1) : '0'}%)
              </span>
            </div>
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Net (Order Level)</span>
                <span className="text-lg font-bold text-blue-600">
                  {formatMoney(analytics.fbaOrderNet)}
                </span>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {analytics.fbaOrders} FBA orders
            </div>
          </div>
        </div>
      )}

      {/* FBM Order Details */}
      {(selectedFulfillment === 'all' || selectedFulfillment === 'FBM') && analytics.fbmOrders > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 print-card print-block">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">FBM Order Details</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Product Sales</span>
              <span className="text-sm font-semibold text-green-600">
                {formatMoney(analytics.fbmOrderSales)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Selling Fees</span>
              <span className="text-sm font-semibold text-red-600">
                -{formatMoney(analytics.fbmSellingFees)} ({analytics.fbmOrderSales > 0 ? ((analytics.fbmSellingFees / analytics.fbmOrderSales) * 100).toFixed(1) : '0'}%)
              </span>
            </div>
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Net (Order Level)</span>
                <span className="text-lg font-bold text-blue-600">
                  {formatMoney(analytics.fbmOrderNet)}
                </span>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {analytics.fbmOrders} FBM orders
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(OrderDetailsCards);
