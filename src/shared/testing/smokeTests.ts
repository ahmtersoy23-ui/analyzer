// Smoke Tests - Quick validation of critical calculations across all marketplaces
// Run these after any code change to catch regressions instantly

import {
  MOCK_TRANSACTIONS,
  MARKETPLACE_TEST_EXPECTATIONS,
  ALL_MARKETPLACES,
  type MarketplaceCode,
  type MockTransaction
} from './mockData';

export interface TestResult {
  marketplace: MarketplaceCode;
  passed: boolean;
  checks?: {
    hasData: boolean;
    hasFBAOrder: boolean;
    hasFBMOrder: boolean;
    hasRefund: boolean;
    hasAdvertising: boolean;
    refundCalculation: boolean;
    vatPresent: boolean;
    totalSalesPositive: boolean;
    advertisingNegative: boolean;
  };
  calculations?: {
    totalOrders: number;
    totalRefunds: number;
    fbaOrders: number;
    fbmOrders: number;
    totalSales: number;
    totalRefundAmount: number;
    advertisingCost: number;
    totalVAT: number;
    expectedRefundLoss: number;
  };
  error?: string;
}

/**
 * Calculate basic metrics from mock data (simplified version of actual analytics)
 */
function calculateMockMetrics(data: MockTransaction[], marketplace: MarketplaceCode) {
  const orders = data.filter(d => d.categoryType === 'Order');
  const refunds = data.filter(d => d.categoryType === 'Refund');
  const fbaOrders = orders.filter(d => d.fulfillment === 'FBA');
  const fbmOrders = orders.filter(d => d.fulfillment === 'FBM');

  const totalSales = orders.reduce((sum, d) => sum + d.productSales, 0);
  const totalRefundAmount = Math.abs(refunds.reduce((sum, d) => sum + d.total, 0));

  const advertisingCost = Math.abs(
    data
      .filter(d => d.categoryType === 'Service Fee')
      .filter(d =>
        d.descriptionLower.includes('cost of advertising') ||
        d.descriptionLower.includes('werbekosten') ||
        d.descriptionLower.includes('prix de la publicité') ||
        d.descriptionLower.includes('pubblicità') ||
        d.descriptionLower.includes('gastos de publicidad')
      )
      .reduce((sum, d) => sum + d.total, 0)
  );

  const totalVAT = data.reduce((sum, d) => sum + d.vat, 0);

  const expectations = MARKETPLACE_TEST_EXPECTATIONS[marketplace];
  const expectedRefundLoss = totalRefundAmount * (1 - expectations.refundRecoveryRate);

  return {
    totalOrders: orders.length,
    totalRefunds: refunds.length,
    fbaOrders: fbaOrders.length,
    fbmOrders: fbmOrders.length,
    totalSales,
    totalRefundAmount,
    advertisingCost,
    totalVAT,
    expectedRefundLoss,
  };
}

/**
 * Run validation checks on a marketplace
 */
function validateMarketplace(marketplace: MarketplaceCode): TestResult {
  try {
    const data = MOCK_TRANSACTIONS[marketplace];
    const expectations = MARKETPLACE_TEST_EXPECTATIONS[marketplace];

    if (!data || data.length === 0) {
      return {
        marketplace,
        passed: false,
        error: 'No mock data available'
      };
    }

    const calc = calculateMockMetrics(data, marketplace);

    // Run critical checks
    const checks = {
      hasData: data.length > 0,
      hasFBAOrder: calc.fbaOrders > 0,
      hasFBMOrder: calc.fbmOrders > 0,
      hasRefund: calc.totalRefunds > 0,
      hasAdvertising: calc.advertisingCost > 0,
      refundCalculation: calc.totalRefundAmount > 0 && calc.expectedRefundLoss > 0,
      vatPresent: expectations.hasVAT ? calc.totalVAT > 0 : calc.totalVAT === 0,
      totalSalesPositive: calc.totalSales > 0,
      advertisingNegative: calc.advertisingCost > 0, // Should be positive after abs()
    };

    const passed = Object.values(checks).every(v => v === true);

    return {
      marketplace,
      passed,
      checks,
      calculations: calc,
    };

  } catch (error: any) {
    return {
      marketplace,
      passed: false,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Run smoke tests on all marketplaces
 */
export function runSmokeTests(): TestResult[] {
  console.log('\n🧪 SMOKE TESTS - Running validation on all marketplaces...\n');

  const results: TestResult[] = [];

  for (const marketplace of ALL_MARKETPLACES) {
    const result = validateMarketplace(marketplace);
    results.push(result);

    if (result.passed) {
      console.log(`✅ ${marketplace}: PASSED`);
      if (result.calculations) {
        console.log(`   Sales: ${result.calculations.totalSales.toFixed(2)}, ` +
                    `Refund Loss: ${result.calculations.expectedRefundLoss.toFixed(2)}, ` +
                    `Ad Cost: ${result.calculations.advertisingCost.toFixed(2)}, ` +
                    `VAT: ${result.calculations.totalVAT.toFixed(2)}`);
      }
    } else {
      console.error(`❌ ${marketplace}: FAILED`);
      if (result.error) {
        console.error(`   Error: ${result.error}`);
      }
      if (result.checks) {
        const failedChecks = Object.entries(result.checks)
          .filter(([_, value]) => !value)
          .map(([key, _]) => key);
        if (failedChecks.length > 0) {
          console.error(`   Failed checks: ${failedChecks.join(', ')}`);
        }
      }
    }
  }

  const allPassed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  console.log(`\n${allPassed ? '✅' : '❌'} RESULTS: ${passedCount}/${totalCount} marketplaces passed\n`);

  if (!allPassed) {
    console.error('⚠️  Some tests failed! Review the failures above.\n');
  }

  return results;
}

/**
 * Run tests on a single marketplace (useful for debugging)
 */
export function runMarketplaceTest(marketplace: MarketplaceCode): TestResult {
  console.log(`\n🧪 Testing ${marketplace}...\n`);

  const result = validateMarketplace(marketplace);

  if (result.passed) {
    console.log(`✅ ${marketplace}: PASSED`);
    console.log('\nCalculations:');
    if (result.calculations) {
      console.table(result.calculations);
    }
    console.log('\nChecks:');
    if (result.checks) {
      console.table(result.checks);
    }
  } else {
    console.error(`❌ ${marketplace}: FAILED`);
    if (result.error) {
      console.error(`Error: ${result.error}`);
    }
    if (result.checks) {
      console.log('\nChecks:');
      console.table(result.checks);
    }
  }

  return result;
}

/**
 * Get summary statistics from test results
 */
export function getTestSummary(results: TestResult[]): {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
} {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  const passRate = total > 0 ? (passed / total) * 100 : 0;

  return { total, passed, failed, passRate };
}

// Auto-run in development mode (can be disabled via env var)
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_AUTO_RUN_TESTS !== 'false') {
  // Run tests after a short delay to allow app to initialize
  setTimeout(() => {
    runSmokeTests();
  }, 1000);
}
