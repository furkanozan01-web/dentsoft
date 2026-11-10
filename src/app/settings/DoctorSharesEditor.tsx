'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { addDoctorShare, updateDoctorShare, deleteDoctorShare } from './actions'
import { ErrBox, IconPlus } from './SettingsSharedUI'
import type { Branch, DoctorShare, R } from './types'
import { IconPencil, IconTrash } from './disHekimiShared'

export const SHARE_TYPE_LABEL: Record<string, string> = {
  profit_distribution: 'Kâr dağıtımı',
  expense: 'Gider',
  partner_payment: 'Ortak ödeme hareketi',
}
export const SHARE_PERIOD_LABEL: Record<string, string> = { monthly: 'Aylık', quarterly: '3 Aylık', yearly: 'Yıllık' }
export function DoctorSharesEditor({ doctorId, shares, branches, onChanged }: { doctorId: number; shares: DoctorShare[]; branches: Branch[]; onChanged: () => void }) {
  const confirm = useConfirm()
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [delPending, startDel] = useTransition()
  const branchName = (id: number) => branches.find((b) => b.id === id)?.name ?? `Şube #${id}`

  const handleDelete = async (share: DoctorShare) => {
    const ok = await confirm({ title: 'Hisseyi Sil', message: `${branchName(share.branch_id)} şubesindeki %${(share.rate_bps / 100).toLocaleString('tr-TR')} hissesi silinecek. Devam edilsin mi?`, confirmText: 'Evet' })
    if (!ok) return
    startDel(async () => {
      const res = await deleteDoctorShare(share.id)
      if ((res as R)?.error) toast.error((res as R)!.error!)
      else { toast.success('Hisse silindi'); onChanged() }
    })
  }

  return (
    <div className="mt-3 space-y-2">
      {shares.length === 0 && editingId !== 'new' && (
        <p className="text-xs font-semibold text-rose-700/70">Henüz şube hissesi tanımlanmadı.</p>
      )}
      {shares.map((share) =>
        editingId === share.id ? (
          <DoctorShareRowEditor key={share.id} doctorId={doctorId} share={share} branches={branches} onCancel={() => setEditingId(null)} onSaved={() => { setEditingId(null); onChanged() }} />
        ) : (
          <div key={share.id} className="flex items-center justify-between gap-3 rounded-xl border border-rose-200/70 bg-white px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#142536]">{branchName(share.branch_id)} · %{(share.rate_bps / 100).toLocaleString('tr-TR')}</p>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">
                {SHARE_PERIOD_LABEL[share.period] ?? share.period} · {SHARE_TYPE_LABEL[share.profit_distribution_type] ?? share.profit_distribution_type}
                {(share.start_date || share.end_date) && ` · ${share.start_date ?? '…'} – ${share.end_date ?? '…'}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={() => setEditingId(share.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Düzenle"><IconPencil /></button>
              <button type="button" onClick={() => handleDelete(share)} disabled={delPending} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40" title="Sil"><IconTrash /></button>
            </div>
          </div>
        )
      )}
      {editingId === 'new' ? (
        <DoctorShareRowEditor doctorId={doctorId} share={null} branches={branches} onCancel={() => setEditingId(null)} onSaved={() => { setEditingId(null); onChanged() }} />
      ) : (
        <button type="button" onClick={() => setEditingId('new')} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-black text-rose-700 transition hover:bg-rose-100"><IconPlus />Şube Hissesi Ekle</button>
      )}
    </div>
  )
}
export function DoctorShareRowEditor({ doctorId, share, branches, onCancel, onSaved }: { doctorId: number; share: DoctorShare | null; branches: Branch[]; onCancel: () => void; onSaved: () => void }) {
  const isNew = !share
  const [branchId, setBranchId] = useState(String(share?.branch_id ?? branches.find((b) => b.is_default)?.id ?? ''))
  const [rateStr, setRateStr] = useState(share?.rate_bps ? String(share.rate_bps / 100) : '')
  const [startDate, setStartDate] = useState(share?.start_date ?? '')
  const [endDate, setEndDate] = useState(share?.end_date ?? '')
  const [period, setPeriod] = useState(share?.period ?? 'monthly')
  const [type, setType] = useState(share?.profit_distribution_type ?? 'profit_distribution')
  const [note, setNote] = useState(share?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30'

  const submit = () => {
    setError(null)
    const payload = {
      branch_id: branchId ? Number(branchId) : 0,
      rate_bps: Math.round((parseFloat(rateStr.replace(',', '.')) || 0) * 100),
      start_date: startDate || null,
      end_date: endDate || null,
      period,
      profit_distribution_type: type,
      note: note || null,
    }
    startTransition(async () => {
      const res = isNew ? await addDoctorShare(doctorId, payload) : await updateDoctorShare(share!.id, payload)
      if ((res as R)?.error) { setError((res as R)!.error!); toast.error((res as R)!.error!); return }
      toast.success(isNew ? 'Hisse eklendi' : 'Hisse güncellendi')
      onSaved()
    })
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-white p-3">
      {error && <div className="mb-3"><ErrBox msg={error} /></div>}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-bold text-slate-500">Şube<select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={`mt-1.5 ${inputCls}`}><option value="">Seçin</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-500">Hisse oranı (%)<input value={rateStr} onChange={(e) => setRateStr(e.target.value)} placeholder="0" className={`mt-1.5 ${inputCls}`} /></label>
        <label className="text-xs font-bold text-slate-500">Hesaplama dönemi<select value={period} onChange={(e) => setPeriod(e.target.value)} className={`mt-1.5 ${inputCls}`}><option value="monthly">Aylık</option><option value="quarterly">3 Aylık</option><option value="yearly">Yıllık</option></select></label>
        <label className="text-xs font-bold text-slate-500">Başlangıç<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`mt-1.5 ${inputCls}`} /></label>
        <label className="text-xs font-bold text-slate-500">Bitiş<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`mt-1.5 ${inputCls}`} /></label>
        <label className="text-xs font-bold text-slate-500">Muhasebe sınıfı<select value={type} onChange={(e) => setType(e.target.value)} className={`mt-1.5 ${inputCls}`}><option value="profit_distribution">Kâr dağıtımı</option><option value="expense">Gider</option><option value="partner_payment">Ortak ödeme hareketi</option></select></label>
        <label className="text-xs font-bold text-slate-500 md:col-span-2 lg:col-span-3">Açıklama<input value={note} onChange={(e) => setNote(e.target.value)} className={`mt-1.5 ${inputCls}`} /></label>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50">İptal</button>
        <button type="button" onClick={submit} disabled={pending} className="rounded-lg bg-[#2DD4BF] px-3 py-1.5 text-xs font-bold text-[#0F2B3D] hover:bg-[#26b8a5] disabled:opacity-60">{pending ? 'Kaydediliyor…' : 'Kaydet'}</button>
      </div>
    </div>
  )
}
