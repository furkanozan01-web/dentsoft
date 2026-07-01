'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MediaConsent, PatientImageSource, SocialAsset, SocialPackage, SocialPatient } from '../types'
import MediaLibrary from './MediaLibrary'
import ConsentPanel from './ConsentPanel'
import PackagePanel from './PackagePanel'

type Tab = 'media' | 'packages' | 'consents'

export default function SocialMediaClient({ assets, consents, packages, patients, patientImages }: { assets: SocialAsset[]; consents: MediaConsent[]; packages: SocialPackage[]; patients: SocialPatient[]; patientImages: PatientImageSource[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('media')
  const [researchPatientIds, setResearchPatientIds] = useState<number[]>([])

  useEffect(() => {
    try {
      const value = sessionStorage.getItem('dentsoft:research-patient-ids')
      const parsed = value ? JSON.parse(value) : []
      if (Array.isArray(parsed)) {
        queueMicrotask(() => setResearchPatientIds(parsed.filter(Number.isInteger)))
      }
    } catch {
      queueMicrotask(() => setResearchPatientIds([]))
    }
  }, [])

  const clearResearchSelection = () => {
    sessionStorage.removeItem('dentsoft:research-patient-ids')
    setResearchPatientIds([])
  }

  return <div className="min-h-screen bg-[#F0F4F9]">
    <header className="border-b border-slate-200 bg-white px-5 pt-5 lg:px-7">
      <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-black tracking-normal text-[#142536]">Sosyal Medya</h1><p className="mt-1 text-sm font-semibold text-slate-400">İçerik, medya ve hasta onam yönetimi</p></div><div className="flex gap-2"><span className="rounded-md border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-[10px] font-black text-slate-500">{assets.length} MEDYA</span><span className="rounded-md border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-[10px] font-black text-slate-500">{packages.length} PAKET</span></div></div>
      {researchPatientIds.length > 0 && <div className="mb-3 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><span>Araştırmadan {researchPatientIds.length} hasta seçildi.</span><button type="button" onClick={clearResearchSelection} className="font-black text-emerald-800">Temizle</button></div>}
      <nav className="flex gap-6 overflow-x-auto">{([['media', 'Medya Kütüphanesi'], ['packages', 'İçerik Paketleri'], ['consents', 'KVKK / Hasta Onamı']] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`relative whitespace-nowrap py-3 text-xs font-black ${tab === key ? 'text-[#142536] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#2DD4BF]' : 'text-slate-400 hover:text-slate-600'}`}>{label}</button>)}</nav>
    </header>
    <main>{tab === 'media' && <MediaLibrary assets={assets} patients={patients} patientImages={patientImages} researchPatientIds={researchPatientIds} onChanged={() => router.refresh()} />}{tab === 'packages' && <PackagePanel packages={packages} assets={assets} onChanged={() => router.refresh()} />}{tab === 'consents' && <ConsentPanel consents={consents} patients={patients} onChanged={() => router.refresh()} />}</main>
  </div>
}
