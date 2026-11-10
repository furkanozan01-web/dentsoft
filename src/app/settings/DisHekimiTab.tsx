'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { deleteDoctor } from './actions'
import { PAYMENT_MODEL_LABEL } from './constants'
import {
  SettingsIconBox,
  IconAlert,
  IconUsers,
  IconCheckCircle,
  IconPlus,
  IconClipboard,
} from './SettingsSharedUI'
import type { Branch, Doctor, R } from './types'
import { IconPencil, IconTrash } from './disHekimiShared'
import { DoctorEditor } from './DoctorEditor'

export default function DisHekimiTab({ doctors, branches, isAdmin, onChanged }: { doctors: Doctor[]; branches: Branch[]; isAdmin: boolean; onChanged: () => void }) {
  const confirm = useConfirm()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [mode, setMode] = useState<'none' | 'new' | 'edit'>('none')
  const [delPending, startDel] = useTransition()

  const selected = doctors.find((d) => d.id === selectedId) ?? null
  const activeDoctors = doctors.filter((d) => d.status === 'active')
  const undefinedModelCount = doctors.filter((d) => !d.payment_model).length

  const openNew = () => { setSelectedId(null); setMode('new') }
  const openEdit = (d: Doctor) => { setSelectedId(d.id); setMode('edit') }
  const closeEditor = () => { setMode('none'); setSelectedId(null) }

  const handleDelete = async (d: Doctor) => {
    const ok = await confirm({
      title: 'Hekimi Pasife Al',
      message: 'Dt. ' + d.name + ' pasife alınacak (kayıt silinmez). Devam edilsin mi?',
      confirmText: 'Evet',
    })
    if (!ok) return
    const fd = new FormData()
    fd.set('id', String(d.id))
    startDel(async () => {
      const res = await deleteDoctor(null, fd)
      if ((res as R)?.error) toast.error((res as R)!.error!)
      else {
        toast.success('Hekim pasife alındı')
        if (selectedId === d.id) closeEditor()
        onChanged()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DoctorStatCard title="Toplam Hekim" value={doctors.length} tone="blue" icon={<IconUsers />} />
        <DoctorStatCard title="Aktif Hekim" value={activeDoctors.length} tone="green" icon={<IconCheckCircle />} />
        <DoctorStatCard title="Model Tanımsız" value={undefinedModelCount} tone="amber" icon={<IconAlert />} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <section className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 border-b border-[#EEF2F6] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <SettingsIconBox><IconUsers /></SettingsIconBox>
              <div>
                <h2 className="text-base font-black text-[#142536]">Diş Hekimleri</h2>
                <p className="mt-1 text-sm font-medium text-slate-400">Klinikte görev yapan hekimler ve ödeme modelleri</p>
              </div>
            </div>
            <button onClick={openNew} className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:-translate-y-0.5 hover:brightness-105">
              <IconPlus />
              Hekim Ekle
            </button>
          </div>

          {doctors.length === 0 ? (
            <div className="p-6">
              <div className="flex min-h-60 flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-[#FAFBFC] px-6 text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#0F766E] shadow-[0_10px_24px_rgba(15,23,42,0.06)]"><IconUsers /></span>
                <h3 className="text-sm font-black text-[#142536]">Henüz diş hekimi eklenmemiş.</h3>
                <p className="mt-1 max-w-md text-xs font-semibold leading-5 text-slate-400">Hekim ekleyerek randevu, tedavi ve hakediş takibini başlatabilirsiniz.</p>
                <button onClick={openNew} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)]"><IconPlus />Hekim Ekle</button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-[#FAFBFC]">
                  <tr className="h-14 border-b border-[#EEF2F6] text-slate-400">
                    <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Ad Soyad</th>
                    <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Uzmanlık</th>
                    <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Ödeme Modeli</th>
                    <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Durum</th>
                    <th className="px-5 text-right text-xs font-black uppercase tracking-wide">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((d, index) => {
                    const isSel = selectedId === d.id
                    const isActive = d.status === 'active'
                    const hasCommission = d.payment_model === 'commission' || d.payment_model === 'hybrid'
                    const modelLabel = d.payment_model ? PAYMENT_MODEL_LABEL[d.payment_model] ?? d.payment_model : 'Tanımsız'
                    const rowClass = 'h-20 cursor-pointer border-b border-[#EEF2F6] transition last:border-0 hover:bg-[#5FD3C1]/[0.04] ' + (isSel ? 'bg-[#5FD3C1]/[0.08] ' : '') + (!isActive ? 'opacity-65' : '')
                    return (
                      <tr key={d.id} onClick={() => openEdit(d)} className={rowClass}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black text-white shadow-sm" style={{ background: d.color ?? (index % 2 === 0 ? 'linear-gradient(135deg,#60A5FA,#7C3AED)' : 'linear-gradient(135deg,#5FD3C1,#0284C7)') }}>{d.name[0]}</div>
                            <div className="min-w-0"><p className="truncate font-black text-[#142536]">Dt. {d.name}</p><p className="mt-0.5 truncate text-xs font-semibold text-slate-400">{d.specialty || 'Uzmanlık belirtilmedi'}</p></div>
                          </div>
                        </td>
                        <td className="px-5 py-4"><span className="inline-flex rounded-full bg-[#F1F5F9] px-3 py-1.5 text-xs font-bold text-slate-600">{d.specialty || 'Belirtilmedi'}</span></td>
                        <td className="px-5 py-4">
                          {d.payment_model ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3E8FF] px-3 py-1.5 text-xs font-black text-[#7C3AED]"><IconPercent />{modelLabel}{hasCommission && ' · %' + ((d.commission_rate_bps ?? 0) / 100).toLocaleString('tr-TR')}</span>
                          ) : (
                            <div className="space-y-1"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7E6] px-3 py-1.5 text-xs font-black text-[#B45309]"><IconAlert />Tanımsız</span><p className="text-[11px] font-semibold text-[#B45309]">Hakediş hesaplanamaz.</p></div>
                          )}
                        </td>
                        <td className="px-5 py-4"><span className={'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ' + (isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500')}><span className={'h-2 w-2 rounded-full ' + (isActive ? 'bg-green-500' : 'bg-slate-400')} />{isActive ? 'Aktif' : 'Pasif'}</span></td>
                        <td className="px-5 py-4"><div className="flex items-center justify-end gap-2"><button onClick={(e) => { e.stopPropagation(); openEdit(d) }} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-[#E6FFFA] hover:text-[#0F766E]" title="Düzenle"><IconPencil /></button><button onClick={(e) => { e.stopPropagation(); handleDelete(d) }} disabled={delPending} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40" title="Pasife al"><IconTrash /></button></div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-col gap-2 border-t border-[#EEF2F6] px-6 py-4 text-xs font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Toplam {doctors.length} hekim listeleniyor</span><span>Model tanımsız: {undefinedModelCount}</span></div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[24px] border border-[#FED7AA] bg-[#FFF7E6] p-5 text-[#B45309] shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70"><IconAlert /></span><div><h3 className="text-sm font-black">Hakediş Durumu</h3><p className="mt-1 text-xs font-semibold leading-5">{undefinedModelCount > 0 ? undefinedModelCount + ' hekimde ödeme modeli tanımsız.' : 'Tüm hekimlerde ödeme modeli tanımlı.'}</p></div></div>
            <p className="text-xs font-semibold leading-5">Hakediş hesaplaması için her hekime ödeme modeli tanımlanmalıdır.</p>
          </section>
          <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-start gap-3"><SettingsIconBox><IconWallet /></SettingsIconBox><div><h3 className="text-base font-black text-[#142536]">Ödeme Modeli Türleri</h3><p className="mt-1 text-xs font-semibold text-slate-400">Finans hakediş ekranında bu modele göre hesaplanır.</p></div></div>
            <div className="space-y-3"><PaymentInfoRow title="Sabit Maaş" description="Aylık sabit tutar üzerinden takip edilir." icon={<IconWallet />} /><PaymentInfoRow title="Komisyon" description="Ciro veya net kâr oranına göre hesaplanır." icon={<IconPercent />} /><PaymentInfoRow title="Karma Model" description="Maaş ve komisyon birlikte kullanılır." icon={<IconClipboard />} /></div>
          </section>
        </aside>
      </div>

      {mode !== 'none' && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button type="button" aria-label="Düzenleyiciyi kapat" onClick={closeEditor} className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" /><div className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl shadow-2xl"><DoctorEditor key={mode === 'edit' ? selected?.id ?? 'edit' : 'new'} doctor={mode === 'edit' ? selected : null} branches={branches} isAdmin={isAdmin} onCancel={closeEditor} onSaved={() => { closeEditor(); onChanged() }} onSharesChanged={onChanged} /></div></div>}
    </div>
  )
}
function DoctorStatCard({ title, value, tone, icon }: { title: string; value: number; tone: 'blue' | 'green' | 'amber'; icon: ReactNode }) {
  const toneClass = { blue: 'bg-[#EAF7FF] text-[#0284C7]', green: 'bg-green-50 text-green-600', amber: 'bg-amber-50 text-amber-600' }[tone]
  return <div className="rounded-[20px] border border-[#E7ECF2] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><span className={'mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ' + toneClass}>{icon}</span><p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p><p className="mt-1 text-3xl font-black text-[#142536]">{value}</p></div>
}
function PaymentInfoRow({ title, description, icon }: { title: string; description: string; icon: ReactNode }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-[#EEF2F6] bg-[#FAFBFC] px-4 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#0F766E] shadow-[0_8px_18px_rgba(15,23,42,0.04)]">{icon}</span><span><strong className="block text-sm font-black text-[#142536]">{title}</strong><span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-400">{description}</span></span></div>
}
function IconPercent() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg> }
function IconWallet() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" /><path d="M18 12h.01" /></svg> }
