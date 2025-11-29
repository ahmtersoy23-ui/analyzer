import React from 'react';

interface SortableHeaderProps {
  column: string;
  label: string;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
  align?: 'left' | 'right' | 'center';
  color?: 'blue' | 'purple' | 'green' | 'amber';
  className?: string;
}

const colorMap = {
  blue: 'text-blue-600',
  purple: 'text-purple-600',
  green: 'text-green-600',
  amber: 'text-amber-600',
};

export const SortableHeader: React.FC<SortableHeaderProps> = ({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
  align = 'left',
  color = 'blue',
  className = '',
}) => {
  const alignClass = align === 'right' ? 'text-right justify-end' : align === 'center' ? 'text-center justify-center' : 'text-left';

  return (
    <th
      className={`px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors ${alignClass} ${className}`}
      onClick={() => onSort(column)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
        {label}
        {sortColumn === column && (
          <span className={colorMap[color]}>
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );
};

export default React.memo(SortableHeader);
