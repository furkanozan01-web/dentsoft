'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { updateAppointment, updateAppointmentStatus, deleteAppointment } from './actions'
import { ApptDoctor, Appointment, ShiftMode, STATUS_STYLE, STATUS_LABEL, isoDate, isTimeAllowed } from './appointmentsShared'
import { ApptModal } from './ApptModal'

export function ManageModal({
  appt,
  doctors,
  shiftMode,
  onClose,
  onStatusChange,
  onChanged,
}: {
  appt: Appointment
  doctors: ApptDoctor[]
  shiftMode: ShiftMode
  onClose: () => void
  onStatusChange: (id: number, newStatus: string) => void
  onChanged: () => void
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const when = new Date(appt.scheduled_at)

  // Edit form state
  const [editDoctorId, setEditDoctorId] = useState<number>(appt.doctor_id ?? doctors[0]?.id ?? 0)
  const [editDate, setEditDate] = useState(isoDate(when))
  const [editTime, setEditTime] = useState(
    `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`
  )
  const [editDuration, setEditDuration] = useState(appt.duration_min)
  const [editNote, setEditNote] = useState(appt.treatment_note ?? '')

  const setStatus = (status: string) =>
    startTransition(async () => {
      onStatusChange(appt.id, status) // Optimistik — takvim kartı anında güncellenir
      const res = await updateAppointmentStatus(appt.id, status)
      if (res?.error) toast.error(res.error)
      else { toast.success('Durum güncellendi'); onChanged() }
    })

  const remove = async () => {
    const ok = await confirm({
      title: 'Randevuyu Sil',
      message: 'Bu randevu kalıcı olarak silinecek. Devam edilsin mi?',
      confirmText: 'Evet, Sil',
    })
    if (!ok) return
    startTransition(async () => {
      const res = await deleteAppointment(appt.id)
      if (res?.error) toast.error(res.error)
      else { toast.success('Randevu silindi'); onChanged() }
    })
  }

  const saveEdit = () => {
    if (!isTimeAllowed(editTime, shiftMode)) {
      toast.error(shiftMode === 'work' ? 'Mesai randevusu 09:00-18:00 arasında olmalı.' : 'Nöbet randevusu 18:00-09:00 arasında olmalı.')
      return
    }
    startTransition(async () => {
      const scheduledAt = new Date(`${editDate}T${editTime}:00`).toISOString()
      const res = await updateAppointment(appt.id, {
        doctorId: editDoctorId,
        scheduledAt,
        durationMin: editDuration,
        treatmentNote: editNote.trim() || null,
      })
      if (res?.error) toast.error(res.error)
      else { toast.success('Randevu güncellendi'); onChanged() }
    })
  }

  const goToPatient = (tab?: string) => {
    if (!appt.patient_id) return
    const url = `/patients?patient_id=${appt.patient_id}${tab ? `&tab=${tab}` : ''}`
    router.push(url)
    onClose()
  }

  if (mode === 'edit') {
    return (
      <ApptModal title="Randevuyu Düzenle" onClose={onClose}>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Hekim</label>
            <select
              value={editDoctorId}
              onChange={(e) => setEditDoctorId(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30"
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>Dt. {d.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Tarih</label>
              <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Saat</label>
              <input type="time" value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Süre (dk)</label>
              <input type="number" value={editDuration} min={5} step={5}
                onChange={(e) => setEditDuration(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Not</label>
            <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)}
              placeholder="İşlem notu…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setMode('view')} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
              Geri
            </button>
            <button onClick={saveEdit} disabled={pending}
              className="flex-1 px-4 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] disabled:opacity-60">
              {pending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </ApptModal>
    )
  }

  return (
    <ApptModal title="Randevu Detayı" onClose={onClose}>
      <div className="p-6 space-y-4">
        {/* Hasta adı — tıklanabilir */}
        <div>
          {appt.patient_id ? (
            <button
              onClick={() => goToPatient()}
              className="text-[#0F2B3D] font-bold text-lg hover:text-[#2DD4BF] transition-colors flex items-center gap-1.5 group"
            >
              {appt.patient ? `${appt.patient.name} ${appt.patient.surname}` : '—'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </button>
          ) : (
            <p className="text-[#0F2B3D] font-bold text-lg">
              {appt.patient ? `${appt.patient.name} ${appt.patient.surname}` : '—'}
            </p>
          )}
        </div>

        {/* Bilgiler */}
        <div className="space-y-1.5 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {when.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {when.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} · {appt.duration_min} dakika
          </div>
          {appt.doctor && (
            <div className="flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Dt. {appt.doctor.name}
            </div>
          )}
          {appt.treatment_note && (
            <div className="flex items-start gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              {appt.treatment_note}
            </div>
          )}
        </div>

        {/* Durum */}
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[appt.status] ?? 'bg-gray-200'}`}>
            {STATUS_LABEL[appt.status] ?? appt.status}
          </span>
        </div>

        {/* Durum değiştir */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-400 mb-2">Durum Değiştir</p>
          <div className="grid grid-cols-2 gap-1.5">
            {appt.status === 'pending' && (
              <button onClick={() => setStatus('scheduled')} disabled={pending}
                className="col-span-2 px-3 py-2 bg-green-500 text-white text-xs font-semibold rounded-xl hover:bg-green-600 disabled:opacity-50">
                Onayla (Planla)
              </button>
            )}
            {appt.status !== 'scheduled' && (
              <button onClick={() => setStatus('scheduled')} disabled={pending}
                className="px-3 py-2 bg-[#2DD4BF]/15 text-[#0F2B3D] text-xs font-medium rounded-xl hover:bg-[#2DD4BF]/30 disabled:opacity-50">
                Planlandı
              </button>
            )}
            {appt.status !== 'done' && (
              <button onClick={() => setStatus('done')} disabled={pending}
                className="px-3 py-2 bg-green-100 text-green-700 text-xs font-medium rounded-xl hover:bg-green-200 disabled:opacity-50">
                Tamamlandı
              </button>
            )}
            {appt.status !== 'no_show' && (
              <button onClick={() => setStatus('no_show')} disabled={pending}
                className="px-3 py-2 bg-gray-100 text-gray-600 text-xs font-medium rounded-xl hover:bg-gray-200 disabled:opacity-50">
                Gelmedi
              </button>
            )}
            {appt.status !== 'cancelled' && (
              <button onClick={() => setStatus('cancelled')} disabled={pending}
                className="px-3 py-2 bg-red-50 text-red-600 text-xs font-medium rounded-xl hover:bg-red-100 disabled:opacity-50">
                İptal Et
              </button>
            )}
          </div>
        </div>

        {/* Eylemler */}
        <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
          {appt.patient_id && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => goToPatient('hasta-karti')}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#2DD4BF] px-4 py-2.5 text-sm font-semibold text-[#0F2B3D] transition-colors hover:bg-[#26b8a5]"
              >
                Hasta Kartına Git
              </button>
              <button
                onClick={() => goToPatient('oral')}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#BFEFE8] bg-[#E9FBF8] px-4 py-2.5 text-sm font-semibold text-[#0F766E] transition-colors hover:bg-[#DDF8F4]"
              >
                Tedaviye Dönüştür
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode('edit')} disabled={pending}
              className="px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 flex items-center justify-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Düzenle
            </button>
            <button onClick={remove} disabled={pending}
              className="px-4 py-2.5 bg-red-50 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100 flex items-center justify-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              Sil
            </button>
          </div>
        </div>
      </div>
    </ApptModal>
  )
}
