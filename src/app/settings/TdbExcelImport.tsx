'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { importTdbFromRows } from './actions'
import { parseCsv, parseTdbSheets, type TdbParseResult } from './tdbParse'
import { readTdbPdf } from './tdbPdf'

export const TDB_OFFICIAL_URL = 'https://www.tdb.org.tr/tdb/v2/ekler/2026_Yili_Rehber_Tarife_Kitapcigi.pdf'

const MAX_BYTES = 15 * 1024 * 1024

/** TDB tarifesini Excel (.xlsx) veya CSV dosyasından yükler: dosya tarayıcıda okunur, önizlenir, onaylanınca profil oluşturulur/yenilenir. */
export default function TdbExcelImport({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [vatIncluded, setVatIncluded] = useState(true)
  const [fileName, setFileName] = useState('')
  const [sheets, setSheets] = useState<{ name: string; rows: (string | number | boolean | Date | null)[][] }[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [pending, startTransition] = useTransition()

  const preview: TdbParseResult | null = sheets ? parseTdbSheets(sheets, vatIncluded) : null

  async function onFile(file: File | undefined) {
    setError(null)
    setSheets(null)
    if (!file) return
    if (file.size > MAX_BYTES) { setError('Dosya 15 MB’tan büyük olamaz'); return }
    const lower = file.name.toLowerCase()
    setFileName(file.name)
    setReading(true)
    try {
      if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        setSheets([{ name: 'Sayfa1', rows: parseCsv(await file.text()) }])
      } else if (lower.endsWith('.pdf')) {
        setSheets([{ name: 'PDF', rows: await readTdbPdf(file) }])
      } else if (lower.endsWith('.xlsx')) {
        const { default: readXlsxFile } = await import('read-excel-file/browser')
        const result = await readXlsxFile(file)
        setSheets(result.map((s) => ({ name: s.sheet, rows: s.data as (string | number | boolean | Date | null)[][] })))
      } else {
        setError('Yalnızca .pdf, .xlsx veya .csv dosyası yüklenebilir (eski .xls dosyasını Excel’de “Farklı Kaydet → .xlsx” yapın)')
      }
    } catch {
      setError('Dosya okunamadı. Dosyanın bozuk olmadığından ve parola korumalı olmadığından emin olun.')
    } finally {
      setReading(false)
    }
  }

  function submit() {
    if (!preview || preview.items.length === 0) return
    const y = Number(year)
    startTransition(async () => {
      const res = await importTdbFromRows(y, preview.items)
      if (res.error) { setError(res.error); return }
      toast.success(`TDB ${y}: ${res.count} kalem ${res.updated ? 'güncellendi' : 'içe aktarıldı'}`)
      onDone()
    })
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2DD4BF]/30'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-[#0F2B3D]">TDB Tarifesini Dosyadan Yükle</h2>
        <p className="mt-1 text-xs text-gray-400">
          Resmî listeyi{' '}
          <a href={TDB_OFFICIAL_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0D9488] underline">Türk Dişhekimleri Birliği sitesinden</a>
          {' '}indirin; PDF’i olduğu gibi (TDB’nin yayımladığı biçimde) ya da Excel (.xlsx) / CSV olarak buraya yükleyin. Excel/CSV’de “işlem adı” ve “fiyat (KDV dahil)” sütunları bulunmalıdır.
        </p>

        <div className="mt-4 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-gray-500">Tarife yılı
              <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" className={`mt-1.5 ${inputCls}`} />
            </label>
            <label className="block text-xs font-medium text-gray-500">Fiyatlar
              <select value={vatIncluded ? 'dahil' : 'haric'} onChange={(e) => setVatIncluded(e.target.value === 'dahil')} className={`mt-1.5 ${inputCls}`}>
                <option value="dahil">KDV dahil</option>
                <option value="haric">KDV hariç (+%10 eklenir)</option>
              </select>
            </label>
          </div>

          <label className="block text-xs font-medium text-gray-500">Dosya (.pdf / .xlsx / .csv)
            <input type="file" accept=".pdf,.xlsx,.csv,.txt" onChange={(e) => void onFile(e.target.files?.[0])} className={`mt-1.5 ${inputCls} file:mr-3 file:rounded-lg file:border-0 file:bg-[#E6FFFA] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[#0F766E]`} />
          </label>

          {reading && <p className="text-xs text-gray-400">Dosya okunuyor…</p>}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}

          {preview && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
              <p className="font-semibold text-[#0F2B3D]">{fileName}</p>
              <p className="mt-1">{preview.items.length} işlem · {preview.categories} kategori{preview.skipped > 0 ? ` · ${preview.skipped} satır atlandı` : ''}</p>
              {preview.warnings.map((w) => <p key={w} className="mt-1 text-amber-700">{w}</p>)}
              {preview.items.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {preview.items.slice(0, 6).map((it, i) => (
                    <li key={i} className="flex justify-between gap-3"><span className="truncate">{it.treatment_name}</span><span className="shrink-0 font-semibold">₺{(it.price / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span></li>
                  ))}
                  {preview.items.length > 6 && <li className="text-gray-400">…ve {preview.items.length - 6} işlem daha</li>}
                </ul>
              )}
              <p className="mt-2 text-gray-400">Aynı yıl için profil varsa fiyatları güncellenir; yoksa “TDB {year}” profili oluşturulur. Diğer profillere dokunulmaz.</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50">İptal</button>
          <button type="button" onClick={submit} disabled={pending || !preview || preview.items.length === 0 || year.length !== 4} className="flex-1 rounded-xl bg-[#2DD4BF] px-4 py-2 text-sm font-semibold text-[#0F2B3D] transition-colors hover:bg-[#26b8a5] disabled:opacity-50">
            {pending ? 'Aktarılıyor…' : 'İçe Aktar'}
          </button>
        </div>
      </div>
    </div>
  )
}
