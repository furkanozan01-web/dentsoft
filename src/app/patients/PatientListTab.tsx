'use client'

import type { ReactNode } from 'react'
import { calcAge } from './formatters'
import { toTitleCase } from '@/lib/format'
import type { Patient } from './types'
import { IconPencil, IconPlus } from '@/components/icons'

// ---- Liste Tab ----
function ListeTab({
  patients,
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  treatmentStatusFilter,
  onTreatmentStatusFilter,
  treatmentTypeFilter,
  onTreatmentTypeFilter,
  treatmentTypeOptions,
  selected,
  onSelect,
  onOpen,
  onEdit,
  onDelete,
  deleting,
  onNewPatient,
  filterLabel,
}: {
  patients: Patient[]
  search: string
  onSearch: (v: string) => void
  statusFilter: 'all' | 'active' | 'passive'
  onStatusFilter: (v: 'all' | 'active' | 'passive') => void
  treatmentStatusFilter: 'all' | 'active' | 'done'
  onTreatmentStatusFilter: (v: 'all' | 'active' | 'done') => void
  treatmentTypeFilter: string
  onTreatmentTypeFilter: (v: string) => void
  treatmentTypeOptions: string[]
  selected: Patient | null
  onSelect: (p: Patient) => void
  onOpen: (p: Patient) => void
  onEdit: (p: Patient) => void
  onDelete: (p: Patient) => void
  deleting: boolean
  onNewPatient: () => void
  filterLabel?: string | null
}) {
  const activeCount = patients.filter((p) => p.status === 'active').length
  const riskyCount = patients.filter((p) => p.untrusted).length
  const summaryCards = [
    { label: 'Toplam Hasta', value: patients.length, tone: 'teal' as const, icon: <IconUsers /> },
    { label: 'Aktif Hasta', value: activeCount, tone: 'green' as const, icon: <IconCheckCircle /> },
    { label: 'Riskli Hasta', value: riskyCount, tone: 'red' as const, icon: <IconAlert /> },
  ]

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-[22px] border border-slate-200/90 bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onNewPatient}
            className="inline-flex items-center gap-2 rounded-[14px] bg-gradient-to-br from-[#5FD3C1] to-[#1EAEA0] px-4 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(31,174,160,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(31,174,160,0.24)]"
          >
            <IconPlus />
            Yeni Hasta
          </button>
          <button
            disabled={!selected}
            onClick={() => selected && onEdit(selected)}
            className="inline-flex items-center gap-2 rounded-[14px] border border-[#E7ECF2] bg-white px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-[#0F2B3D] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <IconEdit />
            Düzenle
          </button>
          <button
            disabled={!selected || deleting}
            onClick={() => selected && onDelete(selected)}
            className="inline-flex items-center gap-2 rounded-[14px] border border-[#FADADA] bg-[#FFF7F7] px-4 py-3 text-sm font-bold text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <IconTrash />
            Sil
          </button>
        </div>

        <div className="min-w-0 flex-1" />

        {/* Status filter */}
        <div className="flex rounded-xl border border-[#E7ECF2] bg-slate-50 p-1">
          {(['all', 'active', 'passive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onStatusFilter(f)}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                statusFilter === f
                  ? 'bg-[#142536] text-white shadow-sm'
                  : 'text-slate-500 hover:bg-[#E9FBF8] hover:text-[#0F766E]'
              }`}
            >
              {f === 'all' ? 'Tümü' : f === 'active' ? 'Aktif' : 'Pasif'}
            </button>
          ))}
        </div>

        <select
          value={treatmentStatusFilter}
          onChange={(e) => onTreatmentStatusFilter(e.target.value as 'all' | 'active' | 'done')}
          className="h-12 rounded-2xl border border-[#E7ECF2] bg-white px-3 text-xs font-bold text-slate-600 outline-none transition focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
          aria-label="Tedavi durumu filtresi"
        >
          <option value="all">Tüm tedaviler</option>
          <option value="active">Devam eden</option>
          <option value="done">Biten</option>
        </select>

        <select
          value={treatmentTypeFilter}
          onChange={(e) => onTreatmentTypeFilter(e.target.value)}
          className="h-12 rounded-2xl border border-[#E7ECF2] bg-white px-3 text-xs font-bold text-slate-600 outline-none transition focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
          aria-label="İşlem türü filtresi"
        >
          <option value="all">Tüm işlem türleri</option>
          {treatmentTypeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>


        {/* Search */}
        <div className="relative w-full sm:w-[320px]">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Hasta ara..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="h-12 w-full rounded-2xl border border-[#E7ECF2] bg-white pl-11 pr-4 text-sm font-medium text-[#0F2B3D] outline-none transition placeholder:text-slate-400 focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
          />
        </div>
      </div>

      {filterLabel && (
        <div className="flex items-center justify-between rounded-2xl border border-[#2DD4BF]/25 bg-[#2DD4BF]/10 px-4 py-3 text-sm">
          <span className="font-bold text-[#0F2B3D]">{filterLabel}</span>
          <span className="text-xs font-semibold text-slate-500">{patients.length} hasta</span>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        {patients.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DDF8F4] text-[#1EAEA0]">
              <IconUsers />
            </div>
            <p className="mt-4 text-sm font-bold text-[#0F2B3D]">
              {search ? 'Arama sonucu bulunamadı.' : 'Henüz hasta kaydı yok. Yeni hasta ekleyin.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="border-b border-[#EEF2F6] bg-[#FAFBFC]">
              <tr>
                {['#', 'Ad Soyad', 'Yaş', 'Telefon', 'Kayıt Tarihi', 'Durum'].map((h) => (
                  <th
                    key={h}
                    className="h-14 px-5 text-left text-xs font-black uppercase tracking-wide text-slate-400"
                  >
                    {h}
                  </th>
                ))}
                <th className="h-14 px-5 text-right text-xs font-black uppercase tracking-wide text-slate-400">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p, i) => {
                const isSelected = selected?.id === p.id
                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelect(p)}
                    className={`h-20 cursor-pointer border-b border-[#EEF2F6] transition duration-200 last:border-0 ${
                      isSelected ? 'bg-[#2DD4BF]/10 hover:bg-[#2DD4BF]/12' : 'hover:bg-[#FAFEFD]'
                    }`}
                  >
                    <td className="px-5 text-xs font-bold text-slate-400">{i + 1}</td>
                    <td className="px-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#E6FFFA] text-sm font-black text-[#0F766E]">
                          {p.name[0]}
                          {p.surname[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-black text-[#0F2B3D]">
                            {toTitleCase(p.name)} {toTitleCase(p.surname)}
                          </p>
                          {p.untrusted && (
                            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-red-500">
                              <IconAlertMini />
                              Güvenilmez
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 font-semibold text-slate-500">
                      {calcAge(p.birth_date) ?? '—'}
                    </td>
                    <td className="px-5 font-semibold text-slate-500">{p.phone1 ?? '—'}</td>
                    <td className="px-5 text-xs font-semibold text-slate-400">
                      {p.reg_date
                        ? new Date(p.reg_date).toLocaleDateString('tr-TR')
                        : new Date(p.created_at).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-5">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                          p.status === 'active'
                            ? 'bg-[#DCFCE7] text-[#15803D]'
                            : 'bg-[#F1F5F9] text-[#64748B]'
                        }`}
                      >
                        {p.status === 'active' ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpen(p) }}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                          title="Görüntüle"
                        >
                          <IconEye />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onEdit(p) }}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-[#E9FBF8] hover:text-[#0F766E]"
                          title="Düzenle"
                        >
                          <IconPencil />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(p) }}
                          disabled={deleting}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-100 hover:text-red-600 disabled:opacity-40"
                          title="Sil"
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF2F6] px-5 py-4 text-sm font-semibold text-slate-500">
          <span>Toplam {patients.length} hasta listeleniyor</span>
          <span>Sayfa 1 / 1</span>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: number
  tone: 'teal' | 'green' | 'red'
  icon: ReactNode
}) {
  const toneClass = {
    teal: 'bg-[#DDF8F4] text-[#0F766E]',
    green: 'bg-[#DCFCE7] text-[#15803D]',
    red: 'bg-[#FFE2E2] text-[#DC2626]',
  }[tone]

  return (
    <div className="rounded-[18px] border border-slate-200/90 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${toneClass}`}>
          {icon}
        </span>
        <div>
          <p className="text-2xl font-black leading-none text-[#0F2B3D]">{value}</p>
          <p className="mt-1 text-xs font-bold text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  )
}

function IconEdit() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
}

function IconTrash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
}

function IconSearch({ className }: { className?: string }) {
  return <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
}

function IconEye() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
}

function IconUsers() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}

function IconCheckCircle() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
}

function IconAlert() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
}

function IconAlertMini() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
}

export default ListeTab
