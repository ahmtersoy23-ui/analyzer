/**
 * Phase 4: Trends Analyzer
 * Comprehensive time-series analysis with multiple view modes and metrics
 * All monetary values converted to USD for accurate comparison
 */

import React, { useState } from 'react';
import { Calendar, Truck, Clock, GitCompare } from 'lucide-react';
import type { TransactionData } from '../types/transaction';
import {
  FbmShippingAnalyzer,
  OrderHourAnalyzer,
  OrderDayAnalyzer,
  PeriodComparisonAnalyzer,
} from './trends-analyzer';

// ============================================
// TYPES
// ============================================

interface TrendsAnalyzerProps {
  transactionData: TransactionData[];
}

type AnalyzerTab = 'fbm-shipping' | 'order-hours' | 'order-days' | 'period-comparison';

// ============================================
// MAIN COMPONENT
// ============================================

const TrendsAnalyzer: React.FC<TrendsAnalyzerProps> = ({ transactionData }) => {
  const [activeTab, setActiveTab] = useState<AnalyzerTab>('period-comparison');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Main Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm p-2 mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('fbm-shipping')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'fbm-shipping'
                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Truck className="w-4 h-4" />
            FBM Shipping
          </button>
          <button
            onClick={() => setActiveTab('order-hours')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'order-hours'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            Order Hours
          </button>
          <button
            onClick={() => setActiveTab('order-days')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'order-days'
                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Order Days
          </button>
          <button
            onClick={() => setActiveTab('period-comparison')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'period-comparison'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <GitCompare className="w-4 h-4" />
            Period Comparison
          </button>
        </div>

        {/* FBM Shipping Analyzer Tab */}
        {activeTab === 'fbm-shipping' && (
          <FbmShippingAnalyzer transactionData={transactionData} />
        )}

        {/* Order Hour Analyzer Tab */}
        {activeTab === 'order-hours' && (
          <OrderHourAnalyzer transactionData={transactionData} />
        )}

        {/* Order Day Analyzer Tab */}
        {activeTab === 'order-days' && (
          <OrderDayAnalyzer transactionData={transactionData} />
        )}

        {/* Period Comparison Analyzer Tab */}
        {activeTab === 'period-comparison' && (
          <PeriodComparisonAnalyzer transactionData={transactionData} />
        )}

      </div>
    </div>
  );
};

export default TrendsAnalyzer;
