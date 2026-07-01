'use client'

import { useEffect, useActionState } from 'react'
import { localDateValue } from '@/lib/format'
import { addExpense } from './actions'

type ExpResult = { error?: string; success?: boolean } | null

export default function ExpenseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [state, action, pending] = useActionState(
    async (_prev: ExpResult, formData: FormData): Promise<ExpResult> => {
      return addExpense({
        amount: formData.get('amount') as string,
        date: formData.get('date') as string,
        description: formData.get('description') as string,
        category: formData.get('category') as string,
        invoiceNo: formData.get('invoice_no') as string,
        recurring: formData.get('recurring') as string,
      })
    },
    null as ExpResult
  )

  useEffect(() => {
    if ((state as ExpResult)?.success) onSuccess()
  }, [state, onSuccess])

  const today = localDateValue()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#0F2B3D]">Gider Ekle</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form action={action} className="p-6 space-y-4">
          {(state as ExpResult)?.error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{(state as ExpResult)!.error}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Kategori</label>
              <select name="category" defaultValue="Diğer" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30">
                {['Lab', 'Malzeme', 'Personel', 'Kira', 'Elektrik&Su', 'Reklam', 'Diğer'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Tutar (₺) *</label>
              <input name="amount" required placeholder="1500" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Açıklama *</label>
            <input name="description" required placeholder="örn. Diş laboratuvarı fatura ödemesi" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Tarih</label>
              <input name="date" type="date" defaultValue={today} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Fatura No</label>
              <input name="invoice_no" placeholder="opsiyonel" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Tekrarlayan Gider</label>
            <select name="recurring" defaultValue="" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30">
              <option value="">Hayır (tek seferlik)</option>
              <option value="monthly">Aylık</option>
              <option value="yearly">Yıllık</option>
            </select>
            <p className="text-[11px] text-gray-400 mt-1">İşaretlenir; otomatik ileri tarih oluşturma sonra eklenecek.</p>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
              İptal
            </button>
            <button type="submit" disabled={pending} className="flex-1 px-4 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] disabled:opacity-60">
              {pending ? 'Kaydediliyor…' : 'Gider Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
