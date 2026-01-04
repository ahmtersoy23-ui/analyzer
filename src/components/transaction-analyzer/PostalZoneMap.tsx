/**
 * PostalZoneMap - SVG-based postal zone visualization
 */

import React, { useState } from 'react';
import type { PostalZone } from '../../types/transaction';

interface PostalZoneMapProps {
  zones: Record<string, PostalZone>;
  totalOrders: number;
  formatMoney: (n: number) => string;
  zoneNames?: Record<string, string>;
}

export const PostalZoneMap: React.FC<PostalZoneMapProps> = ({
  zones,
  totalOrders,
  formatMoney,
  zoneNames = {}
}) => {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  const maxCount = Math.max(...Object.values(zones).map(z => z.count), 1);

  const getColor = (count: number) => {
    const intensity = count / maxCount;
    return `rgba(59, 130, 246, ${0.2 + intensity * 0.8})`;
  };

  // Get all unique zones from data
  const allZones = Object.keys(zones).sort();
  const zonesPerRow = Math.ceil(Math.sqrt(allZones.length));
  const totalRows = Math.ceil(allZones.length / zonesPerRow);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${zonesPerRow * 110 + 10} ${totalRows * 125 + 10}`} className="w-full h-auto">
        {allZones.map((zone, index) => {
          const data = zones[zone] || { count: 0, sales: 0 };
          const row = Math.floor(index / zonesPerRow);
          const col = index % zonesPerRow;
          const isHovered = hoveredZone === zone;
          const zoneName = zoneNames[zone] || '';

          return (
            <g key={zone}>
              <rect
                x={col * 110 + 5}
                y={row * 125 + 5}
                width={100}
                height={115}
                rx={8}
                fill={getColor(data.count)}
                stroke={isHovered ? '#3b82f6' : data.count > 0 ? '#3b82f6' : '#e2e8f0'}
                strokeWidth={isHovered ? 3 : 2}
                className="transition-all cursor-pointer"
                onMouseEnter={() => setHoveredZone(zone)}
                onMouseLeave={() => setHoveredZone(null)}
              />
              {/* Zone title */}
              <text
                x={col * 110 + 55}
                y={row * 125 + 30}
                textAnchor="middle"
                className="fill-slate-800 font-bold text-base pointer-events-none"
                style={{ fontSize: zoneName ? '12px' : '24px' }}
              >
                {zoneName || zone}
              </text>
              {/* Zone code if name exists */}
              {zoneName && (
                <text
                  x={col * 110 + 55}
                  y={row * 125 + 48}
                  textAnchor="middle"
                  className="fill-slate-600 text-xs pointer-events-none"
                >
                  ({zone})
                </text>
              )}
              {/* Order count */}
              <text
                x={col * 110 + 55}
                y={row * 125 + (zoneName ? 70 : 60)}
                textAnchor="middle"
                className="fill-slate-700 font-semibold text-sm pointer-events-none"
              >
                {data.count}
              </text>
              {/* Percentage */}
              <text
                x={col * 110 + 55}
                y={row * 125 + (zoneName ? 88 : 78)}
                textAnchor="middle"
                className="fill-slate-600 text-xs pointer-events-none"
              >
                {totalOrders > 0 ? `${((data.count / totalOrders) * 100).toFixed(1)}%` : '0%'}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredZone && zones[hoveredZone] && (() => {
        const zone = hoveredZone;
        return (
          <div className="absolute top-2 right-2 bg-white rounded-lg shadow-lg p-3 border-2 border-blue-500 z-10">
            <p className="text-lg font-bold text-slate-800">
              {zoneNames[zone] ? zoneNames[zone] : `Zone ${zone}`}
            </p>
            {zoneNames[zone] && (
              <p className="text-xs text-slate-500">Zone {zone}</p>
            )}
            <p className="text-sm text-slate-600 mt-1">{zones[zone].count} orders</p>
            <p className="text-sm font-semibold text-blue-600">{formatMoney(zones[zone].sales)}</p>
          </div>
        );
      })()}

      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(59, 130, 246, 0.3)' }}></div>
          <span>Few orders</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(59, 130, 246, 1)' }}></div>
          <span>Many orders</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PostalZoneMap);
