'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { updateAppointmentStatus } from './actions'
import { Appointment } from './appointmentsShared'

export function PendingRow({ appt, onChanged }: { appt: Appointment; onChanged: () => void }) {
  const [pending, startTransition] = useTransition()
  const when = new Date(appt.scheduled_at)
  const act = (status: string) =>
    startTransition(async () => {
      const res = await updateAppointmentStatus(appt.id, status)
      if (res?.error) toast.error(res.error)
      else { toast.success(status === 'scheduled' ? 'Randevu onaylandı' : 'Randevu reddedildi'); onChanged() }
    })

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#EEF2F6] bg-white px-4 py-3 text-sm shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.07)] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <span className="block truncate font-black text-[#0F2B3D]">
          {appt.patient ? `${appt.patient.name} ${appt.patient.surname}` : '—'}
        </span>
        <span className="mt-1 block text-xs font-medium text-slate-500">
          {when.toLocaleDateString('tr-TR')}{' '}
          {when.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          {appt.doctor && ` · Dt. ${appt.doctor.name}`}
          {appt.treatment_note && ` · ${appt.treatment_note}`}
        </span>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => act('scheduled')}
          disabled={pending}
          className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white shadow-[0_8px_18px_rgba(16,185,129,0.18)] transition hover:bg-emerald-600 disabled:opacity-50"
        >
          Onayla
        </button>
        <button
          onClick={() => act('cancelled')}
          disabled={pending}
          className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
        >
          Reddet
        </button>
      </div>
    </div>
  )
}
