'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { usePersistedPreference } from '@/lib/hooks/usePersistedPreference'
import type { FinDoctor, FinInstallment, FinPatient, FinTreatment, FinTx } from './FinanceClient'

type Risk = 'low' | 'medium' | 'high' | 'overdue'
type SortKey = 'name' | 'createdAt' | 'doctor' | 'clinic' | 'startDate' | 'dueDate' | 'owed' | 'paid' | 'balance' | 'installment' | 'delivery' | 'delay' | 'risk' | 'description'
type SortDirection = 'asc' | 'desc'

interface BalanceRow {
  id: number
  name: string
  createdAt: string
  doctorId: number | null
  doctor: string
  clinic: string
  startDate: string | null
  dueDate: string | null
  lastPaymentDate: string | null
  owed: number
  paid: number
  balance: number
  installmentText: string
  nextInstallment: string | null
  delivery: 'Teslim edildi' | 'Devam ediyor' | 'Planlandı'
  delayDays: number
  daysSincePayment: number
  risk: Risk
  score: number
  description: string
  recommendation: string
}

const RISK_ORDER: Record<Risk, number> = { low: 1, medium: 2, high: 3, overdue: 4 }
const RISK_STYLE: Record<Risk, { label: string; cls: string }> = {
  low: { label: 'Düşük risk', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  medium: { label: 'Orta risk', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  high: { label: 'Yüksek risk', cls: 'bg-orange-50 text-orange-700 border-orange-100' },
  overdue: { label: 'Vadesi geçmiş', cls: 'bg-red-50 text-red-700 border-red-200' },
}

function money(value: number) {
  return `₺${(value / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function dateLabel(value: string | null) {
  if (!value) return '—'
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('tr-TR')
}

function dayDiff(from: string | null, to: string) {
  if (!from) return 0
  return Math.max(0, Math.floor((new Date(`${to}T12:00:00`).getTime() - new Date(`${from.slice(0, 10)}T12:00:00`).getTime()) / 86400000))
}

function earliest(values: Array<string | null | undefined>) {
  return values.filter((v): v is string => Boolean(v)).sort()[0] ?? null
}

function latest(values: Array<string | null | undefined>) {
  return values.filter((v): v is string => Boolean(v)).sort().at(-1) ?? null
}

function buildRows({ patients, doctors, treatments, txs, installments, clinicName, today }: {
  patients: FinPatient[]
  doctors: FinDoctor[]
  treatments: FinTreatment[]
  txs: FinTx[]
  installments: FinInstallment[]
  clinicName: string
  today: string
}): BalanceRow[] {
  const doctorMap = new Map(doctors.map((d) => [d.id, d.name]))
  return patients.map((patient) => {
    const patientTreatments = treatments.filter((t) => t.patient_id === patient.id)
    const payments = txs.filter((t) => t.patient_id === patient.id && t.type === 'payment')
    const patientInstallments = installments.filter((i) => i.patient_id === patient.id && !i.paid).sort((a, b) => a.due_date.localeCompare(b.due_date))
    const owed = patientTreatments.reduce((sum, t) => sum + (t.fee ?? 0), 0)
    const paid = payments.reduce((sum, t) => sum + t.amount, 0)
    const balance = owed - paid
    const startDate = earliest([...patientTreatments.map((t) => t.treatment_date), ...payments.map((t) => t.transaction_date)])
    const lastPaymentDate = latest(payments.map((t) => t.transaction_date))
    const overdueInstallments = patientInstallments.filter((i) => i.due_date < today)
    const nextInstallment = patientInstallments[0]?.due_date ?? null
    const dueDate = overdueInstallments[0]?.due_date ?? nextInstallment ?? lastPaymentDate ?? startDate
    const delayDays = dueDate && dueDate < today ? dayDiff(dueDate, today) : 0
    const daysSincePayment = dayDiff(lastPaymentDate ?? startDate, today)
    const latestTreatment = [...patientTreatments].sort((a, b) => (b.treatment_date ?? '').localeCompare(a.treatment_date ?? ''))[0]
    const doctorId = latestTreatment?.doctor_id ?? patientTreatments.find((t) => t.doctor_id)?.doctor_id ?? null
    const completed = patientTreatments.length > 0 && patientTreatments.every((t) => t.status === 'completed')
    const inProgress = patientTreatments.some((t) => t.status === 'in_progress')
    const delivery: BalanceRow['delivery'] = completed ? 'Teslim edildi' : inProgress ? 'Devam ediyor' : 'Planlandı'
    const dueSoon = Boolean(nextInstallment && nextInstallment >= today && dayDiff(today, nextInstallment) <= 7)
    const dueToday = nextInstallment === today
    const highBalance = balance >= 5000000
    const partial = paid > 0 && balance > 0
    let score = Math.min(30, Math.round(balance / 500000))
    if (delayDays > 45) score += 55
    else if (delayDays > 0) score += 30
    if (dueToday) score += 25
    else if (dueSoon) score += 15
    if (completed && balance > 0) score += 25
    if (daysSincePayment > 45) score += 20
    if (highBalance) score += 20
    if (partial) score += 8

    let risk: Risk = 'low'
    if (delayDays > 45) risk = 'overdue'
    else if (score >= 55) risk = 'high'
    else if (score >= 25) risk = 'medium'

    let recommendation = 'Planlanan ödeme tarihini izleyin.'
    let description = 'Düzenli takip'
    if (delayDays > 45) {
      recommendation = `${delayDays} günlük gecikme var. Hastayla bugün iletişime geçip ödeme planını netleştirin.`
      description = '45+ gün ödeme gecikmesi'
    } else if (dueToday) {
      recommendation = 'Taksit günü bugün. Ödeme hatırlatması yapılabilir.'
      description = 'Taksit günü geldi'
    } else if (completed && balance > 0) {
      recommendation = 'Tedavi teslim edilmiş ve bakiye açık. Tahsilat için öncelikli iletişim önerilir.'
      description = 'Teslim sonrası açık bakiye'
    } else if (highBalance && daysSincePayment > 30) {
      recommendation = 'Yüksek bakiye risk grubunda. Hekim koordinasyonunda takip önerilir.'
      description = 'Yüksek bakiye riski'
    } else if (dueSoon) {
      recommendation = 'Ödeme tarihi yaklaşıyor. Hatırlatma planlanabilir.'
      description = 'Yaklaşan ödeme'
    } else if (partial) {
      recommendation = 'Eksik ödeme bulunuyor. Kalan tutar için yeni tarih teyit edilebilir.'
      description = 'Kısmi ödeme'
    }

    return {
      id: patient.id, name: `${patient.name} ${patient.surname}`, createdAt: patient.created_at,
      doctorId, doctor: doctorId ? doctorMap.get(doctorId) ?? `Hekim #${doctorId}` : 'Atanmamış',
      clinic: clinicName, startDate, dueDate, lastPaymentDate, owed, paid, balance,
      installmentText: patientInstallments.length ? `${patientInstallments.length} açık • ${money(patientInstallments.reduce((s, i) => s + i.amount, 0))}` : 'Taksit yok',
      nextInstallment, delivery, delayDays, daysSincePayment, risk, score, description, recommendation,
    }
  }).filter((row) => row.balance > 0)
}

export default function BalanceDashboard({ patients, doctors, treatments, txs, installments, clinicName, onPatientClick, onPayClick }: {
  patients: FinPatient[]
  doctors: FinDoctor[]
  treatments: FinTreatment[]
  txs: FinTx[]
  installments: FinInstallment[]
  clinicName: string
  onPatientClick: (id: number) => void
  onPayClick: (id: number) => void
}) {
  const today = useMemo(() => new Date().toLocaleDateString('en-CA'), [])
  const [doctorFilter, setDoctorFilter] = usePersistedPreference('dentsoft:last-doctor-filter-balance', 'all')
  const [clinicFilter, setClinicFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState<'all' | Risk>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [direction, setDirection] = useState<SortDirection>('asc')
  const rows = useMemo(() => buildRows({ patients, doctors, treatments, txs, installments, clinicName, today }), [patients, doctors, treatments, txs, installments, clinicName, today])
  const filtered = rows.filter((row) => (doctorFilter === 'all' || row.doctorId === Number(doctorFilter)) && (clinicFilter === 'all' || row.clinic === clinicFilter) && (riskFilter === 'all' || row.risk === riskFilter))
  const sorted = [...filtered].sort((a, b) => {
    const av = sortKey === 'risk' ? RISK_ORDER[a.risk] : sortKey === 'installment' ? (a.nextInstallment ?? '') : sortKey === 'delay' ? a.delayDays : sortKey === 'delivery' ? a.delivery : a[sortKey]
    const bv = sortKey === 'risk' ? RISK_ORDER[b.risk] : sortKey === 'installment' ? (b.nextInstallment ?? '') : sortKey === 'delay' ? b.delayDays : sortKey === 'delivery' ? b.delivery : b[sortKey]
    const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''), 'tr')
    return direction === 'asc' ? result : -result
  })
  const priority = [...rows].sort((a, b) => b.score - a.score || b.balance - a.balance).slice(0, 6)
  const overdue45 = rows.filter((r) => r.delayDays > 45)
  const totalReceivable = filtered.reduce((s, r) => s + r.balance, 0)
  const overduePayments = filtered.filter((r) => r.delayDays > 0).reduce((s, r) => s + r.balance, 0)

  const sort = (key: SortKey) => {
    if (sortKey === key) setDirection((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setDirection('asc') }
  }

  return <div className="space-y-6">
    {overdue45.length > 0 && <div className="flex items-start gap-3 rounded-[20px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 shadow-sm"><span className="text-lg">⚠</span><div><p className="font-black">45 günden uzun süredir ödeme yapmayan hastalar var.</p><p className="mt-1 font-semibold">{overdue45.length} hastanın vadesi geçmiş bakiyesini kontrol ediniz. Toplam risk: {money(overdue45.reduce((s, r) => s + r.balance, 0))}</p></div></div>}

    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-base font-black text-[#142536]">Bakiye ve Tahsilat Analizi</h2><p className="mt-1 text-xs font-semibold text-slate-400">Hekim ve klinik bazında aktif tahsilat takibi</p></div><div className="flex flex-wrap gap-3"><Filter label="Hekim" value={doctorFilter} onChange={setDoctorFilter}><option value="all">Tüm hekimler</option>{doctors.map((d) => <option key={d.id} value={d.id}>Dt. {d.name}</option>)}</Filter><Filter label="Klinik" value={clinicFilter} onChange={setClinicFilter}><option value="all">Tüm klinikler</option><option value={clinicName}>{clinicName}</option></Filter><Filter label="Risk" value={riskFilter} onChange={(v) => setRiskFilter(v as 'all' | Risk)}><option value="all">Tüm riskler</option><option value="overdue">Vadesi geçmiş</option><option value="high">Yüksek risk</option><option value="medium">Orta risk</option><option value="low">Düşük risk</option></Filter></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><Metric label="Bakiye (Toplam Hasta Borcu)" value={totalReceivable} tone="red" /><Metric label="Gecikmiş Ödemeler" value={overduePayments} tone="amber" /></div>
    </section>

    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <Header title="Öncelikli Tahsilat Listesi" subtitle="Ödeme geçmişi, vade, bakiye ve tedavi durumuna göre açıklanabilir risk analizi" badge={`${priority.length} hasta`} />
      <div className="grid gap-4 p-5 lg:grid-cols-2 xl:grid-cols-3">{priority.length === 0 ? <Empty /> : priority.map((row, index) => <article key={row.id} className={`rounded-[18px] border p-4 ${row.risk === 'overdue' ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50/60'}`}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-[#0F766E] shadow-sm">{index + 1}</span><div className="min-w-0"><button onClick={() => onPatientClick(row.id)} className="truncate text-left text-sm font-black text-[#142536] hover:underline">{row.name}</button><p className="mt-1 truncate text-[11px] font-semibold text-slate-400">Dt. {row.doctor} • {row.clinic}</p></div></div><RiskBadge risk={row.risk} /></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><Info label="Kalan bakiye" value={money(row.balance)} strong /><Info label="Gecikme" value={row.delayDays ? `${row.delayDays} gün` : 'Gecikme yok'} /><Info label="Son ödeme tarihi" value={dateLabel(row.dueDate)} /><Info label="Taksit" value={row.installmentText} /><Info label="Tedavi" value={row.delivery} /><Info label="Risk puanı" value={`${row.score} / 100+`} /></div><div className="mt-3 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5"><p className="text-[10px] font-black uppercase tracking-wide text-violet-500">Yapay zekâ destekli tahsilat önerisi</p><p className="mt-1 text-xs font-semibold leading-5 text-violet-900">{row.recommendation}</p></div><button onClick={() => onPayClick(row.id)} className="mt-3 h-10 w-full rounded-xl bg-[#1EAEA0] text-xs font-black text-white">Ödeme Al</button></article>)}</div>
    </section>

    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <Header title="Hasta Bakiye Tablosu" subtitle="Başlıklara tıklayarak artan veya azalan sıralama yapabilirsiniz" badge={`${sorted.length} hasta`} />
      <div className="overflow-x-auto"><table className="w-full min-w-[1900px] text-xs"><thead className="bg-slate-50"><tr>{([
        ['Hasta adı','name'],['Hekim','doctor'],['Klinik','clinic'],['İşlem başlangıç tarihi','startDate'],['Son ödeme tarihi','dueDate'],['Toplam işlem tutarı','owed'],['Yapılan ödeme','paid'],['Kalan bakiye','balance'],['Taksit durumu','installment'],['Tedavi teslim durumu','delivery'],['Gecikme süresi','delay'],['Risk durumu','risk'],['Açıklama','description'],
      ] as Array<[string, SortKey]>).map(([label,key]) => <SortHeader key={key} label={label} active={sortKey === key} direction={direction} onClick={() => sort(key)} />)}<th className="px-4 py-4 text-right font-black uppercase tracking-wide text-slate-400">İşlem</th></tr></thead><tbody>{sorted.length === 0 ? <tr><td colSpan={14}><Empty /></td></tr> : sorted.map((row) => <tr key={row.id} className={`border-t border-slate-100 ${row.risk === 'overdue' ? 'bg-red-50/50' : 'hover:bg-slate-50/70'}`}><td className="px-4 py-4"><button onClick={() => onPatientClick(row.id)} className="font-black text-[#142536] hover:underline">{row.name}</button><p className="mt-1 text-[10px] font-semibold text-slate-400">Kayıt: {dateLabel(row.createdAt)}</p></td><td className="px-4 py-4 font-bold text-slate-600">{row.doctor}</td><td className="px-4 py-4 font-semibold text-slate-500">{row.clinic}</td><td className="px-4 py-4 font-semibold text-slate-500">{dateLabel(row.startDate)}</td><td className="px-4 py-4 font-bold text-slate-600">{dateLabel(row.dueDate)}</td><td className="px-4 py-4 text-right font-black text-slate-700">{money(row.owed)}</td><td className="px-4 py-4 text-right font-black text-emerald-600">{money(row.paid)}</td><td className="px-4 py-4 text-right"><span className="rounded-full bg-red-50 px-2.5 py-1.5 font-black text-red-600">{money(row.balance)}</span></td><td className="px-4 py-4 font-semibold text-slate-500">{row.installmentText}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 font-bold ${row.delivery === 'Teslim edildi' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{row.delivery}</span></td><td className="px-4 py-4 font-black text-slate-600">{row.delayDays ? `${row.delayDays} gün` : '—'}</td><td className="px-4 py-4"><RiskBadge risk={row.risk} /></td><td className="max-w-[220px] px-4 py-4"><p className="truncate font-bold text-slate-600" title={row.recommendation}>{row.description}</p><p className="mt-1 truncate text-[10px] font-semibold text-violet-500">{row.recommendation}</p></td><td className="px-4 py-4 text-right"><button onClick={() => onPayClick(row.id)} className="rounded-xl bg-[#1EAEA0] px-3 py-2 font-black text-white">Ödeme Al</button></td></tr>)}</tbody></table></div>
    </section>
  </div>
}

function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) { return <label className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block h-10 min-w-40 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-[#2DD4BF]">{children}</select></label> }
function Metric({ label, value, tone }: { label: string; value: number; tone: 'red' | 'green' | 'amber' }) { const cls = tone === 'green' ? 'bg-emerald-50 text-emerald-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'; return <div className={`rounded-[18px] p-4 ${cls}`}><p className="text-[10px] font-black uppercase tracking-wide opacity-70">{label}</p><p className="mt-2 text-xl font-black">{money(value)}</p></div> }
function Header({ title, subtitle, badge }: { title: string; subtitle: string; badge: string }) { return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5"><div><h3 className="font-black text-[#142536]">{title}</h3><p className="mt-1 text-xs font-semibold text-slate-400">{subtitle}</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{badge}</span></div> }
function RiskBadge({ risk }: { risk: Risk }) { const item = RISK_STYLE[risk]; return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-black ${item.cls}`}>{risk === 'overdue' && '⚠ '}{item.label}</span> }
function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <div className="rounded-xl bg-white px-3 py-2"><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className={`mt-1 truncate ${strong ? 'font-black text-red-600' : 'font-bold text-slate-600'}`}>{value}</p></div> }
function SortHeader({ label, active, direction, onClick }: { label: string; active: boolean; direction: SortDirection; onClick: () => void }) { return <th className="px-4 py-4 text-left"><button onClick={onClick} className={`inline-flex items-center gap-1 whitespace-nowrap font-black uppercase tracking-wide ${active ? 'text-[#0F766E]' : 'text-slate-400 hover:text-slate-600'}`}>{label}<span>{active ? direction === 'asc' ? '↑' : '↓' : '↕'}</span></button></th> }
function Empty() { return <div className="p-10 text-center text-sm font-semibold text-slate-400">Filtreye uygun açık bakiye bulunmuyor.</div> }
