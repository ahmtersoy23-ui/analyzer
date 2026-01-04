/**
 * Shipping Rates Tab - Kargo cetveli görüntüleme (READ-ONLY)
 * Düzenleme için PriceLab kullanılmalı
 */

import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { ShippingRateTable, ShippingRoute } from '../../types/profitability';

interface ShippingRatesTabProps {
  shippingRates: ShippingRateTable;
  isAdmin?: boolean;
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

const PRICELAB_URL = 'http://78.47.117.36:3000'; // PriceLab frontend URL

const ShippingRatesTab: React.FC<ShippingRatesTabProps> = ({
  shippingRates,
  isAdmin = false,
}) => {
  const [selectedRoute, setSelectedRoute] = useState<ShippingRoute>('US-TR');

  const currentRouteRates = shippingRates.routes[selectedRoute]?.rates || [];
  const currentCurrency = shippingRates.routes[selectedRoute]?.currency || 'USD';
  const currencySymbol = CURRENCY_SYMBOLS[currentCurrency] || currentCurrency;

  // Check if rates are loaded
  const hasRates = Object.values(shippingRates.routes).some(r => r.rates.length > 0);

  return (
    <div className="space-y-6">
      {/* PriceLab redirect banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-indigo-800 mb-2">
              🚚 Kargo Cetveli
            </h3>
            <p className="text-sm text-indigo-600 mb-4">
              Kargo tarifelerini görüntülüyorsunuz.{isAdmin ? ' Tarife düzenlemeleri için PriceLab kullanın.' : ''}
            </p>
            {isAdmin && (
              <a
                href={`${PRICELAB_URL}/shipping`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                PriceLab'da Düzenle
              </a>
            )}
          </div>
          {shippingRates.lastUpdated && (
            <div className="text-right">
              <span className="text-xs text-indigo-500">Son güncelleme</span>
              <p className="text-sm font-medium text-indigo-700">
                {new Date(shippingRates.lastUpdated).toLocaleString('tr-TR')}
              </p>
            </div>
          )}
        </div>
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
                      className="bg-white rounded-lg p-2 text-center shadow-sm border border-blue-100"
                    >
                      <div className="text-xs text-blue-600 font-medium mb-1">
                        {rate.desi} desi
                      </div>
                      <div className="text-sm font-bold text-slate-800">
                        {currencySymbol}{rate.rate.toFixed(2)}
                      </div>
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
            Kargo Cetveli Tanımlı Değil
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Karlılık hesaplaması için PriceLab'dan kargo tarifelerini yükleyin.
          </p>
          <a
            href={`${PRICELAB_URL}/shipping`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            PriceLab'a Git
          </a>
        </div>
      )}
    </div>
  );
};

export default React.memo(ShippingRatesTab);
