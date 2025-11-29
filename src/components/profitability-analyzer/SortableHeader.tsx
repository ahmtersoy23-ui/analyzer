import React from 'react';

interface SortableHeaderProps {
  column: string;
  label: string;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
  align?: 'left' | 'right';
}

const SortableHeader: React.FC<SortableHeaderProps> = ({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
  align = 'left',
}) => (
  <th
    className={`px-4 py-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors ${
      align === 'right' ? 'text-right' : 'text-left'
    }`}
    onClick={() => onSort(column)}
  >
    <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
      {label}
      {sortColumn === column && (
        <span className="text-purple-600">
          {sortDirection === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </div>
  </th>
);

export default React.memo(SortableHeader);
