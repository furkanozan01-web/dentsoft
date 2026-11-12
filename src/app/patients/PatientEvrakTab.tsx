'use client'

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getDoctorTc, getPatientTc, updateAnamnesis } from './actions'
import { toTitleCase } from '@/lib/format'
import { usePersistedPreference } from '@/lib/hooks/usePersistedPreference'
import { DISEASES, DISEASE_LABELS, type Anamnesis } from '@/lib/anamnesis'
import type { ClinicInfo, DoctorOption, Patient, Transaction, Treatment } from './types'
import { triggerPrint } from './printTarget'
import { CERRAHI, COCUK, GENEL, RESTO, type DocDef, type DocPart } from './evrakTexts'
import './evrak.css'

type S = Record<string, string | boolean>

/** Anamnez satırı ↔ hasta kartındaki hastalık adları (boş = karttan gelmez, elle işaretlenir) */
const ANAM: { key: string; label: string; from: string[] }[] = DISEASES.map((d) => ({ key: d.key, label: DISEASE_LABELS[d.key] ?? d.key, from: [d.key] }))

type Kept = { k_hekim: string; k_tel: string; k_lehtar: string; k_ltc: string; k_sehir: string; pg_anam: boolean; pg_genel: boolean; pg_cerrahi: boolean; pg_resto: boolean; pg_senet: boolean }
const KEPT_DEFAULT: Kept = { k_hekim: '', k_tel: '', k_lehtar: '', k_ltc: '', k_sehir: '', pg_anam: true, pg_genel: true, pg_cerrahi: false, pg_resto: false, pg_senet: false }

// ───────── yardımcılar (tarih, tutar, yazıyla tutar) ─────────
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = () => iso(new Date())
function addMonths(isoStr: string, n: number) {
  const [y, m, d] = (isoStr || today()).split('-').map(Number)
  const last = new Date(y, m - 1 + n + 1, 0).getDate()
  return iso(new Date(y, m - 1 + n, Math.min(d, last)))
}
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const V = (x: unknown, w = '28mm') => (x && String(x).trim() ? esc(x) : `<span class="blank" style="min-width:${w}"></span>`)
const fd = (i: string) => { if (!i) return ''; const [y, m, d] = i.split('-'); return `${d}.${m}.${y}` }
const tl = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function age(i: string): number | null {
  if (!i) return null
  const b = new Date(i), n = new Date()
  let a = n.getFullYear() - b.getFullYear()
  const m = n.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--
  return a
}
const B = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz']
const O = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan']
const uc = (n: number) => { const y = Math.floor(n / 100), o = Math.floor((n % 100) / 10), b = n % 10; return (y ? (y > 1 ? B[y] : '') + 'yüz' : '') + O[o] + B[b] }
function yazi(n0: number) {
  let n = Math.floor(n0)
  if (!n) return 'sıfır'
  const G = ['', 'bin', 'milyon', 'milyar']
  let out = '', i = 0
  while (n > 0) { const g = n % 1000; if (g) out = ((i === 1 && g === 1) ? '' : uc(g)) + G[i] + out; n = Math.floor(n / 1000); i++ }
  return out
}
function dative(n: string) {
  const w = String(n).trim().toLocaleLowerCase('tr-TR')
  const vs = w.match(/[aeıioöuü]/g)
  if (!vs) return "'e"
  const v = vs[vs.length - 1]
  const s = 'eiöü'.includes(v) ? 'e' : 'a'
  return `'${/[aeıioöuü]$/.test(w) ? 'y' : ''}${s}`
}
function tutarYazi(x: number) {
  const l = Math.floor(x + 1e-9), k = Math.round((x - l) * 100)
  let s = `${yazi(l)} Türk Lirası`
  if (k) s += ` ${yazi(k)} kuruş`
  return s.toLocaleUpperCase('tr-TR')
}

// ───────── sayfa parçaları (kâğıda basılan HTML) ─────────
const str = (s: S, k: string) => String(s[k] ?? '')
function head(s: S, title: string) {
  return `<div class="dh"><div></div><div class="c">${title}</div><div class="r">${esc(s.k_hekim)}<br>${esc(s.k_tel)}</div></div>`
}
function bodyHtml(b: DocPart[]) {
  return b.map(([t, v]) => (t === 'h' ? `<h4>${v}</h4>` : t === 'p' ? `<p>${v}</p>` : `<ul>${(v as string[]).map((x) => `<li>${x}</li>`).join('')}</ul>`)).join('')
}
function signers(s: S, child: boolean) {
  const list: { lbl: string; nm: string; hand: boolean }[] = []
  const yak = str(s, 'v_ad').trim()
  list.push({ lbl: child ? 'Hasta (çocuk)' : 'Hasta', nm: str(s, 'h_ad'), hand: !child })
  if (child || yak) list.push({ lbl: child ? 'Veli / Yasal temsilci' : 'Hasta yakını / Vasi', nm: yak ? str(s, 'v_ad') + (s.v_yak ? ` (${str(s, 'v_yak')})` : '') : '', hand: true })
  list.push({ lbl: 'Hekim', nm: str(s, 'k_hekim'), hand: false })
  return list
}
function sigBlock(s: S, child: boolean, onam: boolean) {
  const rows = signers(s, child).map((p) => `<div class="signer"><div class="who"><b>${p.lbl}</b><span>${esc(p.nm)}</span></div>
   <div class="fill">${onam && p.hand ? '<i>El yazısıyla “Okudum, anladım, kabul ediyorum.” yazınız</i><div class="u"></div>' : ''}</div>
   <div class="fill"><i>İmza</i><div class="u"></div></div></div>`).join('')
  return `<div class="sigs">${onam ? '<div class="nusha">Bu formun bir nüshasını elden aldım.</div>' : ''}${rows}
  <div class="date">Tarih: <span class="mono">${s.h_tarih ? fd(str(s, 'h_tarih')) : '___.___.______'}</span> &nbsp;&nbsp; Saat: ____ : ____</div></div>`
}
function onamPage(s: S, doc: DocDef, child: boolean) {
  return `${head(s, doc.title)}<div class="txt">${bodyHtml(doc.body)}</div><div class="ok">Okudum, anladım, onaylıyorum.</div>${sigBlock(s, child, true)}`
}
function anamPage(s: S, child: boolean, a: number | null) {
  const yn = (on: boolean) => `<span class="yn">E<span class="box ${on ? 'on' : ''}"></span> H<span class="box ${on ? '' : 'on'}"></span></span>`
  const yak = str(s, 'v_ad').trim()
  return `${head(s, 'HASTA KAYIT VE ANAMNEZ FORMU')}
 <div class="blk"><h3 class="dt">Hasta Bilgileri</h3>
 <div class="kv">
  <div class="w2"><b>Ad soyad</b>${V(s.h_ad, '60mm')}</div><div><b>T.C. kimlik no</b><span class="mono">${V(s.h_tc)}</span></div>
  <div><b>Doğum tarihi</b><span class="mono">${s.h_dogum ? fd(str(s, 'h_dogum')) + (a !== null ? ` (${a} yaş)` : '') : V('')}</span></div><div><b>Cinsiyet</b>${V(s.h_cins, '14mm')}</div><div><b>Telefon</b><span class="mono">${V(s.h_tel)}</span></div>
  <div class="w2"><b>Adres</b>${V(s.h_adres, '70mm')}</div><div><b>Meslek</b>${V(s.h_meslek)}</div>
  <div class="w3"><b>Başvuru şikâyeti</b>${V(s.h_sikayet, '120mm')}</div>
  ${(child || yak) ? `<div><b>${child ? 'Veli / yasal temsilci' : 'Hasta yakını / vasi'}</b>${V(s.v_ad)}</div><div><b>Sıfatı · T.C. no</b>${V([s.v_yak, s.v_tc].filter(Boolean).join(' · '))}</div><div><b>Telefon</b><span class="mono">${V(s.v_tel)}</span></div>` : ''}
 </div></div>
 <div class="blk"><h3 class="dt">Tıbbi Öykü (Anamnez)<span>Evet / Hayır</span></h3>
  <div class="anam">${ANAM.map((x) => `<div class="ai"><span>${x.label}</span>${yn(!!s['an_' + x.key])}</div>`).join('')}</div>
  <div class="lines">
   <div class="ln"><b>Kullandığı ilaçlar:</b><span class="v">${esc(s.a_ilac)}</span></div>
   <div class="ln"><b>Alerji ayrıntısı:</b><span class="v">${esc(s.a_alerji)}</span></div>
   <div class="ln"><b>Diğer / açıklama:</b><span class="v">${esc(s.a_diger)}</span></div>
  </div></div>
 <div class="blk"><h3 class="dt">Beyan</h3>
  <p class="t">${child ? 'Çocuğumun sağlık bilgilerini' : 'Yukarıdaki sağlık bilgilerimi'} eksiksiz ve doğru verdiğimi, sağlık durumunda değişiklik olursa hekime bildireceğimi beyan ederim.</p></div>
 ${sigBlock(s, child, false)}`
}
type Acct = {
  rows: { date: string; tooth: string; name: string; list: number; adj: number; fee: number }[]
  original: number
  net: number
  paid: number
  balance: number
  extra: number
}
const money = (kurus: number) => tl(kurus / 100)

/** Bono (kompakt) + altında hastanın hesap özeti ve tedavi dökümü: tek A4 sayfa */
function senetPage(s: S, acct: Acct) {
  const top = parseFloat(str(s, 'p_toplam')) || 0, pes = parseFloat(str(s, 'p_pesin')) || 0, sen = Math.max(0, top - pes)
  const y = s.p_borclu === 'yakin'
  const b = y ? { ad: s.v_ad, tc: s.v_tc, adres: s.v_adres || s.h_adres, tel: s.v_tel } : { ad: s.h_ad, tc: s.h_tc, adres: s.h_adres, tel: s.h_tel }
  const vade = s.p_vade ? fd(str(s, 'p_vade')) : '', lira = Math.floor(sen + 1e-9), kr = Math.round((sen - lira) * 100)
  const k = !!s.p_kefilvar
  const leh = str(s, 'k_lehtar') || str(s, 'k_hekim')
  const lead = top ? `#${tutarYazi(sen)}#` : '<span class="blank" style="min-width:60mm"></span>'
  const bono = `<div class="senet">
  <div class="sn-top"><div><b>Ödeme tarihi</b><span>${vade || '&nbsp;'}</span></div><div><b>Türk Lirası</b><span>${top ? lira.toLocaleString('tr-TR') : '&nbsp;'}</span></div><div><b>Kuruş</b><span>${top ? String(kr).padStart(2, '0') : '&nbsp;'}</span></div><div><b>No</b><span>${s.p_no ? esc(s.p_no) : '&nbsp;'}</span></div></div>
  <div class="sn-h"><h3 class="dt">BONO</h3><span class="nama">NAMA YAZILIDIR</span></div>
  <p class="t">İşbu nama muharrer bonomun mukabilinde <b>${V(vade, '22mm')}</b> tarihinde Sayın <b>${V(leh, '45mm')}</b>${leh ? dative(leh) : ''}${s.k_ltc ? ` (T.C. <span class="mono">${esc(s.k_ltc)}</span>)` : ''} yukarıda yazılı yalnız <b>${lead}</b> kayıtsız ve şartsız ödeyeceğim. İşbu bono emre değildir; ciro yoluyla başkasına devredilemez.</p>
  <div class="sn-ln">
   <div class="ln"><b>Ödeme yeri:</b><span class="v">${esc(s.k_sehir)}</span></div>
   <div class="ln"><b>Düzenleme yeri:</b><span class="v">${esc(s.k_sehir)}</span></div>
   <div class="ln"><b>Düzenleme tarihi:</b><span class="v mono">${s.p_duz ? fd(str(s, 'p_duz')) : ''}</span></div>
  </div>
  <div class="sn-parties">
   <div><div class="hd">Borçlu</div>Ad soyad: ${V(b.ad, '36mm')}<br>T.C. no: <span class="mono">${V(b.tc)}</span><br>Adres: ${V(b.adres, '44mm')}<br>Tel: <span class="mono">${V(b.tel)}</span><br>İmza:</div>
   <div><div class="hd">Aval veren <span class="kn">(düzenleyen lehine aval içindir)</span></div>Ad soyad: ${V(k ? s.kf_ad : '', '36mm')}<br>T.C. no: <span class="mono">${V(k ? s.kf_tc : '')}</span><br>Adres: ${V(k ? s.kf_adres : '', '44mm')}<br>Tel: <span class="mono">${V(k ? s.kf_tel : '')}</span><br>İmza:</div>
  </div></div>`

  const rows = acct.rows.map((r) => `<tr><td>${r.tooth}</td><td>${esc(r.name)}</td><td class="mono">${r.date}</td><td class="num mono"><b>${money(r.fee)}</b></td></tr>`).join('')
  const hesap = `<div class="hesap" style="margin:0 0 4mm">
  <h3 class="dt">Tedavi Dökümü<span>${esc(s.h_ad)}</span></h3>
  ${acct.rows.length
    ? `<table class="hs-tab"><thead><tr><th>Diş</th><th>Tedavi</th><th>Tarih</th><th class="num">Tutar</th></tr></thead><tbody>${rows}${acct.extra > 0 ? `<tr><td colspan="4" class="more">… ve ${acct.extra} kalem daha (tam döküm: Hesap sekmesi)</td></tr>` : ''}<tr><td colspan="3" style="text-align:right"><b>TOPLAM</b></td><td class="num mono"><b>${money(acct.net)} ₺</b></td></tr></tbody></table>`
    : '<p class="t" style="margin:2mm 0 0">Tedavi kaydı bulunmuyor.</p>'}
  </div>`
  return hesap + bono
}

const inputCls = 'mt-1 w-full rounded-lg border border-[#E7ECF2] bg-white px-2.5 py-2 text-sm font-semibold text-[#142536] outline-none focus:border-[#2DD4BF]'
const KEPT_KEYS = ['k_hekim', 'k_tel', 'k_lehtar', 'k_ltc', 'k_sehir', 'pg_anam', 'pg_genel', 'pg_cerrahi', 'pg_resto', 'pg_senet']

function Sec({ title, hint, open, children }: { title: string; hint?: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="rounded-2xl border border-[#E7ECF2] bg-white">
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-black text-[#142536]">{title}{hint && <small className="ml-auto text-xs font-medium text-slate-400">{hint}</small>}</summary>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 px-4 pb-4">{children}</div>
    </details>
  )
}

function scaleSheets(root: HTMLElement) {
  const avail = root.clientWidth
  root.querySelectorAll<HTMLElement>('.ev-wrap').forEach((w) => {
    const sh = w.firstElementChild as HTMLElement
    const k = Math.min(1, avail / sh.offsetWidth)
    sh.style.transform = `scale(${k})`
    w.style.height = `${sh.offsetHeight * k}px`
    w.style.width = `${sh.offsetWidth * k}px`
  })
}

// ───────── ana bileşen ─────────
export default function PatientEvrakTab({ patient, clinic, doctors, anamnesis, treatments, transactions, loading, onAnamnesisSaved }: {
  patient: Patient
  clinic: ClinicInfo | null
  doctors: DoctorOption[]
  anamnesis: Anamnesis
  treatments: Treatment[]
  transactions: Transaction[]
  loading: boolean
  onAnamnesisSaved: (a: Anamnesis) => void
}) {
  const [tc, setTc] = useState<string | null>(null)
  const [edits, setEdits] = useState<S>({})
  const [kept, setKept] = usePersistedPreference<Kept>('dentsoft:evrak-kept', KEPT_DEFAULT)
  const sheetsRef = useRef<HTMLDivElement>(null)

  // Anamnez hasta kartıyla İKİ YÖNLÜ eşlenir: burada işaretlenen/yazılan kart kaydına yazılır, karttaki değişiklik buraya yansır.
  const [pendingAnam, setPendingAnam] = useState<{ base: Anamnesis; next: Anamnesis } | null>(null)
  const anam = pendingAnam && pendingAnam.base === anamnesis ? pendingAnam.next : anamnesis
  const saveAnam = (next: Anamnesis) => {
    setPendingAnam({ base: anamnesis, next })
    updateAnamnesis(patient.id, next).then((res) => {
      if (res.success) { onAnamnesisSaved(next); toast.success('Anamnez hasta kartına işlendi') }
      else { toast.error(`Anamnez kaydedilemedi: ${res.error ?? 'bilinmeyen hata'}`); setPendingAnam(null) }
    })
  }
  const toggleAnam = (key: string) => {
    const row = ANAM.find((x) => x.key === key)
    if (!row) return
    const isOn = row.from.some((d) => anam.diseases.includes(d))
    const diseases = isOn ? anam.diseases.filter((d) => !row.from.includes(d)) : [...anam.diseases, row.from[0]]
    saveAnam({ ...anam, diseases })
  }
  const commitMeds = (text: string) => {
    const meds = text.split(/[,;]/).map((m) => m.trim()).filter(Boolean)
    if (JSON.stringify(meds) !== JSON.stringify(anam.medications)) saveAnam({ ...anam, medications: meds })
  }
  const commitAllergy = (text: string) => { if (text.trim() !== (anam.allergyDetail ?? '').trim()) saveAnam({ ...anam, allergyDetail: text.trim() }) }
  const commitNotes = (text: string) => { if (text.trim() !== (anam.notes ?? '').trim()) saveAnam({ ...anam, notes: text.trim() }) }
  const [lehtarTc, setLehtarTc] = useState('')

  // Hasta kartındaki T.C. (şifreli saklanır) — hasta değişince / düzenlenince yeniden okunur
  useEffect(() => {
    let active = true
    getPatientTc(patient.id).then((res) => { if (active) setTc(res.tc ?? '') })
    return () => { active = false }
  }, [patient])

  // Karttan gelen otomatik değerler; kullanıcı düzenlemeleri (edits) bunların üzerine yazar
  const auto: S = useMemo(() => {
    const a: S = {}
    const bd = patient.birth_date ?? ''
    const pAge = age(bd)
    const isChild = pAge !== null && pAge < 18
    a.h_ad = `${toTitleCase(patient.name)} ${toTitleCase(patient.surname)}`
    a.h_tc = tc ?? ''
    a.h_dogum = bd
    a.h_cins = patient.gender === 'female' ? 'Kadın' : patient.gender === 'male' ? 'Erkek' : ''
    a.h_tel = patient.phone1 ?? ''
    a.h_adres = patient.address ?? ''
    a.h_meslek = ''
    a.h_sikayet = ''
    a.h_tarih = today()
    a.tur = isChild ? 'cocuk' : 'yetiskin'
    for (const x of ANAM) a['an_' + x.key] = x.from.some((d) => anam.diseases.includes(d))
    a.a_ilac = anam.medications.join(', ')
    a.a_alerji = anam.allergyDetail ?? ''
    a.a_diger = anam.notes ?? ''
    const owed = treatments.reduce((s, t) => s + (t.fee ?? 0), 0)
    const paid = transactions.filter((t) => t.type === 'payment').reduce((s, t) => s + (t.amount ?? 0), 0)
    // Bono tutarı = hastanın toplam borcu (tedavi toplamı − yapılan ödemeler)
    a.p_toplam = owed - paid > 0 ? String((owed - paid) / 100) : ''
    a.p_pesin = ''
    a.p_duz = today()
    a.p_vade = addMonths(today(), 12)
    a.p_borclu = isChild ? 'yakin' : 'hasta'
    a.p_no = '1/1'
    a.p_kefilvar = false
    return a
  }, [patient, tc, anam, treatments, transactions])

  // Alacaklı (lehtar) = hastanın şubesinin mesul müdürü; yoksa herhangi bir mesul müdür; o da yoksa ilk hekim
  const responsible = useMemo(
    () => doctors.find((d) => d.is_mesul_mudur && d.branch_id != null && d.branch_id === patient.branch_id)
      ?? doctors.find((d) => d.is_mesul_mudur)
      ?? doctors[0]
      ?? null,
    [doctors, patient.branch_id]
  )
  const isResponsible = !!responsible?.is_mesul_mudur
  const responsibleName = responsible ? toTitleCase(responsible.name) : ''
  // Mesul müdürün T.C. numarası (şifreli saklanır) bonoda lehtar bilgisi olarak otomatik gelir
  useEffect(() => {
    let active = true
    if (!responsible) return
    getDoctorTc(responsible.id).then((res) => { if (active) setLehtarTc(res.tc ?? '') })
    return () => { active = false }
  }, [responsible])
  // Ödeme/düzenleme yeri: klinik adresindeki "İlçe/İl" (yoksa adresin son sözcüğü)
  const clinicPlace = useMemo(() => {
    const addr = (clinic?.address ?? '').trim().replace(/[.,;\s]+$/, '')
    if (!addr) return ''
    const m = addr.match(/([\p{L}]+(?:\s[\p{L}]+)?)\s*\/\s*([\p{L}]+)\s*$/u)
    if (m) return `${toTitleCase(m[1])} / ${toTitleCase(m[2])}`
    const last = addr.replace(/[.,;]+$/, '').split(/[\s,]+/).filter(Boolean).pop() ?? ''
    return toTitleCase(last)
  }, [clinic])

  // Hekim bilgileri: hatırlanan (elle seçilen) değer yoksa mesul müdürden / klinikten
  const doctorDefault = responsibleName ? `Dt. ${responsibleName}` : clinic?.clinic_name ?? ''
  const eff: S = useMemo(() => ({
    ...auto,
    k_hekim: kept.k_hekim || doctorDefault,
    k_tel: kept.k_tel || clinic?.phone || '',
    k_lehtar: kept.k_lehtar || responsibleName || doctorDefault,
    k_ltc: kept.k_ltc || lehtarTc,
    k_sehir: kept.k_sehir || clinicPlace,
    pg_anam: kept.pg_anam, pg_genel: kept.pg_genel, pg_cerrahi: kept.pg_cerrahi, pg_resto: kept.pg_resto, pg_senet: kept.pg_senet,
    ...edits,
  }), [auto, kept, doctorDefault, responsibleName, lehtarTc, clinicPlace, clinic, edits])

  const set = (key: string, value: string | boolean) => {
    if (KEPT_KEYS.includes(key)) setKept({ ...kept, [key]: value } as Kept)
    else setEdits((prev) => ({ ...prev, [key]: value }))
  }
  const txt = (key: string) => String(eff[key] ?? '')
  const on = (key: string) => !!eff[key]

  // Tedavi dökümü: Hesap sekmesindeki "Tedavi Dökümü" ile aynı kalemler, aynı sıra ve aynı tutarlar
  const acct: Acct = useMemo(() => {
    const MAX = 26
    const original = treatments.reduce((sum, t) => sum + (t.original_fee ?? t.fee), 0)
    const net = treatments.reduce((sum, t) => sum + t.fee, 0)
    const paid = transactions.filter((t) => t.type === 'payment').reduce((sum, t) => sum + (t.amount ?? 0), 0)
    return {
      rows: treatments.slice(0, MAX).map((t) => {
        const list = t.original_fee ?? t.fee
        return { date: t.treatment_date ? fd(t.treatment_date.slice(0, 10)) : '—', tooth: t.tooth ? String(t.tooth) : '—', name: t.treatment_name, list, adj: t.fee - list, fee: t.fee }
      }),
      original, net, paid, balance: net - paid, extra: Math.max(0, treatments.length - MAX),
    }
  }, [treatments, transactions])

  const child = eff.tur === 'cocuk'
  const pAge = age(txt('h_dogum'))
  const pages = useMemo(() => {
    const list: [string, string][] = []
    if (eff.pg_anam) list.push(['Anamnez', anamPage(eff, child, pAge)])
    if (eff.pg_genel) list.push([child ? 'Çocuk genel onam' : 'Genel onam', onamPage(eff, child ? COCUK : GENEL, child)])
    if (eff.pg_cerrahi) list.push(['Cerrahi ek onam', onamPage(eff, CERRAHI, child)])
    if (eff.pg_resto) list.push(['Resto-endo-protetik ek onam', onamPage(eff, RESTO, child)])
    if (eff.pg_senet) list.push(['Bono', senetPage(eff, acct)])
    return list
  }, [eff, child, pAge, acct])

  // Sayfaya sığdır (yazı boyutunu küçült) + önizlemeyi ölçekle
  const [overflow, setOverflow] = useState(false)
  useLayoutEffect(() => {
    const root = sheetsRef.current
    if (!root) return
    let over = false
    root.querySelectorAll<HTMLElement>('.ev-content').forEach((c) => {
      let fs = 10.4
      c.style.setProperty('--fs', `${fs}pt`)
      while (c.scrollHeight > c.clientHeight + 1 && fs > 7.4) { fs -= 0.2; c.style.setProperty('--fs', `${fs.toFixed(1)}pt`) }
      if (c.scrollHeight > c.clientHeight + 1) over = true
    })
    scaleSheets(root)
    setOverflow(over)
  }, [pages])
  useEffect(() => {
    const root = sheetsRef.current
    if (!root || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => scaleSheets(root))
    ro.observe(root)
    return () => ro.disconnect()
  }, [])

  // Ctrl+P ile yazdırılsa da bu sekmedeki sayfalar basılsın (başka bir yazdırma hedefi seçili değilse)
  useEffect(() => {
    const root = document.documentElement
    const before = () => { if (!root.hasAttribute('data-print-target')) root.setAttribute('data-print-target', 'evrak') }
    const after = () => { if (root.getAttribute('data-print-target') === 'evrak') root.removeAttribute('data-print-target') }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); after() }
  }, [])

  const print = () => {
    if (pages.length === 0) { toast.error('Yazdırılacak form seçin'); return }
    if (!triggerPrint('evrak-sheets', 'evrak')) toast.error('Yazdırma hazırlanamadı')
  }

  // Not: bunlar bileşen DEĞİL, düz fonksiyondur (her render'da yeni bileşen türü oluşup yazarken odak kaybolmasın)
  const fld = (id: string, label: string, o: { type?: string; full?: boolean; placeholder?: string } = {}) => (
    <label key={id} className={`block text-xs font-bold text-slate-500 ${o.full ? 'col-span-2' : ''}`}>{label}
      <input type={o.type ?? 'text'} value={txt(id)} placeholder={o.placeholder} onChange={(e) => set(id, e.target.value)} className={inputCls} />
    </label>
  )
  const chk = (id: string, label: string) => (
    <label key={id} className="flex cursor-pointer items-start gap-2 py-1 text-sm text-[#142536]">
      <input type="checkbox" checked={on(id)} onChange={(e) => (id.startsWith('an_') ? toggleAnam(id.slice(3)) : set(id, e.target.checked))} className="mt-0.5 h-4 w-4 accent-[#0D9488]" />{label}
    </label>
  )
  // Hasta kartına yazılan metin alanları: yazarken yerel, alandan çıkınca karta kaydedilir
  const syncFld = (id: string, label: string, commit: (v: string) => void) => (
    <label key={id} className="col-span-2 block text-xs font-bold text-slate-500">{label}
      <input
        value={txt(id)}
        onChange={(e) => set(id, e.target.value)}
        onBlur={(e) => { commit(e.target.value); setEdits((p) => { const n = { ...p }; delete n[id]; return n }) }}
        className={inputCls}
      />
    </label>
  )

  const top = parseFloat(txt('p_toplam')) || 0
  const pes = parseFloat(txt('p_pesin')) || 0

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <section className="flex min-w-0 flex-col gap-3" aria-label="Evrak bilgi girişi">
        <div className="rounded-xl bg-[#E6FFFA] px-3 py-2.5 text-xs font-semibold text-[#0F766E]">
          Hasta bilgileri, anamnez ve hesap tutarları <b>hasta kartından otomatik</b> gelir. Alanları isterseniz burada değiştirebilirsiniz.
          {loading && ' (hesap bilgileri yükleniyor…)'}
          {Object.keys(edits).length > 0 && (
            <button type="button" onClick={() => setEdits({})} className="ml-2 font-black underline">Karttan yeniden doldur</button>
          )}
        </div>

        <Sec title="Yazdırılacak formlar" open>
          <div className="col-span-2">
            {chk('pg_anam', 'Anamnez')}
            {chk('pg_genel', 'Genel onam')}
            <div className={`flex flex-wrap gap-x-4 gap-y-1 pb-1 pl-6 ${on('pg_genel') ? '' : 'pointer-events-none opacity-40'}`}>
              <label className="flex items-center gap-1.5 text-sm"><input type="radio" name="ev-tur" checked={!child} onChange={() => { set('tur', 'yetiskin'); set('p_borclu', 'hasta') }} className="accent-[#0D9488]" /> Yetişkin</label>
              <label className="flex items-center gap-1.5 text-sm"><input type="radio" name="ev-tur" checked={child} onChange={() => { set('tur', 'cocuk'); set('p_borclu', 'yakin') }} className="accent-[#0D9488]" /> Çocuk (veli onamı){pAge !== null && pAge < 18 ? <em className="not-italic text-slate-400"> · {pAge} yaş</em> : null}</label>
            </div>
            {chk('pg_cerrahi', 'Ek onam — Ağız, diş ve çene cerrahisi')}
            {chk('pg_resto', 'Ek onam — Restoratif, endodontik ve protetik')}
            {chk('pg_senet', 'Senet (bono)')}
          </div>
        </Sec>

        <Sec title="Hasta bilgileri" open>
          {fld('h_ad', 'Ad soyad', { full: true })}
          {fld('h_tc', 'T.C. kimlik no')}
          {fld('h_dogum', 'Doğum tarihi', { type: 'date' })}
          <label className="block text-xs font-bold text-slate-500">Cinsiyet
            <select value={txt('h_cins')} onChange={(e) => set('h_cins', e.target.value)} className={inputCls}><option value="" /><option>Kadın</option><option>Erkek</option></select>
          </label>
          {fld('h_tel', 'Telefon')}
          {fld('h_adres', 'Adres', { full: true })}
          {fld('h_meslek', 'Meslek')}
          {fld('h_tarih', 'Tarih', { type: 'date' })}
          {fld('h_sikayet', 'Başvuru şikâyeti', { full: true })}
          <p className="col-span-2 border-t border-[#EEF2F6] pt-2 text-xs text-slate-400">Veli, vasi veya hasta yakını varsa doldurun. Doldurulursa formlara hastanın yanında ayrı imza satırı eklenir.</p>
          {fld('v_ad', 'Veli / vasi / yakın ad soyad')}
          {fld('v_yak', 'Sıfatı', { placeholder: 'Anne, baba, vasi…' })}
          {fld('v_tc', 'T.C. kimlik no')}
          {fld('v_tel', 'Telefon')}
          {fld('v_adres', 'Adres (hastanınkinden farklıysa)', { full: true })}
        </Sec>

        <Sec title="Anamnez" hint="hasta kartıyla eşlenir">
          <div className="col-span-2">{ANAM.map((x) => chk('an_' + x.key, x.label))}</div>
          {syncFld('a_ilac', 'Kullandığı ilaçlar (virgülle ayırın)', commitMeds)}
          {syncFld('a_alerji', 'Alerji ayrıntısı (hangi ilaç / madde)', commitAllergy)}
          {syncFld('a_diger', 'Diğer / açıklama (hasta notu)', commitNotes)}
        </Sec>

        <Sec title="Senet (bono)" open={on('pg_senet')}>
          {fld('p_toplam', 'Hastanın toplam borcu (TL)', { type: 'number' })}
          {fld('p_pesin', 'Peşinat / alınan (TL)', { type: 'number' })}
          <div className="col-span-2 rounded-lg bg-[#E6FFFA] px-3 py-2 font-mono text-sm text-[#142536]">
            {top ? `${tl(Math.max(0, top - pes))} TL · ${tutarYazi(Math.max(0, top - pes))}` : 'Toplam ücreti girin'}
          </div>
          {fld('p_duz', 'Düzenleme tarihi', { type: 'date' })}
          {fld('p_vade', 'Vade (ödeme günü)', { type: 'date' })}
          <div className="col-span-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">Vadeyi düzenleme tarihinden itibaren ayarla:
            {([[3, '3 ay'], [6, '6 ay'], [12, '1 yıl']] as const).map(([m, l]) => (
              <button key={m} type="button" onClick={() => set('p_vade', addMonths(txt('p_duz'), m))} className="rounded-md border border-[#E7ECF2] px-2.5 py-1 font-semibold hover:bg-slate-50">{l}</button>
            ))}
          </div>
          {!txt('p_vade') && <p className="col-span-2 text-xs font-semibold text-amber-700">Vade tarihi girilmedi. Bono vadesiz kalırsa “görüldüğünde ödenecek” sayılır.</p>}
          <label className="block text-xs font-bold text-slate-500">Borçlu
            <select value={txt('p_borclu')} onChange={(e) => set('p_borclu', e.target.value)} className={inputCls}><option value="hasta">Hasta</option><option value="yakin">Veli / vasi / yakın</option></select>
          </label>
          {fld('p_no', 'Senet no', { placeholder: 'ör. 1/1' })}
          <div className="col-span-2">{chk('p_kefilvar', 'Aval veren eklenecek')}</div>
          {on('p_kefilvar') && (<>
            {fld('kf_ad', 'Aval veren ad soyad', { full: true })}
            {fld('kf_tc', 'Aval veren T.C. no')}
            {fld('kf_tel', 'Aval veren telefon')}
            {fld('kf_adres', 'Aval veren adres', { full: true })}
          </>)}
        </Sec>

        <Sec title="Hekim" hint="saklanır">
          {doctors.length > 0 && (
            <label className="col-span-2 block text-xs font-bold text-slate-500">Hekimi listeden seç
              <select
                value=""
                onChange={(e) => { if (e.target.value) { setKept({ ...kept, k_hekim: e.target.value, k_lehtar: e.target.value }) } }}
                className={inputCls}
              >
                <option value="">— seçin —</option>
                {doctors.map((d) => { const n = `Dt. ${toTitleCase(d.name)}`; return <option key={d.id} value={n}>{n}</option> })}
              </select>
            </label>
          )}
          {!isResponsible && <p className="col-span-2 text-xs font-semibold text-amber-700">Bu şubede “mesul müdür” işaretli hekim yok; alacaklı olarak ilk hekim geldi. Ayarlar → Diş Hekimi’nden mesul müdürü işaretleyin.</p>}
          {fld('k_hekim', 'Hekim')}
          {fld('k_tel', 'Telefon')}
          {fld('k_lehtar', 'Alacaklı (bonoda lehtar)', { full: true })}
          {fld('k_ltc', 'Lehtar T.C. no (isteğe bağlı)')}
          {fld('k_sehir', 'Ödeme ve düzenleme yeri', { placeholder: 'İlçe / il' })}
        </Sec>
        <p className="text-xs text-slate-400">Hekim bilgileri ve form seçimleri bu tarayıcıda hatırlanır; hasta bilgileri yalnızca karttan okunur.</p>
      </section>

      <section className="min-w-0" aria-label="Önizleme">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {pages.length ? `${pages.length} sayfa · ${pages.map((p) => p[0]).join(' · ')}` : 'A4 önizleme'}
            {overflow && <span className="ml-2 text-amber-700">Bir sayfa taşıyor</span>}
          </span>
          <button type="button" onClick={print} className="rounded-xl bg-[#2DD4BF] px-4 py-2 text-sm font-bold text-[#0F2B3D] hover:bg-[#26b8a5]">Yazdır / PDF</button>
        </div>
        <div id="evrak-sheets" ref={sheetsRef} className="ev-sheets">
          {pages.length === 0
            ? <p className="py-10 text-center text-sm text-slate-400">Yazdırılacak formu soldan seçin.</p>
            : pages.map(([name, html]) => (
              <div key={name} className="ev-wrap" aria-label={name}>
                <div className="ev-sheet"><div className="ev-content" dangerouslySetInnerHTML={{ __html: html }} /></div>
              </div>
            ))}
        </div>
      </section>
    </div>
  )
}
