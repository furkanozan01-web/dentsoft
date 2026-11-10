'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { parseToKurus } from '@/lib/format'
import { usePersistedPreference } from '@/lib/hooks/usePersistedPreference'
import { addTreatment, cancelTreatment, updateTreatmentFee } from './actions'
import {
  getAllPlansForPatient,
  addPlanItem,
  removePlanItem,
  copyPlanItems,
  reorderPlanItem,
} from './treatment-plan-actions'
import { FDI } from './constants'
import ToothChart, { classifyTreatment, classifyDiagnosis } from './ToothChart'
import { treatmentFlags, checkTreatmentCompatibility, type ToothFlags } from './toothFlags'
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
import { ActivePlanTab, BRANCH_ORDER, tariffBranch, isUpperTooth, parseTab, DIAGNOSIS_ITEMS, PLANLAMA_COLORS, FAZ_COLORS, getMarkerColor } from './oralShared'
import { PlanItemsCard, PlanTabBtn } from './OralPlanParts'
import { TreatmentHistoryCard } from './OralTreatmentHistoryCard'

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
      const incoming = treatmentFlags(selectedTariffItem.visual_schema, selectedTariffItem.treatment_name)
      const compat = checkTreatmentCompatibility(toothStates.get(toothNum) ?? {}, incoming)
      if (!compat.ok) {
        toast.error(compat.error)
        return
      }
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
export default OralTab
