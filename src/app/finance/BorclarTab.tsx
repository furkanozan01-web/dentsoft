'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { cleanMoney, formatAmountRounded, kurusToInput } from '@/lib/format'
import { addClinicDebt, updateClinicDebt, payClinicDebt, deleteClinicDebt } from './actions'
import type { ClinicDebt } from './FinanceClient'

// ---- Borçlar ----

export default function BorclarTab({
  debts,
  onChanged,
}: {
  debts: ClinicDebt[]
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const today = new Date().toISOString().slice(0, 10)

  const [showForm, setShowForm] = useState(false)
  const [editDebt, setEditDebt] = useState<ClinicDebt | null>(null)
  const [payingId, setPayingId] = useState<number | null>(null)
  const [payStr, setPayStr] = useState('')
  const [pending, startTransition] = useTransition()

  const activeDebts = debts.filter((d) => d.status === 'active')
  const paidDebts = debts.filter((d) => d.status === 'paid')

  const totalRemaining = activeDebts.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0)
  const overdueCount = activeDebts.filter((d) => d.due_date && d.due_date < today).length

  const handlePay = (debtId: number) => {
    const amountTL = parseFloat(payStr.replace(',', '.'))
    if (isNaN(amountTL) || amountTL <= 0) { toast.error('Geçerli bir tutar girin'); return }
    const amountKurus = Math.round(amountTL * 100)
    startTransition(async () => {
      const res = await payClinicDebt(debtId, amountKurus)
      if (res?.error) toast.error(res.error)
      else { toast.success('Ödeme kaydedildi'); setPayingId(null); setPayStr(''); onChanged() }
    })
  }

  const handleDelete = async (d: ClinicDebt) => {
    const ok = await confirm({ title: 'Borcu İptal Et', message: `"${d.title}" borcu iptal edilecek. Emin misiniz?`, confirmText: 'İptal Et' })
    if (!ok) return
    startTransition(async () => {
      const res = await deleteClinicDebt(d.id)
      if (res?.error) toast.error(res.error)
      else { toast.success('Borç iptal edildi'); onChanged() }
    })
  }

  const RECURRENCE_LABEL: Record<string, string> = { tek_seferlik: 'Tek Seferlik', aylik: 'Aylık', yillik: 'Yıllık' }

  return (
    <div className="space-y-6">
      {/* Özet KPI'lar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[20px] border border-slate-200/90 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Kalan Borç</p>
          <p className="mt-1 text-2xl font-black text-orange-600">₺{formatAmountRounded(totalRemaining)}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">{activeDebts.length} aktif borç kalemi</p>
        </div>
        <div className={`rounded-[20px] border bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] ${overdueCount > 0 ? 'border-red-200' : 'border-slate-200/90'}`}>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Vadesi Geçmiş</p>
          <p className={`mt-1 text-2xl font-black ${overdueCount > 0 ? 'text-red-600' : 'text-slate-300'}`}>{overdueCount}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">ödeme yapılmamış borç</p>
        </div>
        <div className="rounded-[20px] border border-slate-200/90 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Ödendi</p>
          <p className="mt-1 text-2xl font-black text-green-600">{paidDebts.length}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">kapatılan borç</p>
        </div>
      </div>

      {/* Başlık + Ekle butonu */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-[#0F2B3D]">Aktif Borçlar</h2>
        <button
          type="button"
          onClick={() => { setEditDebt(null); setShowForm(true) }}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2DD4BF] px-4 text-xs font-black text-[#0F2B3D] hover:bg-[#26b8a5] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
          Borç Ekle
        </button>
      </div>

      {activeDebts.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-400">Aktif borç kaydı bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeDebts.map((d) => {
            const remaining = d.total_amount - d.paid_amount
            const paidPct = d.total_amount > 0 ? Math.round((d.paid_amount / d.total_amount) * 100) : 0
            const isOverdue = d.due_date ? d.due_date < today : false
            const isPaying = payingId === d.id
            return (
              <div key={d.id} className={`rounded-[20px] border bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition ${isOverdue ? 'border-red-200' : 'border-slate-200/90'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-[#0F2B3D]">{d.title}</p>
                      {isOverdue && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-600">Vadesi Geçti</span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{RECURRENCE_LABEL[d.recurrence] ?? d.recurrence}</span>
                    </div>
                    {d.due_date && (
                      <p className={`mt-0.5 text-xs font-semibold ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                        Vade: {new Date(d.due_date).toLocaleDateString('tr-TR')}
                      </p>
                    )}
                    {d.notes && <p className="mt-1 text-xs text-slate-400">{d.notes}</p>}
                    {/* İlerleme çubuğu */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                        <span>₺{formatAmountRounded(d.paid_amount)} ödendi</span>
                        <span>₺{formatAmountRounded(remaining)} kalan / ₺{formatAmountRounded(d.total_amount)} toplam</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-[#2DD4BF] transition-all" style={{ width: `${paidPct}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => { setPayingId(isPaying ? null : d.id); setPayStr('') }}
                      className="h-8 rounded-lg bg-[#2DD4BF]/10 px-3 text-xs font-black text-[#0F766E] hover:bg-[#2DD4BF]/20 transition-colors"
                    >
                      Öde
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditDebt(d); setShowForm(true) }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(d)}
                      disabled={pending}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>
                    </button>
                  </div>
                </div>

                {/* Ödeme inline formu */}
                {isPaying && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] px-4 py-3">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₺</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={payStr}
                        onChange={(e) => setPayStr(e.target.value)}
                        placeholder={`Maks. ₺${formatAmountRounded(remaining)}`}
                        className="w-full rounded-lg border border-[#E7ECF2] bg-white py-2 pl-7 pr-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePay(d.id)}
                      disabled={pending}
                      className="h-9 rounded-lg bg-[#2DD4BF] px-4 text-xs font-black text-[#0F2B3D] hover:bg-[#26b8a5] disabled:opacity-60 transition-colors"
                    >
                      {pending ? '…' : 'Kaydet'}
                    </button>
                    <button type="button" onClick={() => setPayingId(null)} className="h-9 rounded-lg px-3 text-xs font-bold text-slate-400 hover:bg-slate-100 transition-colors">İptal</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Kapatılan borçlar */}
      {paidDebts.length > 0 && (
        <details className="rounded-[20px] border border-slate-200/90 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <summary className="cursor-pointer text-sm font-black text-slate-500 select-none">
            Kapatılan Borçlar ({paidDebts.length})
          </summary>
          <div className="mt-4 space-y-2">
            {paidDebts.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-500 line-through">{d.title}</span>
                <span className="text-xs font-black text-green-600">₺{formatAmountRounded(d.total_amount)} — Ödendi</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Borç Ekleme/Düzenleme Modalı */}
      {showForm && (
        <DebtFormModal
          debt={editDebt}
          onClose={() => { setShowForm(false); setEditDebt(null) }}
          onSaved={() => { setShowForm(false); setEditDebt(null); onChanged() }}
        />
      )}
    </div>
  )
}

function DebtFormModal({
  debt,
  onClose,
  onSaved,
}: {
  debt: ClinicDebt | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = debt !== null
  const [title, setTitle] = useState(debt?.title ?? '')
  const [amountStr, setAmountStr] = useState(debt ? kurusToInput(debt.total_amount) : '')
  const [dueDate, setDueDate] = useState(debt?.due_date ?? '')
  const [recurrence, setRecurrence] = useState(debt?.recurrence ?? 'tek_seferlik')
  const [notes, setNotes] = useState(debt?.notes ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const inputCls = 'w-full rounded-xl border border-[#E7ECF2] bg-white px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30'

  const submit = () => {
    const amountTL = parseFloat(cleanMoney(amountStr))
    if (!title.trim()) { setErr('Başlık zorunludur'); return }
    if (isNaN(amountTL) || amountTL <= 0) { setErr('Geçerli bir tutar girin'); return }
    setErr(null)
    const totalAmount = Math.round(amountTL * 100)
    startTransition(async () => {
      const input = { title: title.trim(), totalAmount, dueDate: dueDate || null, recurrence, notes: notes.trim() || null }
      const res = isEdit ? await updateClinicDebt(debt!.id, input) : await addClinicDebt(input)
      if (res?.error) { setErr(res.error); return }
      toast.success(isEdit ? 'Borç güncellendi' : 'Borç eklendi')
      onSaved()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-black text-[#0F2B3D]">{isEdit ? 'Borcu Düzenle' : 'Yeni Borç Ekle'}</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {err && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-700">{err}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">Başlık *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Ekipman kredisi" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">Toplam Tutar (₺) *</label>
            <input type="text" inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="50000" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Vade Tarihi</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Tekrar</label>
              <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={inputCls}>
                <option value="tek_seferlik">Tek Seferlik</option>
                <option value="aylik">Aylık</option>
                <option value="yillik">Yıllık</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">Notlar</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opsiyonel açıklama" className={inputCls} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">İptal</button>
          <button type="button" onClick={submit} disabled={pending} className="h-9 rounded-xl bg-[#2DD4BF] px-5 text-xs font-black text-[#0F2B3D] hover:bg-[#26b8a5] disabled:opacity-60 transition-colors">
            {pending ? 'Kaydediliyor…' : isEdit ? 'Güncelle' : 'Ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}

