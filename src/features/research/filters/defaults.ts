import type { ResearchFilters } from '../types'

export const DEFAULT_RESEARCH_FILTERS: ResearchFilters = {
  patient: {
    search: '',
    minAge: '',
    maxAge: '',
    gender: '',
    hasPhone: 'all',
    registeredFrom: '',
    registeredTo: '',
    status: '',
  },
  anamnesis: {
    conditions: [],
    medication: '',
    systemicNote: '',
  },
  treatment: {
    name: '',
    tooth: '',
    from: '',
    to: '',
    status: '',
    doctorId: '',
    minFee: '',
    maxFee: '',
  },
  appointment: {
    from: '',
    to: '',
    status: '',
    hasFuture: 'all',
    inactiveMonths: '',
  },
  finance: {
    state: '',
    hasPlan: 'all',
    overdueInstallment: 'all',
    minPaid: '',
    maxPaid: '',
    minDebt: '',
    maxDebt: '',
    hasClosedAccount: 'all',
  },
  file: {
    type: '',
  },
}

export const ANAMNESIS_FILTERS = [
  'Diyabet',
  'Hipertansiyon',
  'Kalp Hastalığı',
  'Alerji',
  'Hamilelik',
  'Sigara',
  'Kan Sulandırıcı',
] as const

