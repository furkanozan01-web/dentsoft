'use client'

import type { ReactNode } from 'react'
// ---- Shared UI ----
export function SModal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-[#0F2B3D]">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function SettField({
  label,
  name,
  type = 'text',
  required,
  placeholder,
  defaultValue,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
  defaultValue?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30"
      />
    </div>
  )
}

export function SaveBtn({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2 px-5 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] transition-colors disabled:opacity-60"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
      {pending ? 'Kaydediliyor…' : 'Kaydet'}
    </button>
  )
}

export function MActions({
  onCancel,
  pending,
  label,
}: {
  onCancel: () => void
  pending: boolean
  label: string
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
        İptal
      </button>
      <button type="submit" disabled={pending} className="flex-1 px-4 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] transition-colors disabled:opacity-60">
        {pending ? 'Kaydediliyor…' : label}
      </button>
    </div>
  )
}

export function ErrBox({ msg }: { msg: string }) {
  return <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{msg}</div>
}

// ---- Sekmeler arası paylaşılan bileşenler ----
// Bu bileşenler 2+ sekmede kullanıldığı için burada yaşıyor
// (Klinik + Randevu: ClinicFormSection/ModernField; Kullanıcı + Tarife: UserStatCard;
// Tarife + Randevu: SummaryLine; ikonlar birden fazla sekmede tekrarlanıyor).

export function SettingsIconBox({ children }: { children: ReactNode }) {
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#5FD3C1]/15 text-[#1EAEA0]">{children}</span>
}

export function ClinicFormSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 border-b border-[#EEF2F6] pb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F8FAFC] text-[#0F766E]">{icon}</span>
        <h3 className="text-sm font-black text-[#142536]">{title}</h3>
      </div>
      {children}
    </section>
  )
}

export function ModernField({ label, name, type = 'text', required, placeholder, defaultValue }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string }) {
  return (
    <div>
      <label className="mb-2 block text-[13px] font-bold text-slate-500">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="h-12 w-full rounded-2xl border border-[#E7ECF2] bg-white px-4 text-sm font-semibold text-[#142536] outline-none transition placeholder:text-slate-300 focus:border-[#5FD3C1] focus:ring-4 focus:ring-[#5FD3C1]/15"
      />
    </div>
  )
}

export function UserStatCard({ title, value, tone, icon }: { title: string; value: number; tone: 'blue' | 'green' | 'violet'; icon: ReactNode }) {
  const toneClass = {
    blue: 'bg-[#EAF7FF] text-[#0284C7]',
    green: 'bg-green-50 text-green-600',
    violet: 'bg-violet-50 text-violet-600',
  }[tone]
  return <div className="rounded-[20px] border border-[#E7ECF2] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><span className={'mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ' + toneClass}>{icon}</span><p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p><p className="mt-1 text-3xl font-black text-[#142536]">{value}</p></div>
}

export function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#EEF2F6] py-3 text-sm last:border-0">
      <span className="font-semibold text-slate-500">{label}</span>
      <strong className="text-right font-black text-[#142536]">{value}</strong>
    </div>
  )
}

export function IconSave() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" /></svg>
}

export function IconClipboard() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 14h6" /><path d="M9 18h4" /></svg>
}

export function IconAlert() {
  return <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
}

export function IconUsers() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}

export function IconCheckCircle() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" /><path d="m22 4-10 10.01-3-3" /></svg>
}

export function IconPlus() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
}

export function IconClock() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
}

export function IconInfo() {
  return <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
}

export function IconCalendar() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /></svg>
}
