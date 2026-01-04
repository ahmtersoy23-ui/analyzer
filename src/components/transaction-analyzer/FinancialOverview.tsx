/**
 * Financial Overview Component
 * Shows Advertising Cost, FBA Cost, FBM Cost, VAT/GST summary cards
 * Uses the same calculation logic as Profitability Analyzer
 */

import React, { useMemo } from 'react';
import { TrendingUp, Package, Truck, Receipt } from 'lucide-react';
import type { TransactionData } from '../../types/transaction';
import {
  calculateAdvertisingCost,
  calculateFBACosts,
  calculateFBMCosts,
  calculateVAT
} from '../../services/analytics/productAnalytics';

interface FinancialOverviewProps {
  transactions: TransactionData[];
  marketplaceCode: string | null;
  formatMoney: (value: number) => string;
}

export const FinancialOverview: React.FC<FinancialOverviewProps> = ({
  transactions,
  marketplaceCode,
  formatMoney
}) => {
  // Calculate global costs using the same functions as Profitability
  const globalCosts = useMemo(() => {
    return {
      advertising: calculateAdvertisingCost(transactions, marketplaceCode),
      fba: calculateFBACosts(transactions, marketplaceCode),
      fbm: calculateFBMCosts(transactions, marketplaceCode),
      vat: calculateVAT(transactions, marketplaceCode)
    };
  }, [transactions, marketplaceCode]);

  // Calculate total sales for percentage calculations
  const { totalSales, fbaSales, fbmSales } = useMemo(() => {
    const orders = transactions.filter(t => t.categoryType === 'Order');
    const total = orders.reduce((sum, t) => sum + (t.productSales || 0), 0);
    const fba = orders.filter(t => t.fulfillment === 'FBA').reduce((sum, t) => sum + (t.productSales || 0), 0);
    const fbm = orders.filter(t => t.fulfillment !== 'FBA').reduce((sum, t) => sum + (t.productSales || 0), 0);
    return { totalSales: total, fbaSales: fba, fbmSales: fbm };
  }, [transactions]);

  // Calculate percentages
  const advertisingPercent = totalSales > 0 ? (globalCosts.advertising / totalSales) * 100 : 0;
  const fbaPercent = fbaSales > 0 ? (globalCosts.fba / fbaSales) * 100 : 0;
  const fbmPercent = fbmSales > 0 ? (globalCosts.fbm / fbmSales) * 100 : 0;
  const vatPercent = totalSales > 0 ? (globalCosts.vat / totalSales) * 100 : 0;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6">
      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span className="text-xl">💰</span>
        Financial Overview
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Advertising Cost */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Advertising Cost</span>
            <TrendingUp className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600">
            {formatMoney(globalCosts.advertising)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {advertisingPercent.toFixed(1)}% of total sales
          </div>
        </div>

        {/* FBA Cost */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">FBA Cost</span>
            <Package className="w-5 h-5 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {formatMoney(globalCosts.fba)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {fbaPercent.toFixed(1)}% of FBA sales
          </div>
        </div>

        {/* FBM Cost */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">FBM Cost</span>
            <Truck className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {formatMoney(globalCosts.fbm)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {fbmPercent.toFixed(1)}% of FBM sales
          </div>
        </div>

        {/* VAT/GST */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">VAT/GST</span>
            <Receipt className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-600">
            {formatMoney(globalCosts.vat)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {vatPercent.toFixed(1)}% of total sales
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(FinancialOverview);
