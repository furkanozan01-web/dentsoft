import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { tryDecrypt } from '@/lib/crypto'
import type { Anamnesis } from '@/lib/anamnesis'
import type { ResearchFilters, ResearchResult, ResearchTag } from '../types'

interface PatientRow {
  id: number
  name: string
  surname: string
  gender: string | null
  birth_date: string | null
  phone1: string | null
  reg_date: string | null
  status: string
  anamnesis_enc: string | null
}

interface TreatmentRow {
  patient_id: number | null
  treatment_name: string
  treatment_date: string | null
  status: string
  tooth: number | null
  doctor_id: number | null
  fee: number
  is_closed: boolean
}

interface AppointmentRow {
  patient_id: number | null
  scheduled_at: string
  status: string
}

interface TransactionRow {
  patient_id: number
  amount: number
  type: string
}

interface InstallmentRow {
  patient_id: number
  due_date: string
  paid: boolean
}

interface ImageRow {
  patient_id: number
  file_name: string
  caption: string | null
}

interface DoctorRow {
  id: number
  name: string
}

interface TagAssignmentRow {
  patient_id: number
  tag: ResearchTag | ResearchTag[] | null
}

interface PageResult<T> {
  data: T[] | null
  error: { message: string } | null
}

const PAGE_SIZE = 1000

async function fetchAll<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

function normalize(value: string | null | undefined) {
  return (value ?? '').toLocaleLowerCase('tr-TR').trim()
}

function parseNumber(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function liraToKurus(value: string) {
  const parsed = parseNumber(value)
  return parsed === null ? null : Math.round(parsed * 100)
}

function calculateAge(birthDate: string | null) {
  if (!birthDate) return null
  const birth = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const month = today.getMonth() - birth.getMonth()
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1
  return age
}

function latestDate(values: Array<string | null | undefined>) {
  const valid = values.filter((value): value is string => Boolean(value))
  return valid.sort((a, b) => b.localeCompare(a))[0] ?? null
}

function matchesPresence(actual: boolean, filter: 'all' | 'yes' | 'no') {
  return filter === 'all' || (filter === 'yes' ? actual : !actual)
}

function parseAnamnesis(value: string | null): Anamnesis | null {
  if (!value) return null
  const decrypted = tryDecrypt(value)
  if (!decrypted) return null
  try {
    const parsed = JSON.parse(decrypted) as Partial<Anamnesis>
    return {
      diseases: Array.isArray(parsed.diseases) ? parsed.diseases : [],
      medications: Array.isArray(parsed.medications) ? parsed.medications : [],
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    }
  } catch {
    return null
  }
}

function matchesAnamnesis(patient: PatientRow, filters: ResearchFilters['anamnesis']) {
  const anamnesis = parseAnamnesis(patient.anamnesis_enc)
  if (!anamnesis) return false
  const diseases = anamnesis.diseases.map(normalize)
  const medications = anamnesis.medications.map(normalize)
  const notes = normalize(anamnesis.notes)
  const combined = [...diseases, ...medications, notes].join(' ')

  const conditionsMatch = filters.conditions.every((condition) => {
    const key = normalize(condition)
    if (key === normalize('Kan Sulandırıcı')) {
      return ['kan sulandır', 'aspirin', 'varfarin', 'warfarin', 'antikoag'].some((term) =>
        combined.includes(normalize(term))
      )
    }
    return combined.includes(key)
  })

  return (
    conditionsMatch &&
    (!filters.medication || medications.some((item) => item.includes(normalize(filters.medication)))) &&
    (!filters.systemicNote || notes.includes(normalize(filters.systemicNote)))
  )
}

export async function searchPatients(
  supabase: SupabaseClient,
  clinicId: number,
  filters: ResearchFilters
): Promise<ResearchResult[]> {
  const patients = await fetchAll<PatientRow>((from, to) =>
    supabase
      .from('patients')
      .select('id, name, surname, gender, birth_date, phone1, reg_date, status, anamnesis_enc')
      .eq('clinic_id', clinicId)
      .order('id')
      .range(from, to) as unknown as PromiseLike<PageResult<PatientRow>>
  )

  const search = normalize(filters.patient.search)
  const minAge = parseNumber(filters.patient.minAge)
  const maxAge = parseNumber(filters.patient.maxAge)
  let candidates = patients.filter((patient) => {
    const age = calculateAge(patient.birth_date)
    const fullName = normalize(`${patient.name} ${patient.surname}`)
    return (
      (!search || fullName.includes(search)) &&
      (minAge === null || (age !== null && age >= minAge)) &&
      (maxAge === null || (age !== null && age <= maxAge)) &&
      (!filters.patient.gender || patient.gender === filters.patient.gender) &&
      matchesPresence(Boolean(patient.phone1?.trim()), filters.patient.hasPhone) &&
      (!filters.patient.registeredFrom || (patient.reg_date ?? '') >= filters.patient.registeredFrom) &&
      (!filters.patient.registeredTo || (patient.reg_date ?? '') <= filters.patient.registeredTo) &&
      (!filters.patient.status || patient.status === filters.patient.status)
    )
  })

  const hasAnamnesisFilter =
    filters.anamnesis.conditions.length > 0 ||
    Boolean(filters.anamnesis.medication.trim()) ||
    Boolean(filters.anamnesis.systemicNote.trim())
  if (hasAnamnesisFilter) {
    candidates = candidates.filter((patient) => matchesAnamnesis(patient, filters.anamnesis))
  }
  if (candidates.length === 0) return []

  const [treatments, appointments, transactions, installments, images, doctors, tagAssignments] =
    await Promise.all([
      fetchAll<TreatmentRow>((from, to) =>
        supabase
          .from('treatments')
          .select('patient_id, treatment_name, treatment_date, status, tooth, doctor_id, fee, is_closed')
          .eq('clinic_id', clinicId)
          .order('id')
          .range(from, to) as unknown as PromiseLike<PageResult<TreatmentRow>>
      ),
      fetchAll<AppointmentRow>((from, to) =>
        supabase
          .from('appointments')
          .select('patient_id, scheduled_at, status')
          .eq('clinic_id', clinicId)
          .order('id')
          .range(from, to) as unknown as PromiseLike<PageResult<AppointmentRow>>
      ),
      fetchAll<TransactionRow>((from, to) =>
        supabase
          .from('transactions')
          .select('patient_id, amount, type')
          .eq('clinic_id', clinicId)
          .order('id')
          .range(from, to) as unknown as PromiseLike<PageResult<TransactionRow>>
      ),
      fetchAll<InstallmentRow>((from, to) =>
        supabase
          .from('payment_plans')
          .select('patient_id, due_date, paid')
          .eq('clinic_id', clinicId)
          .order('id')
          .range(from, to) as unknown as PromiseLike<PageResult<InstallmentRow>>
      ),
      fetchAll<ImageRow>((from, to) =>
        supabase
          .from('patient_images')
          .select('patient_id, file_name, caption')
          .eq('clinic_id', clinicId)
          .order('id')
          .range(from, to) as unknown as PromiseLike<PageResult<ImageRow>>
      ),
      fetchAll<DoctorRow>((from, to) =>
        supabase
          .from('doctors')
          .select('id, name')
          .eq('clinic_id', clinicId)
          .order('id')
          .range(from, to) as unknown as PromiseLike<PageResult<DoctorRow>>
      ),
      fetchAll<TagAssignmentRow>((from, to) =>
        supabase
          .from('patient_tag_assignments')
          .select('patient_id, tag:patient_tags(id, name, color)')
          .eq('clinic_id', clinicId)
          .order('id')
          .range(from, to) as unknown as PromiseLike<PageResult<TagAssignmentRow>>
      ),
    ])

  const byPatient = <T extends { patient_id: number | null }>(rows: T[]) => {
    const map = new Map<number, T[]>()
    for (const row of rows) {
      if (row.patient_id === null) continue
      map.set(row.patient_id, [...(map.get(row.patient_id) ?? []), row])
    }
    return map
  }

  const treatmentMap = byPatient(treatments)
  const appointmentMap = byPatient(appointments)
  const transactionMap = byPatient(transactions)
  const installmentMap = byPatient(installments)
  const imageMap = byPatient(images)
  const assignmentMap = byPatient(tagAssignments)
  const doctorMap = new Map(doctors.map((doctor) => [doctor.id, doctor.name]))
  const today = new Date().toISOString().slice(0, 10)
  const minFee = liraToKurus(filters.treatment.minFee)
  const maxFee = liraToKurus(filters.treatment.maxFee)
  const minPaid = liraToKurus(filters.finance.minPaid)
  const maxPaid = liraToKurus(filters.finance.maxPaid)
  const minDebt = liraToKurus(filters.finance.minDebt)
  const maxDebt = liraToKurus(filters.finance.maxDebt)
  const tooth = parseNumber(filters.treatment.tooth)
  const inactiveMonths = parseNumber(filters.appointment.inactiveMonths)
  const inactiveCutoff = inactiveMonths
    ? new Date(new Date().setMonth(new Date().getMonth() - inactiveMonths)).toISOString().slice(0, 10)
    : null

  return candidates
    .map((patient): ResearchResult & { matches?: boolean } => {
      const patientTreatments = treatmentMap.get(patient.id) ?? []
      const patientAppointments = appointmentMap.get(patient.id) ?? []
      const patientTransactions = transactionMap.get(patient.id) ?? []
      const patientInstallments = installmentMap.get(patient.id) ?? []
      const patientImages = imageMap.get(patient.id) ?? []
      const treatmentMatches = patientTreatments.filter((treatment) =>
        (!filters.treatment.name || normalize(treatment.treatment_name).includes(normalize(filters.treatment.name))) &&
        (tooth === null || treatment.tooth === tooth) &&
        (!filters.treatment.from || (treatment.treatment_date ?? '') >= filters.treatment.from) &&
        (!filters.treatment.to || (treatment.treatment_date ?? '') <= filters.treatment.to) &&
        (!filters.treatment.status || treatment.status === filters.treatment.status) &&
        (!filters.treatment.doctorId || treatment.doctor_id === Number(filters.treatment.doctorId)) &&
        (minFee === null || treatment.fee >= minFee) &&
        (maxFee === null || treatment.fee <= maxFee)
      )
      const hasTreatmentFilter = Object.values(filters.treatment).some(Boolean)

      const appointmentMatches = patientAppointments.filter((appointment) => {
        const date = appointment.scheduled_at.slice(0, 10)
        return (
          (!filters.appointment.from || date >= filters.appointment.from) &&
          (!filters.appointment.to || date <= filters.appointment.to) &&
          (!filters.appointment.status || appointment.status === filters.appointment.status)
        )
      })
      const hasAppointmentRangeFilter = Boolean(
        filters.appointment.from || filters.appointment.to || filters.appointment.status
      )
      const hasFutureAppointment = patientAppointments.some(
        (appointment) =>
          appointment.scheduled_at.slice(0, 10) >= today &&
          !['cancelled', 'no_show'].includes(appointment.status)
      )

      const openTreatments = patientTreatments.filter((treatment) => treatment.status !== 'cancelled')
      const totalTreatment = openTreatments.reduce((sum, treatment) => sum + (treatment.fee ?? 0), 0)
      const totalPaid = patientTransactions
        .filter((transaction) => transaction.type === 'payment')
        .reduce((sum, transaction) => sum + (transaction.amount ?? 0), 0)
      const balance = totalTreatment - totalPaid
      const hasPlan = patientInstallments.length > 0
      const hasOverdueInstallment = patientInstallments.some(
        (installment) => !installment.paid && installment.due_date < today
      )
      const hasClosedAccount = patientTreatments.some((treatment) => treatment.is_closed)
      const financeStateMatches =
        !filters.finance.state ||
        (filters.finance.state === 'debt' && balance > 0) ||
        (filters.finance.state === 'no_debt' && balance <= 0) ||
        (filters.finance.state === 'partial' && totalPaid > 0 && balance > 0)

      const fileText = patientImages
        .map((image) => normalize(`${image.file_name} ${image.caption ?? ''}`))
        .join(' ')
      const fileMatches =
        !filters.file.type ||
        (filters.file.type === 'any' && patientImages.length > 0) ||
        (filters.file.type === 'panoramic' && ['panoramik', 'panoramic', 'ortopantomografi'].some((term) => fileText.includes(term))) ||
        (filters.file.type === 'xray' && ['röntgen', 'rontgen', 'xray', 'x-ray'].some((term) => fileText.includes(term))) ||
        (filters.file.type === 'photo' && ['fotoğraf', 'fotograf', 'photo', 'jpg', 'jpeg', 'png', 'webp'].some((term) => fileText.includes(term)))

      const lastVisit = latestDate([
        ...patientTreatments.map((treatment) => treatment.treatment_date),
        ...patientAppointments
          .filter((appointment) => appointment.scheduled_at.slice(0, 10) <= today)
          .map((appointment) => appointment.scheduled_at.slice(0, 10)),
      ])
      const rawTags = assignmentMap.get(patient.id) ?? []
      const tags = rawTags.flatMap((assignment) => {
        if (!assignment.tag) return []
        return Array.isArray(assignment.tag) ? assignment.tag : [assignment.tag]
      })

      const matches =
        (!hasTreatmentFilter || treatmentMatches.length > 0) &&
        (!hasAppointmentRangeFilter || appointmentMatches.length > 0) &&
        matchesPresence(hasFutureAppointment, filters.appointment.hasFuture) &&
        (!inactiveCutoff || !lastVisit || lastVisit < inactiveCutoff) &&
        financeStateMatches &&
        matchesPresence(hasPlan, filters.finance.hasPlan) &&
        matchesPresence(hasOverdueInstallment, filters.finance.overdueInstallment) &&
        (minPaid === null || totalPaid >= minPaid) &&
        (maxPaid === null || totalPaid <= maxPaid) &&
        (minDebt === null || balance >= minDebt) &&
        (maxDebt === null || balance <= maxDebt) &&
        matchesPresence(hasClosedAccount, filters.finance.hasClosedAccount) &&
        fileMatches

      return {
        id: patient.id,
        name: patient.name,
        surname: patient.surname,
        age: calculateAge(patient.birth_date),
        gender: patient.gender,
        phone: patient.phone1,
        status: patient.status,
        lastVisit,
        treatmentSummary: Array.from(new Set(patientTreatments.map((item) => item.treatment_name))).slice(0, 3),
        doctors: Array.from(
          new Set(
            patientTreatments
              .map((item) => (item.doctor_id ? doctorMap.get(item.doctor_id) : null))
              .filter((item): item is string => Boolean(item))
          )
        ),
        totalTreatment,
        totalPaid,
        balance,
        hasOverdueInstallment,
        tags,
        matches,
      }
    })
    .filter((patient) => patient.matches)
    .map((patient) => {
      delete patient.matches
      return patient
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1
      return (b.lastVisit ?? '').localeCompare(a.lastVisit ?? '')
    })
}
