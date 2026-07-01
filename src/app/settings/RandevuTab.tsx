'use client'

import { useEffect, useActionState, type ReactNode } from 'react'
import { updateRandevuSettings } from './actions'
import { SettingsIconBox, ClinicFormSection, ModernField, SummaryLine, IconSave, IconInfo, IconCalendar, IconClock } from './SettingsSharedUI'
import AppointmentSettingsEnhancements from './AppointmentSettingsEnhancements'
import type { AppointmentType, Branch, ClinicSettings, Doctor, R } from './types'

function IconTimer() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2h4" /><path d="M12 14l3-3" /><circle cx="12" cy="14" r="8" /></svg>
}

function ScheduleStatCard({ title, value, tone, icon }: { title: string; value: string; tone: 'blue' | 'green' | 'violet' | 'slate'; icon: ReactNode }) {
  const toneClass = {
    blue: 'bg-[#EAF7FF] text-[#0284C7]',
    green: 'bg-green-50 text-green-600',
    violet: 'bg-violet-50 text-violet-600',
    slate: 'bg-slate-100 text-slate-500',
  }[tone]
  return (
    <div className="rounded-[20px] border border-[#E7ECF2] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <span className={'mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ' + toneClass}>{icon}</span>
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-black text-[#142536]">{value}</p>
    </div>
  )
}

export default function RandevuTab({ clinic, doctors, branches, appointmentTypes, onSaved }: { clinic: ClinicSettings; doctors: Doctor[]; branches: Branch[]; appointmentTypes: AppointmentType[]; onSaved: () => void }) {
  const [state, action, pending] = useActionState(updateRandevuSettings, null as R)

  useEffect(() => {
    if ((state as R)?.success) onSaved()
  }, [state, onSaved])

  const workStart = clinic.work_start ?? '09:00'
  const workEnd = clinic.work_end ?? '18:00'
  const duration = clinic.default_duration ?? 30
  const onlineBooking = clinic.online_booking ?? true
  const requireApproval = clinic.require_approval ?? true
  const totalMinutes = Math.max(0, toMinutes(workEnd) - toMinutes(workStart))
  const dailyHours = Math.round((totalMinutes / 60) * 10) / 10
  const slotCount = duration > 0 ? Math.floor(totalMinutes / duration) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ScheduleStatCard title="Mesai Saatleri" value={workStart + ' - ' + workEnd} tone="blue" icon={<IconClock />} />
        <ScheduleStatCard title="Randevu Aralığı" value={duration + ' dk'} tone="violet" icon={<IconTimer />} />
        <ScheduleStatCard title="Online Randevu" value={onlineBooking ? 'Açık' : 'Kapalı'} tone={onlineBooking ? 'green' : 'slate'} icon={<IconCalendar />} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="mb-6 flex items-start gap-3">
            <SettingsIconBox><IconCalendar /></SettingsIconBox>
            <div>
              <h2 className="text-base font-black text-[#142536]">Randevu Ayarları</h2>
              <p className="mt-1 text-sm font-medium text-slate-400">Klinik çalışma saatleri, randevu aralıkları ve online randevu kurallarını yönetin.</p>
            </div>
          </div>

          <form action={action} className="space-y-7">
            {(state as R)?.error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{(state as R)!.error}</div>}
            {(state as R)?.success && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-600">Ayarlar kaydedildi.</div>}

            <ClinicFormSection title="Çalışma Saatleri" icon={<IconClock />}>
              <p className="-mt-2 text-xs font-semibold text-slate-400">Randevu takviminde gösterilecek varsayılan mesai aralığı.</p>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <ModernField label="Mesai Başlangıç" name="work_start" type="time" defaultValue={workStart} />
                <ModernField label="Mesai Bitiş" name="work_end" type="time" defaultValue={workEnd} />
              </div>
            </ClinicFormSection>

            <ClinicFormSection title="Randevu Süresi" icon={<IconTimer />}>
              <p className="-mt-2 text-xs font-semibold text-slate-400">Takvim slotlarının kaç dakikalık aralıklarla oluşturulacağını belirler.</p>
              <div>
                <label className="mb-2 block text-[13px] font-bold text-slate-500">Randevu Aralığı</label>
                <select name="default_duration" defaultValue={String(duration)} className="h-12 w-full rounded-2xl border border-[#E7ECF2] bg-white px-4 text-sm font-semibold text-[#142536] outline-none transition focus:border-[#5FD3C1] focus:ring-4 focus:ring-[#5FD3C1]/15">
                  {[15, 20, 30, 45, 60].map((v) => <option key={v} value={v}>{v} dk</option>)}
                </select>
              </div>
            </ClinicFormSection>

            <ClinicFormSection title="Online Randevu Kuralları" icon={<IconCalendar />}>
              <div className="space-y-3">
                <SwitchField name="online_booking" defaultChecked={onlineBooking} title="Online hasta randevusu açık" description="Hastalar online randevu talebi oluşturabilir." />
                <SwitchField name="require_approval" defaultChecked={requireApproval} title="Randevular onay gerektirsin" description="Online talepler takvime eklenmeden önce onay bekler." />
              </div>
            </ClinicFormSection>

            <div className="flex items-start gap-2 rounded-[14px] border border-[#E7ECF2] bg-[#F8FAFC] px-4 py-3 text-xs font-semibold text-slate-500">
              <IconInfo />
              <span>Bu ayarlar randevu takvimi, online randevu talepleri ve boş slot hesaplamalarında kullanılır.</span>
            </div>

            <div className="flex border-t border-[#EEF2F6] pt-5">
              <button type="submit" disabled={pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-6 text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:opacity-60 sm:w-auto">
                <IconSave />
                {pending ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-start gap-3">
              <SettingsIconBox><IconCalendar /></SettingsIconBox>
              <div>
                <h3 className="text-base font-black text-[#142536]">Çalışma Takvimi Özeti</h3>
                <p className="mt-1 text-xs font-semibold text-slate-400">Günlük randevu kapasitesi</p>
              </div>
            </div>
            <SummaryLine label="Günlük mesai" value={workStart + ' - ' + workEnd} />
            <SummaryLine label="Günlük süre" value={dailyHours + ' saat'} />
            <SummaryLine label="Slot aralığı" value={duration + ' dk'} />
            <SummaryLine label="Tahmini günlük slot" value={String(slotCount)} />
          </section>

          <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <h3 className="text-base font-black text-[#142536]">Online Randevu</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={onlineBooking ? 'rounded-full bg-green-50 px-3 py-1.5 text-xs font-black text-green-700' : 'rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500'}>{onlineBooking ? 'Açık' : 'Kapalı'}</span>
              <span className={requireApproval ? 'rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-600' : 'rounded-full bg-green-50 px-3 py-1.5 text-xs font-black text-green-700'}>{requireApproval ? 'Onay gerekli' : 'Otomatik onay'}</span>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-[14px] border border-[#E7ECF2] bg-[#F8FAFC] px-4 py-3 text-xs font-semibold leading-5 text-slate-500"><IconInfo /><span>Online talepler onay bekleyen randevular alanında görüntülenir.</span></div>
          </section>

          <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <h3 className="text-base font-black text-[#142536]">Çalışma Günleri</h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">Varsayılan çalışma günleri</p>
            <div className="mt-4 grid grid-cols-7 gap-2">
              {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d, i) => <span key={d} className={(i < 5 ? 'bg-[#E6FFFA] text-[#0F766E]' : 'bg-[#F1F5F9] text-slate-400') + ' rounded-xl px-2 py-2 text-center text-xs font-black'}>{d}</span>)}
            </div>
          </section>
        </aside>
      </div>
      <AppointmentSettingsEnhancements clinic={clinic} doctors={doctors} branches={branches} appointmentTypes={appointmentTypes} onChanged={onSaved} />
    </div>
  )
}

function toMinutes(time: string) {
  const [h, m] = time.split(':').map((part) => Number(part))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

function SwitchField({ name, defaultChecked, title, description }: { name: string; defaultChecked: boolean; title: string; description: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#E7ECF2] bg-[#FAFBFC] px-4 py-3">
      <span>
        <span className="block text-sm font-black text-[#142536]">{title}</span>
        <span className="mt-0.5 block text-xs font-semibold text-slate-400">{description}</span>
      </span>
      <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="absolute inset-0 rounded-full bg-slate-300 transition peer-checked:bg-[#5FD3C1]" />
        <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  )
}
