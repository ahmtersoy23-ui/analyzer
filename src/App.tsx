import { useState, useEffect, lazy, Suspense } from 'react';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import LoginPage from './components/LoginPage';
import ForcePasswordChange from './components/ForcePasswordChange';
import TransactionAnalyzer from './components/TransactionAnalyzer';
import type { TransactionData, MarketplaceCode } from './types/transaction';
import { fetchLiveRates } from './utils/currencyExchange';

// Lazy load heavy components - only loaded when user navigates to them
const ProfitabilityAnalyzer = lazy(() => import('./components/ProfitabilityAnalyzer'));
const TrendsAnalyzer = lazy(() => import('./components/TrendsAnalyzer'));
const TestPanel = lazy(() => import('./shared/testing/TestPanel'));
const UserManagement = lazy(() => import('./components/UserManagement'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-slate-600">Loading...</p>
    </div>
  </div>
);

type Phase = 'transaction' | 'profitability' | 'trends' | 'users';

// Main App Content (requires authentication)
function AppContent() {
  const { user, logout, isAdmin } = useAuth();
  const [activePhase, setActivePhase] = useState<Phase>('transaction');
  const [transactionData, setTransactionData] = useState<TransactionData[]>([]);
  const [selectedMarketplace] = useState<MarketplaceCode>('US');

  // TransactionAnalyzer'dan data geldiğinde
  // TransactionAnalyzer sadece ALL data yüklendiğinde bunu çağırıyor (filtre değişikliklerinde değil)
  const handleDataLoaded = (data: TransactionData[]) => {
    // Always update - TransactionAnalyzer only calls this for full dataset loads
    setTransactionData(data);
  };

  // Fetch exchange rates on app load (for all phases)
  useEffect(() => {
    fetchLiveRates().then(({ status }) => {
      if (status.error) {
        console.warn('Exchange rate fetch warning:', status.error);
      } else {
        console.log('Exchange rates loaded:', status.source);
      }
    });
  }, []);

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
                Transaction Analyzer
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
                Profitability Analyzer
              </button>

              {/* Trends - Admin Only (Beta) */}
              {isAdmin && (
                <button
                  onClick={() => setActivePhase('trends')}
                  disabled={transactionData.length === 0}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    activePhase === 'trends'
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-200'
                      : transactionData.length === 0
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Trends Analyzer
                </button>
              )}
            </div>

            {/* Data Info & Actions */}
            <div className="flex items-center gap-4">
              {transactionData.length > 0 && (
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">{transactionData.length}</span> transactions loaded
                </div>
              )}

              {/* User Menu */}
              <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                <div className="text-sm">
                  <span className="text-slate-600">Welcome, </span>
                  <span className="font-semibold text-slate-800">{user?.username}</span>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                    isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {user?.role}
                  </span>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setActivePhase('users')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activePhase === 'users'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Users
                  </button>
                )}
                <button
                  onClick={logout}
                  className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-all"
                >
                  Logout
                </button>
              </div>
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
                  Transaction Data Required
                </h2>
                <p className="text-slate-600 mb-6">
                  Please upload your Excel files from Transaction Analyzer for Profitability Analysis.
                </p>
                <button
                  onClick={() => setActivePhase('transaction')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Go to Transaction Analyzer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Trends Analyzer - Admin Only (Beta) */}
        {isAdmin && (
          <div style={{ display: activePhase === 'trends' ? 'block' : 'none' }}>
            {transactionData.length > 0 ? (
              <Suspense fallback={<LoadingFallback />}>
                <TrendsAnalyzer
                  transactionData={transactionData}
                />
              </Suspense>
            ) : (
              <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md text-center">
                  <div className="text-6xl mb-6">📈</div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-3">
                    Transaction Data Required
                  </h2>
                  <p className="text-slate-600 mb-6">
                    Please upload your Excel files from Transaction Analyzer for Trend Analysis.
                  </p>
                  <button
                    onClick={() => setActivePhase('transaction')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
                  >
                    Go to Transaction Analyzer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* User Management - Admin Only */}
        {isAdmin && (
          <div style={{ display: activePhase === 'users' ? 'block' : 'none' }}>
            <Suspense fallback={<LoadingFallback />}>
              <UserManagement />
            </Suspense>
          </div>
        )}
      </main>

      {/* Test Panel - Only in Development Mode */}
      {process.env.NODE_ENV === 'development' && (
        <Suspense fallback={null}>
          <TestPanel onLoadTestData={(marketplace, data) => {
            console.log(`Loading test data for ${marketplace}`);
            setTransactionData(data);
            setActivePhase('transaction');
          }} />
        </Suspense>
      )}
    </div>
  );
}

// App wrapper with AuthProvider
function App() {
  const { isAuthenticated, isLoading, mustChangePassword } = useAuth();

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Force password change if required
  if (mustChangePassword) {
    return <ForcePasswordChange />;
  }

  return <AppContent />;
}

// Root component with AuthProvider and ToastProvider
function Root() {
  return (
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  );
}

export default Root;
