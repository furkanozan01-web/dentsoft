export type ImageAiAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'reviewed'
export type ImageAiReviewStatus = 'suggested' | 'accepted' | 'rejected' | 'edited'
export type ImageAiFindingType = 'mandibular_nerve' | 'maxillary_sinus' | 'caries' | 'missing_tooth' | 'root_canal' | 'implant' | 'impacted_tooth' | 'lesion' | 'other'
export type AiPlanType = 'protective' | 'surgical' | 'prosthetic' | 'economic' | 'comprehensive'

export interface ImageAiAnalysis {
  id: number
  clinic_id: number
  patient_id: number
  image_id: number
  status: ImageAiAnalysisStatus
  model_name: string | null
  model_version: string | null
  summary: string | null
  error_message: string | null
  created_at: string
  completed_at: string | null
  reviewed_at: string | null
}

export interface ImageAiFinding {
  id: number
  analysis_id: number
  patient_id: number
  image_id: number
  tooth_number: number | null
  finding_type: ImageAiFindingType
  confidence: number | null
  description: string
  status: ImageAiReviewStatus
  linked_diagnosis_item_id: number | null
  reviewed_at: string | null
}

export type ImageOverlayGeometry = {
  version: 1
  shape: 'polygon' | 'polyline' | 'box' | 'point'
  /** Görüntü boyutundan bağımsız, 0–1 aralığında koordinatlar. */
  points: Array<[number, number]>
}

export interface ImageAiOverlay {
  id: number
  analysis_id: number
  image_id: number
  finding_id: number | null
  overlay_type: ImageAiFindingType
  geometry_json: ImageOverlayGeometry
  color: string
  visible_default: boolean
}

export interface AiTreatmentPlanItemSuggestion {
  toothNumber: number | null
  treatmentName: string
  rationale: string
  priority: number
}

export interface AiTreatmentPlanSuggestion {
  id: number
  patient_id: number
  analysis_id: number
  title: string
  plan_type: AiPlanType
  status: ImageAiReviewStatus
  plan_items_json: AiTreatmentPlanItemSuggestion[]
  linked_treatment_plan_id: number | null
  created_at: string
  accepted_at: string | null
}
