/**
 * Country Settings Tab - Ülke bazlı ayarlar görüntüleme (READ-ONLY)
 * Düzenleme için PriceLab kullanılmalı
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, Check, AlertTriangle, ExternalLink } from 'lucide-react';
import { AllCountryConfigs, GSTApplyTo } from '../../types/profitability';
import { MarketplaceCode } from '../../types/transaction';
import {
  fetchLiveRates,
  getCurrentRates,
  getExchangeRateStatus,
  type CurrencyCode,
  type ExchangeRateStatus,
  CURRENCY_SYMBOLS,
  CURRENCY_NAMES,
} from '../../utils/currencyExchange';

const PRICELAB_URL = 'http://78.47.117.36:3000'; // PriceLab frontend URL

interface CountrySettingsTabProps {
  countryConfigs: AllCountryConfigs;
  availableCategories: string[];  // Transaction'lardan gelen mevcut kategoriler
  isAdmin?: boolean;
}

const MARKETPLACE_INFO: Record<MarketplaceCode, { label: string; flag: string; currency: string }> = {
  US: { label: 'Amerika', flag: '🇺🇸', currency: 'USD' },
  UK: { label: 'İngiltere', flag: '🇬🇧', currency: 'GBP' },
  DE: { label: 'Almanya', flag: '🇩🇪', currency: 'EUR' },
  FR: { label: 'Fransa', flag: '🇫🇷', currency: 'EUR' },
  IT: { label: 'İtalya', flag: '🇮🇹', currency: 'EUR' },
  ES: { label: 'İspanya', flag: '🇪🇸', currency: 'EUR' },
  CA: { label: 'Kanada', flag: '🇨🇦', currency: 'CAD' },
  AU: { label: 'Avustralya', flag: '🇦🇺', currency: 'AUD' },
  AE: { label: 'BAE', flag: '🇦🇪', currency: 'AED' },
  SA: { label: 'Suudi Arabistan', flag: '🇸🇦', currency: 'SAR' },
};

// Settings view tabs
type SettingsView = 'country' | 'exchangeRates';

const CountrySettingsTab: React.FC<CountrySettingsTabProps> = ({
  countryConfigs,
  availableCategories,
  isAdmin = false,
}) => {
  const [selectedCountry, setSelectedCountry] = useState<MarketplaceCode>('US');
  const [settingsView, setSettingsView] = useState<SettingsView>('country');

  // Exchange rate states
  const [exchangeRateStatus, setExchangeRateStatus] = useState<ExchangeRateStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentRatesDisplay, setCurrentRatesDisplay] = useState<Record<string, number>>({});

  // Load exchange rate status on mount
  useEffect(() => {
    const status = getExchangeRateStatus();
    setExchangeRateStatus(status);

    // Get current USD rates for display
    const rates = getCurrentRates();
    if (rates.USD) {
      setCurrentRatesDisplay(rates.USD);
    }
  }, []);

  // Refresh exchange rates
  const handleRefreshRates = async () => {
    setIsRefreshing(true);
    try {
      const { status } = await fetchLiveRates();
      setExchangeRateStatus(status);
      const rates = getCurrentRates();
      if (rates.USD) {
        setCurrentRatesDisplay(rates.USD);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const currentConfig = countryConfigs.configs[selectedCountry];
  const countryInfo = MARKETPLACE_INFO[selectedCountry];

  // GST/VAT uygulanabilir ülkeler (AU, AE, SA)
  const showGSTSettings = selectedCountry === 'AU' || selectedCountry === 'AE' || selectedCountry === 'SA';

  // Ülkeye göre GST/VAT bilgileri
  const gstLabels: Record<string, { name: string; defaultRate: number; defaultApplyTo: GSTApplyTo; description: string; note: string }> = {
    AU: {
      name: 'GST',
      defaultRate: 10,
      defaultApplyTo: 'FBA',
      description: 'Avustralya GST oranı (varsayılan %10)',
      note: 'Bu ayar sadece FBA satışları için geçerlidir. FBM satışlarında GST, Amazon tarafından kesilip ATO\'ya ödenir (VAT gibi).',
    },
    AE: {
      name: 'VAT',
      defaultRate: 5,
      defaultApplyTo: 'BOTH',
      description: 'BAE VAT oranı (varsayılan %5)',
      note: 'BAE\'de Amazon VAT toplamıyor. Hem FBA hem FBM satışlarında seller-owed VAT hesaplanır.',
    },
    SA: {
      name: 'VAT',
      defaultRate: 15,
      defaultApplyTo: 'BOTH',
      description: 'Suudi Arabistan VAT oranı (varsayılan %15)',
      note: 'Yabancı satıcılar için ilk satıştan itibaren VAT kaydı zorunlu. Hem FBA hem FBM için seller-owed VAT hesaplanır.',
    },
  };

  const currentGstLabel = gstLabels[selectedCountry] || gstLabels.AU;

  // Currencies to display (marketplace currencies)
  const displayCurrencies: CurrencyCode[] = ['EUR', 'GBP', 'CAD', 'AUD', 'AED', 'SAR', 'TRY'];

  return (
    <div className="space-y-6">
      {/* Settings View Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setSettingsView('country')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            settingsView === 'country'
              ? 'bg-orange-100 text-orange-700 border-b-2 border-orange-500'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          🌍 Ülke Ayarları
        </button>
        <button
          onClick={() => setSettingsView('exchangeRates')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            settingsView === 'exchangeRates'
              ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-500'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          💱 Döviz Kurları
        </button>
      </div>

      {/* Exchange Rates View */}
      {settingsView === 'exchangeRates' && (
        <div className="space-y-6">
          {/* Status Banner */}
          <div className={`rounded-xl p-4 flex items-start gap-3 ${
            exchangeRateStatus?.error
              ? 'bg-gradient-to-r from-red-50 to-orange-50 border border-red-200'
              : exchangeRateStatus?.source === 'api'
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'
              : 'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200'
          }`}>
            {exchangeRateStatus?.error ? (
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            ) : exchangeRateStatus?.source === 'api' ? (
              <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className={`font-medium mb-1 ${
                exchangeRateStatus?.error ? 'text-red-800' :
                exchangeRateStatus?.source === 'api' ? 'text-green-800' : 'text-amber-800'
              }`}>
                {exchangeRateStatus?.source === 'api' && 'Canlı Kurlar Aktif (ECB/Frankfurter)'}
                {exchangeRateStatus?.source === 'cached' && 'Önbellek Kurları Kullanılıyor'}
                {exchangeRateStatus?.source === 'fallback' && 'Varsayılan Kurlar Kullanılıyor'}
                {!exchangeRateStatus && 'Kur Bilgisi Yükleniyor...'}
              </div>
              <div className={`text-sm ${
                exchangeRateStatus?.error ? 'text-red-700' :
                exchangeRateStatus?.source === 'api' ? 'text-green-700' : 'text-amber-700'
              }`}>
                {exchangeRateStatus?.lastUpdate && (
                  <span>Son güncelleme: {new Date(exchangeRateStatus.lastUpdate).toLocaleString('tr-TR')}</span>
                )}
                {exchangeRateStatus?.error && (
                  <span className="block mt-1">{exchangeRateStatus.error}</span>
                )}
              </div>
            </div>
            <button
              onClick={handleRefreshRates}
              disabled={isRefreshing}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                exchangeRateStatus?.error
                  ? 'bg-red-100 hover:bg-red-200 text-red-700'
                  : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
              } ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Güncelleniyor...' : 'Yenile'}
            </button>
          </div>

          {/* Exchange Rates Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-slate-800 mb-4">
              USD Bazlı Döviz Kurları
            </h4>
            <p className="text-sm text-slate-600 mb-4">
              Tüm kurlar <strong>1 USD = X</strong> formatında gösterilmektedir. "All Marketplaces" modunda diğer para birimleri bu kurlar üzerinden USD'ye çevrilir.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayCurrencies.map((currency) => {
                const rate = currentRatesDisplay[currency];
                const symbol = CURRENCY_SYMBOLS[currency];
                const name = CURRENCY_NAMES[currency];
                const isFixed = currency === 'AED' || currency === 'SAR'; // Pegged currencies

                return (
                  <div
                    key={currency}
                    className={`rounded-lg p-4 border ${
                      isFixed ? 'bg-slate-50 border-slate-200' : 'bg-purple-50 border-purple-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-slate-800">{currency}</span>
                        <span className="text-sm text-slate-500">{symbol}</span>
                      </div>
                      {isFixed && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">
                          USD'ye Sabit
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mb-2">{name}</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs text-slate-500">1 USD =</span>
                      <span className={`text-xl font-bold ${isFixed ? 'text-slate-700' : 'text-purple-700'}`}>
                        {rate?.toFixed(4) || '—'}
                      </span>
                      <span className="text-sm text-slate-600">{currency}</span>
                    </div>
                    {!isFixed && (
                      <div className="text-[10px] text-slate-400 mt-1">
                        1 {currency} = {rate ? (1 / rate).toFixed(4) : '—'} USD
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 bg-slate-100 rounded-lg p-4">
              <h5 className="font-medium text-slate-700 mb-2">ℹ️ Kur Kaynakları</h5>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• <strong>EUR, GBP, CAD, AUD, TRY:</strong> Frankfurter API (ECB verileri, günlük güncelleme)</li>
                <li>• <strong>AED:</strong> USD'ye sabitlenmiş (1 USD = 3.6725 AED)</li>
                <li>• <strong>SAR:</strong> USD'ye sabitlenmiş (1 USD = 3.75 SAR)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Country Settings View */}
      {settingsView === 'country' && (
        <>
          {/* Country selector */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-4">
              <h3 className="text-base font-semibold text-slate-800 whitespace-nowrap">
                Ülke Bazlı Ayarlar
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(MARKETPLACE_INFO) as MarketplaceCode[]).map((mp) => {
                  const info = MARKETPLACE_INFO[mp];
                  return (
                    <button
                      key={mp}
                      onClick={() => setSelectedCountry(mp)}
                      className={`px-2.5 py-1 text-sm rounded-md font-medium transition-colors ${
                        selectedCountry === mp
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {info.flag} {mp}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PriceLab redirect banner */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-600">
                  Bu ayarları görüntülüyorsunuz.{isAdmin ? ' Düzenlemeler için PriceLab kullanın.' : ''}
                </p>
              </div>
              {isAdmin && (
                <a
                  href={`${PRICELAB_URL}/settings`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  PriceLab'da Düzenle
                </a>
              )}
            </div>
          </div>

          {/* Settings for selected country - READ ONLY */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-xl font-bold text-slate-800">
                {countryInfo.flag} {countryInfo.label} ({countryInfo.currency})
              </h4>
              <span className="text-xs text-slate-500">
                Son güncelleme: {new Date(currentConfig.lastUpdated).toLocaleString('tr-TR')}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* FBA Settings - READ ONLY */}
              <div className="bg-blue-50 rounded-xl p-5">
                <h5 className="font-semibold text-blue-800 mb-4">FBA Ayarları</h5>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-blue-100">
                    <span className="text-sm text-blue-700">Depoya Gönderim</span>
                    <span className="font-semibold text-blue-900">${currentConfig.fba.shippingPerDesi}/desi</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-blue-700">Depo-İdare</span>
                    <span className="font-semibold text-blue-900">%{currentConfig.fba.warehousePercent}</span>
                  </div>
                </div>
              </div>

              {/* FBM Settings - READ ONLY */}
              <div className="bg-green-50 rounded-xl p-5">
                <h5 className="font-semibold text-green-800 mb-4">FBM Ayarları (TR'den)</h5>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-green-100">
                    <span className="text-sm text-green-700">Gümrük Vergisi</span>
                    <span className="font-semibold text-green-900">%{currentConfig.fbm.fromTR.customsDutyPercent}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-green-700">DDP Ücreti</span>
                    <span className="font-semibold text-green-900">${currentConfig.fbm.fromTR.ddpFee}</span>
                  </div>
                  {(currentConfig.fbm.fromTR.categoryDuties || []).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <span className="text-xs text-green-600 font-medium">Kategori Bazlı Gümrük:</span>
                      <div className="mt-2 space-y-1">
                        {(currentConfig.fbm.fromTR.categoryDuties || []).map((cd, idx) => (
                          <div key={idx} className="flex justify-between text-xs bg-green-100 rounded px-2 py-1">
                            <span className="text-green-700">{cd.category}</span>
                            <span className="font-medium text-green-800">%{cd.dutyPercent}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* FBM-US Settings - Only for US marketplace */}
            {selectedCountry === 'US' && (
              <div className="mt-6 bg-purple-50 rounded-xl p-5">
                <h5 className="font-semibold text-purple-800 mb-4">FBM Ayarları (US Depodan)</h5>
                <p className="text-xs text-purple-600 mb-4">
                  US deposundan FBM gönderimlerinde FBA ile aynı depoya gönderim ve depo yönetim maliyeti uygulanır.
                  Ancak FBA Fee ve FBA Cost uygulanmaz, bunun yerine US içi kargo (US-US) bedeli eklenir. Gümrük vergisi ve DDP yoktur.
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-purple-100 rounded-lg p-3">
                    <span className="text-xs text-purple-600">Depoya Gönderim</span>
                    <p className="font-bold text-purple-900 text-lg">${currentConfig.fba.shippingPerDesi}/desi</p>
                    <span className="text-[10px] text-purple-500">FBA ile aynı</span>
                  </div>
                  <div className="bg-purple-100 rounded-lg p-3">
                    <span className="text-xs text-purple-600">Depo Yönetim</span>
                    <p className="font-bold text-purple-900 text-lg">%{currentConfig.fba.warehousePercent}</p>
                    <span className="text-[10px] text-purple-500">FBA ile aynı</span>
                  </div>
                  <div className="bg-purple-100 rounded-lg p-3">
                    <span className="text-xs text-purple-600">US İçi Kargo</span>
                    <p className="font-bold text-purple-900 text-lg">US-US</p>
                    <span className="text-[10px] text-purple-500">Kargo cetvelinden</span>
                  </div>
                </div>
              </div>
            )}

            {/* GST/VAT Settings - READ ONLY */}
            {showGSTSettings && currentConfig.gst?.enabled && (
              <div className="mt-6 bg-orange-50 rounded-xl p-5">
                <h5 className="font-semibold text-orange-800 mb-4">{currentGstLabel.name} Ayarları</h5>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <span className="text-xs text-orange-600">Oran</span>
                    <p className="font-bold text-orange-900">%{currentConfig.gst?.ratePercent || 0}</p>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-orange-600">Uygulama</span>
                    <p className="font-bold text-orange-900">{currentConfig.gst?.applyTo || 'FBA'}</p>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-orange-600">Fiyata Dahil</span>
                    <p className="font-bold text-orange-900">{currentConfig.gst?.includedInPrice ? 'Evet' : 'Hayır'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(CountrySettingsTab);
