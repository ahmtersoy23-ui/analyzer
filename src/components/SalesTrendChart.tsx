import React, { useMemo, useState } from 'react';
import { TransactionData } from '../types/transaction';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SalesTrendChartProps {
  orders: TransactionData[];
  comparisonOrders?: TransactionData[];
  currency: string;
  height?: number;
  defaultDaysToShow?: number;
}

interface DataPoint {
  date: Date;
  sales: number;
  orders: number;
}

const SalesTrendChart: React.FC<SalesTrendChartProps> = ({ orders, comparisonOrders, currency, height = 300, defaultDaysToShow = 30 }) => {
  const [daysToShow, setDaysToShow] = useState(defaultDaysToShow);
  const [startIndex, setStartIndex] = useState(0);

  // Group sales by date
  const allChartData = useMemo(() => {
    const dataByDate: Record<string, { sales: number; orders: number }> = {};

    orders.forEach(order => {
      const dateKey = order.date.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!dataByDate[dateKey]) {
        dataByDate[dateKey] = { sales: 0, orders: 0 };
      }
      dataByDate[dateKey].sales += order.productSales;
      dataByDate[dateKey].orders += 1;
    });

    // Convert to array and sort by date
    const data: DataPoint[] = Object.entries(dataByDate)
      .map(([dateStr, values]) => ({
        date: new Date(dateStr),
        sales: values.sales,
        orders: values.orders
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return data;
  }, [orders]);

  // Group comparison sales by date
  const allComparisonData = useMemo(() => {
    if (!comparisonOrders) return [];

    const dataByDate: Record<string, { sales: number; orders: number }> = {};

    comparisonOrders.forEach(order => {
      const dateKey = order.date.toISOString().split('T')[0];
      if (!dataByDate[dateKey]) {
        dataByDate[dateKey] = { sales: 0, orders: 0 };
      }
      dataByDate[dateKey].sales += order.productSales;
      dataByDate[dateKey].orders += 1;
    });

    const data: DataPoint[] = Object.entries(dataByDate)
      .map(([dateStr, values]) => ({
        date: new Date(dateStr),
        sales: values.sales,
        orders: values.orders
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return data;
  }, [comparisonOrders]);

  // Calculate chart dimensions and scales
  const { chartData, comparisonChartData, maxSales, points, comparisonPoints, xLabels } = useMemo(() => {
    // Slice data based on current view window
    const endIndex = Math.min(startIndex + daysToShow, allChartData.length);
    const chartData = allChartData.slice(startIndex, endIndex);

    const comparisonEndIndex = Math.min(startIndex + daysToShow, allComparisonData.length);
    const comparisonChartData = allComparisonData.length > 0 ? allComparisonData.slice(startIndex, comparisonEndIndex) : [];

    if (chartData.length === 0) {
      return { chartData: [], comparisonChartData: [], maxSales: 0, points: '', comparisonPoints: '', xLabels: [] };
    }

    // Calculate max considering both current and comparison data
    const allSalesValues = [
      ...chartData.map(d => d.sales),
      ...(comparisonChartData.length > 0 ? comparisonChartData.map(d => d.sales) : [])
    ];
    const maxSales = Math.max(...allSalesValues, 1);

    const chartWidth = 800;
    const chartHeight = height - 60; // Leave space for labels
    const padding = 40;

    const xStep = (chartWidth - padding * 2) / (chartData.length - 1 || 1);
    const yScale = (chartHeight - padding * 2) / maxSales;

    // Generate SVG path for current period
    const pathPoints = chartData
      .map((d, i) => {
        const x = padding + i * xStep;
        const y = chartHeight - padding - d.sales * yScale;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    // Generate SVG path for comparison period
    const comparisonPathPoints = comparisonChartData.length > 0
      ? comparisonChartData
          .map((d, i) => {
            const x = padding + i * xStep;
            const y = chartHeight - padding - d.sales * yScale;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
          })
          .join(' ')
      : '';

    // Generate x-axis labels (show max 10 labels evenly distributed)
    const labelStep = Math.ceil(chartData.length / 10);
    const xLabels = chartData
      .map((d, i) => {
        if (i % labelStep === 0 || i === chartData.length - 1) {
          const x = padding + i * xStep;
          return {
            x,
            label: d.date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })
          };
        }
        return null;
      })
      .filter(Boolean) as { x: number; label: string }[];

    return { chartData, comparisonChartData, maxSales, points: pathPoints, comparisonPoints: comparisonPathPoints, xLabels };
  }, [allChartData, allComparisonData, startIndex, daysToShow, height]);

  const canGoPrev = startIndex > 0;
  const canGoNext = startIndex + daysToShow < allChartData.length;

  const handlePrev = () => {
    setStartIndex(Math.max(0, startIndex - Math.floor(daysToShow / 2)));
  };

  const handleNext = () => {
    setStartIndex(Math.min(allChartData.length - daysToShow, startIndex + Math.floor(daysToShow / 2)));
  };

  if (allChartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 rounded-lg">
        <p className="text-slate-500">Trend verisi yok</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-slate-800">Satış Trendi</h3>

          {/* Legend */}
          {comparisonChartData.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-0.5 bg-blue-600 rounded"></div>
                <span className="text-slate-600">Güncel</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-0.5 bg-slate-400 rounded" style={{ backgroundImage: 'repeating-linear-gradient(to right, #94a3b8 0px, #94a3b8 6px, transparent 6px, transparent 10px)' }}></div>
                <span className="text-slate-600">Önceki Dönem</span>
              </div>
            </div>
          )}
        </div>

        {/* Date Range Controls */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">
            {chartData.length > 0 && `${chartData[0].date.toLocaleDateString('tr-TR')} - ${chartData[chartData.length - 1].date.toLocaleDateString('tr-TR')}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={!canGoPrev}
              className={`p-1 rounded ${canGoPrev ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-300 cursor-not-allowed'}`}
              title="Önceki dönem"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              disabled={!canGoNext}
              className={`p-1 rounded ${canGoNext ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-300 cursor-not-allowed'}`}
              title="Sonraki dönem"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-slate-600 mb-1">Toplam Satış</p>
          <p className="text-xl font-bold text-blue-600">
            {currency}{chartData.reduce((sum, d) => sum + d.sales, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <p className="text-sm text-slate-600 mb-1">Ortalama Günlük</p>
          <p className="text-xl font-bold text-green-600">
            {currency}{(chartData.reduce((sum, d) => sum + d.sales, 0) / chartData.length).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <p className="text-sm text-slate-600 mb-1">Toplam Gün</p>
          <p className="text-xl font-bold text-purple-600">{chartData.length}</p>
        </div>
      </div>

      <svg width="100%" height={height} viewBox="0 0 800 300" preserveAspectRatio="xMidYMid meet" className="overflow-visible">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = 260 - ratio * 200;
          return (
            <g key={ratio}>
              <line
                x1="40"
                y1={y}
                x2="760"
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text x="25" y={y + 5} fontSize="12" fill="#64748b" textAnchor="end">
                {currency}{(maxSales * ratio).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </text>
            </g>
          );
        })}

        {/* Comparison period line (behind current) */}
        {comparisonPoints && (
          <path
            d={comparisonPoints}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6 4"
            opacity="0.7"
          />
        )}

        {/* Area fill */}
        <path
          d={`${points} L 760 260 L 40 260 Z`}
          fill="url(#salesGradient)"
          opacity="0.3"
        />

        {/* Current period line */}
        <path
          d={points}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Comparison data points */}
        {comparisonChartData.map((d, i) => {
          const x = 40 + i * ((800 - 80) / (comparisonChartData.length - 1 || 1));
          const y = 260 - (d.sales / maxSales) * 200;
          return (
            <g key={`comp-${i}`}>
              <circle
                cx={x}
                cy={y}
                r="3"
                fill="#94a3b8"
                stroke="white"
                strokeWidth="1.5"
                opacity="0.7"
              />
              <title>{`Önceki: ${d.date.toLocaleDateString()}: ${currency}${d.sales.toLocaleString()}\n${d.orders} sipariş`}</title>
            </g>
          );
        })}

        {/* Current data points */}
        {chartData.map((d, i) => {
          const x = 40 + i * ((800 - 80) / (chartData.length - 1 || 1));
          const y = 260 - (d.sales / maxSales) * 200;
          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r="4"
                fill="#3b82f6"
                stroke="white"
                strokeWidth="2"
              />
              <title>{`${d.date.toLocaleDateString()}: ${currency}${d.sales.toLocaleString()}\n${d.orders} sipariş`}</title>
            </g>
          );
        })}

        {/* X-axis labels */}
        {xLabels.map((label, i) => (
          <text
            key={i}
            x={label.x}
            y="280"
            fontSize="11"
            fill="#64748b"
            textAnchor="middle"
          >
            {label.label}
          </text>
        ))}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="salesGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
          </linearGradient>
        </defs>
      </svg>

      {/* Range Slider - Always show */}
      <div className="mt-6 pt-4 border-t border-slate-200">
        <div className="flex flex-col gap-3">
          {/* Days slider */}
          {allChartData.length > 7 && (
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                Gösterilecek gün: {daysToShow}
              </label>
              <input
                type="range"
                min="7"
                max={Math.min(allChartData.length, 90)}
                value={daysToShow}
                onChange={(e) => {
                  const newDays = parseInt(e.target.value);
                  setDaysToShow(newDays);
                  // Reset to start if current range would exceed data length
                  if (startIndex + newDays > allChartData.length) {
                    setStartIndex(Math.max(0, allChartData.length - newDays));
                  }
                }}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDaysToShow(7);
                    setStartIndex(Math.max(0, allChartData.length - 7));
                  }}
                  className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                >
                  Son 7 Gün
                </button>
                <button
                  onClick={() => {
                    setDaysToShow(30);
                    setStartIndex(Math.max(0, allChartData.length - 30));
                  }}
                  className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                >
                  Son 30 Gün
                </button>
                <button
                  onClick={() => {
                    setDaysToShow(allChartData.length);
                    setStartIndex(0);
                  }}
                  className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
                >
                  Tümü
                </button>
              </div>
            </div>
          )}

          {/* Position slider - only show when not showing all data */}
          {allChartData.length > daysToShow && (
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                Pozisyon:
              </label>
              <input
                type="range"
                min="0"
                max={allChartData.length - daysToShow}
                value={startIndex}
                onChange={(e) => setStartIndex(parseInt(e.target.value))}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600"
              />
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {startIndex + 1} - {Math.min(startIndex + daysToShow, allChartData.length)} / {allChartData.length} gün
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(SalesTrendChart);
