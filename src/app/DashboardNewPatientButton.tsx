'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NewPatientModal } from './patients/PatientModals'

export default function DashboardNewPatientButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#E7ECF2] bg-white px-3 py-2 text-xs font-semibold text-[#0F2B3D] shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition hover:border-[#2DD4BF]/50 hover:bg-[#E9FBF8]"
      >
        <span aria-hidden="true" className="text-base leading-none">+</span>
        Hasta Ekle
      </button>

      {open && (
        <NewPatientModal
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
