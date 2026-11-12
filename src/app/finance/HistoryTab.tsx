'use client'

import { useMemo, useState } from 'react'
import type { FinBusinessPartner, FinDoctor, FinPatient, FinTx } from './FinanceClient'

const METHOD_LABEL: Record<string, string> = {
  cash: 'Nakit', card: 'Kart', transfer: 'Banka', check: 'Çek', senet: 'Senet', other: 'Diğer', firma_odemesi: 'Firma',
}
const PAGE = 50

function money(kurus: number) {
  return `₺${(kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Finans → İşlem Geçmişi: tüm gelir ve gider hareketlerinin tek, kronolojik (yeniden eskiye) dökümü. */
export default function HistoryTab({ txs, patients, partners, doctors, onPatientClick }: {
  txs: FinTx[]
  patients: FinPatient[]
  partners: FinBusinessPartner[]
  doctors: FinDoctor[]
  onPatientClick: (id: number) => void
}) {
  const [kind, setKind] = useState<'all' | 'income' | 'expense'>('all')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)

  const patientName = useMemo(() => new Map(patients.map((p) => [p.id, `${p.name} ${p.surname}`])), [patients])
  const partnerName = useMemo(() => new Map(partners.map((p) => [p.id, p.name])), [partners])
  const doctorName = useMemo(() => new Map(doctors.map((d) => [d.id, d.name])), [doctors])

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    return txs
      .filter((t) => (kind === 'all' ? true : kind === 'expense' ? t.type === 'expense' : t.type !== 'expense'))
      .map((t) => ({
        t,
        who: (t.patient_id && patientName.get(t.patient_id)) || (t.doctor_id && doctorName.get(t.doctor_id)) || (t.partner_id && partnerName.get(t.partner_id)) || '',
      }))
      .filter(({ t, who }) => !q || `${t.description ?? ''} ${t.category ?? ''} ${who} ${t.invoice_no ?? ''}`.toLocaleLowerCase('tr-TR').includes(q))
      .sort((a, b) => (a.t.transaction_date === b.t.transaction_date ? b.t.id - a.t.id : a.t.transaction_date < b.t.transaction_date ? 1 : -1))
  }, [txs, kind, query, patientName, partnerName, doctorName])

  const income = rows.filter(({ t }) => t.type !== 'expense').reduce((s, { t }) => s + t.amount, 0)
  const expense = rows.filter(({ t }) => t.type === 'expense').reduce((s, { t }) => s + t.amount, 0)

  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
        <div>
          <h3 className="font-black text-[#142536]">İşlem Geçmişi</h3>
          <p className="mt-1 text-xs font-semibold text-slate-400">Tüm gelir ve gider hareketleri, en yeniden eskiye.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([['all', 'Tümü'], ['income', 'Gelir'], ['expense', 'Gider']] as const).map(([id, label]) => (
            <button key={id} onClick={() => { setKind(id); setShown(PAGE) }} className={`h-9 rounded-xl px-4 text-xs font-black transition ${kind === id ? 'bg-[#142536] text-white' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{label}</button>
          ))}
          <input value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE) }} placeholder="Ara: hasta, açıklama, firma…" className="h-9 w-56 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 outline-none focus:border-[#2DD4BF]" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-3 text-xs font-bold">
        <span className="text-slate-500">{rows.length} işlem</span>
        <span className="text-emerald-600">Gelir {money(income)}</span>
        <span className="text-red-600">Gider {money(expense)}</span>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-slate-400">İşlem yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-slate-50 text-left text-[10px] font-black uppercase text-slate-400">
              <tr><th className="px-6 py-3">Tarih</th><th className="px-3 py-3">Tür</th><th className="px-3 py-3">Açıklama</th><th className="px-3 py-3">Kişi / Firma</th><th className="px-3 py-3">Yöntem</th><th className="px-6 py-3 text-right">Tutar</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map(({ t, who }) => {
                const isExpense = t.type === 'expense'
                return (
                  <tr key={t.id} className="border-t border-slate-50 hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-6 py-3 font-semibold text-slate-600">{new Date(`${t.transaction_date}T12:00:00`).toLocaleDateString('tr-TR')}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${isExpense ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{isExpense ? 'Gider' : 'Gelir'}</span></td>
                    <td className="max-w-[300px] truncate px-3 py-3 font-semibold text-slate-700" title={t.description ?? ''}>{t.description || t.category || '—'}</td>
                    <td className="px-3 py-3 font-semibold text-slate-600">
                      {t.patient_id && who ? <button onClick={() => onPatientClick(t.patient_id as number)} className="font-bold text-[#0D9488] hover:underline">{who}</button> : who || '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-500">{t.method ? METHOD_LABEL[t.method] ?? t.method : '—'}</td>
                    <td className={`whitespace-nowrap px-6 py-3 text-right font-black ${isExpense ? 'text-red-600' : 'text-emerald-600'}`}>{isExpense ? '−' : '+'}{money(t.amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > shown && (
        <div className="border-t border-slate-100 p-4 text-center">
          <button onClick={() => setShown((n) => n + PAGE)} className="h-9 rounded-xl border border-slate-200 px-5 text-xs font-black text-slate-500 hover:bg-slate-50">Daha fazla göster ({rows.length - shown} kayıt daha)</button>
        </div>
      )}
    </section>
  )
}
