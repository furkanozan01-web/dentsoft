'use client'

import { useState, useEffect, useRef } from 'react'

interface BellAppt {
  id: number
  scheduled_at: string
  patient_name: string
}

interface BellPayment {
  id: number
  due_date: string
  amount: number
  patient_name: string
}

export default function DashboardBell({
  pendingCount,
  todayAppts,
  overduePayments,
}: {
  pendingCount: number
  todayAppts: BellAppt[]
  overduePayments: BellPayment[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const totalBadge = (pendingCount > 0 ? 1 : 0) + (overduePayments.length > 0 ? 1 : 0)
  const hasItems = todayAppts.length > 0 || overduePayments.length > 0 || pendingCount > 0

  function fmt(kurus: number) {
    return (kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Bildirimler"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </button>

      {totalBadge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
          {totalBadge}
        </span>
      )}

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-[#0F2B3D]">Bildirimler</p>
          </div>

          {!hasItems ? (
            <p className="text-sm text-gray-400 text-center py-6">Bildirim yok</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {pendingCount > 0 && (
                <a
                  href="/appointments"
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50"
                >
                  <span className="w-2 h-2 mt-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                  <span className="text-sm text-[#0F2B3D]">
                    <span className="font-semibold">{pendingCount}</span> randevu onay bekliyor
                  </span>
                </a>
              )}

              {todayAppts.map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50">
                  <span className="w-2 h-2 mt-1.5 rounded-full bg-[#2DD4BF] flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-[#0F2B3D]">{a.patient_name}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(a.scheduled_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} randevusu
                    </p>
                  </div>
                </div>
              ))}

              {overduePayments.map((p) => (
                <div key={p.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                  <span className="w-2 h-2 mt-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-[#0F2B3D]">{p.patient_name}</p>
                    <p className="text-xs text-gray-400">
                      ₺{fmt(p.amount)} vadesi geçmiş · {new Date(p.due_date).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
