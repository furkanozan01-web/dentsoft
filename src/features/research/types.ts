export type PresenceFilter = 'all' | 'yes' | 'no'

export interface ResearchFilters {
  patient: {
    search: string
    minAge: string
    maxAge: string
    gender: string
    hasPhone: PresenceFilter
    registeredFrom: string
    registeredTo: string
    status: string
  }
  anamnesis: {
    conditions: string[]
    medication: string
    systemicNote: string
  }
  treatment: {
    name: string
    tooth: string
    from: string
    to: string
    status: string
    doctorId: string
    minFee: string
    maxFee: string
  }
  appointment: {
    from: string
    to: string
    status: string
    hasFuture: PresenceFilter
    inactiveMonths: string
  }
  finance: {
    state: string
    hasPlan: PresenceFilter
    overdueInstallment: PresenceFilter
    minPaid: string
    maxPaid: string
    minDebt: string
    maxDebt: string
    hasClosedAccount: PresenceFilter
  }
  file: {
    type: string
  }
}

export interface ResearchTag {
  id: number
  name: string
  color: string
}

export interface ResearchResult {
  id: number
  name: string
  surname: string
  age: number | null
  gender: string | null
  phone: string | null
  status: string
  lastVisit: string | null
  treatmentSummary: string[]
  doctors: string[]
  totalTreatment: number
  totalPaid: number
  balance: number
  hasOverdueInstallment: boolean
  tags: ResearchTag[]
}

export interface SavedResearch {
  id: number
  name: string
  filters: ResearchFilters
  visible_columns: string[]
  created_at: string
  updated_at: string
}

export interface ResearchDoctor {
  id: number
  name: string
}

export interface ResearchActionResult<T> {
  data?: T
  error?: string
}

