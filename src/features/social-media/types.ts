export interface SocialPatient {
  id: number
  name: string
  surname: string
}

export interface PatientImageSource {
  id: number
  patient_id: number
  storage_path: string
  file_name: string
  created_at: string
  signedUrl: string | null
}

export interface MediaConsent {
  id: number
  patient_id: number
  status: 'active' | 'revoked' | 'expired'
  consent_date: string
  expires_at: string | null
  document_path: string | null
  documentUrl: string | null
  platforms: string[]
  notes: string | null
  created_at: string
  patient: { name: string; surname: string } | null
}

export interface SocialAsset {
  id: number
  patient_id: number | null
  source_patient_image_id: number | null
  consent_id: number | null
  storage_bucket: 'patient-images' | 'social-media'
  storage_path: string
  file_name: string
  mime_type: string | null
  category: string
  caption: string | null
  patient_related: boolean
  identity_visible: boolean
  face_visible: boolean
  is_before_after: boolean
  publish_eligible: boolean
  created_at: string
  signedUrl: string | null
  patient: { name: string; surname: string } | null
  consent: Pick<MediaConsent, 'status' | 'consent_date' | 'expires_at'> | null
}

export interface SocialPackageItem {
  id: number
  sort_order: number
  asset: Pick<SocialAsset, 'id' | 'file_name' | 'category' | 'storage_bucket' | 'storage_path'> | null
}

export interface SocialPackage {
  id: number
  title: string
  description: string | null
  hashtags: string[]
  platforms: string[]
  publication_note: string | null
  status: 'draft' | 'awaiting_approval' | 'ready' | 'published' | 'archived'
  scheduled_for: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  items: SocialPackageItem[]
}

export interface SocialActionResult<T> {
  data?: T
  error?: string
}

