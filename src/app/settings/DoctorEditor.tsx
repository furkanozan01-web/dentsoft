'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { parseToKurus } from '@/lib/format'
import { addDoctor, updateDoctor, toggleMesulMudur } from './actions'
import { SPECIALTIES, DAYS } from './constants'
import { emptyWorkHours } from './helpers'
import { ErrBox } from './SettingsSharedUI'
import type {
  Branch,
  DayHours,
  Doctor,
  R,
} from './types'
import { DoctorSharesEditor } from './DoctorSharesEditor'

export function DoctorEditor({
  doctor,
  branches,
  isAdmin,
  onCancel,
  onSaved,
  onSharesChanged,
}: {
  doctor: Doctor | null
  branches: Branch[]
  isAdmin: boolean
  onCancel: () => void
  onSaved: () => void
  onSharesChanged: () => void
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
      user_access_level: isNew ? userAccessLevel : undefined,
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
          <p className="text-sm font-black text-[#1D4ED8]">Kullanıcı kaydı otomatik oluşturulur</p><p className="mt-1 text-xs font-semibold text-blue-500">E-posta girildiğinde hekim Kullanıcı bölümüne eklenir ve ilk girişinde hesabı otomatik bağlanır.</p>
          <div className="mt-4"><label className="block text-xs font-medium text-blue-600 mb-1.5">Yetki Seviyesi</label><select value={userAccessLevel} onChange={(e) => setUserAccessLevel(e.target.value)} className={inputCls}><option value="branch">Yalnızca bağlı şube</option><option value="all">Tüm şubeler</option></select></div>
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
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-black text-rose-800">Hisse / Kâr Payı (Şube Bazlı)</span>
          </div>
          <p className="mt-1 text-xs font-semibold text-rose-700/70">Bir hekim birden fazla şubede farklı oranlarda hisseye sahip olabilir. Kasa &gt; Kâr Payı Öde işlemi bu oranları kullanır.</p>
          {isNew ? (
            <p className="mt-3 text-xs font-bold text-rose-700">Hekim kaydedildikten sonra şube hissesi ekleyebilirsiniz.</p>
          ) : (
            <DoctorSharesEditor doctorId={doctor!.id} shares={doctor!.doctor_shares} branches={branches} onChanged={onSharesChanged} />
          )}
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
