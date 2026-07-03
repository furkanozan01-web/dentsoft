'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { parseToKurus, formatAmount } from '@/lib/format'
import { usePersistedPreference } from '@/lib/hooks/usePersistedPreference'
import {
  addTreatment,
  applyTreatmentAdjustment,
  cancelTreatment,
  closeTreatmentAccount,
  updateTreatmentFee,
} from './actions'
import {
  getAllPlansForPatient,
  addPlanItem,
  removePlanItem,
  copyPlanItems,
  reorderPlanItem,
} from './treatment-plan-actions'
import { FDI } from './constants'
import ToothChart, { classifyTreatment, classifyDiagnosis, type ToothFlags } from './ToothChart'
import TreatmentStatementPrint, { printTreatmentStatement } from './TreatmentStatementPrint'
import type {
  ClinicInfo,
  DoctorOption,
  Patient,
  TariffOption,
  TariffProfile,
  Transaction,
  Treatment,
  TreatmentPlan,
  TreatmentPlanItem,
} from './types'

// ─── Tab türleri ──────────────────────────────────────────────────────────────
type ActivePlanTab = 'diyagnoz' | `planlama_${number}` | `faz_${number}` | 'tedavi'

const BRANCH_ORDER = [
  'Cerrahi',
  'Endodonti',
  'Restoratif',
  'Periodontoloji',
  'Protez',
  'Ortodonti',
  'Pedodonti',
  'Muayene',
  'Diğer',
]

function tariffBranch(category: string | null) {
  const value = (category ?? '').toLocaleLowerCase('tr-TR')
  if (value.includes('cerrahi')) return 'Cerrahi'
  if (value.includes('endodont')) return 'Endodonti'
  if (value.includes('konservatif') || value.includes('restoratif')) return 'Restoratif'
  if (value.includes('periodont')) return 'Periodontoloji'
  if (value.includes('protez')) return 'Protez'
  if (value.includes('ortodont')) return 'Ortodonti'
  if (value.includes('pedodont')) return 'Pedodonti'
  if (value.includes('muayene') || value.includes('teşhis')) return 'Muayene'
  return 'Diğer'
}

function treatmentFlags(schema: string | null | undefined, name: string): ToothFlags {
  const flags: ToothFlags = {}
  const schemas = (schema || '').split('+').filter(Boolean)
  if (!schemas.length) {
    const inferred = classifyTreatment(name)
    if (inferred) flags[inferred] = true
    return flags
  }
  for (const item of schemas) {
    if (item === 'implant') flags.implant = true
    else if (['crown', 'porcelain', 'emax', 'prosthesis'].includes(item)) { flags.crown = true; flags.crownMaterial = 'porcelain' }
    else if (item === 'zirconium') { flags.crown = true; flags.crownMaterial = 'zirconium' }
    else if (item === 'filling') flags.filling = true
    else if (item === 'root-canal') flags.canal = true
    else if (item === 'extraction') flags.extracted = true
    else if (item === 'bone-graft') flags.graft = true
    else if (['removable', 'total-prosthesis'].includes(item)) flags.removableProsthesis = true
  }
  return flags
}

function isUpperTooth(n: number) { return (n >= 11 && n <= 28) || (n >= 51 && n <= 65) }

function parseTab(tab: ActivePlanTab): {
  kind: 'diyagnoz' | 'planlama' | 'faz' | 'tedavi'
  num: number
} {
  if (tab === 'diyagnoz') return { kind: 'diyagnoz', num: 1 }
  if (tab === 'tedavi') return { kind: 'tedavi', num: 0 }
  const under = tab.lastIndexOf('_')
  const kind = tab.slice(0, under) as 'planlama' | 'faz'
  const num = Number(tab.slice(under + 1))
  return { kind, num }
}

// ─── Diyagnoz öğeleri ────────────────────────────────────────────────────────
const DIAGNOSIS_ITEMS = [
  { key: 'extracted',   name: 'Çekilmiş Diş',      color: '#DC2626' },
  { key: 'mineCaryo',   name: 'Mine Çürüğü',        color: '#7C2D12' },
  { key: 'dentinCaryo', name: 'Dentin Çürüğü',      color: '#78350F' },
  { key: 'kret',        name: 'Kret',               color: '#2563EB' },
  { key: 'nerve',       name: 'Mandibular Sinir',   color: '#D97706' },
  { key: 'periapical',  name: 'Periapikal Lezyon',  color: '#7C3AED' },
  { key: 'poorCanal',   name: 'Yetersiz Kanal',     color: '#EA580C' },
] as const

// ─── Renk şeması ─────────────────────────────────────────────────────────────
const PLANLAMA_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#10B981']
const FAZ_COLORS = ['#F59E0B', '#F97316', '#EF4444', '#84CC16', '#6366F1']

function getMarkerColor(
  kind: 'diyagnoz' | 'planlama' | 'faz' | 'tedavi',
  num: number
): string | undefined {
  if (kind === 'diyagnoz') return '#374151'
  if (kind === 'planlama') return PLANLAMA_COLORS[(num - 1) % PLANLAMA_COLORS.length]
  if (kind === 'faz') return FAZ_COLORS[(num - 1) % FAZ_COLORS.length]
  return undefined
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────
function OralTab({
  patient,
  treatments,
  transactions,
  clinic,
  loading,
  doctors,
  tariffs,
  tariffProfiles,
  onChanged,
}: {
  patient: Patient
  treatments: Treatment[]
  transactions: Transaction[]
  clinic: ClinicInfo | null
  loading: boolean
  doctors: DoctorOption[]
  tariffs: TariffOption[]
  tariffProfiles: TariffProfile[]
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  // ── Paylaşılan sağ panel state'i ──
  const defaultProfileId = useMemo(
    () => tariffProfiles.find((p) => p.is_default)?.id ?? tariffProfiles[0]?.id ?? null,
    [tariffProfiles]
  )
  const [persistedDoctorId, setPersistedDoctorId] = usePersistedPreference<number | null>('dentsoft:last-doctor-id', doctors[0]?.id ?? null)
  const doctorId = persistedDoctorId !== null && doctors.some((d) => d.id === persistedDoctorId) ? persistedDoctorId : doctors[0]?.id ?? null
  const setDoctorId = setPersistedDoctorId
  const [persistedProfileId, setPersistedProfileId] = usePersistedPreference<number | null>('dentsoft:last-tariff-profile-id', defaultProfileId)
  const selectedProfileId = persistedProfileId !== null && tariffProfiles.some((p) => p.id === persistedProfileId) ? persistedProfileId : defaultProfileId
  const setSelectedProfileId = setPersistedProfileId
  const [treatmentDate, setTreatmentDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [selectedTariffItem, setSelectedTariffItem] = useState<TariffOption | null>(null)
  const [selectedDiagItem, setSelectedDiagItem] = useState<typeof DIAGNOSIS_ITEMS[number] | null>(null)
  const [selectedTreatmentIds, setSelectedTreatmentIds] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<string>('all')
  const categoryBarRef = useRef<HTMLDivElement>(null)
  const [showMilk, setShowMilk] = useState(false)
  const [editingFee, setEditingFee] = useState<{ id: number; val: string } | null>(null)

  // ── Plan state'i ──
  const [activePlanTab, setActivePlanTab] = useState<ActivePlanTab>('tedavi')
  const [plans, setPlans] = useState<TreatmentPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)

  // ── Kopyalama state'i ──
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set())
  const [copyModal, setCopyModal] = useState<{
    targetPlanType: TreatmentPlan['plan_type']
    targetPlanNumber: number
    includeFee: boolean
    includeDiscount: boolean
  } | null>(null)
  const [copyPending, startCopyTransition] = useTransition()

  const loadPlans = useCallback(async () => {
    setLoadingPlans(true)
    const res = await getAllPlansForPatient(patient.id)
    if (res.data) setPlans(res.data)
    setLoadingPlans(false)
  }, [patient.id])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadPlans(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadPlans])

  // ── Görünür sekme numaraları ──
  const planningTabNums = useMemo(() => {
    const nums: number[] = [1]
    for (let n = 2; n <= 10; n++) {
      const prev = plans.find((p) => p.plan_type === 'planlama' && p.plan_number === n - 1)
      if (prev && prev.items.length > 0) nums.push(n)
      else break
    }
    return nums
  }, [plans])

  const fazTabNums = useMemo(() => {
    const nums: number[] = [1]
    for (let n = 2; n <= 10; n++) {
      const prev = plans.find((p) => p.plan_type === 'faz' && p.plan_number === n - 1)
      if (prev && prev.items.length > 0) nums.push(n)
      else break
    }
    return nums
  }, [plans])

  // ── Aktif plan ──
  const parsedTab = useMemo(() => parseTab(activePlanTab), [activePlanTab])

  const currentPlan = useMemo(
    () =>
      plans.find(
        (p) =>
          p.plan_type === parsedTab.kind &&
          (parsedTab.kind === 'diyagnoz' ? true : p.plan_number === parsedTab.num)
      ) ?? null,
    [plans, parsedTab]
  )

  // ── Şemada işaretlenecek dişler ──
  const markedTeeth = useMemo(() => {
    const set = new Set<number>()
    if (parsedTab.kind === 'tedavi') return set
    if (!currentPlan) return set
    for (const item of currentPlan.items) {
      if (item.tooth_no) set.add(item.tooth_no)
    }
    return set
  }, [currentPlan, parsedTab])

  const markerColor = getMarkerColor(parsedTab.kind, parsedTab.num)

  // ── Çekilen dişler (2E) ──
  // ── Mevcut tedaviler için diş sembolleri ──
  const toothStates = useMemo(() => {
    const m = new Map<number, ToothFlags>()
    for (const t of treatments) {
      if (!t.tooth) continue
      const next = treatmentFlags(t.tariff?.visual_schema, t.treatment_name)
      if (next.removableProsthesis) {
        const jaw = isUpperTooth(t.tooth) ? FDI.upperPermanent.slice(1, -1) : FDI.lowerPermanent.slice(1, -1)
        for (const tooth of jaw) m.set(tooth, { ...(m.get(tooth) ?? {}), removableProsthesis: true })
      } else m.set(t.tooth, { ...(m.get(t.tooth) ?? {}), ...next })
    }
    return m
  }, [treatments])

  // ── Diyagnoz plan kalemleri diş sembolleri (tüm sekmeler için hesaplanır) ──
  const diagToothStates = useMemo(() => {
    const diagPlan = plans.find((p) => p.plan_type === 'diyagnoz')
    if (!diagPlan) return new Map<number, ToothFlags>()
    const m = new Map<number, ToothFlags>()
    for (const item of diagPlan.items) {
      if (!item.tooth_no) continue
      const key = classifyDiagnosis(item.treatment_name)
      if (!key) continue
      const cur = m.get(item.tooth_no) ?? {}
      ;(cur as Record<string, boolean>)[key] = true
      m.set(item.tooth_no, cur as ToothFlags)
    }
    return m
  }, [plans])

  // ── Çekilen / eksik dişler (tedavi + diyagnoz) ──
  const extractedTeeth = useMemo(() => {
    const set = new Set<number>()
    for (const t of treatments) {
      if (!t.tooth) continue
      const n = t.treatment_name.toLowerCase()
      if (n.includes('çekim') || n.includes('cekim') || t.tariff?.visual_schema?.split('+').includes('extraction')) set.add(t.tooth)
    }
    // Diyagnoz: çekilmiş diş
    diagToothStates.forEach((flags, tooth) => {
      if (flags.extracted) set.add(tooth)
    })
    // Diyagnoz: kret → tüm çene dişleri gizle
    let hasUpperKret = false
    let hasLowerKret = false
    diagToothStates.forEach((flags, tooth) => {
      if (!flags.kret) return
      if (isUpperTooth(tooth)) hasUpperKret = true
      else hasLowerKret = true
    })
    if (hasUpperKret) {
      ;[...FDI.upperPermanent, ...FDI.upperPrimary].forEach((t) => set.add(t))
    }
    if (hasLowerKret) {
      ;[...FDI.lowerPermanent, ...FDI.lowerPrimary].forEach((t) => set.add(t))
    }
    return set
  }, [treatments, diagToothStates])

  // ── Planlama/Faz plan kalemleri diş sembolleri ──
  const planToothStates = useMemo(() => {
    if ((parsedTab.kind !== 'planlama' && parsedTab.kind !== 'faz') || !currentPlan) {
      return new Map<number, ToothFlags>()
    }
    const m = new Map<number, ToothFlags>()
    for (const item of currentPlan.items) {
      if (!item.tooth_no) continue
      const kind = classifyTreatment(item.treatment_name)
      if (!kind) continue
      const cur = m.get(item.tooth_no) ?? {}
      ;(cur as Record<string, boolean>)[kind] = true
      m.set(item.tooth_no, cur as ToothFlags)
    }
    return m
  }, [currentPlan, parsedTab])

  // ── Şemada gösterilecek nihai semboller (diyagnoz sembolleri her sekmede görünür) ──
  const displayStates = useMemo(() => {
    let base: Map<number, ToothFlags>
    if (parsedTab.kind === 'diyagnoz') {
      base = diagToothStates
    } else if (parsedTab.kind === 'planlama' || parsedTab.kind === 'faz') {
      const merged = new Map(toothStates)
      planToothStates.forEach((flags, tooth) => {
        const cur = merged.get(tooth) ?? {}
        merged.set(tooth, { ...cur, ...flags })
      })
      base = merged
    } else {
      base = toothStates
    }
    // Diyagnoz sembollerini diğer sekmelere de bindirme
    if (parsedTab.kind !== 'diyagnoz' && diagToothStates.size > 0) {
      const final = new Map(base)
      diagToothStates.forEach((flags, tooth) => {
        const cur = final.get(tooth) ?? {}
        final.set(tooth, { ...cur, ...flags })
      })
      return final
    }
    return base
  }, [parsedTab, diagToothStates, planToothStates, toothStates])

  // ── Tarife filtresi ──
  const profileTariffs = useMemo(
    () =>
      tariffs.filter(
        (t) =>
          (selectedProfileId === null || t.profile_id === selectedProfileId || t.profile_id === null) &&
          t.is_active !== false
      ),
    [tariffs, selectedProfileId]
  )
  const categories = useMemo(
    () =>
      Array.from(new Set(profileTariffs.map((t) => tariffBranch(t.category)))).sort(
        (a, b) => BRANCH_ORDER.indexOf(a) - BRANCH_ORDER.indexOf(b)
      ),
    [profileTariffs]
  )
  const filteredTariffs = profileTariffs.filter((t) => {
    const matchCat = activeCat === 'all' || tariffBranch(t.category) === activeCat
    const matchSearch = !search || t.treatment_name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  // ── Diş tıklama ──
  const handleToothClick = (toothNum: number) => {
    if (parsedTab.kind === 'diyagnoz') {
      if (!selectedDiagItem) {
        toast.error('Önce sağ panelden bir tanı türü seçin')
        return
      }
      startTransition(async () => {
        const res = await addPlanItem(patient.id, 'diyagnoz', 1, {
          toothNo: toothNum,
          treatmentName: selectedDiagItem.name,
          tariffItemId: null,
          fee: 0,
        })
        if (res.error) toast.error(res.error)
        else { toast.success('Tanı eklendi'); void loadPlans() }
      })
      return
    }

    if (!selectedTariffItem) {
      toast.error('Önce sağ panelden bir işlem seçin')
      return
    }
    if (parsedTab.kind === 'tedavi') {
      startTransition(async () => {
        const res = await addTreatment({
          patientId: patient.id,
          tariffId: selectedTariffItem.id,
          tooth: toothNum,
          doctorId,
          treatmentDate,
        })
        if (res.error) toast.error(res.error)
        else { toast.success('Tedavi eklendi'); onChanged() }
      })
    } else {
      startTransition(async () => {
        const res = await addPlanItem(
          patient.id,
          parsedTab.kind as TreatmentPlan['plan_type'],
          parsedTab.num,
          {
            toothNo: toothNum,
            treatmentName: selectedTariffItem.treatment_name,
            tariffItemId: selectedTariffItem.id,
            fee: selectedTariffItem.price,
          }
        )
        if (res.error) toast.error(res.error)
        else { toast.success('Plana eklendi'); void loadPlans() }
      })
    }
  }

  // ── Toplu tedavi silme ──
  const handleBulkDeleteTreatments = async () => {
    const count = selectedTreatmentIds.size
    const ok = await confirm({
      title: 'Toplu Silme',
      message: `${count} tedavi iptal edilecek. Emin misiniz?`,
      confirmText: 'Evet, Sil',
    })
    if (!ok) return
    startTransition(async () => {
      const results = await Promise.all(
        [...selectedTreatmentIds].map(async (id) => ({ id, result: await cancelTreatment(id) }))
      )
      const failed = results.filter((item) => item.result.error)
      setSelectedTreatmentIds(new Set(failed.map((item) => item.id)))
      if (failed.length > 0) {
        toast.error(`${count - failed.length} tedavi silindi, ${failed.length} tedavi silinemedi`)
      } else {
        toast.success(`${count} tedavi silindi`)
      }
      onChanged()
    })
  }

  // ── Tedavi sil (Tedavi sekmesi) ──
  const handleCancelTreatment = async (t: Treatment) => {
    const ok = await confirm({
      title: 'Tedaviyi Sil',
      message: `"${t.treatment_name}" tedavisi planından çıkarılacak. Emin misiniz?`,
      confirmText: 'Evet, Sil',
    })
    if (!ok) return
    startTransition(async () => {
      const res = await cancelTreatment(t.id)
      if (res.error) toast.error(res.error)
      else { toast.success('Tedavi silindi'); onChanged() }
    })
  }

  const handleSaveFee = (t: Treatment) => {
    if (!editingFee) return
    const feeKurus = parseToKurus(editingFee.val)
    if (feeKurus < 0) return
    startTransition(async () => {
      const res = await updateTreatmentFee(t.id, feeKurus)
      if (res.error) toast.error(res.error)
      else { toast.success('Ücret güncellendi'); setEditingFee(null); onChanged() }
    })
  }

  // ── Plan kalemi sil ──
  const handleRemovePlanItem = async (itemId: number, name: string) => {
    const ok = await confirm({
      title: 'Kalemi Sil',
      message: `"${name}" plandan çıkarılacak. Emin misiniz?`,
      confirmText: 'Sil',
    })
    if (!ok) return
    startTransition(async () => {
      const res = await removePlanItem(itemId)
      if (res.error) toast.error(res.error)
      else { toast.success('Kalem silindi'); void loadPlans() }
    })
  }

  // ── Sıralama (Faz) ──
  const handleReorder = (item: TreatmentPlanItem, dir: 'up' | 'down', allItems: TreatmentPlanItem[]) => {
    const idx = allItems.findIndex((x) => x.id === item.id)
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === allItems.length - 1) return
    const swapWith = allItems[dir === 'up' ? idx - 1 : idx + 1]
    startTransition(async () => {
      await Promise.all([
        reorderPlanItem(item.id, swapWith.order_index),
        reorderPlanItem(swapWith.id, item.order_index),
      ])
      void loadPlans()
    })
  }

  // ── Kopyalama ──
  const handleCopyConfirm = () => {
    if (!copyModal) return
    startCopyTransition(async () => {
      const res = await copyPlanItems(
        Array.from(selectedItemIds),
        patient.id,
        copyModal.targetPlanType,
        copyModal.targetPlanNumber,
        { includeFee: copyModal.includeFee, includeDiscount: copyModal.includeDiscount }
      )
      if (res.error) toast.error(res.error)
      else {
        toast.success('Kalemler kopyalandı')
        setCopyModal(null)
        setSelectedItemIds(new Set())
        void loadPlans()
      }
    })
  }

  const handleProfileChange = (id: number | null) => {
    setSelectedProfileId(id)
    setActiveCat('all')
    setSelectedTariffItem(null)
  }

  const handleTabChange = (tab: ActivePlanTab) => {
    setActivePlanTab(tab)
    setSelectedItemIds(new Set())
    setSelectedTreatmentIds(new Set())
    setSelectedTariffItem(null)
    setSelectedDiagItem(null)
  }

  // ── Kopyalama hedef seçenekleri ──
  const copyTargets = useMemo(() => {
    const targets: { label: string; type: TreatmentPlan['plan_type']; num: number }[] = []
    planningTabNums.forEach((n) => {
      if (parsedTab.kind === 'planlama' && parsedTab.num === n) return
      targets.push({ label: `Planlama ${n}`, type: 'planlama', num: n })
    })
    // Sonraki boş planlama da hedef olabilir
    const maxPlanlama = Math.max(...planningTabNums)
    if (!(parsedTab.kind === 'planlama' && parsedTab.num === maxPlanlama + 1)) {
      targets.push({ label: `Planlama ${maxPlanlama + 1} (yeni)`, type: 'planlama', num: maxPlanlama + 1 })
    }
    fazTabNums.forEach((n) => {
      if (parsedTab.kind === 'faz' && parsedTab.num === n) return
      targets.push({ label: `Faz ${n}`, type: 'faz', num: n })
    })
    const maxFaz = Math.max(...fazTabNums)
    if (!(parsedTab.kind === 'faz' && parsedTab.num === maxFaz + 1)) {
      targets.push({ label: `Faz ${maxFaz + 1} (yeni)`, type: 'faz', num: maxFaz + 1 })
    }
    if (parsedTab.kind !== 'tedavi') {
      // Tedavi hedefi yok (treatments ayrı tablo, direkt ekleme değil)
    }
    return targets
  }, [planningTabNums, fazTabNums, parsedTab])

  return (
    <div className="space-y-4">
      {/* ─── Plan sekme çubuğu ─── */}
      <div className="flex gap-0.5 overflow-x-auto rounded-[18px] border border-slate-200/90 bg-white px-4 py-2 shadow-[0_4px_12px_rgba(15,23,42,0.04)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <PlanTabBtn active={activePlanTab === 'diyagnoz'} onClick={() => handleTabChange('diyagnoz')} color="#374151">
          Diyagnoz
        </PlanTabBtn>
        {planningTabNums.map((n) => (
          <PlanTabBtn
            key={`planlama_${n}`}
            active={activePlanTab === `planlama_${n}`}
            onClick={() => handleTabChange(`planlama_${n}`)}
            color={PLANLAMA_COLORS[(n - 1) % PLANLAMA_COLORS.length]}
          >
            Planlama {n}
          </PlanTabBtn>
        ))}
        {fazTabNums.map((n) => (
          <PlanTabBtn
            key={`faz_${n}`}
            active={activePlanTab === `faz_${n}`}
            onClick={() => handleTabChange(`faz_${n}`)}
            color={FAZ_COLORS[(n - 1) % FAZ_COLORS.length]}
          >
            Faz {n}
          </PlanTabBtn>
        ))}
        <PlanTabBtn active={activePlanTab === 'tedavi'} onClick={() => handleTabChange('tedavi')} color="#0F766E">
          Tedavi
        </PlanTabBtn>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ─── Sol panel ─── */}
        <div className="space-y-5">
          {/* Diş şeması kartı */}
          <div className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-black text-[#0F2B3D]">FDI Diş Şeması</h2>
                <p className="mt-0.5 text-xs font-medium text-slate-400">
                  {parsedTab.kind === 'tedavi'
                    ? 'Gerçek tedaviler'
                    : parsedTab.kind === 'diyagnoz'
                    ? 'Diyagnoz işaretlemeleri'
                    : parsedTab.kind === 'planlama'
                    ? `Planlama ${parsedTab.num} dişleri`
                    : `Faz ${parsedTab.num} dişleri`}
                </p>
              </div>
              <div className="flex rounded-xl border border-[#E7ECF2] bg-slate-50 p-1 text-xs">
                <button
                  onClick={() => setShowMilk(false)}
                  className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${!showMilk ? 'bg-[#142536] text-white shadow-sm' : 'text-slate-500 hover:bg-[#E9FBF8] hover:text-[#0F766E]'}`}
                >
                  Daimi
                </button>
                <button
                  onClick={() => setShowMilk(true)}
                  className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${showMilk ? 'bg-[#142536] text-white shadow-sm' : 'text-slate-500 hover:bg-[#E9FBF8] hover:text-[#0F766E]'}`}
                >
                  Süt
                </button>
              </div>
            </div>

            {parsedTab.kind === 'diyagnoz' ? (
              selectedDiagItem ? (
                <div className="mb-3 flex items-center gap-3 rounded-xl border px-4 py-2.5 text-xs font-semibold" style={{ borderColor: selectedDiagItem.color + '80', backgroundColor: selectedDiagItem.color + '14', color: selectedDiagItem.color }}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedDiagItem.color }} />
                  <span className="flex-1">Seçili tanı: <strong>{selectedDiagItem.name}</strong> — dişe tıklayarak ekleyin</span>
                  <button onClick={() => setSelectedDiagItem(null)} className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors hover:bg-black/10">İptal</button>
                </div>
              ) : (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#FED7AA] bg-[#FFF7E6] px-3 py-2.5 text-xs font-semibold text-[#B45309]">
                  <IconAlertTriangle />
                  Sağ panelden bir tanı türü seçin, ardından dişe tıklayın
                </div>
              )
            ) : selectedTariffItem ? (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-xs font-semibold text-[#065F46]">
                <span className="flex-1">
                  Seçili işlem: <strong>{selectedTariffItem.treatment_name}</strong>{' '}
                  — ₺{(selectedTariffItem.price / 100).toLocaleString('tr-TR')}
                  {' '}— dişe tıklayarak ekleyin
                </span>
                <button
                  onClick={() => setSelectedTariffItem(null)}
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold text-[#065F46] transition-colors hover:bg-[#D1FAE5]"
                >
                  İptal
                </button>
              </div>
            ) : (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#FED7AA] bg-[#FFF7E6] px-3 py-2.5 text-xs font-semibold text-[#B45309]">
                <IconAlertTriangle />
                Sağ panelden bir işlem seçin, ardından dişe tıklayın
              </div>
            )}

            {!showMilk ? (
              <ToothChart
                upperTeeth={FDI.upperPermanent}
                lowerTeeth={FDI.lowerPermanent}
                selected={null}
                states={displayStates}
                hiddenTeeth={extractedTeeth}
                markedTeeth={markedTeeth}
                markerColor={markerColor}
                onSelect={handleToothClick}
              />
            ) : (
              <ToothChart
                upperTeeth={FDI.upperPrimary}
                lowerTeeth={FDI.lowerPrimary}
                selected={null}
                states={displayStates}
                hiddenTeeth={extractedTeeth}
                markedTeeth={markedTeeth}
                markerColor={markerColor}
                onSelect={handleToothClick}
              />
            )}
          </div>

          {/* Plan kalemi listesi (Diyagnoz / Planlama / Faz) */}
          {parsedTab.kind !== 'tedavi' && (
            <PlanItemsCard
              parsedTab={parsedTab}
              currentPlan={currentPlan}
              loadingPlans={loadingPlans}
              pending={pending}
              selectedItemIds={selectedItemIds}
              onToggleItem={(id) =>
                 setSelectedItemIds((prev) => {
                   const next = new Set(prev)
                   if (next.has(id)) next.delete(id)
                   else next.add(id)
                   return next
                 })
              }
              onRemoveItem={handleRemovePlanItem}
              onReorder={handleReorder}
              copyTargets={copyTargets}
              onOpenCopyModal={(type, num) =>
                setCopyModal({ targetPlanType: type, targetPlanNumber: num, includeFee: true, includeDiscount: false })
              }
            />
          )}

          {/* Tedavi geçmişi tablosu (Tedavi sekmesi) */}
          {parsedTab.kind === 'tedavi' && (
            <TreatmentHistoryCard
              patientId={patient.id}
              treatments={treatments}
              loading={loading}
              pending={pending}
              editingFee={editingFee}
              selectedTreatmentIds={selectedTreatmentIds}
              onChanged={onChanged}
              onEditFee={setEditingFee}
              onSaveFee={handleSaveFee}
              onCancel={handleCancelTreatment}
              onToggleTreatment={(id) =>
                 setSelectedTreatmentIds((prev) => {
                   const next = new Set(prev)
                   if (next.has(id)) next.delete(id)
                   else next.add(id)
                   return next
                 })
              }
              onSelectAllTreatments={(ids) =>
                setSelectedTreatmentIds((prev) => {
                  const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
                  if (allSelected) return new Set([...prev].filter((id) => !ids.includes(id)))
                  return new Set([...prev, ...ids])
                })
              }
              onClearSelection={() => setSelectedTreatmentIds(new Set())}
              onBulkDelete={handleBulkDeleteTreatments}
              onPrint={() => {
                if (!printTreatmentStatement(patient.id)) toast.error('Yazdırma alanı hazırlanamadı')
              }}
            />
          )}
        </div>

        {/* ─── Sağ panel (paylaşılan) ─── */}
        <div className="space-y-4">
          {/* Hekim & Tarife & Tarih kartı — diyagnozda gizli */}
          {parsedTab.kind !== 'diyagnoz' && <div className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#DDF8F4] text-[#0F766E]">
                <IconUserRound />
              </span>
              <div>
                <h3 className="text-sm font-black text-[#0F2B3D]">Hekim & Tarife</h3>
                <p className="text-xs font-medium text-slate-400">Eklenecek işlemin detayları</p>
              </div>
            </div>
            <div className="space-y-3">
              {doctors.length > 0 && (
                <div>
                  <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-400">Hekim</span>
                  <select
                    value={doctorId ?? ''}
                    onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : null)}
                    className="h-10 w-full rounded-[12px] border border-[#E7ECF2] bg-white px-3 text-sm font-semibold text-[#0F2B3D] outline-none transition focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>Dt. {d.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {tariffProfiles.length > 0 && (
                <div>
                  <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-400">Tarife</span>
                  <select
                    value={selectedProfileId ?? ''}
                    onChange={(e) => handleProfileChange(e.target.value ? Number(e.target.value) : null)}
                    className="h-10 w-full rounded-[12px] border border-[#E7ECF2] bg-white px-3 text-sm font-semibold text-[#0F2B3D] outline-none transition focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
                  >
                    {tariffProfiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' (Varsayılan)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-400">İşlem Tarihi</span>
                <input
                  type="date"
                  value={treatmentDate}
                  onChange={(e) => setTreatmentDate(e.target.value)}
                  className="h-10 w-full rounded-[12px] border border-[#E7ECF2] bg-white px-3 text-sm font-semibold text-[#0F2B3D] outline-none transition focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
                />
              </div>
            </div>
          </div>}

          {/* İşlemler / Tanı kartı */}
          <div className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-[#0F2B3D]">
                  {parsedTab.kind === 'diyagnoz' ? 'Tanı Türleri' : 'İşlemler'}
                </h3>
                <p className="mt-0.5 text-xs font-medium text-slate-400">
                  {parsedTab.kind === 'diyagnoz' ? 'Tanıyı seçin, ardından dişe tıklayın' : 'İşlemi seçin, ardından dişe tıklayın'}
                </p>
              </div>
              {parsedTab.kind === 'planlama' && (
                <button
                  onClick={() => toast.info('AI ile Faz dağılımı yakında aktif olacak')}
                  className="shrink-0 rounded-xl border border-[#2DD4BF] px-3 py-1.5 text-[11px] font-black text-[#0F766E] transition-colors hover:bg-[#E6FFFA]"
                >
                  ✦ AI ile Fazlara Böl
                </button>
              )}
            </div>
            {parsedTab.kind === 'diyagnoz' ? (
              <div className="space-y-1.5">
                {DIAGNOSIS_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setSelectedDiagItem((prev) => prev?.key === item.key ? null : item)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors ${
                      selectedDiagItem?.key === item.key
                        ? 'border font-bold'
                        : 'font-semibold text-[#0F2B3D] hover:bg-[#E9FBF8]'
                    }`}
                    style={selectedDiagItem?.key === item.key ? { borderColor: item.color, backgroundColor: item.color + '18', color: item.color } : {}}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            ) : tariffs.length === 0 ? (
              <p className="text-xs font-medium text-gray-400">Tarife yok. Ayarlar → Tarife&apos;den ekleyin.</p>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => categoryBarRef.current?.scrollBy({ left: -220, behavior: 'smooth' })}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#E7ECF2] bg-white text-lg font-black text-slate-500 transition hover:border-[#2DD4BF] hover:text-[#0F766E]"
                    title="Önceki branşlar"
                    aria-label="Önceki branşlar"
                  >
                    ‹
                  </button>
                  <div ref={categoryBarRef} className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-2 [scrollbar-color:#94A3B8_#E2E8F0] [scrollbar-width:thin]">
                    <button
                      onClick={() => setActiveCat('all')}
                      className={`shrink-0 rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors ${activeCat === 'all' ? 'bg-[#0F766E] text-white' : 'bg-[#F1F5F9] text-slate-500 hover:bg-[#E9FBF8] hover:text-[#0F766E]'}`}
                    >
                      Tümü
                    </button>
                    {categories.map((branch) => (
                      <button
                        key={branch}
                        onClick={() => setActiveCat(branch)}
                        className={`shrink-0 rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors ${activeCat === branch ? 'bg-[#0F766E] text-white' : 'bg-[#F1F5F9] text-slate-500 hover:bg-[#E9FBF8] hover:text-[#0F766E]'}`}
                      >
                        {branch}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => categoryBarRef.current?.scrollBy({ left: 220, behavior: 'smooth' })}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#E7ECF2] bg-white text-lg font-black text-slate-500 transition hover:border-[#2DD4BF] hover:text-[#0F766E]"
                    title="Sonraki branşlar"
                    aria-label="Sonraki branşlar"
                  >
                    ›
                  </button>
                </div>
                <div className="relative mb-3">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><IconSearch /></span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="İşlem ara..."
                    className="h-11 w-full rounded-[14px] border border-[#E7ECF2] bg-white pl-11 pr-3 text-sm font-medium text-[#0F2B3D] outline-none transition placeholder:text-slate-400 focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
                  />
                </div>
                <div className="max-h-[400px] space-y-1.5 overflow-y-auto pr-1 [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin]">
                  {filteredTariffs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTariffItem((cur) => (cur?.id === t.id ? null : t))}
                      disabled={pending}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors disabled:opacity-55 ${selectedTariffItem?.id === t.id ? 'border border-[#2DD4BF] bg-[#E6FFFA]' : 'hover:bg-[#E9FBF8]'}`}
                    >
                      <span className="font-bold text-[#0F2B3D]">{t.treatment_name}</span>
                      <span className="shrink-0 text-xs font-black text-[#0F766E]">
                        ₺{(t.price / 100).toLocaleString('tr-TR')}
                      </span>
                    </button>
                  ))}
                  {filteredTariffs.length === 0 && (
                    <p className="py-3 text-center text-xs font-medium text-gray-400">Sonuç yok.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Kopyalama modalı ─── */}
      {copyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-[24px] bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-base font-black text-[#0F2B3D]">Kalemleri Kopyala</h3>
            <p className="mb-4 text-xs font-medium text-slate-500">
              {selectedItemIds.size} kalem → {copyModal.targetPlanType === 'planlama' ? 'Planlama' : 'Faz'} {copyModal.targetPlanNumber}
            </p>
            <label className="mb-3 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={copyModal.includeFee}
                onChange={(e) => setCopyModal((c) => c && { ...c, includeFee: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-[#2DD4BF] accent-[#2DD4BF]"
              />
              <span className="text-sm font-semibold text-[#0F2B3D]">Fiyatı da kopyala</span>
            </label>
            <label className="mb-5 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={copyModal.includeDiscount}
                onChange={(e) => setCopyModal((c) => c && { ...c, includeDiscount: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-[#2DD4BF] accent-[#2DD4BF]"
              />
              <span className="text-sm font-semibold text-[#0F2B3D]">İndirim oranını da kopyala</span>
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setCopyModal(null)}
                className="flex-1 h-11 rounded-[14px] border border-[#E7ECF2] text-sm font-black text-slate-500 transition hover:bg-slate-50"
              >
                İptal
              </button>
              <button
                onClick={handleCopyConfirm}
                disabled={copyPending}
                className="flex-1 h-11 rounded-[14px] bg-[#142536] text-sm font-black text-white transition hover:bg-[#0F2B3D] disabled:opacity-50"
              >
                {copyPending ? 'Kopyalanıyor...' : 'Kopyala'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TreatmentStatementPrint
        patient={patient}
        treatments={treatments}
        transactions={transactions}
        clinic={clinic}
      />
    </div>
  )
}

// ─── Plan kalemi listesi kartı ────────────────────────────────────────────────
function PlanItemsCard({
  parsedTab,
  currentPlan,
  loadingPlans,
  pending,
  selectedItemIds,
  onToggleItem,
  onRemoveItem,
  onReorder,
  copyTargets,
  onOpenCopyModal,
}: {
  parsedTab: { kind: 'diyagnoz' | 'planlama' | 'faz' | 'tedavi'; num: number }
  currentPlan: TreatmentPlan | null
  loadingPlans: boolean
  pending: boolean
  selectedItemIds: Set<number>
  onToggleItem: (id: number) => void
  onRemoveItem: (id: number, name: string) => void
  onReorder: (item: TreatmentPlanItem, dir: 'up' | 'down', all: TreatmentPlanItem[]) => void
  copyTargets: { label: string; type: TreatmentPlan['plan_type']; num: number }[]
  onOpenCopyModal: (type: TreatmentPlan['plan_type'], num: number) => void
}) {
  const items = currentPlan?.items ?? []
  const isFaz = parsedTab.kind === 'faz'
  const isDiyagnoz = parsedTab.kind === 'diyagnoz'
  const tabLabel =
    isDiyagnoz
      ? 'Diyagnoz'
      : parsedTab.kind === 'planlama'
      ? `Planlama ${parsedTab.num}`
      : `Faz ${parsedTab.num}`

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F6] px-5 py-4">
        <div>
          <h2 className="text-base font-black text-[#0F2B3D]">{tabLabel} Kalemleri</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400">{items.length} kalem</p>
        </div>
      </div>

      {loadingPlans ? (
        <p className="py-8 text-center text-sm font-medium text-gray-400">Yükleniyor…</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm font-medium text-gray-400">
          Henüz kalem yok. Sağdan bir işlem seçip dişe tıklayın.
        </p>
      ) : (
        <div>
          <ul className="divide-y divide-[#EEF2F6]">
            {items.map((item, idx) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#5FD3C1]/[0.03]">
                <input
                  type="checkbox"
                  checked={selectedItemIds.has(item.id)}
                  onChange={() => onToggleItem(item.id)}
                  className="h-4 w-4 rounded border-slate-300 accent-[#2DD4BF]"
                />
                {isFaz && (
                  <span className="w-5 shrink-0 text-center text-xs font-black text-slate-400">
                    {idx + 1}.
                  </span>
                )}
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-bold text-[#0F2B3D]">
                    {item.tooth_no ? (
                      <span className="mr-1.5 inline-block rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs font-black text-[#142536]">
                        {item.tooth_no}
                      </span>
                    ) : null}
                    {item.treatment_name}
                  </span>
                  {!isDiyagnoz && item.fee > 0 && (
                    <span className="text-xs font-bold text-[#0F766E]">
                      ₺{(item.fee / 100).toLocaleString('tr-TR')}
                      {item.discount_rate > 0 && (
                        <span className="ml-1.5 text-slate-400">(%{(item.discount_rate / 10).toFixed(1)} indirim)</span>
                      )}
                    </span>
                  )}
                </div>
                {isFaz && (
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => onReorder(item, 'up', items)}
                      disabled={pending || idx === 0}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-[#E9FBF8] hover:text-[#0F766E] disabled:opacity-30"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                    </button>
                    <button
                      onClick={() => onReorder(item, 'down', items)}
                      disabled={pending || idx === items.length - 1}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-[#E9FBF8] hover:text-[#0F766E] disabled:opacity-30"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                  </div>
                )}
                <button
                  onClick={() => onRemoveItem(item.id, item.treatment_name)}
                  disabled={pending}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600 disabled:opacity-40"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          {/* Kopyalama araç çubuğu */}
          {selectedItemIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#EEF2F6] bg-[#F8FAFC] px-5 py-3">
              <span className="text-xs font-black text-[#0F2B3D]">{selectedItemIds.size} kalem seçildi →</span>
              <span className="text-xs font-semibold text-slate-500">Kopyala:</span>
              <div className="flex flex-wrap gap-1.5">
                {copyTargets.map((t) => (
                  <button
                    key={`${t.type}_${t.num}`}
                    onClick={() => onOpenCopyModal(t.type, t.num)}
                    className="rounded-full bg-[#E6FFFA] px-2.5 py-1 text-[11px] font-bold text-[#0F766E] transition hover:bg-[#CCFBF1]"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tedavi geçmişi kartı ─────────────────────────────────────────────────────
function TreatmentHistoryCard({
  patientId,
  treatments,
  loading,
  pending,
  editingFee,
  selectedTreatmentIds,
  onChanged,
  onEditFee,
  onSaveFee,
  onCancel,
  onToggleTreatment,
  onSelectAllTreatments,
  onClearSelection,
  onBulkDelete,
  onPrint,
}: {
  patientId: number
  treatments: Treatment[]
  loading: boolean
  pending: boolean
  editingFee: { id: number; val: string } | null
  selectedTreatmentIds: Set<number>
  onChanged: () => void
  onEditFee: (v: { id: number; val: string } | null) => void
  onSaveFee: (t: Treatment) => void
  onCancel: (t: Treatment) => void
  onToggleTreatment: (id: number) => void
  onSelectAllTreatments: (ids: number[]) => void
  onClearSelection: () => void
  onBulkDelete: () => void
  onPrint: () => void
}) {
  const confirm = useConfirm()
  const [showClosed, setShowClosed] = useState(false)
  const [showAdjustment, setShowAdjustment] = useState(false)
  const [adjustmentType, setAdjustmentType] = useState<'percent' | 'fixed'>('percent')
  const [adjustmentDirection, setAdjustmentDirection] = useState<'discount' | 'increase'>('discount')
  const [adjustmentValue, setAdjustmentValue] = useState('10')
  const [actionPending, startActionTransition] = useTransition()

  const openTreatments = treatments.filter((treatment) => !treatment.is_closed)
  const closedTreatments = treatments.filter((treatment) => treatment.is_closed)
  const visibleTreatments = showClosed ? treatments : openTreatments
  const openTotal = openTreatments.reduce((sum, treatment) => sum + (treatment.fee ?? 0), 0)
  const visibleIds = visibleTreatments.map((treatment) => treatment.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedTreatmentIds.has(id))
  const someSelected = visibleIds.some((id) => selectedTreatmentIds.has(id)) && !allSelected

  const numericAdjustment = adjustmentType === 'percent'
    ? Number(adjustmentValue.replace(',', '.'))
    : parseToKurus(adjustmentValue)
  const previewTotal = adjustmentType === 'fixed'
    ? numericAdjustment
    : Number.isFinite(numericAdjustment)
    ? Math.round(openTotal * (adjustmentDirection === 'discount' ? 1 - numericAdjustment / 100 : 1 + numericAdjustment / 100))
    : 0
  const previewDifference = previewTotal - openTotal
  const adjustmentValid = Number.isFinite(numericAdjustment) && numericAdjustment > 0 && previewTotal > 0

  const toggleClosedTreatments = () => {
    if (showClosed) {
      closedTreatments.forEach((treatment) => {
        if (selectedTreatmentIds.has(treatment.id)) onToggleTreatment(treatment.id)
      })
    }
    setShowClosed((current) => !current)
  }

  const handleCloseAccount = async () => {
    const ok = await confirm({
      title: 'Hesabı Kapat',
      message: 'Bu hastanın tüm açık tedavileri kapalı olarak işaretlenecek. Devam edilsin mi?',
      confirmText: 'Hesabı Kapat',
    })
    if (!ok) return
    startActionTransition(async () => {
      const result = await closeTreatmentAccount(patientId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Hesap kapatıldı ✓')
      onClearSelection()
      setShowAdjustment(false)
      setShowClosed(false)
      onChanged()
    })
  }

  const handleApplyAdjustment = () => {
    if (!adjustmentValid) {
      toast.error('Geçerli bir yeni toplam veya yüzde girin')
      return
    }
    startActionTransition(async () => {
      const result = await applyTreatmentAdjustment(patientId, {
        type: adjustmentType,
        value: numericAdjustment,
        direction: adjustmentDirection,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Tedavi ücretleri güncellendi')
      setShowAdjustment(false)
      onChanged()
    })
  }

  const disabled = pending || actionPending
  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 border-b border-[#EEF2F6] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-black text-[#0F2B3D]">Tedavi Geçmişi</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400">Hastaya uygulanmış işlemler</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedTreatmentIds.size > 0 && (
            <button
              type="button"
              onClick={onBulkDelete}
              disabled={disabled}
              className="inline-flex h-9 items-center rounded-xl border border-red-200 bg-red-50 px-3 text-[11px] font-black text-red-700 transition hover:bg-red-100 disabled:opacity-40"
            >
              Seçilenleri Sil ({selectedTreatmentIds.size})
            </button>
          )}
          <button
            type="button"
            onClick={onPrint}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#D9E4EA] bg-white px-3 text-[11px] font-black text-[#315164] transition hover:bg-slate-50 disabled:opacity-40"
          >
            <IconPrint />
            Yazdır
          </button>
          {closedTreatments.length > 0 && (
            <button
              type="button"
              onClick={toggleClosedTreatments}
              className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-black transition ${showClosed ? 'border-[#BFEFE8] bg-[#E9FBF8] text-[#0F766E]' : 'border-[#E7ECF2] bg-white text-slate-500 hover:bg-slate-50'}`}
              title={showClosed ? 'Kapalı hesapları gizle' : 'Kapalı hesapları göster'}
            >
              <IconEye />
              {showClosed ? 'Kapalıları Gizle' : 'Kapalıları Göster'}
            </button>
          )}
          <button
            type="button"
            onClick={handleCloseAccount}
            disabled={disabled || openTreatments.length === 0}
            className="inline-flex h-9 items-center rounded-xl border border-red-200 bg-white px-3 text-[11px] font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Hesabı Kapat
          </button>
          <span className="rounded-full bg-[#E6FFFA] px-3 py-1.5 text-sm font-black text-[#0F766E]">
            Açık Toplam: ₺{formatAmount(openTotal)}
          </span>
        </div>
      </div>
      {loading ? (
        <p className="py-8 text-center text-sm font-medium text-gray-400">Yükleniyor…</p>
      ) : treatments.length === 0 ? (
        <p className="py-8 text-center text-sm font-medium text-gray-400">
          Henüz tedavi yok. Sağdan bir işlem seçip dişe tıklayın.
        </p>
      ) : visibleTreatments.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-semibold text-slate-400">Tüm tedavi kayıtları kapalı hesapta.</p>
          <button type="button" onClick={toggleClosedTreatments} className="mt-2 text-xs font-black text-[#0F766E] hover:underline">
            {closedTreatments.length} kapalı kaydı göster
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-[#FAFBFC]">
              <tr className="border-b border-[#EEF2F6]">
                <th className="h-12 w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected }}
                    onChange={() => onSelectAllTreatments(visibleIds)}
                    className="h-4 w-4 rounded border-slate-300 accent-[#2DD4BF]"
                  />
                </th>
                {['Tarih', 'Diş', 'Tedavi', 'Hekim', 'Ücret', ''].map((h) => (
                  <th key={h} className="h-12 px-4 py-3 text-left font-black uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleTreatments.map((t) => {
                const originalFee = t.original_fee ?? t.fee
                const adjusted = originalFee !== t.fee
                return (
                <tr key={t.id} className={`h-16 border-b border-[#EEF2F6] transition last:border-0 hover:bg-[#5FD3C1]/[0.04] ${selectedTreatmentIds.has(t.id) ? 'bg-[#F0FEFA]' : ''} ${t.is_closed ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedTreatmentIds.has(t.id)}
                      onChange={() => onToggleTreatment(t.id)}
                      className="h-4 w-4 rounded border-slate-300 accent-[#2DD4BF]"
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-500">
                    {t.treatment_date ? new Date(t.treatment_date).toLocaleDateString('tr-TR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-black text-[#142536]">{t.tooth ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 font-bold text-[#0F2B3D]">
                    <div className="flex items-center gap-2">
                      <span>{t.treatment_name}</span>
                      {t.is_closed && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-black text-slate-600">KPL</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-500">{t.doctor?.name ?? '—'}</td>
                  <td className="px-4 py-3 font-black text-[#0F2B3D]">
                    {editingFee?.id === t.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">₺</span>
                        <input
                          autoFocus
                          value={editingFee.val}
                          onChange={(e) => onEditFee({ id: t.id, val: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') onSaveFee(t); if (e.key === 'Escape') onEditFee(null) }}
                          onBlur={() => onSaveFee(t)}
                          className="w-24 rounded-lg border border-[#2DD4BF] px-2 py-1 text-xs outline-none"
                        />
                      </div>
                    ) : adjusted ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-400 line-through">₺{formatAmount(originalFee)}</span>
                        <span>₺{formatAmount(t.fee)}</span>
                      </span>
                    ) : (
                      <span>₺{formatAmount(t.fee)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditFee({ id: t.id, val: String(t.fee / 100) })}
                        disabled={disabled}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-[#E9FBF8] hover:text-[#0F766E] disabled:opacity-40"
                        title="Ücreti düzenle"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onCancel(t)}
                        disabled={disabled}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600 disabled:opacity-40"
                        title="Sil"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          {selectedTreatmentIds.size > 0 && (
            <div className="flex items-center gap-3 border-t border-[#EEF2F6] bg-[#F8FAFC] px-5 py-3">
              <span className="text-xs font-black text-[#0F2B3D]">{selectedTreatmentIds.size} tedavi seçildi</span>
              <button
                onClick={onBulkDelete}
                disabled={disabled}
                className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-40"
              >
                Seçilenleri Sil
              </button>
            </div>
          )}
        </div>
      )}

      {closedTreatments.length > 0 && !showClosed && visibleTreatments.length > 0 && (
        <button
          type="button"
          onClick={toggleClosedTreatments}
          className="flex w-full items-center justify-center border-t border-[#EEF2F6] bg-[#FAFBFC] px-5 py-2.5 text-[11px] font-bold text-slate-400 transition hover:bg-slate-50 hover:text-[#0F766E]"
        >
          {closedTreatments.length} kapalı kayıt gizleniyor, göstermek için tıklayın
        </button>
      )}

      <div className="flex flex-col gap-3 border-t border-[#EEF2F6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Açık Tedavi Toplamı</p>
          <p className="mt-0.5 text-lg font-black text-[#0F2B3D]">₺{formatAmount(openTotal)}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdjustment((current) => !current)}
          disabled={disabled || openTreatments.length === 0 || openTotal <= 0}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#5FD3C1] bg-white px-4 text-xs font-black text-[#0F766E] transition hover:bg-[#E9FBF8] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconRotate />
          Yuvarla / İndirim
        </button>
      </div>

      {showAdjustment && (
        <div className="border-t border-[#BFEFE8] bg-[#F4FFFD] px-5 py-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Mevcut Toplam</p>
                <p className="mt-1 text-xl font-black text-[#0F2B3D]">₺{formatAmount(openTotal)}</p>
              </div>

              <div>
                <span className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-400">Değişiklik Türü</span>
                <div className="inline-flex rounded-xl border border-[#D9E4EA] bg-white p-1">
                  <button
                    type="button"
                    onClick={() => { setAdjustmentType('percent'); setAdjustmentValue('10') }}
                    className={`rounded-lg px-3 py-2 text-xs font-black transition ${adjustmentType === 'percent' ? 'bg-[#142536] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    Yüzde
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAdjustmentType('fixed'); setAdjustmentValue(String(openTotal / 100)) }}
                    className={`rounded-lg px-3 py-2 text-xs font-black transition ${adjustmentType === 'fixed' ? 'bg-[#142536] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    Sabit Tutar
                  </button>
                </div>
              </div>

              {adjustmentType === 'percent' ? (
                <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-black text-slate-500">Oran (%)</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={adjustmentValue}
                      onChange={(event) => setAdjustmentValue(event.target.value)}
                      className="h-11 w-full rounded-xl border border-[#D9E4EA] bg-white px-3 text-sm font-black text-[#142536] outline-none focus:border-[#2DD4BF]"
                    />
                  </label>
                  <div>
                    <span className="mb-1.5 block text-[11px] font-black text-slate-500">Yön</span>
                    <div className="inline-flex h-11 rounded-xl border border-[#D9E4EA] bg-white p-1">
                      <button type="button" onClick={() => setAdjustmentDirection('discount')} className={`rounded-lg px-3 text-xs font-black ${adjustmentDirection === 'discount' ? 'bg-[#E9FBF8] text-[#0F766E]' : 'text-slate-500'}`}>İndirim</button>
                      <button type="button" onClick={() => setAdjustmentDirection('increase')} className={`rounded-lg px-3 text-xs font-black ${adjustmentDirection === 'increase' ? 'bg-[#FFF7E6] text-[#B45309]' : 'text-slate-500'}`}>Artırım</button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="block max-w-xs">
                  <span className="mb-1.5 block text-[11px] font-black text-slate-500">Yeni Toplam (₺)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={adjustmentValue}
                    onChange={(event) => setAdjustmentValue(event.target.value)}
                    className="h-11 w-full rounded-xl border border-[#D9E4EA] bg-white px-3 text-sm font-black text-[#142536] outline-none focus:border-[#2DD4BF]"
                  />
                </label>
              )}
            </div>

            <div className="rounded-[18px] border border-[#BFEFE8] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Önizleme</p>
              <div className="mt-3 flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-bold text-slate-400">₺{formatAmount(openTotal)}</span>
                <span className="text-slate-300">→</span>
                <span className={`text-xl font-black ${adjustmentValid ? 'text-[#0F766E]' : 'text-red-500'}`}>
                  ₺{formatAmount(Math.max(previewTotal, 0))}
                </span>
              </div>
              {adjustmentValid && previewDifference !== 0 && (
                <p className={`mt-1 text-xs font-black ${previewDifference < 0 ? 'text-green-600' : 'text-amber-600'}`}>
                  {previewDifference < 0 ? '-' : '+'}₺{formatAmount(Math.abs(previewDifference))}
                </p>
              )}
              <p className="mt-4 rounded-xl bg-[#FAFBFC] px-3 py-3 text-xs font-semibold leading-5 text-slate-500">
                Her açık tedavinin ücreti, ilk tarife fiyatı temel alınarak orantısal güncellenecek.
              </p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setShowAdjustment(false)} className="flex-1 rounded-xl border border-[#E7ECF2] bg-white px-3 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-50">İptal</button>
                <button type="button" onClick={handleApplyAdjustment} disabled={disabled || !adjustmentValid} className="flex-1 rounded-xl bg-[#0F766E] px-3 py-2.5 text-xs font-black text-white hover:bg-[#0B5F59] disabled:opacity-40">Uygula</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sekme butonu ─────────────────────────────────────────────────────────────
function PlanTabBtn({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean
  onClick: () => void
  color: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="relative whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-colors"
      style={
        active
          ? { color, backgroundColor: color + '18' }
          : { color: '#94A3B8' }
      }
    >
      {children}
      {active && (
        <span
          className="absolute inset-x-2 bottom-0.5 h-0.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
    </button>
  )
}

// ─── İkonlar ──────────────────────────────────────────────────────────────────
function IconUserRound() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
}
function IconAlertTriangle() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
}
function IconSearch() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
}
function IconEye() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.1 12a10 10 0 0 1 19.8 0 10 10 0 0 1-19.8 0Z" /><circle cx="12" cy="12" r="3" /></svg>
}
function IconRotate() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></svg>
}
function IconPrint() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
}

export default OralTab
