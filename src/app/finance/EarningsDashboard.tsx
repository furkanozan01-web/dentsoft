'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { localDateValue } from '@/lib/format'
import { usePersistedPreference } from '@/lib/hooks/usePersistedPreference'
import { addDoctorPayment, deleteDoctorPayment } from './actions'
import type { DoctorPayment, FinDoctor, FinDoctorShare, FinInstallment, FinPatient, FinTreatment, FinTx } from './FinanceClient'
import { computeSummary, type DoctorSummary } from '@/lib/finance/hakedis'

const MODEL_LABEL: Record<string, string> = {
  salary: 'Sabit Ödeme', commission: 'Komisyon', hybrid: 'Sabit + Komisyon',
  guarantee: 'Garantör Sistem', bonus: 'Prim Bazlı', per_transaction: 'İşlem Bazlı', revenue: 'Ciro Bazlı',
}
const PAY_LABEL: Record<string, string> = { maas: 'Maaş', ara_odeme: 'Ara ödeme', mahsuplasma: 'Mahsuplaşma', avans: 'Avans', prim: 'Prim', duzeltme: 'Düzeltme', garantor: 'Garanti tamamlama', kar_payi: 'Kâr payı' }
const METHOD_LABEL: Record<string, string> = { cash: 'Nakit / Kasa', transfer: 'Banka', check: 'Çek', senet: 'Senet', card: 'Kart', other: 'Diğer' }

function money(value: number) { return `₺${(value / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function dateText(value: string | null) { return value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('tr-TR') : '—' }

export default function EarningsDashboard({ doctors, doctorShares, treatments, patients, txs, payments, installments, profitByMonth, monthKey, canSeeAll, canManagePayments, onNeedFrom, currentDoctorId, onChanged, onPatientClick }: {
  doctors: FinDoctor[]
  doctorShares: FinDoctorShare[]
  treatments: FinTreatment[]
  patients: FinPatient[]
  txs: FinTx[]
  payments: DoctorPayment[]
  installments: FinInstallment[]
  profitByMonth: Record<string, number>
  monthKey: string
  canSeeAll: boolean
  canManagePayments: boolean
  /** Seçilen dönem yüklü pencereden eskiyse eksik işlemleri getirtir. */
  onNeedFrom: (from: string) => Promise<void>
  currentDoctorId: number | null
  onChanged: () => void
  onPatientClick: (id: number) => void
}) {
  const [detailPeriod,setDetailPeriod]=useState('selected')
  const [customStart,setCustomStart]=useState(monthKey)
  const [customEnd,setCustomEnd]=useState(monthKey)
  const activeMonthKeys=useMemo(()=>{
    if(detailPeriod==='selected')return[monthKey]
    const now=new Date();let start=new Date(now.getFullYear(),now.getMonth(),1);let end=new Date(start)
    if(detailPeriod==='last'){start.setMonth(start.getMonth()-1);end=new Date(start)}
    else if(detailPeriod==='3')start.setMonth(start.getMonth()-2)
    else if(detailPeriod==='6')start.setMonth(start.getMonth()-5)
    else if(detailPeriod==='year')start=new Date(now.getFullYear(),0,1)
    else if(detailPeriod==='custom'){
      start=new Date(`${customStart}-01T12:00:00`);end=new Date(`${customEnd}-01T12:00:00`)
      if (start > end) [start, end] = [end, start]
    }
    const keys:string[]=[];const cursor=new Date(start);while(cursor<=end){keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`);cursor.setMonth(cursor.getMonth()+1)}return keys
  },[detailPeriod,monthKey,customStart,customEnd])
  useEffect(() => {
    const oldest = [...activeMonthKeys].sort()[0]
    if (oldest) void onNeedFrom(`${oldest}-01`)
  }, [activeMonthKeys, onNeedFrom])
  const visibleDoctors = useMemo(
    () => canSeeAll ? doctors : doctors.filter((doctor) => doctor.id === currentDoctorId),
    [canSeeAll, doctors, currentDoctorId]
  )
  const summaries = useMemo(() => visibleDoctors.map((d) => {
    const parts=activeMonthKeys.map(key=>computeSummary(d,doctorShares,treatments,patients,txs,payments,key,profitByMonth));const first=parts[0]
    return {...first,details:parts.flatMap(p=>p.details),gross:parts.reduce((s,p)=>s+p.gross,0),cost:parts.reduce((s,p)=>s+p.cost,0),net:parts.reduce((s,p)=>s+p.net,0),bonus:parts.reduce((s,p)=>s+p.bonus,0),entitlement:parts.reduce((s,p)=>s+p.entitlement,0),paid:parts.reduce((s,p)=>s+p.paid,0),remaining:parts.reduce((s,p)=>s+p.remaining,0),completedCount:parts.reduce((s,p)=>s+p.completedCount,0),fixedAmount:parts.reduce((s,p)=>s+p.fixedAmount,0),commissionAmount:parts.reduce((s,p)=>s+p.commissionAmount,0),guaranteeCompletion:parts.reduce((s,p)=>s+p.guaranteeCompletion,0),guaranteeAmount:parts.reduce((s,p)=>s+(p.doctor.guarantee_active ? (p.doctor.guarantee_amount ?? 0) : 0),0),clinicNetProfit:parts.reduce((s,p)=>s+p.clinicNetProfit,0),profitShare:parts.reduce((s,p)=>s+p.profitShare,0)}
  }), [visibleDoctors, doctorShares, treatments, patients, txs, payments, profitByMonth, activeMonthKeys])
  const firstId = canSeeAll ? summaries[0]?.doctor.id ?? null : currentDoctorId
  const [persistedSelectedId, setPersistedSelectedId] = usePersistedPreference<number | null>('dentsoft:last-doctor-filter-earnings', firstId)
  const selectedId =
    canSeeAll && persistedSelectedId !== null && summaries.some((s) => s.doctor.id === persistedSelectedId)
      ? persistedSelectedId
      : firstId
  const setSelectedId = setPersistedSelectedId
  const [paying, setPaying] = useState<DoctorSummary | null>(null)
  const [showAllPayments, setShowAllPayments] = useState(false)
  const [pending, begin] = useTransition()
  const selected = summaries.find((s) => s.doctor.id === selectedId) ?? summaries[0] ?? null
  const balanceInfo = useMemo(() => {
    if (!selected) return { total: 0, collected: 0, unpaid: 0, overdue: 0, dueToday: 0, delivered: 0 }
    const mine = treatments.filter((t) => t.doctor_id === selected.doctor.id && t.treatment_date && activeMonthKeys.some(key=>t.treatment_date!.startsWith(key)))
    const patientIds = new Set(mine.map((t) => t.patient_id).filter((id): id is number => id != null))
    const total = mine.reduce((s, t) => s + (t.fee ?? 0), 0)
    const collected = selected.details.reduce((s, r) => s + r.collected, 0)
    const today = localDateValue()
    const overdue = installments.filter((i) => i.patient_id && patientIds.has(i.patient_id) && !i.paid && i.due_date < today).reduce((s, i) => s + i.amount, 0)
    const dueToday = installments.filter((i) => i.patient_id && patientIds.has(i.patient_id) && !i.paid && i.due_date === today).reduce((s, i) => s + i.amount, 0)
    const deliveredTotal = mine.filter((t) => t.status === 'completed').reduce((s, t) => s + (t.fee ?? 0), 0)
    const deliveredCollected = selected.details.filter((r) => r.description === 'İşlem tamamlandı').reduce((s, r) => s + r.collected, 0)
    return { total, collected, unpaid: Math.max(total - collected, 0), overdue, dueToday, delivered: Math.max(deliveredTotal - deliveredCollected, 0) }
  }, [selected, treatments, installments, activeMonthKeys])
  const fixedAmount = selected?.fixedAmount ?? 0
  const hasCommission = (selected?.doctor.commission_rate_bps ?? 0) > 0
  const guaranteeAmount = selected?.guaranteeAmount ?? 0
  const displayedEntitlement = Math.max(selected?.entitlement ?? 0, guaranteeAmount)
  const collectionRows = selected?.details.filter((row) => row.collected > 0) ?? []
  const patientRows = useMemo(() => {
    if (!selected) return []
    const rows = new Map<string, { key: string; patientId: number | null; name: string; surname: string; treatmentCount: number; total: number; collected: number; earning: number }>()
    selected.details.forEach((detail) => {
      const key = detail.patientId == null ? `treatment-${detail.id}` : `patient-${detail.patientId}`
      const row = rows.get(key) ?? { key, patientId: detail.patientId, name: detail.firstName, surname: detail.surname, treatmentCount: 0, total: 0, collected: 0, earning: 0 }
      row.treatmentCount += 1
      row.total += detail.treatmentAmount
      row.collected += detail.collected
      row.earning += detail.earning + detail.bonus
      rows.set(key, row)
    })
    return [...rows.values()]
  }, [selected])

  const removePayment = (id: number) => begin(async () => {
    const result = await deleteDoctorPayment(id)
    if (result?.error) toast.error(result.error)
    else { toast.success('Ödeme ve bağlantılı gider silindi'); onChanged() }
  })

  if (!selected) return <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-10 text-center"><p className="font-black text-slate-700">Hakediş kaydıyla eşleşen hekim bulunamadı.</p><p className="mt-2 text-sm font-semibold text-slate-400">Ayarlar bölümünden kullanıcı hesabını bir hekimle eşleştirin.</p></div>

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-[18px] border border-slate-200 bg-white p-4"><div><p className="text-sm font-black text-[#142536]">Tahsilat Detayları Dönemi</p><p className="mt-1 text-xs font-semibold text-slate-400">Eski ayların tahsilat ve hakediş kırılımlarına erişin</p></div><div className="flex flex-wrap gap-2"><select value={detailPeriod} onChange={e=>setDetailPeriod(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600"><option value="selected">Seçili ay</option><option value="last">Geçen ay</option><option value="3">Son 3 ay</option><option value="6">Son 6 ay</option><option value="year">Bu yıl</option><option value="custom">Özel tarih aralığı</option></select>{detailPeriod==='custom'&&<><input type="month" value={customStart} onChange={e=>setCustomStart(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold"/><input type="month" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold"/></>}</div></div>
    {canSeeAll && <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"><div className="mb-4"><h3 className="font-black text-[#142536]">Hekim Hakediş Kartları</h3><p className="mt-1 text-xs font-semibold text-slate-400">Detayını açmak istediğiniz hekimi seçin</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{summaries.map((row) => <button key={row.doctor.id} onClick={() => setSelectedId(row.doctor.id)} className={`rounded-[18px] border p-4 text-left transition ${selected.doctor.id === row.doctor.id ? 'border-[#2DD4BF] bg-[#E9FBF8] shadow-md' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}><div className="flex items-start justify-between gap-3"><div><p className="font-black text-[#142536]">Dt. {row.doctor.name}</p><p className="mt-1 text-[11px] font-bold text-slate-400">{MODEL_LABEL[row.doctor.payment_model ?? ''] ?? 'Model tanımsız'}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${row.remaining >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{money(row.remaining)}</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs"><Mini label="Ciro" value={money(row.gross)} /><Mini label="Hakediş" value={money(row.entitlement)} /><Mini label="Ödenen" value={money(row.paid)} /></div></button>)}</div></section>}
    <section className="overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#0F766E,#1EAEA0)] p-6 text-white shadow-[0_18px_42px_rgba(15,118,110,0.24)]">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-white/65">Hakediş</p>
          <p className="mt-2 text-4xl font-black">{money(displayedEntitlement)}</p>
          {guaranteeAmount > 0 && <p className="mt-2 text-sm font-black text-white/90">Garantör: {money(guaranteeAmount)}</p>}
          <p className="mt-1 text-sm font-semibold text-white/75">{canSeeAll ? `Dt. ${selected.doctor.name} için seçili dönem toplam hakedişi` : 'Seçili dönem toplam hakedişiniz'}{selected.doctor.salary_day ? ` • Ödeme günü: ayın ${selected.doctor.salary_day}. günü` : ''}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-3">
          <TopInfo label="Sabit maaş" value={money(fixedAmount)} />
          <TopInfo label="Prim" value={money(selected.bonus)} />
          <TopInfo label="Hisse" value={money(selected.profitShare)} />
        </div>
      </div>
    </section>

    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"><div className="mb-5"><h3 className="font-black text-[#142536]">Bakiye Paneli</h3><p className="mt-1 text-xs font-semibold text-slate-400">Hekimin yaptığı işlerden hastalarda bekleyen tutarlar; doğrudan hakediş değildir</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Stat label="Toplam işlem" value={balanceInfo.total}/><Stat label="Tahsil edilen" value={balanceInfo.collected} tone="green"/><Stat label="Tahsil edilmeyen" value={balanceInfo.unpaid} tone="red"/><Stat label="Vadesi geçmiş" value={balanceInfo.overdue} tone="red"/><Stat label="Bugün taksit" value={balanceInfo.dueToday}/><Stat label="Teslim edilmiş / ödenmemiş" value={balanceInfo.delivered} tone="violet"/></div></section>

    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="flex items-center gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E9FBF8] text-lg font-black text-[#0F766E]">{selected.doctor.name.split(' ').map((x) => x[0]).slice(0,2).join('').toUpperCase()}</span><div><h3 className="text-lg font-black text-[#142536]">Dt. {selected.doctor.name}</h3><p className="mt-1 text-xs font-semibold text-slate-400">{selected.doctor.specialty || 'Diş Hekimi'} • Aktif çalışma • {MODEL_LABEL[selected.doctor.payment_model ?? ''] ?? 'Model tanımsız'}</p></div></div>{canManagePayments && <button onClick={() => setPaying(selected)} className="h-11 rounded-xl bg-[#1EAEA0] px-5 text-sm font-black text-white shadow-lg">Ödeme Yap</button>}</div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6"><Stat label="Toplam ciro" value={selected.gross} /><Stat label="Toplam maliyet" value={selected.cost} /><Stat label="Net ciro" value={selected.net} /><Stat label="Hakediş oranı" text={`%${(selected.rate / 100).toLocaleString('tr-TR')}`} /><Stat label="Prim" value={selected.bonus} /><Stat label="Toplam hakediş" value={selected.entitlement} tone="violet" /><Stat label="Ödenen tutar" value={selected.paid} tone="red" /><Stat label="Kalan hakediş" value={selected.remaining} tone={selected.remaining >= 0 ? 'green' : 'red'} /></div></section>

    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <Header title="Tahsilat Detayları" subtitle={`Dt. ${selected.doctor.name} • Seçilen dönemde hakedişe yansıyan tahsilatlar`} />
      <div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-3">
        <Mini label="Tahsilat sayısı" value={String(collectionRows.length)} />
        <Mini label="Toplam tahsilat" value={money(collectionRows.reduce((sum, row) => sum + row.collected, 0))} />
        <Mini label="Hakedişe yansıyan" value={money(collectionRows.reduce((sum, row) => sum + row.earning + row.bonus, 0))} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1750px] text-xs">
          <thead className="bg-slate-50"><tr>{['Hasta adı','Hasta soyadı','İşlem tarihi','Tahsilat tarihi','Yapılan işlem','Tahsil edilen','Hekim cirosu','Komisyon oranı','Komisyon tutarı','Prim','Hakedişe yansıyan','Ödeme yöntemi','Açıklama'].map((h) => <th key={h} className="whitespace-nowrap px-4 py-4 text-left font-black uppercase tracking-wide text-slate-400">{h}</th>)}</tr></thead>
          <tbody>{collectionRows.length === 0 ? <tr><td colSpan={13} className="p-10 text-center font-semibold text-slate-400">Seçili dönemde tahsilat bulunmuyor.</td></tr> : collectionRows.map((row) => <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-4"><button disabled={!row.patientId} onClick={() => row.patientId && onPatientClick(row.patientId)} className="font-black text-[#142536] hover:underline">{row.firstName}</button></td><td className="px-4 py-4 font-bold text-slate-600">{row.surname}</td><td className="px-4 py-4 text-slate-500">{dateText(row.treatmentDate)}</td><td className="px-4 py-4 text-slate-500">{dateText(row.collectionDate)}</td><td className="px-4 py-4 font-bold text-slate-700">{row.treatment}</td><td className="px-4 py-4 font-black text-emerald-600">{money(row.collected)}</td><td className="px-4 py-4 font-black text-slate-700">{money(row.gross)}</td><td className="px-4 py-4 font-bold text-violet-600">%{hasCommission ? (row.rate / 100).toLocaleString('tr-TR') : '0'}</td><td className="px-4 py-4 font-black text-[#0F766E]">{money(hasCommission ? row.earning : 0)}</td><td className="px-4 py-4 font-bold text-amber-600">{money(row.bonus)}</td><td className="px-4 py-4 font-black text-blue-600">{money(row.earning + row.bonus)}</td><td className="px-4 py-4 text-slate-500">{METHOD_LABEL[row.paymentMethod ?? ''] ?? row.paymentMethod ?? '—'}</td><td className="px-4 py-4 text-slate-500">{row.description}</td></tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <Header title="Hasta Bazlı Hakediş Detayları" subtitle={`Dt. ${selected.doctor.name} • Hasta bazında işlem, tahsilat, bakiye ve hakediş özeti`} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-xs">
          <thead className="bg-slate-50"><tr>{['Hasta','İşlem sayısı','Toplam işlem','Tahsil edilen','Bekleyen bakiye','Hakedişe yansıyan','Durum'].map((h) => <th key={h} className="whitespace-nowrap px-5 py-4 text-left font-black uppercase tracking-wide text-slate-400">{h}</th>)}</tr></thead>
          <tbody>{patientRows.length === 0 ? <tr><td colSpan={7} className="p-10 text-center font-semibold text-slate-400">Seçili dönemde hasta işlemi bulunmuyor.</td></tr> : patientRows.map((row) => { const waiting = Math.max(row.total - row.collected, 0); return <tr key={row.key} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-5 py-4"><button disabled={!row.patientId} onClick={() => row.patientId && onPatientClick(row.patientId)} className="font-black text-[#142536] hover:underline">{row.name} {row.surname}</button></td><td className="px-5 py-4 font-bold text-slate-600">{row.treatmentCount}</td><td className="px-5 py-4 font-black text-slate-700">{money(row.total)}</td><td className="px-5 py-4 font-black text-emerald-600">{money(row.collected)}</td><td className="px-5 py-4 font-black text-red-600">{money(waiting)}</td><td className="px-5 py-4 font-black text-violet-600">{money(row.earning)}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 font-black ${waiting > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{waiting > 0 ? 'Tahsilat bekliyor' : 'Tahsil edildi'}</span></td></tr> })}</tbody>
        </table>
      </div>
    </section>

    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <Header title="Hakediş Ödeme Geçmişi" subtitle="Son 10 ödeme açık gösterilir; Defter giderleriyle otomatik eşleşir" />
      <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-xs"><thead className="bg-slate-50"><tr>{['Tarih','Ödeme türü','Yöntem','Kasa / banka','Hakediş dönemi','Tutar','Açıklama','Ödemeyi yapan','İşlem'].map((h) => <th key={h} className="px-5 py-4 text-left font-black uppercase tracking-wide text-slate-400">{h}</th>)}</tr></thead><tbody>{payments.filter((p) => p.doctor_id === selected.doctor.id).slice(0,showAllPayments?undefined:10).map((p) => <tr key={p.id} className="border-t border-slate-100"><td className="px-5 py-4 font-semibold text-slate-500">{dateText(p.payment_date)}</td><td className="px-5 py-4 font-bold text-slate-700">{PAY_LABEL[p.payment_type] ?? p.payment_type}</td><td className="px-5 py-4 text-slate-500">{METHOD_LABEL[p.method ?? ''] ?? p.method ?? '—'}</td><td className="px-5 py-4 text-slate-500">{p.account_name || METHOD_LABEL[p.method ?? ''] || '—'}</td><td className="px-5 py-4 text-slate-500">{p.earning_period || p.payment_date.slice(0,7)}</td><td className="px-5 py-4 font-black text-red-600">{money(p.amount)}</td><td className="px-5 py-4 text-slate-500">{p.note || '—'}</td><td className="px-5 py-4 text-slate-500">{p.created_by_name || (p.created_by ? 'Yetkili kullanıcı' : 'Eski kayıt')}</td><td className="px-5 py-4">{canManagePayments && <button disabled={pending} onClick={() => removePayment(p.id)} className="font-black text-red-500 hover:underline">Sil</button>}</td></tr>)}</tbody></table></div>
      {payments.filter((p) => p.doctor_id === selected.doctor.id).length > 10 && <button onClick={() => setShowAllPayments((value) => !value)} className="m-5 text-xs font-black text-[#0F766E]">{showAllPayments ? 'Son 10 ödemeyi göster' : 'Tüm ödeme geçmişini göster'}</button>}
    </section>

    {paying && <PaymentModal row={paying} onClose={() => setPaying(null)} onSuccess={() => { setPaying(null); onChanged() }} />}
  </div>
}

function PaymentModal({ row, onClose, onSuccess }: { row: DoctorSummary; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState(Math.max(row.remaining, 0) ? (Math.max(row.remaining, 0) / 100).toLocaleString('tr-TR') : '')
  const [type, setType] = useState(row.doctor.payment_model === 'salary' ? 'maas' : 'ara_odeme')
  const [method, setMethod] = useState('cash')
  const [date, setDate] = useState(localDateValue())
  const [accountName, setAccountName] = useState(row.doctor.payment_account ?? '')
  const [earningPeriod, setEarningPeriod] = useState(localDateValue().slice(0, 7))
  const [note, setNote] = useState('')
  const [pending, begin] = useTransition()
  const save = () => begin(async () => { const result = await addDoctorPayment({ doctorId: row.doctor.id, amount, paymentType: type, method, date, accountName, earningPeriod, note }); if (result?.error) toast.error(result.error); else { toast.success('Ödeme Hakediş ve Defter Gider bölümüne işlendi'); onSuccess() } })
  const field = 'h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#2DD4BF]'
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="Kapat" /><div className="relative w-full max-w-lg rounded-[24px] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><h3 className="font-black text-[#142536]">Hakediş Ödemesi</h3><p className="mt-1 text-xs font-semibold text-slate-400">Dt. {row.doctor.name} • Kalan {money(row.remaining)}</p></div><button onClick={onClose} className="h-8 w-8 rounded-lg bg-slate-100">×</button></div><div className="grid gap-4 p-6 sm:grid-cols-2"><label className="text-xs font-black text-slate-500">Tutar (₺)<input value={amount} onChange={(e) => setAmount(e.target.value)} className={`mt-1.5 ${field}`} /></label><label className="text-xs font-black text-slate-500">Ödeme türü<select value={type} onChange={(e) => setType(e.target.value)} className={`mt-1.5 ${field}`}><option value="maas">Maaş</option><option value="ara_odeme">Ara ödeme</option><option value="mahsuplasma">Mahsuplaşma</option><option value="avans">Avans</option><option value="prim">Prim</option></select></label><label className="text-xs font-black text-slate-500">Yöntem<select value={method} onChange={(e) => setMethod(e.target.value)} className={`mt-1.5 ${field}`}><option value="cash">Nakit / Kasa</option><option value="transfer">Banka</option><option value="check">Çek</option><option value="other">Diğer</option></select></label><label className="text-xs font-black text-slate-500">Tarih<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1.5 ${field}`} /></label><label className="text-xs font-black text-slate-500">Kasa / banka<input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder={method === 'cash' ? 'Ana Kasa' : 'Banka hesabı'} className={`mt-1.5 ${field}`} /></label><label className="text-xs font-black text-slate-500">Hakediş dönemi<input type="month" value={earningPeriod} onChange={(e) => setEarningPeriod(e.target.value)} className={`mt-1.5 ${field}`} /></label><label className="text-xs font-black text-slate-500 sm:col-span-2">Açıklama<input value={note} onChange={(e) => setNote(e.target.value)} className={`mt-1.5 ${field}`} /></label><div className="flex gap-3 pt-2 sm:col-span-2"><button onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-200 font-black text-slate-500">İptal</button><button disabled={pending} onClick={save} className="h-11 flex-1 rounded-xl bg-[#1EAEA0] font-black text-white disabled:opacity-50">{pending ? 'İşleniyor…' : 'Öde ve Gidere İşle'}</button></div></div></div></div>
}

function TopInfo({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white/10 px-4 py-3"><p className="text-[10px] font-black uppercase tracking-wide text-white/60">{label}</p><p className="mt-1 font-black">{value}</p></div> }
function Mini({ label, value }: { label: string; value: string }) { return <div><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className="mt-1 font-black text-slate-700">{value}</p></div> }
function Stat({ label, value, text, tone = 'slate' }: { label: string; value?: number; text?: string; tone?: 'slate'|'green'|'red'|'violet' }) { const cls = tone === 'green' ? 'text-emerald-600' : tone === 'red' ? 'text-red-600' : tone === 'violet' ? 'text-violet-600' : 'text-slate-700'; return <div className="rounded-[16px] bg-slate-50 p-3"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-sm font-black ${cls}`}>{text ?? money(value ?? 0)}</p></div> }
function Header({ title, subtitle }: { title: string; subtitle: string }) { return <div className="border-b border-slate-100 px-6 py-5"><h3 className="font-black text-[#142536]">{title}</h3><p className="mt-1 text-xs font-semibold text-slate-400">{subtitle}</p></div> }
