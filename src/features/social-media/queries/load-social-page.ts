import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { MediaConsent, PatientImageSource, SocialAsset, SocialPackage, SocialPatient } from '../types'

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

async function signedUrlMap(supabase: SupabaseClient, bucket: string, paths: string[]) {
  const unique = Array.from(new Set(paths.filter(Boolean)))
  if (unique.length === 0) return new Map<string, string>()
  const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, 3600)
  const entries: Array<[string, string]> = []
  unique.forEach((path, index) => {
    const url = data?.[index]?.signedUrl
    if (url) entries.push([path, url])
  })
  return new Map<string, string>(entries)
}

export async function loadSocialPageData(supabase: SupabaseClient, clinicId: number) {
  const [assetsResult, consentsResult, packagesResult, patientsResult, imagesResult] = await Promise.all([
    supabase.from('social_media_assets').select('id, patient_id, source_patient_image_id, consent_id, storage_bucket, storage_path, file_name, mime_type, category, caption, patient_related, identity_visible, face_visible, is_before_after, publish_eligible, created_at, patient:patients(name, surname), consent:patient_media_consents(status, consent_date, expires_at)').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
    supabase.from('patient_media_consents').select('id, patient_id, status, consent_date, expires_at, document_path, platforms, notes, created_at, patient:patients(name, surname)').eq('clinic_id', clinicId).order('consent_date', { ascending: false }),
    supabase.from('social_content_packages').select('id, title, description, hashtags, platforms, publication_note, status, scheduled_for, published_at, created_at, updated_at, items:social_content_items(id, sort_order, asset:social_media_assets(id, file_name, category, storage_bucket, storage_path))').eq('clinic_id', clinicId).order('updated_at', { ascending: false }).overrideTypes<SocialPackage[], { merge: false }>(),
    supabase.from('patients').select('id, name, surname').eq('clinic_id', clinicId).order('name'),
    supabase.from('patient_images').select('id, patient_id, storage_path, file_name, created_at').eq('clinic_id', clinicId).order('created_at', { ascending: false }).limit(1000),
  ])

  const firstError = [assetsResult.error, consentsResult.error, packagesResult.error, patientsResult.error, imagesResult.error].find(Boolean)
  if (firstError) throw new Error(firstError.message)

  const rawAssets = assetsResult.data ?? []
  const rawConsents = consentsResult.data ?? []
  const rawImages = imagesResult.data ?? []
  const [patientImageUrls, socialUrls, documentUrls] = await Promise.all([
    signedUrlMap(supabase, 'patient-images', [...rawAssets.filter((item) => item.storage_bucket === 'patient-images').map((item) => item.storage_path), ...rawImages.map((item) => item.storage_path)]),
    signedUrlMap(supabase, 'social-media', rawAssets.filter((item) => item.storage_bucket === 'social-media').map((item) => item.storage_path)),
    signedUrlMap(supabase, 'consent-documents', rawConsents.map((item) => item.document_path ?? '')),
  ])

  const assets: SocialAsset[] = rawAssets.map((item) => ({
    ...item,
    storage_bucket: item.storage_bucket as SocialAsset['storage_bucket'],
    patient: one(item.patient),
    consent: one(item.consent),
    signedUrl: (item.storage_bucket === 'patient-images' ? patientImageUrls : socialUrls).get(item.storage_path) || null,
  })) as SocialAsset[]

  const consents: MediaConsent[] = rawConsents.map((item) => ({
    ...item,
    patient: one(item.patient),
    documentUrl: item.document_path ? documentUrls.get(item.document_path) || null : null,
  })) as MediaConsent[]

  const patientImages: PatientImageSource[] = rawImages.map((item) => ({
    ...item,
    signedUrl: patientImageUrls.get(item.storage_path) || null,
  }))

  return {
    assets,
    consents,
    packages: packagesResult.data ?? [],
    patients: (patientsResult.data ?? []) as SocialPatient[],
    patientImages,
  }
}
