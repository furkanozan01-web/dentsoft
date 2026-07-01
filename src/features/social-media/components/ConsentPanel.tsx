'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SOCIAL_PLATFORMS } from '../constants'
import type { MediaConsent, SocialPatient } from '../types'
import { createConsentAction, updateConsentStatusAction } from '../actions/social-actions'

export default function ConsentPanel({ consents, patients, onChanged }: { consents: MediaConsent[]; patients: SocialPatient[]; onChanged: () => void }) {
  const [patientId, setPatientId] = useState('')
  const [consentDate, setConsentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [expiresAt, setExpiresAt] = useState('')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [document, setDocument] = useState<File | null>(null)
  const [pending, startTransition] = useTransition()

  const togglePlatform = (platform: string) => setPlatforms((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform])
  const save = () => startTransition(async () => {
    const data = new FormData()
    data.set('patient_id', patientId)
    data.set('consent_date', consentDate)
    data.set('expires_at', expiresAt)
    data.set('notes', notes)
    platforms.forEach((platform) => data.append('platforms', platform))
    if (document) data.set('document', document)
    const response = await createConsentAction(data)
    if (response.error) { toast.error(response.error); return }
    setPatientId(''); setExpiresAt(''); setPlatforms([]); setNotes(''); setDocument(null)
    toast.success('Sosyal medya onamı kaydedildi')
    onChanged()
  })

  const changeStatus = (id: number, status: 'active' | 'revoked') => startTransition(async () => {
    const response = await updateConsentStatusAction(id, status)
    if (response.error) { toast.error(response.error); return }
    toast.success(status === 'revoked' ? 'Onam geri çekildi' : 'Onam yeniden etkinleştirildi')
    onChanged()
  })

  return <div className="grid min-h-[620px] lg:grid-cols-[360px_minmax(0,1fr)]">
    <section className="border-b border-slate-200 bg-white p-5 lg:border-r lg:border-b-0">
      <h2 className="text-sm font-black text-[#142536]">Yeni Hasta Onamı</h2>
      <div className="mt-5 space-y-4">
        <Field label="Hasta"><select value={patientId} onChange={(event) => setPatientId(event.target.value)} className={control}><option value="">Hasta seçin</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} {patient.surname}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Onam tarihi"><input type="date" value={consentDate} onChange={(event) => setConsentDate(event.target.value)} className={control} /></Field><Field label="Geçerlilik sonu"><input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className={control} /></Field></div>
        <Field label="Platform kapsamı"><div className="grid grid-cols-2 gap-2">{SOCIAL_PLATFORMS.map((platform) => <label key={platform} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-2 text-[10px] font-bold ${platforms.includes(platform) ? 'border-[#2DD4BF] bg-[#E9FBF8] text-[#0F766E]' : 'border-slate-200 text-slate-500'}`}><input type="checkbox" checked={platforms.includes(platform)} onChange={() => togglePlatform(platform)} className="accent-[#0F766E]" />{platform}</label>)}</div></Field>
        <Field label="Onam belgesi"><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setDocument(event.target.files?.[0] ?? null)} className="block w-full rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-[10px] font-bold text-slate-500" /></Field>
        <Field label="Not"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={`${control} h-auto py-2`} /></Field>
        <button type="button" onClick={save} disabled={pending || !patientId || !consentDate} className="h-10 w-full rounded-md bg-[#142536] text-xs font-black text-white disabled:opacity-40">{pending ? 'Kaydediliyor...' : 'Onamı Kaydet'}</button>
      </div>
    </section>

    <section className="min-w-0 bg-[#F8FAFC] p-5">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-black text-[#142536]">Onam Kayıtları</h2><p className="mt-1 text-xs font-semibold text-slate-400">{consents.length} kayıt</p></div><span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black text-emerald-700">KVKK KONTROLLÜ</span></div>
      <div className="space-y-3">
        {consents.map((consent) => { const valid = isValid(consent); return <article key={consent.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><p className="text-sm font-black text-[#142536]">{consent.patient ? `${consent.patient.name} ${consent.patient.surname}` : 'Hasta'}</p><span className={`rounded px-1.5 py-1 text-[9px] font-black ${valid ? 'bg-emerald-50 text-emerald-700' : consent.status === 'revoked' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{valid ? 'AKTİF' : consent.status === 'revoked' ? 'GERİ ÇEKİLDİ' : 'SÜRESİ DOLDU'}</span></div><p className="mt-1 text-[11px] font-semibold text-slate-400">{formatDate(consent.consent_date)}{consent.expires_at ? ` - ${formatDate(consent.expires_at)}` : ' - Süresiz'}</p></div><div className="flex gap-2">{consent.documentUrl && <a href={consent.documentUrl} target="_blank" rel="noreferrer" className="h-8 rounded-md border border-slate-200 px-2.5 py-2 text-[10px] font-black text-[#0F766E]">Belge</a>}<button type="button" onClick={() => changeStatus(consent.id, consent.status === 'revoked' ? 'active' : 'revoked')} disabled={pending} className={`h-8 rounded-md border px-2.5 text-[10px] font-black ${consent.status === 'revoked' ? 'border-emerald-200 text-emerald-700' : 'border-red-200 text-red-600'}`}>{consent.status === 'revoked' ? 'Etkinleştir' : 'Geri Çek'}</button></div></div>{consent.platforms.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{consent.platforms.map((platform) => <span key={platform} className="rounded bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">{platform}</span>)}</div>}{consent.notes && <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{consent.notes}</p>}</article> })}
        {consents.length === 0 && <div className="flex min-h-60 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-center"><div><p className="text-sm font-black text-[#142536]">Onam kaydı yok</p><p className="mt-1 text-xs font-semibold text-slate-400">Hasta medyası paketlerde kullanılamaz.</p></div></div>}
      </div>
    </section>
  </div>
}

function isValid(consent: MediaConsent) { const today = new Date().toISOString().slice(0, 10); return consent.status === 'active' && consent.consent_date <= today && (!consent.expires_at || consent.expires_at >= today) }
function formatDate(value: string) { return new Intl.DateTimeFormat('tr-TR').format(new Date(`${value}T00:00:00`)) }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase text-slate-400">{label}</span>{children}</label> }
const control = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-[#142536] outline-none focus:border-[#2DD4BF]'

