/**
 * Country Settings Tab - Ülke bazlı manuel ayarlar
 */

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AllCountryConfigs, CountryProfitConfig, GSTConfig } from '../../types/profitability';
import { MarketplaceCode } from '../../types/transaction';

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

const CountrySettingsTab: React.FC<CountrySettingsTabProps> = ({
  countryConfigs,
  onUpdate,
  availableCategories,
}) => {
  const [selectedCountry, setSelectedCountry] = useState<MarketplaceCode>('US');

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
    updateConfig({
      gst: {
        enabled: currentConfig.gst?.enabled ?? false,
        ratePercent: currentConfig.gst?.ratePercent ?? 0,
        includedInPrice: currentConfig.gst?.includedInPrice ?? true,
        ...currentConfig.gst,
        ...updates,
      },
    });
  };

  // GST uygulanabilir ülkeler (AU, potansiyel olarak CA)
  const showGSTSettings = selectedCountry === 'AU';

  return (
    <div className="space-y-6">
      {/* Country selector */}
      <div className="bg-slate-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          ⚙️ Ülke Bazlı Ayarlar
        </h3>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(MARKETPLACE_INFO) as MarketplaceCode[]).map((mp) => {
            const info = MARKETPLACE_INFO[mp];
            return (
              <button
                key={mp}
                onClick={() => setSelectedCountry(mp)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCountry === mp
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {info.flag} {info.label}
              </button>
            );
          })}
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

        {/* GST Settings (for AU) */}
        {showGSTSettings && (
          <div className="mt-6 bg-orange-50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-semibold text-orange-800">GST Ayarları</h5>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentConfig.gst?.enabled ?? false}
                  onChange={(e) => handleGSTChange({ enabled: e.target.checked })}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-orange-700">GST Hesapla</span>
              </label>
            </div>

            {currentConfig.gst?.enabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-orange-700 mb-1">
                    GST Oranı (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={currentConfig.gst?.ratePercent ?? 10}
                    onChange={(e) =>
                      handleGSTChange({ ratePercent: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <p className="text-xs text-orange-600 mt-1">
                    Avustralya GST oranı (varsayılan %10)
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
                    <span className="text-sm text-orange-700">GST fiyata dahil</span>
                  </label>
                  <p className="text-xs text-orange-600 mt-1 ml-6">
                    İşaretli: Fiyat GST dahil (örn: $110 fiyattan $10 GST çıkarılır)
                  </p>
                </div>

                <div className="bg-orange-100 rounded-lg p-3 text-xs text-orange-800">
                  <strong>Not:</strong> ABN+GST kayıtlı satıcılar için GST, Non-Amazon gider olarak hesaplanır.
                  Bu tutar ATO'ya ödenmesi gereken vergiyi temsil eder.
                </div>
              </div>
            )}

            {!currentConfig.gst?.enabled && (
              <p className="text-xs text-orange-600 italic">
                GST hesaplaması devre dışı. ABN+GST kaydınız varsa aktif edin.
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
              <span className="text-slate-500">GST:</span>
              <span className="ml-2 font-medium">%{currentConfig.gst.ratePercent}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(CountrySettingsTab);
