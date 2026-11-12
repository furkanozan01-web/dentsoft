'use client'

import { useKeepFormValues } from '@/lib/hooks/useKeepFormValues'
import { useState, useEffect, useCallback, useMemo, useActionState, useRef, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { createPatient, deletePatient, dismissImportantNotes, getAnamnesis } from './actions'
import { EMPTY_ANAMNESIS, type Anamnesis } from '@/lib/anamnesis'
import { PATIENT_TABS as TABS } from './constants'
import { toTitleCase } from '@/lib/format'
import { usePersistedPreference } from '@/lib/hooks/usePersistedPreference'
import PatientSwitcher from './PatientSwitcher'
import type {
  ClinicInfo,
  ClinicalNote,
  DoctorOption,
  Installment,
  Patient,
  PatientImage,
  PatientReminder,
  Prescription,
  TabId,
  TariffOption,
  TariffProfile,
  Transaction,
  Treatment,
  ActionResult,
} from './types'
import { AddPaymentModal, EditPatientModal, NewPatientModal } from './PatientModals'
import ListeTab from './PatientListTab'
import HastaKartiTab from './PatientSummaryTab'
import OralTab from './PatientOralTab'
import HesapTab from './PatientAccountTab'
import FaturaTab from './PatientInvoiceTab'
import NotGoruntuTab from './PatientNotesImagesTab'
import ReceteTab from './PatientPrescriptionTab'
import TakipTab from './PatientFollowupTab'
export type { ClinicInfo, DoctorOption, Patient, TariffOption, TariffProfile } from './types'

export interface PatientTreatmentSummary {
  patient_id: number | null
  status: string | null
  treatment_name: string | null
  category: string | null
}

// ---- Main ----
export default function PatientsClient({
  patients: initial,
  doctors,
  tariffs,
  tariffProfiles,
  clinic,
  clinicId,
  ongoingPatientIds = [],
  treatmentSummaries = [],
}: {
  patients: Patient[]
  doctors: DoctorOption[]
  tariffs: TariffOption[]
  tariffProfiles: TariffProfile[]
  clinic: ClinicInfo | null
  clinicId: number
  ongoingPatientIds?: number[]
  treatmentSummaries?: PatientTreatmentSummary[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const confirm = useConfirm()
  const [supabase] = useState(() => createClient())

  const [patients, setPatients] = useState(initial)
  const listFilter = searchParams.get('filter')
  const [selected, setSelected] = useState<Patient | null>(null)
  const [lastPatientId, setLastPatientId] = usePersistedPreference<number | null>('dentsoft:last-patient-id', null)
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tab = searchParams.get('tab') as TabId | null
    return tab && TABS.some((item) => item.id === tab) ? tab : 'liste'
  })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'passive'>('all')
  const [treatmentStatusFilter, setTreatmentStatusFilter] = useState<'all' | 'active' | 'done'>('all')
  const [treatmentTypeFilter, setTreatmentTypeFilter] = useState('all')
  const [showNewModal, setShowNewModal] = useState(() => searchParams.get('action') === 'new')
  const [showCreateCard, setShowCreateCard] = useState(false)
  const [editPatient, setEditPatient] = useState<Patient | null>(null)
  const [deletingPatient, setDeletingPatient] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [reminders, setReminders] = useState<PatientReminder[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [notes, setNotes] = useState<ClinicalNote[]>([])
  const [images, setImages] = useState<PatientImage[]>([])
  const [importantReminder, setImportantReminder] = useState<{
    patient: Patient
    notes: ClinicalNote[]
  } | null>(null)
  const [importantPending, startImportantTransition] = useTransition()
  const financialRequestRef = useRef(0)
  const [loadingFinance, setLoadingFinance] = useState(false)
  const [loadFinanceError, setLoadFinanceError] = useState(false)
  const [anamnesis, setAnamnesis] = useState<Anamnesis>(EMPTY_ANAMNESIS)
  const [loadingAnamnesis, setLoadingAnamnesis] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      setPatients(initial)
    })
  }, [initial])

  const ongoingSet = useMemo(() => new Set(ongoingPatientIds), [ongoingPatientIds])
  const filterLabel = listFilter === 'ongoing' ? 'Tedavisi devam eden hastalar' : null
  const treatmentMap = useMemo(() => {
    const map = new Map<number, PatientTreatmentSummary[]>()
    for (const item of treatmentSummaries) {
      if (!item.patient_id) continue
      const list = map.get(item.patient_id) ?? []
      list.push(item)
      map.set(item.patient_id, list)
    }
    return map
  }, [treatmentSummaries])
  const treatmentTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          treatmentSummaries
            .map((item) => item.category || item.treatment_name)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b, 'tr-TR')),
    [treatmentSummaries]
  )

  const derivedStatus = useCallback((patient: Patient): 'active' | 'passive' => {
    const patientTreatments = treatmentMap.get(patient.id) ?? []
    if (patientTreatments.length === 0) return patient.status === 'passive' ? 'passive' : 'active'
    const statuses = patientTreatments.map((t) => (t.status ?? '').toLowerCase())
    if (statuses.some((status) => ['planned', 'in_progress'].includes(status))) return 'active'
    if (statuses.every((status) => ['done', 'completed', 'paid'].includes(status))) return 'passive'
    return patient.status === 'passive' ? 'passive' : 'active'
  }, [treatmentMap])

  const filtered = patients
    .map((p) => ({ ...p, status: derivedStatus(p) }))
    .filter((p) => {
      const q = search.toLowerCase()
      const name = `${p.name} ${p.surname}`.toLowerCase()
      const patientTreatments = treatmentMap.get(p.id) ?? []
      const treatmentStatusMatches =
        treatmentStatusFilter === 'all' ||
        (treatmentStatusFilter === 'active'
          ? patientTreatments.some((t) => ['planned', 'in_progress'].includes((t.status ?? '').toLowerCase()))
          : patientTreatments.length > 0 &&
            patientTreatments.every((t) => ['done', 'completed', 'paid'].includes((t.status ?? '').toLowerCase())))
      const treatmentTypeMatches =
        treatmentTypeFilter === 'all' ||
        patientTreatments.some((t) => (t.category || t.treatment_name) === treatmentTypeFilter)
      return (
        (!q || name.includes(q) || (p.phone1 ?? '').includes(q)) &&
        (statusFilter === 'all' || p.status === statusFilter) &&
        (listFilter !== 'ongoing' || ongoingSet.has(p.id)) &&
        treatmentStatusMatches &&
        treatmentTypeMatches
      )
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const loadFinancials = useCallback(
    async (patientId: number, showImportantReminder = false) => {
      const requestId = ++financialRequestRef.current
      setLoadingFinance(true)
      setLoadFinanceError(false)
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 15000)
        )
        const results = await Promise.race([
          Promise.all([
            supabase
              .from('transactions')
              .select('id, transaction_date, amount, method, type, description, invoice_no, invoice_sent_at, invoice_institution, invoice_line_description, invoice_amount, invoice_vat_rate, original_currency, original_amount, exchange_rate, partner_id, partner:business_partners(name)')
              .eq('clinic_id', clinicId)
              .eq('patient_id', patientId)
              .order('transaction_date', { ascending: false }),
            supabase
              .from('treatments')
              .select('id, treatment_date, treatment_name, fee, original_fee, is_closed, status, tooth, doctor:doctors(name), tariff:tariffs(visual_schema)')
              .eq('clinic_id', clinicId)
              .eq('patient_id', patientId)
              .neq('status', 'cancelled')
              .order('treatment_date', { ascending: false })
              .overrideTypes<Treatment[], { merge: false }>(),
            supabase
              .from('payment_plans')
              .select('id, due_date, amount, paid, group_id')
              .eq('clinic_id', clinicId)
              .eq('patient_id', patientId)
              .order('due_date'),
            supabase
              .from('patient_reminders')
              .select('id, reminder_date, note, is_done, created_at')
              .eq('clinic_id', clinicId)
              .eq('patient_id', patientId)
              .order('reminder_date'),
            supabase
              .from('prescriptions')
              .select('id, content, created_at, doctor:doctors(name)')
              .eq('clinic_id', clinicId)
              .eq('patient_id', patientId)
              .order('created_at', { ascending: false })
              .overrideTypes<Prescription[], { merge: false }>(),
            supabase
              .from('clinical_notes')
              .select('id, content, created_at, is_important, important_dismissed')
              .eq('clinic_id', clinicId)
              .eq('patient_id', patientId)
              .order('created_at', { ascending: false }),
            supabase
              .from('patient_images')
              .select('id, storage_path, file_name, created_at')
              .eq('clinic_id', clinicId)
              .eq('patient_id', patientId)
              .order('created_at', { ascending: false }),
          ]),
          timeout,
        ])
        const queryError = results.find((result) => result.error)?.error
        if (queryError) throw queryError
        if (requestId !== financialRequestRef.current) return
        const [{ data: tx }, { data: tr }, { data: pp }, { data: rem }, { data: rx }, { data: nt }, { data: im }] = results
        setTransactions(((tx ?? []) as unknown[]).map((t: unknown) => {
          const r = t as Record<string, unknown>
          return { ...r, partner_name: (r.partner as Record<string, string> | null)?.name ?? null }
        }) as Transaction[])
        setTreatments(tr ?? [])
        setInstallments((pp ?? []) as Installment[])
        setReminders((rem ?? []) as PatientReminder[])
        setPrescriptions(rx ?? [])
        const loadedNotes = (nt ?? []) as ClinicalNote[]
        setNotes(loadedNotes)
        setImages((im ?? []) as PatientImage[])
        if (showImportantReminder) {
          const reminderNotes = loadedNotes.filter(
            (note) => note.is_important && !note.important_dismissed
          )
          const reminderPatient = patients.find((patient) => patient.id === patientId)
          setImportantReminder(
            reminderPatient && reminderNotes.length > 0
              ? { patient: reminderPatient, notes: reminderNotes }
              : null
          )
        }
      } catch {
        if (requestId === financialRequestRef.current) setLoadFinanceError(true)
      } finally {
        if (requestId === financialRequestRef.current) setLoadingFinance(false)
      }
    },
    [clinicId, patients, supabase]
  )

  const loadAnamnesis = useCallback(async (patientId: number) => {
    setLoadingAnamnesis(true)
    const res = await getAnamnesis(patientId)
    setAnamnesis(res.data ?? EMPTY_ANAMNESIS)
    setLoadingAnamnesis(false)
  }, [])

  // URL'den patient_id ve tab parametrelerini oku → hasta seç ve sekmeye git.
  // URL'de patient_id yoksa, tarayıcıda hatırlanan son hastaya düş.
  useEffect(() => {
    if (selected) return
    const pid = searchParams.get('patient_id') ?? searchParams.get('id') ?? (lastPatientId ? String(lastPatientId) : null)
    const tab = searchParams.get('tab') as TabId | null
    if (!pid) return
    const p = patients.find((x) => x.id === Number(pid))
    if (!p) return
    const fromUrl = Boolean(searchParams.get('patient_id') ?? searchParams.get('id'))
    queueMicrotask(() => {
      setSelected(p)
      setLastPatientId(p.id)
      if (fromUrl) setActiveTab(tab && TABS.some((item) => item.id === tab) ? tab : 'hasta-karti')
      void loadFinancials(p.id, true)
      void loadAnamnesis(p.id)
      // Bakiye → "Ödeme Al" ile gelindiyse ödeme modalını aç
      if (searchParams.get('pay') === '1') setShowPaymentModal(true)
    })
  }, [lastPatientId, loadAnamnesis, loadFinancials, patients, searchParams, selected, setLastPatientId])

  const handleTabChange = (tab: TabId) => {
    if (tab !== 'liste' && !selected && !(tab === 'hasta-karti' && showCreateCard)) {
      // Henüz hasta seçilmediyse (ör. sayfa yeni açıldı) listedeki ilk hastaya düş.
      const fallback = patients[0]
      if (!fallback) return
      loadPatientData(fallback)
    }
    if (tab !== 'hasta-karti') setShowCreateCard(false)
    if (tab !== 'liste' && activeTab === 'liste' && selected) {
      void loadFinancials(selected.id, true)
    }
    setActiveTab(tab)
  }

  // Sadece seç + verileri yükle (sekme değiştirmez) — listede vurgulanır.
  const loadPatientData = (p: Patient, showImportantReminder = false) => {
    setSelected(p)
    setLastPatientId(p.id)
    loadFinancials(p.id, showImportantReminder)
    loadAnamnesis(p.id)
  }

  // Satıra tıklama: seç + highlight, listede kal.
  const handleSelectRow = (p: Patient) => {
    if (selected?.id === p.id) {
      // ikinci tıklama → hasta kartını aç
      setActiveTab('hasta-karti')
      void loadFinancials(p.id, true)
      return
    }
    loadPatientData(p)
  }

  // Hasta kartını aç (detay).
  const handleOpenPatient = (p: Patient) => {
    setShowCreateCard(false)
    loadPatientData(p, true)
    setActiveTab('hasta-karti')
  }

  const handleDismissImportantReminder = () => {
    if (!importantReminder) return
    const reminder = importantReminder
    startImportantTransition(async () => {
      const ids = reminder.notes.map((note) => note.id)
      const res = await dismissImportantNotes(reminder.patient.id, ids)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setNotes((current) =>
        current.map((note) =>
          ids.includes(note.id) ? { ...note, important_dismissed: true } : note
        )
      )
      setImportantReminder(null)
      toast.success('Önemli not hatırlatması kapatıldı')
    })
  }

  const handleCreateFromList = () => {
    setSelected(null)
    setShowCreateCard(true)
    setActiveTab('hasta-karti')
  }

  const handleDeletePatient = async (p: Patient) => {
    const ok = await confirm({
      title: 'Hastayı Kalıcı Olarak Sil',
      message: `${toTitleCase(p.name)} ${toTitleCase(p.surname)} ve hastaya bağlı randevu, tedavi, ödeme, not ve dosya kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      confirmText: 'Kalıcı Olarak Sil',
    })
    if (!ok) return
    setDeletingPatient(true)
    const res = await deletePatient(p.id)
    setDeletingPatient(false)
    if (res?.error) {
      toast.error(`Silinemedi: ${res.error}`)
      return
    }
    setPatients((prev) => prev.filter((x) => x.id !== p.id))
    if (selected?.id === p.id) {
      setSelected(null)
      setActiveTab('liste')
    }
    if (res?.warning) toast.warning(res.warning)
    else toast.success('Hasta ve bağlı kayıtları kalıcı olarak silindi')
    router.refresh()
  }

  return (
    <div className="flex min-h-full flex-col bg-[#F0F4F9]">
      {/* Header */}
      <div className="px-6 pt-7 pb-0 lg:px-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#DDF8F4] text-[#1EAEA0] shadow-[0_10px_22px_rgba(45,212,191,0.14)]">
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-normal text-[#0F2B3D]">Hasta Yönetimi</h1>
            <p className="mt-0.5 text-sm font-medium text-slate-400">Hasta kayıtları ve detaylı yönetim</p>
          </div>
        </div>

        {/* Breadcrumb — hasta seçili olsun ya da olmasın görünür */}
        {activeTab !== 'liste' && (
          <div className="flex items-center gap-1.5 text-xs mb-3">
            <button
              onClick={() => { setSelected(null); setActiveTab('liste') }}
              className="text-gray-400 hover:text-[#2DD4BF] transition-colors font-medium"
            >
              Hastalar
            </button>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="text-[#0F2B3D] font-semibold">
              {selected ? `${selected.name} ${selected.surname}` : 'Hasta seçilmedi'}
            </span>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex items-center gap-7 overflow-x-auto border-b border-[#E7ECF2]">
          {TABS.map((tab) => {
            const disabled = tab.id !== 'liste' && patients.length === 0 && !(tab.id === 'hasta-karti' && showCreateCard)
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                disabled={disabled}
                className={`relative -mb-px whitespace-nowrap px-0 py-3 text-sm font-bold transition-colors ${
                  activeTab === tab.id
                    ? 'text-[#142536] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#2DD4BF]'
                    : 'text-slate-400 hover:text-slate-600'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-5">
        {activeTab !== 'liste' && (
          <div className="mb-5">
            <PatientSwitcher
              patients={patients}
              currentPatientId={selected?.id ?? null}
              onSelect={(p) => loadPatientData(p, true)}
            />
          </div>
        )}

        {activeTab === 'liste' && (
          <ListeTab
            patients={filtered}
            search={search}
            onSearch={setSearch}
            statusFilter={statusFilter}
            onStatusFilter={setStatusFilter}
            treatmentStatusFilter={treatmentStatusFilter}
            onTreatmentStatusFilter={setTreatmentStatusFilter}
            treatmentTypeFilter={treatmentTypeFilter}
            onTreatmentTypeFilter={setTreatmentTypeFilter}
            treatmentTypeOptions={treatmentTypeOptions}
            selected={selected}
            onSelect={handleSelectRow}
            onOpen={handleOpenPatient}
            onEdit={(p) => setEditPatient(p)}
            onDelete={handleDeletePatient}
            deleting={deletingPatient}
            onNewPatient={handleCreateFromList}
            filterLabel={filterLabel}
          />
        )}

        {activeTab === 'hasta-karti' && showCreateCard && (
          <PatientCreateCard
            onCancel={() => {
              setShowCreateCard(false)
              setActiveTab('liste')
            }}
            onSuccess={(patient) => {
              setShowCreateCard(false)
              setSelected(patient)
              setLastPatientId(patient.id)
              setPatients((prev) => [patient, ...prev.filter((item) => item.id !== patient.id)])
              setActiveTab('hasta-karti')
              loadFinancials(patient.id)
              loadAnamnesis(patient.id)
              router.refresh()
            }}
          />
        )}

        {activeTab === 'hasta-karti' && selected && (
          <HastaKartiTab
            patient={selected}
            treatments={treatments}
            transactions={transactions}
            loadingFinance={loadingFinance}
            loadFinanceError={loadFinanceError}
            onRetryFinance={() => loadFinancials(selected.id)}
            anamnesis={anamnesis}
            loadingAnamnesis={loadingAnamnesis}
            onAnamnesisSaved={setAnamnesis}
            onPay={() => setShowPaymentModal(true)}
            onEdit={() => setEditPatient(selected)}
            onGoToTab={handleTabChange}
            onGoToAppointments={() => router.push(`/appointments?patient_id=${selected.id}`)}
          />
        )}

        {activeTab === 'oral' && selected && (
          <OralTab
            patient={selected}
            treatments={treatments}
            transactions={transactions}
            clinic={clinic}
            loading={loadingFinance}
            doctors={doctors}
            tariffs={tariffs}
            tariffProfiles={tariffProfiles}
            onChanged={() => loadFinancials(selected.id)}
          />
        )}

        {activeTab === 'hesap' && selected && (
          <HesapTab
            patient={selected}
            transactions={transactions}
            treatments={treatments}
            clinic={clinic}
            installments={installments}
            reminders={reminders}
            loading={loadingFinance}
            onAddPayment={() => setShowPaymentModal(true)}
            onChanged={() => loadFinancials(selected.id)}
          />
        )}

        {activeTab === 'fatura' && selected && (
          <FaturaTab
            key={selected.id}
            patient={selected}
            treatments={treatments}
            transactions={transactions}
            clinic={clinic}
            loading={loadingFinance}
            onChanged={() => loadFinancials(selected.id)}
          />
        )}

        {activeTab === 'recete' && selected && (
          <ReceteTab
            patient={selected}
            prescriptions={prescriptions}
            doctors={doctors}
            clinic={clinic}
            loading={loadingFinance}
            onChanged={() => loadFinancials(selected.id)}
          />
        )}

        {activeTab === 'takip' && selected && (
          <TakipTab
            patient={selected}
          />
        )}

        {activeTab === 'not-goruntu' && selected && (
          <NotGoruntuTab
            patient={selected}
            notes={notes}
            images={images}
            doctors={doctors}
            loading={loadingFinance}
            supabase={supabase}
            clinicId={clinicId}
            onChanged={() => loadFinancials(selected.id)}
          />
        )}
      </div>

      {showNewModal && (
        <NewPatientModal
          onClose={() => setShowNewModal(false)}
          onSuccess={() => {
            setShowNewModal(false)
            router.refresh()
          }}
        />
      )}

      {editPatient && (
        <EditPatientModal
          patient={editPatient}
          onClose={() => setEditPatient(null)}
          onSuccess={(updated) => {
            setEditPatient(null)
            // Optimistik güncelle + seçili hastayı tazele
            setPatients((prev) =>
              prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
            )
            setSelected((cur) => (cur && cur.id === updated.id ? { ...cur, ...updated } : cur))
            toast.success('Hasta bilgileri güncellendi')
            router.refresh()
          }}
        />
      )}

      {showPaymentModal && selected && (
        <AddPaymentModal
          patientId={selected.id}
          patientName={`${selected.name} ${selected.surname}`}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false)
            loadFinancials(selected.id)
          }}
        />
      )}

      {importantReminder && (
        <ImportantNotesReminder
          patient={importantReminder.patient}
          notes={importantReminder.notes}
          pending={importantPending}
          onClose={() => setImportantReminder(null)}
          onOpenNotes={() => {
            setImportantReminder(null)
            setActiveTab('not-goruntu')
          }}
          onDismiss={handleDismissImportantReminder}
        />
      )}
    </div>
  )
}

function ImportantNotesReminder({
  patient,
  notes,
  pending,
  onClose,
  onOpenNotes,
  onDismiss,
}: {
  patient: Patient
  notes: ClinicalNote[]
  pending: boolean
  onClose: () => void
  onOpenNotes: () => void
  onDismiss: () => void
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F2B3D]/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="important-notes-title">
      <div className="w-full max-w-xl overflow-hidden rounded-[24px] border border-red-200 bg-white shadow-[0_28px_70px_rgba(15,43,61,0.25)]">
        <div className="flex items-start gap-4 border-b border-red-100 bg-red-50 px-6 py-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-xl font-black text-white shadow-[0_10px_22px_rgba(220,38,38,0.22)]">!</span>
          <div className="min-w-0 flex-1">
            <h2 id="important-notes-title" className="text-lg font-black text-red-800">Önemli Not Hatırlatması</h2>
            <p className="mt-1 text-sm font-semibold text-red-700/75">{patient.name} {patient.surname} için dikkat gerektiren notlar var.</p>
          </div>
          <button type="button" onClick={onClose} disabled={pending} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-red-400 transition hover:bg-red-100 hover:text-red-700 disabled:opacity-40" title="Kapat" aria-label="Hatırlatmayı kapat">
            <IconClose />
          </button>
        </div>

        <div className="max-h-[360px] space-y-3 overflow-y-auto px-6 py-5">
          {notes.map((note) => (
            <article key={note.id} className="rounded-[16px] border border-red-100 bg-[#FFF9F9] px-4 py-3.5">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-black text-red-600">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white">!</span>
                ÖNEMLİ
                <span className="font-semibold text-slate-400">{new Date(note.created_at).toLocaleDateString('tr-TR')}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-[#142536]">{note.content}</p>
            </article>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[#EEF2F6] bg-[#FAFBFC] px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onDismiss} disabled={pending} className="h-10 rounded-xl border border-red-200 bg-white px-4 text-xs font-black text-red-700 transition hover:bg-red-50 disabled:opacity-40">
            {pending ? 'Kaydediliyor...' : 'Bir Daha Gösterme'}
          </button>
          <button type="button" onClick={onOpenNotes} disabled={pending} className="h-10 rounded-xl bg-[#142536] px-4 text-xs font-black text-white transition hover:bg-[#0F2B3D] disabled:opacity-40">
            Not & Görüntüye Git
          </button>
        </div>
      </div>
    </div>
  )
}

function IconClose() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
}

function PatientCreateCard({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void
  onSuccess: (patient: Patient) => void
}) {
  const { formRef, onSubmit: keepSubmit, restore: restoreForm } = useKeepFormValues()
  const [state, action, pending] = useActionState(createPatient, null as ActionResult)
  useEffect(() => {
    if ((state as ActionResult)?.error) restoreForm()
  }, [state, restoreForm])

  useEffect(() => {
    if ((state as ActionResult)?.success && (state as ActionResult)?.patient) {
      onSuccess((state as ActionResult)!.patient!)
    }
  }, [state, onSuccess])

  return (
    <section className="mx-auto max-w-5xl rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="mb-6 flex flex-col gap-3 border-b border-[#EEF2F6] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-[#0F2B3D]">Yeni Hasta Kartı</h2>
          <p className="mt-1 text-sm font-semibold text-slate-400">
            Hasta bilgilerini girip kartı oluşturun. Protokol numarası P00001 formatında otomatik verilir.
          </p>
        </div>
        <span className="rounded-full bg-[#E6FFFA] px-3 py-1.5 text-xs font-black text-[#0F766E]">
          P00001 formatı
        </span>
      </div>

      <form ref={formRef} onSubmit={keepSubmit} action={action} className="space-y-5">
        {(state as ActionResult)?.error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
            {(state as ActionResult)!.error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <CardField label="Ad *" name="name" required placeholder="Hasta adı" />
          <CardField label="Soyad *" name="surname" required placeholder="Hasta soyadı" />
          <label className="block">
            <span className="mb-2 block text-xs font-black text-slate-500">Cinsiyet</span>
            <select name="gender" className="h-12 w-full rounded-[14px] border border-[#E7ECF2] bg-white px-3 text-sm font-semibold text-[#142536] outline-none transition focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]">
              <option value="">Seçiniz</option>
              <option value="male">Erkek</option>
              <option value="female">Kadın</option>
              <option value="other">Diğer</option>
            </select>
          </label>
          <CardField label="Doğum Tarihi" name="birth_date" type="date" />
          <CardField label="T.C. Kimlik No" name="tc" placeholder="12345678901" maxLength={11} />
          <CardField label="Telefon 1" name="phone1" type="tel" placeholder="0532 123 45 67" />
          <CardField label="Telefon 2" name="phone2" type="tel" placeholder="0212 123 45 67" />
          <CardField label="E-posta" name="email" type="email" placeholder="ornek@email.com" />
          <label className="block md:col-span-2">
            <span className="mb-2 block text-xs font-black text-slate-500">Adres</span>
            <textarea
              name="address"
              rows={3}
              placeholder="Adres..."
              className="w-full resize-none rounded-[14px] border border-[#E7ECF2] bg-white px-3 py-3 text-sm font-semibold text-[#142536] outline-none transition focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#EEF2F6] pt-5 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 rounded-[14px] border border-[#E7ECF2] bg-white px-5 text-sm font-black text-slate-500 transition hover:bg-slate-50"
          >
            Listeye Dön
          </button>
          <button
            type="submit"
            disabled={pending}
            className="h-12 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-5 text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:brightness-105 disabled:opacity-50"
          >
            {pending ? 'Kaydediliyor...' : 'Hasta Kartını Kaydet'}
          </button>
        </div>
      </form>
    </section>
  )
}

function CardField({
  label,
  name,
  type = 'text',
  required,
  placeholder,
  maxLength,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
  maxLength?: number
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black text-slate-500">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        className="h-12 w-full rounded-[14px] border border-[#E7ECF2] bg-white px-3 text-sm font-semibold text-[#142536] outline-none transition placeholder:text-slate-400 focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
      />
    </label>
  )
}
