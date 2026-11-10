'use client'

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { usePersistedPreference } from '@/lib/hooks/usePersistedPreference'
import { rescheduleAppointment } from './actions'
import { ApptDoctor, ApptPatient, ApptTariff, AppointmentTypeOption, NightShiftConfig, Appointment, ShiftMode, SLOT_MIN, SLOT_PX, DAY_MIN, SHIFT_CONFIG, STATUS_LABEL, appointmentTone, treatmentMatches, startOfWeek, isoDate, minutesToTime, slotDateTime, isInShift, appointmentShiftDayKey, offsetPx } from './appointmentsShared'
import { PendingRow } from './PendingRow'
import { ManageModal } from './ManageModal'
import { NewAppointmentModal } from './NewAppointmentModal'
import { IconPlus } from '@/components/icons'

// page.tsx bu tipleri buradan import ediyor; tanımlar appointmentsShared.ts'te.
export type { ApptDoctor, ApptPatient, ApptTariff, AppointmentTypeOption, NightShiftConfig } from './appointmentsShared'

export default function AppointmentsClient({
  doctors,
  patients,
  tariffs,
  branchName,
  workStart,
  workEnd,
  defaultDuration,
  appointmentTypes,
  nightShift,
  canOverrideNight,
}: {
  doctors: ApptDoctor[]
  patients: ApptPatient[]
  tariffs: ApptTariff[]
  branchName: string
  workStart: string
  workEnd: string
  defaultDuration: number
  appointmentTypes: AppointmentTypeOption[]
  nightShift: NightShiftConfig
  canOverrideNight: boolean
}) {
  const searchParams = useSearchParams()
  const prefillPatientId = searchParams.get('patient_id') ? Number(searchParams.get('patient_id')) : null
  const initialView = searchParams.get('view') === 'day' ? 'day' : 'week'
  const focusPendingRequests = searchParams.get('section') === 'pending'

  const [supabase] = useState(() => createClient())
  const [view, setView] = useState<'week' | 'day'>(initialView)
  const [shiftMode, setShiftMode] = useState<ShiftMode>(() =>
    searchParams.get('shift') === 'duty' ? 'duty' : 'work'
  )
  const [anchor, setAnchor] = useState(() => new Date())
  const [doctorFilter, setDoctorFilter] = usePersistedPreference<'all' | number>('dentsoft:last-doctor-filter-appointments', 'all')
  const [branchFilter, setBranchFilter] = useState(branchName)
  const [treatmentFilter, setTreatmentFilter] = useState('all')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [pendingReqs, setPendingReqs] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(
    () => prefillPatientId !== null || searchParams.get('action') === 'new'
  )
  const [prefill, setPrefill] = useState<{ date: string; time: string } | null>(null)
  const [managing, setManaging] = useState<Appointment | null>(null)
  const suppressAppointmentClick = useRef(false)
  const pendingSectionRef = useRef<HTMLDivElement | null>(null)
  const calendarGridRef = useRef<HTMLDivElement | null>(null)

  const days = useMemo(() => {
    if (view === 'day') return [new Date(anchor)]
    const mon = startOfWeek(anchor)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon)
      d.setDate(mon.getDate() + i)
      return d
    })
  }, [view, anchor])

  const treatmentOptions = useMemo(
    () => Array.from(new Set(tariffs.map((t) => t.treatment_name).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr-TR')),
    [tariffs]
  )
  const parseMinutes = (value: string) => { const [h, m] = value.slice(0, 5).split(':').map(Number); return h * 60 + m }
  const nightStartMin = parseMinutes(nightShift.start)
  const nightEndMin = parseMinutes(nightShift.end)
  const activeShift = shiftMode === 'work'
    ? { label: 'Mesai', startMin: parseMinutes(workStart), endMin: parseMinutes(workEnd) }
    : { label: 'Gece Mesaisi', startMin: nightStartMin, endMin: nightEndMin <= nightStartMin ? nightEndMin + DAY_MIN : nightEndMin }
  const shiftSlotCount = (activeShift.endMin - activeShift.startMin) / SLOT_MIN
  const gridHeight = shiftSlotCount * SLOT_PX

  const rangeStart = useMemo(() => slotDateTime(days[0], activeShift.startMin), [days, activeShift.startMin])
  const rangeEnd = useMemo(() => slotDateTime(days[days.length - 1], activeShift.endMin), [days, activeShift.endMin])

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('appointments')
      .select(
        'id, patient_id, doctor_id, scheduled_at, duration_min, status, treatment_note, appointment_type_id, color, is_night_shift, patient:patients(name,surname), doctor:doctors(id,name,color)'
      )
      .gte('scheduled_at', rangeStart.toISOString())
      .lte('scheduled_at', rangeEnd.toISOString())
      .order('scheduled_at')
    if (doctorFilter !== 'all') q = q.eq('doctor_id', doctorFilter)

    const [{ data, error }, { data: pend, error: pendingError }] = await Promise.all([
      q.overrideTypes<Appointment[], { merge: false }>(),
      supabase
        .from('appointments')
        .select(
          'id, patient_id, doctor_id, scheduled_at, duration_min, status, treatment_note, appointment_type_id, color, is_night_shift, patient:patients(name,surname), doctor:doctors(id,name,color)'
        )
        .eq('status', 'pending')
        .order('scheduled_at')
        .limit(50)
        .overrideTypes<Appointment[], { merge: false }>(),
    ])
    if (error || pendingError) {
      toast.error(error?.message ?? pendingError?.message ?? 'Randevular yüklenemedi')
      setLoading(false)
      return
    }
    setAppointments(data ?? [])
    setPendingReqs(pend ?? [])
    setLoading(false)
  }, [supabase, rangeStart, rangeEnd, doctorFilter])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  useEffect(() => {
    if (!focusPendingRequests) return
    const id = window.setTimeout(() => {
      pendingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
    return () => window.clearTimeout(id)
  }, [focusPendingRequests])

  const move = (dir: number) => {
    const d = new Date(anchor)
    d.setDate(d.getDate() + dir * (view === 'week' ? 7 : 1))
    setAnchor(d)
  }

  const todayISO = isoDate(new Date())

  const rangeLabel =
    view === 'week'
      ? `${days[0].toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : days[0].toLocaleDateString('tr-TR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })

  const openNewAt = (date: string, time: string) => {
    setPrefill({ date, time })
    setShowNew(true)
  }

  const moveAppointment = useCallback(
    (appt: Appointment, mode: 'move' | 'resize', startEvent: React.PointerEvent) => {
      if (!appt.doctor_id || !calendarGridRef.current) return
      if (startEvent.button !== 0) return
      startEvent.stopPropagation()
      if (mode === 'resize') startEvent.preventDefault()
      const grid = calendarGridRef.current
      const originalStart = new Date(appt.scheduled_at)
      const originalTop = offsetPx(originalStart, shiftMode)
      const startX = startEvent.clientX
      const startY = startEvent.clientY
      let moved = false
      let nextScheduledAt = appt.scheduled_at
      let nextDuration = appt.duration_min

      const calculateNext = (event: PointerEvent) => {
        const latestRect = grid.getBoundingClientRect()
        if (mode === 'resize') {
          const bottom = Math.max(event.clientY - latestRect.top, originalTop + SLOT_PX)
          const durationMin = Math.max(SLOT_MIN, Math.round((bottom - originalTop) / SLOT_PX) * SLOT_MIN)
          return { scheduledAt: appt.scheduled_at, durationMin }
        }

        const timeGutterWidth = 64
        const columnWidth = Math.max((latestRect.width - timeGutterWidth) / days.length, 1)
        const targetIndex = Math.max(0, Math.min(days.length - 1, Math.floor((event.clientX - latestRect.left - timeGutterWidth) / columnWidth)))
        const y = Math.max(0, Math.min(gridHeight - SLOT_PX, event.clientY - latestRect.top))
        const slotIndex = Math.max(0, Math.min(shiftSlotCount - 1, Math.round(y / SLOT_PX)))
        const nextDate = slotDateTime(days[targetIndex], activeShift.startMin + slotIndex * SLOT_MIN)
        return { scheduledAt: nextDate.toISOString(), durationMin: appt.duration_min }
      }

      const preview = (event: PointerEvent) => {
        const distance = Math.hypot(event.clientX - startX, event.clientY - startY)
        if (!moved && distance < (mode === 'resize' ? 3 : 6)) return
        event.preventDefault()
        moved = true
        suppressAppointmentClick.current = true
        const next = calculateNext(event)
        if (mode === 'resize') {
          if (next.durationMin === nextDuration) return
          nextDuration = next.durationMin
          setAppointments((prev) => prev.map((a) => (a.id === appt.id ? { ...a, duration_min: nextDuration } : a)))
          return
        }
        if (next.scheduledAt === nextScheduledAt) return
        nextScheduledAt = next.scheduledAt
        setAppointments((prev) => prev.map((a) => (a.id === appt.id ? { ...a, scheduled_at: nextScheduledAt } : a)))
      }

      const onMove = (event: PointerEvent) => {
        event.preventDefault()
        preview(event)
      }

      const cleanup = () => {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', finish)
        document.removeEventListener('pointercancel', cancel)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      const cancel = () => {
        cleanup()
        if (moved) void load()
      }

      const finish = async (event: PointerEvent) => {
        cleanup()
        preview(event)
        if (!moved) {
          suppressAppointmentClick.current = mode === 'resize'
          return
        }
        if (mode === 'resize') {
          if (nextDuration === appt.duration_min) return
          setAppointments((prev) => prev.map((a) => (a.id === appt.id ? { ...a, duration_min: nextDuration } : a)))
          const res = await rescheduleAppointment(appt.id, appt.scheduled_at, nextDuration, appt.doctor_id!)
          if (res?.error) {
            toast.error(res.error)
            void load()
          }
          return
        }

        if (nextScheduledAt === appt.scheduled_at) return
        setAppointments((prev) => prev.map((a) => (a.id === appt.id ? { ...a, scheduled_at: nextScheduledAt } : a)))
        const res = await rescheduleAppointment(appt.id, nextScheduledAt, appt.duration_min, appt.doctor_id!)
        if (res?.error) {
          toast.error(res.error)
          void load()
        }
      }

      document.body.style.cursor = mode === 'resize' ? 'ns-resize' : 'grabbing'
      document.body.style.userSelect = 'none'
      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', finish)
      document.addEventListener('pointercancel', cancel)
    },
    [activeShift.startMin, days, gridHeight, load, shiftMode, shiftSlotCount]
  )

  return (
    <div className="flex min-h-full flex-col bg-[#F0F4F9]">
      {/* Header */}
      <div className="px-6 pt-7 pb-4 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#DDF8F4] text-[#0F766E] shadow-[0_10px_22px_rgba(45,212,191,0.14)]">
              <IconCalendarDays />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-normal text-[#0F2B3D]">Randevu Yönetimi</h1>
              <p className="mt-0.5 text-sm font-medium text-slate-400">Haftalık / günlük randevu takvimi</p>
            </div>
          </div>
          <button
            onClick={() => {
              setPrefill(null)
              setShowNew(true)
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#5FD3C1] to-[#1EAEA0] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(31,174,160,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(31,174,160,0.24)]"
          >
            <IconPlus />
            Yeni Randevu
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 rounded-[22px] border border-slate-200/90 bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="flex rounded-xl border border-[#E7ECF2] bg-slate-50 p-1">
            <button
              onClick={() => setView('week')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${view === 'week' ? 'bg-[#0F2B3D] text-white shadow-sm' : 'text-slate-500 hover:bg-[#E9FBF8] hover:text-[#0F766E]'}`}
            >
              Haftalık
            </button>
            <button
              onClick={() => setView('day')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${view === 'day' ? 'bg-[#0F2B3D] text-white shadow-sm' : 'text-slate-500 hover:bg-[#E9FBF8] hover:text-[#0F766E]'}`}
            >
              Günlük
            </button>
          </div>

          <div className="flex rounded-xl border border-[#E7ECF2] bg-slate-50 p-1">
            {(['work', 'duty'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setShiftMode(mode)}
                disabled={mode === 'duty' && !nightShift.active}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${shiftMode === mode ? 'bg-[#0F2B3D] text-white shadow-sm' : 'text-slate-500 hover:bg-[#E9FBF8] hover:text-[#0F766E]'}`}
              >
                {mode === 'duty' ? 'Gece Mesaisi' : SHIFT_CONFIG[mode].label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-[#E7ECF2] bg-white p-1">
            <button onClick={() => move(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-[#E9FBF8] hover:text-[#0F766E]">
              <IconChevronLeft />
            </button>
            <button onClick={() => setAnchor(new Date())} className="h-8 rounded-lg px-3 text-xs font-bold text-slate-600 transition hover:bg-[#E9FBF8] hover:text-[#0F766E]">
              Bugün
            </button>
            <button onClick={() => move(1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-[#E9FBF8] hover:text-[#0F766E]">
              <IconChevronRightSmall />
            </button>
          </div>

          <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-[#0F2B3D]">{rangeLabel}</span>

          <div className="min-w-0 flex-1" />

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-10 rounded-xl border border-[#E7ECF2] bg-white px-3 text-xs font-semibold text-slate-600 outline-none transition focus:ring-2 focus:ring-[#2DD4BF]/30"
            aria-label="Şube filtresi"
          >
            <option value={branchName}>{branchName}</option>
          </select>

          <select
            value={treatmentFilter}
            onChange={(e) => setTreatmentFilter(e.target.value)}
            className="h-10 rounded-xl border border-[#E7ECF2] bg-white px-3 text-xs font-semibold text-slate-600 outline-none transition focus:ring-2 focus:ring-[#2DD4BF]/30"
            aria-label="İşlem filtresi"
          >
            <option value="all">Tüm İşlemler</option>
            {treatmentOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="h-10 rounded-xl border border-[#E7ECF2] bg-white px-3 text-xs font-semibold text-slate-600 outline-none transition focus:ring-2 focus:ring-[#2DD4BF]/30"
          >
            <option value="all">Tüm Hekimler</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                Dt. {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar */}
      <div className="px-6 pb-5 lg:px-8">
        {doctors.length === 0 ? (
          <div className="rounded-[24px] border border-slate-200/90 bg-white py-16 text-center text-sm text-gray-400 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            Önce Ayarlar → Diş Hekimi&apos;nden hekim ekleyin.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div className="border-b border-[#EEF2F6] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#0F2B3D]">Takvim görünümü</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-400">{activeShift.label} · {minutesToTime(activeShift.startMin)}–{minutesToTime(activeShift.endMin)} {shiftMode === 'duty' && nightShift.note ? `· ${nightShift.note}` : ''}</p>
                </div>
                {loading && <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">Yükleniyor...</span>}
              </div>
            </div>
            <div className="overflow-x-auto">
            <div style={{ minWidth: view === 'week' ? 760 : 320 }}>
              {/* Day headers */}
              <div
                className="grid border-b border-[#EEF2F6] bg-white"
                style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}
              >
                <div />
                {days.map((d) => {
                  const isToday = isoDate(d) === todayISO
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <div
                      key={isoDate(d)}
                      className={`flex h-16 items-center justify-center border-l border-[#EEF2F6] text-center ${
                        isToday ? 'bg-gradient-to-br from-[#5FD3C1] to-[#1EAEA0] text-white' : isWeekend ? 'bg-[#FAFBFC] text-slate-500' : 'text-slate-500'
                      }`}
                    >
                      <div>
                        <p className={`text-[11px] font-bold uppercase tracking-normal ${isToday ? 'text-white/85' : 'text-slate-400'}`}>
                          {d.toLocaleDateString('tr-TR', { weekday: 'short' })}
                        </p>
                        <p className="mt-1 text-lg font-black leading-none">{d.getDate()}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Grid body */}
              <div
                ref={calendarGridRef}
                className="grid relative"
                style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)`, touchAction: 'none' }}
              >
                {/* Time gutter */}
                <div className="relative bg-white" style={{ height: gridHeight }}>
                  {Array.from({ length: shiftSlotCount }).map((_, i) => {
                    const absoluteMin = activeShift.startMin + i * SLOT_MIN
                    const time = minutesToTime(absoluteMin)
                    const m = absoluteMin % 60
                    return (
                      <div
                        key={i}
                        className="pr-3 text-right text-[11px] font-semibold text-slate-400"
                        style={{ height: SLOT_PX }}
                      >
                        {m === 0 ? time : ''}
                      </div>
                    )
                  })}
                </div>

                {/* Day columns */}
                {days.map((d) => {
                  const dISO = isoDate(d)
                  const isToday = dISO === todayISO
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  const dayAppts = appointments.filter(
                    (a) => {
                      const scheduled = new Date(a.scheduled_at)
                      return (
                        isInShift(scheduled, shiftMode) &&
                        appointmentShiftDayKey(scheduled, shiftMode) === dISO &&
                        treatmentMatches(a.treatment_note, treatmentFilter)
                      )
                    }
                  )
                  return (
                    <div
                      key={dISO}
                      className={`relative border-l border-[#EEF2F6] ${isToday ? 'bg-[#5FD3C1]/[0.04]' : isWeekend ? 'bg-[#FAFBFC]' : 'bg-white'}`}
                      style={{ height: gridHeight }}
                    >
                      {/* slot click targets + grid lines */}
                      {Array.from({ length: shiftSlotCount }).map((_, i) => {
                        const absoluteMin = activeShift.startMin + i * SLOT_MIN
                        const slotDate = slotDateTime(d, absoluteMin)
                        const time = minutesToTime(absoluteMin)
                        const isHour = absoluteMin % 60 === 0
                        return (
                          <button
                            key={i}
                            onClick={() => openNewAt(isoDate(slotDate), time)}
                            className={`block w-full border-t transition-colors hover:bg-[#2DD4BF]/[0.07] ${isHour ? 'border-[#F1F5F9]' : 'border-slate-100/60'}`}
                            style={{ height: SLOT_PX }}
                            title={`${time} — yeni randevu`}
                          />
                        )
                      })}
                      {/* appointment blocks */}
                      {dayAppts.map((a) => {
                        const start = new Date(a.scheduled_at)
                        const top = offsetPx(start, shiftMode)
                        const height = Math.max((a.duration_min / SLOT_MIN) * SLOT_PX - 2, 18)
                        const tone = appointmentTone(a.treatment_note)
                        return (
                          <div
                            key={a.id}
                            onPointerDown={(e) => moveAppointment(a, 'move', e)}
                            onClick={() => {
                              if (suppressAppointmentClick.current) {
                                suppressAppointmentClick.current = false
                                return
                              }
                              setManaging(a)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setManaging(a)
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            className={`absolute left-1.5 right-1.5 select-none overflow-hidden rounded-xl border px-2.5 py-1.5 text-left text-[11px] shadow-[0_6px_14px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(15,23,42,0.10)] cursor-grab active:cursor-grabbing ${tone.card}`}
                            style={{
                              top,
                              height,
                              opacity: a.status === 'pending' ? 0.86 : 1,
                              ...(a.color ? { backgroundColor: a.color, borderColor: a.color, color: '#FFFFFF' } : {}),
                            }}
                          >
                            <span className={`absolute left-0 top-0 h-full w-1 ${a.color ? '' : tone.bar}`} style={a.color ? { backgroundColor: 'rgba(255,255,255,.65)' } : undefined} aria-hidden="true" />
                            <span className="block truncate pl-1 font-black">
                              {start.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}{' '}
                              {a.patient ? `${a.patient.name} ${a.patient.surname}` : '—'}
                            </span>
                            {a.treatment_note && height > 30 && (
                              <span className="mt-0.5 block truncate pl-1 text-[10px] font-semibold opacity-80">
                                {a.treatment_note}
                              </span>
                            )}
                            {height > 46 && (
                              <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${tone.badge}`}>
                                {STATUS_LABEL[a.status] ?? a.status}
                              </span>
                            )}
                            <span
                              onPointerDown={(e) => moveAppointment(a, 'resize', e)}
                              data-appointment-resize
                              className="absolute inset-x-1 bottom-0 h-2 cursor-ns-resize rounded-b-lg bg-black/10"
                              aria-hidden="true"
                            />
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
            </div>
          </div>
        )}
      </div>

      {/* Online / pending requests */}
      <div ref={pendingSectionRef} id="online-requests" className="scroll-mt-6 px-6 pb-8 lg:px-8">
        <div className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <IconClockSmall />
              </span>
              <div>
                <h2 className="text-base font-black text-[#0F2B3D]">Onay Bekleyen Randevular</h2>
                <p className="text-xs font-medium text-slate-400">Online talepler ve bekleyen randevu istekleri</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
              {pendingReqs.length} talep
            </span>
          </div>
          {pendingReqs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[#EEF2F6] bg-slate-50/70 px-4 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <IconCalendarCheck />
              </span>
              <p className="mt-4 text-sm font-bold text-[#0F2B3D]">Onay bekleyen randevu bulunmuyor.</p>
              <p className="mt-1 text-xs font-medium text-slate-400">Online talepler geldiğinde burada görüntülenir.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingReqs.map((a) => (
                <PendingRow key={a.id} appt={a} onChanged={load} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <NewAppointmentModal
          doctors={doctors}
          patients={patients}
          tariffs={tariffs}
          defaultDuration={defaultDuration}
          appointmentTypes={appointmentTypes.filter((type) => (!type.branch_id || type.branch_id === nightShift.currentBranchId))}
          nightShift={nightShift}
          canOverrideNight={canOverrideNight}
          prefill={prefill}
          prefillPatientId={prefillPatientId}
          shiftMode={shiftMode}
          onClose={() => setShowNew(false)}
          onSuccess={() => {
            setShowNew(false)
            load()
          }}
        />
      )}

      {managing && (
        <ManageModal
          appt={managing}
          doctors={doctors}
          shiftMode={shiftMode}
          onClose={() => setManaging(null)}
          onStatusChange={(id, newStatus) => {
            // Optimistik güncelleme — API cevabını beklemeden takvim kartı rengini değiştir
            setAppointments((prev) =>
              prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
            )
          }}
          onChanged={() => {
            setManaging(null)
            load()
          }}
        />
      )}
    </div>
  )
}
function IconCalendarDays() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /></svg>
}
function IconCalendarCheck() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /><path d="m9 16 2 2 4-4" /></svg>
}
function IconClockSmall() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
}
function IconChevronLeft() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
}
function IconChevronRightSmall() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
}
