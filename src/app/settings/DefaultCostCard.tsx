'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateDefaultCostRate } from './actions'

/**
 * Tarife > Maliyet: masrafı girilmemiş işlemlerde hakedişte ücretin yüzde kaçı masraf sayılsın.
 * Tedavide/tarifede masraf (lab, malzeme) girildiyse o geçerlidir; bu oran yalnızca boş olanlar içindir.
 */
export default function DefaultCostCard({ defaultCostBps, canManage, onChanged }: {
  defaultCostBps: number
  canManage: boolean
  onChanged: () => void
}) {
  const saved = String(defaultCostBps / 100).replace('.', ',')
  const [value, setValue] = useState(saved)
  const [pending, begin] = useTransition()
  const parsed = Number(value.replace(',', '.'))
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
  const changed = valid && Math.round(parsed * 100) !== defaultCostBps

  const save = () => begin(async () => {
    const result = await updateDefaultCostRate(parsed)
    if (result?.error) toast.error(result.error)
    else { toast.success(`Varsayılan masraf oranı %${parsed.toLocaleString('tr-TR')} olarak kaydedildi`); onChanged() }
  })

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-xl">
        <h3 className="font-black text-[#142536]">Maliyet — Varsayılan masraf oranı</h3>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-400">
          Masrafı (lab/malzeme) girilmemiş işlemlerde, hekim hakedişinde alınan ücretin bu yüzdesi masraf olarak düşülür.
          Bir işlemin masrafı girilmişse o geçerlidir. Burada yaptığınız değişiklik, masrafı boş olan tüm işlemlerin hakedişini etkiler.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-black text-slate-500">%</span>
        <input
          inputMode="decimal"
          value={value}
          disabled={!canManage || pending}
          onChange={(e) => setValue(e.target.value)}
          className="h-11 w-24 rounded-xl border border-slate-200 px-3 text-center text-sm font-black text-slate-700 outline-none focus:border-[#2DD4BF] disabled:bg-slate-50"
          aria-label="Varsayılan masraf oranı (%)"
        />
        {canManage && (
          <button
            onClick={save}
            disabled={!changed || pending}
            className="h-11 rounded-xl bg-[#1EAEA0] px-5 text-sm font-black text-white disabled:opacity-40"
          >
            {pending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        )}
      </div>
    </div>
  )
}
