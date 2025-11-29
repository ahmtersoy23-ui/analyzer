/**
 * ComparisonBadge - Shows percentage change between periods
 */

import React from 'react';
import { calculateChange } from '../../utils/formatters';

interface ComparisonBadgeProps {
  current: number;
  previous: number;
  formatFn?: (n: number) => string;
}

export const ComparisonBadge: React.FC<ComparisonBadgeProps> = ({
  current,
  previous,
  formatFn = (n) => n.toFixed(1)
}) => {
  const change = calculateChange(current, previous);
  const isPositive = change.value > 0;
  const isNeutral = Math.abs(change.percentage) < 0.1;

  if (isNeutral) return null;

  const absPercentage = Math.abs(change.percentage);
  const percentageDisplay = absPercentage >= 100
    ? Math.round(absPercentage).toString()
    : absPercentage.toFixed(1);

  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
      isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {isPositive ? '↑' : '↓'}{percentageDisplay}%
    </span>
  );
};

export default React.memo(ComparisonBadge);
