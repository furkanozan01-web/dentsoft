'use client'
/* eslint-disable @next/next/no-img-element -- private signed Storage URLs are short-lived */

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import { categoryLabel, SOCIAL_CATEGORIES } from '../constants'
import type { PatientImageSource, SocialAsset, SocialPatient } from '../types'
import { createSocialAssetAction, deleteSocialAssetAction } from '../actions/social-actions'

interface Props {
  assets: SocialAsset[]
  patients: SocialPatient[]
  patientImages: PatientImageSource[]
  researchPatientIds: number[]
  onChanged: () => void
}

export default function MediaLibrary({ assets, patients, patientImages, researchPatientIds, onChanged }: Props) {
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [pending, startTransition] = useTransition()
  const filtered = assets.filter((asset) =>
    (!category || asset.category === category) &&
    (!search || `${asset.file_name} ${asset.caption ?? ''}`.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')))
  )
  const scopedPatients = researchPatientIds.length
    ? patients.filter((patient) => researchPatientIds.includes(patient.id))
    : patients

  const remove = async (asset: SocialAsset) => {
    const accepted = await confirm({ title: 'Medyayı Sil', message: 'Bu medya sosyal medya kütüphanesinden kaldırılacak.', confirmText: 'Sil' })
    if (!accepted) return
    startTransition(async () => {
      const response = await deleteSocialAssetAction(asset.id)
      if (response.error) toast.error(response.error)
      else { toast.success('Medya kaldırıldı'); onChanged() }
    })
  }

  return (
    <section>
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-5 py-4 md:flex-row md:items-center">
        <div><h2 className="text-sm font-black text-[#142536]">Medya Kütüphanesi</h2><p className="mt-1 text-xs font-semibold text-slate-400">{filtered.length} içerik</p></div>
        <div className="flex flex-1 flex-wrap gap-2 md:justify-end">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Dosya veya açıklama ara" className="h-9 min-w-48 flex-1 rounded-md border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#2DD4BF] md:max-w-64" />
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 outline-none focus:border-[#2DD4BF]"><option value="">Tüm kategoriler</option>{SOCIAL_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <button type="button" onClick={() => setShowForm(true)} className="h-9 rounded-md bg-[#0F766E] px-3 text-xs font-black text-white transition hover:bg-[#115E59]">Medya Ekle</button>
        </div>
      </div>

      {researchPatientIds.length > 0 && <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-2.5 text-xs font-bold text-emerald-700">Araştırmadan seçilen {scopedPatients.length} hastanın görüntüleri hazır.</div>}

      <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filtered.map((asset) => {
          const consentValid = hasValidConsent(asset)
          return <article key={asset.id} className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md">
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
              {asset.signedUrl && isVideo(asset) ? <video src={asset.signedUrl} controls preload="metadata" className="h-full w-full object-cover" /> : asset.signedUrl ? <img src={asset.signedUrl} alt={asset.file_name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">Önizleme yok</div>}
              <div className="absolute left-2 top-2 flex flex-wrap gap-1"><span className="rounded bg-white/95 px-2 py-1 text-[9px] font-black text-[#142536] shadow-sm">{categoryLabel(asset.category)}</span>{asset.patient_related && <span className={`rounded px-2 py-1 text-[9px] font-black text-white shadow-sm ${consentValid ? 'bg-emerald-600' : 'bg-red-600'}`}>{consentValid ? 'ONAMLI' : 'ONAM EKSİK'}</span>}</div>
              <button type="button" onClick={() => remove(asset)} disabled={pending} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-base font-black text-slate-500 shadow-sm transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40" title="Medyayı sil" aria-label={`${asset.file_name} medyasını sil`}>×</button>
            </div>
            <div className="p-3"><p className="truncate text-xs font-black text-[#142536]" title={asset.file_name}>{asset.file_name}</p><p className="mt-1 line-clamp-2 min-h-8 text-[11px] font-semibold leading-4 text-slate-400">{asset.caption || (asset.patient ? `${asset.patient.name} ${asset.patient.surname}` : 'Klinik içeriği')}</p><div className="mt-3 flex flex-wrap gap-1">{asset.identity_visible && <Badge>Kimlik görünür</Badge>}{asset.face_visible && <Badge>Yüz görünür</Badge>}{asset.is_before_after && <Badge>Öncesi/sonrası</Badge>}</div></div>
          </article>
        })}
      </div>
      {filtered.length === 0 && <div className="flex min-h-72 items-center justify-center p-8 text-center"><div><p className="text-sm font-black text-[#142536]">Medya bulunamadı</p><p className="mt-1 text-xs font-semibold text-slate-400">Yeni medya ekleyin veya filtreyi değiştirin.</p></div></div>}

      {showForm && <AssetForm patients={scopedPatients} patientImages={patientImages} researchPatientIds={researchPatientIds} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); onChanged() }} />}
    </section>
  )
}

function AssetForm({ patients, patientImages, researchPatientIds, onClose, onSaved }: { patients: SocialPatient[]; patientImages: PatientImageSource[]; researchPatientIds: number[]; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<'source' | 'upload'>('source')
  const [patientRelated, setPatientRelated] = useState(true)
  const [patientId, setPatientId] = useState('')
  const [sourceImageId, setSourceImageId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState('informative')
  const [caption, setCaption] = useState('')
  const [identityVisible, setIdentityVisible] = useState(false)
  const [faceVisible, setFaceVisible] = useState(false)
  const [beforeAfter, setBeforeAfter] = useState(false)
  const [pending, startTransition] = useTransition()
  const images = useMemo(() => patientImages.filter((image) => (!patientId || image.patient_id === Number(patientId)) && (!researchPatientIds.length || researchPatientIds.includes(image.patient_id))), [patientImages, patientId, researchPatientIds])

  const save = () => startTransition(async () => {
    const data = new FormData()
    data.set('patient_related', String(patientRelated))
    if (patientId) data.set('patient_id', patientId)
    if (mode === 'source' && sourceImageId) data.set('source_image_id', sourceImageId)
    if (mode === 'upload' && file) data.set('file', file)
    data.set('category', category)
    data.set('caption', caption)
    data.set('identity_visible', String(identityVisible))
    data.set('face_visible', String(faceVisible))
    data.set('is_before_after', String(beforeAfter))
    const response = await createSocialAssetAction(data)
    if (response.error) { toast.error(response.error); return }
    toast.success('Medya kütüphaneye eklendi')
    onSaved()
  })

  return <Modal title="Medya Ekle" onClose={onClose}>
    <div className="space-y-4">
      <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1"><ModeButton active={mode === 'source'} onClick={() => { setMode('source'); setPatientRelated(true) }}>Hasta görüntüsü</ModeButton><ModeButton active={mode === 'upload'} onClick={() => setMode('upload')}>Yeni yükleme</ModeButton></div>
      {mode === 'upload' && <label className="flex items-center justify-between rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-xs font-bold text-slate-500"><span>{file?.name || 'Görsel veya MP4 seçin'}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="max-w-44 text-[10px]" /></label>}
      {mode === 'upload' && <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={patientRelated} onChange={(event) => setPatientRelated(event.target.checked)} className="accent-[#0F766E]" />Hasta ile ilişkili</label>}
      {patientRelated && <Field label="Hasta"><select value={patientId} onChange={(event) => { setPatientId(event.target.value); setSourceImageId('') }} className={control}><option value="">Hasta seçin</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} {patient.surname}</option>)}</select></Field>}
      {mode === 'source' && <Field label="Hasta görüntüsü"><div className="grid max-h-52 grid-cols-3 gap-2 overflow-y-auto rounded-md border border-slate-200 p-2">{images.map((image) => <button key={image.id} type="button" onClick={() => { setSourceImageId(String(image.id)); setPatientId(String(image.patient_id)) }} className={`overflow-hidden rounded-md border-2 text-left ${sourceImageId === String(image.id) ? 'border-[#0F766E]' : 'border-transparent'}`}>{image.signedUrl ? <img src={image.signedUrl} alt={image.file_name} className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-slate-100" />}<span className="block truncate px-1 py-1 text-[9px] font-bold text-slate-500">{image.file_name}</span></button>)}{images.length === 0 && <p className="col-span-3 py-8 text-center text-xs font-semibold text-slate-400">Görüntü bulunamadı</p>}</div></Field>}
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Kategori"><select value={category} onChange={(event) => setCategory(event.target.value)} className={control}>{SOCIAL_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Açıklama"><input value={caption} onChange={(event) => setCaption(event.target.value)} className={control} /></Field></div>
      {patientRelated && <div className="grid grid-cols-3 gap-2"><Check label="Kimlik görünür" checked={identityVisible} onChange={setIdentityVisible} /><Check label="Yüz görünür" checked={faceVisible} onChange={setFaceVisible} /><Check label="Öncesi/sonrası" checked={beforeAfter} onChange={setBeforeAfter} /></div>}
      {patientRelated && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold leading-5 text-amber-800">Aktif sosyal medya onamı yoksa medya kütüphaneye eklenir ancak içerik paketlerinde kullanılamaz.</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="h-9 rounded-md border border-slate-200 px-3 text-xs font-black text-slate-500">İptal</button><button type="button" onClick={save} disabled={pending} className="h-9 rounded-md bg-[#142536] px-4 text-xs font-black text-white disabled:opacity-50">{pending ? 'Kaydediliyor...' : 'Kaydet'}</button></div>
    </div>
  </Modal>
}

function hasValidConsent(asset: SocialAsset) { const today = new Date().toISOString().slice(0, 10); return !asset.patient_related || Boolean(asset.publish_eligible && asset.consent?.status === 'active' && asset.consent.consent_date <= today && (!asset.consent.expires_at || asset.consent.expires_at >= today)) }
function isVideo(asset: SocialAsset) { return asset.mime_type === 'video/mp4' || asset.file_name.toLowerCase().endsWith('.mp4') }
function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded bg-slate-100 px-1.5 py-1 text-[9px] font-black text-slate-500">{children}</span> }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-200 px-2 text-[10px] font-bold text-slate-600"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-[#0F766E]" />{label}</label> }
function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`h-9 rounded text-xs font-black transition ${active ? 'bg-white text-[#142536] shadow-sm' : 'text-slate-400'}`}>{children}</button> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase text-slate-400">{label}</span>{children}</label> }
const control = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-[#142536] outline-none focus:border-[#2DD4BF]'
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F2B3D]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-md border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h3 className="text-base font-black text-[#142536]">{title}</h3><button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-xl font-bold text-slate-400 hover:bg-slate-100" aria-label="Kapat">×</button></div><div className="p-5">{children}</div></div></div> }
