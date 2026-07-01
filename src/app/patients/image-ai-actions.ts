'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { AiTreatmentPlanSuggestion, ImageAiAnalysis, ImageAiFinding, ImageAiFindingType, ImageAiOverlay, ImageAiReviewStatus, ImageOverlayGeometry } from './image-ai-types'

type AnalysisBundle = { analysis: ImageAiAnalysis; findings: ImageAiFinding[]; overlays: ImageAiOverlay[]; plans: AiTreatmentPlanSuggestion[] }
const CLINICAL_ROLES = new Set(['bashekim', 'responsible_manager', 'hekim'])

async function getCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('clinic_id, role').eq('id', user.id).single()
  if (!profile?.clinic_id) return null
  return { supabase, userId: user.id, clinicId: Number(profile.clinic_id), canReview: CLINICAL_ROLES.has(profile.role) }
}

export async function getLatestImageAnalysis(patientId: number, imageId: number): Promise<{ data: AnalysisBundle | null; error?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { data: null, error: 'Yetkisiz erişim' }
  const { data: analysis, error } = await ctx.supabase.from('image_ai_analyses').select('id, clinic_id, patient_id, image_id, status, model_name, model_version, summary, error_message, created_at, completed_at, reviewed_at').eq('clinic_id', ctx.clinicId).eq('patient_id', patientId).eq('image_id', imageId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) return { data: null, error: error.message }
  if (!analysis) return { data: null }
  const [findingsResult, overlaysResult, plansResult] = await Promise.all([
    ctx.supabase.from('image_ai_findings').select('id, analysis_id, patient_id, image_id, tooth_number, finding_type, confidence, description, status, linked_diagnosis_item_id, reviewed_at').eq('clinic_id', ctx.clinicId).eq('analysis_id', analysis.id).order('id'),
    ctx.supabase.from('image_ai_overlays').select('id, analysis_id, image_id, finding_id, overlay_type, geometry_json, color, visible_default').eq('clinic_id', ctx.clinicId).eq('analysis_id', analysis.id).order('id'),
    ctx.supabase.from('ai_treatment_plan_suggestions').select('id, patient_id, analysis_id, title, plan_type, status, plan_items_json, linked_treatment_plan_id, created_at, accepted_at').eq('clinic_id', ctx.clinicId).eq('analysis_id', analysis.id).order('id'),
  ])
  const firstError = findingsResult.error ?? overlaysResult.error ?? plansResult.error
  if (firstError) return { data: null, error: firstError.message }
  return { data: { analysis: analysis as ImageAiAnalysis, findings: (findingsResult.data ?? []) as ImageAiFinding[], overlays: (overlaysResult.data ?? []) as unknown as ImageAiOverlay[], plans: (plansResult.data ?? []) as unknown as AiTreatmentPlanSuggestion[] } }
}

const MOCK_FINDINGS: Array<{ tooth: number; type: ImageAiFindingType; confidence: number; description: string }> = [
  { tooth: 36, type: 'missing_tooth', confidence: 0.92, description: '36 numaralı bölgede eksik diş görünümü' },
  { tooth: 22, type: 'root_canal', confidence: 0.88, description: '22 numaralı dişte kanal tedavisi görünümü' },
  { tooth: 46, type: 'implant', confidence: 0.96, description: '46 numaralı bölgede implant görünümü' },
  { tooth: 11, type: 'caries', confidence: 0.78, description: '11 numaralı dişte çürük şüphesi' },
  { tooth: 38, type: 'impacted_tooth', confidence: 0.85, description: '38 numaralı dişte gömülü diş şüphesi' },
  { tooth: 16, type: 'lesion', confidence: 0.73, description: '16 numaralı dişte periapikal lezyon şüphesi' },
]

const OVERLAY_LAYOUT: Record<string, { geometry: ImageOverlayGeometry; color: string }> = {
  missing_tooth: { geometry: { version: 1, shape: 'box', points: [[0.25, 0.61], [0.34, 0.76]] }, color: '#64748B' },
  root_canal: { geometry: { version: 1, shape: 'polyline', points: [[0.56, 0.25], [0.55, 0.38], [0.54, 0.48]] }, color: '#1D4ED8' },
  implant: { geometry: { version: 1, shape: 'box', points: [[0.68, 0.58], [0.76, 0.77]] }, color: '#8B5CF6' },
  caries: { geometry: { version: 1, shape: 'point', points: [[0.45, 0.34]] }, color: '#EF4444' },
  impacted_tooth: { geometry: { version: 1, shape: 'polygon', points: [[0.08, 0.65], [0.20, 0.61], [0.22, 0.73], [0.11, 0.79]] }, color: '#F97316' },
  lesion: { geometry: { version: 1, shape: 'point', points: [[0.76, 0.32]] }, color: '#EC4899' },
  mandibular_nerve: { geometry: { version: 1, shape: 'polyline', points: [[0.08, 0.78], [0.28, 0.72], [0.50, 0.75], [0.72, 0.72], [0.91, 0.78]] }, color: '#F59E0B' },
  maxillary_sinus: { geometry: { version: 1, shape: 'polygon', points: [[0.18, 0.16], [0.39, 0.12], [0.41, 0.28], [0.22, 0.31]] }, color: '#06B6D4' },
}

export async function runMockImageAnalysis(patientId: number, imageId: number): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx || !ctx.canReview) return { error: 'Bu işlem için hekim yetkisi gerekir' }
  const { data: image } = await ctx.supabase.from('patient_images').select('id').eq('id', imageId).eq('patient_id', patientId).eq('clinic_id', ctx.clinicId).single()
  if (!image) return { error: 'Görüntü bu hasta veya kliniğe ait değil' }
  const { data: analysis, error: analysisError } = await ctx.supabase.from('image_ai_analyses').insert({ clinic_id: ctx.clinicId, patient_id: patientId, image_id: imageId, status: 'processing', model_name: 'dentsoft-mock-radiology', model_version: '1.0', raw_result_json: { mock: true, schemaVersion: 1 } }).select('id').single()
  if (analysisError || !analysis) return { error: analysisError?.message ?? 'Analiz başlatılamadı' }
  try {
    const { data: findings, error: findingError } = await ctx.supabase.from('image_ai_findings').insert(MOCK_FINDINGS.map((item) => ({ clinic_id: ctx.clinicId, analysis_id: analysis.id, patient_id: patientId, image_id: imageId, tooth_number: item.tooth, finding_type: item.type, confidence: item.confidence, description: item.description, status: 'suggested' }))).select('id, finding_type')
    if (findingError) throw findingError
    const findingId = new Map((findings ?? []).map((item) => [item.finding_type, item.id]))
    const overlayRows = Object.entries(OVERLAY_LAYOUT).map(([type, value]) => ({ clinic_id: ctx.clinicId, analysis_id: analysis.id, image_id: imageId, finding_id: findingId.get(type) ?? null, overlay_type: type, geometry_json: value.geometry, color: value.color, visible_default: true }))
    const { error: overlayError } = await ctx.supabase.from('image_ai_overlays').insert(overlayRows)
    if (overlayError) throw overlayError
    const planRows = [
      { title: 'Plan A – Koruyucu Tedavi', plan_type: 'protective', plan_items_json: [{ toothNumber: 11, treatmentName: 'Restoratif değerlendirme', rationale: 'Çürük şüphesi', priority: 1 }, { toothNumber: 22, treatmentName: 'Kanal tedavisi kontrolü', rationale: 'Mevcut kanal tedavisi görünümü', priority: 2 }] },
      { title: 'Plan B – Cerrahi + Protetik', plan_type: 'surgical', plan_items_json: [{ toothNumber: 38, treatmentName: 'Cerrahi konsültasyon', rationale: 'Gömülü diş şüphesi', priority: 1 }, { toothNumber: 36, treatmentName: 'İmplant değerlendirmesi', rationale: 'Eksik diş bölgesi', priority: 2 }] },
      { title: 'Plan C – Ekonomik Plan', plan_type: 'economic', plan_items_json: [{ toothNumber: 16, treatmentName: 'Lezyon kontrolü', rationale: 'Öncelikli klinik değerlendirme', priority: 1 }, { toothNumber: 11, treatmentName: 'Dolgu değerlendirmesi', rationale: 'Koruyucu yaklaşım', priority: 2 }] },
    ].map((row) => ({ ...row, clinic_id: ctx.clinicId, patient_id: patientId, analysis_id: analysis.id, status: 'suggested' }))
    const { error: planError } = await ctx.supabase.from('ai_treatment_plan_suggestions').insert(planRows)
    if (planError) throw planError
    const { error: completeError } = await ctx.supabase.from('image_ai_analyses').update({ status: 'completed', summary: 'Altı radyografik bulgu önerisi ve üç tedavi planı alternatifi oluşturuldu. Tüm sonuçlar hekim onayı bekliyor.', completed_at: new Date().toISOString() }).eq('id', analysis.id).eq('clinic_id', ctx.clinicId)
    if (completeError) throw completeError
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mock analiz tamamlanamadı'
    await ctx.supabase.from('image_ai_analyses').update({ status: 'failed', error_message: message.slice(0, 500) }).eq('id', analysis.id).eq('clinic_id', ctx.clinicId)
    return { error: message }
  }
  revalidatePath('/patients')
  return { success: true }
}

export async function reviewImageAiFinding(findingId: number, input: { status: Exclude<ImageAiReviewStatus, 'suggested'>; toothNumber: number | null; description: string }): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getCtx()
  if (!ctx || !ctx.canReview) return { error: 'Bu işlem için hekim yetkisi gerekir' }
  if (!['accepted', 'rejected', 'edited'].includes(input.status)) return { error: 'Geçersiz değerlendirme durumu' }
  if (!input.description.trim()) return { error: 'Bulgu açıklaması boş olamaz' }
  const { data: finding, error } = await ctx.supabase.from('image_ai_findings').update({ status: input.status, tooth_number: input.toothNumber, description: input.description.trim(), reviewed_by: ctx.userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', findingId).eq('clinic_id', ctx.clinicId).select('analysis_id').single()
  if (error || !finding) return { error: error?.message ?? 'Bulgu bulunamadı' }
  const { count } = await ctx.supabase.from('image_ai_findings').select('id', { count: 'exact', head: true }).eq('analysis_id', finding.analysis_id).eq('clinic_id', ctx.clinicId).eq('status', 'suggested')
  if ((count ?? 0) === 0) await ctx.supabase.from('image_ai_analyses').update({ status: 'reviewed', reviewed_by: ctx.userId, reviewed_at: new Date().toISOString() }).eq('id', finding.analysis_id).eq('clinic_id', ctx.clinicId)
  revalidatePath('/patients')
  return { success: true }
}
