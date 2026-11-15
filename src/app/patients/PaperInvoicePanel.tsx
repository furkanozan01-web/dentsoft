'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { cleanMoney, formatAmount, kurusToInput, localDateValue } from '@/lib/format'
import { recordPaperInvoice, removeInvoiceRecord } from './actions'
import type { Patient, Transaction, Treatment } from './types'

const METHOD: Record<string, string> = { cash: 'Nakit', card: 'Kart', transfer: 'Havale', senet: 'Senet', firma_odemesi: 'Firma', check: 'Çek', other: 'Diğer' }

function parseKurus(value: string): number {
  const n = parseFloat(cleanMoney(value))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/**
 * "Kağıt fatura kesildi": elle yazılan faturayı sisteme düşer. Fatura tutarı, seçilen ödemelerin toplamından
 * küçük olabilir (tutarın tamamına fatura kesmek zorunlu değil). İleride e-fatura entegrasyonu bu kayıtların yerini alabilir.
 */
export default function PaperInvoicePanel({
  patient, transactions, treatments, onChanged,
}: {
  patient: Patient
  transactions: Transaction[]
  treatments: Treatment[]
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const payments = useMemo(() => transactions.filter((t) => t.type === 'payment'), [transactions])
  const open = useMemo(() => payments.filter((t) => !t.invoice_no), [payments])
  const [selected, setSelected] = useState<Set<number>>(() => new Set(open.map((t) => t.id)))
  const [invoiceNo, setInvoiceNo] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(localDateValue())
  const [amountDraft, setAmountDraft] = useState<string | null>(null)
  const [description, setDescription] = useState('')

  const selectedTotal = open.filter((t) => selected.has(t.id)).reduce((s, t) => s + (t.amount ?? 0), 0)
  const amountStr = amountDraft ?? kurusToInput(selectedTotal)
  const amount = parseKurus(amountStr)
  const treatmentNames = useMemo(() => Array.from(new Set(treatments.map((t) => t.treatment_name).filter(Boolean))).join(', '), [treatments])

  const invoices = useMemo(() => {
    const map = new Map<string, { invoiceNo: string; date: string; amount: number; paymentTotal: number; kind: string | null; count: number }>()
    for (const t of payments) {
      if (!t.invoice_no) continue
      const cur = map.get(t.invoice_no)
      if (cur) { cur.paymentTotal += t.amount; cur.count += 1 }
      else map.set(t.invoice_no, {
        invoiceNo: t.invoice_no,
        date: t.invoice_sent_at ? new Date(t.invoice_sent_at).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) : new Date(t.transaction_date).toLocaleDateString('tr-TR'),
        amount: t.invoice_amount ?? t.amount,
        paymentTotal: t.amount,
        kind: t.invoice_institution,
        count: 1,
      })
    }
    return [...map.values()]
  }, [payments])

  const toggle = (id: number) => {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
    setAmountDraft(null)
  }

  const save = () => {
    if (!invoiceNo.trim()) { toast.error('Fatura numarasını girin'); return }
    startTransition(async () => {
      const res = await recordPaperInvoice({
        patientId: patient.id,
        transactionIds: [...selected].filter((id) => open.some((t) => t.id === id)),
        invoiceNo,
        invoiceDate,
        amountKurus: amount,
        lineDescription: description || treatmentNames,
      })
      if (res.error) { toast.error(res.error); return }
      toast.success(`${invoiceNo.trim()} numaralı kağıt fatura kaydedildi`)
      setInvoiceNo(''); setAmountDraft(null); setDescription('')
      setSelected(new Set())
      onChanged()
    })
  }

  const remove = async (no: string) => {
    const ok = await confirm({ title: 'Fatura Kaydını Kaldır', message: `${no} numaralı fatura kaydı kaldırılacak; ilgili ödemeler tekrar "faturasız" görünür. Emin misiniz?`, confirmText: 'Kaldır' })
    if (!ok) return
    startTransition(async () => {
      const res = await removeInvoiceRecord(patient.id, no)
      if (res.error) toast.error(res.error)
      else { toast.success('Fatura kaydı kaldırıldı'); onChanged() }
    })
  }

  const field = 'h-11 w-full rounded-xl border border-[#E7ECF2] bg-white px-3 text-sm font-semibold text-[#142536] outline-none focus:border-[#2DD4BF]'
  const partial = amount > 0 && amount < selectedTotal

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <h2 className="text-base font-black text-[#0F2B3D]">Kağıt Fatura Kesildi</h2>
        <p className="mt-0.5 text-xs font-medium text-slate-400">Elle yazdığınız faturayı buradan düşün. Faturanın tamamı alınan tutar kadar olmak zorunda değil; yalnızca kestiğiniz tutarı yazın.</p>

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-400">Faturaya bağlanacak ödemeler</p>
          {open.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">Faturasız ödeme yok.</p>
          ) : (
            <div className="space-y-1.5">
              {open.map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#EEF2F6] bg-[#FAFBFC] px-3 py-2.5 text-sm hover:bg-white">
                  <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="h-4 w-4 accent-[#2DD4BF]" />
                  <span className="font-semibold text-slate-500">{new Date(t.transaction_date).toLocaleDateString('tr-TR')}</span>
                  <span className="text-xs font-bold text-slate-400">{METHOD[t.method ?? ''] ?? t.method ?? ''}</span>
                  <span className="ml-auto font-black text-[#142536]">₺{formatAmount(t.amount)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-black text-slate-500">Fatura No
            <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Faturanın üzerindeki numara" className={`mt-1.5 ${field}`} />
          </label>
          <label className="text-xs font-black text-slate-500">Fatura Tarihi
            <input type="date" value={invoiceDate} max={localDateValue()} onChange={(e) => setInvoiceDate(e.target.value)} className={`mt-1.5 ${field}`} />
          </label>
          <label className="text-xs font-black text-slate-500">Fatura Tutarı (₺)
            <input data-money value={amountStr} onChange={(e) => setAmountDraft(e.target.value)} inputMode="decimal" className={`mt-1.5 ${field}`} />
          </label>
          <div className="flex items-end">
            <div className="w-full rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Seçilen ödeme toplamı</p>
              <p className="text-lg font-black text-[#0F766E]">₺{formatAmount(selectedTotal)}</p>
            </div>
          </div>
          <label className="text-xs font-black text-slate-500 sm:col-span-2 lg:col-span-4">Yapılan işlem (isteğe bağlı)
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={treatmentNames || 'Diş tedavi hizmeti'} className={`mt-1.5 ${field}`} />
          </label>
        </div>

        {partial && (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
            Kısmi fatura: ₺{formatAmount(selectedTotal - amount)} tutarı için fatura kesilmedi; hekim hakedişinde KDV yalnızca ₺{formatAmount(amount)} üzerinden hesaplanır.
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={pending || !invoiceNo.trim() || selected.size === 0 || amount <= 0 || amount > selectedTotal}
            className="h-11 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-6 text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Kaydediliyor…' : 'Faturayı Düş'}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[#EEF2F6] px-6 py-5">
          <h3 className="text-base font-black text-[#0F2B3D]">Kesilen Faturalar</h3>
          <p className="mt-0.5 text-xs font-medium text-slate-400">Bu hastaya kesilmiş kağıt ve e-fatura kayıtları</p>
        </div>
        {invoices.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm font-semibold text-slate-400">Henüz fatura kaydı yok.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-[#FAFBFC] text-left text-[10px] font-black uppercase tracking-wide text-slate-400">
              <tr>{['Fatura No', 'Tarih', 'Tür', 'Fatura tutarı', 'Bağlı ödeme', ''].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.invoiceNo} className="border-t border-slate-100">
                  <td className="px-5 py-3 font-black text-[#142536]">{inv.invoiceNo}</td>
                  <td className="px-5 py-3 font-semibold text-slate-500">{inv.date}</td>
                  <td className="px-5 py-3 font-semibold text-slate-500">{inv.kind ?? 'E-fatura'}</td>
                  <td className="px-5 py-3 font-black text-emerald-600">₺{formatAmount(inv.amount)}</td>
                  <td className="px-5 py-3 font-semibold text-slate-500">₺{formatAmount(inv.paymentTotal)} ({inv.count} ödeme)</td>
                  <td className="px-5 py-3 text-right"><button type="button" disabled={pending} onClick={() => remove(inv.invoiceNo)} className="font-black text-red-400 hover:text-red-600">Kaldır</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
