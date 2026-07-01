'use client'
/* eslint-disable @next/next/no-img-element -- private signed Storage URLs are short-lived */

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { categoryLabel, PACKAGE_STATUSES, SOCIAL_PLATFORMS, statusLabel } from '../constants'
import type { SocialAsset, SocialPackage } from '../types'
import { createContentPackageAction, updatePackageStatusAction } from '../actions/social-actions'

export default function PackagePanel({ packages, assets, onChanged }: { packages: SocialPackage[]; assets: SocialAsset[]; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [pending, startTransition] = useTransition()
  const eligibleAssets = useMemo(() => assets.filter(hasValidConsent), [assets])

  const changeStatus = (id: number, status: string) => startTransition(async () => {
    const response = await updatePackageStatusAction(id, status)
    if (response.error) { toast.error(response.error); return }
    toast.success('İçerik durumu güncellendi')
    onChanged()
  })

  return <section>
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><div><h2 className="text-sm font-black text-[#142536]">İçerik Paketleri</h2><p className="mt-1 text-xs font-semibold text-slate-400">{packages.length} paket · {eligibleAssets.length} uygun medya</p></div><button type="button" onClick={() => setShowForm(true)} className="h-9 rounded-md bg-[#0F766E] px-3 text-xs font-black text-white">Yeni Paket</button></div>
    <div className="grid gap-4 p-5 xl:grid-cols-2">
      {packages.map((item) => <article key={item.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-black text-[#142536]">{item.title}</h3><Status value={item.status} /></div><p className="mt-1 text-[11px] font-semibold text-slate-400">{item.items.length} medya · {item.platforms.join(', ') || 'Platform seçilmedi'}</p></div><select value={item.status} onChange={(event) => changeStatus(item.id, event.target.value)} disabled={pending} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-black text-slate-600 outline-none">{PACKAGE_STATUSES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>{item.description && <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{item.description}</p>}<div className="mt-3 flex gap-2 overflow-x-auto">{item.items.map((entry) => <div key={entry.id} className="flex h-16 w-20 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 text-center text-[9px] font-bold text-slate-500">{entry.asset ? categoryLabel(entry.asset.category) : 'Medya'}</div>)}</div>{item.hashtags.length > 0 && <p className="mt-3 line-clamp-1 text-[10px] font-bold text-[#0F766E]">{item.hashtags.map((tag) => `#${tag}`).join(' ')}</p>}</article>)}
      {packages.length === 0 && <div className="col-span-full flex min-h-72 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-center"><div><p className="text-sm font-black text-[#142536]">İçerik paketi yok</p><p className="mt-1 text-xs font-semibold text-slate-400">Yayın için uygun medyalardan yeni paket oluşturun.</p></div></div>}
    </div>
    {showForm && <PackageForm assets={eligibleAssets} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); onChanged() }} />}
  </section>
}

function PackageForm({ assets, onClose, onSaved }: { assets: SocialAsset[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [publicationNote, setPublicationNote] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [assetIds, setAssetIds] = useState<number[]>([])
  const [pending, startTransition] = useTransition()
  const toggle = (id: number) => setAssetIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const togglePlatform = (platform: string) => setPlatforms((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform])
  const save = () => startTransition(async () => {
    const response = await createContentPackageAction({ title, description, hashtags, platforms, publicationNote, scheduledFor, assetIds })
    if (response.error) { toast.error(response.error); return }
    toast.success('İçerik paketi oluşturuldu')
    onSaved()
  })
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F2B3D]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-md bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h3 className="text-base font-black text-[#142536]">Yeni İçerik Paketi</h3><button type="button" onClick={onClose} className="h-8 w-8 rounded-full text-xl font-bold text-slate-400 hover:bg-slate-100">×</button></div><div className="space-y-4 p-5"><div className="grid gap-3 sm:grid-cols-2"><Field label="Başlık"><input value={title} onChange={(event) => setTitle(event.target.value)} className={control} /></Field><Field label="Planlanan yayın"><input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className={control} /></Field></div><Field label="Açıklama"><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className={`${control} h-auto py-2`} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Hashtagler"><input value={hashtags} onChange={(event) => setHashtags(event.target.value)} placeholder="implant gülüştasarımı" className={control} /></Field><Field label="Yayın notu"><input value={publicationNote} onChange={(event) => setPublicationNote(event.target.value)} className={control} /></Field></div><Field label="Platformlar"><div className="flex flex-wrap gap-2">{SOCIAL_PLATFORMS.map((platform) => <label key={platform} className={`cursor-pointer rounded-md border px-2 py-1.5 text-[10px] font-bold ${platforms.includes(platform) ? 'border-[#2DD4BF] bg-[#E9FBF8] text-[#0F766E]' : 'border-slate-200 text-slate-500'}`}><input type="checkbox" className="sr-only" checked={platforms.includes(platform)} onChange={() => togglePlatform(platform)} />{platform}</label>)}</div></Field><Field label={`Medya seçimi (${assetIds.length})`}><div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto rounded-md border border-slate-200 p-2 sm:grid-cols-4">{assets.map((asset) => <button key={asset.id} type="button" onClick={() => toggle(asset.id)} className={`relative overflow-hidden rounded-md border-2 ${assetIds.includes(asset.id) ? 'border-[#0F766E]' : 'border-transparent'}`}>{asset.signedUrl ? <img src={asset.signedUrl} alt={asset.file_name} className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-slate-100" />}<span className="block truncate px-1 py-1 text-[9px] font-bold text-slate-500">{categoryLabel(asset.category)}</span></button>)}{assets.length === 0 && <p className="col-span-full py-8 text-center text-xs font-semibold text-slate-400">Onamı ve yayın uygunluğu tamamlanmış medya yok.</p>}</div></Field><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="h-9 rounded-md border border-slate-200 px-3 text-xs font-black text-slate-500">İptal</button><button type="button" onClick={save} disabled={pending || !title.trim() || assetIds.length === 0} className="h-9 rounded-md bg-[#142536] px-4 text-xs font-black text-white disabled:opacity-40">{pending ? 'Oluşturuluyor...' : 'Paketi Oluştur'}</button></div></div></div></div>
}

function hasValidConsent(asset: SocialAsset) { const today = new Date().toISOString().slice(0, 10); return asset.publish_eligible && (!asset.patient_related || Boolean(asset.consent?.status === 'active' && asset.consent.consent_date <= today && (!asset.consent.expires_at || asset.consent.expires_at >= today))) }
function Status({ value }: { value: string }) { const style = value === 'published' ? 'bg-emerald-50 text-emerald-700' : value === 'ready' ? 'bg-teal-50 text-teal-700' : value === 'awaiting_approval' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'; return <span className={`rounded px-1.5 py-1 text-[9px] font-black ${style}`}>{statusLabel(value).toLocaleUpperCase('tr-TR')}</span> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase text-slate-400">{label}</span>{children}</label> }
const control = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-[#142536] outline-none focus:border-[#2DD4BF]'
