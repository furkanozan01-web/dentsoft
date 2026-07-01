'use client'

import { useMemo, useState, useTransition, type ReactNode } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { localDateValue } from '@/lib/format'
import { addClinicDebt, addExpense, deleteTransaction, payClinicDebt } from './actions'
import type {
  ClinicDebt, DoctorPayment, FinBusinessPartner, FinDoctor, FinInstallment,
  FinPatient, FinTreatment, FinTx,
} from './FinanceClient'

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

const PERIOD_LABEL: Record<Period, string> = {
  daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık', yearly: 'Yıllık',
}
const METHOD_LABEL: Record<string, string> = {
  cash: 'Nakit', card: 'Kart', transfer: 'Banka', check: 'Çek', other: 'Diğer', firma_odemesi: 'Firma',
}
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function money(kurus: number) {
  return `₺${(kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function parseAmount(value: string) {
  const parsed = Number(value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function dateText(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('tr-TR')
}

function periodKey(dateValue: string, period: Period) {
  const date = new Date(`${dateValue}T12:00:00`)
  if (period === 'yearly') return { key: String(date.getFullYear()), label: String(date.getFullYear()) }
  if (period === 'monthly') {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return { key, label: `${MONTHS[date.getMonth()]} ${date.getFullYear()}` }
  }
  if (period === 'weekly') {
    const monday = new Date(date)
    const day = (monday.getDay() + 6) % 7
    monday.setDate(monday.getDate() - day)
    const key = localDateValue(monday)
    return { key, label: `${dateText(key)} haftası` }
  }
  return { key: dateValue, label: dateText(dateValue) }
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  const income = payload.find((p) => p.name === 'Gelir')?.value ?? 0
  const expense = payload.find((p) => p.name === 'Gider')?.value ?? 0
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl">
      <p className="mb-2 font-black text-slate-700">{label}</p>
      <p className="font-bold text-emerald-600">Gelir: {money(income)}</p>
      <p className="font-bold text-red-500">Gider: {money(expense)}</p>
      <p className={`mt-1 font-black ${income - expense >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Net: {money(income - expense)}</p>
    </div>
  )
}

export default function LedgerDashboard({
  txs, treatments, doctors, patients, doctorPayments, installments, partners, debts,
  initialStart, initialEnd, onChanged, onPatientClick,
}: {
  txs: FinTx[]
  treatments: FinTreatment[]
  doctors: FinDoctor[]
  patients: FinPatient[]
  doctorPayments: DoctorPayment[]
  installments: FinInstallment[]
  partners: FinBusinessPartner[]
  debts: ClinicDebt[]
  initialStart: string
  initialEnd: string
  onChanged: () => void
  onPatientClick: (id: number) => void
}) {
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)
  const [period, setPeriod] = useState<Period>('monthly')
  const [modal, setModal] = useState<'expense' | 'fixed' | 'company' | 'doctor' | null>(null)
  const [payDebt, setPayDebt] = useState<ClinicDebt | null>(null)
  const [pending, begin] = useTransition()

  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, `${p.name} ${p.surname}`])), [patients])
  const doctorMap = useMemo(() => new Map(doctors.map((d) => [d.id, d.name])), [doctors])
  const partnerMap = useMemo(() => new Map(partners.map((p) => [p.id, p.name])), [partners])
  const treatmentMap = useMemo(() => new Map(treatments.map((t) => [t.id, t.treatment_name])), [treatments])
  const filtered = useMemo(
    () => txs.filter((t) => t.transaction_date >= start && t.transaction_date <= end),
    [txs, start, end]
  )
  const income = filtered.filter((t) => t.type === 'payment')
  const expense = filtered.filter((t) => t.type === 'expense')
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = expense.reduce((sum, t) => sum + t.amount, 0)
  const net = totalIncome - totalExpense
  const pendingPayments = installments
    .filter((i) => !i.paid && i.due_date >= start && i.due_date <= end)
    .reduce((sum, i) => sum + i.amount, 0)
  const fixedTotal = expense.filter((t) => t.source_type === 'fixed_expense' || t.category === 'Sabit Gider').reduce((s, t) => s + t.amount, 0)
  const doctorTotal = doctorPayments.filter((p) => p.payment_date >= start && p.payment_date <= end).reduce((s, p) => s + p.amount, 0)
  const companyTotal = expense.filter((t) => t.partner_id).reduce((s, t) => s + t.amount, 0)

  const trend = useMemo(() => {
    const buckets = new Map<string, { label: string; Gelir: number; Gider: number }>()
    filtered.forEach((tx) => {
      const p = periodKey(tx.transaction_date, period)
      const item = buckets.get(p.key) ?? { label: p.label, Gelir: 0, Gider: 0 }
      if (tx.type === 'payment') item.Gelir += tx.amount
      if (tx.type === 'expense') item.Gider += tx.amount
      buckets.set(p.key, item)
    })
    return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value)
  }, [filtered, period])

  const monthly = useMemo(() => {
    const year = Number(end.slice(0, 4))
    return MONTHS.map((ay, month) => {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`
      const rows = txs.filter((t) => t.transaction_date.startsWith(key))
      return {
        ay,
        Gelir: rows.filter((t) => t.type === 'payment').reduce((s, t) => s + t.amount, 0),
        Gider: rows.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      }
    })
  }, [txs, end])

  const dueDebts = debts.filter((d) => d.status === 'active' && d.due_date && d.due_date <= localDateValue())
  const companyRows = expense.filter((t) => t.partner_id)
  const doctorRows = expense.filter((t) => t.doctor_id || t.source_type === 'doctor_payment')

  const remove = (id: number) => begin(async () => {
    const result = await deleteTransaction(id)
    if (result?.error) toast.error(result.error)
    else { toast.success('Gider kaydı silindi'); onChanged() }
  })

  return (
    <div className="space-y-6">
      {dueDebts.length > 0 && (
        <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
          <p className="font-black">Ödeme hatırlatıcısı</p>
          {dueDebts.slice(0, 3).map((debt) => (
            <p key={debt.id} className="mt-1 font-semibold">Bugün ödenmesi gereken sabit gideriniz var: {debt.title} - {money(debt.total_amount - debt.paid_amount)}</p>
          ))}
        </div>
      )}

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-base font-black text-[#142536]">Finansal Özet Panosu</h2><p className="mt-1 text-xs font-semibold text-slate-400">Seçilen tarih aralığındaki tüm finansal hareketler</p></div>
          <div className="flex flex-wrap items-end gap-3">
            <DateField label="Başlangıç" value={start} onChange={setStart} />
            <DateField label="Bitiş" value={end} onChange={setEnd} />
            <button onClick={() => setModal('expense')} className="h-10 rounded-xl bg-[#1EAEA0] px-4 text-xs font-black text-white shadow-lg">+ Gider Ekle</button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="Toplam gelir" value={totalIncome} tone="green" />
          <Summary label="Toplam gider" value={totalExpense} tone="red" />
          <Summary label="Net kâr" value={net} tone={net >= 0 ? 'green' : 'red'} />
          <Summary label="Tahsil edilen" value={totalIncome} tone="blue" />
          <Summary label="Bekleyen ödemeler" value={pendingPayments} tone="amber" />
          <Summary label="Sabit gider toplamı" value={fixedTotal} />
          <Summary label="Hekim hakediş ödemeleri" value={doctorTotal} tone="violet" />
          <Summary label="Firma ödemeleri" value={companyTotal} tone="red" />
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <SectionHeader title="Gelir-Gider Kayıtları" subtitle={`${dateText(start)} – ${dateText(end)} arasında ${filtered.length} kayıt`} />
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-[11px] font-black uppercase tracking-wide text-slate-400"><tr>{['Tarih', 'Tür', 'Açıklama', 'Bağlantı', 'Yöntem', 'Tutar', ''].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead>
            <tbody>{filtered.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-sm font-semibold text-slate-400">Bu tarih aralığında kayıt bulunmuyor.</td></tr> : filtered.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                <td className="px-5 py-4 font-semibold text-slate-500">{dateText(t.transaction_date)}</td>
                <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${t.type === 'payment' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{t.type === 'payment' ? 'Gelir' : 'Gider'}</span></td>
                <td className="max-w-[260px] truncate px-5 py-4 font-bold text-[#142536]">{t.description || t.category || '—'}</td>
                <td className="px-5 py-4 text-xs font-semibold text-slate-500">{t.patient_id ? <button className="hover:underline" onClick={() => onPatientClick(t.patient_id!)}>{patientMap.get(t.patient_id) || `Hasta #${t.patient_id}`}</button> : t.doctor_id ? `Dt. ${doctorMap.get(t.doctor_id) || t.doctor_id}` : t.partner_id ? partnerMap.get(t.partner_id) : '—'}</td>
                <td className="px-5 py-4 text-xs font-semibold text-slate-500">{METHOD_LABEL[t.method || ''] || t.method || '—'}</td>
                <td className={`px-5 py-4 text-right font-black ${t.type === 'payment' ? 'text-emerald-600' : 'text-red-600'}`}>{t.type === 'payment' ? '+' : '-'}{money(t.amount)}</td>
                <td className="px-5 py-4 text-right">{t.type === 'expense' && <button disabled={pending} onClick={() => remove(t.id)} className="text-xs font-bold text-slate-400 hover:text-red-600">Sil</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Aylara Göre Gelir-Gider" subtitle={`${end.slice(0, 4)} yılı aylık karşılaştırması`}>
          <ResponsiveContainer width="100%" height={310}><BarChart data={monthly} margin={{ left: 8, right: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F6" /><XAxis dataKey="ay" tick={{ fontSize: 11 }} /><YAxis tickFormatter={(v) => `${Math.round(v / 100000)}B`} tick={{ fontSize: 10 }} /><Tooltip content={<ChartTooltip />} /><Legend /><Bar name="Gelir" dataKey="Gelir" fill="#22C55E" radius={[6, 6, 0, 0]} /><Bar name="Gider" dataKey="Gider" fill="#EF4444" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Gelir-Gider Eğilimi" subtitle="Seçilen aralığın dönemsel değişimi" action={<div className="flex rounded-xl bg-slate-100 p-1">{(Object.keys(PERIOD_LABEL) as Period[]).map((p) => <button key={p} onClick={() => setPeriod(p)} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-black ${period === p ? 'bg-white text-[#0F766E] shadow-sm' : 'text-slate-400'}`}>{PERIOD_LABEL[p]}</button>)}</div>}>
          <ResponsiveContainer width="100%" height={310}><LineChart data={trend} margin={{ left: 8, right: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F6" /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tickFormatter={(v) => `${Math.round(v / 100000)}B`} tick={{ fontSize: 10 }} /><Tooltip content={<ChartTooltip />} /><Legend /><Line name="Gelir" dataKey="Gelir" stroke="#22C55E" strokeWidth={3} dot={{ r: 3 }} /><Line name="Gider" dataKey="Gider" stroke="#EF4444" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>
        </ChartCard>
      </div>

      <ManagementSection title="Aylık Sabit Giderler" subtitle="Düzenli ödemeler ve yaklaşan vadeler" button="Sabit Gider Ekle" onAdd={() => setModal('fixed')}>
        {debts.filter((d) => d.status !== 'cancelled').length === 0 ? <Empty text="Henüz sabit gider tanımlanmadı." /> : debts.filter((d) => d.status !== 'cancelled').map((d) => <ManagementRow key={d.id} title={d.title} meta={`${d.due_date ? dateText(d.due_date) : 'Vade yok'} • ${d.recurrence === 'aylik' ? 'Aylık' : d.recurrence === 'yillik' ? 'Yıllık' : 'Tek seferlik'}${d.account_name ? ` • ${d.account_name}` : ''}`} amount={d.total_amount - d.paid_amount} badge={d.status === 'paid' ? 'Ödendi' : 'Bekliyor'} action={d.status === 'active' ? <button onClick={() => setPayDebt(d)} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">Öde</button> : null} />)}
      </ManagementSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <ManagementSection title="Firma Ödemeleri" subtitle="Firma, hasta ve tedavi bağlantılı giderler" button="Firma Ödemesi" onAdd={() => setModal('company')}>
          {companyRows.length === 0 ? <Empty text="Seçilen dönemde firma ödemesi yok." /> : companyRows.slice(0, 8).map((t) => <ManagementRow key={t.id} title={partnerMap.get(t.partner_id!) || `Firma #${t.partner_id}`} meta={`${dateText(t.transaction_date)}${t.patient_id ? ` • ${patientMap.get(t.patient_id)}` : ''}${t.treatment_id ? ` • ${treatmentMap.get(t.treatment_id)}` : ''} • ${t.invoice_status === 'faturali' ? 'Faturalı' : 'Fatura bekliyor'}`} amount={t.amount} badge={t.payment_status === 'bekliyor' ? 'Bekliyor' : 'Ödendi'} />)}
        </ManagementSection>
        <ManagementSection title="Hekim Hakediş Bağlantılı Giderler" subtitle="Hakediş ile Defter arasında çift yönlü senkron" button="Hekim Ödemesi" onAdd={() => setModal('doctor')}>
          {doctorRows.length === 0 ? <Empty text="Seçilen dönemde hekim ödemesi yok." /> : doctorRows.slice(0, 8).map((t) => <ManagementRow key={t.id} title={`Dt. ${doctorMap.get(t.doctor_id!) || 'Hekim'}`} meta={`${dateText(t.transaction_date)} • ${METHOD_LABEL[t.method || ''] || 'Diğer'} • Hakedişe işlendi`} amount={t.amount} badge="Senkron" />)}
        </ManagementSection>
      </div>

      {modal && <EntryModal mode={modal} doctors={doctors} partners={partners} patients={patients} treatments={treatments} onClose={() => setModal(null)} onSuccess={() => { setModal(null); onChanged() }} />}
      {payDebt && <PayDebtModal debt={payDebt} onClose={() => setPayDebt(null)} onSuccess={() => { setPayDebt(null); onChanged() }} />}
    </div>
  )
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}<input type="date" value={value} max={label === 'Başlangıç' ? undefined : undefined} onChange={(e) => onChange(e.target.value)} className="mt-1 block h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-[#2DD4BF]" /></label>
}

function Summary({ label, value, tone = 'slate' }: { label: string; value: number; tone?: string }) {
  const colors: Record<string, string> = { green: 'text-emerald-600 bg-emerald-50', red: 'text-red-600 bg-red-50', blue: 'text-blue-600 bg-blue-50', amber: 'text-amber-600 bg-amber-50', violet: 'text-violet-600 bg-violet-50', slate: 'text-slate-700 bg-slate-50' }
  return <div className={`rounded-[18px] p-4 ${colors[tone] || colors.slate}`}><p className="text-[10px] font-black uppercase tracking-wide opacity-70">{label}</p><p className="mt-2 text-xl font-black">{money(value)}</p></div>
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5"><div><h3 className="font-black text-[#142536]">{title}</h3><p className="mt-1 text-xs font-semibold text-slate-400">{subtitle}</p></div>{action}</div>
}

function ChartCard({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return <section className="rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]"><SectionHeader title={title} subtitle={subtitle} action={action} /><div className="p-4">{children}</div></section>
}

function ManagementSection({ title, subtitle, button, onAdd, children }: { title: string; subtitle: string; button: string; onAdd: () => void; children: ReactNode }) {
  return <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]"><SectionHeader title={title} subtitle={subtitle} action={<button onClick={onAdd} className="rounded-xl border border-[#BFEFE8] bg-[#E9FBF8] px-3 py-2 text-xs font-black text-[#0F766E]">+ {button}</button>} /><div className="divide-y divide-slate-100 px-6">{children}</div></section>
}

function ManagementRow({ title, meta, amount, badge, action }: { title: string; meta: string; amount: number; badge: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-4 py-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-[#142536]">{title}</p><p className="mt-1 truncate text-xs font-semibold text-slate-400">{meta}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{badge}</span><strong className="text-sm text-red-600">{money(amount)}</strong>{action}</div>
}

function Empty({ text }: { text: string }) { return <p className="py-8 text-center text-sm font-semibold text-slate-400">{text}</p> }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="Kapat" /><div className="relative max-h-[92vh] w-full max-w-2xl overflow-auto rounded-[24px] bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5"><h3 className="font-black text-[#142536]">{title}</h3><button onClick={onClose} className="h-8 w-8 rounded-lg bg-slate-100 text-slate-500">×</button></div>{children}</div></div>
}

const field = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#2DD4BF]'
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs font-black text-slate-500">{label}<div className="mt-1.5">{children}</div></label> }

function EntryModal({ mode, doctors, partners, patients, treatments, onClose, onSuccess }: { mode: 'expense' | 'fixed' | 'company' | 'doctor'; doctors: FinDoctor[]; partners: FinBusinessPartner[]; patients: FinPatient[]; treatments: FinTreatment[]; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(localDateValue())
  const [description, setDescription] = useState('')
  const [method, setMethod] = useState('cash')
  const [account, setAccount] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [patientId, setPatientId] = useState('')
  const [treatmentId, setTreatmentId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [invoiceStatus, setInvoiceStatus] = useState('belirsiz')
  const [paymentStatus, setPaymentStatus] = useState('odendi')
  const [recurrence, setRecurrence] = useState('aylik')
  const [paymentDay, setPaymentDay] = useState(String(new Date().getDate()))
  const [pending, begin] = useTransition()
  const selectedTreatments = treatments.filter((t) => !patientId || t.patient_id === Number(patientId))
  const title = mode === 'fixed' ? 'Sabit Gider Tanımla' : mode === 'company' ? 'Firma Ödemesi Kaydet' : mode === 'doctor' ? 'Hekim Ödemesi Kaydet' : 'Gider Kaydet'

  const save = () => begin(async () => {
    const amountKurus = parseAmount(amount)
    if (!amountKurus) { toast.error('Geçerli bir tutar girin'); return }
    if (mode === 'fixed') {
      const result = await addClinicDebt({ title: description, totalAmount: amountKurus, dueDate: date, recurrence, notes: null, paymentDay: Number(paymentDay) || null, paymentMethod: method, accountName: account })
      if (result?.error) toast.error(result.error); else { toast.success('Sabit gider tanımlandı'); onSuccess() }
      return
    }
    if (mode === 'doctor' && !doctorId) { toast.error('Hekim seçin'); return }
    if (mode === 'company' && !partnerId) { toast.error('Firma seçin'); return }
    const result = await addExpense({ amount, date, description: description || (mode === 'company' ? 'Firma ödemesi' : mode === 'doctor' ? 'Hekim hakediş ödemesi' : 'Gider'), category: mode === 'doctor' ? 'Hekim Hakediş' : mode === 'company' ? 'Firma Ödemesi' : undefined, invoiceNo, method, accountName: account, doctorId: doctorId ? Number(doctorId) : null, partnerId: partnerId ? Number(partnerId) : null, patientId: patientId ? Number(patientId) : null, treatmentId: treatmentId ? Number(treatmentId) : null, invoiceStatus, paymentStatus })
    if (result?.error) toast.error(result.error); else { toast.success(mode === 'doctor' ? 'Ödeme Hakediş ve Gider bölümlerine işlendi' : 'Gider kaydedildi'); onSuccess() }
  })

  return <Modal title={title} onClose={onClose}><div className="grid gap-4 p-6 sm:grid-cols-2">
    {mode === 'doctor' && <Field label="Hekim"><select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={field}><option value="">Hekim seçin</option>{doctors.map((d) => <option key={d.id} value={d.id}>Dt. {d.name}</option>)}</select></Field>}
    {mode === 'company' && <Field label="Firma"><select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={field}><option value="">Firma seçin</option>{partners.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
    <Field label={mode === 'fixed' ? 'Gider adı' : 'Açıklama'}><input value={description} onChange={(e) => setDescription(e.target.value)} className={field} placeholder={mode === 'fixed' ? 'Klinik kirası' : 'Ödeme açıklaması'} /></Field>
    <Field label="Tutar (₺)"><input value={amount} onChange={(e) => setAmount(e.target.value)} className={field} placeholder="0,00" /></Field>
    <Field label={mode === 'fixed' ? 'İlk ödeme tarihi' : 'Ödeme tarihi'}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></Field>
    <Field label="Ödeme yöntemi"><select value={method} onChange={(e) => setMethod(e.target.value)} className={field}><option value="cash">Nakit / Kasa</option><option value="transfer">Banka transferi</option><option value="card">Kart</option><option value="check">Çek</option><option value="other">Diğer</option></select></Field>
    <Field label="İlgili kasa / banka"><input value={account} onChange={(e) => setAccount(e.target.value)} className={field} placeholder="Ana Kasa / İş Bankası" /></Field>
    {mode === 'fixed' && <><Field label="Ödeme günü"><input type="number" min="1" max="31" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} className={field} /></Field><Field label="Tekrarlama sıklığı"><select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={field}><option value="aylik">Aylık</option><option value="yillik">Yıllık</option><option value="tek_seferlik">Tek seferlik</option></select></Field></>}
    {mode === 'company' && <><Field label="İlgili hasta"><select value={patientId} onChange={(e) => { setPatientId(e.target.value); setTreatmentId('') }} className={field}><option value="">Hasta seçilmedi</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name} {p.surname}</option>)}</select></Field><Field label="İlgili tedavi"><select value={treatmentId} onChange={(e) => setTreatmentId(e.target.value)} className={field}><option value="">Tedavi seçilmedi</option>{selectedTreatments.map((t) => <option key={t.id} value={t.id}>{t.treatment_name}</option>)}</select></Field><Field label="Fatura no"><input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className={field} /></Field><Field label="Fatura durumu"><select value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)} className={field}><option value="belirsiz">Fatura bekleniyor</option><option value="faturali">Faturalı</option><option value="faturasiz">Faturasız</option></select></Field><Field label="Ödeme durumu"><select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className={field}><option value="odendi">Ödendi</option><option value="bekliyor">Bekliyor</option></select></Field></>}
    <div className="flex gap-3 pt-3 sm:col-span-2"><button onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-black text-slate-500">İptal</button><button disabled={pending} onClick={save} className="h-11 flex-1 rounded-xl bg-[#1EAEA0] text-sm font-black text-white disabled:opacity-50">{pending ? 'Kaydediliyor…' : 'Kaydet'}</button></div>
  </div></Modal>
}

function PayDebtModal({ debt, onClose, onSuccess }: { debt: ClinicDebt; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState(((debt.total_amount - debt.paid_amount) / 100).toLocaleString('tr-TR'))
  const [pending, begin] = useTransition()
  const save = () => begin(async () => { const result = await payClinicDebt(debt.id, parseAmount(amount)); if (result?.error) toast.error(result.error); else { toast.success('Ödeme giderlere işlendi'); onSuccess() } })
  return <Modal title="Sabit Gider Ödemesi" onClose={onClose}><div className="space-y-4 p-6"><p className="text-sm font-bold text-slate-600">{debt.title} • Kalan {money(debt.total_amount - debt.paid_amount)}</p><Field label="Ödenecek tutar (₺)"><input value={amount} onChange={(e) => setAmount(e.target.value)} className={field} /></Field><div className="flex gap-3"><button onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-200 font-black text-slate-500">İptal</button><button disabled={pending} onClick={save} className="h-11 flex-1 rounded-xl bg-[#1EAEA0] font-black text-white">Öde ve Gidere İşle</button></div></div></Modal>
}
