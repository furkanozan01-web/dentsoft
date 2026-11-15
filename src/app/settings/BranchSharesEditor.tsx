'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveBranchShares } from './actions'
import { SettingsIconBox } from './SettingsSharedUI'
import type { Branch, Doctor } from './types'

type Row = { doctorId: string; pct: string }

const parsePct = (v: string): number => {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
const fmtPct = (bps: number) => `%${(bps / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`

/**
 * Hissedarlar (şube bazlı): her şubenin hissedarları ve oranları burada belirlenir.
 * Bir şubenin toplamı TAM %100 olmadan kaydedilemez.
 */
export function BranchSharesEditor({
  branches,
  doctors,
  canManage,
  onSaved,
}: {
  branches: Branch[]
  doctors: Doctor[]
  canManage: boolean
  onSaved: () => void
}) {
  const active = branches.filter((b) => b.is_active)
  return (
    <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex items-start gap-3">
        <SettingsIconBox><IconPie /></SettingsIconBox>
        <div>
          <h2 className="text-base font-black text-[#142536]">Hissedarlar (Şube Bazlı)</h2>
          <p className="mt-1 text-sm font-medium text-slate-400">
            Her şubenin hissedarlarını ve oranlarını belirleyin. Bir şubenin toplamı tam %100 olmalıdır. Kasa → Kâr Payı Öde bu oranlarla dağıtır.
          </p>
        </div>
      </div>
      <div className="space-y-4">
        {active.map((b) => (
          <BranchCard key={`${b.id}:${shareKey(b.id, doctors)}`} branch={b} doctors={doctors} canManage={canManage} onSaved={onSaved} />
        ))}
        {active.length === 0 && <p className="text-sm text-slate-400">Aktif şube yok.</p>}
      </div>
    </section>
  )
}

// Kayıt değişince (başka yerden) kartın taslağı sunucudaki değerle yeniden başlasın
function shareKey(branchId: number, doctors: Doctor[]): string {
  return doctors
    .flatMap((d) => d.doctor_shares.filter((s) => s.branch_id === branchId && s.is_active).map((s) => `${d.id}-${s.rate_bps}`))
    .sort()
    .join(',')
}

function BranchCard({ branch, doctors, canManage, onSaved }: { branch: Branch; doctors: Doctor[]; canManage: boolean; onSaved: () => void }) {
  const [pending, startTransition] = useTransition()
  const initial: Row[] = doctors.flatMap((d) =>
    d.doctor_shares
      .filter((s) => s.branch_id === branch.id && s.is_active)
      .map((s) => ({ doctorId: String(d.id), pct: String(s.rate_bps / 100) }))
  )
  const [rows, setRows] = useState<Row[]>(initial)

  const candidates = doctors.filter((d) => d.status !== 'deleted')
  const total = rows.reduce((s, r) => s + parsePct(r.pct), 0)
  const diff = total - 10000
  const valid = rows.length > 0 && diff === 0 && rows.every((r) => r.doctorId && parsePct(r.pct) > 0)
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial)

  const usedIds = new Set(rows.map((r) => r.doctorId))
  const nameOf = (id: string) => candidates.find((d) => String(d.id) === id)?.name ?? ''

  const update = (i: number, patch: Partial<Row>) => setRows((cur) => cur.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const remove = (i: number) => setRows((cur) => cur.filter((_, idx) => idx !== i))
  const add = () => {
    const free = candidates.find((d) => !usedIds.has(String(d.id)))
    if (!free) { toast.error('Eklenecek başka hekim yok'); return }
    const remaining = Math.max(0, 10000 - total)
    setRows((cur) => [...cur, { doctorId: String(free.id), pct: remaining > 0 ? String(remaining / 100) : '' }])
  }
  const save = () => {
    startTransition(async () => {
      const res = await saveBranchShares(branch.id, rows.map((r) => ({ doctor_id: Number(r.doctorId), rate_bps: parsePct(r.pct) })))
      if (res?.error) toast.error(res.error)
      else { toast.success(`${branch.name} hisseleri kaydedildi`); onSaved() }
    })
  }

  const status =
    rows.length === 0 ? { text: 'Hissedar tanımlı değil', cls: 'text-slate-400' }
    : diff === 0 ? { text: 'Toplam %100 ✓', cls: 'text-emerald-600' }
    : diff > 0 ? { text: `Toplam ${fmtPct(total)} — ${fmtPct(diff)} fazla`, cls: 'text-red-600' }
    : { text: `Toplam ${fmtPct(total)} — ${fmtPct(-diff)} eksik`, cls: 'text-amber-600' }

  const inputCls = 'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-[#142536] outline-none focus:border-[#5FD3C1] disabled:bg-slate-50 disabled:text-slate-500'
  return (
    <div className={`rounded-2xl border p-4 ${rows.length > 0 && diff !== 0 ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-slate-50/40'}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-[#142536]">{branch.name}</h3>
        <span className={`text-xs font-black ${status.cls}`}>{status.text}</span>
      </div>

      {rows.length === 0 && <p className="mb-3 text-xs font-semibold text-slate-400">Bu şube için hissedar yok; kâr payı dağıtılamaz. {canManage ? 'Hissedar ekleyin.' : ''}</p>}

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            {canManage ? (
              <select value={r.doctorId} onChange={(e) => update(i, { doctorId: e.target.value })} className={`${inputCls} min-w-0 flex-1`}>
                {candidates.filter((d) => String(d.id) === r.doctorId || !usedIds.has(String(d.id))).map((d) => (
                  <option key={d.id} value={d.id}>Dt. {d.name}{d.status === 'passive' ? ' (pasif)' : ''}</option>
                ))}
              </select>
            ) : (
              <span className="min-w-0 flex-1 text-sm font-bold text-[#142536]">Dt. {nameOf(r.doctorId)}</span>
            )}
            <div className="flex items-center gap-1">
              <input
                value={r.pct}
                onChange={(e) => update(i, { pct: e.target.value })}
                disabled={!canManage}
                inputMode="decimal"
                className={`${inputCls} w-24 text-right`}
                aria-label="Hisse oranı"
              />
              <span className="text-sm font-black text-slate-500">%</span>
            </div>
            {canManage && (
              <button type="button" onClick={() => remove(i)} className="h-10 rounded-xl px-2 text-xs font-black text-slate-400 hover:bg-red-50 hover:text-red-600" title="Hissedarı çıkar">
                Çıkar
              </button>
            )}
          </div>
        ))}
      </div>

      {canManage && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={add} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-[#142536] hover:bg-slate-50">
            + Hissedar Ekle
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !valid || !dirty}
            className="h-9 rounded-xl bg-[#0F2B3D] px-4 text-xs font-black text-white hover:bg-[#14364A] disabled:opacity-40"
            title={!valid ? 'Toplam tam %100 olmalı' : ''}
          >
            {pending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          {dirty && !valid && rows.length > 0 && <span className="text-xs font-semibold text-slate-400">Kaydetmek için toplam tam %100 olmalı.</span>}
        </div>
      )}
    </div>
  )
}

function IconPie() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>
}
