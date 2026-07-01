'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DEFAULT_RESEARCH_FILTERS } from '../filters/defaults'
import type { ResearchDoctor, ResearchFilters, ResearchResult, ResearchTag, SavedResearch } from '../types'
import { assignTagAction, createTagAction, deleteSavedResearchAction, runResearchAction, saveResearchAction } from '../actions/research-actions'
import ResearchFilterPanel from './ResearchFilterPanel'
import ResearchResults from './ResearchResults'

interface Props {
  initialResults: ResearchResult[]
  initialSaved: SavedResearch[]
  initialTags: ResearchTag[]
  doctors: ResearchDoctor[]
}

export default function ResearchClient({ initialResults, initialSaved, initialTags, doctors }: Props) {
  const router = useRouter()
  const [filters, setFilters] = useState<ResearchFilters>(DEFAULT_RESEARCH_FILTERS)
  const [results, setResults] = useState(initialResults)
  const [saved, setSaved] = useState(initialSaved)
  const [tags, setTags] = useState(initialTags)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [tagId, setTagId] = useState('')
  const [saveName, setSaveName] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#0F766E')
  const [showSave, setShowSave] = useState(false)
  const [showTag, setShowTag] = useState(false)
  const [pending, startTransition] = useTransition()
  const [tagging, startTagTransition] = useTransition()

  const selection = useMemo(
    () => (selected.size ? results.filter((result) => selected.has(result.id)) : results),
    [results, selected]
  )

  const run = () => startTransition(async () => {
    const response = await runResearchAction(filters)
    if (response.error) {
      toast.error(response.error)
      return
    }
    setResults(response.data ?? [])
    setSelected(new Set())
  })

  const loadSaved = (item: SavedResearch) => {
    setFilters(item.filters)
    startTransition(async () => {
      const response = await runResearchAction(item.filters)
      if (response.error) {
        toast.error(response.error)
        return
      }
      setResults(response.data ?? [])
      setSelected(new Set())
    })
  }

  const save = () => startTransition(async () => {
    const response = await saveResearchAction(saveName, filters)
    if (response.error) {
      toast.error(response.error)
      return
    }
    if (response.data) setSaved((current) => [response.data!, ...current])
    setSaveName('')
    setShowSave(false)
    toast.success('Araştırma kaydedildi')
  })

  const removeSaved = (id: number) => startTransition(async () => {
    const response = await deleteSavedResearchAction(id)
    if (response.error) {
      toast.error(response.error)
      return
    }
    setSaved((current) => current.filter((item) => item.id !== id))
  })

  const createTag = () => startTagTransition(async () => {
    const response = await createTagAction(newTagName, newTagColor)
    if (response.error) {
      toast.error(response.error)
      return
    }
    if (response.data) setTags((current) => [...current, response.data!].sort((a, b) => a.name.localeCompare(b.name, 'tr-TR')))
    setNewTagName('')
    setShowTag(false)
    toast.success('Etiket oluşturuldu')
  })

  const applyTag = () => startTagTransition(async () => {
    const response = await assignTagAction(Number(tagId), Array.from(selected))
    if (response.error) {
      toast.error(response.error)
      return
    }
    const tag = tags.find((item) => item.id === Number(tagId))
    if (tag) setResults((current) => current.map((item) => selected.has(item.id) && !item.tags.some((currentTag) => currentTag.id === tag.id) ? { ...item, tags: [...item.tags, tag] } : item))
    toast.success(`${response.data ?? 0} hasta etiketlendi`)
  })

  const exportCsv = () => {
    if (!selection.length) return toast.error('Dışa aktarılacak hasta bulunamadı.')
    const rows = selection.map((item) => [
      `${item.name} ${item.surname}`, item.age ?? '', item.phone ?? '', item.lastVisit ?? '',
      item.treatmentSummary.join(' | '), item.doctors.join(' | '), (item.balance / 100).toFixed(2), item.tags.map((tag) => tag.name).join(' | '),
    ])
    const csv = '\uFEFF' + [['Hasta', 'Yaş', 'Telefon', 'Son Ziyaret', 'Tedaviler', 'Hekimler', 'Kalan Borç TL', 'Etiketler'], ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `dentsoft-arastirma-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const transferToSocial = () => {
    if (!selection.length) return toast.error('Aktarılacak hasta bulunamadı.')
    sessionStorage.setItem('dentsoft:research-patient-ids', JSON.stringify(selection.map((item) => item.id)))
    router.push('/social?source=research')
  }

  const toggle = (id: number) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const toggleAll = () => setSelected((current) =>
    results.length && results.every((item) => current.has(item.id))
      ? new Set()
      : new Set(results.map((item) => item.id))
  )

  return (
    <div className="flex min-h-screen flex-col bg-[#F0F4F9]">
      <header className="border-b border-slate-200 bg-white px-5 py-5 lg:px-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div><h1 className="text-2xl font-black tracking-normal text-[#142536]">Araştırma</h1><p className="mt-1 text-sm font-semibold text-slate-400">{results.length} hasta eşleşiyor</p></div>
          <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
            <button type="button" onClick={() => setShowTag((value) => !value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-[#142536] transition hover:border-[#2DD4BF]">Yeni Etiket</button>
            <button type="button" onClick={() => setShowSave((value) => !value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-[#142536] transition hover:border-[#2DD4BF]">Araştırmayı Kaydet</button>
            <button type="button" onClick={exportCsv} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-[#142536] transition hover:border-[#2DD4BF]">CSV Aktar</button>
            <button type="button" onClick={transferToSocial} className="h-10 rounded-md bg-[#0F766E] px-3 text-xs font-black text-white transition hover:bg-[#115E59]">Sosyal Medyaya Aktar</button>
          </div>
        </div>

        {(showSave || showTag) && <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
          {showSave && <div className="flex items-center gap-2"><input value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="Araştırma adı" className="h-9 w-60 rounded-md border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#2DD4BF]" /><button type="button" onClick={save} disabled={pending || !saveName.trim()} className="h-9 rounded-md bg-[#142536] px-3 text-xs font-black text-white disabled:opacity-40">Kaydet</button></div>}
          {showTag && <div className="flex items-center gap-2"><input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="Etiket adı" className="h-9 w-44 rounded-md border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-[#2DD4BF]" /><input type="color" value={newTagColor} onChange={(event) => setNewTagColor(event.target.value)} className="h-9 w-10 cursor-pointer rounded-md border border-slate-200 bg-white p-1" title="Etiket rengi" /><button type="button" onClick={createTag} disabled={tagging || !newTagName.trim()} className="h-9 rounded-md bg-[#142536] px-3 text-xs font-black text-white disabled:opacity-40">Oluştur</button></div>}
        </div>}

        {saved.length > 0 && <div className="mt-4 flex items-center gap-2 overflow-x-auto border-t border-slate-100 pt-4"><span className="shrink-0 text-[10px] font-black uppercase text-slate-400">Kaydedilenler</span>{saved.map((item) => <div key={item.id} className="flex shrink-0 items-center rounded-md border border-slate-200 bg-[#F8FAFC]"><button type="button" onClick={() => loadSaved(item)} className="px-2.5 py-1.5 text-[11px] font-black text-[#142536] hover:text-[#0F766E]">{item.name}</button><button type="button" onClick={() => removeSaved(item.id)} className="border-l border-slate-200 px-2 py-1.5 text-xs font-black text-slate-400 hover:text-red-600" title="Kaydı sil" aria-label={`${item.name} kaydını sil`}>×</button></div>)}</div>}
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <ResearchFilterPanel filters={filters} doctors={doctors} loading={pending} onChange={setFilters} onRun={run} onReset={() => setFilters(DEFAULT_RESEARCH_FILTERS)} />
        <ResearchResults results={results} selected={selected} tags={tags} tagId={tagId} tagging={tagging} onTagId={setTagId} onToggle={toggle} onToggleAll={toggleAll} onApplyTag={applyTag} />
      </div>
    </div>
  )
}
