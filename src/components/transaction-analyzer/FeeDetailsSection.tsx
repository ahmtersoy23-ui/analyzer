/**
 * FeeDetailsSection - Reusable fee details display component
 */

import React from 'react';
import type { DetailedAnalytics } from '../../services/analytics/analyticsEngine';
import type { MarketplaceCode } from '../../types/transaction';
import { translateDescription } from './helpers';

type ComparisonDetailType = 'adjustments' | 'inventory' | 'service' | 'fbaCostBreakdown';

interface FeeDetailsSectionProps {
  analytics: DetailedAnalytics;
  comparisonAnalytics: (DetailedAnalytics & { label?: string }) | null;
  selectedFulfillment: string;
  marketplaceCode: MarketplaceCode | null;
  formatMoney: (amount: number) => string;
  onOpenComparisonDetail: (type: ComparisonDetailType) => void;
}

interface GroupData {
  total: number;
  count: number;
}

// Helper component for rendering a fee group card
const FeeGroupCard: React.FC<{
  title: string;
  groups: Record<string, GroupData>;
  formatMoney: (amount: number) => string;
  comparisonDetailType?: ComparisonDetailType;
  hasComparison?: boolean;
  onOpenDetail?: () => void;
  translateKeys?: boolean;
  className?: string;
}> = ({
  title,
  groups,
  formatMoney,
  comparisonDetailType,
  hasComparison = false,
  onOpenDetail,
  translateKeys = true,
  className = ''
}) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-6 mb-6 print-block print-card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        {hasComparison && onOpenDetail && (
          <button
            onClick={onOpenDetail}
            className="no-print px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
          >
            📊 Details
          </button>
        )}
      </div>
      <div className="space-y-3">
        {Object.entries(groups)
          .sort((a, b) => {
            // Miscellaneous always at the end
            if (a[0] === 'Miscellaneous') return 1;
            if (b[0] === 'Miscellaneous') return -1;
            return Math.abs(b[1].total) - Math.abs(a[1].total);
          })
          .map(([key, value]) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <span className="text-sm text-slate-700 text-left flex-1">
                {translateKeys ? translateDescription(key) : key}
              </span>
              <span className="text-sm font-semibold text-slate-800 text-right whitespace-nowrap">
                {formatMoney(value.total)} <span className="text-slate-500">({value.count} txn)</span>
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};

export const FeeDetailsSection: React.FC<FeeDetailsSectionProps> = ({
  analytics,
  comparisonAnalytics,
  selectedFulfillment,
  marketplaceCode,
  formatMoney,
  onOpenComparisonDetail
}) => {
  const hasComparison = !!comparisonAnalytics;

  return (
    <>
      {/* Adjustment Details */}
      {analytics.adjustmentGroups && Object.keys(analytics.adjustmentGroups).length > 0 && selectedFulfillment !== 'FBM' && (
        <FeeGroupCard
          title="Adjustment Details"
          groups={analytics.adjustmentGroups}
          formatMoney={formatMoney}
          comparisonDetailType="adjustments"
          hasComparison={hasComparison}
          onOpenDetail={() => onOpenComparisonDetail('adjustments')}
        />
      )}

      {/* FBA Inventory Fee Details */}
      {analytics.inventoryGroups && Object.keys(analytics.inventoryGroups).length > 0 && selectedFulfillment !== 'FBM' && (
        <FeeGroupCard
          title="FBA Inventory Fee Details"
          groups={analytics.inventoryGroups}
          formatMoney={formatMoney}
          comparisonDetailType="inventory"
          hasComparison={hasComparison}
          onOpenDetail={() => onOpenComparisonDetail('inventory')}
        />
      )}

      {/* Service Fee Details */}
      {analytics.serviceGroups && Object.keys(analytics.serviceGroups).length > 0 && selectedFulfillment !== 'FBM' && (
        <FeeGroupCard
          title="Service Fee Details"
          groups={analytics.serviceGroups}
          formatMoney={formatMoney}
          comparisonDetailType="service"
          hasComparison={hasComparison}
          onOpenDetail={() => onOpenComparisonDetail('service')}
        />
      )}

      {/* FBA Customer Return Fee Details */}
      {analytics.fbaCustomerReturnGroups && Object.keys(analytics.fbaCustomerReturnGroups).length > 0 && selectedFulfillment !== 'FBM' && (
        <FeeGroupCard
          title="FBA Customer Return Fee Details"
          groups={analytics.fbaCustomerReturnGroups}
          formatMoney={formatMoney}
        />
      )}

      {/* FBA Transaction Fee Details - Only when marketplace is selected */}
      {marketplaceCode && analytics.fbaTransactionGroups && Object.keys(analytics.fbaTransactionGroups).length > 0 && selectedFulfillment !== 'FBM' && (
        <FeeGroupCard
          title="FBA Transaction Fee Details"
          groups={analytics.fbaTransactionGroups}
          formatMoney={formatMoney}
          className="no-print"
        />
      )}

      {/* Chargeback Refund (SKU Based) - Only when marketplace is selected */}
      {marketplaceCode && Object.keys(analytics.chargebackGroups).length > 0 && selectedFulfillment !== 'FBM' && (
        <FeeGroupCard
          title="Chargeback Refund (by SKU)"
          groups={analytics.chargebackGroups}
          formatMoney={formatMoney}
          translateKeys={false}
          className="no-print"
        />
      )}

      {/* Others Details - Only when marketplace is selected and 'all' fulfillment */}
      {marketplaceCode && Object.keys(analytics.othersGroups).length > 0 && selectedFulfillment === 'all' && (
        <FeeGroupCard
          title="Others Details"
          groups={analytics.othersGroups}
          formatMoney={formatMoney}
        />
      )}

      {/* Amazon Fees Details - Only when marketplace is selected and 'all' fulfillment */}
      {marketplaceCode && Object.keys(analytics.amazonFeesGroups).length > 0 && selectedFulfillment === 'all' && (
        <FeeGroupCard
          title="Amazon Fees Details"
          groups={analytics.amazonFeesGroups}
          formatMoney={formatMoney}
        />
      )}

      {/* Shipping Services Details */}
      {analytics.shippingServicesGroups && Object.keys(analytics.shippingServicesGroups).length > 0 && (
        <FeeGroupCard
          title="Shipping Services Details"
          groups={analytics.shippingServicesGroups}
          formatMoney={formatMoney}
        />
      )}
    </>
  );
};

export default React.memo(FeeDetailsSection);
