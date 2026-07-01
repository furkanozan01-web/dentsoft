'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { createFollowup, updateFollowupStep, deleteFollowup, getFollowupsForPatient } from './followup-actions'
import type { Followup, FollowupStep, Patient } from './types'

const TEMPLATES = [
  {
    name: 'İmplant Protokolü',
    steps: ['Cerrahi – İmplant Yerleştirme', '1. Kontrol (1. hafta)', 'Dikiş Alımı (2. hafta)', 'Osseointegrasyon Kontrolü (3. ay)', 'Üst Yapı Uygulaması (6. ay)'],
  },
  {
    name: 'Kanal Tedavisi',
    steps: ['Kanal Tedavisi Seansı', '1. Kontrol (1. hafta)', 'Daimi Dolgu / Kron Yapımı'],
  },
  {
    name: 'Ortodonti Takibi',
    steps: ['Aparey Yerleştirme', '1. Aktivasyon (1. ay)', '2. Aktivasyon (2. ay)', '3. Aktivasyon (3. ay)', 'Retainer Uygulaması'],
  },
  {
    name: 'Cerrahi Takibi',
    steps: ['Cerrahi İşlem', 'Erken Kontrol (1. gün)', 'Dikiş Alımı (1. hafta)', 'İyileşme Kontrolü (1. ay)'],
  },
]

// ---- Ana Bileşen ----
export default function TakipTab({ patient }: { patient: Patient }) {
  const confirm = useConfirm()
  const [followups, setFollowups] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    startTransition(async () => {
      setLoading(true)
      const res = await getFollowupsForPatient(patient.id)
      if (cancelled) return
      if (res.data) setFollowups(res.data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [patient.id])

  const handleToggleStep = (followupId: number, step: FollowupStep) => {
    startTransition(async () => {
      const now = step.completed_at ? null : new Date().toISOString()
      const res = await updateFollowupStep(step.id, { completed_at: now })
      if (res?.error) { toast.error(res.error); return }
      setFollowups((prev) =>
        prev.map((f) =>
          f.id === followupId
            ? { ...f, steps: f.steps.map((s) => s.id === step.id ? { ...s, completed_at: now } : s) }
            : f
        )
      )
    })
  }

  const handleDelete = async (followup: Followup) => {
    const ok = await confirm({
      title: 'Takibi Sil',
      message: `"${followup.title}" takip planı ve tüm adımları silinecek. Devam edilsin mi?`,
      confirmText: 'Evet, Sil',
    })
    if (!ok) return
    startTransition(async () => {
      const res = await deleteFollowup(followup.id)
      if (res?.error) { toast.error(res.error); return }
      setFollowups((prev) => prev.filter((f) => f.id !== followup.id))
      toast.success('Takip silindi')
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2DD4BF] border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      {/* Başlık + Yeni Takip butonu */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#0F2B3D]">Tedavi Takibi</h2>
          <p className="text-xs text-slate-400">Uzun süreli tedavi adımlarını planlayın ve takip edin</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[#2DD4BF] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#26b8a5] transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Yeni Takip
        </button>
      </div>

      {/* Boş durum */}
      {followups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DDF8F4] text-[#1EAEA0]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-500">Henüz takip planı yok</p>
          <p className="mt-1 text-xs text-slate-400">Yeni Takip butonuyla başlayın</p>
        </div>
      ) : (
        <div className="space-y-4">
          {followups.map((followup) => (
            <FollowupCard
              key={followup.id}
              followup={followup}
              onToggleStep={(step) => handleToggleStep(followup.id, step)}
              onDelete={() => handleDelete(followup)}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {showModal && (
        <NewFollowupModal
          patientId={patient.id}
          onClose={() => setShowModal(false)}
          onSuccess={(newFollowup) => {
            setFollowups((prev) => [newFollowup, ...prev])
            setShowModal(false)
            toast.success('Takip planı oluşturuldu')
          }}
        />
      )}
    </div>
  )
}

// ---- Takip Kartı ----
function FollowupCard({
  followup, onToggleStep, onDelete, isPending,
}: {
  followup: Followup
  onToggleStep: (step: FollowupStep) => void
  onDelete: () => void
  isPending: boolean
}) {
  const total = followup.steps.length
  const completed = followup.steps.filter((s) => s.completed_at).length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0
  const isAllDone = total > 0 && completed === total

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Kart başlığı */}
      <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#0F2B3D] truncate">{followup.title}</h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isAllDone ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
              }`}
            >
              {isAllDone ? 'Tamamlandı' : 'Devam Ediyor'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {new Date(followup.start_date + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {followup.notes ? ` · ${followup.notes}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-xs font-bold text-slate-400">{completed}/{total}</span>
          <button
            onClick={onDelete}
            disabled={isPending}
            aria-label="Takibi sil"
            className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" />
            </svg>
          </button>
        </div>
      </div>

      {/* İlerleme çubuğu */}
      {total > 0 && (
        <div className="px-5 pt-3 pb-1">
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#2DD4BF] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Adımlar */}
      <div className="px-4 py-2">
        {[...followup.steps]
          .sort((a, b) => a.step_order - b.step_order)
          .map((step) => (
            <StepRow
              key={step.id}
              step={step}
              onToggle={() => onToggleStep(step)}
              isPending={isPending}
            />
          ))}
        {followup.steps.length === 0 && (
          <p className="py-3 text-xs text-slate-400">Adım eklenmemiş</p>
        )}
      </div>
    </div>
  )
}

// ---- Adım Satırı ----
function StepRow({
  step, onToggle, isPending,
}: {
  step: FollowupStep
  onToggle: () => void
  isPending: boolean
}) {
  const done = Boolean(step.completed_at)
  return (
    <button
      onClick={onToggle}
      disabled={isPending}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50 transition-colors group disabled:opacity-60"
    >
      {/* Checkbox */}
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          done ? 'border-[#2DD4BF] bg-[#2DD4BF]' : 'border-slate-300 group-hover:border-[#2DD4BF]'
        }`}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {/* Metin */}
      <div className="min-w-0 flex-1">
        <span className={`text-sm font-medium ${done ? 'text-slate-400 line-through' : 'text-[#0F2B3D]'}`}>
          {step.title}
        </span>
        {step.scheduled_date && !done && (
          <span className="ml-2 text-xs text-slate-400">
            {new Date(step.scheduled_date + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
          </span>
        )}
        {done && step.completed_at && (
          <span className="ml-2 text-xs text-emerald-500">
            {new Date(step.completed_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })} tarihinde tamamlandı
          </span>
        )}
      </div>
    </button>
  )
}

// ---- Yeni Takip Modalı ----
function NewFollowupModal({
  patientId,
  onClose,
  onSuccess,
}: {
  patientId: number
  onClose: () => void
  onSuccess: (f: Followup) => void
}) {
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [steps, setSteps] = useState<{ title: string; scheduled_date: string }[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [isPending, startTransition] = useTransition()

  const applyTemplate = (templateName: string) => {
    const t = TEMPLATES.find((x) => x.name === templateName)
    if (!t) return
    setSelectedTemplate(templateName)
    setTitle(templateName)
    setSteps(t.steps.map((s) => ({ title: s, scheduled_date: '' })))
  }

  const addStep = () => setSteps((prev) => [...prev, { title: '', scheduled_date: '' }])
  const removeStep = (idx: number) => setSteps((prev) => prev.filter((_, i) => i !== idx))
  const updateStep = (idx: number, field: 'title' | 'scheduled_date', value: string) =>
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    startTransition(async () => {
      const res = await createFollowup(
        patientId,
        title.trim(),
        startDate,
        notes.trim() || null,
        steps.map((s, i) => ({ title: s.title, scheduled_date: s.scheduled_date || null, step_order: i }))
      )
      if (res?.error) { toast.error(res.error); return }
      if (res?.data) onSuccess(res.data)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Başlık */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-[#0F2B3D]">Yeni Takip Planı</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form içeriği */}
        <form id="new-followup-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Şablon seçimi */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Şablon (isteğe bağlı)</label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => applyTemplate(t.name)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                    selectedTemplate === t.name
                      ? 'bg-[#2DD4BF] text-white border-[#2DD4BF]'
                      : 'border-slate-200 text-slate-500 hover:border-[#2DD4BF] hover:text-[#2DD4BF]'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Takip adı */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Takip Adı <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Örn: İmplant Takibi – Haziran 2026"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#2DD4BF] focus:outline-none"
            />
          </div>

          {/* Tarih + Not */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Başlangıç Tarihi</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#2DD4BF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Not (isteğe bağlı)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Kısa not..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#2DD4BF] focus:outline-none"
              />
            </div>
          </div>

          {/* Adımlar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500">Adımlar</label>
              <button
                type="button"
                onClick={addStep}
                className="text-xs font-semibold text-[#2DD4BF] hover:text-[#26b8a5] transition-colors"
              >
                + Adım Ekle
              </button>
            </div>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-400">{idx + 1}</span>
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => updateStep(idx, 'title', e.target.value)}
                    placeholder="Adım başlığı"
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-[#2DD4BF] focus:outline-none"
                  />
                  <input
                    type="date"
                    value={step.scheduled_date}
                    onChange={(e) => updateStep(idx, 'scheduled_date', e.target.value)}
                    className="w-32 shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-[#2DD4BF] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    aria-label="Adımı kaldır"
                    className="shrink-0 text-slate-300 hover:text-red-400 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
              {steps.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
                  Şablon seçin veya adım ekleyin
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Butonlar */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
          >
            İptal
          </button>
          <button
            type="submit"
            form="new-followup-form"
            disabled={isPending || !title.trim()}
            className="rounded-xl bg-[#2DD4BF] px-5 py-2 text-sm font-bold text-white hover:bg-[#26b8a5] disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}
