'use client'

import { useEffect, useState, useTransition } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import {
  addImageMeta,
  addNote,
  deleteImage,
  deleteNote,
  setNoteImportance,
  updateNote,
} from './actions'
import type { ClinicalNote, DoctorOption, Patient, PatientImage } from './types'
import PatientImageAiWorkspace from './PatientImageAiWorkspace'
import { IconClock, IconTrash } from '@/components/icons'

// ---- Not & Görüntü Tab ----
function NotGoruntuTab({
  patient,
  notes,
  images,
  doctors,
  loading,
  supabase,
  clinicId,
  onChanged,
}: {
  patient: Patient
  notes: ClinicalNote[]
  images: PatientImage[]
  doctors: DoctorOption[]
  loading: boolean
  supabase: SupabaseClient
  clinicId: number
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const [noteText, setNoteText] = useState('')
  const [doctorId, setDoctorId] = useState<number | null>(doctors[0]?.id ?? null)
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [urls, setUrls] = useState<Record<number, string>>({})
  const [editingNote, setEditingNote] = useState<{ id: number; text: string } | null>(null)
  const [selectedImageId, setSelectedImageId] = useState<number | null>(images[0]?.id ?? null)
  const [showAiWorkspace, setShowAiWorkspace] = useState(false)
  const uploadId = `patient-image-upload-${patient.id}`
  const selectedImage = images.find((image) => image.id === selectedImageId) ?? images[0] ?? null
  const selectedUrl = selectedImage ? urls[selectedImage.id] : null

  // Private bucket → her görüntü için imzalı URL üret
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (images.length === 0) {
        setUrls({})
        return
      }
      const paths = images.map((im) => im.storage_path)
      const { data } = await supabase.storage
        .from('patient-images')
        .createSignedUrls(paths, 3600)
      if (cancelled || !data) return
      const map: Record<number, string> = {}
      images.forEach((im, i) => {
        const signed = data[i]?.signedUrl
        if (signed) map[im.id] = signed
      })
      setUrls(map)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [images, supabase])

  const saveNote = () => {
    startTransition(async () => {
      const res = await addNote(patient.id, noteText, doctorId)
      if (res.error) toast.error(res.error)
      else {
        setNoteText('')
        toast.success('Not eklendi')
        onChanged()
      }
    })
  }

  const saveEditNote = () => {
    if (!editingNote) return
    startTransition(async () => {
      const res = await updateNote(editingNote.id, editingNote.text)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Not güncellendi')
        setEditingNote(null)
        onChanged()
      }
    })
  }


  const removeNote = async (id: number) => {
    const ok = await confirm({
      title: 'Notu Sil',
      message: 'Bu klinik not kalıcı olarak silinecek. Emin misiniz?',
      confirmText: 'Evet, Sil',
    })
    if (!ok) return
    startTransition(async () => {
      const res = await deleteNote(id)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Not silindi')
        onChanged()
      }
    })
  }

  const toggleNoteImportance = (note: ClinicalNote) => {
    startTransition(async () => {
      const nextImportant = !note.is_important
      const res = await setNoteImportance(note.id, nextImportant)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(nextImportant ? 'Not önemli olarak işaretlendi' : 'Önem işareti kaldırıldı')
      onChanged()
    })
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    let uploadedCount = 0
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${clinicId}/${patient.id}/${Date.now()}-${safe}`
        const { error: upErr } = await supabase.storage
          .from('patient-images')
          .upload(path, file, { upsert: false })
        if (upErr) {
          toast.error(`Yükleme hatası: ${upErr.message}`)
          continue
        }
        const res = await addImageMeta(patient.id, path, file.name)
        if (res.error) {
          await supabase.storage.from('patient-images').remove([path])
          toast.error(res.error)
          continue
        }
        uploadedCount += 1
      }
      if (uploadedCount > 0) {
        toast.success(uploadedCount === 1 ? 'Görüntü yüklendi' : `${uploadedCount} görüntü yüklendi`)
        onChanged()
      }
    } finally {
      setUploading(false)
    }
  }

  const removeImage = async (id: number) => {
    const ok = await confirm({
      title: 'Görüntüyü Sil',
      message: 'Bu görüntü kalıcı olarak silinecek. Emin misiniz?',
      confirmText: 'Evet, Sil',
    })
    if (!ok) return
    startTransition(async () => {
      const res = await deleteImage(id)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Görüntü silindi')
        onChanged()
      }
    })
  }

  const isPdf = (name: string) => name.toLowerCase().endsWith('.pdf')
  const isImage = (name: string) => /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(name)
  const fmtDate = (value: string) =>
    new Date(value).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="grid gap-6 xl:grid-cols-2">

      {/* Klinik Notlar */}
      <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="mb-[18px] flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#DDF8F4] text-[#0F766E]">
            <IconFileText />
          </span>
          <div>
            <h2 className="text-base font-black text-[#0F2B3D]">Klinik Notlar</h2>
            <p className="mt-0.5 text-xs font-medium text-slate-400">
              Hasta ile ilgili klinik gözlem ve hekim notları
            </p>
          </div>
        </div>

        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Yeni klinik not yazın..."
          className="min-h-[130px] w-full resize-y rounded-[18px] border border-[#E7ECF2] bg-white px-4 py-4 text-sm font-medium text-[#142536] outline-none transition placeholder:text-slate-400 focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
        />
        <p className="mt-2 text-[11px] font-semibold text-slate-400">
          Notlar hasta dosyasında tarih ve hekim bilgisiyle saklanır.
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          {doctors.length > 0 && (
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <IconUserRound />
              </span>
              <select
                value={doctorId ?? ''}
                onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : null)}
                className="h-11 w-full rounded-[14px] border border-[#E7ECF2] bg-white pl-10 pr-3 text-sm font-semibold text-[#0F2B3D] outline-none transition focus:border-[#2DD4BF] focus:shadow-[0_0_0_4px_rgba(45,212,191,0.12)]"
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dt. {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={saveNote}
            disabled={pending || !noteText.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-[18px] text-sm font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
          >
            <IconPlus />
            Not Ekle
          </button>
        </div>

        <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-1 [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin]">
          {loading ? (
            <div className="rounded-[18px] border border-[#E7ECF2] bg-[#FAFBFC] px-4 py-5 text-sm font-semibold text-slate-400">
              Yükleniyor...
            </div>
          ) : notes.length === 0 ? (
            <div className="flex min-h-[210px] flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-[#FAFBFC] px-6 text-center">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E6FFFA] text-[#0F766E]">
                <IconMessageSquare />
              </span>
              <h3 className="text-sm font-black text-[#142536]">Henüz klinik not eklenmemiş.</h3>
              <p className="mt-1 max-w-sm text-xs font-medium text-slate-400">
                Yeni notlar burada zaman sırasına göre görüntülenir.
              </p>
            </div>
          ) : (
            notes.map((n) => (
              <article
                key={n.id}
                className={`group relative rounded-[18px] border p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.06)] ${n.is_important ? 'border-red-200 bg-red-50/60 hover:border-red-300' : 'border-[#E7ECF2] bg-[#FAFBFC] hover:border-[#D9E5EA]'}`}
              >
                <span className={`absolute left-[-10px] top-5 hidden h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[11px] font-black text-white shadow-sm sm:flex ${n.is_important ? 'bg-red-600' : 'bg-[#5FD3C1]'}`}>
                  {n.is_important ? '!' : ''}
                </span>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
                    {n.is_important && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 font-black text-red-700">
                        <IconImportant />
                        Önemli
                      </span>
                    )}
                    <IconClock />
                    <span className="truncate">{fmtDate(n.created_at)}</span>
                  </div>
                  {editingNote?.id !== n.id && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => toggleNoteImportance(n)}
                        disabled={pending}
                        className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-[11px] font-black transition disabled:opacity-40 ${n.is_important ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'text-slate-400 hover:bg-red-50 hover:text-red-600'}`}
                        title={n.is_important ? 'Önem işaretini kaldır' : 'Önemli olarak işaretle'}
                      >
                        <IconImportant />
                        Önemli
                      </button>
                      <button
                        onClick={() => setEditingNote({ id: n.id, text: n.content })}
                        disabled={pending}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-[#E9FBF8] hover:text-[#0F766E] disabled:opacity-40"
                        title="Düzenle"
                      >
                        <IconPencil />
                      </button>
                      <button
                        onClick={() => removeNote(n.id)}
                        disabled={pending}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        title="Sil"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  )}
                </div>

                {editingNote?.id === n.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={editingNote.text}
                      onChange={(e) => setEditingNote({ id: n.id, text: e.target.value })}
                      rows={3}
                      autoFocus
                      className="w-full resize-y rounded-[14px] border border-[#2DD4BF] bg-white px-3 py-2 text-sm font-medium text-[#142536] outline-none shadow-[0_0_0_4px_rgba(45,212,191,0.10)]"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={saveEditNote}
                        disabled={pending || !editingNote.text.trim()}
                        className="rounded-xl bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 py-2 text-xs font-black text-white disabled:opacity-40"
                      >
                        Kaydet
                      </button>
                      <button
                        onClick={() => setEditingNote(null)}
                        className="rounded-xl border border-[#E7ECF2] bg-white px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50"
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-[#142536]">{n.content}</p>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      {/* Röntgen & Görüntüler */}
      <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="mb-[18px] flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF7FF] text-[#0284C7]">
              <IconFolderImage />
            </span>
            <div>
              <h2 className="text-base font-black text-[#0F2B3D]">Röntgen & Görüntüler</h2>
              <p className="mt-0.5 text-xs font-medium text-slate-400">
                Hasta görüntüleri, röntgenler ve klinik dosyalar
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!selectedImage || !selectedUrl} onClick={() => setShowAiWorkspace(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-indigo-600 px-4 text-xs font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"><span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px]">AI</span>Yapay Zeka Analizi</button>
            <a href={selectedUrl ?? undefined} download={selectedImage?.file_name} aria-disabled={!selectedUrl} onClick={(event) => { if (!selectedUrl) event.preventDefault() }} className={`inline-flex h-10 items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-white px-4 text-xs font-black transition ${selectedUrl ? 'text-slate-600 hover:border-[#5FD3C1] hover:text-[#0F766E]' : 'pointer-events-none text-slate-300 opacity-50'}`}><IconDownload/>Resim İndir</a>
            <label htmlFor={uploadId} className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#5FD3C1,#1EAEA0)] px-4 text-xs font-black text-white shadow-[0_10px_20px_rgba(30,174,160,0.18)] transition hover:brightness-105"><IconUpload />{uploading ? 'Yükleniyor...' : 'Yükle'}</label>
          </div>
          <input
            id={uploadId}
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => handleUpload(e.target.files)}
            disabled={uploading}
            className="hidden"
          />
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-[14px] border border-[#E7ECF2] bg-[#F8FAFC] px-3.5 py-3 text-xs font-semibold leading-5 text-slate-500">
          <span className="mt-0.5 text-[#0F766E]">
            <IconShield />
          </span>
          <span>Görüntüler şifreli/özel depolanır. Klinik dışı erişime kapalıdır. Maks. 10 MB.</span>
        </div>

        {loading ? (
          <div className="rounded-[20px] border border-[#E7ECF2] bg-[#FAFBFC] px-4 py-5 text-sm font-semibold text-slate-400">
            Yükleniyor...
          </div>
        ) : images.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-[#FAFBFC] px-6 text-center">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-[#0F766E] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <IconFileImage />
            </span>
            <h3 className="text-sm font-black text-[#142536]">Henüz görüntü yüklenmemiş.</h3>
            <p className="mt-2 max-w-md text-xs font-medium leading-5 text-slate-400">
              Röntgen, panoramik görüntü veya klinik fotoğraflarınızı buradan yükleyebilirsiniz.
            </p>
            <label
              htmlFor={uploadId}
              className="mt-4 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-[#BFEFE8] bg-[#E9FBF8] px-4 text-xs font-black text-[#0F766E] transition hover:bg-[#DDF8F4]"
            >
              <IconUpload />
              Görüntü Yükle
            </label>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {images.map((im) => (
              <article
                key={im.id}
                className={`group overflow-hidden rounded-[18px] border bg-white transition hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(15,23,42,0.08)] ${selectedImage?.id === im.id ? 'border-indigo-500 ring-4 ring-indigo-100' : 'border-[#E7ECF2]'}`}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#F1F5F9]">
                  {isPdf(im.file_name) ? (
                    <a
                      href={urls[im.id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-full flex-col items-center justify-center text-slate-400 transition hover:bg-slate-100"
                    >
                      <IconPdf />
                      <span className="mt-2 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 shadow-sm">
                        PDF
                      </span>
                    </a>
                  ) : urls[im.id] && isImage(im.file_name) ? (
                    <a href={urls[im.id]} target="_blank" rel="noopener noreferrer" className="block h-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={urls[im.id]}
                        alt={im.file_name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    </a>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-slate-300">
                      <IconFileImage />
                      <span className="mt-2 text-xs font-semibold">
                        {urls[im.id] ? 'Önizleme yok' : 'Yükleniyor...'}
                      </span>
                    </div>
                  )}

                  {urls[im.id] && (
                    <a
                      href={urls[im.id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 flex items-center justify-center bg-[#0F2B3D]/0 text-xs font-black text-white opacity-0 transition group-hover:bg-[#0F2B3D]/30 group-hover:opacity-100"
                    >
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-[#0F2B3D] shadow-sm">
                        <IconEye />
                        Görüntüle
                      </span>
                    </a>
                  )}

                  <button
                    onClick={() => removeImage(im.id)}
                    disabled={pending}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-400 shadow-sm transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    title="Sil"
                  >
                    <IconTrash />
                  </button>
                </div>
                <div className="p-3">
                  <p className="truncate text-xs font-black text-[#142536]" title={im.file_name}>
                    {im.file_name}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <IconClock />
                    <span>{fmtDate(im.created_at)}</span>
                  </div>
                  <button type="button" onClick={() => { setSelectedImageId(im.id); setShowAiWorkspace(false) }} className={`mt-3 h-8 w-full rounded-xl text-[10px] font-black transition ${selectedImage?.id === im.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}>{selectedImage?.id === im.id ? 'Seçili Görüntü' : 'Görüntüyü Seç'}</button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#EEF2F6] pt-3 text-[11px] font-bold text-slate-400">
          <span>{images.length} görüntü</span>
          <span>Maks. dosya boyutu: 10 MB</span>
        </div>
        {showAiWorkspace && selectedImage && selectedUrl && <PatientImageAiWorkspace patientId={patient.id} image={selectedImage} signedUrl={selectedUrl} onClose={() => setShowAiWorkspace(false)} />}
      </section>
    </div>
  )
}

function IconFileText() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></svg>
}

function IconMessageSquare() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /><path d="M8 9h8" /><path d="M8 13h5" /></svg>
}

function IconUserRound() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
}

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
}

function IconImportant() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 17h.01" /></svg>
}


function IconPencil() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
}

function IconFolderImage() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="9" cy="13" r="2" /><path d="m21 17-4.5-4.5L10 19" /></svg>
}

function IconUpload() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" /></svg>
}
function IconDownload() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
}

function IconShield() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z" /><path d="m9 12 2 2 4-5" /></svg>
}

function IconFileImage() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><circle cx="10" cy="13" r="2" /><path d="m20 18-3.5-3.5L10 21" /></svg>
}

function IconPdf() {
  return <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 16h1.5a1.5 1.5 0 0 0 0-3H8v5" /><path d="M13 13v5h1.2a2.5 2.5 0 0 0 0-5z" /><path d="M18 13h2" /><path d="M18 16h1.5" /><path d="M18 13v5" /></svg>
}

function IconEye() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
}

export default NotGoruntuTab

