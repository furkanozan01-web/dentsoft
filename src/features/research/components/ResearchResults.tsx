'use client'

import Link from 'next/link'
import type { ResearchResult, ResearchTag } from '../types'

interface Props {
  results: ResearchResult[]
  selected: Set<number>
  tags: ResearchTag[]
  tagId: string
  tagging: boolean
  onTagId: (value: string) => void
  onToggle: (id: number) => void
  onToggleAll: () => void
  onApplyTag: () => void
}

export default function ResearchResults({ results, selected, tags, tagId, tagging, onTagId, onToggle, onToggleAll, onApplyTag }: Props) {
  const allSelected = results.length > 0 && results.every((result) => selected.has(result.id))
  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-h-14 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <input type="checkbox" checked={allSelected} onChange={onToggleAll} className="h-4 w-4 accent-[#0F766E]" />
          {selected.size ? `${selected.size} seçili` : 'Tümünü seç'}
        </label>
        <div className="ml-auto flex items-center gap-2">
          <select value={tagId} onChange={(event) => onTagId(event.target.value)} className="h-9 min-w-36 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 outline-none focus:border-[#2DD4BF]">
            <option value="">Etiket seçin</option>
            {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
          <button type="button" onClick={onApplyTag} disabled={!tagId || selected.size === 0 || tagging} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-[#142536] transition hover:border-[#2DD4BF] disabled:opacity-40">
            Etiketle
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead className="border-b border-slate-200 bg-[#F8FAFC] text-[10px] font-black uppercase text-slate-400">
            <tr><th className="w-12 px-4 py-3"></th><th className="px-3 py-3">Hasta</th><th className="px-3 py-3">Son ziyaret</th><th className="px-3 py-3">Tedavi özeti</th><th className="px-3 py-3">Hekim</th><th className="px-3 py-3 text-right">Kalan borç</th><th className="px-3 py-3">Etiketler</th><th className="w-24 px-4 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {results.map((result) => (
              <tr key={result.id} className={`transition hover:bg-[#F7FCFB] ${selected.has(result.id) ? 'bg-[#F0FDFA]' : ''}`}>
                <td className="px-4 py-4"><input type="checkbox" checked={selected.has(result.id)} onChange={() => onToggle(result.id)} className="h-4 w-4 accent-[#0F766E]" aria-label={`${result.name} ${result.surname} seç`} /></td>
                <td className="px-3 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E9FBF8] text-xs font-black text-[#0F766E]">{initials(result.name, result.surname)}</span><div><p className="text-sm font-black text-[#142536]">{result.name} {result.surname}</p><p className="mt-0.5 text-[11px] font-semibold text-slate-400">{result.age !== null ? `${result.age} yaş` : 'Yaş bilgisi yok'} · {result.phone || 'Telefon yok'}</p></div></div></td>
                <td className="px-3 py-4 text-xs font-bold text-slate-600">{formatDate(result.lastVisit)}</td>
                <td className="max-w-52 px-3 py-4"><p className="truncate text-xs font-bold text-slate-600" title={result.treatmentSummary.join(', ')}>{result.treatmentSummary.join(', ') || 'İşlem yok'}</p></td>
                <td className="px-3 py-4 text-xs font-bold text-slate-600">{result.doctors.join(', ') || '—'}</td>
                <td className="px-3 py-4 text-right"><p className={`text-sm font-black ${result.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatMoney(Math.max(result.balance, 0))}</p>{result.hasOverdueInstallment && <span className="mt-1 inline-block rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-black text-red-600">GECİKMİŞ TAKSİT</span>}</td>
                <td className="px-3 py-4"><div className="flex max-w-44 flex-wrap gap-1">{result.tags.length ? result.tags.map((tag) => <span key={tag.id} className="rounded px-1.5 py-1 text-[9px] font-black text-white" style={{ backgroundColor: tag.color }}>{tag.name}</span>) : <span className="text-xs font-semibold text-slate-300">—</span>}</div></td>
                <td className="px-4 py-4 text-right"><Link href={`/patients?patient_id=${result.id}`} className="inline-flex h-8 items-center rounded-md border border-slate-200 px-2.5 text-[11px] font-black text-[#0F766E] transition hover:border-[#2DD4BF] hover:bg-[#E9FBF8]">Detay</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {results.length === 0 && <div className="flex min-h-64 items-center justify-center bg-white px-6 text-center"><div><p className="text-sm font-black text-[#142536]">Eşleşen hasta bulunamadı</p><p className="mt-1 text-xs font-semibold text-slate-400">Filtreleri değiştirerek yeniden araştırın.</p></div></div>}
    </div>
  )
}

function initials(name: string, surname: string) { return `${name.charAt(0)}${surname.charAt(0)}`.toLocaleUpperCase('tr-TR') }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat('tr-TR').format(new Date(`${value}T00:00:00`)) : 'Ziyaret yok' }
function formatMoney(value: number) { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value / 100) }

