import React, { useMemo } from 'react';
import { TransactionData } from '../../types/transaction';
import { DetailedAnalytics } from '../../services/analytics/analyticsEngine';
import KPICard from '../KPICard';
import SalesTrendChart from '../SalesTrendChart';
import { DollarSign, ShoppingCart, Percent, CreditCard } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

interface AdvancedDashboardProps {
  analytics: DetailedAnalytics;
  comparisonAnalytics: DetailedAnalytics | null;
  filteredData: TransactionData[];
  comparisonFilteredData: TransactionData[];
  selectedFulfillment: 'all' | 'FBA' | 'FBM';
  currency: string;
  isLoading?: boolean;
  dateRange: { start: string; end: string };
  comparisonMode: 'none' | 'previous-period' | 'previous-year';
  onComparisonModeChange: (mode: 'none' | 'previous-period' | 'previous-year') => void;
}

const AdvancedDashboard: React.FC<AdvancedDashboardProps> = ({
  analytics,
  comparisonAnalytics,
  filteredData,
  comparisonFilteredData,
  selectedFulfillment,
  currency,
  isLoading = false,
  dateRange,
  comparisonMode,
  onComparisonModeChange
}) => {
  // Format money helper - uses centralized formatter
  const formatMoney = useMemo(() => (amount: number) => formatNumber(amount), []);

  return (
    <div className="space-y-6">
      {/* KPI Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title={selectedFulfillment === 'all' ? 'Toplam Satış' : `${selectedFulfillment} Satış`}
          value={formatMoney(
            selectedFulfillment === 'FBA' ? analytics.fbaOrderSales :
            selectedFulfillment === 'FBM' ? analytics.fbmOrderSales :
            analytics.totalSales
          )}
          change={comparisonAnalytics ? (
            selectedFulfillment === 'FBA' ?
              ((analytics.fbaOrderSales - comparisonAnalytics.fbaOrderSales) / comparisonAnalytics.fbaOrderSales * 100) :
            selectedFulfillment === 'FBM' ?
              ((analytics.fbmOrderSales - comparisonAnalytics.fbmOrderSales) / comparisonAnalytics.fbmOrderSales * 100) :
              ((analytics.totalSales - comparisonAnalytics.totalSales) / comparisonAnalytics.totalSales * 100)
          ) : undefined}
          changeLabel={comparisonAnalytics ? "vs önceki dönem" : undefined}
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
          isLoading={isLoading}
        />

        <KPICard
          title={selectedFulfillment === 'all' ? 'Toplam Sipariş' : `${selectedFulfillment} Sipariş`}
          value={(
            selectedFulfillment === 'FBA' ? analytics.fbaOrders :
            selectedFulfillment === 'FBM' ? analytics.fbmOrders :
            analytics.totalOrders
          ).toLocaleString()}
          change={comparisonAnalytics ? (
            selectedFulfillment === 'FBA' ?
              ((analytics.fbaOrders - comparisonAnalytics.fbaOrders) / comparisonAnalytics.fbaOrders * 100) :
            selectedFulfillment === 'FBM' ?
              ((analytics.fbmOrders - comparisonAnalytics.fbmOrders) / comparisonAnalytics.fbmOrders * 100) :
              ((analytics.totalOrders - comparisonAnalytics.totalOrders) / comparisonAnalytics.totalOrders * 100)
          ) : undefined}
          changeLabel={comparisonAnalytics ? "vs önceki dönem" : undefined}
          icon={<ShoppingCart className="w-5 h-5" />}
          color="blue"
          isLoading={isLoading}
        />

        <KPICard
          title="Reklam Maliyeti"
          value={formatMoney(analytics.displayAdvertisingCost)}
          change={comparisonAnalytics ? ((analytics.displayAdvertisingCost - comparisonAnalytics.displayAdvertisingCost) / comparisonAnalytics.displayAdvertisingCost * 100) : undefined}
          changeLabel={comparisonAnalytics ? "vs önceki dönem" : undefined}
          icon={<CreditCard className="w-5 h-5" />}
          color="purple"
          isLoading={isLoading}
        />

        <KPICard
          title="İade Oranı"
          value={`${analytics.refundRate.toFixed(1)}%`}
          change={comparisonAnalytics ? (analytics.refundRate - comparisonAnalytics.refundRate) : undefined}
          changeLabel={comparisonAnalytics ? "vs önceki dönem" : undefined}
          icon={<Percent className="w-5 h-5" />}
          color="orange"
          isLoading={isLoading}
        />
      </div>

      {/* Sales Trend Chart */}
      {filteredData.filter(d => d.categoryType === 'Order').length > 0 && (
        <div>
          {/* Comparison Checkboxes */}
          {dateRange.start && dateRange.end && (
            <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Kıyaslama Seçenekleri</h3>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={comparisonMode === 'previous-period'}
                    onChange={(e) => onComparisonModeChange(e.target.checked ? 'previous-period' : 'none')}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Önceki Periyot</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={comparisonMode === 'previous-year'}
                    onChange={(e) => onComparisonModeChange(e.target.checked ? 'previous-year' : 'none')}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Geçen Yıl Aynı Periyot</span>
                </label>
              </div>
            </div>
          )}

          <SalesTrendChart
            orders={filteredData.filter(d => d.categoryType === 'Order')}
            comparisonOrders={comparisonFilteredData.length > 0 ? comparisonFilteredData.filter(d => d.categoryType === 'Order') : undefined}
            currency={currency}
            height={300}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(AdvancedDashboard);
