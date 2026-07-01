'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { SOCIAL_CATEGORIES, SOCIAL_PLATFORMS } from '../constants'
import type { SocialActionResult } from '../types'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const SOCIAL_TYPES = new Set([...IMAGE_TYPES, 'video/mp4'])
const CONSENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const CATEGORY_KEYS = new Set<string>(SOCIAL_CATEGORIES.map(([key]) => key))
const PLATFORM_KEYS = new Set<string>(SOCIAL_PLATFORMS)
const PACKAGE_STATUS_KEYS = new Set(['draft', 'awaiting_approval', 'ready', 'published', 'archived'])

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
  if (!profile?.clinic_id) return null
  return { supabase, user, clinicId: Number(profile.clinic_id) }
}

function safeFileName(name: string) {
  const extension = name.includes('.') ? `.${name.split('.').pop()?.toLowerCase()}` : ''
  const base = name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'file'
  return `${base}${extension}`
}

function cleanPlatforms(values: unknown) {
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string' && PLATFORM_KEYS.has(value)) : []
}

export async function createConsentAction(formData: FormData): Promise<SocialActionResult<null>> {
  const context = await getContext()
  if (!context) return { error: 'Oturum doğrulanamadı.' }
  const patientId = Number(formData.get('patient_id'))
  const consentDate = String(formData.get('consent_date') ?? '')
  const expiresAt = String(formData.get('expires_at') ?? '') || null
  const notes = String(formData.get('notes') ?? '').trim() || null
  const platforms = formData.getAll('platforms').map(String).filter((value) => PLATFORM_KEYS.has(value))
  const file = formData.get('document')
  if (!Number.isInteger(patientId) || !consentDate) return { error: 'Hasta ve onam tarihi zorunludur.' }
  if (expiresAt && expiresAt < consentDate) return { error: 'Bitiş tarihi onam tarihinden önce olamaz.' }

  const { data: patient } = await context.supabase.from('patients').select('id').eq('id', patientId).eq('clinic_id', context.clinicId).single()
  if (!patient) return { error: 'Hasta doğrulanamadı.' }

  let documentPath: string | null = null
  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024 || !CONSENT_TYPES.has(file.type)) return { error: 'Onam belgesi PDF, JPG, PNG veya WEBP ve en fazla 10 MB olmalıdır.' }
    documentPath = `${context.clinicId}/${patientId}/${randomUUID()}-${safeFileName(file.name)}`
    const { error } = await context.supabase.storage.from('consent-documents').upload(documentPath, file, { contentType: file.type, upsert: false })
    if (error) return { error: 'Onam belgesi yüklenemedi.' }
  }

  const { error } = await context.supabase.from('patient_media_consents').insert({
    clinic_id: context.clinicId,
    patient_id: patientId,
    status: 'active',
    consent_date: consentDate,
    expires_at: expiresAt,
    document_path: documentPath,
    platforms,
    notes,
    created_by: context.user.id,
  })
  if (error) {
    if (documentPath) await context.supabase.storage.from('consent-documents').remove([documentPath])
    return { error: 'Onam kaydı oluşturulamadı.' }
  }
  revalidatePath('/social')
  return { data: null }
}

export async function updateConsentStatusAction(id: number, status: 'active' | 'revoked'): Promise<SocialActionResult<null>> {
  const context = await getContext()
  if (!context) return { error: 'Oturum doğrulanamadı.' }
  const { error } = await context.supabase
    .from('patient_media_consents')
    .update({ status, revoked_at: status === 'revoked' ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('clinic_id', context.clinicId)
  if (error) return { error: 'Onam durumu güncellenemedi.' }
  revalidatePath('/social')
  return { data: null }
}

export async function createSocialAssetAction(formData: FormData): Promise<SocialActionResult<null>> {
  const context = await getContext()
  if (!context) return { error: 'Oturum doğrulanamadı.' }
  const patientRelated = formData.get('patient_related') === 'true'
  const patientId = formData.get('patient_id') ? Number(formData.get('patient_id')) : null
  const sourceImageId = formData.get('source_image_id') ? Number(formData.get('source_image_id')) : null
  const category = String(formData.get('category') ?? '')
  const caption = String(formData.get('caption') ?? '').trim() || null
  const identityVisible = formData.get('identity_visible') === 'true'
  const faceVisible = formData.get('face_visible') === 'true'
  const isBeforeAfter = formData.get('is_before_after') === 'true'
  const file = formData.get('file')
  if (!CATEGORY_KEYS.has(category)) return { error: 'Geçerli bir kategori seçin.' }
  if (patientRelated && !patientId) return { error: 'Hasta ilişkili içerikte hasta seçilmelidir.' }

  let patient: { id: number } | null = null
  let consent: { id: number } | null = null
  if (patientId) {
    const patientResult = await context.supabase.from('patients').select('id').eq('id', patientId).eq('clinic_id', context.clinicId).single()
    patient = patientResult.data
    if (!patient) return { error: 'Hasta doğrulanamadı.' }
    const today = new Date().toISOString().slice(0, 10)
    const consentResult = await context.supabase
      .from('patient_media_consents')
      .select('id')
      .eq('clinic_id', context.clinicId)
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .lte('consent_date', today)
      .or(`expires_at.is.null,expires_at.gte.${today}`)
      .order('consent_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    consent = consentResult.data
  }

  let storageBucket: 'patient-images' | 'social-media'
  let storagePath: string
  let fileName: string
  let mimeType: string | null = null
  let uploaded = false

  if (sourceImageId) {
    if (!patientId) return { error: 'Kaynak hasta görüntüsü için hasta seçin.' }
    const { data: source } = await context.supabase
      .from('patient_images')
      .select('id, patient_id, storage_path, file_name')
      .eq('id', sourceImageId)
      .eq('clinic_id', context.clinicId)
      .eq('patient_id', patientId)
      .single()
    if (!source) return { error: 'Kaynak görüntü doğrulanamadı.' }
    storageBucket = 'patient-images'
    storagePath = source.storage_path
    fileName = source.file_name
  } else {
    if (!(file instanceof File) || file.size === 0) return { error: 'Bir görsel veya video seçin.' }
    if (file.size > 20 * 1024 * 1024 || !SOCIAL_TYPES.has(file.type)) return { error: 'Dosya JPG, PNG, WEBP, GIF veya MP4 ve en fazla 20 MB olmalıdır.' }
    storageBucket = 'social-media'
    storagePath = `${context.clinicId}/${patientId ?? 'clinic'}/${randomUUID()}-${safeFileName(file.name)}`
    fileName = file.name
    mimeType = file.type
    const { error } = await context.supabase.storage.from(storageBucket).upload(storagePath, file, { contentType: file.type, upsert: false })
    if (error) return { error: 'Medya dosyası yüklenemedi.' }
    uploaded = true
  }

  const publishEligible = !patientRelated || Boolean(consent)
  const { error } = await context.supabase.from('social_media_assets').insert({
    clinic_id: context.clinicId,
    patient_id: patientId,
    source_patient_image_id: sourceImageId,
    consent_id: patientRelated ? consent?.id ?? null : null,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    file_name: fileName,
    mime_type: mimeType,
    category,
    caption,
    patient_related: patientRelated,
    identity_visible: identityVisible,
    face_visible: faceVisible,
    is_before_after: isBeforeAfter,
    publish_eligible: publishEligible,
    created_by: context.user.id,
  })
  if (error) {
    if (uploaded) await context.supabase.storage.from('social-media').remove([storagePath])
    return { error: 'Medya kaydı oluşturulamadı.' }
  }
  revalidatePath('/social')
  return { data: null }
}

interface CreatePackageInput {
  title: string
  description: string
  hashtags: string
  platforms: string[]
  publicationNote: string
  scheduledFor: string
  assetIds: number[]
}

export async function createContentPackageAction(input: CreatePackageInput): Promise<SocialActionResult<null>> {
  const context = await getContext()
  if (!context) return { error: 'Oturum doğrulanamadı.' }
  const title = input.title.trim()
  const assetIds = Array.from(new Set(input.assetIds.filter(Number.isInteger))).slice(0, 50)
  if (!title || title.length > 160 || assetIds.length === 0) return { error: 'Başlık ve en az bir uygun medya zorunludur.' }

  const { data: assets } = await context.supabase
    .from('social_media_assets')
    .select('id')
    .eq('clinic_id', context.clinicId)
    .eq('publish_eligible', true)
    .in('id', assetIds)
  if (!assets || assets.length !== assetIds.length) return { error: 'Seçilen medyalardan biri yayın için uygun değil.' }

  const hashtags = input.hashtags.split(/[\s,]+/).map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean).slice(0, 30)
  const { data: packageRow, error } = await context.supabase
    .from('social_content_packages')
    .insert({
      clinic_id: context.clinicId,
      title,
      description: input.description.trim() || null,
      hashtags,
      platforms: cleanPlatforms(input.platforms),
      publication_note: input.publicationNote.trim() || null,
      status: 'draft',
      scheduled_for: input.scheduledFor || null,
      created_by: context.user.id,
    })
    .select('id')
    .single()
  if (error || !packageRow) return { error: 'İçerik paketi oluşturulamadı.' }

  const { error: itemError } = await context.supabase.from('social_content_items').insert(
    assetIds.map((assetId, index) => ({ clinic_id: context.clinicId, package_id: packageRow.id, asset_id: assetId, sort_order: index }))
  )
  if (itemError) {
    await context.supabase.from('social_content_packages').delete().eq('id', packageRow.id).eq('clinic_id', context.clinicId)
    return { error: 'Medya seçimleri pakete eklenemedi.' }
  }
  revalidatePath('/social')
  return { data: null }
}

export async function updatePackageStatusAction(id: number, status: string): Promise<SocialActionResult<null>> {
  const context = await getContext()
  if (!context) return { error: 'Oturum doğrulanamadı.' }
  if (!PACKAGE_STATUS_KEYS.has(status)) return { error: 'Geçersiz içerik durumu.' }

  if (['ready', 'published'].includes(status)) {
    const { data: items } = await context.supabase
      .from('social_content_items')
      .select('asset_id')
      .eq('clinic_id', context.clinicId)
      .eq('package_id', id)
    const ids = (items ?? []).map((item) => item.asset_id)
    if (ids.length === 0) return { error: 'Boş içerik paketi yayına hazırlanamaz.' }
    const { data: validAssets } = await context.supabase
      .from('social_media_assets')
      .select('id, patient_related, patient_id, consent_id')
      .eq('clinic_id', context.clinicId)
      .eq('publish_eligible', true)
      .in('id', ids)
    if (!validAssets || validAssets.length !== ids.length) return { error: 'Paket içinde onamı veya yayın uygunluğu eksik medya var.' }

    const patientAssets = validAssets.filter((asset) => asset.patient_related)
    if (patientAssets.length > 0) {
      const consentIds = patientAssets
        .map((asset) => asset.consent_id)
        .filter((consentId): consentId is number => typeof consentId === 'number')
      const today = new Date().toISOString().slice(0, 10)
      const { data: validConsents } = await context.supabase
        .from('patient_media_consents')
        .select('id, patient_id')
        .eq('clinic_id', context.clinicId)
        .eq('status', 'active')
        .lte('consent_date', today)
        .or(`expires_at.is.null,expires_at.gte.${today}`)
        .in('id', consentIds)
      const consentPatients = new Map((validConsents ?? []).map((consent) => [consent.id, consent.patient_id]))
      if (patientAssets.some((asset) => !asset.consent_id || consentPatients.get(asset.consent_id) !== asset.patient_id)) {
        return { error: 'Paket içinde süresi dolmuş veya geri çekilmiş hasta onamı var.' }
      }
    }
  }

  const { error } = await context.supabase
    .from('social_content_packages')
    .update({ status, published_at: status === 'published' ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('clinic_id', context.clinicId)
  if (error) return { error: 'İçerik durumu güncellenemedi.' }
  revalidatePath('/social')
  return { data: null }
}

export async function deleteSocialAssetAction(id: number): Promise<SocialActionResult<null>> {
  const context = await getContext()
  if (!context) return { error: 'Oturum doğrulanamadı.' }
  const { data: asset } = await context.supabase
    .from('social_media_assets')
    .select('storage_bucket, storage_path')
    .eq('id', id)
    .eq('clinic_id', context.clinicId)
    .single()
  if (!asset) return { error: 'Medya bulunamadı.' }
  const { error } = await context.supabase.from('social_media_assets').delete().eq('id', id).eq('clinic_id', context.clinicId)
  if (error) return { error: 'Paketlerde kullanılan medya silinemez.' }
  if (asset.storage_bucket === 'social-media') await context.supabase.storage.from('social-media').remove([asset.storage_path])
  revalidatePath('/social')
  return { data: null }
}
