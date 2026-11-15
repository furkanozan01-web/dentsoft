'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { cleanMoney, escapeHtml, formatAmount } from '@/lib/format'
import type { DoctorOption, TreatmentPlan, TreatmentPlanItem } from './types'

/** Kalemin indirimli net ücreti (indirim oranı binde: 100 = %10) */
const netFee = (item: TreatmentPlanItem) => Math.round((item.fee ?? 0) * (1 - (item.discount_rate ?? 0) / 1000))

// ─── Plan kalemi listesi kartı ────────────────────────────────────────────────
export function PlanItemsCard({
  parsedTab,
  currentPlan,
  loadingPlans,
  pending,
  selectedItemIds,
  onToggleItem,
  onRemoveItem,
  onReorder,
  copyTargets,
  onOpenCopyModal,
  doctors,
  patientName,
  clinicName,
  onSelectAll,
  onApplyDiscount,
  onTransfer,
}: {
  parsedTab: { kind: 'diyagnoz' | 'planlama' | 'faz' | 'tedavi'; num: number }
  currentPlan: TreatmentPlan | null
  loadingPlans: boolean
  pending: boolean
  selectedItemIds: Set<number>
  onToggleItem: (id: number) => void
  onRemoveItem: (id: number, name: string) => void
  onReorder: (item: TreatmentPlanItem, dir: 'up' | 'down', all: TreatmentPlanItem[]) => void
  copyTargets: { label: string; type: TreatmentPlan['plan_type']; num: number }[]
  onOpenCopyModal: (type: TreatmentPlan['plan_type'], num: number) => void
  doctors: DoctorOption[]
  patientName: string
  clinicName: string
  onSelectAll: (ids: number[]) => void
  onApplyDiscount: (type: 'percent' | 'fixed', value: number) => void
  /** Seçili kalemleri Tedavi sekmesine aktarır */
  onTransfer: () => void
}) {
  const items = currentPlan?.items ?? []
  const doctorName = new Map(doctors.map((d) => [d.id, d.name]))
  const grossTotal = items.reduce((s, i) => s + (i.fee ?? 0), 0)
  const netTotal = items.reduce((s, i) => s + netFee(i), 0)
  const allIds = items.map((i) => i.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedItemIds.has(id))
  const [showDiscount, setShowDiscount] = useState(false)
  const [discType, setDiscType] = useState<'percent' | 'fixed'>('percent')
  const [discValue, setDiscValue] = useState('10')
  const discNumber = discType === 'percent' ? Number(discValue.replace(',', '.')) : Math.round((Number(cleanMoney(discValue)) || 0) * 100)
  const isFaz = parsedTab.kind === 'faz'
  const isDiyagnoz = parsedTab.kind === 'diyagnoz'
  const tabLabel =
    isDiyagnoz
      ? 'Diyagnoz'
      : parsedTab.kind === 'planlama'
      ? `Planlama ${parsedTab.num}`
      : `Faz ${parsedTab.num}`

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F6] px-5 py-4">
        <div>
          <h2 className="text-base font-black text-[#0F2B3D]">{tabLabel} Kalemleri</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400">{items.length} kalem</p>
        </div>
        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectAll(allIds)}
              className="rounded-xl border border-[#D9E4EA] bg-white px-3 py-1.5 text-[11px] font-black text-[#315164] transition hover:bg-slate-50"
            >
              {allSelected ? 'Seçimi Kaldır' : 'Tümünü Seç'}
            </button>
            {!isDiyagnoz && (
              <button
                type="button"
                onClick={() => printPlan(tabLabel, items, doctorName, patientName, clinicName, grossTotal, netTotal)}
                className="rounded-xl border border-[#D9E4EA] bg-white px-3 py-1.5 text-[11px] font-black text-[#315164] transition hover:bg-slate-50"
              >
                Yazdır
              </button>
            )}
          </div>
        )}
      </div>

      {loadingPlans ? (
        <p className="py-8 text-center text-sm font-medium text-gray-400">Yükleniyor…</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm font-medium text-gray-400">
          Henüz kalem yok. Sağdan bir işlem seçip dişe tıklayın.
        </p>
      ) : (
        <div>
          <ul className="divide-y divide-[#EEF2F6]">
            {items.map((item, idx) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#5FD3C1]/[0.03]">
                <input
                  type="checkbox"
                  checked={selectedItemIds.has(item.id)}
                  onChange={() => onToggleItem(item.id)}
                  className="h-4 w-4 rounded border-slate-300 accent-[#2DD4BF]"
                />
                {isFaz && (
                  <span className="w-5 shrink-0 text-center text-xs font-black text-slate-400">
                    {idx + 1}.
                  </span>
                )}
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-bold text-[#0F2B3D]">
                    {item.tooth_no ? (
                      <span className="mr-1.5 inline-block rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs font-black text-[#142536]">
                        {item.tooth_no}
                      </span>
                    ) : null}
                    {item.treatment_name}
                  </span>
                  {!isDiyagnoz && (item.doctor_id || item.fee > 0) && (
                    <span className="flex flex-wrap items-center gap-x-2 text-xs font-bold text-[#0F766E]">
                      {item.doctor_id && doctorName.get(item.doctor_id) && <span className="font-semibold text-slate-500">Dt. {doctorName.get(item.doctor_id)}</span>}
                      {item.fee > 0 && (
                        <span>
                          {item.discount_rate > 0 && <span className="mr-1 text-slate-400 line-through">₺{formatAmount(item.fee)}</span>}
                          ₺{formatAmount(netFee(item))}
                          {item.discount_rate > 0 && (
                            <span className="ml-1.5 text-slate-400">(%{(item.discount_rate / 10).toFixed(1)} indirim)</span>
                          )}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {isFaz && (
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => onReorder(item, 'up', items)}
                      disabled={pending || idx === 0}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-[#E9FBF8] hover:text-[#0F766E] disabled:opacity-30"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                    </button>
                    <button
                      onClick={() => onReorder(item, 'down', items)}
                      disabled={pending || idx === items.length - 1}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-[#E9FBF8] hover:text-[#0F766E] disabled:opacity-30"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                  </div>
                )}
                <button
                  onClick={() => onRemoveItem(item.id, item.treatment_name)}
                  disabled={pending}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600 disabled:opacity-40"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          {/* Toplam + indirim (Planlama / Faz) */}
          {!isDiyagnoz && grossTotal > 0 && (
            <div className="border-t border-[#EEF2F6] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{tabLabel} Toplamı</p>
                  <p className="mt-0.5 text-lg font-black text-[#0F2B3D]">
                    ₺{formatAmount(netTotal)}
                    {netTotal !== grossTotal && <span className="ml-2 text-xs font-semibold text-slate-400 line-through">₺{formatAmount(grossTotal)}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDiscount((v) => !v)}
                  disabled={pending}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[#5FD3C1] bg-white px-4 text-xs font-black text-[#0F766E] transition hover:bg-[#E9FBF8] disabled:opacity-40"
                >
                  İndirim
                </button>
              </div>
              {showDiscount && (
                <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-[#BFEFE8] bg-[#F4FFFD] p-4">
                  <div className="inline-flex rounded-xl border border-[#D9E4EA] bg-white p-1">
                    <button type="button" onClick={() => { setDiscType('percent'); setDiscValue('10') }} className={`rounded-lg px-3 py-1.5 text-xs font-black ${discType === 'percent' ? 'bg-[#142536] text-white' : 'text-slate-500'}`}>Yüzde</button>
                    <button type="button" onClick={() => { setDiscType('fixed'); setDiscValue(formatAmount(netTotal).replace(/,00$/, '')) }} className={`rounded-lg px-3 py-1.5 text-xs font-black ${discType === 'fixed' ? 'bg-[#142536] text-white' : 'text-slate-500'}`}>Yeni toplam</button>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-black text-slate-500">{discType === 'percent' ? 'İndirim oranı (%)' : 'Yeni toplam (₺)'}</span>
                    <input
                      value={discValue}
                      onChange={(e) => setDiscValue(e.target.value)}
                      inputMode="decimal"
                      {...(discType === 'fixed' ? { 'data-money': '' } : {})}
                      className="h-10 w-40 rounded-xl border border-[#D9E4EA] bg-white px-3 text-sm font-black text-[#142536] outline-none focus:border-[#2DD4BF]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!Number.isFinite(discNumber) || discNumber < 0) { toast.error('Geçerli bir değer girin'); return }
                      onApplyDiscount(discType, discNumber)
                      setShowDiscount(false)
                    }}
                    className="h-10 rounded-xl bg-[#0F766E] px-4 text-xs font-black text-white hover:bg-[#0B5F59]"
                  >
                    Uygula
                  </button>
                  <button type="button" onClick={() => { onApplyDiscount('percent', 0); setShowDiscount(false) }} className="h-10 rounded-xl border border-[#E7ECF2] bg-white px-4 text-xs font-black text-slate-500 hover:bg-slate-50">İndirimi Kaldır</button>
                </div>
              )}
            </div>
          )}

          {/* Kopyalama araç çubuğu */}
          {selectedItemIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#EEF2F6] bg-[#F8FAFC] px-5 py-3">
              <span className="text-xs font-black text-[#0F2B3D]">{selectedItemIds.size} kalem seçildi →</span>
              <span className="text-xs font-semibold text-slate-500">Kopyala:</span>
              <div className="flex flex-wrap gap-1.5">
                {!isDiyagnoz && (
                  <button
                    onClick={onTransfer}
                    className="rounded-full bg-[#0F766E] px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-[#0B5F59]"
                  >
                    Tedavi
                  </button>
                )}
                {copyTargets.map((t) => (
                  <button
                    key={`${t.type}_${t.num}`}
                    onClick={() => onOpenCopyModal(t.type, t.num)}
                    className="rounded-full bg-[#E6FFFA] px-2.5 py-1 text-[11px] font-bold text-[#0F766E] transition hover:bg-[#CCFBF1]"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
// ─── Sekme butonu ─────────────────────────────────────────────────────────────
export function PlanTabBtn({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean
  onClick: () => void
  color: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="relative whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-colors"
      style={
        active
          ? { color, backgroundColor: color + '18' }
          : { color: '#94A3B8' }
      }
    >
      {children}
      {active && (
        <span
          className="absolute inset-x-2 bottom-0.5 h-0.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
    </button>
  )
}

function printPlan(
  title: string,
  items: TreatmentPlanItem[],
  doctorName: Map<number, string>,
  patientName: string,
  clinicName: string,
  gross: number,
  net: number
) {
  const rows = items.map((i, idx) => {
    const itemNet = netFee(i)
    return `<tr><td>${idx + 1}</td><td>${i.tooth_no ?? ''}</td><td>${escapeHtml(i.treatment_name)}</td><td>${i.doctor_id && doctorName.get(i.doctor_id) ? 'Dt. ' + escapeHtml(doctorName.get(i.doctor_id)) : ''}</td><td style="text-align:right">${i.fee > 0 ? '₺' + formatAmount(i.fee) : ''}</td><td style="text-align:right">${i.discount_rate > 0 ? '%' + (i.discount_rate / 10).toFixed(1) : ''}</td><td style="text-align:right">${i.fee > 0 ? '₺' + formatAmount(itemNet) : ''}</td></tr>`
  }).join('')
  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(title)} - ${escapeHtml(patientName)}</title>
  <style>body{font-family:'Segoe UI',system-ui,sans-serif;color:#1e293b;padding:32px;max-width:820px;margin:0 auto}h2{margin:0;color:#0f2b3d}.muted{color:#64748b;font-size:13px;margin:2px 0 16px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left}th{color:#64748b;font-size:11px;text-transform:uppercase}.tot{margin-top:14px;margin-left:auto;width:280px;font-size:14px}.tot div{display:flex;justify-content:space-between;padding:3px 0}.tot .g{font-weight:700;border-top:2px solid #0f2b3d;margin-top:4px;padding-top:8px}</style></head><body>
  <h2>${escapeHtml(clinicName)}</h2><p class="muted">${escapeHtml(title)} · Hasta: ${escapeHtml(patientName)} · ${new Date().toLocaleDateString('tr-TR')}</p>
  <table><thead><tr><th>#</th><th>Diş</th><th>İşlem</th><th>Hekim</th><th style="text-align:right">Ücret</th><th style="text-align:right">İndirim</th><th style="text-align:right">Net</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="tot"><div><span>Toplam</span><span>₺${formatAmount(gross)}</span></div><div><span>İndirim</span><span>₺${formatAmount(gross - net)}</span></div><div class="g"><span>Genel Toplam</span><span>₺${formatAmount(net)}</span></div></div>
  </body></html>`
  const w = window.open('', '_blank', 'width=900,height=900')
  if (!w) { toast.error('Yazdırma penceresi açılamadı. Açılır pencere engelini kontrol edin.'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 250)
}
