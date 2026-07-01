'use client'

import { useState, useEffect, useMemo, useActionState, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmModal'
import {
  deleteTariffItem,
  importTdb2024,
  importTufanbeyli,
  syncTdbProfile,
  copyTariffProfile,
  deleteTariffProfile,
  renameTariffProfile,
  setDefaultProfile,
  toggleTariffItemActive,
  updateTariffItemPrice,
  updateTariffItemDuration,
  updateTariffItemColor,
  addTariffItemToProfile,
} from './actions'
import type { TariffProfile } from './actions'
import { fmtPrice } from './helpers'
import { BulkPriceModal, PriceHistoryModal, TariffCards, TreatmentVisual, VISUAL_SCHEMAS, inferTariffVisual } from './TariffEnhancements'
import { SummaryLine, SettingsIconBox, UserStatCard, IconClipboard, IconCheckCircle, IconPlus, IconInfo, IconCalendar } from './SettingsSharedUI'
import type { Branch, Tariff, TariffPriceHistory, R } from './types'

export default function TarifeTab({
  tariffProfiles,
  tariffs,
  onChanged,
  branches,
  history,
}: {
  tariffProfiles: TariffProfile[]
  tariffs: Tariff[]
  onChanged: () => void
  branches: Branch[]
  history: TariffPriceHistory[]
}) {
  const [activeProfileId, setActiveProfileId] = useState<number | null>(
    tariffProfiles.find((p) => p.is_default)?.id ?? tariffProfiles[0]?.id ?? null
  )
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'passive'>('all')
  const [editingPrice, setEditingPrice] = useState<{ id: number; val: string } | null>(null)
  const [editingDuration, setEditingDuration] = useState<{ id: number; val: string } | null>(null)
  const [showCopy, setShowCopy] = useState(false)
  const [copyName, setCopyName] = useState('')
  const [showRename, setShowRename] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [showAddItem, setShowAddItem] = useState<string | null>(null) // category name
  const [showAddProfile, setShowAddProfile] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list')
  const [showBulk, setShowBulk] = useState(false)
  const [historyItem, setHistoryItem] = useState<Tariff | null>(null)
  const [transition, startTransition] = useTransition()
  const confirm = useConfirm()

  const [importState, importAction, importPending] = useActionState(importTdb2024, null as R)
  const [tufanState, tufanAction, tufanPending] = useActionState(importTufanbeyli, null as R)
  const [syncState, syncAction, syncPending] = useActionState(syncTdbProfile, null as R)
  const [copyState, copyAction, copyPending] = useActionState(copyTariffProfile, null as R)
  const [delProfileState, delProfileAction, delProfilePending] = useActionState(deleteTariffProfile, null as R)
  const [renameState, renameAction, renamePending] = useActionState(renameTariffProfile, null as R)
  const [defaultState, defaultAction, defaultPending] = useActionState(setDefaultProfile, null as R)
  const [addItemState, addItemAction, addItemPending] = useActionState(addTariffItemToProfile, null as R)

  useEffect(() => {
    if ((importState as R)?.success) onChanged()
  }, [importState, onChanged])
  useEffect(() => {
    if ((tufanState as R)?.success) onChanged()
  }, [tufanState, onChanged])
  useEffect(() => {
    if ((syncState as R)?.success) onChanged()
  }, [syncState, onChanged])
  useEffect(() => {
    if ((copyState as R)?.success) {
      queueMicrotask(() => {
        setShowCopy(false)
        setCopyName('')
        onChanged()
      })
    }
  }, [copyState, onChanged])
  useEffect(() => {
    if ((delProfileState as R)?.success) {
      queueMicrotask(() => {
        setActiveProfileId(tariffProfiles[0]?.id ?? null)
        onChanged()
      })
    }
  }, [delProfileState, tariffProfiles, onChanged])
  useEffect(() => {
    if ((renameState as R)?.success) {
      queueMicrotask(() => {
        setShowRename(false)
        onChanged()
      })
    }
  }, [renameState, onChanged])
  useEffect(() => {
    if ((defaultState as R)?.success) onChanged()
  }, [defaultState, onChanged])
  useEffect(() => {
    if ((addItemState as R)?.success) {
      queueMicrotask(() => {
        setShowAddItem(null)
        onChanged()
      })
    }
  }, [addItemState, onChanged])

  const activeProfile = tariffProfiles.find((p) => p.id === activeProfileId) ?? null

  const profileItems = useMemo(
    () => tariffs.filter((t) => t.profile_id === activeProfileId),
    [tariffs, activeProfileId],
  )

  const filtered = useMemo(() => {
    let items = profileItems
    if (filterStatus === 'active') items = items.filter((t) => t.is_active)
    if (filterStatus === 'passive') items = items.filter((t) => !t.is_active)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (t) =>
          t.treatment_name.toLowerCase().includes(q) ||
          (t.treatment_code?.toLowerCase().includes(q) ?? false),
      )
    }
    return items
  }, [profileItems, filterStatus, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Tariff[]>()
    for (const t of filtered) {
      const cat = t.category ?? 'Diğer'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(t)
    }
    return map
  }, [filtered])

  const handleToggle = (itemId: number) => {
    startTransition(async () => {
      const res = await toggleTariffItemActive(itemId)
      if (res?.error) toast.error(res.error)
      else onChanged()
    })
  }

  const handlePriceSave = (item: Tariff) => {
    if (!editingPrice) return
    const raw = editingPrice.val.replace(',', '.').replace(/[^0-9.]/g, '')
    const priceKurus = Math.round(parseFloat(raw || '0') * 100)
    if (priceKurus < 0) return
    startTransition(async () => {
      const res = await updateTariffItemPrice(item.id, priceKurus)
      if (res?.error) toast.error(res.error)
      else { setEditingPrice(null); onChanged() }
    })
  }

  const handleDurationSave = (item: Tariff) => {
    if (!editingDuration) return
    const mins = parseInt(editingDuration.val, 10)
    const val = isNaN(mins) || mins <= 0 ? null : mins
    startTransition(async () => {
      const res = await updateTariffItemDuration(item.id, val)
      if (res?.error) toast.error(res.error)
      else { setEditingDuration(null); onChanged() }
    })
  }

  const handleColorSave = (item: Tariff, color: string) => {
    startTransition(async () => {
      const res = await updateTariffItemColor(item.id, color)
      if (res?.error) toast.error(res.error)
      else onChanged()
    })
  }

  const handleDeleteItem = async (item: Tariff) => {
    const ok = await confirm({ title: 'Kalemi Sil', message: `"${item.treatment_name}" tarifeden kaldırılacak. Emin misiniz?`, confirmText: 'Evet, Sil' })
    if (!ok) return
    const fd = new FormData()
    fd.set('id', String(item.id))
    startTransition(async () => {
      const res = await deleteTariffItem(null, fd)
      if (res?.error) toast.error(res.error)
      else { toast.success('Kalem silindi'); onChanged() }
    })
  }

  const activeCount = profileItems.filter((t) => t.is_active).length
  const latestUpdate = activeProfile?.last_synced_at
    ? new Date(activeProfile.last_synced_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Henüz yok'
  const categoryStats = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of profileItems) {
      const key = item.category ?? 'Diğer'
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [profileItems])

  return (
    <div className="space-y-6">
      {/* Profil sekmeleri */}
      <div className="flex items-center gap-3 flex-wrap">
        {tariffProfiles.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveProfileId(p.id)}
            className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition ${
              p.id === activeProfileId
                ? 'border-[#142536] bg-[linear-gradient(135deg,#142536,#1EAEA0)] text-white shadow-[0_10px_24px_rgba(20,37,54,0.14)]'
                : 'border-[#E7ECF2] bg-white text-slate-500 hover:border-[#5FD3C1] hover:text-[#142536]'
            }`}
          >
            {p.source === 'tdb' && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
            )}
            {p.name}
            {p.is_default && (
              <span className="text-[10px] bg-[#2DD4BF]/20 text-[#0F2B3D] px-1.5 py-0.5 rounded-md">Varsayılan</span>
            )}
          </button>
        ))}
        <button
          onClick={() => setShowAddProfile(true)}
          className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-400 transition hover:border-[#5FD3C1] hover:text-[#0F766E]"
        >
          <IconPlus />
          Tarife Ekle
        </button>
      </div>

      {activeProfile && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <UserStatCard title="Toplam Tedavi" value={profileItems.length} tone="blue" icon={<IconClipboard />} />
          <UserStatCard title="Aktif Tedavi" value={activeCount} tone="green" icon={<IconCheckCircle />} />
          <TariffDateCard title="Son Güncelleme" value={latestUpdate} icon={<IconCalendar />} />
        </div>
      )}

      {/* Profil yoksa boş durum */}
      {tariffProfiles.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center space-y-4">
          <p className="text-sm text-gray-400">Henüz tarife profili yok.</p>
          <div className="flex justify-center gap-3">
            <form action={importAction}>
              <button type="submit" disabled={importPending} className="px-4 py-2 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] transition-colors disabled:opacity-60">
                {importPending ? 'Aktarılıyor…' : 'TDB 2024 Tarifesini İçe Aktar'}
              </button>
            </form>
            <form action={tufanAction}>
              <button type="submit" disabled={tufanPending} className="px-4 py-2 border border-gray-200 text-[#0F2B3D] text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60">
                {tufanPending ? 'Aktarılıyor…' : 'Tufanbeyli Tarifesini İçe Aktar'}
              </button>
            </form>
          </div>
          {(importState as R)?.error && <p className="text-sm text-red-600">{(importState as R)!.error}</p>}
          {(tufanState as R)?.error && <p className="text-sm text-red-600">{(tufanState as R)!.error}</p>}
        </div>
      )}

      {/* Aktif profil içeriği */}
      {activeProfile && (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <div className="space-y-6">
          {/* Profil başlığı + aksiyonlar */}
          <div className="rounded-[24px] border border-slate-200/90 bg-white px-6 py-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-[#142536]">{activeProfile.name}</span>
                  {activeProfile.source === 'tdb' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">TDB {activeProfile.tdb_year}</span>
                  )}
                  {activeProfile.source === 'custom' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">Özel Tarife</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {profileItems.length} tedavi · {activeCount} aktif
                  {activeProfile.last_synced_at && (
                    <> · Son güncelleme: {new Date(activeProfile.last_synced_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {/* TDB ise yenile butonu */}
              {activeProfile.source === 'tdb' && (
                <form action={syncAction}>
                  <input type="hidden" name="profile_id" value={activeProfile.id} />
                  <button type="submit" disabled={syncPending}
                    onClick={(e) => { if (!window.confirm('TDB tarifesi yenilenecek. Mevcut fiyatlar ve aktif/pasif durumları sıfırlanacak. Devam edilsin mi?')) e.preventDefault() }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-600 text-xs font-semibold rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-60"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    {syncPending ? 'Yenileniyor…' : 'TDB\'yi Yenile'}
                  </button>
                </form>
              )}
              {/* Kopyala */}
              <button onClick={() => { setCopyName(`${activeProfile.name} Kopyası`); setShowCopy(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-[#0F2B3D] text-xs font-medium rounded-xl hover:bg-gray-50 transition-colors">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Kopyala
              </button>
              {/* Yeniden adlandır */}
              <button onClick={() => { setRenameName(activeProfile.name); setShowRename(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-[#0F2B3D] text-xs font-medium rounded-xl hover:bg-gray-50 transition-colors">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Yeniden Adlandır
              </button>
              {/* Varsayılan yap */}
              {!activeProfile.is_default && (
                <form action={defaultAction}>
                  <input type="hidden" name="profile_id" value={activeProfile.id} />
                  <button type="submit" disabled={defaultPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-[#0F2B3D] text-xs font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60">
                    Varsayılan Yap
                  </button>
                </form>
              )}
              {/* Sil */}
              <form action={delProfileAction}>
                <input type="hidden" name="profile_id" value={activeProfile.id} />
                <button type="submit" disabled={delProfilePending}
                  onClick={(e) => { if (!window.confirm(`"${activeProfile.name}" tarifesi tüm kalemleriyle silinecek. Emin misiniz?`)) e.preventDefault() }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-100 text-red-500 text-xs font-medium rounded-xl hover:bg-red-50 transition-colors disabled:opacity-60">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  Sil
                </button>
              </form>
            </div>
          </div>

          {/* Filtre ve arama */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><IconSearch /></span>
              <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tedavi adı veya kod ara…"
              className="h-12 w-full rounded-2xl border border-[#E7ECF2] bg-white pl-10 pr-4 text-sm font-semibold text-[#142536] outline-none transition focus:border-[#5FD3C1] focus:ring-4 focus:ring-[#5FD3C1]/15"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="h-12 rounded-2xl border border-[#E7ECF2] bg-white px-4 text-sm font-bold text-[#142536] outline-none transition focus:border-[#5FD3C1] focus:ring-4 focus:ring-[#5FD3C1]/15"
            >
              <option value="all">Tümü ({profileItems.length})</option>
              <option value="active">Aktif ({activeCount})</option>
              <option value="passive">Pasif ({profileItems.length - activeCount})</option>
            </select>
            <div className="flex h-12 items-center rounded-2xl border border-[#E7ECF2] bg-white p-1">
              <button onClick={() => setViewMode('list')} className={`h-9 rounded-xl px-3 text-xs font-black ${viewMode === 'list' ? 'bg-[#142536] text-white' : 'text-slate-400'}`}>Liste</button>
              <button onClick={() => setViewMode('cards')} className={`h-9 rounded-xl px-3 text-xs font-black ${viewMode === 'cards' ? 'bg-[#142536] text-white' : 'text-slate-400'}`}>Kartlar</button>
            </div>
            <button onClick={() => setShowBulk(true)} className="h-12 rounded-2xl bg-[#1EAEA0] px-5 text-sm font-black text-white shadow-sm hover:bg-[#178F84]">Toplu Fiyat Değiştir</button>
          </div>

          {viewMode === 'cards' && <TariffCards items={filtered} branches={branches} onHistory={setHistoryItem} />}

          {/* Tarife grupları */}
          {grouped.size === 0 && (
            <div className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-[#FAFBFC] px-8 text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#0F766E] shadow-[0_10px_24px_rgba(15,23,42,0.06)]"><IconClipboard /></span>
                <h3 className="text-sm font-black text-[#142536]">{search ? 'Arama sonucu yok.' : 'Bu tarifede henüz tedavi yok.'}</h3>
                <p className="mt-1 max-w-md text-xs font-semibold leading-5 text-slate-400">Tedavi ekleyerek bu tarife için ücret listesini oluşturmaya başlayabilirsiniz.</p>
              </div>
            </div>
          )}

          {viewMode === 'list' && [...grouped.entries()].map(([category, items]) => (
            <div key={category} className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-[#0F2B3D] uppercase tracking-wide">{category}</h3>
                  <span className="text-xs text-gray-400 bg-white border border-gray-100 px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <button
                  onClick={() => setShowAddItem(showAddItem === category ? null : category)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#2DD4BF] border border-[#2DD4BF]/40 rounded-lg hover:bg-[#2DD4BF]/10 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Ekle
                </button>
              </div>

              {/* İnline ekleme formu */}
              {showAddItem === category && (
                <form action={addItemAction} className="flex items-end gap-2 px-5 py-3 bg-[#2DD4BF]/5 border-b border-[#2DD4BF]/20">
                  <input type="hidden" name="profile_id" value={activeProfile.id} />
                  <input type="hidden" name="category" value={category} />
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Tedavi Adı *</label>
                    <input name="treatment_name" required placeholder="Örn: Dolgu" className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
                  </div>
                  <div className="w-28">
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Kod</label>
                    <input name="treatment_code" placeholder="08-999" className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
                  </div>
                  <div className="w-28">
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Fiyat (KDV dahil)</label>
                    <input name="price" required placeholder="500" className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
                  </div>
                  <div className="w-16">
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Renk</label>
                    <input name="color" type="color" defaultValue="#B5EAD7" className="h-8 w-full rounded-lg border border-gray-200 cursor-pointer" />
                  </div>
                  <div className="w-36">
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Tedavi Şeması</label>
                    <select name="visual_schema" className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs">{VISUAL_SCHEMAS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
                  </div>
                  <div className="w-28"><label className="block text-[10px] font-medium text-gray-400 mb-1">Uygulama Bölgesi</label><input name="application_region" placeholder="Tek diş" className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs" /></div>
                  <div className="w-20"><label className="block text-[10px] font-medium text-gray-400 mb-1">KDV (%)</label><input name="vat_rate" type="number" min="0" max="100" defaultValue="0" className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs" /></div>
                  <input type="hidden" name="vat_included" value="true" />
                  <div className="w-28"><label className="block text-[10px] font-medium text-gray-400 mb-1">Şube</label><select name="branch_id" className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"><option value="">Tüm klinik</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
                  <div className="w-20">
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Para Birimi</label>
                    <select name="currency" className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none">
                      <option>TRY</option>
                      <option>EUR</option>
                      <option>USD</option>
                    </select>
                  </div>
                  <button type="submit" disabled={addItemPending}
                    className="px-3 py-1.5 bg-[#2DD4BF] text-[#0F2B3D] text-xs font-semibold rounded-lg hover:bg-[#26b8a5] transition-colors disabled:opacity-60">
                    {addItemPending ? '…' : 'Ekle'}
                  </button>
                  <button type="button" onClick={() => setShowAddItem(null)}
                    className="px-2.5 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50 transition-colors">
                    İptal
                  </button>
                  {(addItemState as R)?.error && (
                    <span className="text-xs text-red-500">{(addItemState as R)!.error}</span>
                  )}
                </form>
              )}

              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="w-10 px-4 py-2.5" />
                    <th className="text-left px-4 py-2.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Tedavi</th>
                    <th className="text-left px-3 py-2.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Renk</th>
                    <th className="text-left px-3 py-2.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wide hidden md:table-cell">Kod</th>
                    <th className="text-right px-3 py-2.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wide hidden lg:table-cell">Süre</th>
                    <th className="text-right px-4 py-2.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Ücret (KDV dahil)</th>
                    <th className="w-10 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id} className={`border-b border-gray-50 last:border-0 transition-colors ${t.is_active ? '' : 'opacity-50'}`}>
                      {/* Aktif/pasif toggle */}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggle(t.id)}
                          disabled={transition}
                          title={t.is_active ? 'Pasif yap' : 'Aktif yap'}
                          className={`w-8 h-5 rounded-full transition-colors relative flex-shrink-0 ${t.is_active ? 'bg-[#2DD4BF]' : 'bg-gray-200'} disabled:cursor-not-allowed`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${t.is_active ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-[#0F2B3D] text-sm"><div className="flex items-center gap-3"><TreatmentVisual schema={inferTariffVisual(t)} className="h-11 w-14 flex-none rounded-xl"/><div><p className="font-bold">{t.treatment_name}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-400">{t.application_region || 'Bölge belirtilmedi'} · KDV %{t.vat_rate} {t.vat_included ? 'dahil' : 'hariç'}</p></div></div></td>
                      <td className="px-3 py-3">
                        <input
                          type="color"
                          value={t.color ?? '#B5EAD7'}
                          onChange={(e) => handleColorSave(t, e.target.value)}
                          disabled={transition}
                          className="h-7 w-10 rounded-lg border border-gray-200 cursor-pointer disabled:opacity-50"
                          title="Renk kodu"
                        />
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-400 hidden md:table-cell font-mono">{t.treatment_code ?? '—'}</td>
                      {/* Süre — tıklanınca input */}
                      <td className="px-3 py-3 text-right hidden lg:table-cell">
                        {editingDuration?.id === t.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              autoFocus
                              type="number"
                              min={1}
                              step={5}
                              value={editingDuration.val}
                              onChange={(e) => setEditingDuration({ id: t.id, val: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleDurationSave(t)
                                if (e.key === 'Escape') setEditingDuration(null)
                              }}
                              onBlur={() => handleDurationSave(t)}
                              className="w-16 px-2 py-1 text-sm text-right border border-[#2DD4BF] rounded-lg focus:outline-none"
                            />
                            <span className="text-xs text-gray-400">dk</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingDuration({ id: t.id, val: String(t.duration_minutes ?? '') })}
                            className="text-xs text-gray-400 hover:text-[#2DD4BF] transition-colors cursor-pointer group"
                            title="Süre düzenle"
                          >
                            {t.duration_minutes ? `${t.duration_minutes} dk` : '—'}
                            <span className="ml-1 opacity-0 group-hover:opacity-100 text-[10px] text-[#2DD4BF]">✎</span>
                          </button>
                        )}
                      </td>
                      {/* Fiyat — tıklanınca input */}
                      <td className="px-4 py-3 text-right">
                        {editingPrice?.id === t.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-gray-400">{t.currency}</span>
                            <input
                              autoFocus
                              value={editingPrice.val}
                              onChange={(e) => setEditingPrice({ id: t.id, val: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handlePriceSave(t)
                                if (e.key === 'Escape') setEditingPrice(null)
                              }}
                              onBlur={() => handlePriceSave(t)}
                              className="w-24 px-2 py-1 text-sm text-right border border-[#2DD4BF] rounded-lg focus:outline-none"
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingPrice({ id: t.id, val: String(t.price / 100) })}
                            className="font-semibold text-[#0F2B3D] hover:text-[#2DD4BF] transition-colors cursor-pointer group"
                            title="Fiyatı düzenle"
                          >
                            {fmtPrice(t.price, t.currency)}
                            <span className="ml-1 opacity-0 group-hover:opacity-100 text-[10px] text-[#2DD4BF]">✎</span>
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => setHistoryItem(t)} className="mb-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#138B7E]" title="Fiyat geçmişi">↻</button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(t)}
                          disabled={transition}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-red-300 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                          title="Sil"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
            </div>
            <aside className="space-y-6">
              <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
                <div className="mb-5 flex items-start gap-3">
                  <SettingsIconBox><IconClipboard /></SettingsIconBox>
                  <div>
                    <h3 className="text-base font-black text-[#142536]">Tarife Özeti</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-400">Seçili tarifenin kısa durumu</p>
                  </div>
                </div>
                <SummaryLine label="Tarife türü" value={activeProfile.source === 'tdb' ? `TDB ${activeProfile.tdb_year ?? ''}` : 'Özel Tarife'} />
                <SummaryLine label="Varsayılan" value={activeProfile.is_default ? 'Evet' : 'Hayır'} />
                <SummaryLine label="Tedavi sayısı" value={String(profileItems.length)} />
                <SummaryLine label="Aktif tedavi" value={String(activeCount)} />
                <SummaryLine label="Son güncelleme" value={latestUpdate} />
              </section>

              <section className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
                <h3 className="text-base font-black text-[#142536]">Kategori Dağılımı</h3>
                <div className="mt-4 space-y-3">
                  {categoryStats.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-300 bg-[#FAFBFC] px-4 py-6 text-center text-xs font-semibold text-slate-400">Henüz kategori verisi yok.</p>
                  ) : categoryStats.slice(0, 6).map(([name, count]) => (
                    <div key={name}>
                      <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500"><span>{name}</span><span>{count}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#E7ECF2]"><div className="h-full rounded-full bg-[#5FD3C1]" style={{ width: `${Math.max(8, Math.round((count / Math.max(profileItems.length, 1)) * 100))}%` }} /></div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[24px] border border-[#E7ECF2] bg-[#F8FAFC] p-5">
                <div className="flex items-start gap-3 text-slate-600">
                  <IconInfo />
                  <div className="space-y-2 text-xs font-semibold leading-5">
                    <p>TDB tarifesini kopyalayarak özel tarife oluşturabilirsiniz.</p>
                    <p>Varsayılan tarife randevu ve tedavi ekleme ekranlarında kullanılır.</p>
                    <p>Pasif tedaviler işlem listesinde görünmez.</p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}

      {/* Yeni tarife ekleme modal (TDB + Tufanbeyli import veya boş) */}
      {showAddProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddProfile(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#0F2B3D]">Tarife Ekle</h2>
            {(importState as R)?.error && <p className="text-sm text-red-600">{(importState as R)!.error}</p>}
            {(tufanState as R)?.error && <p className="text-sm text-red-600">{(tufanState as R)!.error}</p>}
            <div className="space-y-2">
              <form action={importAction}>
                <button type="submit" disabled={importPending}
                  className="w-full px-4 py-3 flex items-center gap-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60 text-left">
                  <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-600">TDB</span>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#0F2B3D]">TDB 2024 Tarifesi</p>
                    <p className="text-xs text-gray-400">8 kategori, ~160 işlem — Asgari ücret tarifesi</p>
                  </div>
                </button>
              </form>
              <form action={tufanAction}>
                <button type="submit" disabled={tufanPending}
                  className="w-full px-4 py-3 flex items-center gap-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60 text-left">
                  <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-emerald-600">TFN</span>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#0F2B3D]">Tufanbeyli Tarifesi</p>
                    <p className="text-xs text-gray-400">49 işlem — Klinik özel tarife</p>
                  </div>
                </button>
              </form>
            </div>
            <button type="button" onClick={() => setShowAddProfile(false)}
              className="w-full px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Kopyala modal */}
      {showCopy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCopy(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#0F2B3D]">Tarifeyi Kopyala</h2>
            <p className="text-sm text-gray-500">Tüm tedaviler yeni bir tarife olarak kopyalanır.</p>
            <form action={copyAction} className="space-y-3">
              <input type="hidden" name="source_id" value={activeProfile?.id} />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Yeni Tarife Adı</label>
                <input
                  name="new_name"
                  value={copyName}
                  onChange={(e) => setCopyName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30"
                />
              </div>
              {(copyState as R)?.error && <p className="text-sm text-red-600">{(copyState as R)!.error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCopy(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                  İptal
                </button>
                <button type="submit" disabled={copyPending}
                  className="flex-1 px-4 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] transition-colors disabled:opacity-60">
                  {copyPending ? 'Kopyalanıyor…' : 'Kopyala'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Yeniden adlandır modal */}
      {showRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRename(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#0F2B3D]">Yeniden Adlandır</h2>
            <form action={renameAction} className="space-y-3">
              <input type="hidden" name="profile_id" value={activeProfile?.id} />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Tarife Adı</label>
                <input
                  name="name"
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30"
                />
              </div>
              {(renameState as R)?.error && <p className="text-sm text-red-600">{(renameState as R)!.error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowRename(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                  İptal
                </button>
                <button type="submit" disabled={renamePending}
                  className="flex-1 px-4 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] transition-colors disabled:opacity-60">
                  {renamePending ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showBulk && activeProfile && <BulkPriceModal profileId={activeProfile.id} items={profileItems} branches={branches} onClose={() => setShowBulk(false)} onChanged={onChanged} />}
      {historyItem && <PriceHistoryModal item={historyItem} history={history} onClose={() => setHistoryItem(null)} />}
    </div>
  )
}


function IconSearch() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
}

function TariffDateCard({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-[#E7ECF2] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">{icon}</span>
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-sm font-black text-[#142536]">{value}</p>
    </div>
  )
}
