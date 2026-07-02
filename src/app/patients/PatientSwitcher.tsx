'use client'

import { useEffect, useRef, useState } from 'react'
import { toTitleCase } from '@/lib/format'
import type { Patient } from './types'

// Breadcrumb'da kullanılan kompakt hasta arama/değiştirme butonu.
// Tıklanınca isim/telefon/protokol no'ya göre filtrelenen bir açılır panel gösterir.
export default function PatientSwitcher({
  patients,
  currentPatientId,
  onSelect,
}: {
  patients: Patient[]
  currentPatientId: number | null
  onSelect: (p: Patient) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const results =
    query.length >= 1
      ? patients
          .filter((p) => {
            const q = query.toLowerCase()
            return (
              `${p.name} ${p.surname}`.toLowerCase().includes(q) ||
              (p.phone1 ?? '').includes(q) ||
              (p.protocol_no ?? '').toLowerCase().includes(q)
            )
          })
          .filter((p) => p.id !== currentPatientId)
          .slice(0, 8)
      : patients.filter((p) => p.id !== currentPatientId).slice(0, 8)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-[#E6FFFA] hover:text-[#0F766E]"
        title="Hasta değiştir"
        aria-label="Hasta değiştir"
      >
        <IconSearch />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-[#EEF2F6] px-3 py-2.5">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="İsim, telefon veya protokol no..."
              className="w-full bg-transparent text-sm font-medium text-[#0F2B3D] outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {results.length === 0 ? (
              <p className="px-4 py-4 text-center text-sm text-slate-400">Eşleşen hasta bulunamadı</p>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p)
                    setQuery('')
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E6FFFA] text-xs font-black text-[#0F766E]">
                    {p.name.charAt(0)}{p.surname.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#0F2B3D]">{toTitleCase(p.name)} {toTitleCase(p.surname)}</p>
                    <p className="text-xs text-slate-400">{p.phone1 ?? '—'}{p.protocol_no ? ` · ${p.protocol_no}` : ''}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function IconSearch() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
}
