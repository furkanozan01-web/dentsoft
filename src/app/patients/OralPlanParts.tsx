'use client'

import type { TreatmentPlan, TreatmentPlanItem } from './types'

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
}) {
  const items = currentPlan?.items ?? []
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
                  {!isDiyagnoz && item.fee > 0 && (
                    <span className="text-xs font-bold text-[#0F766E]">
                      ₺{(item.fee / 100).toLocaleString('tr-TR')}
                      {item.discount_rate > 0 && (
                        <span className="ml-1.5 text-slate-400">(%{(item.discount_rate / 10).toFixed(1)} indirim)</span>
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

          {/* Kopyalama araç çubuğu */}
          {selectedItemIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#EEF2F6] bg-[#F8FAFC] px-5 py-3">
              <span className="text-xs font-black text-[#0F2B3D]">{selectedItemIds.size} kalem seçildi →</span>
              <span className="text-xs font-semibold text-slate-500">Kopyala:</span>
              <div className="flex flex-wrap gap-1.5">
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
