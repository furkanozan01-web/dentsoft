'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'
import { addBranch, setActiveBranch, updateBranch } from './actions'
import type { Branch } from './types'

export default function BranchManager({ branches, activeBranchId, canManage, onChanged }: {
  branches: Branch[]
  activeBranchId: number | null
  canManage: boolean
  onChanged: () => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [addError, setAddError] = useState<string | undefined>()
  const [addPending, startAdd] = useTransition()
  const [switching, startSwitch] = useTransition()
  const createBranch = (formData: FormData) => startAdd(async () => {
    const result = await addBranch(null, formData)
    if (result?.error) setAddError(result.error)
    else { toast.success('Şube eklendi'); setShowAdd(false); setAddError(undefined); onChanged() }
  })

  const switchBranch = (value: string) => startSwitch(async () => {
    const result = await setActiveBranch(value === 'all' ? null : Number(value))
    if (result?.error) toast.error(result.error)
    else { toast.success(value === 'all' ? 'Tüm şubeler görünümü açıldı' : 'Aktif şube değiştirildi'); onChanged() }
  })

  return <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-base font-black text-[#142536]">Şube Yönetimi</h2><p className="mt-1 text-sm font-medium text-slate-400">Aktif şubeyi seçin veya klinik çatısına yeni şube ekleyin.</p></div>
      <div className="flex flex-wrap gap-2">
        <select disabled={switching} value={activeBranchId ?? 'all'} onChange={(event) => switchBranch(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600">
          {canManage && <option value="all">Tüm Şubeler</option>}
          {branches.filter((branch) => branch.is_active).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
        {canManage && <button onClick={() => setShowAdd(true)} className="h-11 rounded-xl bg-[#1EAEA0] px-4 text-sm font-black text-white">Şube Ekle</button>}
      </div>
    </div>
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {branches.map((branch) => <button key={branch.id} onClick={() => canManage && setEditing(branch)} className={`rounded-[18px] border p-4 text-left transition ${activeBranchId === branch.id ? 'border-[#2DD4BF] bg-[#E9FBF8]' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
        <div className="flex items-start justify-between gap-3"><div><p className="font-black text-[#142536]">{branch.name}</p><p className="mt-1 text-xs font-bold text-slate-400">{branch.code} · {branch.unit_count} ünit</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${branch.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{branch.is_active ? 'Aktif' : 'Pasif'}</span></div>
        <p className="mt-3 line-clamp-2 text-xs font-semibold text-slate-500">{branch.address || 'Adres tanımlı değil'}</p>
        <p className="mt-2 text-xs font-semibold text-slate-400">{branch.authorized_person || 'Yetkili tanımlı değil'} · {branch.work_start.slice(0,5)}–{branch.work_end.slice(0,5)}</p>
      </button>)}
    </div>
    {showAdd && <BranchModal title="Yeni Şube" pending={addPending} error={addError} onClose={() => setShowAdd(false)}><form action={createBranch}><BranchFields /><ModalActions pending={addPending} onClose={() => setShowAdd(false)} /></form></BranchModal>}
    {editing && <EditBranchModal branch={editing} onClose={() => setEditing(null)} onSuccess={() => { setEditing(null); onChanged() }} />}
  </section>
}

function EditBranchModal({ branch, onClose, onSuccess }: { branch: Branch; onClose: () => void; onSuccess: () => void }) {
  const [pending, start] = useTransition()
  const save = (formData: FormData) => start(async () => {
    const result = await updateBranch(branch.id, {
      name: String(formData.get('name') ?? ''), code: String(formData.get('code') ?? ''),
      phone: String(formData.get('phone') ?? ''), email: String(formData.get('email') ?? ''),
      address: String(formData.get('address') ?? ''), authorizedPerson: String(formData.get('authorized_person') ?? ''),
      unitCount: Number(formData.get('unit_count')), workStart: String(formData.get('work_start') ?? ''),
      workEnd: String(formData.get('work_end') ?? ''), bankAccounts: String(formData.get('bank_accounts') ?? ''),
      cashAccounts: String(formData.get('cash_accounts') ?? ''), isActive: formData.get('is_active') === 'on',
    })
    if (result?.error) toast.error(result.error); else { toast.success('Şube güncellendi'); onSuccess() }
  })
  return <BranchModal title="Şubeyi Düzenle" pending={pending} onClose={onClose}><form action={save}><BranchFields branch={branch} /><ModalActions pending={pending} onClose={onClose} /></form></BranchModal>
}

function BranchModal({ title, error, onClose, children }: { title: string; pending: boolean; error?: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="Kapat" /><div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[24px] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><h3 className="font-black text-[#142536]">{title}</h3><button onClick={onClose} className="h-8 w-8 rounded-lg bg-slate-100">×</button></div>{error && <p className="mx-6 mt-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}{children}</div></div>
}

function BranchFields({ branch }: { branch?: Branch }) {
  const field = 'mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#2DD4BF]'
  return <div className="grid gap-4 p-6 sm:grid-cols-2">
    <Field label="Şube adı *" name="name" value={branch?.name} cls={field}/><Field label="Şube kodu *" name="code" value={branch?.code} cls={field}/>
    <Field label="Telefon" name="phone" value={branch?.phone} cls={field}/><Field label="E-posta" name="email" type="email" value={branch?.email} cls={field}/>
    <Field label="Yetkili kişi" name="authorized_person" value={branch?.authorized_person} cls={field}/><Field label="Ünit sayısı" name="unit_count" type="number" value={String(branch?.unit_count ?? 1)} cls={field}/>
    <Field label="Çalışma başlangıcı" name="work_start" type="time" value={branch?.work_start?.slice(0,5) ?? '09:00'} cls={field}/><Field label="Çalışma bitişi" name="work_end" type="time" value={branch?.work_end?.slice(0,5) ?? '18:00'} cls={field}/>
    <Field label="Banka hesapları" name="bank_accounts" value={branch?.bank_accounts} cls={field}/><Field label="Kasa bilgileri" name="cash_accounts" value={branch?.cash_accounts} cls={field}/>
    <label className="text-xs font-black text-slate-500 sm:col-span-2">Adres<textarea name="address" defaultValue={branch?.address ?? ''} className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-[#2DD4BF]" /></label>
    <label className="flex items-center gap-2 text-sm font-bold text-slate-600 sm:col-span-2"><input type="checkbox" name="is_active" defaultChecked={branch?.is_active ?? true} />Aktif şube</label>
  </div>
}

function Field({ label, name, type='text', value, cls }: { label:string; name:string; type?:string; value?:string|null; cls:string }) { return <label className="text-xs font-black text-slate-500">{label}<input name={name} type={type} min={type==='number'?1:undefined} required={label.includes('*')} defaultValue={value ?? ''} className={cls}/></label> }
function ModalActions({ pending, onClose }: { pending:boolean; onClose:()=>void }) { return <div className="flex gap-3 border-t border-slate-100 p-6"><button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-200 font-black text-slate-500">İptal</button><button disabled={pending} className="h-11 flex-1 rounded-xl bg-[#1EAEA0] font-black text-white disabled:opacity-50">{pending?'Kaydediliyor…':'Kaydet'}</button></div> }
