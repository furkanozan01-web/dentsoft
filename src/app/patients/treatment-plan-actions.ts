'use server'

import { createClient } from '@/lib/supabase/server'
import type { TreatmentPlan, TreatmentPlanItem } from './types'
import { addTreatment } from './treatmentActions'

async function getCtx() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id')
      .eq('id', user.id)
      .single()
    if (!profile?.clinic_id) return null
    return { supabase, clinicId: profile.clinic_id as number }
  } catch {
    return null
  }
}

// Tüm planları (kalemlerle birlikte) getir
export async function getAllPlansForPatient(
  patientId: number
): Promise<{ data: TreatmentPlan[]; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { data: [], error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const { data, error } = await supabase
    .from('treatment_plans')
    .select(
      `id, clinic_id, patient_id, plan_type, plan_number, status, notes, created_at,
       items:treatment_plan_items(id, plan_id, tooth_no, treatment_name, tariff_item_id, fee, discount_rate, order_index, notes, copied_from_id, doctor_id, created_at)`
    )
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .order('plan_type')
    .order('plan_number')

  if (error) return { data: [], error: error.message }

  const plans = (data ?? []).map((p) => ({
    ...p,
    plan_type: p.plan_type as TreatmentPlan['plan_type'],
    items: ((p.items as TreatmentPlanItem[] | null) ?? []).sort(
      (a, b) => a.order_index - b.order_index
    ),
  }))

  return { data: plans }
}

// Plan oluştur veya mevcut planı getir
async function getOrCreatePlanId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: number,
  patientId: number,
  planType: TreatmentPlan['plan_type'],
  planNumber: number
): Promise<number | null> {
  const { data: existing } = await supabase
    .from('treatment_plans')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .eq('plan_type', planType)
    .eq('plan_number', planNumber)
    .single()

  if (existing) return existing.id

  const { data: created } = await supabase
    .from('treatment_plans')
    .insert({ clinic_id: clinicId, patient_id: patientId, plan_type: planType, plan_number: planNumber })
    .select('id')
    .single()

  return created?.id ?? null
}

// Kaleme ait planın toplam kalem sayısını getir
async function getPlanItemCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: number
): Promise<number> {
  const { count } = await supabase
    .from('treatment_plan_items')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', planId)
  return count ?? 0
}

export async function addPlanItem(
  patientId: number,
  planType: TreatmentPlan['plan_type'],
  planNumber: number,
  item: {
    toothNo?: number | null
    treatmentName: string
    tariffItemId?: number | null
    fee: number
    discountRate?: number
    notes?: string
    doctorId?: number | null
  }
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  if (item.doctorId) {
    const { data: doctor } = await supabase.from('doctors').select('id').eq('id', item.doctorId).eq('clinic_id', clinicId).maybeSingle()
    if (!doctor) return { error: 'Hekim bulunamadı' }
  }

  const planId = await getOrCreatePlanId(supabase, clinicId, patientId, planType, planNumber)
  if (!planId) return { error: 'Plan oluşturulamadı' }

  // Sıralama için mevcut max order_index bul
  const { data: lastItem } = await supabase
    .from('treatment_plan_items')
    .select('order_index')
    .eq('plan_id', planId)
    .order('order_index', { ascending: false })
    .limit(1)
    .single()
  const nextOrder = lastItem ? lastItem.order_index + 1 : 0

  const { error } = await supabase.from('treatment_plan_items').insert({
    plan_id: planId,
    tooth_no: item.toothNo ?? null,
    treatment_name: item.treatmentName,
    tariff_item_id: item.tariffItemId ?? null,
    fee: item.fee,
    discount_rate: item.discountRate ?? 0,
    order_index: nextOrder,
    notes: item.notes ?? null,
    doctor_id: item.doctorId ?? null,
  })

  if (error) return { error: error.message }

  // İlk kalem eklendiyse bir sonraki plan numarasını oluştur (Planlama/Faz)
  if (planType === 'planlama' || planType === 'faz') {
    const count = await getPlanItemCount(supabase, planId)
    if (count === 1) {
      await getOrCreatePlanId(supabase, clinicId, patientId, planType, planNumber + 1)
    }
  }

  return { success: true }
}

export async function removePlanItem(
  itemId: number
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  // Klinik doğrulama
  const { data: item } = await supabase
    .from('treatment_plan_items')
    .select('plan_id, treatment_plans!inner(clinic_id)')
    .eq('id', itemId)
    .single()

  const raw = item as { plan_id: number; treatment_plans: { clinic_id: number } } | null
  if (!raw || raw.treatment_plans.clinic_id !== clinicId) {
    return { error: 'Yetkisiz erişim' }
  }

  const { error } = await supabase.from('treatment_plan_items').delete().eq('id', itemId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function copyPlanItems(
  sourceItemIds: number[],
  targetPatientId: number,
  targetPlanType: TreatmentPlan['plan_type'],
  targetPlanNumber: number,
  options: { includeFee: boolean; includeDiscount: boolean }
): Promise<{ success?: boolean; error?: string }> {
  if (sourceItemIds.length === 0) return { error: 'Kalem seçilmedi' }
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  // Kaynak kalemleri çek (klinik doğrulamalı)
  const { data: sourceItems, error: fetchErr } = await supabase
    .from('treatment_plan_items')
    .select('id, tooth_no, treatment_name, tariff_item_id, fee, discount_rate, notes, order_index, doctor_id, treatment_plans!inner(clinic_id)')
    .in('id', sourceItemIds)
    .overrideTypes<Array<{
      id: number; tooth_no: number | null; treatment_name: string
      tariff_item_id: number | null; fee: number; discount_rate: number
      notes: string | null; order_index: number; doctor_id: number | null
      // Çoktan-bire join: PostgREST nesne döner; eski sürüm uyumu için dizi de kabul edilir
      treatment_plans: { clinic_id: number } | { clinic_id: number }[] | null
    }>, { merge: false }>()

  if (fetchErr || !sourceItems) return { error: 'Kalemler getirilemedi' }

  const raw = sourceItems

  // Varsayılan ret: plan bilgisi eksikse veya klinik eşleşmiyorsa kopyalama yapılmaz
  const belongsToClinic = raw.every((r) => {
    const plans = Array.isArray(r.treatment_plans) ? r.treatment_plans : [r.treatment_plans]
    return plans.length > 0 && plans.every((p) => p?.clinic_id === clinicId)
  })
  if (!belongsToClinic) {
    return { error: 'Yetkisiz erişim' }
  }

  const planId = await getOrCreatePlanId(supabase, clinicId, targetPatientId, targetPlanType, targetPlanNumber)
  if (!planId) return { error: 'Hedef plan oluşturulamadı' }

  const { data: lastItem } = await supabase
    .from('treatment_plan_items')
    .select('order_index')
    .eq('plan_id', planId)
    .order('order_index', { ascending: false })
    .limit(1)
    .single()
  let nextOrder = lastItem ? lastItem.order_index + 1 : 0

  const inserts = raw.map((src) => ({
    plan_id: planId,
    tooth_no: src.tooth_no,
    treatment_name: src.treatment_name,
    tariff_item_id: src.tariff_item_id,
    fee: options.includeFee ? src.fee : 0,
    discount_rate: options.includeDiscount ? src.discount_rate : 0,
    notes: src.notes,
    doctor_id: src.doctor_id,
    copied_from_id: src.id,
    order_index: nextOrder++,
  }))

  const { error } = await supabase.from('treatment_plan_items').insert(inserts)
  if (error) return { error: error.message }

  // Hedef planlama/faz ise bir sonrakini hazırla
  if ((targetPlanType === 'planlama' || targetPlanType === 'faz')) {
    const count = await getPlanItemCount(supabase, planId)
    if (count === inserts.length) {
      await getOrCreatePlanId(supabase, clinicId, targetPatientId, targetPlanType, targetPlanNumber + 1)
    }
  }

  return { success: true }
}

export async function reorderPlanItem(
  itemId: number,
  newOrderIndex: number
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const { data: item } = await supabase
    .from('treatment_plan_items')
    .select('plan_id, treatment_plans!inner(clinic_id)')
    .eq('id', itemId)
    .single()

  const raw = item as { plan_id: number; treatment_plans: { clinic_id: number } } | null
  if (!raw || raw.treatment_plans.clinic_id !== clinicId) return { error: 'Yetkisiz erişim' }

  const { error } = await supabase
    .from('treatment_plan_items')
    .update({ order_index: newOrderIndex })
    .eq('id', itemId)

  if (error) return { error: error.message }
  return { success: true }
}

// Plan toplamına indirim: yüzde veya sabit net toplam. İndirim oranı her kaleme (binde bir hassasiyetle) yazılır; fiyat değişmez.
export async function applyPlanDiscount(
  planId: number,
  input: { type: 'percent' | 'fixed'; value: number }
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const { data: plan } = await supabase.from('treatment_plans').select('id, plan_type').eq('id', planId).eq('clinic_id', clinicId).maybeSingle()
  if (!plan) return { error: 'Plan bulunamadı' }
  if (plan.plan_type === 'diyagnoz') return { error: 'Tanı listesine indirim uygulanamaz' }
  if (!Number.isFinite(input.value) || input.value < 0) return { error: 'Geçerli bir değer girin' }

  const { data: items, error: itemsError } = await supabase.from('treatment_plan_items').select('id, fee').eq('plan_id', planId)
  if (itemsError) return { error: itemsError.message }
  const gross = (items ?? []).reduce((s, i) => s + (i.fee ?? 0), 0)
  if (!items?.length || gross <= 0) return { error: 'İndirim uygulanacak ücretli kalem yok' }

  let rate: number // binde (örn. 100 = %10)
  if (input.type === 'percent') {
    if (input.value >= 100) return { error: 'İndirim oranı %100 veya daha fazla olamaz' }
    rate = Math.round(input.value * 10)
  } else {
    const target = Math.round(input.value)
    if (target <= 0) return { error: 'Yeni toplam sıfırdan büyük olmalı' }
    if (target > gross) return { error: 'Yeni toplam mevcut toplamdan büyük olamaz (artırım yok)' }
    rate = Math.round((1 - target / gross) * 1000)
  }
  rate = Math.min(Math.max(rate, 0), 999)
  const { error } = await supabase.from('treatment_plan_items').update({ discount_rate: rate }).eq('plan_id', planId)
  if (error) return { error: error.message }
  return { success: true }
}

// Planlama/Faz kalemlerini gerçek TEDAVİ kaydına aktarır (kalemin hekimi, yoksa seçilen hekim; ücret = indirimli net tutar).
export async function copyPlanItemsToTreatments(
  itemIds: number[],
  options: { treatmentDate: string; fallbackDoctorId: number | null }
): Promise<{ success?: boolean; added?: number; errors?: string[]; error?: string }> {
  if (itemIds.length === 0) return { error: 'Kalem seçilmedi' }
  const ctx = await getCtx()
  if (!ctx) return { error: 'Yetkisiz erişim' }
  const { supabase, clinicId } = ctx

  const { data: rows, error } = await supabase
    .from('treatment_plan_items')
    .select('id, tooth_no, treatment_name, tariff_item_id, fee, discount_rate, doctor_id, order_index, plan:treatment_plans!inner(clinic_id, patient_id, plan_type)')
    .in('id', itemIds)
    .overrideTypes<Array<{
      id: number; tooth_no: number | null; treatment_name: string; tariff_item_id: number | null
      fee: number; discount_rate: number; doctor_id: number | null; order_index: number
      plan: { clinic_id: number; patient_id: number; plan_type: string } | { clinic_id: number; patient_id: number; plan_type: string }[] | null
    }>, { merge: false }>()
  if (error || !rows) return { error: 'Kalemler getirilemedi' }

  const planOf = (r: (typeof rows)[number]) => (Array.isArray(r.plan) ? r.plan[0] : r.plan)
  if (!rows.every((r) => planOf(r)?.clinic_id === clinicId)) return { error: 'Yetkisiz erişim' }
  if (rows.some((r) => planOf(r)?.plan_type === 'diyagnoz')) return { error: 'Tanı kalemleri tedaviye aktarılamaz' }
  const patientIds = new Set(rows.map((r) => planOf(r)!.patient_id))
  if (patientIds.size !== 1) return { error: 'Kalemler aynı hastaya ait olmalı' }
  const patientId = [...patientIds][0]

  const ordered = [...rows].sort((a, b) => a.order_index - b.order_index)
  let added = 0
  const errors: string[] = []
  for (const row of ordered) {
    if (!row.tariff_item_id) { errors.push(`${row.treatment_name}: tarife bağlantısı yok`); continue }
    const net = Math.round((row.fee ?? 0) * (1 - (row.discount_rate ?? 0) / 1000))
    const res = await addTreatment({
      patientId,
      tariffId: row.tariff_item_id,
      tooth: row.tooth_no,
      doctorId: row.doctor_id ?? options.fallbackDoctorId,
      treatmentDate: options.treatmentDate,
      fee: net,
      originalFee: row.fee ?? 0,
    })
    if (res.error) errors.push(`${row.tooth_no ? row.tooth_no + ' · ' : ''}${row.treatment_name}: ${res.error}`)
    else added += 1
  }
  if (added === 0) return { error: errors[0] ?? 'Aktarılamadı', errors }
  return { success: true, added, errors }
}
