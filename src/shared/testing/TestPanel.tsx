// Visual Test Panel - Developer tool for quick testing
// Only rendered in development mode

import React, { useState } from 'react';
import { Play, TestTube, Download, RefreshCw } from 'lucide-react';
import {
  MOCK_TRANSACTIONS,
  MARKETPLACE_TEST_EXPECTATIONS,
  ALL_MARKETPLACES,
  type MarketplaceCode
} from './mockData';
import { runSmokeTests, runMarketplaceTest, getTestSummary, type TestResult } from './smokeTests';

interface TestPanelProps {
  onLoadTestData?: (marketplace: MarketplaceCode, data: any[]) => void;
}

export const TestPanel: React.FC<TestPanelProps> = ({ onLoadTestData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMarketplace, setSelectedMarketplace] = useState<MarketplaceCode>('US');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunAllTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const results = runSmokeTests();
      setTestResults(results);
      setIsRunning(false);
    }, 100);
  };

  const handleRunSingleTest = (marketplace: MarketplaceCode) => {
    setIsRunning(true);
    setTimeout(() => {
      const result = runMarketplaceTest(marketplace);
      setTestResults([result]);
      setIsRunning(false);
    }, 100);
  };

  const handleLoadTestData = (marketplace: MarketplaceCode) => {
    const data = MOCK_TRANSACTIONS[marketplace];
    if (onLoadTestData) {
      onLoadTestData(marketplace, data);
    } else {
      // Fallback: dispatch custom event
      window.dispatchEvent(
        new CustomEvent('load-test-data', {
          detail: { marketplace, data }
        })
      );
    }
    console.log(`📦 Loaded ${data.length} test transactions for ${marketplace}`);
  };

  const summary = testResults.length > 0 ? getTestSummary(testResults) : null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-purple-600 hover:bg-purple-700 text-white rounded-full p-4 shadow-lg z-50 transition-all"
        title="Open Test Panel"
      >
        <TestTube className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl border-4 border-purple-600 p-6 z-50 w-96 max-h-[600px] overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-purple-200">
        <div className="flex items-center gap-2">
          <TestTube className="w-6 h-6 text-purple-600" />
          <h3 className="text-lg font-bold text-gray-800">Test Panel</h3>
          <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded">DEV</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700 text-xl font-bold"
        >
          ×
        </button>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3 mb-6">
        <button
          onClick={handleRunAllTests}
          disabled={isRunning}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Play className="w-5 h-5" />
          {isRunning ? 'Running...' : 'Run All Tests (10 Marketplaces)'}
        </button>

        <div className="text-xs text-gray-600 text-center">
          Tests validate: Sales, Refunds, VAT, Advertising, Recovery Rates
        </div>
      </div>

      {/* Test Results Summary */}
      {summary && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-bold text-sm mb-2 text-gray-700">Test Results</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">Total:</span>{' '}
              <span className="font-bold">{summary.total}</span>
            </div>
            <div>
              <span className="text-gray-600">Pass Rate:</span>{' '}
              <span className={`font-bold ${summary.passRate === 100 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.passRate.toFixed(0)}%
              </span>
            </div>
            <div>
              <span className="text-green-600">✓ Passed:</span>{' '}
              <span className="font-bold">{summary.passed}</span>
            </div>
            <div>
              <span className="text-red-600">✗ Failed:</span>{' '}
              <span className="font-bold">{summary.failed}</span>
            </div>
          </div>
        </div>
      )}

      {/* Marketplace Selector */}
      <div className="mb-6">
        <h4 className="font-bold text-sm mb-2 text-gray-700">Select Marketplace</h4>
        <select
          value={selectedMarketplace}
          onChange={(e) => setSelectedMarketplace(e.target.value as MarketplaceCode)}
          className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
        >
          {ALL_MARKETPLACES.map(mp => {
            const expectations = MARKETPLACE_TEST_EXPECTATIONS[mp];
            return (
              <option key={mp} value={mp}>
                {mp} - {expectations.currency} {expectations.hasVAT ? '(VAT)' : ''}
              </option>
            );
          })}
        </select>
      </div>

      {/* Actions for Selected Marketplace */}
      <div className="space-y-2 mb-6">
        <button
          onClick={() => handleLoadTestData(selectedMarketplace)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Download className="w-4 h-4" />
          Load {selectedMarketplace} Test Data
        </button>

        <button
          onClick={() => handleRunSingleTest(selectedMarketplace)}
          disabled={isRunning}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Test {selectedMarketplace} Only
        </button>
      </div>

      {/* Individual Test Results */}
      {testResults.length > 0 && (
        <div className="border-t-2 border-gray-200 pt-4">
          <h4 className="font-bold text-sm mb-3 text-gray-700">Detailed Results</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {testResults.map(result => (
              <div
                key={result.marketplace}
                className={`p-3 rounded-lg text-sm ${
                  result.passed
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">{result.marketplace}</span>
                  <span className={result.passed ? 'text-green-600' : 'text-red-600'}>
                    {result.passed ? '✓ PASS' : '✗ FAIL'}
                  </span>
                </div>

                {result.error && (
                  <div className="text-xs text-red-600 mt-1">{result.error}</div>
                )}

                {result.calculations && (
                  <div className="text-xs text-gray-600 mt-2 space-y-1">
                    <div>Sales: {result.calculations.totalSales.toFixed(2)}</div>
                    <div>Refund Loss: {result.calculations.expectedRefundLoss.toFixed(2)}</div>
                    <div>Ad Cost: {result.calculations.advertisingCost.toFixed(2)}</div>
                    {result.calculations.totalVAT > 0 && (
                      <div>VAT: {result.calculations.totalVAT.toFixed(2)}</div>
                    )}
                  </div>
                )}

                {result.checks && !result.passed && (
                  <div className="text-xs text-red-600 mt-2">
                    Failed: {Object.entries(result.checks)
                      .filter(([_, v]) => !v)
                      .map(([k, _]) => k)
                      .join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-6 pt-4 border-t-2 border-gray-200 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>🧪 Test Infrastructure v1.0</span>
          <button
            onClick={() => console.clear()}
            className="text-purple-600 hover:text-purple-700"
          >
            Clear Console
          </button>
        </div>
        <div className="mt-2">
          Check browser console for detailed logs
        </div>
      </div>
    </div>
  );
};

// Export as default for easy import
export default TestPanel;
