// TDB tarife tablosu (Excel/CSV) çözümleyicisi — saf fonksiyonlar, sunucu/istemci ortak.
export type TdbRowsItem = { category: string; treatment_name: string; price: number }
export type TdbParseResult = {
  items: TdbRowsItem[]
  skipped: number
  categories: number
  warnings: string[]
}
type Cell = string | number | boolean | Date | null | undefined

const norm = (s: unknown) => String(s ?? '').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim()

/** "1.650,00", "1650,5", 1650 → sayı; çözülemezse null */
export function parseTrNumber(value: Cell): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const raw = value.replace(/[₺\sTLtl]/g, '')
  if (!/^[0-9.,]+$/.test(raw) || !/[0-9]/.test(raw)) return null
  let t = raw
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if ((t.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(t)) t = t.replace(/\./g, '')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Basit CSV (; veya , ayraçlı, tırnaklı alan destekli) → satır dizisi */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const first = clean.split(/\r?\n/, 1)[0] ?? ''
  const sep = (first.match(/;/g) ?? []).length >= (first.match(/,/g) ?? []).length ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') quoted = false
      else cur += c
    } else if (c === '"') quoted = true
    else if (c === sep) { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++
      row.push(cur); cur = ''
      rows.push(row); row = []
    } else cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows
}

/**
 * Sayfalardaki satırlardan (ad, fiyat) çiftlerini çıkarır.
 * - Başlık satırı (işlem adı + fiyat/ücret/KDV sütunları) bulunur; "KDV dahil/toplam" sütunu tercih edilir.
 * - Fiyatsız, tek metinli satırlar kategori başlığı sayılır; kategori sütunu da desteklenir.
 * - vatIncluded=false ise fiyatlara %10 KDV eklenir (uygulama KDV-dahil çalışır). Çıktı kuruştur.
 */
export function parseTdbSheets(sheets: { name: string; rows: Cell[][] }[], vatIncluded: boolean): TdbParseResult {
  const warnings: string[] = []
  const items: TdbRowsItem[] = []
  let skipped = 0
  const seen = new Set<string>()
  const cats = new Set<string>()

  for (const sheet of sheets) {
    const rows = sheet.rows
    let headerIdx = -1
    let nameCol = -1
    let priceCol = -1
    let catCol = -1
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const cells = rows[i].map(norm)
      const n = cells.findIndex((c) => /(işlem|tedavi|hizmet|adı|\bad\b)/.test(c) && !/(kod|no\b)/.test(c))
      const priceCols = cells.map((c, idx) => (/(fiyat|ücret|tutar|toplam|kdv)/.test(c) ? idx : -1)).filter((x) => x >= 0)
      if (n >= 0 && priceCols.length > 0) {
        headerIdx = i
        nameCol = n
        priceCol = priceCols.find((idx) => /(dahil|toplam)/.test(cells[idx])) ?? priceCols[priceCols.length - 1]
        catCol = cells.findIndex((c) => /(kategori|bölüm|grup|branş)/.test(c))
        break
      }
    }
    if (headerIdx < 0) {
      // Başlıksız tablo: ilk metin sütunu ad, son sayısal sütun fiyat
      const sample = rows.slice(0, 40)
      const width = Math.max(0, ...sample.map((r) => r.length))
      for (let c = 0; c < width && nameCol < 0; c++) {
        if (sample.filter((r) => typeof r[c] === 'string' && /[A-Za-zÇĞİÖŞÜçğıöşü]{4}/.test(String(r[c]))).length >= 3) nameCol = c
      }
      for (let c = width - 1; c >= 0 && priceCol < 0; c--) {
        if (sample.filter((r) => parseTrNumber(r[c]) !== null).length >= 3) priceCol = c
      }
      if (nameCol < 0 || priceCol < 0) { if (rows.length) warnings.push(`"${sheet.name}" sayfasında ad/fiyat sütunu bulunamadı`); continue }
    }

    let category = /^(sayfa|sheet|tablo)\s*\d*$/i.test(sheet.name.trim()) ? 'Diğer' : sheet.name.trim()
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i]
      const name = String(r[nameCol] ?? '').replace(/\s+/g, ' ').trim()
      const price = parseTrNumber(r[priceCol])
      if (!name) { if (r.some((c) => c !== null && c !== undefined && String(c).trim() !== '')) skipped++; continue }
      if (price === null) {
        const others = r.filter((c, idx) => idx !== nameCol && c !== null && c !== undefined && String(c).trim() !== '')
        if (others.length === 0 || (others.length === 1 && /^\d+[.)]?$/.test(String(others[0]).trim()))) { category = name.replace(/^\d+[.)-]?\s*/, ''); continue }
        skipped++
        continue
      }
      if (price <= 0) { skipped++; continue }
      const cat = (catCol >= 0 ? String(r[catCol] ?? '').trim() : '') || category
      const key = `${cat}|${name}`.toLocaleLowerCase('tr-TR')
      if (seen.has(key)) { skipped++; continue }
      seen.add(key)
      cats.add(cat)
      items.push({ category: cat, treatment_name: name.slice(0, 200), price: Math.round(price * (vatIncluded ? 1 : 1.1) * 100) })
    }
  }
  if (items.length === 0) warnings.push('Tabloda içe aktarılabilir işlem bulunamadı')
  return { items, skipped, categories: cats.size, warnings }
}
