import React from 'react';

interface StatusBadgeProps {
  label: string;
  value: number | string;
  isReady: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ label, value, isReady }) => (
  <div
    className={`px-3 py-1.5 rounded-full text-sm font-medium ${
      isReady
        ? 'bg-green-100 text-green-800'
        : 'bg-slate-100 text-slate-500'
    }`}
  >
    {isReady ? '✓' : '○'} {label}: {value}
  </div>
);

export default React.memo(StatusBadge);
