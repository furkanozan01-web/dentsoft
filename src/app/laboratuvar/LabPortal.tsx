'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cleanMoney, localDateValue } from '@/lib/format'
import { addLabEntry, addQuickItem, deleteLabEntry, deleteQuickItem, updateQuickItemPrice } from './actions'

export interface LabEntry {
  id: number
  name: string
  date: string
  amount: number
  quantity: number
  unitPrice: number | null
  paid: number
  note: string | null
  mine: boolean
}
export interface LabQuickItem { id: number; name: string; unit_price: number }

function money(kurus: number) {
  return `₺${(kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function dateText(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('tr-TR')
}
function priceToInput(kurus: number) {
  return (kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const field = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#2DD4BF]'

export function LabSignOut() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => {
        await createClient().auth.signOut()
        router.push('/login')
        router.refresh()
      }}
      className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50"
    >
      Çıkış
    </button>
  )
}

export default function LabPortal({
  labName, userName, entries, quickItems, totalDebt, totalPaid,
}: {
  labName: string
  userName: string
  entries: LabEntry[]
  quickItems: LabQuickItem[]
  totalDebt: number
  totalPaid: number
}) {
  const router = useRouter()
  const [pending, begin] = useTransition()
  const [name, setName] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [date, setDate] = useState(localDateValue())
  const [note, setNote] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')

  const unitKurus = Math.round((Number(cleanMoney(unitPrice)) || 0) * 100)
  const qty = Math.max(0, Math.round(Number(quantity) || 0))
  const total = unitKurus * qty
  const remaining = Math.max(totalDebt - totalPaid, 0)

  const pickItem = (item: LabQuickItem) => {
    setName(item.name)
    setUnitPrice(priceToInput(item.unit_price))
    setQuantity('1')
  }

  const save = () => begin(async () => {
    const res = await addLabEntry({ name, unitPrice, quantity: qty, date, note })
    if (res?.error) { toast.error(res.error); return }
    toast.success(`Hesaba eklendi: ${money(total)}`)
    setName(''); setUnitPrice(''); setQuantity('1'); setNote('')
    router.refresh()
  })

  const removeEntry = (id: number) => begin(async () => {
    const res = await deleteLabEntry(id)
    if (res?.error) toast.error(res.error)
    else { toast.success('Kayıt geri çekildi'); router.refresh() }
  })

  const saveItem = () => begin(async () => {
    const res = await addQuickItem({ name: newItemName, unitPrice: newItemPrice })
    if (res?.error) { toast.error(res.error); return }
    setNewItemName(''); setNewItemPrice('')
    router.refresh()
  })

  const removeItem = (id: number) => begin(async () => {
    const res = await deleteQuickItem(id)
    if (res?.error) toast.error(res.error)
    else router.refresh()
  })

  const editItemPrice = (item: LabQuickItem) => {
    const next = window.prompt(`${item.name} için yeni birim fiyat (₺)`, priceToInput(item.unit_price))
    if (next == null) return
    begin(async () => {
      const res = await updateQuickItemPrice(item.id, next)
      if (res?.error) toast.error(res.error)
      else router.refresh()
    })
  }

  const rows = useMemo(() => entries, [entries])

  return (
    <div className="min-h-screen bg-[#F0F4F9]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Laboratuvar Portalı</p>
            <h1 className="text-xl font-black text-[#142536]">{labName}</h1>
            <p className="text-xs font-semibold text-slate-400">{userName}</p>
          </div>
          <LabSignOut />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <Card label="Toplam bildirilen" value={money(totalDebt)} />
          <Card label="Kliniğin ödediği" value={money(totalPaid)} tone="green" />
          <Card label="Kalan alacağınız" value={money(remaining)} tone="amber" />
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <h2 className="font-black text-[#142536]">Yapılan İşi Bildir</h2>
          <p className="mt-1 text-xs font-semibold text-slate-400">Birim fiyat × adet otomatik hesaplanır ve kliniğin borcuna eklenir. Ödemeyi klinik yapar.</p>

          {quickItems.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {quickItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickItem(item)}
                  className="rounded-full border border-[#BFEFE8] bg-[#E9FBF8] px-3 py-1.5 text-xs font-black text-[#0F766E] hover:bg-[#d8f7f2]"
                >
                  {item.name} · {money(item.unit_price)}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-black text-slate-500 lg:col-span-2">İşlem
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Porselen kron" className={`mt-1.5 ${field}`} />
            </label>
            <label className="text-xs font-black text-slate-500">Birim fiyat (₺)
              <input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} inputMode="decimal" data-money placeholder="0,00" className={`mt-1.5 ${field}`} />
            </label>
            <label className="text-xs font-black text-slate-500">Adet
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" className={`mt-1.5 ${field}`} />
            </label>
            <label className="text-xs font-black text-slate-500">Tarih
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1.5 ${field}`} />
            </label>
            <label className="text-xs font-black text-slate-500 sm:col-span-2">Not (hasta / hekim vb., isteğe bağlı)
              <input value={note} onChange={(e) => setNote(e.target.value)} className={`mt-1.5 ${field}`} />
            </label>
            <div className="flex items-end">
              <div className="w-full rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Toplam</p>
                <p className="text-lg font-black text-[#0F766E]">{money(total)}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={pending || !name.trim() || total <= 0}
              onClick={save}
              className="h-11 rounded-xl bg-[#1EAEA0] px-6 text-sm font-black text-white shadow-lg disabled:opacity-50"
            >
              {pending ? 'Ekleniyor…' : 'Hesaba Ekle'}
            </button>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <h2 className="font-black text-[#142536]">Hızlı Giriş Kalemlerim</h2>
          <p className="mt-1 text-xs font-semibold text-slate-400">Sık yaptığınız işleri birim fiyatıyla kaydedin; yukarıda tek tıkla seçersiniz.</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs font-black text-slate-500">Kalem
              <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Porselen" className={`mt-1.5 w-56 ${field}`} />
            </label>
            <label className="text-xs font-black text-slate-500">Birim fiyat (₺)
              <input value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} inputMode="decimal" data-money placeholder="0,00" className={`mt-1.5 w-36 ${field}`} />
            </label>
            <button type="button" disabled={pending || !newItemName.trim()} onClick={saveItem} className="h-11 rounded-xl border border-[#BFEFE8] bg-[#E9FBF8] px-4 text-xs font-black text-[#0F766E] disabled:opacity-50">+ Kalem Ekle</button>
          </div>
          {quickItems.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100">
              {quickItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="font-bold text-slate-700">{item.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-black text-[#0F766E]">{money(item.unit_price)}</span>
                    <button type="button" onClick={() => editItemPrice(item)} className="text-xs font-black text-slate-400 hover:text-slate-600">Fiyat</button>
                    <button type="button" onClick={() => removeItem(item.id)} className="text-xs font-black text-red-400 hover:text-red-600">Sil</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="font-black text-[#142536]">Bildirdiğiniz İşler</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wide text-slate-400">
                <tr>{['Tarih', 'İşlem', 'Adet', 'Birim fiyat', 'Tutar', 'Ödenen', 'Durum', ''].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center font-semibold text-slate-400">Henüz kayıt yok.</td></tr>
                ) : rows.map((e) => {
                  const done = e.paid >= e.amount
                  const partial = e.paid > 0 && !done
                  return (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-500">{dateText(e.date)}</td>
                      <td className="px-4 py-3 font-bold text-[#142536]">{e.name}{e.note ? <span className="block text-[11px] font-semibold text-slate-400">{e.note}</span> : null}</td>
                      <td className="px-4 py-3 font-semibold text-slate-600">{e.quantity}</td>
                      <td className="px-4 py-3 font-semibold text-slate-600">{e.unitPrice != null ? money(e.unitPrice) : '—'}</td>
                      <td className="px-4 py-3 font-black text-slate-700">{money(e.amount)}</td>
                      <td className="px-4 py-3 font-black text-emerald-600">{money(Math.min(e.paid, e.amount))}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 font-black ${done ? 'bg-emerald-50 text-emerald-700' : partial ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{done ? 'Ödendi' : partial ? 'Kısmen ödendi' : 'Bekliyor'}</span></td>
                      <td className="px-4 py-3 text-right">{e.mine && e.paid === 0 && <button type="button" disabled={pending} onClick={() => removeEntry(e.id)} className="font-black text-red-400 hover:text-red-600">Geri çek</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}

function Card({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'green' | 'amber' }) {
  const cls = tone === 'green' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : 'text-[#142536]'
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-black ${cls}`}>{value}</p>
    </div>
  )
}
