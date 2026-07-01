'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { localDateValue } from '@/lib/format'
import { bulkUpdateTariffPrices } from './actions'
import { fmtPrice } from './helpers'
import type { Branch, Tariff, TariffPriceHistory } from './types'

export const VISUAL_SCHEMAS = [
  ['exam', 'Muayene'], ['cleaning', 'Diş taşı temizliği'], ['filling', 'Dolgu'], ['root-canal', 'Kanal tedavisi'],
  ['crown', 'Kaplama / Kron'], ['zirconium', 'Zirkonyum'], ['emax', 'E-max'], ['extraction', 'Diş çekimi'],
  ['surgery', 'Cerrahi işlem'], ['implant', 'İmplant'], ['whitening', 'Beyazlatma'], ['orthodontics', 'Ortodonti'],
  ['prosthesis', 'Protez'], ['removable', 'Hareketli protez'], ['total-prosthesis', 'Total protez'], ['night-guard', 'Gece plağı'],
  ['smile', 'Gülüş tasarımı'], ['pedo', 'Pedodonti'], ['periodontal', 'Periodontal tedavi'],
] as const

const COLORS: Record<string, string> = {
  exam: 'from-teal-50 to-cyan-100 text-teal-700', cleaning: 'from-cyan-50 to-sky-100 text-cyan-700',
  filling: 'from-amber-50 to-orange-100 text-amber-700', 'root-canal': 'from-yellow-50 to-amber-100 text-yellow-700',
  crown: 'from-sky-50 to-blue-100 text-sky-700', zirconium: 'from-slate-50 to-slate-200 text-slate-700',
  emax: 'from-fuchsia-50 to-pink-100 text-fuchsia-700', extraction: 'from-red-50 to-rose-100 text-red-700',
  surgery: 'from-rose-50 to-red-100 text-rose-700', implant: 'from-indigo-50 to-violet-100 text-indigo-700',
  whitening: 'from-white to-cyan-50 text-cyan-600', orthodontics: 'from-purple-50 to-violet-100 text-purple-700',
  prosthesis: 'from-blue-50 to-indigo-100 text-blue-700', removable: 'from-pink-50 to-rose-100 text-pink-700',
  'total-prosthesis': 'from-violet-50 to-purple-100 text-violet-700', 'night-guard': 'from-slate-50 to-blue-100 text-slate-700',
  smile: 'from-pink-50 to-fuchsia-100 text-pink-700', pedo: 'from-lime-50 to-emerald-100 text-lime-700',
  periodontal: 'from-emerald-50 to-teal-100 text-emerald-700',
}

export function inferTariffVisual(item: Pick<Tariff, 'visual_schema' | 'treatment_name' | 'category'>) {
  if (item.visual_schema) return item.visual_schema
  const text = `${item.treatment_name} ${item.category ?? ''}`.toLocaleLowerCase('tr-TR')
  if (/implant|abutment|all-on/.test(text)) return 'implant'
  if (/kanal|endodont|fiber post/.test(text)) return 'root-canal'
  if (/dolgu|inley|onley|restor/.test(text)) return 'filling'
  if (/çekim|gömülü|cerrahi|rezeksiyon|kist|greft|sinüs/.test(text)) return /çekim|gömülü/.test(text) ? 'extraction' : 'surgery'
  if (/zirkonyum/.test(text)) return 'zirconium'
  if (/e-max|emax/.test(text)) return 'emax'
  if (/protez|köprü|porselen|kron|lamina/.test(text)) return 'prosthesis'
  if (/beyaz|ağart/.test(text)) return 'whitening'
  if (/ortodont|plak|aparey|yer tutucu/.test(text)) return 'orthodontics'
  if (/detertraj|diş taşı|periodont|flap/.test(text)) return 'periodontal'
  if (/pedo|süt dişi|fissür|flor/.test(text)) return 'pedo'
  return 'exam'
}

export function TreatmentVisual({ schema, className = '' }: { schema: string | null; className?: string }) {
  const key = schema || 'exam'
  const implant = key === 'implant'
  const ortho = key === 'orthodontics'
  const extraction = key === 'extraction' || key === 'surgery'
  return <div className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${COLORS[key] ?? COLORS.exam} ${className}`} aria-label={VISUAL_SCHEMAS.find(([id]) => id === key)?.[1] ?? 'Tedavi şeması'}>
    <svg viewBox="0 0 96 96" className="h-16 w-16" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M28 15c-10 5-12 18-7 31 4 10 5 35 13 35 7 0 6-21 14-21s7 21 14 21c8 0 9-25 13-35 5-13 3-26-7-31-8-4-13 2-20 2s-12-6-20-2Z" fill="currentColor" fillOpacity=".08"/>
      {implant && <><path d="M48 36v42M39 45h18M40 54h16M41 63h14M43 72h10"/><path d="M37 29h22v9H37z"/></>}
      {ortho && <><path d="M26 45h44"/><rect x="29" y="39" width="12" height="12" rx="2"/><rect x="55" y="39" width="12" height="12" rx="2"/></>}
      {extraction && <><path d="m24 68 48-40M24 28l48 40" strokeWidth="5"/></>}
      {key === 'root-canal' && <path d="M48 32v32m0-14-10 17m10-17 10 17"/>}
      {key === 'filling' && <path d="M35 27c8 5 18 5 26 0l-4 18H39l-4-18Z" fill="currentColor" fillOpacity=".25"/>}
      {key === 'whitening' && <><path d="m72 12 2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z"/><path d="m19 31 1 5 5 1-5 1-1 5-1-5-5-1 5-1 1-5Z"/></>}
    </svg>
  </div>
}

export function TariffCards({ items, branches, onHistory }: { items: Tariff[]; branches: Branch[]; onHistory: (item: Tariff) => void }) {
  return <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{items.map((item) => <article key={item.id} className={`overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${item.is_active ? '' : 'opacity-60'}`}>
    <TreatmentVisual schema={inferTariffVisual(item)} className="h-32 w-full" />
    <div className="p-5">
      <div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-[#E8F8F5] px-2.5 py-1 text-[10px] font-black uppercase text-[#138B7E]">{item.category || 'Diğer'}</span><h3 className="mt-3 font-black text-[#142536]">{item.treatment_name}</h3><p className="mt-1 text-xs font-semibold text-slate-400">{item.treatment_code || 'Kodsuz'} · {item.application_region || 'Bölge belirtilmedi'}</p></div><span className={`h-2.5 w-2.5 rounded-full ${item.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} /></div>
      <div className="mt-5 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase text-slate-400">Güncel fiyat</p><p className="text-xl font-black text-[#142536]">{fmtPrice(item.price, item.currency)}</p><p className="text-[10px] font-bold text-slate-400">KDV %{item.vat_rate} · {item.vat_included ? 'dahil' : 'hariç'}</p></div><button onClick={() => onHistory(item)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 hover:border-[#5FD3C1] hover:text-[#138B7E]">Fiyat geçmişi</button></div>
      <p className="mt-4 border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-400">{item.branch_id ? branches.find((b) => b.id === item.branch_id)?.name ?? 'Şube tarifesi' : 'Tüm klinik'} · {new Date(item.price_updated_at).toLocaleDateString('tr-TR')}</p>
    </div>
  </article>)}</div>
}

function ModalShell({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button aria-label="Kapat" className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={onClose}/><section className={`relative max-h-[92vh] w-full overflow-y-auto rounded-[26px] bg-white shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}><header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5"><h2 className="text-lg font-black text-[#142536]">{title}</h2><button onClick={onClose} className="h-9 w-9 rounded-xl bg-slate-100 font-black">×</button></header>{children}</section></div>
}

export function BulkPriceModal({ profileId, items, branches, onClose, onChanged }: { profileId: number; items: Tariff[]; branches: Branch[]; onClose: () => void; onChanged: () => void }) {
  const [category, setCategory] = useState('')
  const [branch, setBranch] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [direction, setDirection] = useState<'increase'|'decrease'>('increase')
  const [percent, setPercent] = useState('10')
  const [rounding, setRounding] = useState('0')
  const [roundDirection, setRoundDirection] = useState<'nearest'|'up'|'down'>('nearest')
  const [vatMode, setVatMode] = useState<'preserve'|'included'|'excluded'>('preserve')
  const [effectiveDate, setEffectiveDate] = useState(localDateValue())
  const [description, setDescription] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [pending, start] = useTransition()
  const candidates = useMemo(() => items.filter((i) => (!category || i.category === category) && (!branch || i.branch_id === Number(branch)) && (!selected.length || selected.includes(i.id))), [items, category, branch, selected])
  const signed = (direction === 'decrease' ? -1 : 1) * Math.abs(Number(percent) || 0)
  const nextPrice = (price: number) => { const raw = price * (1 + signed / 100); const unit = Number(rounding) * 100; if (!unit) return Math.round(raw); return (roundDirection === 'up' ? Math.ceil(raw / unit) : roundDirection === 'down' ? Math.floor(raw / unit) : Math.round(raw / unit)) * unit }
  const submit = () => start(async () => { const res = await bulkUpdateTariffPrices({ profileId, tariffIds: selected, category: category || null, branchId: branch ? Number(branch) : null, percent: signed, rounding: Number(rounding), roundDirection, vatMode, effectiveDate, description }); if (res?.error) { toast.error(res.error); return } toast.success(`${res?.count ?? candidates.length} tedavinin fiyatı güncellendi`); onClose(); onChanged() })
  const field = 'mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-[#142536] outline-none focus:border-[#5FD3C1]'
  return <ModalShell title="Toplu Fiyat Değiştir" onClose={onClose} wide><div className="grid gap-6 p-6 lg:grid-cols-[330px_1fr]"><div className="space-y-4">
    <label className="block text-xs font-black text-slate-500">Kategori<select value={category} onChange={(e)=>{setCategory(e.target.value);setConfirmed(false)}} className={field}><option value="">Tüm kategoriler</option>{[...new Set(items.map(i=>i.category).filter(Boolean))].map(c=><option key={c!}>{c}</option>)}</select></label>
    <label className="block text-xs font-black text-slate-500">Şube<select value={branch} onChange={(e)=>{setBranch(e.target.value);setConfirmed(false)}} className={field}><option value="">Tüm klinik / şubeler</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    <label className="block text-xs font-black text-slate-500">Seçili tedaviler<select multiple value={selected.map(String)} onChange={(e)=>{setSelected([...e.target.selectedOptions].map(o=>Number(o.value)));setConfirmed(false)}} className="mt-1.5 h-32 w-full rounded-xl border border-slate-200 p-2 text-xs">{items.map(i=><option key={i.id} value={i.id}>{i.treatment_name}</option>)}</select><span className="mt-1 block text-[10px] text-slate-400">Boş bırakılırsa filtreye uyan tüm tedaviler.</span></label>
    <div className="grid grid-cols-2 gap-3"><label className="text-xs font-black text-slate-500">İşlem<select value={direction} onChange={(e)=>{setDirection(e.target.value as typeof direction);setConfirmed(false)}} className={field}><option value="increase">Artır</option><option value="decrease">Azalt</option></select></label><label className="text-xs font-black text-slate-500">Oran (%)<input type="number" min="0.01" step="0.01" value={percent} onChange={(e)=>{setPercent(e.target.value);setConfirmed(false)}} className={field}/></label></div>
    <div className="grid grid-cols-2 gap-3"><label className="text-xs font-black text-slate-500">Yuvarlama<select value={rounding} onChange={(e)=>{setRounding(e.target.value);setConfirmed(false)}} className={field}><option value="0">Yok</option><option value="10">10 TL</option><option value="50">50 TL</option><option value="100">100 TL</option><option value="500">500 TL</option></select></label><label className="text-xs font-black text-slate-500">Yön<select value={roundDirection} onChange={(e)=>{setRoundDirection(e.target.value as typeof roundDirection);setConfirmed(false)}} className={field}><option value="nearest">En yakın</option><option value="up">Yukarı</option><option value="down">Aşağı</option></select></label></div>
    <label className="block text-xs font-black text-slate-500">KDV işlemi<select value={vatMode} onChange={(e)=>setVatMode(e.target.value as typeof vatMode)} className={field}><option value="preserve">Mevcut durumu koru</option><option value="included">KDV dahil</option><option value="excluded">KDV hariç</option></select></label>
    <label className="block text-xs font-black text-slate-500">Geçerlilik tarihi<input type="date" value={effectiveDate} onChange={(e)=>setEffectiveDate(e.target.value)} className={field}/></label><label className="block text-xs font-black text-slate-500">Açıklama<textarea value={description} onChange={(e)=>setDescription(e.target.value)} className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm"/></label>
  </div><div><div className="mb-3 flex items-center justify-between"><div><h3 className="font-black text-[#142536]">Fiyat ön izlemesi</h3><p className="text-xs font-semibold text-slate-400">Onaydan önce {candidates.length} kalemi kontrol edin.</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${signed >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>%{signed}</span></div><div className="max-h-[560px] overflow-auto rounded-2xl border border-slate-200"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-50"><tr>{['Tedavi','Kategori','Eski','Yeni','Fark','KDV'].map(h=><th key={h} className="px-3 py-3 text-left font-black text-slate-400">{h}</th>)}</tr></thead><tbody>{candidates.map(i=>{const next=nextPrice(i.price);return <tr key={i.id} className="border-t border-slate-100"><td className="px-3 py-3 font-bold text-slate-700">{i.treatment_name}</td><td className="px-3 py-3 text-slate-400">{i.category}</td><td className="px-3 py-3">{fmtPrice(i.price,i.currency)}</td><td className="px-3 py-3 font-black text-[#138B7E]">{fmtPrice(next,i.currency)}</td><td className="px-3 py-3">{fmtPrice(next-i.price,i.currency)}</td><td className="px-3 py-3">%{i.vat_rate} {i.vat_included?'D':'H'}</td></tr>})}</tbody></table></div><label className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-xs font-bold text-slate-600"><input type="checkbox" checked={confirmed} onChange={(e)=>setConfirmed(e.target.checked)} className="h-4 w-4"/>Ön izlemeyi kontrol ettim ve fiyat değişikliklerini onaylıyorum.</label><button disabled={!confirmed || pending || !candidates.length || !signed} onClick={submit} className="mt-3 h-12 w-full rounded-2xl bg-[#142536] font-black text-white disabled:opacity-40">{pending?'Güncelleniyor…':'Değişiklikleri Uygula'}</button></div></div></ModalShell>
}

export function PriceHistoryModal({ item, history, onClose }: { item: Tariff; history: TariffPriceHistory[]; onClose: () => void }) {
  const rows = history.filter(h=>h.tariff_id===item.id)
  return <ModalShell title={`${item.treatment_name} · Fiyat Geçmişi`} onClose={onClose}><div className="p-6">{rows.length===0?<p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-400">Henüz fiyat değişikliği yok.</p>:<div className="space-y-3">{rows.map(row=><div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-black text-[#142536]">{fmtPrice(row.old_price,item.currency)} → {fmtPrice(row.new_price,item.currency)}</p><p className="mt-1 text-xs font-semibold text-slate-400">{row.changed_by_name || 'Yetkili kullanıcı'} · {new Date(row.changed_at).toLocaleString('tr-TR')}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${row.change_rate>=0?'bg-emerald-50 text-emerald-600':'bg-red-50 text-red-600'}`}>{row.change_rate>=0?'+':''}%{Number(row.change_rate).toFixed(2)}</span></div><div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-xs text-slate-500"><span>Geçerlilik: {new Date(`${row.effective_date}T12:00:00`).toLocaleDateString('tr-TR')}</span><span>{row.description || 'Açıklama yok'}</span></div></div>)}</div>}</div></ModalShell>
}
