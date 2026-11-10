'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { parseToKurus, formatAmount } from '@/lib/format'
import { applyTreatmentAdjustment, closeTreatmentAccount } from './actions'
import type { Treatment } from './types'

// ─── Tedavi geçmişi kartı ─────────────────────────────────────────────────────
export function TreatmentHistoryCard({
  patientId,
  treatments,
  loading,
  pending,
  editingFee,
  selectedTreatmentIds,
  onChanged,
  onEditFee,
  onSaveFee,
  onCancel,
  onToggleTreatment,
  onSelectAllTreatments,
  onClearSelection,
  onBulkDelete,
  onPrint,
}: {
  patientId: number
  treatments: Treatment[]
  loading: boolean
  pending: boolean
  editingFee: { id: number; val: string } | null
  selectedTreatmentIds: Set<number>
  onChanged: () => void
  onEditFee: (v: { id: number; val: string } | null) => void
  onSaveFee: (t: Treatment) => void
  onCancel: (t: Treatment) => void
  onToggleTreatment: (id: number) => void
  onSelectAllTreatments: (ids: number[]) => void
  onClearSelection: () => void
  onBulkDelete: () => void
  onPrint: () => void
}) {
  const confirm = useConfirm()
  const [showClosed, setShowClosed] = useState(false)
  const [showAdjustment, setShowAdjustment] = useState(false)
  const [adjustmentType, setAdjustmentType] = useState<'percent' | 'fixed'>('percent')
  const [adjustmentDirection, setAdjustmentDirection] = useState<'discount' | 'increase'>('discount')
  const [adjustmentValue, setAdjustmentValue] = useState('10')
  const [actionPending, startActionTransition] = useTransition()

  const openTreatments = treatments.filter((treatment) => !treatment.is_closed)
  const closedTreatments = treatments.filter((treatment) => treatment.is_closed)
  const visibleTreatments = showClosed ? treatments : openTreatments
  const openTotal = openTreatments.reduce((sum, treatment) => sum + (treatment.fee ?? 0), 0)
  const visibleIds = visibleTreatments.map((treatment) => treatment.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedTreatmentIds.has(id))
  const someSelected = visibleIds.some((id) => selectedTreatmentIds.has(id)) && !allSelected

  const numericAdjustment = adjustmentType === 'percent'
    ? Number(adjustmentValue.replace(',', '.'))
    : parseToKurus(adjustmentValue)
  const previewTotal = adjustmentType === 'fixed'
    ? numericAdjustment
    : Number.isFinite(numericAdjustment)
    ? Math.round(openTotal * (adjustmentDirection === 'discount' ? 1 - numericAdjustment / 100 : 1 + numericAdjustment / 100))
    : 0
  const previewDifference = previewTotal - openTotal
  const adjustmentValid = Number.isFinite(numericAdjustment) && numericAdjustment > 0 && previewTotal > 0

  const toggleClosedTreatments = () => {
    if (showClosed) {
      closedTreatments.forEach((treatment) => {
        if (selectedTreatmentIds.has(treatment.id)) onToggleTreatment(treatment.id)
      })
    }
    setShowClosed((current) => !current)
  }

  const handleCloseAccount = async () => {
    const ok = await confirm({
      title: 'Hesabı Kapat',
      message: 'Bu hastanın tüm açık tedavileri kapalı olarak işaretlenecek. Devam edilsin mi?',
      confirmText: 'Hesabı Kapat',
    })
    if (!ok) return
    startActionTransition(async () => {
      const result = await closeTreatmentAccount(patientId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Hesap kapatıldı ✓')
      onClearSelection()
      setShowAdjustment(false)
      setShowClosed(false)
      onChanged()
    })
  }

  const handleApplyAdjustment = () => {
    if (!adjustmentValid) {
      toast.error('Geçerli bir yeni toplam veya yüzde girin')
      return
    }
    startActionTransition(async () => {
      const result = await applyTreatmentAdjustment(patientId, {
        type: adjustmentType,
        value: numericAdjustment,
        direction: adjustmentDirection,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Tedavi ücretleri güncellendi')
      setShowAdjustment(false)
      onChanged()
    })
  }

  const disabled = pending || actionPending
  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 border-b border-[#EEF2F6] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-black text-[#0F2B3D]">Tedavi Geçmişi</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400">Hastaya uygulanmış işlemler</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedTreatmentIds.size > 0 && (
            <button
              type="button"
              onClick={onBulkDelete}
              disabled={disabled}
              className="inline-flex h-9 items-center rounded-xl border border-red-200 bg-red-50 px-3 text-[11px] font-black text-red-700 transition hover:bg-red-100 disabled:opacity-40"
            >
              Seçilenleri Sil ({selectedTreatmentIds.size})
            </button>
          )}
          <button
            type="button"
            onClick={onPrint}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#D9E4EA] bg-white px-3 text-[11px] font-black text-[#315164] transition hover:bg-slate-50 disabled:opacity-40"
          >
            <IconPrint />
            Yazdır
          </button>
          {closedTreatments.length > 0 && (
            <button
              type="button"
              onClick={toggleClosedTreatments}
              className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-black transition ${showClosed ? 'border-[#BFEFE8] bg-[#E9FBF8] text-[#0F766E]' : 'border-[#E7ECF2] bg-white text-slate-500 hover:bg-slate-50'}`}
              title={showClosed ? 'Kapalı hesapları gizle' : 'Kapalı hesapları göster'}
            >
              <IconEye />
              {showClosed ? 'Kapalıları Gizle' : 'Kapalıları Göster'}
            </button>
          )}
          <button
            type="button"
            onClick={handleCloseAccount}
            disabled={disabled || openTreatments.length === 0}
            className="inline-flex h-9 items-center rounded-xl border border-red-200 bg-white px-3 text-[11px] font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Hesabı Kapat
          </button>
          <span className="rounded-full bg-[#E6FFFA] px-3 py-1.5 text-sm font-black text-[#0F766E]">
            Açık Toplam: ₺{formatAmount(openTotal)}
          </span>
        </div>
      </div>
      {loading ? (
        <p className="py-8 text-center text-sm font-medium text-gray-400">Yükleniyor…</p>
      ) : treatments.length === 0 ? (
        <p className="py-8 text-center text-sm font-medium text-gray-400">
          Henüz tedavi yok. Sağdan bir işlem seçip dişe tıklayın.
        </p>
      ) : visibleTreatments.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-semibold text-slate-400">Tüm tedavi kayıtları kapalı hesapta.</p>
          <button type="button" onClick={toggleClosedTreatments} className="mt-2 text-xs font-black text-[#0F766E] hover:underline">
            {closedTreatments.length} kapalı kaydı göster
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-[#FAFBFC]">
              <tr className="border-b border-[#EEF2F6]">
                <th className="h-12 w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected }}
                    onChange={() => onSelectAllTreatments(visibleIds)}
                    className="h-4 w-4 rounded border-slate-300 accent-[#2DD4BF]"
                  />
                </th>
                {['Tarih', 'Diş', 'Tedavi', 'Hekim', 'Ücret', ''].map((h) => (
                  <th key={h} className="h-12 px-4 py-3 text-left font-black uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleTreatments.map((t) => {
                const originalFee = t.original_fee ?? t.fee
                const adjusted = originalFee !== t.fee
                return (
                <tr key={t.id} className={`h-16 border-b border-[#EEF2F6] transition last:border-0 hover:bg-[#5FD3C1]/[0.04] ${selectedTreatmentIds.has(t.id) ? 'bg-[#F0FEFA]' : ''} ${t.is_closed ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedTreatmentIds.has(t.id)}
                      onChange={() => onToggleTreatment(t.id)}
                      className="h-4 w-4 rounded border-slate-300 accent-[#2DD4BF]"
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-500">
                    {t.treatment_date ? new Date(t.treatment_date).toLocaleDateString('tr-TR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-black text-[#142536]">{t.tooth ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 font-bold text-[#0F2B3D]">
                    <div className="flex items-center gap-2">
                      <span>{t.treatment_name}</span>
                      {t.is_closed && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-black text-slate-600">KPL</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-500">{t.doctor?.name ?? '—'}</td>
                  <td className="px-4 py-3 font-black text-[#0F2B3D]">
                    {editingFee?.id === t.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">₺</span>
                        <input
                          autoFocus
                          value={editingFee.val}
                          onChange={(e) => onEditFee({ id: t.id, val: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') onSaveFee(t); if (e.key === 'Escape') onEditFee(null) }}
                          onBlur={() => onSaveFee(t)}
                          className="w-24 rounded-lg border border-[#2DD4BF] px-2 py-1 text-xs outline-none"
                        />
                      </div>
                    ) : adjusted ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-400 line-through">₺{formatAmount(originalFee)}</span>
                        <span>₺{formatAmount(t.fee)}</span>
                      </span>
                    ) : (
                      <span>₺{formatAmount(t.fee)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditFee({ id: t.id, val: String(t.fee / 100) })}
                        disabled={disabled}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-[#E9FBF8] hover:text-[#0F766E] disabled:opacity-40"
                        title="Ücreti düzenle"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onCancel(t)}
                        disabled={disabled}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600 disabled:opacity-40"
                        title="Sil"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          {selectedTreatmentIds.size > 0 && (
            <div className="flex items-center gap-3 border-t border-[#EEF2F6] bg-[#F8FAFC] px-5 py-3">
              <span className="text-xs font-black text-[#0F2B3D]">{selectedTreatmentIds.size} tedavi seçildi</span>
              <button
                onClick={onBulkDelete}
                disabled={disabled}
                className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-40"
              >
                Seçilenleri Sil
              </button>
            </div>
          )}
        </div>
      )}

      {closedTreatments.length > 0 && !showClosed && visibleTreatments.length > 0 && (
        <button
          type="button"
          onClick={toggleClosedTreatments}
          className="flex w-full items-center justify-center border-t border-[#EEF2F6] bg-[#FAFBFC] px-5 py-2.5 text-[11px] font-bold text-slate-400 transition hover:bg-slate-50 hover:text-[#0F766E]"
        >
          {closedTreatments.length} kapalı kayıt gizleniyor, göstermek için tıklayın
        </button>
      )}

      <div className="flex flex-col gap-3 border-t border-[#EEF2F6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Açık Tedavi Toplamı</p>
          <p className="mt-0.5 text-lg font-black text-[#0F2B3D]">₺{formatAmount(openTotal)}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdjustment((current) => !current)}
          disabled={disabled || openTreatments.length === 0 || openTotal <= 0}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#5FD3C1] bg-white px-4 text-xs font-black text-[#0F766E] transition hover:bg-[#E9FBF8] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconRotate />
          Yuvarla / İndirim
        </button>
      </div>

      {showAdjustment && (
        <div className="border-t border-[#BFEFE8] bg-[#F4FFFD] px-5 py-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Mevcut Toplam</p>
                <p className="mt-1 text-xl font-black text-[#0F2B3D]">₺{formatAmount(openTotal)}</p>
              </div>

              <div>
                <span className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-400">Değişiklik Türü</span>
                <div className="inline-flex rounded-xl border border-[#D9E4EA] bg-white p-1">
                  <button
                    type="button"
                    onClick={() => { setAdjustmentType('percent'); setAdjustmentValue('10') }}
                    className={`rounded-lg px-3 py-2 text-xs font-black transition ${adjustmentType === 'percent' ? 'bg-[#142536] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    Yüzde
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAdjustmentType('fixed'); setAdjustmentValue(String(openTotal / 100)) }}
                    className={`rounded-lg px-3 py-2 text-xs font-black transition ${adjustmentType === 'fixed' ? 'bg-[#142536] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    Sabit Tutar
                  </button>
                </div>
              </div>

              {adjustmentType === 'percent' ? (
                <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-black text-slate-500">Oran (%)</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={adjustmentValue}
                      onChange={(event) => setAdjustmentValue(event.target.value)}
                      className="h-11 w-full rounded-xl border border-[#D9E4EA] bg-white px-3 text-sm font-black text-[#142536] outline-none focus:border-[#2DD4BF]"
                    />
                  </label>
                  <div>
                    <span className="mb-1.5 block text-[11px] font-black text-slate-500">Yön</span>
                    <div className="inline-flex h-11 rounded-xl border border-[#D9E4EA] bg-white p-1">
                      <button type="button" onClick={() => setAdjustmentDirection('discount')} className={`rounded-lg px-3 text-xs font-black ${adjustmentDirection === 'discount' ? 'bg-[#E9FBF8] text-[#0F766E]' : 'text-slate-500'}`}>İndirim</button>
                      <button type="button" onClick={() => setAdjustmentDirection('increase')} className={`rounded-lg px-3 text-xs font-black ${adjustmentDirection === 'increase' ? 'bg-[#FFF7E6] text-[#B45309]' : 'text-slate-500'}`}>Artırım</button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="block max-w-xs">
                  <span className="mb-1.5 block text-[11px] font-black text-slate-500">Yeni Toplam (₺)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={adjustmentValue}
                    onChange={(event) => setAdjustmentValue(event.target.value)}
                    className="h-11 w-full rounded-xl border border-[#D9E4EA] bg-white px-3 text-sm font-black text-[#142536] outline-none focus:border-[#2DD4BF]"
                  />
                </label>
              )}
            </div>

            <div className="rounded-[18px] border border-[#BFEFE8] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Önizleme</p>
              <div className="mt-3 flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-bold text-slate-400">₺{formatAmount(openTotal)}</span>
                <span className="text-slate-300">→</span>
                <span className={`text-xl font-black ${adjustmentValid ? 'text-[#0F766E]' : 'text-red-500'}`}>
                  ₺{formatAmount(Math.max(previewTotal, 0))}
                </span>
              </div>
              {adjustmentValid && previewDifference !== 0 && (
                <p className={`mt-1 text-xs font-black ${previewDifference < 0 ? 'text-green-600' : 'text-amber-600'}`}>
                  {previewDifference < 0 ? '-' : '+'}₺{formatAmount(Math.abs(previewDifference))}
                </p>
              )}
              <p className="mt-4 rounded-xl bg-[#FAFBFC] px-3 py-3 text-xs font-semibold leading-5 text-slate-500">
                Her açık tedavinin ücreti, ilk tarife fiyatı temel alınarak orantısal güncellenecek.
              </p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setShowAdjustment(false)} className="flex-1 rounded-xl border border-[#E7ECF2] bg-white px-3 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-50">İptal</button>
                <button type="button" onClick={handleApplyAdjustment} disabled={disabled || !adjustmentValid} className="flex-1 rounded-xl bg-[#0F766E] px-3 py-2.5 text-xs font-black text-white hover:bg-[#0B5F59] disabled:opacity-40">Uygula</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export function IconEye() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.1 12a10 10 0 0 1 19.8 0 10 10 0 0 1-19.8 0Z" /><circle cx="12" cy="12" r="3" /></svg>
}
export function IconRotate() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></svg>
}
export function IconPrint() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
}
