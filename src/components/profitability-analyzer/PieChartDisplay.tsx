import React, { useState } from 'react';

export interface PieChartDataItem {
  label: string;
  value: number;
  color: string;
}

interface PieChartDisplayProps {
  data: PieChartDataItem[];
  formatMoney: (value: number) => string;
  showAsPercentOfRevenue?: boolean;
  totalRevenue?: number;
  large?: boolean;
  hideLegend?: boolean;
  onHoverIndex?: (index: number | null) => void;
  highlightIndex?: number | null;
}

const PieChartDisplay: React.FC<PieChartDisplayProps> = ({
  data,
  formatMoney,
  showAsPercentOfRevenue = false,
  totalRevenue = 0,
  large = false,
  hideLegend = false,
  onHoverIndex,
  highlightIndex,
}) => {
  const [localHoverIndex, setLocalHoverIndex] = useState<number | null>(null);

  // Use external highlight if provided, otherwise use local hover
  const activeIndex = highlightIndex !== undefined ? highlightIndex : localHoverIndex;

  // Filter out zero or negative values
  const filteredData = data.filter(item => item.value > 0);
  const total = filteredData.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No data to display
      </div>
    );
  }

  // Calculate pie slices
  let currentAngle = -90; // Start from top
  const slices = filteredData.map((item) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;

    // Calculate arc path
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = ((startAngle + angle) * Math.PI) / 180;

    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    const pathD =
      angle >= 359.99
        ? `M 50 10 A 40 40 0 1 1 49.99 10 Z`
        : `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return {
      ...item,
      percentage,
      pathD,
    };
  });

  const handleMouseEnter = (idx: number) => {
    setLocalHoverIndex(idx);
    onHoverIndex?.(idx);
  };

  const handleMouseLeave = () => {
    setLocalHoverIndex(null);
    onHoverIndex?.(null);
  };

  // Get hovered slice info for center display
  const hoveredSlice = activeIndex !== null ? slices[activeIndex] : null;

  return (
    <div className="flex flex-col items-center">
      {/* SVG Pie Chart */}
      <svg viewBox="0 0 100 100" className={large ? "w-56 h-56 mb-4" : "w-40 h-40 mb-4"}>
        {slices.map((slice, idx) => (
          <path
            key={idx}
            d={slice.pathD}
            fill={slice.color}
            stroke="white"
            strokeWidth="0.5"
            style={{
              opacity: activeIndex !== null && activeIndex !== idx ? 0.4 : 1,
              transform: activeIndex === idx ? 'scale(1.03)' : 'scale(1)',
              transformOrigin: '50px 50px',
              transition: 'opacity 0.15s ease, transform 0.15s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={() => handleMouseEnter(idx)}
            onMouseLeave={handleMouseLeave}
          >
            <title>{slice.label}: {formatMoney(slice.value)} ({slice.percentage.toFixed(1)}%)</title>
          </path>
        ))}
        {/* Center hole for donut effect */}
        <circle cx="50" cy="50" r="20" fill="white" />
        {/* Center text when hovering */}
        {hoveredSlice && (
          <>
            <text x="50" y="47" textAnchor="middle" className="text-[6px] font-medium fill-slate-700">
              {hoveredSlice.label}
            </text>
            <text x="50" y="55" textAnchor="middle" className="text-[5px] font-semibold fill-slate-900">
              {hoveredSlice.percentage.toFixed(1)}%
            </text>
          </>
        )}
      </svg>

      {/* Legend - conditionally shown */}
      {!hideLegend && (
        <div className="w-full space-y-1">
          {slices.map((slice, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between text-xs rounded px-1 py-0.5 transition-colors duration-150 cursor-pointer ${
                activeIndex === idx ? 'bg-slate-200' : 'hover:bg-slate-100'
              }`}
              style={{
                opacity: activeIndex !== null && activeIndex !== idx ? 0.5 : 1,
              }}
              onMouseEnter={() => handleMouseEnter(idx)}
              onMouseLeave={handleMouseLeave}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="text-slate-600 truncate">{slice.label}</span>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="font-medium text-slate-700">{formatMoney(slice.value)}</span>
                <span className="text-slate-400 w-12">
                  {showAsPercentOfRevenue && totalRevenue > 0
                    ? `${((slice.value / totalRevenue) * 100).toFixed(1)}%`
                    : `${slice.percentage.toFixed(1)}%`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default React.memo(PieChartDisplay);
