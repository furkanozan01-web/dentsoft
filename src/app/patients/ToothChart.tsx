'use client'

import React, { useId } from 'react'
import { classifyDiagnosis, classifyTreatment, type ToothFlags } from './toothFlags'

export { classifyDiagnosis, classifyTreatment }
export type { ToothFlags, ToothBooleanFlag } from './toothFlags'

/**
 * Anatomik FDI dentogram — tamamen SVG (dış görsele/CDN'e bağımlılık yok).
 *
 * Dişler bukkal (yanak/dudak) yüzden görünür ve anatomik ortalama ölçülerle
 * (genişlik, kron boyu, kök boyu) çizilir; okluzal/insizal uçlar aynı düzlemde
 * hizalanır, mine-sement sınırı ve kök uçları dişe göre değişir. Azılarda kök
 * gövdesi + furkasyon, üst azılarda arkada palatinal kök vardır. Diş eti satır
 * boyunca tek parça çizilir ve köklere doğru saydamlaşır (kanal/lezyon görünür kalsın).
 *
 * Tedaviler dişin üzerine işlenir:
 *   - kanal tedavisi → pulpa/kanal kırmızıdan beyaza döner
 *   - dolgu          → kron üzerinde gri restorasyon
 *   - kron/kaplama   → porselen mavi / zirkonyum sarı renkte
 *   - apikal rezeksiyon → kök ucu eğik kesilir, kesit yüzü koyu + retrograd dolgu
 *   - tam protez     → çenedeki tüm dişler silinir, damak (alt çenede at nalı) simgesi konur
 *   - parsiyel protez → çekilmiş/eksik dişlerin yerine protez diş + akrilik eyer konur
 *   - implant        → kök yerine vida
 *   - çekim          → diş çizilmez, diş eti düz devam eder
 */

type Jaw = 'upper' | 'lower'
type ToothType = 'incisor' | 'canine' | 'premolar' | 'molar'

// FDI kök sayıları (referans tablodan birebir)
const ROOTS: Record<number, number> = {
  18: 3, 17: 3, 16: 3, 15: 1, 14: 2, 13: 1, 12: 1, 11: 1,
  21: 1, 22: 1, 23: 1, 24: 2, 25: 1, 26: 3, 27: 3, 28: 3,
  48: 2, 47: 2, 46: 2, 45: 1, 44: 1, 43: 1, 42: 1, 41: 1,
  31: 1, 32: 1, 33: 1, 34: 1, 35: 1, 36: 2, 37: 2, 38: 2,
  55: 3, 54: 3, 53: 1, 52: 1, 51: 1, 61: 1, 62: 1, 63: 1, 64: 3, 65: 3,
  85: 2, 84: 2, 83: 1, 82: 1, 81: 1, 71: 1, 72: 1, 73: 1, 74: 2, 75: 2,
}

// Anatomik ortalama ölçüler (mm): [mesio-distal kron genişliği, kron boyu, kök boyu]
type Dim = [number, number, number]
const PERM_UPPER: Record<number, Dim> = {
  1: [8.5, 10.5, 13], 2: [6.5, 9.5, 13], 3: [7.5, 10, 17], 4: [7, 8.5, 14],
  5: [6.5, 8.5, 14], 6: [10, 7.5, 12.5], 7: [9, 7, 11.5], 8: [8.5, 6.5, 10.5],
}
const PERM_LOWER: Record<number, Dim> = {
  1: [5, 9, 12.5], 2: [5.5, 9.5, 14], 3: [7, 11, 16], 4: [7, 8.5, 14],
  5: [7, 8, 14.5], 6: [11, 7.5, 14], 7: [10.5, 7, 13], 8: [10, 7, 11],
}
const PRIM_UPPER: Record<number, Dim> = {
  1: [6.5, 6, 10], 2: [5.1, 5.6, 11.4], 3: [7, 6.5, 13.5], 4: [7.3, 5.1, 10], 5: [8.2, 5.7, 11.7],
}
const PRIM_LOWER: Record<number, Dim> = {
  1: [4.2, 5, 9], 2: [4.1, 5.2, 10], 3: [5, 6, 11.5], 4: [7.7, 6, 9.8], 5: [9.9, 5.5, 11.3],
}

const VBH = 100
const TOOTH_HEIGHT = 132 // px
const K = TOOTH_HEIGHT / VBH // px / birim
const S = 3.3 // birim / mm
const OCC = 96 // insizal / okluzal uç (tüm dişlerde ortak düzlem)
const PAD = 1.1 // hücre içinde kronun iki yanındaki pay (komşu kronlar neredeyse değer)

function toothType(num: number): ToothType {
  const d = num % 10
  const primary = num >= 51
  if (d === 1 || d === 2) return 'incisor'
  if (d === 3) return 'canine'
  if (primary) return 'molar'
  if (d === 4 || d === 5) return 'premolar'
  return 'molar'
}

interface Geo {
  num: number
  type: ToothType
  digit: number
  upper: boolean
  primary: boolean
  /** Mezial yönün x işareti (+1: sağa, -1: sola) */
  ms: 1 | -1
  cw: number
  nw: number
  vbw: number
  cx: number
  J: number
  H: number
  L: number
  nRoots: number
}

function geo(num: number): Geo {
  const quadrant = Math.floor(num / 10)
  const digit = num % 10
  const upper = [1, 2, 5, 6].includes(quadrant)
  const primary = quadrant >= 5
  const table = primary ? (upper ? PRIM_UPPER : PRIM_LOWER) : upper ? PERM_UPPER : PERM_LOWER
  const [wmm, hmm, rmm] = table[digit] ?? [7, 8, 13]
  const type = toothType(num)
  const cw = wmm * S
  const H = hmm * S
  const neckFactor = type === 'molar' ? 0.8 : type === 'premolar' ? 0.7 : type === 'canine' ? 0.7 : upper ? 0.72 : 0.68
  const vbw = cw + PAD * 2
  return {
    num, type, digit, upper, primary,
    // 1. ve 4. (5., 8.) kadranlar ekranda solda çizilir → mezial sağa bakar
    ms: [1, 4, 5, 8].includes(quadrant) ? 1 : -1,
    cw, nw: cw * neckFactor, vbw, cx: vbw / 2,
    J: OCC - H, H, L: rmm * S,
    nRoots: ROOTS[num] ?? 1,
  }
}

const n2 = (v: number) => Number(v.toFixed(2))

// ─── Kron (bukkal görünüm) ──────────────────────────────────────────────────

function crownPath(g: Geo): string {
  const { cx, cw, J, H, ms, type, digit, upper, primary } = g
  const hw = cw / 2
  const hn = g.nw / 2
  // u > 0 mezial, u < 0 distal
  const P = (u: number, f: number) => `${n2(cx + ms * u)} ${n2(J + f * H)}`
  const cej = type === 'molar' ? 0.07 : 0.1

  if (type === 'incisor') {
    const lateral = digit === 2 && upper
    const rm = (upper ? (lateral ? 0.17 : 0.11) : 0.15) * cw
    const rd = (upper ? (lateral ? 0.32 : 0.22) : 0.18) * cw
    const distalDrop = lateral ? 0.06 : upper ? 0.02 : 0
    return `M ${P(hn, 0)}
      C ${P(hn + 0.03 * cw, 0.3)} ${P(hw, 0.5)} ${P(hw, 0.76)}
      C ${P(hw, 0.92)} ${P(hw - rm * 0.2, 1)} ${P(hw - rm, 1)}
      Q ${P(0, 1.012)} ${P(-(hw - rd), 1 - distalDrop)}
      C ${P(-(hw - rd * 0.25), 1 - distalDrop)} ${P(-hw, 0.9 - distalDrop)} ${P(-hw, 0.68)}
      C ${P(-hw, 0.46)} ${P(-(hn + 0.03 * cw), 0.28)} ${P(-hn, 0)}
      Q ${P(0, -cej)} ${P(hn, 0)} Z`
  }
  if (type === 'canine') {
    return `M ${P(hn, 0)}
      C ${P(hn + 0.03 * cw, 0.26)} ${P(hw, 0.38)} ${P(hw, 0.57)}
      C ${P(hw, 0.72)} ${P(hw - 0.03 * cw, 0.8)} ${P(hw - 0.1 * cw, 0.855)}
      Q ${P(0.17 * cw, 0.965)} ${P(0.03 * cw, 1)}
      Q ${P(-0.15 * cw, 0.95)} ${P(-(hw - 0.09 * cw), 0.8)}
      C ${P(-(hw - 0.03 * cw), 0.74)} ${P(-hw, 0.67)} ${P(-hw, 0.52)}
      C ${P(-hw, 0.35)} ${P(-(hn + 0.03 * cw), 0.25)} ${P(-hn, 0)}
      Q ${P(0, -cej)} ${P(hn, 0)} Z`
  }
  if (type === 'premolar') {
    return `M ${P(hn, 0)}
      C ${P(hn + 0.04 * cw, 0.25)} ${P(hw, 0.36)} ${P(hw, 0.55)}
      C ${P(hw, 0.74)} ${P(hw - 0.04 * cw, 0.84)} ${P(hw - 0.13 * cw, 0.9)}
      Q ${P(0.14 * cw, 0.995)} ${P(0.01 * cw, 1)}
      Q ${P(-0.13 * cw, 0.995)} ${P(-(hw - 0.13 * cw), 0.9)}
      C ${P(-(hw - 0.04 * cw), 0.84)} ${P(-hw, 0.74)} ${P(-hw, 0.55)}
      C ${P(-hw, 0.36)} ${P(-(hn + 0.04 * cw), 0.25)} ${P(-hn, 0)}
      Q ${P(0, -cej)} ${P(hn, 0)} Z`
  }
  // Azı: alt 1. azıda (ve alt süt 2. azısında) üç bukkal tüberkül, diğerlerinde iki
  const three = !upper && ((!primary && digit === 6) || (primary && digit === 5))
  const occlusal = three
    ? `Q ${P(0.365 * cw, 0.985)} ${P(0.3 * cw, 1)}
       Q ${P(0.22 * cw, 0.99)} ${P(0.155 * cw, 0.94)}
       Q ${P(0.08 * cw, 0.995)} ${P(0, 0.995)}
       Q ${P(-0.09 * cw, 0.99)} ${P(-0.165 * cw, 0.945)}
       Q ${P(-0.24 * cw, 0.985)} ${P(-0.3 * cw, 0.975)}
       Q ${P(-0.38 * cw, 0.965)} ${P(-0.41 * cw, 0.89)}`
    : `Q ${P(0.33 * cw, 0.99)} ${P(0.24 * cw, 1)}
       Q ${P(0.12 * cw, 0.99)} ${P(-0.01 * cw, 0.935)}
       Q ${P(-0.13 * cw, 0.985)} ${P(-0.24 * cw, 0.985)}
       Q ${P(-0.35 * cw, 0.98)} ${P(-0.4 * cw, 0.9)}`
  return `M ${P(hn, 0)}
    C ${P(hn + 0.05 * cw, 0.22)} ${P(hw, 0.32)} ${P(hw, 0.54)}
    C ${P(hw, 0.74)} ${P(hw - 0.04 * cw, 0.84)} ${P(0.4 * cw, 0.91)}
    ${occlusal}
    C ${P(-(hw - 0.04 * cw), 0.82)} ${P(-hw, 0.72)} ${P(-hw, 0.53)}
    C ${P(-hw, 0.32)} ${P(-(hn + 0.05 * cw), 0.22)} ${P(-hn, 0)}
    Q ${P(0, -cej)} ${P(hn, 0)} Z`
}

/** Kron yüzeyindeki gelişimsel oluklar / sırtlar (ince, yumuşak çizgiler) */
function crownGrooves(g: Geo): string[] {
  const { cx, cw, J, H, ms, type, digit, upper, primary } = g
  const P = (u: number, f: number) => `${n2(cx + ms * u)} ${n2(J + f * H)}`
  if (type === 'incisor') {
    return [
      `M ${P(0.17 * cw, 0.42)} Q ${P(0.19 * cw, 0.7)} ${P(0.16 * cw, 0.95)}`,
      `M ${P(-0.17 * cw, 0.42)} Q ${P(-0.19 * cw, 0.7)} ${P(-0.16 * cw, 0.95)}`,
    ]
  }
  if (type === 'canine') return [`M ${P(0.2 * cw, 0.45)} Q ${P(0.18 * cw, 0.68)} ${P(0.12 * cw, 0.86)}`, `M ${P(-0.2 * cw, 0.45)} Q ${P(-0.19 * cw, 0.64)} ${P(-0.14 * cw, 0.8)}`]
  if (type === 'premolar') return [`M ${P(0.22 * cw, 0.5)} Q ${P(0.2 * cw, 0.7)} ${P(0.14 * cw, 0.88)}`, `M ${P(-0.22 * cw, 0.5)} Q ${P(-0.2 * cw, 0.7)} ${P(-0.14 * cw, 0.88)}`]
  const three = !upper && ((!primary && digit === 6) || (primary && digit === 5))
  return three
    ? [
        `M ${P(0.155 * cw, 0.94)} Q ${P(0.17 * cw, 0.7)} ${P(0.15 * cw, 0.48)}`,
        `M ${P(-0.165 * cw, 0.945)} Q ${P(-0.18 * cw, 0.76)} ${P(-0.165 * cw, 0.58)}`,
      ]
    : [`M ${P(-0.01 * cw, 0.935)} Q ${P(0.01, 0.68)} ${P(-0.01 * cw, 0.44)}`]
}

// ─── Kökler ─────────────────────────────────────────────────────────────────

interface Canal { topX: number; tipX: number; tipY: number }
interface RootSet { back: string[]; front: string[]; canals: Canal[] }

function singleRootPath(xl: number, xr: number, topY: number, tipX: number, tipY: number): string {
  const L = topY - tipY
  const half = (xr - xl) / 2
  return `M ${n2(xl)} ${n2(topY)}
    C ${n2(xl + 0.4)} ${n2(topY - 0.34 * L)} ${n2(tipX - half * 0.6)} ${n2(tipY + 0.36 * L)} ${n2(tipX - 1.25)} ${n2(tipY + 3)}
    Q ${n2(tipX)} ${n2(tipY - 0.7)} ${n2(tipX + 1.25)} ${n2(tipY + 3)}
    C ${n2(tipX + half * 0.6)} ${n2(tipY + 0.36 * L)} ${n2(xr - 0.4)} ${n2(topY - 0.34 * L)} ${n2(xr)} ${n2(topY)} Z`
}

/** Ortak gövdeden ayrılan iki kök (furkasyon kemeri yF yüksekliğinde) */
function twoRootPath(xl: number, xr: number, topY: number, yF: number, a: { x: number; y: number; w: number }, b: { x: number; y: number; w: number }, fw: number): string {
  const fx = (a.x + b.x) / 2
  const La = topY - a.y
  const Lb = topY - b.y
  return `M ${n2(xl)} ${n2(topY)}
    C ${n2(xl - 0.3)} ${n2(topY - 0.32 * La)} ${n2(a.x - a.w)} ${n2(a.y + 0.5 * La)} ${n2(a.x - 1.2)} ${n2(a.y + 3)}
    Q ${n2(a.x)} ${n2(a.y - 0.7)} ${n2(a.x + 1.2)} ${n2(a.y + 3)}
    C ${n2(a.x + a.w)} ${n2(a.y + 0.5 * (yF - a.y))} ${n2(fx - fw)} ${n2(yF)} ${n2(fx)} ${n2(yF)}
    C ${n2(fx + fw)} ${n2(yF)} ${n2(b.x - b.w)} ${n2(b.y + 0.5 * (yF - b.y))} ${n2(b.x - 1.2)} ${n2(b.y + 3)}
    Q ${n2(b.x)} ${n2(b.y - 0.7)} ${n2(b.x + 1.2)} ${n2(b.y + 3)}
    C ${n2(b.x + b.w)} ${n2(b.y + 0.5 * Lb)} ${n2(xr + 0.3)} ${n2(topY - 0.32 * Lb)} ${n2(xr)} ${n2(topY)} Z`
}

function buildRoots(g: Geo): RootSet {
  const { cx, cw, J, L, ms, type, digit, upper, primary, nRoots } = g
  const hn = g.nw / 2
  const xl = cx - hn + 0.3
  const xr = cx + hn - 0.3
  const topY = J + 2.5
  const ds = -ms // distal yön
  const order = <T extends { x: number }>(p: T, q: T): [T, T] => (p.x <= q.x ? [p, q] : [q, p])

  if (nRoots <= 1) {
    const bend = type === 'canine' ? 2.2 : type === 'premolar' ? 1.7 : 1.2
    const tipX = cx + ds * bend
    return { back: [], front: [singleRootPath(xl, xr, topY, tipX, J - L)], canals: [{ topX: cx, tipX, tipY: J - L }] }
  }

  if (type === 'premolar') {
    // Üst 1. küçük azı: bukkal + palatinal kök, bukkalden apikal üçlüde çatallı görünür
    const [a, b] = order({ x: cx + ms * 0.13 * cw + ds * 1, y: J - L, w: 0.13 * cw }, { x: cx + ds * 0.15 * cw + ds * 1, y: J - 0.94 * L, w: 0.12 * cw })
    return {
      back: [], front: [twoRootPath(xl, xr, topY, J - 0.56 * L, a, b, 0.05 * cw)],
      canals: [{ topX: cx - 1.1, tipX: a.x, tipY: a.y }, { topX: cx + 1.1, tipX: b.x, tipY: b.y }],
    }
  }

  const third = !primary && digit === 8
  const spread = (primary ? 1.28 : third ? 0.62 : 1)
  const trunk = third ? 0.5 : primary ? 0.16 : upper ? 0.3 : 0.25

  if (nRoots === 2 || !upper) {
    // Alt azı: mezial kök geniş ve distale kıvrık, distal kök daha düz
    const mes = { x: cx + ms * 0.27 * cw * spread + ds * 1.2, y: J - L, w: 0.18 * cw }
    const dis = { x: cx + ds * 0.31 * cw * spread, y: J - 0.93 * L, w: 0.15 * cw }
    const [a, b] = order(mes, dis)
    return {
      back: [], front: [twoRootPath(xl, xr, topY, J - trunk * L, a, b, 0.09 * cw)],
      canals: [{ topX: cx - 0.15 * cw, tipX: a.x, tipY: a.y }, { topX: cx + 0.15 * cw, tipX: b.x, tipY: b.y }],
    }
  }

  // Üst azı: mezio-bukkal + disto-bukkal önde, palatinal kök arkada ve daha uzun
  const mb = { x: cx + ms * 0.26 * cw * spread + ds * 1, y: J - 0.93 * L, w: 0.14 * cw }
  const db = { x: cx + ds * 0.28 * cw * spread, y: J - 0.86 * L, w: 0.12 * cw }
  const [a, b] = order(mb, db)
  const palX = cx + ds * 0.02 * cw
  return {
    back: [singleRootPath(cx - 0.27 * cw, cx + 0.27 * cw, topY - 0.12 * L, palX, J - L)],
    front: [twoRootPath(xl, xr, topY, J - trunk * L, a, b, 0.08 * cw)],
    canals: [{ topX: cx, tipX: palX, tipY: J - L }, { topX: cx - 0.15 * cw, tipX: a.x, tipY: a.y }, { topX: cx + 0.15 * cw, tipX: b.x, tipY: b.y }],
  }
}

// ─── Pulpa ──────────────────────────────────────────────────────────────────

function pulpGeom(g: Geo) {
  const { cw, J, H, type, nRoots } = g
  const pw = cw * (type === 'molar' ? 0.27 : type === 'premolar' ? 0.15 : type === 'canine' ? 0.13 : 0.16)
  const roof = J + 0.36 * H
  const horn = H * (type === 'incisor' ? 0.09 : 0.14)
  const floor = nRoots > 1 && type === 'molar' ? J - 1.5 : J - 4
  return { pw, roof, horn, floor }
}

function pulpChamberPath(g: Geo): string {
  const { cx } = g
  const { pw, roof, horn, floor } = pulpGeom(g)
  const mid = floor + (roof - floor) * 0.4
  return `M ${n2(cx - pw * 0.7)} ${n2(floor)}
    C ${n2(cx - pw)} ${n2(mid)} ${n2(cx - pw)} ${n2(roof - 1)} ${n2(cx - pw * 0.82)} ${n2(roof + horn)}
    Q ${n2(cx - pw * 0.42)} ${n2(roof + horn * 0.15)} ${n2(cx)} ${n2(roof)}
    Q ${n2(cx + pw * 0.42)} ${n2(roof + horn * 0.15)} ${n2(cx + pw * 0.82)} ${n2(roof + horn)}
    C ${n2(cx + pw)} ${n2(roof - 1)} ${n2(cx + pw)} ${n2(mid)} ${n2(cx + pw * 0.7)} ${n2(floor)} Z`
}

function canalPath(g: Geo, c: Canal): string {
  const { pw, floor } = pulpGeom(g)
  const w = g.nRoots > 1 ? Math.max(g.cw * 0.045, 1.15) : Math.max(pw * 0.62, 1.2)
  const y0 = floor + 2.5
  const mid = y0 - (y0 - c.tipY) * 0.5
  return `M ${n2(c.topX - w)} ${n2(y0)}
    C ${n2(c.topX - w * 0.8)} ${n2(mid)} ${n2(c.tipX - 0.45)} ${n2(c.tipY + 7)} ${n2(c.tipX)} ${n2(c.tipY + 2.2)}
    C ${n2(c.tipX + 0.45)} ${n2(c.tipY + 7)} ${n2(c.topX + w * 0.8)} ${n2(mid)} ${n2(c.topX + w)} ${n2(y0)} Z`
}

// ─── Tek diş ────────────────────────────────────────────────────────────────

function ToothGraphic({ num, jaw, flags, fit = false, prosthetic = false }: { num: number; jaw: Jaw; flags: ToothFlags; /** true: kapsayıcıya sığacak şekilde ölçeklenir (tarife simgeleri) */ fit?: boolean; /** true: eksik dişin yerine parsiyel protez dişi çizilir */ prosthetic?: boolean }) {
  const height = TOOTH_HEIGHT
  const g = geo(num)
  const { cx, cw, J, H, L, vbw, type } = g
  const w = (height * vbw) / VBH
  const extracted = flags.extracted && !flags.implant

  // Çekilmiş/eksik diş (veya tam protezli çene) → boş slot
  if (extracted && !prosthetic) {
    return <svg width={w} height={height} viewBox={`0 0 ${n2(vbw)} ${VBH}`} style={{ overflow: 'visible' }} />
  }

  const crownD = crownPath(g)
  const clipId = `tc-clip-${num}`
  const crownColor = flags.crownMaterial === 'zirconium' ? '#FCD34D' : '#93C5FD'
  const crownStroke = flags.crownMaterial === 'zirconium' ? '#B7791F' : '#3B82C4'
  const outline = '#B3A183'
  const inner: React.ReactNode[] = []

  const gloss = (key: string, opacity: number) => (
    <ellipse key={key} cx={n2(cx + g.ms * cw * 0.16)} cy={n2(J + H * 0.45)} rx={n2(cw * 0.2)} ry={n2(H * 0.3)} fill="url(#tc-gloss)" opacity={opacity} clipPath={`url(#${clipId})`} />
  )
  inner.push(<clipPath key="clip" id={clipId}><path d={crownD} /></clipPath>)

  if (prosthetic) {
    // ---- PARSİYEL PROTEZ: akrilik eyer + protez diş; TAM PROTEZ: yalnızca kökü olmayan protez diş ----
    inner.push(
      !flags.totalProsthesis && <path key="saddle" d={`M ${n2(cx - cw * 0.5)} ${n2(J + 3)} C ${n2(cx - cw * 0.54)} ${n2(J - 4)} ${n2(cx - cw * 0.46)} ${n2(J - 10)} ${n2(cx - cw * 0.3)} ${n2(J - 11.5)} Q ${n2(cx)} ${n2(J - 14)} ${n2(cx + cw * 0.3)} ${n2(J - 11.5)} C ${n2(cx + cw * 0.46)} ${n2(J - 10)} ${n2(cx + cw * 0.54)} ${n2(J - 4)} ${n2(cx + cw * 0.5)} ${n2(J + 3)} Q ${n2(cx)} ${n2(J + 6.5)} ${n2(cx - cw * 0.5)} ${n2(J + 3)} Z`} fill="url(#tc-acrylic)" stroke="#B85A70" strokeWidth={0.8} strokeLinejoin="round" />,
      <path key="pcrown" d={crownD} fill="url(#tc-denture-tooth)" stroke="#B8AC92" strokeWidth={0.8} strokeLinejoin="round" />,
      <path key="ptint" d={crownD} fill="url(#tc-enamel-tint)" stroke="none" />,
      gloss('pgloss', 0.9)
    )
  } else if (flags.implant) {
    // ---- İMPLANT: kök yerine titanyum vida ----
    const top = Math.min(Math.max(cw * 0.2, 2.8), 5.4)
    const apex = top * 0.55
    const topY = J - 1.5
    const apexY = J - Math.min(L * 0.84, 42)
    inner.push(
      <path
        key="post"
        d={`M ${n2(cx - top)} ${n2(topY)} L ${n2(cx - apex)} ${n2(apexY + 2)} Q ${n2(cx)} ${n2(apexY - 1.5)} ${n2(cx + apex)} ${n2(apexY + 2)} L ${n2(cx + top)} ${n2(topY)} Z`}
        fill="url(#tc-metal)" stroke="#6E7A84" strokeWidth={0.7} strokeLinejoin="round"
      />
    )
    const threads: React.ReactNode[] = []
    for (let y = topY - 3; y > apexY + 3; y -= 2.9) {
      const f = (topY - y) / (topY - apexY)
      const hw = top - (top - apex) * f
      threads.push(<path key={`t${n2(y)}`} d={`M ${n2(cx - hw - 0.7)} ${n2(y + 0.7)} L ${n2(cx + hw + 0.7)} ${n2(y - 0.7)}`} stroke="#5B6770" strokeWidth={0.75} strokeLinecap="round" strokeOpacity={0.85} fill="none" />)
    }
    inner.push(<g key="threads">{threads}</g>)
    if (flags.crown) {
      inner.push(
        <path key="abut" d={`M ${n2(cx - top * 0.9)} ${n2(topY)} L ${n2(cx - top * 0.6)} ${n2(J + H * 0.3)} L ${n2(cx + top * 0.6)} ${n2(J + H * 0.3)} L ${n2(cx + top * 0.9)} ${n2(topY)} Z`} fill="#C8CED3" stroke="#7C8893" strokeWidth={0.6} />,
        <path key="icrown" d={crownD} fill={crownColor} stroke={crownStroke} strokeWidth={0.9} strokeLinejoin="round" />,
        gloss('igloss', 0.75)
      )
    } else {
      inner.push(<rect key="cap" x={n2(cx - top * 1.05)} y={n2(topY)} width={n2(top * 2.1)} height={3.4} rx={1.4} fill="#D5DADF" stroke="#7C8893" strokeWidth={0.6} />)
    }
  } else {
    // ---- DOĞAL DİŞ ----
    const roots = buildRoots(g)
    // Apikal rezeksiyon: kök ucu (son %20) eğik düzlemle kesilir
    const cutY = J - L * 0.72
    const keepId = `tc-keep-${num}`
    const bandId = `tc-band-${num}`
    const xa = -30, xb = vbw + 30
    const resect = Boolean(flags.apicalResection)
    if (resect) {
      inner.push(
        <clipPath key="keep" id={keepId}><polygon points={`${xa},${n2(cutY + 1.8)} ${xb},${n2(cutY - 1.8)} ${xb},${VBH + 60} ${xa},${VBH + 60}`} /></clipPath>,
        <clipPath key="band" id={bandId}><polygon points={`${xa},${n2(cutY + 1.8)} ${xb},${n2(cutY - 1.8)} ${xb},${n2(cutY - 1.8 + 3.4)} ${xa},${n2(cutY + 1.8 + 3.4)}`} /></clipPath>
      )
    }
    const showInternals = !flags.totalProsthesis
    if (showInternals) {
      inner.push(
        <g key="roots" clipPath={resect ? `url(#${keepId})` : undefined}>
          {roots.back.map((d, i) => <path key={`rb${i}`} d={d} fill="url(#tc-root-back)" stroke="#A98B62" strokeWidth={0.6} strokeLinejoin="round" />)}
          {roots.front.map((d, i) => <path key={`rf${i}`} d={d} fill="url(#tc-root)" stroke="#AE8F64" strokeWidth={0.7} strokeLinejoin="round" />)}
        </g>
      )
      if (resect) {
        inner.push(
          <g key="cutface" clipPath={`url(#${bandId})`}>
            {[...roots.back, ...roots.front].map((d, i) => <path key={`cf${i}`} d={d} fill="#6B5640" stroke="#4E3E2D" strokeWidth={0.5} />)}
          </g>,
          <g key="retro">
            {roots.canals.map((c, i) => {
              const floor = J - 4
              const frac = Math.min(Math.max((floor - cutY) / Math.max(floor - c.tipY, 1), 0), 1)
              return <circle key={`rt${i}`} cx={n2(c.topX + (c.tipX - c.topX) * frac)} cy={n2(cutY)} r={1.6} fill="#B7C0C8" stroke="#5B6770" strokeWidth={0.4} />
            })}
          </g>
        )
      }
      // Pulpa + kanallar: sağlıklı dişte dişin içinden hafifçe seçilir; kanal tedavisinde dolgu olarak belirginleşir
      const treated = flags.canal || flags.poorCanal
      const pulpFill = flags.poorCanal ? '#1A1A1A' : flags.canal ? '#FFFBF0' : '#CF5565'
      const pulpStroke = flags.poorCanal ? '#000000' : flags.canal ? '#A39574' : 'none'
      inner.push(
        <g key="pulp-root" opacity={flags.poorCanal ? 0.85 : flags.canal ? 1 : 0.5} clipPath={resect ? `url(#${keepId})` : undefined}>
          {roots.canals.map((c, i) => <path key={`cn${i}`} d={canalPath(g, c)} fill={pulpFill} stroke={pulpStroke} strokeWidth={treated ? 0.5 : 0} />)}
        </g>
      )
    }
    // Kron: mine (silindirik gölge) + servikal sıcaklık / insizal saydamlık bindirmesi
    inner.push(
      <path key="crown" d={crownD} fill={flags.crown ? crownColor : 'url(#tc-enamel)'} stroke={flags.crown ? crownStroke : outline} strokeWidth={flags.crown ? 1 : 0.8} strokeLinejoin="round" />
    )
    if (!flags.crown) {
      inner.push(<path key="tint" d={crownD} fill="url(#tc-enamel-tint)" stroke="none" />)
      if (showInternals) {
        const treated = flags.canal || flags.poorCanal
        inner.push(
          <path
            key="pulp-crown" d={pulpChamberPath(g)} clipPath={`url(#${clipId})`}
            fill={flags.poorCanal ? '#1A1A1A' : flags.canal ? '#FFFBF0' : '#CF5565'}
            stroke={flags.poorCanal ? '#000000' : flags.canal ? '#A39574' : 'none'} strokeWidth={treated ? 0.5 : 0}
            opacity={flags.poorCanal ? 0.8 : flags.canal ? 0.95 : 0.13}
          />
        )
      }
      inner.push(
        ...crownGrooves(g).map((d, i) => <path key={`gr${i}`} d={d} fill="none" stroke="#9C8B6B" strokeWidth={0.55} strokeLinecap="round" strokeOpacity={0.24} />)
      )
    }
    inner.push(gloss('gloss', flags.crown ? 0.7 : 0.95))

    // ---- Tedavi sembolleri ----
    if (flags.filling) {
      inner.push(
        <ellipse key="fill" cx={n2(cx - g.ms * cw * 0.04)} cy={n2(J + H * (type === 'molar' || type === 'premolar' ? 0.8 : 0.72))} rx={n2(cw * 0.27)} ry={n2(H * 0.16)} fill="url(#tc-amalgam)" stroke="#69747E" strokeWidth={0.5} clipPath={`url(#${clipId})`} />
      )
    }
    if (flags.crown) {
      inner.push(<path key="margin" d={`M ${n2(cx - g.nw / 2 - 0.6)} ${n2(J + H * 0.1)} Q ${n2(cx)} ${n2(J + H * 0.02)} ${n2(cx + g.nw / 2 + 0.6)} ${n2(J + H * 0.1)}`} fill="none" stroke={crownStroke} strokeWidth={0.9} strokeOpacity={0.9} />)
    }

    // ── Diyagnoz sembolleri ──
    const sx = cx + g.ms * cw * 0.3
    const sy = J + H * 0.82
    if (flags.mineCaryo) {
      inner.push(<ellipse key="mineCaryo" cx={n2(sx)} cy={n2(sy)} rx={n2(cw * 0.13)} ry={n2(H * 0.09)} fill="#2A1203" fillOpacity={0.85} clipPath={`url(#${clipId})`} />)
    }
    if (flags.dentinCaryo) {
      const { roof } = pulpGeom(g)
      inner.push(
        <path
          key="dentinCaryo" clipPath={`url(#${clipId})`}
          d={`M ${n2(sx + g.ms * cw * 0.14)} ${n2(sy + H * 0.1)} Q ${n2(sx + g.ms * cw * 0.2)} ${n2(sy - H * 0.12)} ${n2(sx)} ${n2(sy - H * 0.16)} Q ${n2(cx + g.ms * cw * 0.08)} ${n2(sy - H * 0.2)} ${n2(cx)} ${n2(roof + 1)} Q ${n2(cx + g.ms * cw * 0.1)} ${n2(sy)} ${n2(sx - g.ms * cw * 0.1)} ${n2(sy + H * 0.12)} Z`}
          fill="#2A1203" fillOpacity={0.78} stroke="#3A1804" strokeWidth={0.3}
        />
      )
    }
    if (flags.periapical && showInternals) {
      inner.push(
        <g key="periapical">
          {roots.canals.map((c, i) => <circle key={`ls${i}`} cx={n2(c.tipX)} cy={n2(c.tipY)} r={n2(Math.min(cw * 0.2, 6))} fill="#7C3AED" fillOpacity={0.16} stroke="#7C3AED" strokeWidth={1.1} />)}
        </g>
      )
    }
    if (flags.nerve) {
      const nervY = n2(J - L * 0.62)
      inner.push(<line key="nerve" x1={0} y1={nervY} x2={n2(vbw)} y2={nervY} stroke="#D97706" strokeWidth={1.3} strokeDasharray="5,2.5" strokeLinecap="round" />)
    }
  }

  return (
    <svg width={fit ? '100%' : w} height={fit ? '100%' : height} viewBox={fit ? `-3 -2 ${n2(vbw + 6)} ${VBH + 4}` : `0 0 ${n2(vbw)} ${VBH}`} className="drop-shadow-[0_3px_4px_rgba(90,70,40,0.16)]" style={{ overflow: 'visible' }}>
      <g transform={jaw === 'lower' ? `translate(0 ${VBH}) scale(1 -1)` : undefined}>{inner}</g>
    </svg>
  )
}

function ToothDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        {/* Mine: mezio-distal silindirik gölgelendirme */}
        <linearGradient id="tc-enamel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#DDD3BC" />
          <stop offset="0.14" stopColor="#F4EFE2" />
          <stop offset="0.4" stopColor="#FFFFFF" />
          <stop offset="0.7" stopColor="#F6F1E4" />
          <stop offset="1" stopColor="#D3C7AC" />
        </linearGradient>
        {/* Servikalde sıcak ton, insizal/okluzal kenarda mavimsi saydamlık */}
        <linearGradient id="tc-enamel-tint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E3BF7C" stopOpacity="0.6" />
          <stop offset="0.38" stopColor="#EAD3A0" stopOpacity="0.06" />
          <stop offset="0.76" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#8FA9C2" stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id="tc-gloss" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.28" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tc-porcelain" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E2DDCF" />
          <stop offset="0.4" stopColor="#FEFEFB" />
          <stop offset="1" stopColor="#DAD4C3" />
        </linearGradient>
        {/* Kök (sement): daha sarı, kenarlarda koyulaşır */}
        <linearGradient id="tc-root" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#C9A672" />
          <stop offset="0.3" stopColor="#F1DDB0" />
          <stop offset="0.58" stopColor="#EACF9C" />
          <stop offset="1" stopColor="#BD9864" />
        </linearGradient>
        <linearGradient id="tc-root-back" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#B8935F" />
          <stop offset="0.5" stopColor="#DCC08C" />
          <stop offset="1" stopColor="#AE8955" />
        </linearGradient>
        {/* Akrilik protez kaidesi + protez diş */}
        <linearGradient id="tc-acrylic" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2A9B6" />
          <stop offset="1" stopColor="#E2778F" />
        </linearGradient>
        <linearGradient id="tc-denture-tooth" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E8DEC4" />
          <stop offset="0.4" stopColor="#FFFCF2" />
          <stop offset="1" stopColor="#E2D6B8" />
        </linearGradient>
        <linearGradient id="tc-palate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7BFC7" />
          <stop offset="1" stopColor="#EC93A3" />
        </linearGradient>
        <linearGradient id="tc-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9BA6AF" />
          <stop offset="0.45" stopColor="#EEF1F4" />
          <stop offset="1" stopColor="#8E99A3" />
        </linearGradient>
        <linearGradient id="tc-amalgam" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C3CCD3" />
          <stop offset="1" stopColor="#838F9A" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export type OralTreatmentSymbolType = 'natural' | 'implant' | 'crown' | 'filling' | 'root-canal'

export function OralTreatmentSymbol({ types, crownMaterial = 'porcelain', className = '' }: { types: OralTreatmentSymbolType[]; crownMaterial?: 'porcelain' | 'zirconium'; className?: string }) {
  const flags: ToothFlags = {}
  for (const type of types) {
    if (type === 'implant') flags.implant = true
    else if (type === 'crown') { flags.crown = true; flags.crownMaterial = crownMaterial }
    else if (type === 'filling') flags.filling = true
    else if (type === 'root-canal') flags.canal = true
  }
  return <div className={`relative flex items-center justify-center ${className}`}><ToothDefs /><ToothGraphic num={14} jaw="upper" flags={flags} fit /></div>
}

const hasTx = (f: ToothFlags) =>
  f.canal || f.filling || f.crown || f.implant || f.extracted ||
  f.graft || f.removableProsthesis || f.totalProsthesis || f.apicalResection || f.mineCaryo || f.dentinCaryo || f.kret || f.nerve || f.periapical || f.poorCanal

const cellWidth = (n: number) => geo(n).vbw * K

/** Gülüş hattı: ön dişler okluzal düzleme doğru hafifçe uzanır (px) */
function smileOffset(index: number, count: number): number {
  const half = (count - 1) / 2
  const t = half === 0 ? 0 : (index - half) / half
  return (1 - Math.pow(Math.abs(t), 1.7)) * 4
}

function NumberRow({
  teeth, selected, states, onSelect, hiddenTeeth, markedTeeth, markerColor,
}: {
  teeth: number[]
  selected: number | null
  states: Map<number, ToothFlags>
  onSelect: (n: number) => void
  hiddenTeeth?: Set<number>
  markedTeeth?: Set<number>
  markerColor?: string
}) {
  return (
    <div className="flex justify-center">
      {teeth.map((n) => {
        const isSel = selected === n
        const tr = hasTx(states.get(n) ?? {})
        // Çekilmiş dişte yalnız diş görseli gizlenir; numara sabit kalır (soluk).
        const hidden = hiddenTeeth?.has(n)
        const marked = markedTeeth?.has(n)
        return (
          <button
            key={n}
            onClick={() => onSelect(n)}
            style={{
              width: cellWidth(n),
              ...(marked && markerColor ? { color: markerColor, backgroundColor: markerColor + '22' } : {}),
            }}
            className={`shrink-0 rounded py-0.5 text-[12px] font-bold transition-colors ${
              isSel
                ? 'bg-[#E6FFFA] text-[#0F766E]'
                : hidden
                ? 'text-slate-300 hover:bg-white/60 hover:text-slate-400'
                : marked
                ? ''
                : tr
                ? 'text-[#A16207]'
                : 'text-slate-500 hover:bg-white/60 hover:text-[#0F2B3D]'
            }`}
            title={hidden ? `Diş ${n} • çekilmiş` : `Diş ${n}`}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Satır boyunca tek parça diş eti: her dişin boynunda kavis, dişler arasında
 * papil; eksik dişlerde düz kret. Üst çene koordinatlarında hesaplanır, alt
 * çene için dikey çevrilir.
 */
function GingivaOverlay({ teeth, jaw, states, hiddenTeeth, prosthetic, uid }: { teeth: number[]; jaw: Jaw; states: Map<number, ToothFlags>; hiddenTeeth?: Set<number>; prosthetic: Set<number>; uid: string }) {
  const cells = teeth.reduce<{ g: Geo; x: number; w: number; sm: number; missing: boolean }[]>((acc, n, i) => {
    const g = geo(n)
    const prev = acc[acc.length - 1]
    const flags = states.get(n) ?? {}
    acc.push({
      g, x: prev ? prev.x + prev.w : 0, w: g.vbw * K, sm: smileOffset(i, teeth.length),
      missing: !prosthetic.has(n) && Boolean((hiddenTeeth?.has(n) && !flags.implant) || (flags.extracted && !flags.implant) || flags.kret || flags.totalProsthesis),
    })
    return acc
  }, [])
  if (cells.length === 0) return null
  const total = cells[cells.length - 1].x + cells[cells.length - 1].w
  const END = 16 // satır uçlarında diş etinin taşma payı (px)

  // Papil uçları (hücre sınırları) ve serbest diş eti kenarı (diş ortası)
  const papY = (i: number, j: number) => {
    const a = cells[i], b = cells[j]
    return ((a.g.J + b.g.J) / 2 + Math.min(a.g.H, b.g.H) * 0.36) * K + (a.sm + b.sm) / 2
  }
  const pap: { x: number; y: number }[] = [{ x: -END, y: papY(0, 0) - 3 }]
  for (let i = 1; i < cells.length; i++) pap.push({ x: cells[i].x, y: papY(i - 1, i) })
  pap.push({ x: total + END, y: papY(cells.length - 1, cells.length - 1) - 3 })
  pap[0].x = -END
  // İlk ve son hücrede papil, hücre kenarında başlar; uç pay düz devam eder
  const edge: string[] = []
  cells.forEach((c, i) => {
    const l = i === 0 ? { x: 0, y: pap[0].y } : pap[i]
    const r = i === cells.length - 1 ? { x: total, y: pap[i + 1].y } : pap[i + 1]
    const mid = c.x + c.w / 2
    const hw = c.w / 2
    const my = c.missing ? Math.min(l.y, r.y) - 4 : (c.g.J + 1.4) * K + c.sm
    if (i === 0) edge.push(`M ${n2(-END)} ${n2(l.y)} L ${n2(l.x)} ${n2(l.y)}`)
    edge.push(`C ${n2(l.x + hw * 0.3)} ${n2(l.y)} ${n2(mid - hw * 0.66)} ${n2(my)} ${n2(mid)} ${n2(my)} C ${n2(mid + hw * 0.66)} ${n2(my)} ${n2(r.x - hw * 0.3)} ${n2(r.y)} ${n2(r.x)} ${n2(r.y)}`)
    if (i === cells.length - 1) edge.push(`L ${n2(total + END)} ${n2(r.y)}`)
  })
  const line = edge.join(' ')
  const area = `${line} L ${n2(total + END)} -8 L ${n2(-END)} -8 Z`
  const fillId = `tc-gum-${uid}`
  const maskGradId = `tc-gum-fade-${uid}`
  const maskId = `tc-gum-mask-${uid}`
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={total} height={TOOTH_HEIGHT} viewBox={`0 0 ${n2(total)} ${TOOTH_HEIGHT}`}
      style={{ overflow: 'visible' }} aria-hidden="true"
    >
      <defs>
        {/* Kök ucuna doğru saydamlaşır: kanal dolgusu ve periapikal lezyon görünür kalır */}
        <linearGradient id={fillId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={TOOTH_HEIGHT}>
          <stop offset="0" stopColor="#E58796" stopOpacity="0" />
          <stop offset="0.26" stopColor="#EC95A2" stopOpacity="0.06" />
          <stop offset="0.4" stopColor="#EC95A2" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#F1A2AD" stopOpacity="0.9" />
          <stop offset="1" stopColor="#F5AFB8" stopOpacity="0.97" />
        </linearGradient>
        <linearGradient id={maskGradId} gradientUnits="userSpaceOnUse" x1={-END} y1="0" x2={total + END} y2="0">
          <stop offset="0" stopColor="#000" />
          <stop offset={n2(END / (total + END * 2))} stopColor="#fff" />
          <stop offset={n2(1 - END / (total + END * 2))} stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-END} y={-10} width={total + END * 2} height={TOOTH_HEIGHT + 20}>
          <rect x={-END} y={-10} width={total + END * 2} height={TOOTH_HEIGHT + 20} fill={`url(#${maskGradId})`} />
        </mask>
      </defs>
      <g transform={jaw === 'lower' ? `translate(0 ${TOOTH_HEIGHT}) scale(1 -1)` : undefined} mask={`url(#${maskId})`}>
        <path d={area} fill={`url(#${fillId})`} />
        <path d={line} fill="none" stroke="#FBD3D8" strokeWidth={2.2} strokeOpacity={0.8} strokeLinecap="round" transform="translate(0 -1.2)" />
        <path d={line} fill="none" stroke="#D0667A" strokeWidth={0.9} strokeOpacity={0.7} strokeLinecap="round" />
      </g>
    </svg>
  )
}

function TeethRow({
  teeth, jaw, selected, states, onSelect, hiddenTeeth, markedTeeth, markerColor, uid,
}: {
  teeth: number[]
  jaw: Jaw
  selected: number | null
  states: Map<number, ToothFlags>
  onSelect: (n: number) => void
  hiddenTeeth?: Set<number>
  markedTeeth?: Set<number>
  markerColor?: string
  uid: string
}) {
  // Parsiyel protez: çenede hareketli protez varsa çekilmiş/eksik dişlerin yerine protez diş çizilir (8'ler hariç)
  const hasPartial = teeth.some((t) => states.get(t)?.removableProsthesis)
  const hasTotal = teeth.some((t) => states.get(t)?.totalProsthesis)
  const prosthetic = new Set(
    hasTotal
      ? teeth
      : hasPartial
      ? teeth.filter((t) => {
          const fl = states.get(t) ?? {}
          return t % 10 !== 8 && !fl.implant && (hiddenTeeth?.has(t) || fl.extracted)
        })
      : []
  )
  return (
    <div className="flex justify-center">
      <div className={`relative flex ${jaw === 'upper' ? 'items-end' : 'items-start'}`}>
        {/* Diş eti dişlerin ARKASINDA: kökler pembe zemin üzerinde görünür, dişlerin üstüne pembe binmez */}
        {!hasTotal && <GingivaOverlay teeth={teeth} jaw={jaw} states={states} hiddenTeeth={hiddenTeeth} prosthetic={prosthetic} uid={uid} />}
        {teeth.map((n, i) => {
          const flags = states.get(n) ?? {}
          const isSel = selected === n
          const hidden = hiddenTeeth?.has(n) && !flags.implant && !prosthetic.has(n)
          const marked = markedTeeth?.has(n)
          const width = cellWidth(n)
          const smile = smileOffset(i, teeth.length)
          return (
            <button
              key={n}
              onClick={() => onSelect(n)}
              style={{
                width,
                minWidth: width,
                transform: `translateY(${jaw === 'upper' ? smile : -smile}px)`,
                ...(hidden ? { visibility: 'hidden' as const, pointerEvents: 'none' as const } : {}),
                ...(marked && markerColor ? { boxShadow: `0 0 0 2.5px ${markerColor}`, borderRadius: '12px' } : {}),
              }}
              className={`group flex shrink-0 items-center justify-center rounded-xl p-0 transition-[background-color,box-shadow] duration-150 hover:bg-[#E6FFFA]/60 ${
                isSel ? 'bg-[#E6FFFA]/80 ring-2 ring-[#5FD3C1] shadow-[0_8px_18px_rgba(13,148,136,0.14)]' : ''
              }`}
              title={`Diş ${n}${hasTx(flags) ? ' • işlem var' : ''}`}
            >
              <ToothGraphic num={n} jaw={jaw} flags={flags} prosthetic={prosthetic.has(n)} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ToothChart({
  upperTeeth, lowerTeeth, selected, states, onSelect, hiddenTeeth, markedTeeth, markerColor,
}: {
  upperTeeth: number[]
  lowerTeeth: number[]
  selected: number | null
  states: Map<number, ToothFlags>
  onSelect: (n: number) => void
  hiddenTeeth?: Set<number>
  markedTeeth?: Set<number>
  markerColor?: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const graftMarkers = [...states.entries()].filter(([, flags]) => flags.graft).map(([tooth]) => {
    const row = upperTeeth.includes(tooth) ? upperTeeth : lowerTeeth
    const index = row.indexOf(tooth)
    return index < 0 ? null : ((index + 0.5) / row.length) * 100
  }).filter((value): value is number => value !== null)
  return (
    <div className="overflow-hidden rounded-[22px] border border-[#F1E6D0] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF9EF_100%)] px-2 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:px-4">
      <ToothDefs />
      <div className="mx-auto w-full max-w-[760px] py-2">
        <NumberRow teeth={upperTeeth} selected={selected} states={states} onSelect={onSelect} hiddenTeeth={hiddenTeeth} markedTeeth={markedTeeth} markerColor={markerColor} />
        <TeethRow teeth={upperTeeth} jaw="upper" selected={selected} states={states} onSelect={onSelect} hiddenTeeth={hiddenTeeth} markedTeeth={markedTeeth} markerColor={markerColor} uid={`${uid}u`} />
        <div className="relative my-3 h-3">
          {graftMarkers.map((left, index) => <span key={`${left}-${index}`} className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-0.5" style={{ left: `${left}%` }}><i className="h-1.5 w-1.5 rounded-full border border-slate-300 bg-white shadow-sm"/><i className="h-1 w-1 rounded-full border border-slate-300 bg-white"/><i className="h-1.5 w-1.5 rounded-full border border-slate-300 bg-white shadow-sm"/></span>)}
        </div>
        <TeethRow teeth={lowerTeeth} jaw="lower" selected={selected} states={states} onSelect={onSelect} hiddenTeeth={hiddenTeeth} markedTeeth={markedTeeth} markerColor={markerColor} uid={`${uid}l`} />
        <NumberRow teeth={lowerTeeth} selected={selected} states={states} onSelect={onSelect} hiddenTeeth={hiddenTeeth} markedTeeth={markedTeeth} markerColor={markerColor} />
      </div>
    </div>
  )
}
