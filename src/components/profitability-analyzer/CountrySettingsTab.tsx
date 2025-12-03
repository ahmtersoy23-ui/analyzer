/**
 * Country Settings Tab - Ülke bazlı manuel ayarlar
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { AllCountryConfigs, CountryProfitConfig, GSTConfig, GSTApplyTo } from '../../types/profitability';
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

interface CountrySettingsTabProps {
  countryConfigs: AllCountryConfigs;
  onUpdate: (configs: AllCountryConfigs) => void;
  availableCategories: string[];  // Transaction'lardan gelen mevcut kategoriler
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
  onUpdate,
  availableCategories,
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

  const updateConfig = (updates: Partial<CountryProfitConfig>) => {
    const newConfigs = {
      ...countryConfigs,
      configs: {
        ...countryConfigs.configs,
        [selectedCountry]: {
          ...currentConfig,
          ...updates,
          lastUpdated: new Date().toISOString(),
        },
      },
      lastUpdated: new Date().toISOString(),
    };
    onUpdate(newConfigs);
  };

  const handleFBAChange = (field: string, value: number) => {
    updateConfig({
      fba: {
        ...currentConfig.fba,
        [field]: value,
      },
    });
  };

  const handleFBMFromTRChange = (field: string, value: number) => {
    updateConfig({
      fbm: {
        ...currentConfig.fbm,
        fromTR: {
          ...currentConfig.fbm.fromTR,
          [field]: value,
        },
      },
    });
  };

  const handleFBMFromLocalChange = (field: string, value: number) => {
    updateConfig({
      fbm: {
        ...currentConfig.fbm,
        fromLocal: {
          warehousePercent: currentConfig.fbm.fromLocal?.warehousePercent || 0,
          ...currentConfig.fbm.fromLocal,
          [field]: value,
        },
      },
    });
  };

  const handleGSTChange = (updates: Partial<GSTConfig>) => {
    // Ülkeye özel default applyTo değerini al
    const defaultApplyTo = gstLabels[selectedCountry]?.defaultApplyTo ?? 'FBA';
    updateConfig({
      gst: {
        enabled: currentConfig.gst?.enabled ?? false,
        ratePercent: currentConfig.gst?.ratePercent ?? 0,
        includedInPrice: currentConfig.gst?.includedInPrice ?? true,
        applyTo: currentConfig.gst?.applyTo ?? defaultApplyTo,
        ...currentConfig.gst,
        ...updates,
      },
    });
  };

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

          {/* Settings for selected country */}
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
          {/* FBA Settings */}
          <div className="bg-blue-50 rounded-xl p-5">
            <h5 className="font-semibold text-blue-800 mb-4">FBA Ayarları</h5>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1">
                  Depoya Gönderim ($/desi)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={currentConfig.fba.shippingPerDesi}
                  onChange={(e) =>
                    handleFBAChange('shippingPerDesi', parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-blue-600 mt-1">
                  Gemi ile depoya gönderim bedeli (desi başına)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1">
                  Depo-İdare (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={currentConfig.fba.warehousePercent}
                  onChange={(e) =>
                    handleFBAChange('warehousePercent', parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-blue-600 mt-1">
                  Satış fiyatının yüzdesi olarak depo/idare gideri
                </p>
              </div>
            </div>
          </div>

          {/* FBM Settings */}
          <div className="bg-green-50 rounded-xl p-5">
            <h5 className="font-semibold text-green-800 mb-4">FBM Ayarları</h5>

            {/* TR settings (always shown) */}
            <div className="space-y-4">
              <h6 className="text-sm font-medium text-green-700 border-b border-green-200 pb-1">
                TR'den Gönderim
              </h6>

              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  Varsayılan Gümrük Vergisi (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={currentConfig.fbm.fromTR.customsDutyPercent}
                  onChange={(e) =>
                    handleFBMFromTRChange('customsDutyPercent', parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-green-600 mt-1">
                  Kategori tanımlı olmayan ürünler için
                </p>
              </div>

              {/* Category-based customs duties */}
              <div className="mt-3 pt-3 border-t border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-green-700">
                    Kategori Bazlı Gümrük
                  </label>
                  <button
                    onClick={() => {
                      const categoryDuties = currentConfig.fbm.fromTR.categoryDuties || [];
                      updateConfig({
                        fbm: {
                          ...currentConfig.fbm,
                          fromTR: {
                            ...currentConfig.fbm.fromTR,
                            categoryDuties: [...categoryDuties, { category: '', dutyPercent: 8.5 }],
                          },
                        },
                      });
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Ekle
                  </button>
                </div>

                {(currentConfig.fbm.fromTR.categoryDuties || []).length > 0 ? (
                  <div className="space-y-2">
                    {(currentConfig.fbm.fromTR.categoryDuties || []).map((cd, idx) => {
                      // Zaten seçilmiş kategorileri filtrele (mevcut hariç)
                      const usedCategories = (currentConfig.fbm.fromTR.categoryDuties || [])
                        .filter((_, i) => i !== idx)
                        .map(d => d.category);
                      const availableForSelect = availableCategories.filter(
                        cat => !usedCategories.includes(cat)
                      );

                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={cd.category}
                            onChange={(e) => {
                              const categoryDuties = [...(currentConfig.fbm.fromTR.categoryDuties || [])];
                              categoryDuties[idx] = { ...categoryDuties[idx], category: e.target.value };
                              updateConfig({
                                fbm: {
                                  ...currentConfig.fbm,
                                  fromTR: {
                                    ...currentConfig.fbm.fromTR,
                                    categoryDuties,
                                  },
                                },
                              });
                            }}
                            className="flex-1 px-2 py-1 text-sm border border-green-200 rounded focus:ring-1 focus:ring-green-500 bg-white"
                          >
                            <option value="">Kategori seçin...</option>
                            {availableForSelect.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                            {/* Eğer mevcut değer listede yoksa (eski veri) onu da göster */}
                            {cd.category && !availableCategories.includes(cd.category) && (
                              <option value={cd.category}>{cd.category} (eski)</option>
                            )}
                            {/* Mevcut seçili değeri her zaman göster */}
                            {cd.category && availableCategories.includes(cd.category) && usedCategories.includes(cd.category) === false && (
                              <option value={cd.category}>{cd.category}</option>
                            )}
                          </select>
                          <input
                            type="number"
                            step="0.1"
                            value={cd.dutyPercent}
                            onChange={(e) => {
                              const categoryDuties = [...(currentConfig.fbm.fromTR.categoryDuties || [])];
                              categoryDuties[idx] = { ...categoryDuties[idx], dutyPercent: parseFloat(e.target.value) || 0 };
                              updateConfig({
                                fbm: {
                                  ...currentConfig.fbm,
                                  fromTR: {
                                    ...currentConfig.fbm.fromTR,
                                    categoryDuties,
                                  },
                                },
                              });
                            }}
                            className="w-16 px-2 py-1 text-sm border border-green-200 rounded text-right focus:ring-1 focus:ring-green-500"
                          />
                          <span className="text-xs text-green-600">%</span>
                          <button
                            onClick={() => {
                              const categoryDuties = (currentConfig.fbm.fromTR.categoryDuties || []).filter((_, i) => i !== idx);
                              updateConfig({
                                fbm: {
                                  ...currentConfig.fbm,
                                  fromTR: {
                                    ...currentConfig.fbm.fromTR,
                                    categoryDuties,
                                  },
                                },
                              });
                            }}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-green-500 italic">
                    Tüm ürünler varsayılan oranı kullanır
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  DDP Ücreti ($)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={currentConfig.fbm.fromTR.ddpFee}
                  onChange={(e) =>
                    handleFBMFromTRChange('ddpFee', parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            {/* Local warehouse settings (for all countries) */}
            <div className="space-y-4 mt-4 pt-4 border-t border-green-200">
              <h6 className="text-sm font-medium text-green-700 border-b border-green-200 pb-1">
                Yerel Depo Gönderimi
              </h6>

              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  Depo Maliyeti (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={currentConfig.fbm.fromLocal?.warehousePercent || 0}
                  onChange={(e) =>
                    handleFBMFromLocalChange('warehousePercent', parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-green-600 mt-1">
                  Yerel depodan gönderimde depo/işçilik maliyeti (varsayılan: 0)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* GST/VAT Settings (for AU, AE, SA) */}
        {showGSTSettings && (
          <div className="mt-6 bg-orange-50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-semibold text-orange-800">{currentGstLabel.name} Ayarları</h5>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentConfig.gst?.enabled ?? false}
                  onChange={(e) => handleGSTChange({ enabled: e.target.checked })}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-orange-700">{currentGstLabel.name} Hesapla</span>
              </label>
            </div>

            {currentConfig.gst?.enabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-orange-700 mb-1">
                    {currentGstLabel.name} Oranı (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={currentConfig.gst?.ratePercent ?? currentGstLabel.defaultRate}
                    onChange={(e) =>
                      handleGSTChange({ ratePercent: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <p className="text-xs text-orange-600 mt-1">
                    {currentGstLabel.description}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-orange-700 mb-1">
                    Uygulanacak Satış Türü
                  </label>
                  <div className="flex gap-2">
                    {(['FBA', 'FBM', 'BOTH'] as GSTApplyTo[]).map((option) => (
                      <button
                        key={option}
                        onClick={() => handleGSTChange({ applyTo: option })}
                        className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                          (currentConfig.gst?.applyTo ?? currentGstLabel.defaultApplyTo) === option
                            ? 'bg-orange-600 text-white'
                            : 'bg-white border border-orange-200 text-orange-700 hover:bg-orange-50'
                        }`}
                      >
                        {option === 'BOTH' ? 'Her İkisi' : option}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-orange-600 mt-1">
                    {currentGstLabel.name} hangi satış türlerine uygulanacak
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentConfig.gst?.includedInPrice ?? true}
                      onChange={(e) => handleGSTChange({ includedInPrice: e.target.checked })}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-orange-700">{currentGstLabel.name} fiyata dahil</span>
                  </label>
                  <p className="text-xs text-orange-600 mt-1 ml-6">
                    İşaretli: Fiyat {currentGstLabel.name} dahil (örn: fiyattan {currentGstLabel.name} çıkarılır)
                  </p>
                </div>

                <div className="bg-orange-100 rounded-lg p-3 text-xs text-orange-800">
                  <strong>Not:</strong> {currentGstLabel.note}
                </div>
              </div>
            )}

            {!currentConfig.gst?.enabled && (
              <p className="text-xs text-orange-600 italic">
                {currentGstLabel.name} hesaplaması devre dışı. {selectedCountry === 'AU' ? 'FBA satışlarınız için ABN+GST kaydınız varsa aktif edin.' : `${currentGstLabel.name} kaydınız varsa aktif edin.`}
              </p>
            )}
          </div>
        )}
      </div>

          {/* Quick summary */}
          <div className="bg-slate-100 rounded-xl p-4">
            <h5 className="font-semibold text-slate-700 mb-3">Özet - {countryInfo.flag} {countryInfo.label}</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-500">FBA Kargo:</span>
                <span className="ml-2 font-medium">${currentConfig.fba.shippingPerDesi}/desi</span>
              </div>
              <div>
                <span className="text-slate-500">FBA Depo:</span>
                <span className="ml-2 font-medium">%{currentConfig.fba.warehousePercent}</span>
              </div>
              <div>
                <span className="text-slate-500">FBM Gümrük:</span>
                <span className="ml-2 font-medium">%{currentConfig.fbm.fromTR.customsDutyPercent}</span>
              </div>
              <div>
                <span className="text-slate-500">FBM DDP:</span>
                <span className="ml-2 font-medium">${currentConfig.fbm.fromTR.ddpFee}</span>
              </div>
              {showGSTSettings && currentConfig.gst?.enabled && (
                <div>
                  <span className="text-slate-500">{currentGstLabel.name}:</span>
                  <span className="ml-2 font-medium">%{currentConfig.gst.ratePercent}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(CountrySettingsTab);
