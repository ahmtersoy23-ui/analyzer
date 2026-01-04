/**
 * Cost Upload Tab - Maliyet dosyası yükleme ve eşleştirme
 */

import React, { useRef, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { ProductCostData, CostDataSummary, FBMSourceOverride } from '../../types/profitability';

// NAME bazlı Override - bir NAME altındaki tüm FBM SKU'lara uygulanır
export interface NameOverride {
  name: string;
  customShipping: number | null;
  fbmSource: FBMSourceOverride;
  fbmSkuCount: number;  // Bu NAME altında kaç FBM SKU var
}

// FBM NAME bilgisi (hangi NAME'lerin FBM SKU'ları olduğunu belirtir)
export interface FBMNameInfo {
  name: string;
  skus: string[];           // Bu NAME altındaki tüm SKU'lar
  fbmSkus: string[];        // Sadece FBM/Mixed olan SKU'lar
  fulfillmentBreakdown: {
    fba: number;
    fbm: number;
    mixed: number;
  };
}

interface CostUploadTabProps {
  costData: ProductCostData[];
  costSummary: CostDataSummary | null;
  onFileUpload: (data: Record<string, any>[]) => void;
  nameOverrides: NameOverride[];
  onOverridesChange: (overrides: NameOverride[]) => void;
  fbmNameInfo: FBMNameInfo[];  // FBM SKU'ları olan NAME listesi
  // NEW: Callback to update costData directly with SKU-level overrides
  onSkuOverrideUpdate: (updates: { sku: string; name: string; customShipping: number | null; fbmSource: 'TR' | 'US' | 'BOTH' | null }[]) => void;
}

// Group cost data by NAME for display
interface NameGroupedData {
  name: string;
  category: string;
  skuCount: number;
  cost: number | null;
  size: number | null;
  customShipping: number | null;
  fbmSource: 'TR' | 'US' | 'BOTH' | null;
  skus: string[];
}

const CostUploadTab: React.FC<CostUploadTabProps> = ({
  costData,
  costSummary,
  onFileUpload,
  nameOverrides,
  onOverridesChange,
  fbmNameInfo,
  onSkuOverrideUpdate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showOverrideEditor, setShowOverrideEditor] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Manuel NAME ekleme state'leri (NAME bazlı override sistemi)
  const [manualNameInput, setManualNameInput] = useState('');
  const [manualCustomShipping, setManualCustomShipping] = useState<string>('');
  const [manualFbmSource, setManualFbmSource] = useState<FBMSourceOverride | ''>('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!validExtensions.includes(fileExt)) {
      alert(`Geçersiz dosya formatı: ${fileExt}\n\nDesteklenen formatlar: Excel (.xlsx, .xls) veya CSV (.csv)`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        // Validate data structure - must have SKU column
        if (jsonData.length === 0) {
          alert('Dosya boş veya okunamadı.');
          return;
        }

        const firstRow = jsonData[0] as Record<string, any>;
        const hasSkuColumn = Object.keys(firstRow).some(
          key => key.toLowerCase().includes('sku') || key.toLowerCase() === 'seller-sku' || key.toLowerCase() === 'seller sku'
        );

        if (!hasSkuColumn) {
          const columns = Object.keys(firstRow).slice(0, 5).join(', ');
          alert(`Geçersiz dosya formatı!\n\nBu dosyada SKU sütunu bulunamadı.\nBulunan sütunlar: ${columns}...\n\nDoğru maliyet dosyası yüklediğinizden emin olun.`);
          return;
        }

        onFileUpload(jsonData as Record<string, any>[]);
      } catch (error) {
        console.error('File parse error:', error);
        alert(`Dosya işlenirken hata oluştu:\n${error instanceof Error ? error.message : 'Bilinmeyen hata'}\n\nDoğru formatta bir Excel dosyası yüklediğinizden emin olun.`);
      }
    };

    reader.onerror = () => {
      console.error('File read error:', reader.error);
      alert('Dosya okunamadı. Lütfen tekrar deneyin.');
    };

    reader.readAsArrayBuffer(file);
  };

  // Group data by NAME
  const nameGroupedData = useMemo((): NameGroupedData[] => {
    const grouped = new Map<string, NameGroupedData>();

    costData.forEach(item => {
      const name = item.name || 'Unknown';
      if (!grouped.has(name)) {
        grouped.set(name, {
          name,
          category: item.category || '',
          skuCount: 0,
          cost: item.cost,
          size: item.size,
          customShipping: item.customShipping ?? null,
          fbmSource: item.fbmSource ?? null,
          skus: []
        });
      }
      const group = grouped.get(name)!;
      group.skuCount++;
      group.skus.push(item.sku);
      // Use the first non-null values
      if (group.cost === null && item.cost !== null) group.cost = item.cost;
      if (group.size === null && item.size !== null) group.size = item.size;
      if (group.customShipping === null && item.customShipping) group.customShipping = item.customShipping;
      if (group.fbmSource === null && item.fbmSource) group.fbmSource = item.fbmSource;
    });

    return Array.from(grouped.values()).sort((a, b) => b.skuCount - a.skuCount);
  }, [costData]);

  // Count items with cost and size data (by NAME)
  const withCost = nameGroupedData.filter(item => item.cost !== null).length;
  const withSize = nameGroupedData.filter(item => item.size !== null).length;
  const completeData = nameGroupedData.filter(item => item.cost !== null && item.size !== null).length;
  const totalNames = nameGroupedData.length;

  // Create override lookup by NAME
  const overrideMap = useMemo(() => {
    const map = new Map<string, NameOverride>();
    nameOverrides.forEach(o => map.set(o.name, o));
    return map;
  }, [nameOverrides]);

  // Filtered NAMEs for override editor - sadece FBM SKU'ları olan NAME'ler
  const filteredNamesForOverride = useMemo(() => {
    // Sadece FBM SKU'ları olan NAME'leri göster
    let filtered = fbmNameInfo.filter(info => info.fbmSkus.length > 0);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(info =>
        info.name.toLowerCase().includes(term) ||
        info.fbmSkus.some(sku => sku.toLowerCase().includes(term))
      );
    }

    return filtered.slice(0, 50);
  }, [fbmNameInfo, searchTerm]);

  // Handle override change for a NAME (applies to all FBM SKUs under it)
  const handleOverrideChange = (
    name: string,
    fbmSkuCount: number,
    field: 'customShipping' | 'fbmSource',
    value: number | null | FBMSourceOverride
  ) => {
    const existing = overrideMap.get(name);
    const newOverride: NameOverride = existing
      ? { ...existing, [field]: value }
      : { name, customShipping: null, fbmSource: null, fbmSkuCount, [field]: value };

    // Remove if both values are null/empty
    if (newOverride.customShipping === null && newOverride.fbmSource === null) {
      onOverridesChange(nameOverrides.filter(o => o.name !== name));
    } else {
      const newOverrides = nameOverrides.filter(o => o.name !== name);
      newOverrides.push(newOverride);
      onOverridesChange(newOverrides);
    }

    // NEW: Also update costData with SKU-level entries for this NAME
    // Find all SKUs for this NAME from fbmNameInfo
    const nameInfo = fbmNameInfo.find(info => info.name === name);
    if (nameInfo && nameInfo.skus.length > 0) {
      const skuUpdates = nameInfo.skus.map(sku => ({
        sku,
        name,
        customShipping: newOverride.customShipping,
        fbmSource: newOverride.fbmSource,
      }));
      onSkuOverrideUpdate(skuUpdates);
    }
  };

  // Count overrides
  const overrideCount = nameOverrides.length;
  const customShippingCount = nameOverrides.filter(o => o.customShipping !== null).length;
  const fbmSourceCount = nameOverrides.filter(o => o.fbmSource !== null).length;
  const totalAffectedSkus = nameOverrides.reduce((sum, o) => sum + o.fbmSkuCount, 0);

  // Manuel NAME ekleme fonksiyonu (NAME bazlı override sistemi)
  const handleManualNameAdd = () => {
    if (!manualNameInput.trim()) return;

    // NAME'leri satır sonu ile ayır (virgül ürün adının parçası olabilir)
    const names = manualNameInput
      .split(/\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (names.length === 0) return;

    const customShipping = manualCustomShipping ? parseFloat(manualCustomShipping) : null;
    const fbmSource = manualFbmSource || null;

    // En az bir değer girilmiş olmalı
    if (customShipping === null && fbmSource === null) {
      alert('Lütfen en az bir değer girin (Custom Shipping veya FBM Source)');
      return;
    }

    // Her NAME için yeni override oluştur
    const newOverrides = [...nameOverrides];

    names.forEach(name => {
      // Mevcut override varsa güncelle
      const existingIdx = newOverrides.findIndex(o => o.name === name);

      // Bu NAME'in FBM SKU sayısını bul (varsa)
      const nameInfo = fbmNameInfo.find(info => info.name === name);
      const fbmSkuCount = nameInfo?.fbmSkus.length ?? 1;

      if (existingIdx >= 0) {
        newOverrides[existingIdx] = {
          ...newOverrides[existingIdx],
          customShipping: customShipping !== null ? customShipping : newOverrides[existingIdx].customShipping,
          fbmSource: fbmSource !== null ? fbmSource : newOverrides[existingIdx].fbmSource,
        };
      } else {
        // Yeni override ekle
        newOverrides.push({
          name,
          customShipping,
          fbmSource,
          fbmSkuCount,
        });
      }

      // costData'yı da güncelle - bu NAME altındaki tüm SKU'lar için
      if (nameInfo && nameInfo.skus.length > 0) {
        const skuUpdates = nameInfo.skus.map(sku => ({
          sku,
          name,
          customShipping,
          fbmSource,
        }));
        onSkuOverrideUpdate(skuUpdates);
      }
    });

    onOverridesChange(newOverrides);

    // Form'u temizle
    setManualNameInput('');
    setManualCustomShipping('');
    setManualFbmSource('');
  };

  return (
    <div className="space-y-6 pt-4">
      {/* Auto-loaded data info */}
      {costData.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-green-800">
              Cost & Size Data (from Google Sheets)
            </h3>
            <span className="text-xs text-green-600">
              {costData.length} SKUs / {totalNames} Products
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3">
              <div className="text-xl font-bold text-green-700">{totalNames}</div>
              <div className="text-xs text-green-600">Products (NAME)</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-xl font-bold text-green-700">{withCost}</div>
              <div className="text-xs text-green-600">With Cost</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-xl font-bold text-green-700">{withSize}</div>
              <div className="text-xs text-green-600">With Size (Desi)</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-xl font-bold text-green-700">{completeData}</div>
              <div className="text-xs text-green-600">Complete Data</div>
            </div>
          </div>

          {/* Coverage percentage */}
          <div className="mt-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-green-700">Coverage Rate</span>
              <span className="font-semibold text-green-800">
                {totalNames > 0 ? ((completeData / totalNames) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="w-full h-2 bg-green-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${totalNames > 0 ? (completeData / totalNames) * 100 : 0}%` }}
              />
            </div>
          </div>

        </div>
      )}

      {/* Override upload section */}
      <div className="bg-slate-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          📄 Manuel Dosya Yükle (Opsiyonel)
        </h3>

        <div className="text-sm text-slate-600 mb-4">
          <p className="mb-2">You can upload a different cost file if needed.</p>
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="font-medium text-slate-700 mb-2">Supported Columns:</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><code className="bg-slate-100 px-1 rounded">sku</code> - SKU code (required)</div>
              <div><code className="bg-slate-100 px-1 rounded">cost</code> - Unit cost</div>
              <div><code className="bg-slate-100 px-1 rounded">size</code> / <code className="bg-slate-100 px-1 rounded">desi</code> - Desi value</div>
              <div><code className="bg-slate-100 px-1 rounded">customShipping</code> - Custom shipping rate (optional)</div>
              <div><code className="bg-slate-100 px-1 rounded">fbmSource</code> - FBM source: TR/US/BOTH (optional)</div>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              💡 <strong>customShipping:</strong> Bypasses desi table, uses fixed shipping rate<br/>
              💡 <strong>fbmSource:</strong> Per-SKU FBM shipping source (for US marketplace)
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
        >
          Upload Different File
        </button>
      </div>

      {/* FBM Override Editor - NAME bazlı manuel giriş */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-purple-800">
              🎯 FBM Özel Ayarları
            </h3>
            <p className="text-xs text-purple-600 mt-1">
              Manuel SKU ekleyin veya mevcut FBM ürünlerinin ayarlarını düzenleyin
            </p>
          </div>
          <div className="flex items-center gap-3">
            {overrideCount > 0 && (
              <span className="text-xs text-purple-600">
                {overrideCount} ürün ({totalAffectedSkus} SKU) • {customShippingCount} özel kargo • {fbmSourceCount} FBM kaynak
              </span>
            )}
            <button
              onClick={() => setShowOverrideEditor(!showOverrideEditor)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showOverrideEditor
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              {showOverrideEditor ? 'Kapat' : `Düzenle ${overrideCount > 0 ? `(${overrideCount})` : ''}`}
            </button>
          </div>
        </div>

        {showOverrideEditor && (
            <div className="mt-4">
              {/* Manuel Ürün (NAME) Ekleme */}
              <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h4 className="text-sm font-semibold text-orange-800 mb-3">
                  ➕ Manuel Ürün Ekle (NAME)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs text-orange-700 mb-1">Ürün Adı (NAME)</label>
                    <textarea
                      value={manualNameInput}
                      onChange={(e) => setManualNameInput(e.target.value)}
                      placeholder="Ürün adı girin (her satıra bir ürün)"
                      className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-orange-700 mb-1">Custom Ship ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={manualCustomShipping}
                      onChange={(e) => setManualCustomShipping(e.target.value)}
                      placeholder="Örn: 12.50"
                      className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-orange-700 mb-1">FBM Source</label>
                    <div className="flex gap-2">
                      <select
                        value={manualFbmSource || ''}
                        onChange={(e) => setManualFbmSource(e.target.value as FBMSourceOverride | '')}
                        className="flex-1 px-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      >
                        <option value="">Seçin</option>
                        <option value="TR">TR</option>
                        <option value="US">US</option>
                        <option value="BOTH">BOTH</option>
                      </select>
                      <button
                        onClick={handleManualNameAdd}
                        disabled={!manualNameInput.trim()}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Ekle
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-orange-600 mt-2">
                  💡 Birden fazla ürünü yeni satırla ayırarak toplu ekleyebilirsiniz. Girilen NAME'e ait tüm FBM SKU'lara uygulanır.
                </p>
              </div>

              {/* Mevcut FBM Ürünleri - sadece varsa göster */}
              {fbmNameInfo.length > 0 && (
                <>
                  {/* Info */}
                  <div className="mb-4 p-3 bg-purple-100/50 rounded-lg text-xs text-purple-700">
                    <strong>Mevcut FBM Ürünleri:</strong> Aşağıda satış verilerinden tespit edilen FBM/Mixed ürünler listelenir.
                  </div>

                  {/* Search */}
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Ürün adı veya SKU ara..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                </>
              )}

              {/* Override Table - NAME based - sadece FBM ürün varsa göster */}
              {fbmNameInfo.length > 0 && (
                <div className="bg-white rounded-lg border border-purple-200 overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-purple-100 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-purple-800">Ürün Adı (NAME)</th>
                          <th className="text-center px-3 py-2 font-medium text-purple-800" title="FBM/Mixed SKU sayısı">
                            FBM SKUs
                          </th>
                          <th className="text-center px-3 py-2 font-medium text-purple-800" title="Fulfillment dağılımı">
                            FBA/FBM
                          </th>
                          <th className="text-center px-3 py-2 font-medium text-purple-800" title="Özel kargo ücreti (desi cetvelini bypass eder)">
                            Custom Ship ($)
                          </th>
                          <th className="text-center px-3 py-2 font-medium text-purple-800" title="FBM gönderim kaynağı">
                            FBM Source
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredNamesForOverride.map((info, idx) => {
                          const override = overrideMap.get(info.name);
                          const { fba, fbm, mixed } = info.fulfillmentBreakdown;
                          return (
                            <tr key={info.name} className={`border-b border-purple-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-purple-50/30'}`}>
                              <td className="px-3 py-2 text-slate-700">
                                <div className="font-medium truncate max-w-[280px]" title={info.name}>
                                  {info.name}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {info.fbmSkus.slice(0, 3).join(', ')}
                                  {info.fbmSkus.length > 3 && ` +${info.fbmSkus.length - 3}`}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                  {info.fbmSkus.length}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center text-xs">
                                <div className="flex items-center justify-center gap-1">
                                  {fba > 0 && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">{fba} FBA</span>}
                                  {fbm > 0 && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">{fbm} FBM</span>}
                                  {mixed > 0 && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{mixed} Mix</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="-"
                                  value={override?.customShipping ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseFloat(e.target.value) : null;
                                    handleOverrideChange(info.name, info.fbmSkus.length, 'customShipping', val);
                                  }}
                                  className="w-20 px-2 py-1 border border-slate-200 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <select
                                  value={override?.fbmSource || ''}
                                  onChange={(e) => {
                                    const val = e.target.value as FBMSourceOverride;
                                    handleOverrideChange(info.name, info.fbmSkus.length, 'fbmSource', val || null);
                                  }}
                                  className="px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
                                >
                                  <option value="">Varsayılan</option>
                                  <option value="TR">TR (Türkiye)</option>
                                  <option value="US">US (Lokal)</option>
                                  <option value="BOTH">BOTH (Karma)</option>
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {filteredNamesForOverride.length === 0 && (
                    <div className="px-3 py-8 text-center text-sm text-slate-500">
                      {searchTerm ? 'Arama sonucu bulunamadı' : 'FBM satışı olan ürün bulunamadı'}
                    </div>
                  )}
                  {filteredNamesForOverride.length >= 50 && (
                    <div className="px-3 py-2 bg-purple-100/50 text-xs text-purple-600 text-center">
                      İlk 50 sonuç gösteriliyor. Daha fazla görmek için arama yapın.
                    </div>
                  )}
                </div>
              )}

              {/* Current Overrides Summary - Tablo formatında */}
              {nameOverrides.length > 0 && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-green-100 border-b border-green-200">
                    <span className="text-sm font-semibold text-green-800">
                      Aktif Ayarlar ({nameOverrides.length} ürün, {totalAffectedSkus} FBM SKU)
                    </span>
                    <button
                      onClick={() => onOverridesChange([])}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      Tümünü Temizle
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-green-50 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-green-800">Ürün Adı</th>
                          <th className="text-center px-3 py-2 font-medium text-green-800">SKU</th>
                          <th className="text-center px-3 py-2 font-medium text-green-800">Özel Kargo</th>
                          <th className="text-center px-3 py-2 font-medium text-green-800">FBM Kaynak</th>
                          <th className="text-center px-3 py-2 font-medium text-green-800 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {nameOverrides.map((o, idx) => (
                          <tr key={o.name} className={`border-t border-green-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-green-50/30'}`}>
                            <td className="px-4 py-2">
                              <span className="text-slate-700 truncate block max-w-[250px]" title={o.name}>
                                {o.name}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                {o.fbmSkuCount}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {o.customShipping !== null ? (
                                <span className="font-semibold text-green-700">${o.customShipping}</span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {o.fbmSource ? (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  o.fbmSource === 'TR' ? 'bg-red-100 text-red-700' :
                                  o.fbmSource === 'US' ? 'bg-blue-100 text-blue-700' :
                                  'bg-purple-100 text-purple-700'
                                }`}>
                                  {o.fbmSource === 'TR' ? 'Türkiye' : o.fbmSource === 'US' ? 'Lokal (US)' : 'Karma'}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => onOverridesChange(nameOverrides.filter(x => x.name !== o.name))}
                                className="text-slate-400 hover:text-red-500 text-lg leading-none"
                                title="Kaldır"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
      </div>

      {/* Summary section */}
      {costSummary && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            Matching Summary
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <SummaryCard
              label="Total Products"
              value={costSummary.totalProducts}
              color="blue"
            />
            <SummaryCard
              label="Matched"
              value={costSummary.matchedProducts}
              color="green"
            />
            <SummaryCard
              label="Missing Cost"
              value={costSummary.missingCost.length}
              color={costSummary.missingCost.length > 0 ? 'yellow' : 'green'}
            />
            <SummaryCard
              label="Missing Size"
              value={costSummary.missingSize.length}
              color={costSummary.missingSize.length > 0 ? 'yellow' : 'green'}
            />
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600">Eşleşme Oranı</span>
              <span className="font-semibold text-slate-800">
                %{costSummary.matchPercentage.toFixed(1)}
              </span>
            </div>
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  costSummary.matchPercentage >= 90
                    ? 'bg-green-500'
                    : costSummary.matchPercentage >= 70
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${costSummary.matchPercentage}%` }}
              />
            </div>
          </div>

          {/* Missing lists */}
          {costSummary.missingCost.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-yellow-700 hover:text-yellow-800">
                ⚠️ Eksik Maliyet ({costSummary.missingCost.length} SKU)
              </summary>
              <div className="mt-2 p-3 bg-yellow-50 rounded-lg max-h-40 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {costSummary.missingCost.slice(0, 50).map((sku) => (
                    <span
                      key={sku}
                      className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded"
                    >
                      {sku}
                    </span>
                  ))}
                  {costSummary.missingCost.length > 50 && (
                    <span className="text-xs text-yellow-600">
                      +{costSummary.missingCost.length - 50} daha...
                    </span>
                  )}
                </div>
              </div>
            </details>
          )}

          {costSummary.missingSize.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-yellow-700 hover:text-yellow-800">
                ⚠️ Eksik Desi ({costSummary.missingSize.length} SKU)
              </summary>
              <div className="mt-2 p-3 bg-yellow-50 rounded-lg max-h-40 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {costSummary.missingSize.slice(0, 50).map((sku) => (
                    <span
                      key={sku}
                      className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded"
                    >
                      {sku}
                    </span>
                  ))}
                  {costSummary.missingSize.length > 50 && (
                    <span className="text-xs text-yellow-600">
                      +{costSummary.missingSize.length - 50} daha...
                    </span>
                  )}
                </div>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

// Summary card component
const SummaryCard: React.FC<{
  label: string;
  value: number;
  color: 'blue' | 'green' | 'yellow' | 'red';
}> = ({ label, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <div className={`${colorClasses[color]} rounded-lg p-4`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-80">{label}</div>
    </div>
  );
};

export default React.memo(CostUploadTab);
