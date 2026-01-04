/**
 * Common formatting utilities
 * Centralized formatting functions to avoid duplication across components
 */

// Currency mapping for marketplaces
export const MARKETPLACE_CURRENCIES: Record<string, string> = {
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

// Cache for Intl.NumberFormat instances (performance optimization)
const formattersCache = new Map<string, Intl.NumberFormat>();

const getFormatter = (currency: string): Intl.NumberFormat => {
  if (!formattersCache.has(currency)) {
    formattersCache.set(currency, new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }));
  }
  return formattersCache.get(currency)!;
};

/**
 * Format money based on marketplace
 * Always uses en-US locale for Western numerals
 * @param amount - The amount to format
 * @param marketplace - Marketplace code (US, UK, DE, etc.) or 'all' for USD
 */
export const formatMoney = (amount: number, marketplace: string = 'all'): string => {
  const currency = marketplace === 'all'
    ? 'USD'
    : MARKETPLACE_CURRENCIES[marketplace] || 'USD';

  return getFormatter(currency).format(amount);
};

/**
 * Create a marketplace-specific formatMoney function
 * Useful for components that always use the same marketplace
 * @param marketplace - Marketplace code
 */
export const createMoneyFormatter = (marketplace: string) => {
  const currency = marketplace === 'all'
    ? 'USD'
    : MARKETPLACE_CURRENCIES[marketplace] || 'USD';
  const formatter = getFormatter(currency);
  return (amount: number) => formatter.format(amount);
};

/**
 * Format percentage with one decimal
 */
export const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

/**
 * Format number with thousand separators
 */
export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
};

/**
 * Calculate change between two values
 */
export const calculateChange = (current: number, previous: number): { value: number; percentage: number } => {
  const value = current - previous;
  const percentage = previous !== 0 ? (value / previous) * 100 : 0;
  return { value, percentage };
};

/**
 * Get dateOnly string from transaction, with fallback to Date object
 * Ensures date filtering works even for older data without dateOnly field
 * @param t - Transaction with optional date and dateOnly fields
 */
export const getDateOnly = (t: { date?: Date; dateOnly?: string }): string => {
  if (t.dateOnly) return t.dateOnly;
  if (t.date) {
    // Derive YYYY-MM-DD from Date object (local timezone)
    const d = t.date;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return '';
};
