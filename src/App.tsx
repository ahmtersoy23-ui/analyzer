import { useState, useEffect, lazy, Suspense } from 'react';
import './App.css';
import TransactionAnalyzer from './components/TransactionAnalyzer';
import type { TransactionData, MarketplaceCode } from './types/transaction';

// Lazy load heavy components - only loaded when user navigates to them
const ProductAnalyzer = lazy(() => import('./components/ProductAnalyzer'));
const ProfitabilityAnalyzer = lazy(() => import('./components/ProfitabilityAnalyzer'));
const TestPanel = lazy(() => import('./shared/testing/TestPanel'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-slate-600">Loading...</p>
    </div>
  </div>
);

type Phase = 'transaction' | 'product' | 'profitability';

function App() {
  const [activePhase, setActivePhase] = useState<Phase>('transaction');
  const [transactionData, setTransactionData] = useState<TransactionData[]>([]);
  const [selectedMarketplace] = useState<MarketplaceCode>('US');

  // TransactionAnalyzer'dan data geldiğinde
  // IMPORTANT: Only set data on initial load, not on filter changes
  const handleDataLoaded = (data: TransactionData[]) => {
    // Only update if we don't have data yet (initial load)
    // This ensures ProductAnalyzer always has ALL data, not filtered data
    if (transactionData.length === 0 || data.length > transactionData.length) {
      setTransactionData(data);
    }
  };

  // Test Panel'den data geldiğinde (custom event listener)
  useEffect(() => {
    const handleTestDataLoad = (event: CustomEvent) => {
      const { data } = event.detail;
      setTransactionData(data);
      setActivePhase('transaction');
    };

    window.addEventListener('load-test-data', handleTestDataLoad as any);

    return () => {
      window.removeEventListener('load-test-data', handleTestDataLoad as any);
    };
  }, []);

  return (
    <div className="App">
      {/* Navigation Header */}
      <nav className="bg-white shadow-md border-b border-slate-200 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Tab Navigation */}
            <div className="flex gap-2">
              <button
                onClick={() => setActivePhase('transaction')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  activePhase === 'transaction'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Phase 1 Transaction Analyzer
              </button>

              <button
                onClick={() => setActivePhase('product')}
                disabled={transactionData.length === 0}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  activePhase === 'product'
                    ? 'bg-green-600 text-white shadow-lg shadow-green-200'
                    : transactionData.length === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Phase 2 Product Analyzer
              </button>

              <button
                onClick={() => setActivePhase('profitability')}
                disabled={transactionData.length === 0}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  activePhase === 'profitability'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                    : transactionData.length === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Phase 3 Profitability Analyzer
              </button>
            </div>

            {/* Data Info & Actions */}
            <div className="flex items-center gap-4">
              {transactionData.length > 0 && (
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">{transactionData.length}</span> transactions loaded
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Phase Components - Keep both mounted to preserve state */}
      <main className="min-h-screen">
        <div style={{ display: activePhase === 'transaction' ? 'block' : 'none' }}>
          <TransactionAnalyzer
            onDataLoaded={handleDataLoaded}
          />
        </div>

        <div style={{ display: activePhase === 'product' ? 'block' : 'none' }}>
          {transactionData.length > 0 ? (
            <Suspense fallback={<LoadingFallback />}>
              <ProductAnalyzer
                transactionData={transactionData}
              />
            </Suspense>
          ) : (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
              <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md text-center">
                <div className="text-6xl mb-6">📦</div>
                <h2 className="text-2xl font-bold text-slate-800 mb-3">
                  Transaction Data Gerekli
                </h2>
                <p className="text-slate-600 mb-6">
                  Product Analyzer'ı kullanmak için önce Transaction Analyzer'dan Excel dosyalarınızı yükleyin.
                </p>
                <button
                  onClick={() => setActivePhase('transaction')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Transaction Analyzer'a Git
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: activePhase === 'profitability' ? 'block' : 'none' }}>
          {transactionData.length > 0 ? (
            <Suspense fallback={<LoadingFallback />}>
              <ProfitabilityAnalyzer
                transactionData={transactionData}
                selectedMarketplace={selectedMarketplace}
              />
            </Suspense>
          ) : (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
              <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md text-center">
                <div className="text-6xl mb-6">💰</div>
                <h2 className="text-2xl font-bold text-slate-800 mb-3">
                  Transaction Data Gerekli
                </h2>
                <p className="text-slate-600 mb-6">
                  Karlılık Analizi için önce Transaction Analyzer'dan Excel dosyalarınızı yükleyin.
                </p>
                <button
                  onClick={() => setActivePhase('transaction')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Transaction Analyzer'a Git
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Test Panel - Only in Development Mode */}
      {process.env.NODE_ENV === 'development' && (
        <Suspense fallback={null}>
          <TestPanel onLoadTestData={(marketplace, data) => {
            console.log(`🧪 Loading test data for ${marketplace}`);
            setTransactionData(data);
            setActivePhase('transaction');
          }} />
        </Suspense>
      )}
    </div>
  );
}

export default App;
