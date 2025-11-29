/**
 * PieChart - Transaction distribution pie chart with comparison support
 */

import React from 'react';

interface PieChartProps {
  data: number[];
  labels: string[];
  colors: string[];
  comparisonData?: number[];
  comparisonTotalSales?: number;
  formatMoney: (amount: number) => string;
}

export const PieChart: React.FC<PieChartProps> = ({
  data,
  labels,
  colors,
  comparisonData,
  comparisonTotalSales,
  formatMoney
}) => {
  let currentAngle = -90;
  const radius = 80;
  const centerX = 100;
  const centerY = 100;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-64 h-64 print:w-32 print:h-32">
        {data.map((value: number, index: number) => {
          if (value <= 0) return null;
          const percentage = (value / data.reduce((a: number, b: number) => a + b, 0)) * 100;
          const angle = (percentage / 100) * 360;
          const startAngle = currentAngle;
          const endAngle = currentAngle + angle;

          const startRad = (startAngle * Math.PI) / 180;
          const endRad = (endAngle * Math.PI) / 180;

          const x1 = centerX + radius * Math.cos(startRad);
          const y1 = centerY + radius * Math.sin(startRad);
          const x2 = centerX + radius * Math.cos(endRad);
          const y2 = centerY + radius * Math.sin(endRad);

          const largeArc = angle > 180 ? 1 : 0;

          const pathData = [
            `M ${centerX} ${centerY}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            'Z'
          ].join(' ');

          currentAngle = endAngle;

          return (
            <path
              key={index}
              d={pathData}
              fill={colors[index]}
              stroke="white"
              strokeWidth="2"
            />
          );
        })}
      </svg>
      <div className="mt-4 space-y-2 print:mt-2 print:space-y-1">
        {data.map((value: number, index: number) => {
          const total = data.reduce((a: number, b: number) => a + b, 0);
          const percentage = total > 0 ? (value / total) * 100 : 0;

          // Comparison percentage calculation
          let percentageChange = null;
          if (comparisonData && comparisonData[index] && comparisonTotalSales && comparisonTotalSales > 0) {
            const compPercentage = (comparisonData[index] / comparisonTotalSales) * 100;
            percentageChange = percentage - compPercentage;
          }

          // Color logic: Net Kalan increase = good (green), expenses increase = bad (red)
          const isNetRemaining = labels[index] === 'Net Kalan';
          const isPositiveChange = percentageChange && percentageChange > 0;
          const changeColor = isNetRemaining
            ? (isPositiveChange ? 'text-green-600' : 'text-red-600')
            : (isPositiveChange ? 'text-red-600' : 'text-green-600');

          return value > 0 && (
            <div key={index} className="flex items-center gap-2 text-sm print:text-[9px] print:gap-1">
              <div
                className="w-4 h-4 rounded print:w-2 print:h-2"
                style={{ backgroundColor: colors[index] }}
              />
              <span className="text-slate-700 print:text-slate-600">{labels[index]}:</span>
              <span className="font-semibold print:font-medium">
                {formatMoney(value)} ({percentage.toFixed(1)}%)
                {percentageChange !== null && Math.abs(percentageChange) >= 0.1 && (
                  <span className={`ml-2 text-xs print:text-[8px] print:ml-1 ${changeColor}`}>
                    {percentageChange > 0 ? '↑' : '↓'} {Math.abs(percentageChange).toFixed(1)}pp
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(PieChart);
