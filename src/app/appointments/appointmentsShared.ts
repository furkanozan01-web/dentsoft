

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
export interface Appointment {
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
export type ShiftMode = 'work' | 'duty'
export const SLOT_MIN = 15
export const SLOT_PX = 28
export const WORK_START_MIN = 9 * 60
export const WORK_END_MIN = 18 * 60
export const DUTY_START_MIN = 18 * 60
export const DUTY_END_MIN = 9 * 60
export const DAY_MIN = 24 * 60
export const SHIFT_CONFIG: Record<ShiftMode, { label: string; startMin: number; endMin: number }> = {
  work: { label: 'Mesai', startMin: WORK_START_MIN, endMin: WORK_END_MIN },
  duty: { label: 'Nöbet', startMin: DUTY_START_MIN, endMin: DAY_MIN + DUTY_END_MIN },
}
export const STATUS_STYLE: Record<string, string> = {
  scheduled: 'bg-[#2DD4BF] text-[#0F2B3D]',
  pending: 'bg-[#FDE047] text-[#0F2B3D]',
  done: 'bg-green-200 text-green-800',
  cancelled: 'bg-red-200 text-red-700 line-through',
  no_show: 'bg-gray-300 text-gray-600',
}
export const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Planlandı',
  pending: 'Onay bekliyor',
  done: 'Tamamlandı',
  cancelled: 'İptal',
  no_show: 'Gelmedi',
}
export function appointmentTone(note: string | null): { card: string; bar: string; badge: string } {
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
export function treatmentMatches(note: string | null, filter: string): boolean {
  if (filter === 'all') return true
  return (note ?? '').toLocaleLowerCase('tr-TR').includes(filter.toLocaleLowerCase('tr-TR'))
}
export function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // Monday
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}
export function minutesToTime(totalMinutes: number): string {
  const m = ((totalMinutes % DAY_MIN) + DAY_MIN) % DAY_MIN
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
export function slotDateTime(day: Date, slotStartMin: number): Date {
  const d = new Date(day)
  d.setHours(0, 0, 0, 0)
  d.setMinutes(slotStartMin)
  return d
}
export function isInShift(d: Date, shiftMode: ShiftMode): boolean {
  const m = minutesOfDay(d)
  if (shiftMode === 'work') return m >= WORK_START_MIN && m < WORK_END_MIN
  return m >= DUTY_START_MIN || m < DUTY_END_MIN
}
export function appointmentShiftDayKey(d: Date, shiftMode: ShiftMode): string {
  const x = new Date(d)
  if (shiftMode === 'duty' && minutesOfDay(x) < DUTY_END_MIN) {
    x.setDate(x.getDate() - 1)
  }
  return isoDate(x)
}
export function offsetPx(d: Date, shiftMode: ShiftMode): number {
  const m = minutesOfDay(d)
  const normalized = shiftMode === 'duty' && m < DUTY_END_MIN ? m + DAY_MIN : m
  return ((normalized - SHIFT_CONFIG[shiftMode].startMin) / SLOT_MIN) * SLOT_PX
}
export function isTimeAllowed(time: string, shiftMode: ShiftMode): boolean {
  const [h, m] = time.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false
  const total = h * 60 + m
  if (shiftMode === 'work') return total >= WORK_START_MIN && total < WORK_END_MIN
  return total >= DUTY_START_MIN || total < DUTY_END_MIN
}
