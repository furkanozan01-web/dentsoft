'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import {
  addInstallment,
  addReminder,
  autoInstallment,
  closeTreatmentAccount,
  createPromissoryPlan,
  deleteInstallment,
  deletePayment,
  deleteReminder,
  markInstallmentPaid,
  markReminderDone,
} from './actions'
import DonutChart from './PatientCharts'
import { localDateValue, formatAmount } from '@/lib/format'
import TreatmentStatementPrint, { printTreatmentStatement } from './TreatmentStatementPrint'
import SenetPrint, { printSenetPlan, type SenetRow } from './SenetPrint'
import ToothChart, { classifyTreatment, type ToothFlags } from './ToothChart'
import { FDI } from './constants'
import type { ClinicInfo, Installment, Patient, PatientReminder, Transaction, Treatment } from './types'

// ---- Hesap Tab ----
function HesapTab({
  patient,
  transactions,
  treatments,
  clinic,
  installments,
  reminders,
  loading,
  onAddPayment,
  onChanged,
}: {
  patient: Patient
  transactions: Transaction[]
  treatments: Treatment[]
  clinic: ClinicInfo | null
  installments: Installment[]
  reminders: PatientReminder[]
  loading: boolean
  onAddPayment: () => void
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const [delPending, startDel] = useTransition()
  const [closePending, startClose] = useTransition()
  const [showClosed, setShowClosed] = useState(false)

  const hasOpenTreatments = treatments.some((t) => !t.is_closed)
  const hasClosedTreatments = treatments.some((t) => t.is_closed)
  const visibleTreatments = showClosed ? treatments : treatments.filter((t) => !t.is_closed)

  // Minyatür diş şeması — Oral sekmesindeki aynı mantıkla tedavi sembolleri
  const miniToothStates = useMemo(() => {
    const m = new Map<number, ToothFlags>()
    for (const t of visibleTreatments) {
      if (!t.tooth) continue
      const kind = classifyTreatment(t.treatment_name)
      if (!kind) continue
      const cur = m.get(t.tooth) ?? {}
      cur[kind] = true
      m.set(t.tooth, cur)
    }
    return m
  }, [visibleTreatments])
  const miniExtractedTeeth = useMemo(() => {
    const set = new Set<number>()
    for (const t of visibleTreatments) {
      if (!t.tooth) continue
      const n = t.treatment_name.toLowerCase()
      if (n.includes('çekim') || n.includes('cekim')) set.add(t.tooth)
    }
    return set
  }, [visibleTreatments])

  const totalOwed = treatments.reduce((s, t) => s + (t.fee ?? 0), 0)
  const payments = transactions.filter((t) => t.type === 'payment')
  const totalPaid = payments.reduce((s, t) => s + (t.amount ?? 0), 0)
  const balance = totalOwed - totalPaid

  const handleDeletePayment = async (tx: Transaction) => {
    const ok = await confirm({
      title: 'Ödemeyi Sil',
      message: `₺${formatAmount(tx.amount)} tutarındaki ödeme kaydı silinecek. Bakiyeler yeniden hesaplanacak. Emin misiniz?`,
      confirmText: 'Evet, Sil',
    })
    if (!ok) return
    startDel(async () => {
      const res = await deletePayment(tx.id)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Ödeme silindi')
        onChanged()
      }
    })
  }

  const handleCloseAccount = async () => {
    const ok = await confirm({
      title: 'Hesabı Kapat',
      message: 'Tüm açık tedaviler kapalı olarak işaretlenecek. Bu işlem, hesabın fatura edildiğini ve artık aktif olmadığını gösterir. Devam etmek istiyor musunuz?',
      confirmText: 'Evet, Hesabı Kapat',
    })
    if (!ok) return
    startClose(async () => {
      const res = await closeTreatmentAccount(patient.id)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Hesap kapatıldı')
        onChanged()
      }
    })
  }

  // Spec §4.3.5: borç yoksa ödeme oranı %100 sayılır (ödenecek bir şey yok)
  const ratio = totalOwed > 0 ? Math.min(totalPaid / totalOwed, 1) : 1
  const clampedBalance = Math.max(balance, 0)

  const methodLabel: Record<string, string> = {
    cash: 'Nakit',
    card: 'Kart',
    transfer: 'Havale',
    firma_odemesi: 'Firma',
    other: 'Diğer',
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-[24px] border border-slate-200/90 bg-white py-16 text-sm font-semibold text-slate-400 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        Yükleniyor...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Borç Özeti */}
        <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <SectionHeader
            icon={<IconChart />}
            title="Borç Özeti"
            description="Hastanın toplam borç ve ödeme durumu"
            iconClassName="bg-[#FFF7E6] text-[#B45309]"
          />

          <div className="mt-5 rounded-[20px] border border-[#E7ECF2] bg-[#FAFBFC] px-6 py-5 text-center">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Kalan Borç</p>
            <p className={`mt-1 text-3xl font-black ${clampedBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₺{formatAmount(clampedBalance)}
            </p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
            <div className="overflow-hidden rounded-[18px] border border-[#E7ECF2]">
              {visibleTreatments.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs font-semibold text-slate-400">Henüz işlem kaydı yok.</p>
              ) : (
                <>
                  {visibleTreatments.map((tr) => (
                    <FinanceLine key={tr.id} label={tr.treatment_name} value={`₺${formatAmount(tr.fee)}`} />
                  ))}
                  <FinanceLine label="Toplam Ücret" value={`₺${formatAmount(totalOwed)}`} strong />
                </>
              )}
            </div>
            <div className="flex items-center justify-center overflow-hidden rounded-[18px] border border-[#E7ECF2] bg-[#FAFBFC] p-2">
              {/* zoom (transform yerine) katman boyutunu da küçültür, taşma olmaz */}
              <div style={{ zoom: 0.22 }}>
                <ToothChart
                  upperTeeth={FDI.upperPermanent}
                  lowerTeeth={FDI.lowerPermanent}
                  selected={null}
                  states={miniToothStates}
                  hiddenTeeth={miniExtractedTeeth}
                  onSelect={() => undefined}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col items-center gap-2 border-t border-[#EEF2F6] pt-5">
            <DonutChart ratio={ratio} />
            <p className="text-sm font-black text-[#142536]">Ödeme Oranı: %{Math.round(ratio * 100)}</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-[#EEF2F6] pt-5">
            {hasClosedTreatments && (
              <button
                type="button"
                onClick={() => setShowClosed((v) => !v)}
                className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-black transition ${showClosed ? 'border-[#0F766E] bg-[#E6FFFA] text-[#0F766E]' : 'border-[#D9E4EA] bg-white text-[#315164] hover:bg-slate-50'}`}
              >
                <IconEye />
                {showClosed ? 'Kapalıları Gizle' : 'Kapalı Hesabı Göster'}
              </button>
            )}
            {hasOpenTreatments && (
              <button
                type="button"
                onClick={handleCloseAccount}
                disabled={closePending}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 text-[11px] font-black text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <IconLock />
                Hesabı Kapat
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!printTreatmentStatement(patient.id)) toast.error('Yazdırma alanı hazırlanamadı')
              }}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#D9E4EA] bg-white px-3 text-[11px] font-black text-[#315164] transition hover:bg-slate-50"
            >
              <IconPrint />
              Yazdır
            </button>
          </div>
        </section>

        {/* Ödeme Geçmişi */}
        <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <SectionHeader
              icon={<IconCreditCard />}
              title="Ödeme Geçmişi"
              description="Hasta ödemeleri ve tahsilat hareketleri"
              iconClassName="bg-[#EAF7FF] text-[#0284C7]"
            />
            <button
              onClick={onAddPayment}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 text-xs font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:brightness-105"
            >
              <IconPlus />
              Ödeme Ekle
            </button>
          </div>

          {payments.length === 0 ? (
            <EmptyState
              icon={<IconCreditCardLarge />}
              title="Henüz ödeme kaydı yok."
              description="Hasta ödeme yaptığında kayıtlar burada görüntülenir."
              action={
                <button
                  onClick={onAddPayment}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] border border-[#BFEFE8] bg-[#E9FBF8] px-4 text-xs font-black text-[#0F766E] transition hover:bg-[#DDF8F4]"
                >
                  <IconPlus />
                  Ödeme Ekle
                </button>
              }
            />
          ) : (
            <>
              <div className="mb-4 inline-flex w-fit rounded-full bg-[#E6FFFA] px-3 py-1.5 text-sm font-black text-[#0F766E]">
                Toplam Ödeme: ₺{formatAmount(totalPaid)}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-xs">
                  <thead className="bg-[#FAFBFC]">
                    <tr className="h-12 border-b border-[#EEF2F6]">
                      {['Tarih', 'Tutar', 'Yöntem', 'Açıklama', ''].map((h) => (
                        <th key={h} className="px-4 text-left font-black uppercase tracking-wide text-slate-400">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((tx) => (
                      <tr key={tx.id} className="h-16 border-b border-[#EEF2F6] transition last:border-0 hover:bg-[#5FD3C1]/[0.04]">
                        <td className="px-4 font-semibold text-slate-500">
                          {new Date(tx.transaction_date).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="px-4">
                          <span className="font-black text-[#0F2B3D]">₺{formatAmount(tx.amount)}</span>
                          {tx.original_currency && tx.original_currency !== 'TRY' && tx.original_amount && tx.exchange_rate && (
                            <span className="ml-2 text-[11px] font-semibold text-slate-400">
                              ({Math.round(tx.original_amount / 100).toLocaleString('tr-TR')} {tx.original_currency} @ {Number(tx.exchange_rate).toLocaleString('tr-TR', { minimumFractionDigits: 2 })})
                            </span>
                          )}
                        </td>
                        <td className="px-4 text-slate-500">
                          <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 font-bold text-[#142536]">
                            {methodLabel[tx.method ?? ''] ?? tx.method ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 font-medium text-slate-500">
                          {tx.method === 'firma_odemesi' && tx.partner_name ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                              🏢 {tx.partner_name}
                            </span>
                          ) : (
                            <span className="max-w-[160px] truncate block" title={tx.description ?? ''}>{tx.description || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 text-right">
                          <button
                            onClick={() => handleDeletePayment(tx)}
                            disabled={delPending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            title="Ödemeyi sil"
                          >
                            <IconTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PaymentPlanCard
          patientId={patient.id}
          installments={installments}
          reminders={reminders}
          balance={balance}
          onChanged={onChanged}
        />
        <SenetRobotuCard
          patientId={patient.id}
          patient={patient}
          clinic={clinic}
          balance={balance}
          onChanged={onChanged}
        />
      </div>

      <TreatmentStatementPrint
        patient={patient}
        treatments={treatments}
        transactions={transactions}
        clinic={clinic}
        installments={installments}
      />
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  description,
  iconClassName,
}: {
  icon: React.ReactNode
  title: string
  description: string
  iconClassName: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClassName}`}>
        {icon}
      </span>
      <div>
        <h2 className="text-base font-black text-[#0F2B3D]">{title}</h2>
        <p className="mt-0.5 text-xs font-medium text-slate-400">{description}</p>
      </div>
    </div>
  )
}

function FinanceLine({
  label,
  value,
  valueClassName = 'text-[#0F2B3D]',
  strong = false,
}: {
  label: string
  value: string
  valueClassName?: string
  strong?: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-[#EEF2F6] px-4 py-3 last:border-0 ${strong ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
      <span className={`text-sm ${strong ? 'font-black text-[#142536]' : 'font-semibold text-slate-500'}`}>{label}</span>
      <span className={`text-sm font-black ${valueClassName}`}>{value}</span>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
  compact?: boolean
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-[#FAFBFC] px-6 text-center ${compact ? 'min-h-[160px] py-6' : 'min-h-[210px] py-8'}`}>
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-[#0F766E] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
        {icon}
      </span>
      <h3 className="text-sm font-black text-[#142536]">{title}</h3>
      <p className="mt-2 max-w-md text-xs font-medium leading-5 text-slate-400">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ---- Ödeme Planı (Taksit + Hatırlatıcılar) kartı ----
function PaymentPlanCard({
  patientId,
  installments,
  reminders,
  balance,
  onChanged,
}: {
  patientId: number
  installments: Installment[]
  reminders: PatientReminder[]
  balance: number
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [showAuto, setShowAuto] = useState(false)
  const [autoMonths, setAutoMonths] = useState('3')
  const [dueDate, setDueDate] = useState('')
  const [amount, setAmount] = useState('')
  const [showRemindAdd, setShowRemindAdd] = useState(false)
  const [remDate, setRemDate] = useState('')
  const [remNote, setRemNote] = useState('')

  const today = localDateValue()

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>) => {
    startTransition(async () => {
      const res = await fn()
      if (res.error) toast.error(res.error)
      else onChanged()
    })
  }

  const handleAuto = () => {
    const months = parseInt(autoMonths, 10)
    if (isNaN(months) || months < 1) {
      toast.error('Geçerli bir taksit sayısı girin')
      return
    }
    setShowAuto(false)
    run(() => autoInstallment(patientId, months))
  }

  const handleAdd = () => {
    run(async () => {
      const res = await addInstallment(patientId, dueDate, amount)
      if (res.success) {
        setShowAdd(false)
        setDueDate('')
        setAmount('')
      }
      return res
    })
  }

  const handleAddReminder = () => {
    if (!remDate) { toast.error('Tarih seçin'); return }
    run(async () => {
      const res = await addReminder(patientId, remDate, remNote)
      if (res.success) { setShowRemindAdd(false); setRemDate(''); setRemNote('') }
      return res
    })
  }

  const overdueInstallments = installments.filter((it) => !it.paid && it.due_date < today)
  const noPlan = balance > 0 && installments.length === 0
  const activeReminders = reminders.filter((r) => !r.is_done)
  const doneReminders = reminders.filter((r) => r.is_done)

  return (
    <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          icon={<IconCalendar />}
          title="Ödeme Planı / Taksitlendirme"
          description="Hasta için planlanan taksitler ve ödeme tarihleri"
          iconClassName="bg-[#F3E8FF] text-[#7C3AED]"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 text-xs font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:brightness-105"
          >
            <IconPlus />
            Taksit Ekle
          </button>
          <button
            onClick={() => setShowAuto(true)}
            disabled={pending || balance <= 0}
            className="inline-flex h-10 items-center justify-center rounded-[14px] border border-[#E7ECF2] bg-white px-4 text-xs font-black text-[#142536] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={balance <= 0 ? 'Bölünecek kalan borç yok' : ''}
          >
            Otomatik Taksitlendir
          </button>
        </div>
      </div>

      {installments.length === 0 ? (
        <EmptyState
          icon={<IconCalendarLarge />}
          title="Henüz taksit planı yok."
          description="Taksit ekleyerek veya otomatik taksitlendirme ile ödeme planı oluşturabilirsiniz."
          compact
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-xs">
            <thead className="bg-[#FAFBFC]">
              <tr className="h-12 border-b border-[#EEF2F6]">
                {['Taksit', 'Vade Tarihi', 'Tutar', 'Durum', 'Aksiyon'].map((h) => (
                  <th key={h} className="px-4 text-left font-black uppercase tracking-wide text-slate-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {installments.map((it, index) => {
                const overdue = !it.paid && it.due_date < today
                return (
                  <tr key={it.id} className="h-16 border-b border-[#EEF2F6] transition last:border-0 hover:bg-[#5FD3C1]/[0.04]">
                    <td className="px-4 font-black text-[#142536]">#{index + 1}</td>
                    <td className="px-4 font-semibold text-slate-500">
                      {new Date(it.due_date).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-4 font-black text-[#0F2B3D]">₺{formatAmount(it.amount)}</td>
                    <td className="px-4">
                      <InstallmentStatusBadge paid={it.paid} overdue={overdue} />
                    </td>
                    <td className="px-4">
                      <div className="flex items-center gap-1">
                        {!it.paid && (
                          <button
                            onClick={() => run(() => markInstallmentPaid(it.id))}
                            disabled={pending}
                            className="rounded-xl bg-[#E9FBF8] px-3 py-1.5 text-[11px] font-black text-[#0F766E] transition hover:bg-[#DDF8F4] disabled:opacity-50"
                          >
                            Ödendi
                          </button>
                        )}
                        <button
                          onClick={() => run(() => deleteInstallment(it.id))}
                          disabled={pending}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="Taksiti sil"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="mt-4 rounded-[18px] border border-[#E7ECF2] bg-[#FAFBFC] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-11 rounded-[14px] border border-[#E7ECF2] bg-white px-3 text-sm font-semibold text-[#142536] outline-none transition focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
            />
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Tutar (₺)"
              className="h-11 rounded-[14px] border border-[#E7ECF2] bg-white px-3 text-sm font-semibold text-[#142536] outline-none transition placeholder:text-slate-400 focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleAdd}
              disabled={pending}
              className="rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 py-2 text-xs font-black text-white disabled:opacity-50"
            >
              Kaydet
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-[14px] border border-[#E7ECF2] bg-white px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {showAuto && (
        <div className="mt-4 flex flex-col gap-3 rounded-[18px] border border-[#E9D5FF] bg-[#FAF5FF] p-4 sm:flex-row sm:items-center">
          <label className="text-xs font-black text-[#6D28D9]">Taksit sayısı</label>
          <input
            type="number"
            min={1}
            max={60}
            value={autoMonths}
            onChange={(e) => setAutoMonths(e.target.value)}
            className="h-10 w-24 rounded-[12px] border border-[#E9D5FF] bg-white px-3 text-sm font-black text-[#142536] outline-none focus:border-[#A855F7]"
          />
          <button
            onClick={handleAuto}
            disabled={pending}
            className="rounded-[12px] bg-[#7C3AED] px-4 py-2 text-xs font-black text-white hover:bg-[#6D28D9] disabled:opacity-50"
          >
            Uygula
          </button>
          <button
            onClick={() => setShowAuto(false)}
            className="rounded-[12px] border border-[#E9D5FF] bg-white px-4 py-2 text-xs font-bold text-slate-500 hover:bg-white/70"
          >
            İptal
          </button>
        </div>
      )}

      {/* ── Hatırlatıcılar (aynı kart içinde) ── */}
      <div className="mt-6 border-t border-[#EEF2F6] pt-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <SectionHeader
            icon={<IconAlertTriangle />}
            title="Hatırlatıcılar"
            description="Finansal takip ve özel hatırlatmalar"
            iconClassName="bg-[#FFF7E6] text-[#B45309]"
          />
          <button
            onClick={() => setShowRemindAdd((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-[#FED7AA] bg-[#FFF7E6] px-3 text-[11px] font-black text-[#B45309] transition hover:bg-[#FFEDD5]"
          >
            <IconPlus />
            Hatırlatıcı Ekle
          </button>
        </div>

        {showRemindAdd && (
          <div className="mb-4 rounded-[16px] border border-[#FED7AA] bg-[#FFFBF5] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="date"
                value={remDate}
                onChange={(e) => setRemDate(e.target.value)}
                className="h-10 rounded-[12px] border border-[#FED7AA] bg-white px-3 text-sm font-semibold text-[#142536] outline-none focus:border-[#F59E0B]"
              />
              <input
                type="text"
                value={remNote}
                onChange={(e) => setRemNote(e.target.value)}
                placeholder="Not (opsiyonel)"
                className="h-10 rounded-[12px] border border-[#FED7AA] bg-white px-3 text-sm font-semibold text-[#142536] outline-none placeholder:text-slate-400 focus:border-[#F59E0B]"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleAddReminder}
                disabled={pending}
                className="rounded-[12px] bg-[#B45309] px-4 py-2 text-xs font-black text-white hover:bg-[#92400E] disabled:opacity-50"
              >
                Kaydet
              </button>
              <button
                onClick={() => setShowRemindAdd(false)}
                className="rounded-[12px] border border-[#FED7AA] bg-white px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50"
              >
                İptal
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {overdueInstallments.map((it) => (
            <div key={`inst-${it.id}`} className="flex items-start gap-3 rounded-[14px] border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <IconAlertCircle />
              <span>Gecikmiş taksit: {new Date(it.due_date).toLocaleDateString('tr-TR')} — ₺{formatAmount(it.amount)}</span>
            </div>
          ))}

          {noPlan && (
            <div className="flex items-start gap-3 rounded-[14px] border border-[#FED7AA] bg-[#FFF7E6] px-4 py-3 text-sm font-semibold text-[#B45309]">
              <IconAlertTriangle />
              <span>Kalan borç var ama henüz ödeme planı oluşturulmadı.</span>
            </div>
          )}

          {activeReminders.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-[14px] border border-[#FED7AA] bg-[#FFFBF5] px-4 py-3">
              <span className="text-[11px] font-black text-[#B45309]">
                {new Date(r.reminder_date).toLocaleDateString('tr-TR')}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#142536]">
                {r.note || 'Hatırlatıcı'}
              </span>
              <button
                onClick={() => run(() => markReminderDone(r.id))}
                disabled={pending}
                className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-black text-green-700 transition hover:bg-green-200 disabled:opacity-50"
              >
                Tamam
              </button>
              <button
                onClick={() => run(() => deleteReminder(r.id))}
                disabled={pending}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <IconTrash />
              </button>
            </div>
          ))}

          {overdueInstallments.length === 0 && !noPlan && activeReminders.length === 0 && (
            <div className="rounded-[14px] border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              Tüm ödemeler güncel, bekleyen hatırlatıcı yok.
            </div>
          )}

          {doneReminders.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] font-bold text-slate-400 hover:text-slate-600">
                {doneReminders.length} tamamlanmış hatırlatıcı
              </summary>
              <div className="mt-2 space-y-1.5">
                {doneReminders.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-[12px] border border-slate-100 bg-slate-50 px-3 py-2 opacity-60">
                    <span className="text-[11px] font-black text-slate-400">
                      {new Date(r.reminder_date).toLocaleDateString('tr-TR')}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-400 line-through">
                      {r.note || 'Hatırlatıcı'}
                    </span>
                    <button
                      onClick={() => run(() => deleteReminder(r.id))}
                      disabled={pending}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-slate-300 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <IconTrash />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </section>
  )
}

function InstallmentStatusBadge({ paid, overdue }: { paid: boolean; overdue: boolean }) {
  if (paid) return <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-black text-green-700">Ödendi</span>
  if (overdue) return <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black text-red-700">Gecikti</span>
  return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-700">Bekliyor</span>
}

// ---- Senet Robotu kartı ----
// Kurallar: taksit tutarları tam bin TL'ye aşağı yuvarlanır, biriken küsürat
// son taksite eklenir; vade farkı taksit sayısı kadar bileşikleşir.
function buildInstallmentPreview(
  principalKurus: number,
  months: number,
  interestRate: number,
  startDate: Date
): SenetRow[] {
  const compoundTotal = Math.round(principalKurus * Math.pow(1 + interestRate / 100, months))
  const THOUSAND = 100_000 // 1.000 TL = 100.000 kuruş
  const base = Math.floor(compoundTotal / months / THOUSAND) * THOUSAND
  const shortfall = compoundTotal - base * months
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(startDate)
    d.setMonth(d.getMonth() + i + 1)
    return {
      dueDate: d.toISOString().slice(0, 10),
      amount: base + (i === months - 1 ? shortfall : 0),
    }
  })
}

function SenetRobotuCard({
  patientId,
  patient,
  clinic,
  balance,
  onChanged,
}: {
  patientId: number
  patient: Patient
  clinic: ClinicInfo | null
  balance: number
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [senetTitle, setSenetTitle] = useState('Senet Planı')
  const [senetMonths, setSenetMonths] = useState('3')
  const [senetRate, setSenetRate] = useState('0')
  const [senetPrincipal, setSenetPrincipal] = useState(() =>
    balance > 0 ? String(Math.round(balance / 100)) : ''
  )

  const senetPreview = (() => {
    const principal = parseFloat(senetPrincipal) * 100
    const months = parseInt(senetMonths, 10)
    const rate = parseFloat(senetRate)
    if (isNaN(principal) || isNaN(months) || isNaN(rate) || principal <= 0 || months < 1) return []
    return buildInstallmentPreview(principal, months, rate, new Date())
  })()

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>) => {
    startTransition(async () => {
      const res = await fn()
      if (res.error) toast.error(res.error)
      else onChanged()
    })
  }

  const handleSenet = () => {
    if (!senetPreview.length) {
      toast.error('Lütfen geçerli tutar, taksit sayısı ve oran girin')
      return
    }
    const rateBps = Math.round(parseFloat(senetRate) * 100)
    const rows = senetPreview.map((r) => ({ due_date: r.dueDate, amount: r.amount }))
    run(() => createPromissoryPlan(patientId, senetTitle, rateBps, rows))
  }

  const handlePrint = () => {
    if (!senetPreview.length) {
      toast.error('Önce geçerli bir senet planı oluşturun')
      return
    }
    if (!printSenetPlan(patient.id)) toast.error('Yazdırma alanı hazırlanamadı')
  }

  return (
    <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <SectionHeader
        icon={<IconRobot />}
        title="Senet Robotu"
        description="TC kanunlarına uygun, imzaya hazır senet planı oluşturun"
        iconClassName="bg-[#F3E8FF] text-[#7C3AED]"
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-wide text-[#7C3AED]">Başlık</label>
          <input
            type="text"
            value={senetTitle}
            onChange={(e) => setSenetTitle(e.target.value)}
            className="h-10 rounded-[12px] border border-[#E9D5FF] bg-white px-3 text-sm font-semibold text-[#142536] outline-none focus:border-[#A855F7]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-wide text-[#7C3AED]">Tutar (₺)</label>
          <input
            type="number"
            min={1}
            value={senetPrincipal}
            onChange={(e) => setSenetPrincipal(e.target.value)}
            placeholder="0"
            className="h-10 rounded-[12px] border border-[#E9D5FF] bg-white px-3 text-sm font-semibold text-[#142536] outline-none focus:border-[#A855F7]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-wide text-[#7C3AED]">Taksit Sayısı</label>
          <input
            type="number"
            min={1}
            max={60}
            value={senetMonths}
            onChange={(e) => setSenetMonths(e.target.value)}
            className="h-10 rounded-[12px] border border-[#E9D5FF] bg-white px-3 text-sm font-semibold text-[#142536] outline-none focus:border-[#A855F7]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-wide text-[#7C3AED]">Vade Farkı (% — bileşik)</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={senetRate}
            onChange={(e) => setSenetRate(e.target.value)}
            className="h-10 rounded-[12px] border border-[#E9D5FF] bg-white px-3 text-sm font-semibold text-[#142536] outline-none focus:border-[#A855F7]"
          />
        </div>
      </div>

      {senetPreview.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-[#7C3AED]">Önizleme (her taksit tam bin TL, küsürat son taksite eklenir)</p>
          <div className="overflow-x-auto rounded-[12px] border border-[#E9D5FF]">
            <table className="w-full min-w-[360px] text-xs">
              <thead className="bg-[#F3E8FF]">
                <tr className="h-9">
                  <th className="px-3 text-left font-black text-[#6D28D9]">#</th>
                  <th className="px-3 text-left font-black text-[#6D28D9]">Vade Tarihi</th>
                  <th className="px-3 text-left font-black text-[#6D28D9]">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {senetPreview.map((row, i) => (
                  <tr key={i} className="h-10 border-t border-[#E9D5FF]">
                    <td className="px-3 font-black text-[#142536]">{i + 1}</td>
                    <td className="px-3 text-slate-600">
                      {new Date(row.dueDate).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-3 font-black text-[#0F2B3D]">₺{formatAmount(row.amount)}</td>
                  </tr>
                ))}
                <tr className="h-10 border-t-2 border-[#C4B5FD] bg-[#F3E8FF]">
                  <td className="px-3 font-black text-[#6D28D9]" colSpan={2}>Toplam</td>
                  <td className="px-3 font-black text-[#6D28D9]">
                    ₺{formatAmount(senetPreview.reduce((s, r) => s + r.amount, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleSenet}
          disabled={pending || !senetPreview.length}
          className="rounded-[12px] bg-[#7C3AED] px-5 py-2 text-xs font-black text-white hover:bg-[#6D28D9] disabled:opacity-50"
        >
          Planı Oluştur
        </button>
        <button
          onClick={handlePrint}
          disabled={!senetPreview.length}
          className="inline-flex items-center gap-2 rounded-[12px] border border-[#E9D5FF] bg-white px-4 py-2 text-xs font-black text-[#7C3AED] hover:bg-[#FAF5FF] disabled:opacity-50"
        >
          <IconPrint />
          Yazdır
        </button>
      </div>

      <SenetPrint patient={patient} clinic={clinic} title={senetTitle} rows={senetPreview} />
    </section>
  )
}

function IconAlertCircle() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>
}

function IconChart() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-7" /></svg>
}

function IconCreditCard() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
}

function IconCreditCardLarge() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" /></svg>
}

function IconPlus() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
}

function IconTrash() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5" /><path d="M14 11v5" /></svg>
}

function IconCalendar() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>
}

function IconCalendarLarge() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /><path d="M8 15h3" /><path d="M14 15h2" /></svg>
}

function IconAlertTriangle() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
}

function IconPrint() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
}

function IconEye() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
}

function IconLock() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
}

function IconRobot() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M12 11V7" /><circle cx="12" cy="5" r="2" /><path d="M7 15h.01M17 15h.01" /><path d="M9 19h6" /></svg>
}


export default HesapTab
