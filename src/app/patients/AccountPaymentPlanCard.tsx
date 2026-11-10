'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  addInstallment,
  addReminder,
  autoInstallment,
  deleteInstallment,
  deleteReminder,
  markInstallmentPaid,
  markReminderDone,
} from './actions'
import { localDateValue, formatAmount } from '@/lib/format'
import type { Installment, PatientReminder } from './types'
import { SectionHeader, EmptyState, IconPlus, IconTrash } from './accountShared'

// ---- Ödeme Planı (Taksit + Hatırlatıcılar) kartı ----
export function PaymentPlanCard({
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
export function InstallmentStatusBadge({ paid, overdue }: { paid: boolean; overdue: boolean }) {
  if (paid) return <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-black text-green-700">Ödendi</span>
  if (overdue) return <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black text-red-700">Gecikti</span>
  return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-700">Bekliyor</span>
}
export function IconAlertCircle() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>
}
export function IconCalendar() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>
}
export function IconCalendarLarge() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /><path d="M8 15h3" /><path d="M14 15h2" /></svg>
}
export function IconAlertTriangle() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
}
