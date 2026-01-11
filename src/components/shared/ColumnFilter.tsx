/**
 * ColumnFilter - Column-level numeric filtering with popover UI
 * Supports: >10, <100, 10-50, =25 formats
 */

import React, { useState, useRef, useEffect } from 'react';
import { Filter, X } from 'lucide-react';

export interface ColumnFilterValue {
  operator: '>' | '<' | '=' | 'range';
  value: number;
  value2?: number; // For range
}

interface ColumnFilterProps {
  column: string;
  value: ColumnFilterValue | null;
  onChange: (column: string, value: ColumnFilterValue | null) => void;
  color?: 'blue' | 'purple' | 'green' | 'amber';
}

// Parse filter string like ">10", "<100", "10-50", "=25"
export const parseFilterString = (input: string): ColumnFilterValue | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Range: 10-50
  const rangeMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    return {
      operator: 'range',
      value: parseFloat(rangeMatch[1]),
      value2: parseFloat(rangeMatch[2]),
    };
  }

  // Greater than: >10
  const gtMatch = trimmed.match(/^>\s*(\d+(?:\.\d+)?)$/);
  if (gtMatch) {
    return { operator: '>', value: parseFloat(gtMatch[1]) };
  }

  // Less than: <100
  const ltMatch = trimmed.match(/^<\s*(\d+(?:\.\d+)?)$/);
  if (ltMatch) {
    return { operator: '<', value: parseFloat(ltMatch[1]) };
  }

  // Equal: =25 or just 25
  const eqMatch = trimmed.match(/^=?\s*(\d+(?:\.\d+)?)$/);
  if (eqMatch) {
    return { operator: '=', value: parseFloat(eqMatch[1]) };
  }

  return null;
};

// Format filter value back to string
export const formatFilterValue = (filter: ColumnFilterValue | null): string => {
  if (!filter) return '';
  switch (filter.operator) {
    case 'range':
      return `${filter.value}-${filter.value2}`;
    case '>':
      return `>${filter.value}`;
    case '<':
      return `<${filter.value}`;
    case '=':
      return `${filter.value}`;
    default:
      return '';
  }
};

// Check if a value passes the filter
export const passesFilter = (
  dataValue: number,
  filter: ColumnFilterValue | null
): boolean => {
  if (!filter) return true;

  switch (filter.operator) {
    case '>':
      return dataValue > filter.value;
    case '<':
      return dataValue < filter.value;
    case '=':
      return Math.abs(dataValue - filter.value) < 0.01; // Small epsilon for float comparison
    case 'range':
      return dataValue >= filter.value && dataValue <= (filter.value2 ?? filter.value);
    default:
      return true;
  }
};

const colorMap = {
  blue: {
    active: 'text-blue-600 bg-blue-50',
    hover: 'hover:text-blue-600',
    ring: 'focus:ring-blue-500',
  },
  purple: {
    active: 'text-purple-600 bg-purple-50',
    hover: 'hover:text-purple-600',
    ring: 'focus:ring-purple-500',
  },
  green: {
    active: 'text-green-600 bg-green-50',
    hover: 'hover:text-green-600',
    ring: 'focus:ring-green-500',
  },
  amber: {
    active: 'text-amber-600 bg-amber-50',
    hover: 'hover:text-amber-600',
    ring: 'focus:ring-amber-500',
  },
};

export const ColumnFilter: React.FC<ColumnFilterProps> = ({
  column,
  value,
  onChange,
  color = 'blue',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(formatFilterValue(value));
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const colors = colorMap[color];

  // Update input when external value changes
  useEffect(() => {
    setInputValue(formatFilterValue(value));
  }, [value]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => inputRef.current?.focus(), 50);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleApply = () => {
    const parsed = parseFilterString(inputValue);
    onChange(column, parsed);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputValue('');
    onChange(column, null);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApply();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const isActive = value !== null;

  return (
    <div className="relative inline-flex" ref={popoverRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`p-0.5 rounded transition-colors ${
          isActive ? colors.active : `text-slate-400 ${colors.hover}`
        }`}
        title={isActive ? `Filter: ${formatFilterValue(value)}` : 'Add filter'}
      >
        <Filter className="w-3 h-3" />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 p-2 z-50 min-w-[160px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-slate-500 mb-1">
            Format: &gt;10, &lt;100, 10-50
          </div>
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder=">10"
              className={`w-20 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 ${colors.ring}`}
            />
            <button
              onClick={handleApply}
              className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded transition-colors"
            >
              Apply
            </button>
            {isActive && (
              <button
                onClick={handleClear}
                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                title="Clear filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ColumnFilter);
