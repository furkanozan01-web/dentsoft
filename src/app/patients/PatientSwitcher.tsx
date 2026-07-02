'use client'

import { useEffect, useRef, useState } from 'react'
import { toTitleCase } from '@/lib/format'
import type { Patient } from './types'

// Hasta Kartı'ndaki arama barıyla aynı görünümde, tüm alt sekmelerde
// ortak kullanılan hasta arama/değiştirme barı.
export default function PatientSwitcher({
  patients,
  currentPatientId,
  onSelect,
}: {
  patients: Patient[]
  currentPatientId: number | null
  onSelect: (p: Patient) => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const searchResults =
    searchQuery.length >= 2
      ? patients
          .filter((p) => {
            const q = searchQuery.toLowerCase()
            return (
              `${p.name} ${p.surname}`.toLowerCase().includes(q) ||
              (p.phone1 ?? '').includes(q) ||
              (p.protocol_no ?? '').toLowerCase().includes(q)
            )
          })
          .filter((p) => p.id !== currentPatientId)
          .slice(0, 6)
      : []

  return (
    <div ref={searchRef} className="relative">
      <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors focus-within:border-[#2DD4BF]">
        <span className="shrink-0 text-slate-400"><IconSearch /></span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true) }}
          onFocus={() => { if (searchQuery.length >= 2) setShowSearchResults(true) }}
          placeholder="Farklı hasta ara — isim, telefon veya protokol no..."
          className="flex-1 bg-transparent text-sm font-medium text-[#0F2B3D] outline-none placeholder:text-slate-400"
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(''); setShowSearchResults(false) }}
            className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Temizle"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {showSearchResults && searchResults.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {searchResults.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onSelect(p)
                setSearchQuery('')
                setShowSearchResults(false)
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6FFFA] text-xs font-black text-[#0F766E]">
                {p.name.charAt(0)}{p.surname.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#0F2B3D] truncate">{toTitleCase(p.name)} {toTitleCase(p.surname)}</p>
                <p className="text-xs text-slate-400">{p.phone1 ?? '—'}{p.protocol_no ? ` · ${p.protocol_no}` : ''}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                {p.status === 'active' ? 'Aktif' : 'Pasif'}
              </span>
            </button>
          ))}
        </div>
      )}

      {showSearchResults && searchQuery.length >= 2 && searchResults.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-xl text-center text-sm text-slate-400">
          Eşleşen hasta bulunamadı
        </div>
      )}
    </div>
  )
}

function IconSearch() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
}
