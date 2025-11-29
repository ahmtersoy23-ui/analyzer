// Currency Exchange Utility
// Supports manual exchange rates and optional API integration

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'AED' | 'SAR' | 'TRY';

export interface ExchangeRates {
  [key: string]: {
    [key: string]: number;
  };
}

// Manuel döviz kurları (güncellenebilir)
// Base: USD = 1, TRY kurları yaklaşık değerler (1 USD = 34.5 TRY varsayımı)
export const FIXED_RATES: ExchangeRates = {
  USD: {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    CAD: 1.36,
    AUD: 1.52,
    AED: 3.67,
    SAR: 3.75,
    TRY: 34.5,
  },
  EUR: {
    USD: 1.09,
    EUR: 1,
    GBP: 0.86,
    CAD: 1.48,
    AUD: 1.65,
    AED: 4.00,
    SAR: 4.08,
    TRY: 37.5,
  },
  GBP: {
    USD: 1.27,
    EUR: 1.16,
    GBP: 1,
    CAD: 1.72,
    AUD: 1.92,
    AED: 4.65,
    SAR: 4.75,
    TRY: 43.8,
  },
  CAD: {
    USD: 0.74,
    EUR: 0.68,
    GBP: 0.58,
    CAD: 1,
    AUD: 1.12,
    AED: 2.70,
    SAR: 2.76,
    TRY: 25.4,
  },
  AUD: {
    USD: 0.66,
    EUR: 0.61,
    GBP: 0.52,
    CAD: 0.89,
    AUD: 1,
    AED: 2.41,
    SAR: 2.47,
    TRY: 22.7,
  },
  AED: {
    USD: 0.27,
    EUR: 0.25,
    GBP: 0.22,
    CAD: 0.37,
    AUD: 0.41,
    AED: 1,
    SAR: 1.02,
    TRY: 9.4,
  },
  SAR: {
    USD: 0.27,
    EUR: 0.25,
    GBP: 0.21,
    CAD: 0.36,
    AUD: 0.40,
    AED: 0.98,
    SAR: 1,
    TRY: 9.2,
  },
  TRY: {
    USD: 0.029,
    EUR: 0.027,
    GBP: 0.023,
    CAD: 0.039,
    AUD: 0.044,
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

  const rate = FIXED_RATES[from]?.[to];
  if (!rate) {
    console.warn(`Exchange rate not found for ${from} to ${to}, returning original amount`);
    return amount;
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

/**
 * Update exchange rates (for future API integration)
 */
export const updateExchangeRates = async (): Promise<ExchangeRates | null> => {
  // Future: API integration here
  // For now, return fixed rates
  return FIXED_RATES;
};
