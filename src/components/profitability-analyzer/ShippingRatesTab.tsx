/**
 * Shipping Rates Tab - Kargo cetveli yükleme ve düzenleme
 */

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Trash2 } from 'lucide-react';
import { ShippingRateTable, ShippingRoute } from '../../types/profitability';
import { createEmptyShippingRates } from '../../services/profitability/configService';

interface ShippingRatesTabProps {
  shippingRates: ShippingRateTable;
  onFileUpload: (data: Record<string, any>[]) => void;
  onUpdate: (rates: ShippingRateTable) => void;
}

const ROUTE_LABELS: Record<ShippingRoute, { label: string; flag: string }> = {
  'US-US': { label: 'US → US', flag: '🇺🇸' },
  'US-TR': { label: 'TR → US', flag: '🇹🇷→🇺🇸' },
  'UK': { label: 'UK', flag: '🇬🇧' },
  'CA': { label: 'Kanada', flag: '🇨🇦' },
  'EU': { label: 'Avrupa', flag: '🇪🇺' },
  'AU': { label: 'Avustralya', flag: '🇦🇺' },
  'UAE': { label: 'BAE', flag: '🇦🇪' },
  'TR': { label: 'Türkiye', flag: '🇹🇷' },
  'SG': { label: 'Singapur', flag: '🇸🇬' },
  'SA': { label: 'Suudi Arabistan', flag: '🇸🇦' },
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  TRY: '₺',
};

const ShippingRatesTab: React.FC<ShippingRatesTabProps> = ({
  shippingRates,
  onFileUpload,
  onUpdate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<ShippingRoute>('US-TR');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        onFileUpload(jsonData as Record<string, any>[]);
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('File read error:', error);
      alert('Dosya okunamadı');
    }
  };

  const handleRateChange = (desi: number, newRate: number) => {
    const updatedRates = { ...shippingRates };
    const routeRates = updatedRates.routes[selectedRoute].rates;
    const existingIndex = routeRates.findIndex(r => r.desi === desi);

    if (existingIndex >= 0) {
      routeRates[existingIndex].rate = newRate;
    } else {
      routeRates.push({ desi, rate: newRate });
      routeRates.sort((a, b) => a.desi - b.desi);
    }

    onUpdate(updatedRates);
  };

  const exportToExcel = () => {
    // Get all unique desi values
    const allDesi = new Set<number>();
    Object.values(shippingRates.routes).forEach(route => {
      route.rates.forEach(r => allDesi.add(r.desi));
    });
    const sortedDesi = Array.from(allDesi).sort((a, b) => a - b);

    // Build data
    const data = sortedDesi.map(desi => {
      const row: Record<string, any> = { desi };
      Object.keys(shippingRates.routes).forEach(route => {
        const routeRate = shippingRates.routes[route as ShippingRoute].rates.find(r => r.desi === desi);
        row[route] = routeRate?.rate || '';
      });
      return row;
    });

    // Add currency row
    const currencyRow: Record<string, string> = { desi: 'PARA BİRİMİ' };
    Object.entries(shippingRates.routes).forEach(([route, config]) => {
      currencyRow[route] = config.currency;
    });
    data.push(currencyRow);

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kargo Cetveli');
    XLSX.writeFile(wb, 'kargo_cetveli.xlsx');
  };

  const currentRouteRates = shippingRates.routes[selectedRoute]?.rates || [];
  const currentCurrency = shippingRates.routes[selectedRoute]?.currency || 'USD';
  const currencySymbol = CURRENCY_SYMBOLS[currentCurrency] || currentCurrency;

  // Check if rates are loaded
  const hasRates = Object.values(shippingRates.routes).some(r => r.rates.length > 0);

  return (
    <div className="space-y-6">
      {/* Upload section */}
      <div className="bg-slate-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          🚚 Kargo Cetveli
        </h3>

        <p className="text-sm text-slate-600 mb-4">
          Excel dosyanızda kolonlar: <code className="bg-slate-200 px-1 rounded">desi</code>,{' '}
          <code className="bg-slate-200 px-1 rounded">US-US</code>,{' '}
          <code className="bg-slate-200 px-1 rounded">US-TR</code>,{' '}
          <code className="bg-slate-200 px-1 rounded">UK</code>,{' '}
          <code className="bg-slate-200 px-1 rounded">EU</code> vb.
        </p>

        <div className="flex flex-wrap gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            📤 Excel Yükle
          </button>

          {hasRates && (
            <>
              <button
                onClick={exportToExcel}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                📥 Excel İndir
              </button>

              <button
                onClick={() => setEditMode(!editMode)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  editMode
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                }`}
              >
                ✏️ {editMode ? 'Düzenlemeyi Bitir' : 'Manuel Düzenle'}
              </button>

              <button
                onClick={() => {
                  if (window.confirm('Tüm kargo verilerini silmek istediğinize emin misiniz?')) {
                    onUpdate(createEmptyShippingRates());
                  }
                }}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" /> Sil
              </button>
            </>
          )}
        </div>

        {shippingRates.lastUpdated && (
          <p className="text-xs text-slate-500 mt-3">
            Son güncelleme: {new Date(shippingRates.lastUpdated).toLocaleString('tr-TR')}
          </p>
        )}
      </div>

      {/* Route cards grid */}
      {hasRates && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {(Object.keys(ROUTE_LABELS) as ShippingRoute[]).map((route) => {
              const routeInfo = ROUTE_LABELS[route];
              const routeRates = shippingRates.routes[route]?.rates || [];
              const routeCurrency = shippingRates.routes[route]?.currency || 'USD';
              const symbol = CURRENCY_SYMBOLS[routeCurrency] || routeCurrency;
              const hasData = routeRates.length > 0;
              const isSelected = selectedRoute === route;

              const minRate = hasData ? Math.min(...routeRates.map(r => r.rate)) : 0;
              const maxRate = hasData ? Math.max(...routeRates.map(r => r.rate)) : 0;
              const minDesi = hasData ? Math.min(...routeRates.map(r => r.desi)) : 0;
              const maxDesi = hasData ? Math.max(...routeRates.map(r => r.desi)) : 0;

              return (
                <button
                  key={route}
                  onClick={() => setSelectedRoute(route)}
                  className={`p-3 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                      : hasData
                      ? 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md'
                      : 'bg-slate-50 border border-dashed border-slate-200 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg">{routeInfo.flag}</span>
                    {hasData && !isSelected && (
                      <span className="text-xs text-green-500">✓</span>
                    )}
                  </div>
                  <div className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                    {routeInfo.label}
                  </div>
                  {hasData ? (
                    <div className={`text-xs mt-1 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                      <div>{symbol}{minRate.toFixed(0)}-{symbol}{maxRate.toFixed(0)}</div>
                      <div>{minDesi}-{maxDesi} desi</div>
                    </div>
                  ) : (
                    <div className={`text-xs mt-1 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                      Veri yok
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected route detail */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-blue-100/50 border-b border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{ROUTE_LABELS[selectedRoute].flag}</span>
                <span className="font-bold text-blue-900">{ROUTE_LABELS[selectedRoute].label}</span>
                <span className="px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full text-xs font-medium">
                  {currentCurrency}
                </span>
              </div>
              <span className="text-xs text-blue-600 font-medium">
                {currentRouteRates.length} bareme
              </span>
            </div>

            {currentRouteRates.length > 0 ? (
              <div className="p-4">
                {/* Grid rate display */}
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                  {currentRouteRates.map((rate, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-lg p-2 text-center shadow-sm border border-blue-100 hover:border-blue-300 transition-colors"
                    >
                      <div className="text-xs text-blue-600 font-medium mb-1">
                        {rate.desi} desi
                      </div>
                      {editMode ? (
                        <input
                          type="number"
                          step="0.01"
                          value={rate.rate}
                          onChange={(e) =>
                            handleRateChange(rate.desi, parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-1 py-0.5 border border-blue-300 rounded text-center text-sm font-bold"
                        />
                      ) : (
                        <div className="text-sm font-bold text-slate-800">
                          {currencySymbol}{rate.rate.toFixed(2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-blue-400 text-sm">
                Bu rota için veri yok
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasRates && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            Kargo Cetveli Yüklenmedi
          </h3>
          <p className="text-sm text-slate-500">
            Karlılık hesaplaması için kargo cetvelini yükleyin
          </p>
        </div>
      )}
    </div>
  );
};

export default React.memo(ShippingRatesTab);
