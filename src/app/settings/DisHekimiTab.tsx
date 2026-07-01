'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { parseToKurus } from '@/lib/format'
import { addDoctor, updateDoctor, deleteDoctor, toggleMesulMudur } from './actions'
import { PAYMENT_MODEL_LABEL, SPECIALTIES, DAYS } from './constants'
import { emptyWorkHours } from './helpers'
import { ErrBox, SettingsIconBox, IconAlert, IconUsers, IconCheckCircle, IconPlus, IconClipboard } from './SettingsSharedUI'
import type { Branch, DayHours, Doctor, R } from './types'

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

      {mode !== 'none' && (<DoctorEditor key={mode === 'edit' ? selected?.id ?? 'edit' : 'new'} doctor={mode === 'edit' ? selected : null} branches={branches} isAdmin={isAdmin} onCancel={closeEditor} onSaved={() => { closeEditor(); onChanged() }} />)}
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
function IconPencil() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg> }
function IconTrash() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5" /><path d="M14 11v5" /></svg> }
function IconWallet() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" /><path d="M18 12h.01" /></svg> }

function DoctorEditor({
  doctor,
  branches,
  isAdmin,
  onCancel,
  onSaved,
}: {
  doctor: Doctor | null
  branches: Branch[]
  isAdmin: boolean
  onCancel: () => void
  onSaved: () => void
}) {
  const isNew = !doctor
  const existingNameParts = (doctor?.name ?? '').trim().split(/\s+/).filter(Boolean)
  const [firstName, setFirstName] = useState(existingNameParts.length > 1 ? existingNameParts.slice(0, -1).join(' ') : existingNameParts[0] ?? '')
  const [surname, setSurname] = useState(existingNameParts.length > 1 ? existingNameParts.at(-1) ?? '' : '')
  const [title, setTitle] = useState(doctor?.title ?? 'Diş Hekimi')
  const [specialty, setSpecialty] = useState(doctor?.specialty ?? '')
  const [phone, setPhone] = useState(doctor?.phone ?? '')
  const [email, setEmail] = useState(doctor?.email ?? '')
  const [diplomaNo, setDiplomaNo] = useState(doctor?.diploma_no ?? '')
  const [tcIdentityNo, setTcIdentityNo] = useState(doctor?.tc_identity_no ?? '')
  const [diplomaDate, setDiplomaDate] = useState(doctor?.diploma_date ?? '')
  const [birthDate, setBirthDate] = useState(doctor?.birth_date ?? '')
  const [status, setStatus] = useState(doctor?.status ?? 'active')
  const [branchId, setBranchId] = useState(String(doctor?.branch_id ?? branches.find((branch) => branch.is_default)?.id ?? ''))
  const [createUserAccount, setCreateUserAccount] = useState(false)
  const [userAccessLevel, setUserAccessLevel] = useState('branch')
  const [isMesulMudur, setIsMesulMudur] = useState(doctor?.is_mesul_mudur ?? false)
  const [salaryStr, setSalaryStr] = useState(
    doctor?.monthly_salary != null ? String(doctor.monthly_salary / 100) : ''
  )
  const [rateStr, setRateStr] = useState(
    doctor?.commission_rate_bps ? String(doctor.commission_rate_bps / 100) : ''
  )
  const [bonusStr, setBonusStr] = useState(doctor?.bonus_amount ? String(doctor.bonus_amount / 100) : '')
  const [guaranteeActive, setGuaranteeActive] = useState(doctor?.guarantee_active ?? false)
  const [guaranteeAmountStr, setGuaranteeAmountStr] = useState(doctor?.guarantee_amount ? String(doctor.guarantee_amount / 100) : '')
  const [guaranteePeriod, setGuaranteePeriod] = useState(doctor?.guarantee_period ?? 'monthly')
  const [guaranteeMethod, setGuaranteeMethod] = useState(doctor?.guarantee_method ?? 'minimum_total')
  const [guaranteeNote, setGuaranteeNote] = useState(doctor?.guarantee_note ?? '')
  const [shareActive, setShareActive] = useState(doctor?.share_active ?? false)
  const [shareRateStr, setShareRateStr] = useState(doctor?.share_rate_bps ? String(doctor.share_rate_bps / 100) : '')
  const [shareStartDate, setShareStartDate] = useState(doctor?.share_start_date ?? '')
  const [shareEndDate, setShareEndDate] = useState(doctor?.share_end_date ?? '')
  const [shareBranchId, setShareBranchId] = useState(String(doctor?.share_branch_id ?? ''))
  const [sharePeriod, setSharePeriod] = useState(doctor?.share_period ?? 'monthly')
  const [shareNote, setShareNote] = useState(doctor?.share_note ?? '')
  const [profitDistributionType, setProfitDistributionType] = useState(doctor?.profit_distribution_type ?? 'profit_distribution')
  const [salaryDay, setSalaryDay] = useState(doctor?.salary_day ? String(doctor.salary_day) : '')
  const [paymentAccount, setPaymentAccount] = useState(doctor?.payment_account ?? '')
  const [hours, setHours] = useState<Record<string, DayHours>>(() => {
    const base = emptyWorkHours()
    const src = doctor?.work_hours_json
    if (src) for (const k of Object.keys(base)) if (src[k]) base[k] = { ...base[k], ...src[k] }
    return base
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const rateBps = Math.round((parseFloat(rateStr.replace(',', '.')) || 0) * 100)
  const shareRateBps = Math.round((parseFloat(shareRateStr.replace(',', '.')) || 0) * 100)

  const setDay = (key: string, patch: Partial<DayHours>) =>
    setHours((h) => ({ ...h, [key]: { ...h[key], ...patch } }))

  const submit = () => {
    if (!firstName.trim() || !surname.trim()) {
      setError('Ad ve soyad zorunludur')
      return
    }
    setError(null)
    const payload = {
      name: `${firstName.trim()} ${surname.trim()}`,
      title: title.trim() || 'Diş Hekimi',
      specialty: specialty || null,
      phone: phone || null,
      email: email || null,
      diploma_no: diplomaNo || null,
      tc_identity_no: tcIdentityNo || null,
      diploma_date: diplomaDate || null,
      birth_date: birthDate || null,
      color: doctor?.color ?? '#3b82f6',
      status,
      branch_id: branchId ? Number(branchId) : null,
      create_user_account: isNew && createUserAccount,
      user_access_level: userAccessLevel,
      payment_model: null,
      monthly_salary: salaryStr ? parseToKurus(salaryStr) : 0,
      commission_rate_bps: rateBps,
      guarantee_amount: guaranteeActive && guaranteeAmountStr ? parseToKurus(guaranteeAmountStr) : 0,
      bonus_amount: bonusStr ? parseToKurus(bonusStr) : 0,
      per_transaction_amount: null,
      guarantee_active: guaranteeActive,
      guarantee_period: guaranteePeriod,
      guarantee_method: guaranteeMethod,
      guarantee_note: guaranteeNote || null,
      share_active: shareActive,
      share_rate_bps: shareRateBps,
      share_start_date: shareStartDate || null,
      share_end_date: shareEndDate || null,
      share_branch_id: shareBranchId ? Number(shareBranchId) : null,
      share_period: sharePeriod,
      share_note: shareNote || null,
      profit_distribution_type: profitDistributionType,
      salary_day: salaryDay ? Number(salaryDay) : null,
      payment_account: paymentAccount || null,
      work_hours_json: hours,
    }
    startTransition(async () => {
      const res = isNew ? await addDoctor(payload) : await updateDoctor(doctor!.id, payload)
      if ((res as R)?.error) {
        setError((res as R)!.error!)
        toast.error((res as R)!.error!)
        return
      }
      toast.success(isNew ? 'Hekim eklendi' : 'Hekim bilgileri kaydedildi')
      onSaved()
    })
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-7">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#0F2B3D]">
          {isNew ? 'Yeni Hekim' : `Dt. ${doctor!.name} — Düzenle`}
        </h2>
        <button type="button" onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      {error && <ErrBox msg={error} />}

      {/* KİŞİSEL BİLGİLER */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Kişisel Bilgiler</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Ad *</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Furkan" className={inputCls} />
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Soyad *</label><input value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Ozancı" className={inputCls} /></div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Uzmanlık</label>
            <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className={inputCls}>
              <option value="">Seçiniz</option>
              {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
              {specialty && !SPECIALTIES.includes(specialty) && <option value={specialty}>{specialty}</option>}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Ünvan</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Diş Hekimi" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Bağlı Şube</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
              <option value="">Şube seçin</option>
              {branches.filter((branch) => branch.is_active).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Telefon</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0555 111 22 33" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">E-posta</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hekim@klinik.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Diploma Numarası</label>
            <input value={diplomaNo} onChange={(e) => setDiplomaNo(e.target.value)} className={inputCls} />
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1.5">T.C. Kimlik Numarası</label><input inputMode="numeric" maxLength={11} value={tcIdentityNo} onChange={(e) => setTcIdentityNo(e.target.value.replace(/\D/g, '').slice(0, 11))} className={inputCls} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Diploma Tarihi</label><input type="date" value={diplomaDate} onChange={(e) => setDiplomaDate(e.target.value)} className={inputCls} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Doğum Tarihi</label><input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} /></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500">Durum:</span>
            <button
              type="button"
              onClick={() => setStatus((s) => (s === 'active' ? 'passive' : 'active'))}
              className={`relative w-11 h-6 rounded-full transition-colors ${status === 'active' ? 'bg-[#2DD4BF]' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${status === 'active' ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-[#0F2B3D]">{status === 'active' ? 'Aktif' : 'Pasif'}</span>
          </div>
          {!isNew && isAdmin && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500">Mesul Müdür:</span>
              <button
                type="button"
                onClick={async () => {
                  const next = !isMesulMudur
                  setIsMesulMudur(next)
                  const res = await toggleMesulMudur(doctor!.id, next)
                  if ((res as { error?: string })?.error) {
                    toast.error((res as { error?: string })!.error!)
                    setIsMesulMudur(!next)
                  } else {
                    toast.success(next ? 'Mesul müdür olarak atandı' : 'Mesul müdür yetkisi kaldırıldı')
                  }
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ${isMesulMudur ? 'bg-violet-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isMesulMudur ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-[#0F2B3D]">{isMesulMudur ? 'Evet' : 'Hayır'}</span>
            </div>
          )}
        </div>
      </section>

      {isNew && (
        <section className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-4">
          <label className="flex items-start gap-3 text-sm font-black text-[#1D4ED8]"><input type="checkbox" checked={createUserAccount} onChange={(e) => setCreateUserAccount(e.target.checked)} className="mt-1" /><span>Bu hekimi aynı zamanda kullanıcı olarak ekle<span className="mt-1 block text-xs font-semibold text-blue-500">Hekimin e-postası giriş izin listesine eklenir ve ilk girişinde hesabı otomatik bağlanır.</span></span></label>
          {createUserAccount && <div className="mt-4"><label className="block text-xs font-medium text-blue-600 mb-1.5">Yetki Seviyesi</label><select value={userAccessLevel} onChange={(e) => setUserAccessLevel(e.target.value)} className={inputCls}><option value="branch">Yalnızca bağlı şube</option><option value="all">Tüm şubeler</option></select></div>}
        </section>
      )}

      {/* HAKEDİŞ MODELİ */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Esnek Hakediş Ayarları</h3>
        <p className="mb-4 text-xs font-semibold text-slate-400">Sistem girilen tutarlara göre sabit, komisyon veya karma modeli otomatik belirler.</p>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><p className="text-xs font-black uppercase text-emerald-700">Sabit Ücret</p><label className="mt-3 block text-xs font-bold text-slate-500">Aylık tutar (₺)<input value={salaryStr} onChange={(e) => setSalaryStr(e.target.value)} placeholder="0" className={`mt-1.5 ${inputCls}`} /></label></div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><p className="text-xs font-black uppercase text-blue-700">Komisyon</p><label className="mt-3 block text-xs font-bold text-slate-500">Tahsilat oranı: %{rateStr || '0'}<input type="range" min="0" max="100" step="0.5" value={rateStr || '0'} onChange={(e) => setRateStr(e.target.value)} className="mt-3 w-full accent-blue-600" /></label><input value={rateStr} onChange={(e) => setRateStr(e.target.value)} placeholder="0" className={`mt-2 ${inputCls}`} /></div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4"><p className="text-xs font-black uppercase text-amber-700">Prim</p><label className="mt-3 block text-xs font-bold text-slate-500">Aylık prim (₺)<input value={bonusStr} onChange={(e) => setBonusStr(e.target.value)} placeholder="0" className={`mt-1.5 ${inputCls}`} /></label></div>
        </div>

        <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
          <label className="flex items-center justify-between gap-3 text-sm font-black text-violet-800"><span>Garantör</span><input type="checkbox" checked={guaranteeActive} onChange={(e) => setGuaranteeActive(e.target.checked)} /></label>
          {guaranteeActive && <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs font-bold text-slate-500">Garantör tutarı (₺)<input value={guaranteeAmountStr} onChange={(e) => setGuaranteeAmountStr(e.target.value)} className={`mt-1.5 ${inputCls}`} /></label><label className="text-xs font-bold text-slate-500">Dönem<select value={guaranteePeriod} onChange={(e) => setGuaranteePeriod(e.target.value)} className={`mt-1.5 ${inputCls}`}><option value="monthly">Aylık</option><option value="quarterly">3 Aylık</option><option value="yearly">Yıllık</option></select></label><label className="text-xs font-bold text-slate-500">Hesaplama yöntemi<select value={guaranteeMethod} onChange={(e) => setGuaranteeMethod(e.target.value)} className={`mt-1.5 ${inputCls}`}><option value="minimum_total">Toplam hakedişi minimuma tamamla</option><option value="commission_only">Komisyon ve primi minimuma tamamla</option></select></label><label className="text-xs font-bold text-slate-500">Açıklama<input value={guaranteeNote} onChange={(e) => setGuaranteeNote(e.target.value)} className={`mt-1.5 ${inputCls}`} /></label></div>}
        </div>

        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
          <label className="flex items-center justify-between gap-3 text-sm font-black text-rose-800"><span>Hisse / Kâr Payı</span><input type="checkbox" checked={shareActive} onChange={(e) => setShareActive(e.target.checked)} /></label>
          {shareActive && <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3"><label className="text-xs font-bold text-slate-500">Hisse oranı (%)<input value={shareRateStr} onChange={(e) => setShareRateStr(e.target.value)} className={`mt-1.5 ${inputCls}`} /></label><label className="text-xs font-bold text-slate-500">Başlangıç<input type="date" value={shareStartDate} onChange={(e) => setShareStartDate(e.target.value)} className={`mt-1.5 ${inputCls}`} /></label><label className="text-xs font-bold text-slate-500">Bitiş<input type="date" value={shareEndDate} onChange={(e) => setShareEndDate(e.target.value)} className={`mt-1.5 ${inputCls}`} /></label><label className="text-xs font-bold text-slate-500">Geçerli şube<select value={shareBranchId} onChange={(e) => setShareBranchId(e.target.value)} className={`mt-1.5 ${inputCls}`}><option value="">Tüm erişilebilir klinik</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="text-xs font-bold text-slate-500">Hesaplama dönemi<select value={sharePeriod} onChange={(e) => setSharePeriod(e.target.value)} className={`mt-1.5 ${inputCls}`}><option value="monthly">Aylık</option><option value="quarterly">3 Aylık</option><option value="yearly">Yıllık</option></select></label><label className="text-xs font-bold text-slate-500">Muhasebe sınıfı<select value={profitDistributionType} onChange={(e) => setProfitDistributionType(e.target.value)} className={`mt-1.5 ${inputCls}`}><option value="profit_distribution">Kâr dağıtımı</option><option value="expense">Gider</option><option value="partner_payment">Ortak ödeme hareketi</option></select></label><label className="text-xs font-bold text-slate-500 md:col-span-2 lg:col-span-3">Açıklama<input value={shareNote} onChange={(e) => setShareNote(e.target.value)} className={`mt-1.5 ${inputCls}`} /></label></div>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Maaş / Hakediş Günü</label>
            <input type="number" min="1" max="31" value={salaryDay} onChange={(e) => setSalaryDay(e.target.value)} placeholder="5" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Ödeme Kasası / Banka</label>
            <input value={paymentAccount} onChange={(e) => setPaymentAccount(e.target.value)} placeholder="Ana Kasa / İş Bankası" className={inputCls} />
          </div>
        </div>

      </section>

      {/* ÇALIŞMA SAATLERİ */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Çalışma Saatleri</h3>
        <div className="space-y-1.5">
          {DAYS.map((d) => {
            // Savunmacı: bozuk/eksik work_hours_json gün anahtarı çökme yapmasın.
            const day = hours[d.key] ?? { start: '09:00', end: '18:00', clinic: '', off: false }
            return (
              <div key={d.key} className="grid grid-cols-[110px_1fr_1fr_1.2fr_auto] items-center gap-2">
                <span className="text-sm text-gray-600">{d.label}</span>
                <input
                  type="time"
                  value={day.start}
                  disabled={day.off}
                  onChange={(e) => setDay(d.key, { start: e.target.value })}
                  className={`px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30 disabled:bg-gray-50 disabled:text-gray-300`}
                />
                <input
                  type="time"
                  value={day.end}
                  disabled={day.off}
                  onChange={(e) => setDay(d.key, { end: e.target.value })}
                  className={`px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30 disabled:bg-gray-50 disabled:text-gray-300`}
                />
                <input
                  type="text"
                  value={day.clinic}
                  disabled={day.off}
                  onChange={(e) => setDay(d.key, { clinic: e.target.value })}
                  placeholder="Klinik (ops.)"
                  className={`px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30 disabled:bg-gray-50 disabled:text-gray-300`}
                />
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
                  <input type="checkbox" checked={day.off} onChange={(e) => setDay(d.key, { off: e.target.checked })} className="w-3.5 h-3.5 rounded accent-gray-400" />
                  Çalışmıyor
                </label>
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
          İptal
        </button>
        <button type="button" onClick={submit} disabled={pending} className="px-5 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] transition-colors disabled:opacity-60">
          {pending ? 'Kaydediliyor…' : isNew ? 'Hekim Ekle' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </div>
  )
}
