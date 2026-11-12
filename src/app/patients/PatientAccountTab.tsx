'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { closeTreatmentAccount, deletePayment } from './actions'
import DonutChart from './PatientCharts'
import { formatAmount } from '@/lib/format'
import TreatmentStatementPrint, { printTreatmentStatement } from './TreatmentStatementPrint'
import PaymentHistoryPrint, { printPaymentHistory } from './PaymentHistoryPrint'
import type {
  ClinicInfo,
  Installment,
  Patient,
  PatientReminder,
  Transaction,
  Treatment,
} from './types'
import { SectionHeader, FinanceLine, EmptyState, IconPlus, IconTrash, IconPrint } from './accountShared'
import { PaymentPlanCard } from './AccountPaymentPlanCard'
import { SenetRobotuCard } from './AccountSenetRobotuCard'

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
    senet: 'Senet',
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

          <div className="mt-5 overflow-hidden rounded-[18px] border border-[#E7ECF2]">
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
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  if (!printPaymentHistory(patient.id)) toast.error('Yazdırma alanı hazırlanamadı')
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] border border-[#D9E4EA] bg-white px-4 text-xs font-black text-[#315164] transition hover:bg-slate-50"
              >
                <IconPrint />
                Yazdır
              </button>
              <button
                onClick={onAddPayment}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 text-xs font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:brightness-105"
              >
                <IconPlus />
                Ödeme Ekle
              </button>
            </div>
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
      <PaymentHistoryPrint patient={patient} clinic={clinic} transactions={transactions} />
    </div>
  )
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
function IconEye() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
}
function IconLock() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
}
export default HesapTab
