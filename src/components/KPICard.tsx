import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number; // Percentage change
  changeLabel?: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'cyan';
  isLoading?: boolean;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  change,
  changeLabel,
  icon,
  color = 'blue',
  isLoading = false
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100',
  };

  const getTrendIcon = () => {
    if (change === undefined || change === 0) {
      return <Minus className="w-4 h-4" />;
    }
    return change > 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (change === undefined || change === 0) return 'text-slate-500';
    return change > 0 ? 'text-green-600' : 'text-red-600';
  };

  const getTrendBgColor = () => {
    if (change === undefined || change === 0) return 'bg-slate-100';
    return change > 0 ? 'bg-green-100' : 'bg-red-100';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-slate-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-600">{title}</h3>
        {icon && (
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="mb-2">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>

      {change !== undefined && (
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTrendColor()} ${getTrendBgColor()}`}>
            {getTrendIcon()}
            {Math.abs(change).toFixed(1)}%
          </span>
          {changeLabel && (
            <span className="text-xs text-slate-500">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(KPICard);
