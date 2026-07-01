'use client'

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import {
  createAppointment,
  createPatientForAppointment,
  updateAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  rescheduleAppointment,
} from './actions'

export interface ApptDoctor {
  id: number
  name: string
  color: string | null
}
export interface ApptPatient {
  id: number
  name: string
  surname: string
  phone1: string | null
}
export interface ApptTariff {
  id: number
  treatment_name: string
  category: string | null
  price: number
  duration_minutes: number | null
  color: string | null
}
export interface AppointmentTypeOption { id:number; name:string; default_duration:number; color:string; description:string|null; branch_id:number|null; doctor_ids:number[] }
export interface NightShiftConfig { active:boolean; start:string; end:string; days:number[]; doctorIds:number[]; branchId:number|null; interval:number; note:string|null; currentBranchId:number|null }
interface Appointment {
  id: number
  patient_id: number | null
  doctor_id: number | null
  scheduled_at: string
  duration_min: number
  status: string
  treatment_note: string | null
  appointment_type_id: number | null
  color: string | null
  is_night_shift: boolean
  patient: { name: string; surname: string } | null
  doctor: { id: number; name: string; color: string | null } | null
}

type ShiftMode = 'work' | 'duty'

const SLOT_MIN = 15
const SLOT_PX = 28
const WORK_START_MIN = 9 * 60
const WORK_END_MIN = 18 * 60
const DUTY_START_MIN = 18 * 60
const DUTY_END_MIN = 9 * 60
const DAY_MIN = 24 * 60
const SHIFT_CONFIG: Record<ShiftMode, { label: string; startMin: number; endMin: number }> = {
  work: { label: 'Mesai', startMin: WORK_START_MIN, endMin: WORK_END_MIN },
  duty: { label: 'Nöbet', startMin: DUTY_START_MIN, endMin: DAY_MIN + DUTY_END_MIN },
}

const STATUS_STYLE: Record<string, string> = {
  scheduled: 'bg-[#2DD4BF] text-[#0F2B3D]',
  pending: 'bg-[#FDE047] text-[#0F2B3D]',
  done: 'bg-green-200 text-green-800',
  cancelled: 'bg-red-200 text-red-700 line-through',
  no_show: 'bg-gray-300 text-gray-600',
}
const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Planlandı',
  pending: 'Onay bekliyor',
  done: 'Tamamlandı',
  cancelled: 'İptal',
  no_show: 'Gelmedi',
}

function appointmentTone(note: string | null): { card: string; bar: string; badge: string } {
  const key = (note ?? '').toLocaleLowerCase('tr-TR')
  if (key.includes('dolgu') || key.includes('restorasyon') || key.includes('tamir')) {
    return {
      card: 'bg-[#FFF0DF] border-[#FED7AA] text-[#9A3412]',
      bar: 'bg-[#F97316]',
      badge: 'bg-white/70 text-[#9A3412]',
    }
  }
  if (key.includes('kontrol')) {
    return {
      card: 'bg-[#EAF2FF] border-[#BFDBFE] text-[#1D4ED8]',
      bar: 'bg-[#3B82F6]',
      badge: 'bg-white/70 text-[#1D4ED8]',
    }
  }
  if (key.includes('muayene')) {
    return {
      card: 'bg-[#E6FFFA] border-[#99F6E4] text-[#0F766E]',
      bar: 'bg-[#2DD4BF]',
      badge: 'bg-white/70 text-[#0F766E]',
    }
  }
  if (key.includes('kanal') || key.includes('endodonti')) {
    return {
      card: 'bg-[#FEF9C3] border-[#FDE047] text-[#854D0E]',
      bar: 'bg-[#EAB308]',
      badge: 'bg-white/70 text-[#854D0E]',
    }
  }
  if (key.includes('protez') || key.includes('kron') || key.includes('köprü')) {
    return {
      card: 'bg-[#E0F2FE] border-[#7DD3FC] text-[#0369A1]',
      bar: 'bg-[#0EA5E9]',
      badge: 'bg-white/70 text-[#0369A1]',
    }
  }
  if (key.includes('cerrahi') || key.includes('çekim') || key.includes('implant')) {
    return {
      card: 'bg-[#FFECEC] border-[#FECACA] text-[#B91C1C]',
      bar: 'bg-[#EF4444]',
      badge: 'bg-white/70 text-[#B91C1C]',
    }
  }
  return {
    card: 'bg-[#F3E8FF] border-[#E9D5FF] text-[#6B21A8]',
    bar: 'bg-[#A855F7]',
    badge: 'bg-white/70 text-[#6B21A8]',
  }
}

function treatmentMatches(note: string | null, filter: string): boolean {
  if (filter === 'all') return true
  return (note ?? '').toLocaleLowerCase('tr-TR').includes(filter.toLocaleLowerCase('tr-TR'))
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // Monday
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}
function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}
function minutesToTime(totalMinutes: number): string {
  const m = ((totalMinutes % DAY_MIN) + DAY_MIN) % DAY_MIN
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
function slotDateTime(day: Date, slotStartMin: number): Date {
  const d = new Date(day)
  d.setHours(0, 0, 0, 0)
  d.setMinutes(slotStartMin)
  return d
}
function isInShift(d: Date, shiftMode: ShiftMode): boolean {
  const m = minutesOfDay(d)
  if (shiftMode === 'work') return m >= WORK_START_MIN && m < WORK_END_MIN
  return m >= DUTY_START_MIN || m < DUTY_END_MIN
}
function appointmentShiftDayKey(d: Date, shiftMode: ShiftMode): string {
  const x = new Date(d)
  if (shiftMode === 'duty' && minutesOfDay(x) < DUTY_END_MIN) {
    x.setDate(x.getDate() - 1)
  }
  return isoDate(x)
}
function offsetPx(d: Date, shiftMode: ShiftMode): number {
  const m = minutesOfDay(d)
  const normalized = shiftMode === 'duty' && m < DUTY_END_MIN ? m + DAY_MIN : m
  return ((normalized - SHIFT_CONFIG[shiftMode].startMin) / SLOT_MIN) * SLOT_PX
}
function isTimeAllowed(time: string, shiftMode: ShiftMode): boolean {
  const [h, m] = time.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false
  const total = h * 60 + m
  if (shiftMode === 'work') return total >= WORK_START_MIN && total < WORK_END_MIN
  return total >= DUTY_START_MIN || total < DUTY_END_MIN
}

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
  const [doctorFilter, setDoctorFilter] = useState<'all' | number>('all')
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
      q,
      supabase
        .from('appointments')
        .select(
          'id, patient_id, doctor_id, scheduled_at, duration_min, status, treatment_note, appointment_type_id, color, is_night_shift, patient:patients(name,surname), doctor:doctors(id,name,color)'
        )
        .eq('status', 'pending')
        .order('scheduled_at')
        .limit(50),
    ])
    if (error || pendingError) {
      toast.error(error?.message ?? pendingError?.message ?? 'Randevular yüklenemedi')
      setLoading(false)
      return
    }
    setAppointments((data ?? []) as unknown as Appointment[])
    setPendingReqs((pend ?? []) as unknown as Appointment[])
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

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
}

function IconChevronLeft() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
}

function IconChevronRightSmall() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
}

function PendingRow({ appt, onChanged }: { appt: Appointment; onChanged: () => void }) {
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

function ManageModal({
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

function NewAppointmentModal({
  doctors,
  patients,
  tariffs,
  defaultDuration,
  prefill,
  prefillPatientId,
  shiftMode,
  appointmentTypes,
  nightShift,
  canOverrideNight,
  onClose,
  onSuccess,
}: {
  doctors: ApptDoctor[]
  patients: ApptPatient[]
  tariffs: ApptTariff[]
  defaultDuration: number
  prefill: { date: string; time: string } | null
  prefillPatientId?: number | null
  shiftMode: ShiftMode
  appointmentTypes: AppointmentTypeOption[]
  nightShift: NightShiftConfig
  canOverrideNight: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [patientId, setPatientId] = useState<number | ''>(prefillPatientId ?? '')
  const [doctorId, setDoctorId] = useState<number | ''>(doctors[0]?.id ?? '')
  const [date, setDate] = useState(prefill?.date ?? isoDate(new Date()))
  const [time, setTime] = useState(prefill?.time ?? (shiftMode === 'work' ? '09:00' : '18:00'))
  const [duration, setDuration] = useState(defaultDuration)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [tariffSearch, setTariffSearch] = useState('')
  const [selectedTariff, setSelectedTariff] = useState<ApptTariff | null>(null)
  const [selectedType, setSelectedType] = useState<AppointmentTypeOption | null>(null)
  const [customColor, setCustomColor] = useState('#3B82F6')
  const [overrideNight, setOverrideNight] = useState(false)
  const [saveNewPatient, setSaveNewPatient] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSurname, setNewSurname] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newBirthDate, setNewBirthDate] = useState('')
  const [newGender, setNewGender] = useState('')

  const filteredPatients = patients
    .filter((p) => `${p.name} ${p.surname} ${p.phone1 ?? ''}`.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 8)

  const filteredTariffs = useMemo(() => {
    if (!tariffSearch.trim()) return tariffs.slice(0, 12)
    const q = tariffSearch.toLowerCase()
    return tariffs.filter((t) => t.treatment_name.toLowerCase().includes(q)).slice(0, 12)
  }, [tariffs, tariffSearch])

  const pickTariff = (t: ApptTariff) => {
    setSelectedTariff(t)
    setNote(t.treatment_name)
    setTariffSearch('')
    if (t.duration_minutes) setDuration(t.duration_minutes)
  }

  const startNewPatient = () => {
    const parts = search.trim().split(/\s+/).filter(Boolean)
    setNewName((cur) => cur || parts.slice(0, -1).join(' ') || parts[0] || '')
    setNewSurname((cur) => cur || (parts.length > 1 ? parts[parts.length - 1] : ''))
    setSaveNewPatient(true)
    setPatientId('')
  }

  const selectedPatient = patientId ? patients.find((p) => p.id === patientId) : null
  const unsavedName = search.trim() || [newName, newSurname].filter(Boolean).join(' ').trim()

  const save = () => {
    if (!doctorId) {
      toast.error('Hekim seçin')
      return
    }
    if (!patientId && !saveNewPatient && !unsavedName) {
      toast.error('Hasta seçin veya hasta adını yazın')
      return
    }
    if (saveNewPatient && (!newName.trim() || !newSurname.trim())) {
      toast.error('Yeni hasta için ad ve soyad zorunludur')
      return
    }

    startTransition(async () => {
      let finalPatientId: number | null = patientId ? Number(patientId) : null
      if (saveNewPatient) {
        const patientRes = await createPatientForAppointment({
          name: newName,
          surname: newSurname,
          phone1: newPhone || null,
          birthDate: newBirthDate || null,
          gender: newGender || null,
        })
        if (patientRes.error || !patientRes.id) {
          toast.error(patientRes.error ?? 'Hasta kaydedilemedi')
          return
        }
        finalPatientId = patientRes.id
      }

      const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
      const guestPrefix = !finalPatientId && unsavedName ? `Kayıtsız: ${unsavedName}` : null
      const treatmentNote = [guestPrefix, note.trim() || null].filter(Boolean).join(' · ') || null
      const res = await createAppointment({
        patientId: finalPatientId,
        doctorId: Number(doctorId),
        scheduledAt,
        durationMin: duration,
        treatmentNote,
        appointmentTypeId: selectedType?.id ?? null,
        color: customColor,
        overrideNight,
      })
      if (res?.error) toast.error(res.error)
      else onSuccess()
    })
  }

  return (
    <ApptModal title="Yeni Randevu" onClose={onClose}>
      <div className="p-6 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-gray-500">Hasta Ara</label>
            <button type="button" onClick={startNewPatient} className="text-xs font-semibold text-[#0F2B3D] hover:text-[#2DD4BF]">
              Yeni hasta ekle
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPatientId('') }}
            placeholder="Ad soyad veya telefon yazın"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30"
          />
          {selectedPatient && (
            <p className="mt-2 text-xs text-[#0F2B3D]">Seçili hasta: {selectedPatient.name} {selectedPatient.surname}</p>
          )}
          {search.trim() && filteredPatients.length > 0 && !patientId && (
            <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filteredPatients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setPatientId(p.id); setSearch(`${p.name} ${p.surname}`); setSaveNewPatient(false) }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#2DD4BF]/10"
                >
                  <span className="font-medium text-[#0F2B3D]">{p.name} {p.surname}</span>
                  <span className="text-xs text-gray-400">{p.phone1 ?? ''}</span>
                </button>
              ))}
            </div>
          )}
          {search.trim() && filteredPatients.length === 0 && !saveNewPatient && (
            <p className="mt-2 text-xs text-gray-400">Eşleşen kayıt yok. Yeni hasta ekleyebilir veya kaydetmeden randevu oluşturabilirsiniz.</p>
          )}
        </div>

        {saveNewPatient && (
          <div className="rounded-2xl border border-[#2DD4BF]/30 bg-[#2DD4BF]/5 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ad *" className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
              <input value={newSurname} onChange={(e) => setNewSurname(e.target.value)} placeholder="Soyad *" className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Telefon" className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
              <input type="date" value={newBirthDate} onChange={(e) => setNewBirthDate(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
            </div>
            <select value={newGender} onChange={(e) => setNewGender(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none">
              <option value="">Cinsiyet seçiniz</option>
              <option value="male">Erkek</option>
              <option value="female">Kadın</option>
              <option value="other">Diğer</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Hekim</label>
          <select value={doctorId} onChange={(e) => setDoctorId(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30">
            {doctors.map((d) => <option key={d.id} value={d.id}>Dt. {d.name}</option>)}
          </select>
        </div>

        <div><label className="mb-2 block text-xs font-medium text-gray-500">Hızlı Randevu Türü</label><div className="flex max-h-32 flex-wrap gap-2 overflow-auto">{appointmentTypes.filter((type)=>!type.doctor_ids.length||type.doctor_ids.includes(Number(doctorId))).map((type)=><button key={type.id} type="button" onClick={()=>{setSelectedType(type);setCustomColor(type.color);setDuration(type.default_duration);setNote(type.name)}} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${selectedType?.id===type.id?'border-[#142536] bg-slate-50 text-[#142536]':'border-slate-200 text-slate-500'}`}><span className="h-3 w-3 rounded-full" style={{backgroundColor:type.color}}/>{type.name}</button>)}</div></div>

        <div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium text-gray-500">Randevu Rengi<div className="mt-1.5 flex gap-2"><input type="color" value={customColor} onChange={e=>setCustomColor(e.target.value)} className="h-10 w-14 rounded-xl border border-gray-200"/><input value={customColor} onChange={e=>setCustomColor(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-gray-200 px-2 font-mono text-xs"/></div></label><div><p className="text-xs font-medium text-gray-500">Ön izleme</p><div className="mt-1.5 h-10 rounded-xl px-3 py-2 text-xs font-black text-white" style={{backgroundColor:customColor}}>{selectedType?.name||'Randevu'}</div></div></div>

        {tariffs.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">İşlem / Tedavi</label>
            {selectedTariff ? (
              <div className="flex items-center justify-between px-3 py-2 bg-[#2DD4BF]/10 border border-[#2DD4BF]/30 rounded-xl text-sm">
                <span className="font-medium text-[#0F2B3D]">{selectedTariff.treatment_name}</span>
                <button type="button" onClick={() => { setSelectedTariff(null); setNote('') }} className="text-gray-400 hover:text-red-500">Kaldır</button>
              </div>
            ) : (
              <div className="relative">
                <input value={tariffSearch} onChange={(e) => setTariffSearch(e.target.value)} placeholder="İşlem ara" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
                {tariffSearch.length > 0 && filteredTariffs.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {filteredTariffs.map((t) => (
                      <button key={t.id} type="button" onClick={() => pickTariff(t)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#2DD4BF]/10">
                        <span className="text-[#0F2B3D]">{t.treatment_name}</span>
                        <span className="ml-2 text-xs text-gray-400">{t.duration_minutes ?? defaultDuration} dk</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Tarih</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Saat</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
            <p className="mt-1 text-[11px] text-gray-400">{shiftMode === 'work' ? '09:00-18:00' : '18:00-09:00'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Süre (dk)</label>
            <input type="number" value={duration} min={5} step={5} onChange={(e) => setDuration(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
          </div>
        </div>

        {shiftMode === 'duty' && <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs font-bold text-indigo-700">Gece mesaisi: {nightShift.active ? `${nightShift.start}–${nightShift.end}` : 'Kapalı'}{canOverrideNight && <label className="mt-2 flex items-center gap-2 text-indigo-600"><input type="checkbox" checked={overrideNight} onChange={e=>setOverrideNight(e.target.checked)}/>Yetkili olarak özel izinle oluştur</label>}</div>}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Not (opsiyonel)</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ek notlar" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">İptal</button>
          <button onClick={save} disabled={pending} className="flex-1 px-4 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] disabled:opacity-60">
            {pending ? 'Kaydediliyor…' : 'Randevu Oluştur'}
          </button>
        </div>
      </div>
    </ApptModal>
  )
}
function ApptModal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#0F2B3D]">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

