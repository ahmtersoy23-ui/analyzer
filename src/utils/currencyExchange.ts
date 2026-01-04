// Currency Exchange Utility
// Supports Frankfurter API for live rates with fallback to cached/fixed rates

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'AED' | 'SAR' | 'TRY';

export interface ExchangeRates {
  [key: string]: {
    [key: string]: number;
  };
}

export interface ExchangeRateStatus {
  source: 'api' | 'cached' | 'fallback';
  lastUpdate: string | null;
  error: string | null;
}

// Storage key for cached rates
const CACHE_KEY = 'exchangeRates_cache';
const CACHE_TIMESTAMP_KEY = 'exchangeRates_timestamp';

// Current active rates (starts with fallback, updated by API)
let currentRates: ExchangeRates | null = null;
let rateStatus: ExchangeRateStatus = {
  source: 'fallback',
  lastUpdate: null,
  error: null,
};

// Fallback rates (used when API fails and no cache exists)
// Base: USD = 1
export const FALLBACK_RATES: ExchangeRates = {
  USD: {
    USD: 1,
    EUR: 0.95,
    GBP: 0.79,
    CAD: 1.40,
    AUD: 1.55,
    AED: 3.67,
    SAR: 3.75,
    TRY: 34.5,
  },
  EUR: {
    USD: 1.05,
    EUR: 1,
    GBP: 0.83,
    CAD: 1.47,
    AUD: 1.63,
    AED: 3.86,
    SAR: 3.95,
    TRY: 36.3,
  },
  GBP: {
    USD: 1.27,
    EUR: 1.20,
    GBP: 1,
    CAD: 1.77,
    AUD: 1.96,
    AED: 4.65,
    SAR: 4.75,
    TRY: 43.7,
  },
  CAD: {
    USD: 0.71,
    EUR: 0.68,
    GBP: 0.56,
    CAD: 1,
    AUD: 1.11,
    AED: 2.62,
    SAR: 2.68,
    TRY: 24.6,
  },
  AUD: {
    USD: 0.65,
    EUR: 0.61,
    GBP: 0.51,
    CAD: 0.90,
    AUD: 1,
    AED: 2.37,
    SAR: 2.42,
    TRY: 22.3,
  },
  AED: {
    USD: 0.27,
    EUR: 0.26,
    GBP: 0.22,
    CAD: 0.38,
    AUD: 0.42,
    AED: 1,
    SAR: 1.02,
    TRY: 9.4,
  },
  SAR: {
    USD: 0.27,
    EUR: 0.25,
    GBP: 0.21,
    CAD: 0.37,
    AUD: 0.41,
    AED: 0.98,
    SAR: 1,
    TRY: 9.2,
  },
  TRY: {
    USD: 0.029,
    EUR: 0.028,
    GBP: 0.023,
    CAD: 0.041,
    AUD: 0.045,
    AED: 0.106,
    SAR: 0.109,
    TRY: 1,
  },
};

// Para birimi sembolleri
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  AED: 'AED',
  SAR: 'SAR',
  TRY: '₺',
};

// Para birimi isimleri
export const CURRENCY_NAMES: Record<CurrencyCode, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
  TRY: 'Turkish Lira',
};

// Frankfurter API supported currencies (AED and SAR not supported, will use fixed peg to USD)
const FRANKFURTER_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'TRY'];
// Fixed pegs to USD (these currencies have fixed or semi-fixed rates)
const USD_PEGGED: Record<string, number> = {
  AED: 3.6725, // UAE Dirham pegged to USD
  SAR: 3.75,   // Saudi Riyal pegged to USD
};

/**
 * Load cached rates from localStorage
 */
const loadCachedRates = (): { rates: ExchangeRates | null; timestamp: string | null } => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (cached) {
      return { rates: JSON.parse(cached), timestamp };
    }
  } catch (e) {
    console.warn('Failed to load cached exchange rates:', e);
  }
  return { rates: null, timestamp: null };
};

/**
 * Save rates to localStorage cache
 */
const saveCachedRates = (rates: ExchangeRates): void => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rates));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString());
  } catch (e) {
    console.warn('Failed to cache exchange rates:', e);
  }
};

/**
 * Build complete exchange rate matrix from USD-based rates
 */
const buildRateMatrix = (usdRates: Record<string, number>): ExchangeRates => {
  const currencies = Object.keys(usdRates);
  const matrix: ExchangeRates = {};

  currencies.forEach(from => {
    matrix[from] = {};
    currencies.forEach(to => {
      if (from === to) {
        matrix[from][to] = 1;
      } else {
        // Convert through USD: from -> USD -> to
        const fromToUsd = 1 / usdRates[from];
        const usdToTo = usdRates[to];
        matrix[from][to] = fromToUsd * usdToTo;
      }
    });
  });

  return matrix;
};

/**
 * Fetch live exchange rates from Frankfurter API
 * https://www.frankfurter.app/ - Free, no API key required, ECB data
 */
export const fetchLiveRates = async (): Promise<{ rates: ExchangeRates; status: ExchangeRateStatus }> => {
  const { rates: cachedRates, timestamp: cachedTimestamp } = loadCachedRates();

  try {
    // Frankfurter API: Get rates from USD to all supported currencies
    const supportedSymbols = FRANKFURTER_CURRENCIES.filter(c => c !== 'USD').join(',');
    const response = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${supportedSymbols}`, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    // Build USD rates object (1 USD = X currency)
    const usdRates: Record<string, number> = {
      USD: 1,
      ...data.rates,
      // Add pegged currencies
      ...USD_PEGGED,
    };

    // Build complete matrix
    const rates = buildRateMatrix(usdRates);

    // Cache successful fetch
    saveCachedRates(rates);

    currentRates = rates;
    rateStatus = {
      source: 'api',
      lastUpdate: new Date().toISOString(),
      error: null,
    };

    console.log('Exchange rates updated from Frankfurter API:', data.date);
    return { rates, status: rateStatus };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.warn('Failed to fetch exchange rates from API:', errorMsg);

    // Try to use cached rates
    if (cachedRates) {
      currentRates = cachedRates;
      rateStatus = {
        source: 'cached',
        lastUpdate: cachedTimestamp,
        error: `API error: ${errorMsg}. Using cached rates from ${cachedTimestamp ? new Date(cachedTimestamp).toLocaleDateString('tr-TR') : 'unknown date'}.`,
      };
      console.log('Using cached exchange rates');
      return { rates: cachedRates, status: rateStatus };
    }

    // Fall back to hardcoded rates
    currentRates = FALLBACK_RATES;
    rateStatus = {
      source: 'fallback',
      lastUpdate: null,
      error: `API error: ${errorMsg}. Using fallback rates - values may be outdated!`,
    };
    console.log('Using fallback exchange rates');
    return { rates: FALLBACK_RATES, status: rateStatus };
  }
};

/**
 * Get current exchange rate status
 */
export const getExchangeRateStatus = (): ExchangeRateStatus => {
  return rateStatus;
};

/**
 * Get current active rates (fetched, cached, or fallback)
 */
export const getCurrentRates = (): ExchangeRates => {
  if (!currentRates) {
    // Initialize from cache or fallback
    const { rates: cachedRates, timestamp } = loadCachedRates();
    if (cachedRates) {
      currentRates = cachedRates;
      rateStatus = {
        source: 'cached',
        lastUpdate: timestamp,
        error: null,
      };
    } else {
      currentRates = FALLBACK_RATES;
      rateStatus = {
        source: 'fallback',
        lastUpdate: null,
        error: null,
      };
    }
  }
  return currentRates;
};

/**
 * Convert amount from one currency to another
 * @param amount - Amount to convert
 * @param from - Source currency code
 * @param to - Target currency code
 * @returns Converted amount
 */
export const convertCurrency = (
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode
): number => {
  if (from === to) return amount;

  const rates = getCurrentRates();
  const rate = rates[from]?.[to];

  if (!rate) {
    // CRITICAL: Missing exchange rate - this would cause severe calculation errors
    // Log error and return 0 to make the issue visible (not silently wrong data)
    console.error(`CRITICAL: Exchange rate not found for ${from} to ${to}. Amount: ${amount}`);
    // Return 0 instead of unconverted amount to prevent 30-40x inflation errors
    // This makes missing rates visible in reports rather than silently wrong
    return 0;
  }

  return amount * rate;
};

/**
 * Format currency amount with symbol
 * @param amount - Amount to format
 * @param currency - Currency code
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 */
export const formatCurrency = (
  amount: number,
  currency: CurrencyCode,
  decimals: number = 2
): string => {
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${symbol}${formatted}`;
};

/**
 * Get marketplace currency code from marketplace code
 */
export const getMarketplaceCurrency = (marketplaceCode: string): CurrencyCode => {
  const currencyMap: Record<string, CurrencyCode> = {
    US: 'USD',
    UK: 'GBP',
    DE: 'EUR',
    FR: 'EUR',
    IT: 'EUR',
    ES: 'EUR',
    CA: 'CAD',
    AU: 'AUD',
    AE: 'AED',
    SA: 'SAR',
  };

  return currencyMap[marketplaceCode] || 'USD';
};

// Legacy export for backward compatibility
export const FIXED_RATES = FALLBACK_RATES;

/**
 * @deprecated Use fetchLiveRates instead
 */
export const updateExchangeRates = async (): Promise<ExchangeRates | null> => {
  const { rates } = await fetchLiveRates();
  return rates;
};
