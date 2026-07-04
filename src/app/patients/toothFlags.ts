// Diş bayrakları + tedavi sınıflandırma — saf fonksiyonlar (client component
// veya server action fark etmeksizin import edilebilir; 'use client' YOK).

export interface ToothFlags {
  canal?: boolean
  filling?: boolean
  crown?: boolean
  crownMaterial?: 'porcelain' | 'zirconium'
  implant?: boolean
  extracted?: boolean
  graft?: boolean
  removableProsthesis?: boolean
  // Diyagnoz sembolleri
  mineCaryo?: boolean
  dentinCaryo?: boolean
  kret?: boolean
  nerve?: boolean
  periapical?: boolean
  poorCanal?: boolean
}
export type ToothBooleanFlag = Exclude<keyof ToothFlags, 'crownMaterial'>

// Diyagnoz adından sembol türünü sınıflandırır
export function classifyDiagnosis(name: string): ToothBooleanFlag | null {
  const s = name.toLocaleLowerCase('tr')
  if (s.includes('çekilmiş') || s.includes('cekilmis')) return 'extracted'
  if (s.startsWith('mine')) return 'mineCaryo'
  if (s.startsWith('dentin')) return 'dentinCaryo'
  if (s === 'kret') return 'kret'
  if (s.includes('mandibular') || (s.includes('sinir') && !s.includes('kanal'))) return 'nerve'
  if (s.includes('periapikal')) return 'periapical'
  if (s.includes('yetersiz')) return 'poorCanal'
  return null
}

// Tedavi adından sembol türünü sınıflandırır
export function classifyTreatment(name: string): ToothBooleanFlag | null {
  const s = name.toLocaleLowerCase('tr')
  if (s.includes('implant')) return 'implant'
  if (s.includes('çekim') || s.includes('cekim') || s.includes('ekstraksiyon')) return 'extracted'
  if (s.includes('kanal') || s.includes('endo')) return 'canal'
  if (
    s.includes('kron') ||
    s.includes('kaplama') ||
    s.includes('kuron') ||
    s.includes('zirkon') ||
    s.includes('porselen') ||
    s.includes('veneer') ||
    s.includes('laminate')
  )
    return 'crown'
  if (
    s.includes('dolgu') ||
    s.includes('kompozit') ||
    s.includes('amalgam') ||
    s.includes('inlay') ||
    s.includes('onlay')
  )
    return 'filling'
  return null
}

// Tarife kaleminin visual_schema'sından (veya yoksa isminden) diş bayraklarını çıkarır.
export function treatmentFlags(schema: string | null | undefined, name: string): ToothFlags {
  const flags: ToothFlags = {}
  const schemas = (schema || '').split('+').filter(Boolean)
  if (!schemas.length) {
    const inferred = classifyTreatment(name)
    if (inferred) flags[inferred] = true
    return flags
  }
  for (const item of schemas) {
    if (item === 'implant') flags.implant = true
    else if (['crown', 'porcelain', 'emax', 'prosthesis'].includes(item)) { flags.crown = true; flags.crownMaterial = 'porcelain' }
    else if (item === 'zirconium') { flags.crown = true; flags.crownMaterial = 'zirconium' }
    else if (item === 'filling') flags.filling = true
    else if (item === 'root-canal') flags.canal = true
    else if (item === 'extraction') flags.extracted = true
    else if (item === 'bone-graft') flags.graft = true
    else if (['removable', 'total-prosthesis'].includes(item)) flags.removableProsthesis = true
  }
  return flags
}

// ─── Diş üzerinde tedavi uyumluluğu (stacking) ───────────────────────────────
//
// Kural: implant, çekilmiş dişin YERİNE geçer — bu yüzden çekim sonrası implant
// (ve implant öncesi greft) serbesttir. Doğal diş üzerinde yapılan işlemler
// (dolgu/kanal) çekilmiş veya implantlı dişe eklenemez. Kron zaten görünen
// yüzeyi kapladığı için üstüne dolgu eklenmesi engellenir. Kapsam sadece
// "Tedavi" sekmesinden eklenen kesinleşmiş tedavilerdir (diyagnoz/planlama
// taslakları bu kontrolün dışındadır). `removableProsthesis` tüm çeneye
// yayıldığından (tek dişe özgü değil) bu kontrole dahil edilmez.

const TREATMENT_LABEL: Record<string, string> = {
  filling: 'dolgu',
  canal: 'kanal tedavisi',
  crown: 'kron/kaplama',
  implant: 'implant',
  extracted: 'çekim',
  graft: 'greft',
}

export function checkTreatmentCompatibility(
  existing: ToothFlags,
  incoming: ToothFlags
): { ok: true } | { ok: false; error: string } {
  const block = (reason: string): { ok: false; error: string } => ({ ok: false, error: reason })

  if (incoming.extracted) {
    if (existing.extracted) return block('Bu diş zaten çekilmiş.')
    // Doğal diş üzerinde herhangi bir işlem olsa da çekim her zaman yapılabilir.
  }

  if (incoming.implant) {
    if (existing.implant) return block('Bu dişte zaten implant var.')
    if (!existing.extracted && !existing.graft && (existing.filling || existing.canal || existing.crown)) {
      return block('Bu dişte doğal diş dokusu var; implant için önce çekim yapılmalı.')
    }
  }

  if (incoming.crown) {
    if (existing.extracted && !existing.implant) {
      return block('Bu diş çekilmiş; kron için önce implant eklenmeli.')
    }
    if (existing.implant) {
      // İmplant üzerine kron: her zaman izinli.
    }
  }

  if (incoming.filling || incoming.canal) {
    const label = TREATMENT_LABEL[incoming.filling ? 'filling' : 'canal']
    if (existing.extracted && !existing.implant) return block(`Bu diş çekilmiş; ${label} eklenemez.`)
    if (existing.implant) return block(`İmplantlı dişe ${label} eklenemez.`)
    if (existing.graft) return block(`Bu dişte greft var; ${label} eklenemez.`)
  }

  if (incoming.filling && existing.crown) {
    return block('Bu diş kronlu; dolgu eklenemez.')
  }

  if (incoming.graft) {
    if (existing.implant) return block('Bu dişte zaten implant var; greft eklenemez.')
    if (existing.filling || existing.canal || existing.crown) {
      return block('Bu dişte doğal diş dokusu var; greft için önce çekim yapılmalı.')
    }
  }

  return { ok: true }
}
