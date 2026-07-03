'use client'

import React from 'react'

/**
 * Anatomik FDI diş şeması — tamamen SVG (dış görsele/CDN'e bağımlılık yok).
 * Her diş, FDI numarasına göre tip + kök sayısıyla vektörel çizilir; kökler,
 * pulpa ve kanallar gösterilir. Tedaviler dişin üzerine sembolik işlenir:
 *   - kanal tedavisi → kanal kırmızıdan beyaza döner
 *   - dolgu          → kron üzerinde sembolik dolgu
 *   - kron/kaplama   → kron üzerine porselen kep + altın marj çizgisi
 *   - implant        → kök yerine vida şeması
 *   - çekim          → diş soluk + kırmızı çarpı
 */

type Jaw = 'upper' | 'lower'
type ToothType = 'incisor' | 'canine' | 'premolar' | 'molar'

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

// FDI kök sayıları (referans tablodan birebir)
const ROOTS: Record<number, number> = {
  18: 3, 17: 3, 16: 3, 15: 1, 14: 2, 13: 1, 12: 1, 11: 1,
  21: 1, 22: 1, 23: 1, 24: 2, 25: 1, 26: 3, 27: 3, 28: 3,
  48: 2, 47: 2, 46: 2, 45: 1, 44: 1, 43: 1, 42: 1, 41: 1,
  31: 1, 32: 1, 33: 1, 34: 1, 35: 1, 36: 2, 37: 2, 38: 2,
  55: 3, 54: 3, 53: 1, 52: 1, 51: 1, 61: 1, 62: 1, 63: 1, 64: 3, 65: 3,
  85: 2, 84: 2, 83: 1, 82: 1, 81: 1, 71: 1, 72: 1, 73: 1, 74: 2, 75: 2,
}

function toothType(num: number): ToothType {
  const d = num % 10
  const primary = num >= 51
  if (d === 1 || d === 2) return 'incisor'
  if (d === 3) return 'canine'
  if (primary) return 'molar'
  if (d === 4 || d === 5) return 'premolar'
  return 'molar'
}

const BASE_DIMS: Record<ToothType, { cw: number; vbw: number }> = {
  incisor: { cw: 23, vbw: 36 },
  canine: { cw: 25, vbw: 39 },
  premolar: { cw: 30, vbw: 45 },
  molar: { cw: 40, vbw: 55 },
}
const VBH = 100
const TOOTH_HEIGHT = 78
const J = 55 // mine-sement sınırı
const NECK = 61
const OCC = 92 // insizal / okluzal uç
const TIP = 4
const PULP_FLOOR = 67

function toothDigit(num: number): number {
  return num % 10
}

function isPrimaryTooth(num: number): boolean {
  return num >= 51
}

function archDirection(num: number): -1 | 1 {
  const quadrant = Math.floor(num / 10)
  return [1, 4, 5, 8].includes(quadrant) ? -1 : 1
}

function toothDims(num: number): { cw: number; vbw: number } {
  const type = toothType(num)
  const digit = toothDigit(num)
  const upper = [1, 2, 5, 6].includes(Math.floor(num / 10))
  let scale = 1

  if (type === 'incisor') {
    scale = digit === 1 ? (upper ? 1.12 : 0.82) : (upper ? 0.94 : 0.76)
  } else if (type === 'canine') {
    scale = upper ? 1.05 : 0.92
  } else if (type === 'premolar') {
    scale = digit === 4 ? 1 : 0.94
  } else if (isPrimaryTooth(num)) {
    scale = digit === 4 ? 0.9 : 0.96
  } else {
    scale = digit === 6 ? 1.08 : digit === 7 ? 1 : 0.86
  }

  const base = BASE_DIMS[type]
  const cw = base.cw * scale
  return { cw, vbw: Math.max(base.vbw * scale, cw + 14) }
}

function crownPath(t: ToothType, cx: number, cw: number, num: number): string {
  const l = cx - cw / 2
  const r = cx + cw / 2
  const digit = toothDigit(num)
  const dir = archDirection(num)

  if (t === 'incisor') {
    const lateral = digit === 2
    const edgeY = lateral ? OCC - 1 : OCC
    const distalDrop = lateral ? 2.2 : 1.1
    return `M ${l + 2.2} ${J}
      C ${l - 0.8} ${NECK + 2} ${l - 0.4} ${OCC - 12} ${l + 2.7} ${edgeY - (dir < 0 ? distalDrop : 0.4)}
      Q ${cx - cw * 0.22} ${OCC + (lateral ? 1.4 : 0.5)} ${cx} ${OCC + (lateral ? 1.8 : 0.8)}
      Q ${cx + cw * 0.22} ${OCC + (lateral ? 1.4 : 0.5)} ${r - 2.7} ${edgeY - (dir > 0 ? distalDrop : 0.4)}
      C ${r + 0.4} ${OCC - 12} ${r + 0.8} ${NECK + 2} ${r - 2.2} ${J}
      Q ${cx} ${J + 4.2} ${l + 2.2} ${J} Z`
  }
  if (t === 'canine') {
    const cuspX = cx + dir * cw * 0.04
    return `M ${l + 2} ${J}
      C ${l - 1} ${NECK + 1} ${l - 0.5} ${OCC - 13} ${l + 4} ${OCC - 5}
      Q ${cx - dir * cw * 0.14} ${OCC - 1} ${cuspX} ${OCC + 4.5}
      Q ${cx + dir * cw * 0.2} ${OCC - 0.5} ${r - 4} ${OCC - 5.5}
      C ${r + 0.5} ${OCC - 13} ${r + 1} ${NECK + 1} ${r - 2} ${J}
      Q ${cx} ${J + 4} ${l + 2} ${J} Z`
  }
  if (t === 'premolar') {
    const first = digit === 4
    const leftCusp = cx - cw * 0.2
    const rightCusp = cx + cw * 0.2
    return `M ${l + 2} ${J}
      C ${l - 1.5} ${NECK + 1} ${l - 1} ${OCC - 13} ${l + 3.5} ${OCC - 5}
      Q ${leftCusp - 2} ${OCC - 1} ${leftCusp} ${OCC + (first ? 3.2 : 2.3)}
      Q ${cx - 2} ${OCC - 3} ${cx} ${OCC - 5.4}
      Q ${cx + 2} ${OCC - 3} ${rightCusp} ${OCC + (first ? 2.2 : 2.8)}
      Q ${rightCusp + 2} ${OCC - 1} ${r - 3.5} ${OCC - 5}
      C ${r + 1} ${OCC - 13} ${r + 1.5} ${NECK + 1} ${r - 2} ${J}
      Q ${cx} ${J + 4.4} ${l + 2} ${J} Z`
  }

  const firstMolar = digit === 6
  const cusp = firstMolar ? 3.4 : 2.8
  return `M ${l + 2.4} ${J}
    C ${l - 1.8} ${NECK} ${l - 1.5} ${OCC - 13} ${l + 3.2} ${OCC - 5.5}
    Q ${l + cw * 0.15} ${OCC - 1} ${l + cw * 0.22} ${OCC + cusp}
    Q ${l + cw * 0.32} ${OCC - 2.5} ${l + cw * 0.43} ${OCC + cusp * 0.7}
    Q ${cx} ${OCC - 3.5} ${l + cw * 0.57} ${OCC + cusp * 0.75}
    Q ${l + cw * 0.68} ${OCC - 2.5} ${l + cw * 0.78} ${OCC + cusp}
    Q ${r - cw * 0.15} ${OCC - 1} ${r - 3.2} ${OCC - 5.5}
    C ${r + 1.5} ${OCC - 13} ${r + 1.8} ${NECK} ${r - 2.4} ${J}
    Q ${cx} ${J + 4.6} ${l + 2.4} ${J} Z`
}

function crownDetailPaths(t: ToothType, cx: number, cw: number, num: number): string[] {
  const digit = toothDigit(num)
  if (t === 'incisor') {
    return [
      `M ${cx - cw * 0.25} ${J + 7} C ${cx - cw * 0.19} ${J + 17} ${cx - cw * 0.22} ${OCC - 8} ${cx - cw * 0.1} ${OCC - 2}`,
      `M ${cx + cw * 0.25} ${J + 7} C ${cx + cw * 0.19} ${J + 17} ${cx + cw * 0.22} ${OCC - 8} ${cx + cw * 0.1} ${OCC - 2}`,
      `M ${cx - cw * 0.3} ${OCC - 3} Q ${cx} ${OCC - (digit === 2 ? 5.5 : 4)} ${cx + cw * 0.3} ${OCC - 3}`,
    ]
  }
  if (t === 'canine') {
    return [
      `M ${cx} ${J + 5} C ${cx - 1.6} ${J + 19} ${cx - 1} ${OCC - 7} ${cx} ${OCC + 1}`,
      `M ${cx - cw * 0.3} ${OCC - 5} Q ${cx} ${OCC - 12} ${cx + cw * 0.3} ${OCC - 5}`,
    ]
  }
  if (t === 'premolar') {
    return [
      `M ${cx - cw * 0.34} ${OCC - 5} Q ${cx} ${OCC - (digit === 4 ? 13 : 11)} ${cx + cw * 0.34} ${OCC - 5}`,
      `M ${cx} ${J + 8} C ${cx - 1.5} ${J + 20} ${cx - 1.2} ${OCC - 9} ${cx} ${OCC - 4}`,
    ]
  }
  return [
    `M ${cx - cw * 0.39} ${OCC - 6} Q ${cx - cw * 0.18} ${OCC - 14} ${cx} ${OCC - 6}`,
    `M ${cx} ${OCC - 6} Q ${cx + cw * 0.18} ${OCC - 14} ${cx + cw * 0.39} ${OCC - 6}`,
    `M ${cx - cw * 0.22} ${J + 8} C ${cx - cw * 0.28} ${J + 21} ${cx - cw * 0.24} ${OCC - 10} ${cx - cw * 0.39} ${OCC - 6}`,
    `M ${cx + cw * 0.22} ${J + 8} C ${cx + cw * 0.28} ${J + 21} ${cx + cw * 0.24} ${OCC - 10} ${cx + cw * 0.39} ${OCC - 6}`,
    `M ${cx - cw * 0.3} ${OCC - 9} Q ${cx} ${OCC - 3} ${cx + cw * 0.3} ${OCC - 9}`,
  ]
}

interface RootGeom {
  path: string
  topX: number
  tipX: number
  tipY: number
}

function roots(cx: number, cw: number, n: number, num: number, type: ToothType): RootGeom[] {
  const digit = toothDigit(num)
  const dir = archDirection(num)
  const primary = isPrimaryTooth(num)
  const make = (topX: number, topW: number, tipX: number, tipY: number, belly = 1): RootGeom => {
    const l = topX - topW / 2
    const r = topX + topW / 2
    const mid = (J + tipY) / 2
    return {
      path: `M ${l} ${J + 1}
        C ${l - 1.2 * belly} ${J - 8} ${tipX - topW * 0.46} ${mid + 2} ${tipX - 1.2} ${tipY + 5}
        Q ${tipX} ${tipY - 1.4} ${tipX + 1.2} ${tipY + 5}
        C ${tipX + topW * 0.42} ${mid + 2} ${r + 1 * belly} ${J - 8} ${r} ${J + 1}
        Q ${topX} ${J + 4.2} ${l} ${J + 1} Z`,
      topX,
      tipX,
      tipY,
    }
  }
  if (n <= 1) {
    const widthFactor = type === 'canine' ? 0.52 : type === 'incisor' ? 0.46 : 0.48
    const rootWidth = Math.min(cw * widthFactor, 14)
    const tipY = type === 'canine' ? TIP : type === 'incisor' ? TIP + 4 : TIP + 3
    const curve = type === 'canine' ? 2.8 : digit === 2 ? 2.1 : 1.4
    return [make(cx, rootWidth, cx + dir * curve, tipY, type === 'canine' ? 1.25 : 1.1)]
  }
  if (n === 2) {
    const molar = type === 'molar'
    const rootWidth = cw * (molar ? 0.36 : 0.29)
    const off = cw * (molar ? 0.18 : 0.12)
    const flare = cw * (molar ? (primary ? 0.43 : 0.34) : 0.24)
    const tipY = molar ? TIP + (primary ? 10 : 7) : TIP + 4
    return [
      make(cx - off, rootWidth, cx - flare + dir * 0.8, tipY, 1.15),
      make(cx + off, rootWidth, cx + flare + dir * 0.8, tipY + 1.5, 1.05),
    ]
  }
  const rootWidth = cw * (primary ? 0.25 : 0.27)
  const off = cw * 0.22
  const flare = cw * (primary ? 0.46 : 0.38)
  return [
    make(cx, rootWidth * 1.25, cx + dir * 1.2, TIP + 2, 1.2),
    make(cx - off, rootWidth, cx - flare, TIP + (primary ? 11 : 8), 1.05),
    make(cx + off, rootWidth, cx + flare, TIP + (primary ? 12 : 9), 1.05),
  ]
}

function dentinCorePath(type: ToothType, cx: number, cw: number): string {
  const half = cw * (type === 'molar' ? 0.36 : type === 'premolar' ? 0.31 : 0.28)
  const topY = J + 3
  const endY = type === 'canine' ? OCC - 5 : OCC - 7
  return `M ${cx - half * 0.68} ${topY}
    C ${cx - half} ${J + 14} ${cx - half} ${endY - 5} ${cx - half * 0.54} ${endY}
    Q ${cx} ${endY + (type === 'canine' ? 4 : 1.5)} ${cx + half * 0.54} ${endY}
    C ${cx + half} ${endY - 5} ${cx + half} ${J + 14} ${cx + half * 0.68} ${topY}
    Q ${cx} ${topY + 3} ${cx - half * 0.68} ${topY} Z`
}

// Pulpa odası, diş grubuna göre farklı genişlik ve pulpa boynuzları taşır.
function pulpPath(type: ToothType, cx: number, cw: number): string {
  const pw = Math.min(cw * (type === 'molar' ? 0.22 : type === 'premolar' ? 0.18 : 0.15), 8.5)
  const chamberTop = type === 'molar' ? OCC - 13 : type === 'premolar' ? OCC - 11 : OCC - 9
  return `M ${cx - pw} ${chamberTop}
    C ${cx - pw * 1.1} ${chamberTop - 5} ${cx - pw * 0.75} ${PULP_FLOOR + 2} ${cx - pw * 0.34} ${PULP_FLOOR}
    Q ${cx} ${PULP_FLOOR - 1.5} ${cx + pw * 0.34} ${PULP_FLOOR}
    C ${cx + pw * 0.75} ${PULP_FLOOR + 2} ${cx + pw * 1.1} ${chamberTop - 5} ${cx + pw} ${chamberTop}
    Q ${cx + pw * 0.45} ${chamberTop - 2.5} ${cx} ${chamberTop + 1.5}
    Q ${cx - pw * 0.45} ${chamberTop - 2.5} ${cx - pw} ${chamberTop} Z`
}

// Tek kanal (pulpa tabanından kök ucuna ince mekik)
function canalPath(topX: number, tipX: number, tipY: number, cw: number): string {
  const w = Math.max(cw * 0.1, 1.7)
  const mid = (PULP_FLOOR + tipY) / 2
  return `M ${topX - w} ${PULP_FLOOR}
    C ${topX - w * 0.6} ${mid} ${tipX - 0.8} ${tipY + 8} ${tipX} ${tipY + 2.5}
    C ${tipX + 0.8} ${tipY + 8} ${topX + w * 0.6} ${mid} ${topX + w} ${PULP_FLOOR} Z`
}

function ToothGraphic({
  num,
  jaw,
  flags,
}: {
  num: number
  jaw: Jaw
  flags: ToothFlags
  }) {
  const type = toothType(num)
  const { cw, vbw } = toothDims(num)
  const cx = vbw / 2
  const n = ROOTS[num] ?? 1
  const rs = roots(cx, cw, n, num, type)
  const h = TOOTH_HEIGHT
  const w = (h * vbw) / VBH
  const extracted = flags.extracted && !flags.implant

  // Çekilmiş/eksik diş → boş slot (çarpı yok)
  if (extracted) {
    return <svg width={w} height={h} viewBox={`0 0 ${vbw} ${VBH}`} style={{ overflow: 'visible' }} />
  }

  // Kanal rengi: kanal tedavisi → beyaz (gütaperka), normalde kırmızı
  const canalFill = flags.canal ? '#F7F4EC' : '#C2434E'
  const canalStroke = flags.canal ? '#B9AC8E' : '#8A2730'

  const baseStroke = '#AF5963'
  const detailStroke = '#C5AE78'
  const crownColor = flags.crownMaterial === 'zirconium' ? '#5EEAD4' : '#93C5FD'
  const crownStroke = flags.crownMaterial === 'zirconium' ? '#0F9F91' : '#3B82C4'

  const inner: React.ReactNode[] = []

  if (flags.implant) {
    // ---- İMPLANT: kök yerine titanyum vida ----
    const postTop = cw * 0.24 // neck (geniş)
    const postApex = cw * 0.1 // uç (dar)
    const apexY = TIP + 4
    const lTop = cx - postTop, rTop = cx + postTop
    const lApex = cx - postApex, rApex = cx + postApex
    inner.push(
      <path
        key="post"
        d={`M ${lTop} ${J} L ${lApex} ${apexY} Q ${cx} ${apexY - 2.5} ${rApex} ${apexY} L ${rTop} ${J} Z`}
        fill="url(#tc-metal)"
        stroke="#6E7A84"
        strokeWidth={1}
        strokeLinejoin="round"
      />
    )
    // Vida dişleri (chevron)
    const threads: React.ReactNode[] = []
    for (let y = J - 4; y > apexY + 2; y -= 3.4) {
      const f = (J - y) / (J - apexY)
      const hw = postTop - (postTop - postApex) * f
      threads.push(
        <path
          key={`t${y}`}
          d={`M ${cx - hw} ${y} L ${cx + hw} ${y - 1.8}`}
          stroke="#5B6770"
          strokeWidth={0.7}
          strokeOpacity={0.8}
          fill="none"
        />
      )
    }
    inner.push(<g key="threads">{threads}</g>)
    // Uzun eksen çizgisi
    inner.push(
      <line key="axis" x1={cx} y1={J - 2} x2={cx} y2={apexY + 1} stroke="#7C8893" strokeWidth={0.5} strokeOpacity={0.6} />
    )
    // Kuron ayrıca seçildiyse vida üzerine dayanak ve porselen kuron eklenir.
    if (flags.crown) inner.push(
      <path
        key="abut"
        d={`M ${cx - cw * 0.16} ${J + 1} L ${cx - cw * 0.1} ${J - 2} L ${cx + cw * 0.1} ${J - 2} L ${cx + cw * 0.16} ${J + 1} Z`}
        fill="#C8CED3"
        stroke="#7C8893"
        strokeWidth={0.7}
      />
    )
    if (flags.crown) inner.push(
      <path key="icrown" d={crownPath(type, cx, cw, num)} fill={crownColor} stroke={crownStroke} strokeWidth={1.1} strokeLinejoin="round" />
    )
  } else {
    // ---- DOĞAL DİŞ ----
    if (!flags.removableProsthesis) inner.push(
      ...rs.map((rt, i) => (
        <path key={`r${i}`} d={rt.path} fill="url(#tc-dentin)" stroke={baseStroke} strokeWidth={1.1} strokeLinejoin="round" />
      ))
    )
    if (!flags.removableProsthesis) inner.push(
      ...rs.map((rt, i) => (
        <path
          key={`rh${i}`}
          d={`M ${rt.topX - 1.2} ${J - 1} C ${rt.topX - 2} ${J - 14} ${rt.tipX - 1.4} ${rt.tipY + 12} ${rt.tipX - 0.4} ${rt.tipY + 5}`}
          fill="none"
          stroke="#F7EACB"
          strokeWidth={1.05}
          strokeLinecap="round"
          strokeOpacity={0.58}
        />
      ))
    )
    // Kron minesi (kaplama varsa porselen)
    inner.push(
      <path
        key="crown"
        d={crownPath(type, cx, cw, num)}
        fill={flags.crown ? crownColor : flags.removableProsthesis ? 'url(#tc-porcelain)' : 'url(#tc-enamel)'}
        stroke={baseStroke}
        strokeWidth={1.15}
        strokeLinejoin="round"
      />
    )
    inner.push(
      <path
        key="dentin-core"
        d={dentinCorePath(type, cx, cw)}
        fill="url(#tc-crown-dentin)"
        stroke="#D6BE88"
        strokeWidth={0.55}
        fillOpacity={flags.crown ? 0 : flags.removableProsthesis ? 0.32 : 0.78}
      />
    )
    inner.push(
      ...crownDetailPaths(type, cx, cw, num).map((d, i) => (
        <path
          key={`cd${i}`}
          d={d}
          fill="none"
          stroke={detailStroke}
          strokeWidth={0.65}
          strokeLinecap="round"
          strokeOpacity={0.72}
        />
      ))
    )
    // Kanallar (belirgin kırmızı, pulpa tabanından kök ucuna)
    if (!flags.removableProsthesis) inner.push(
      ...rs.map((rt, i) => (
        <path key={`cn${i}`} d={canalPath(rt.topX, rt.tipX, rt.tipY, cw)} fill={canalFill} stroke={canalStroke} strokeWidth={0.6} fillOpacity={1} />
      ))
    )
    // Pulpa odası
    if (!flags.removableProsthesis) inner.push(<path key="pulp" d={pulpPath(type, cx, cw)} fill={canalFill} stroke={canalStroke} strokeWidth={0.6} fillOpacity={1} />)
    inner.push(
      <path
        key="cej"
        d={`M ${cx - cw * 0.39} ${J + 1.4} Q ${cx} ${J + 5.2} ${cx + cw * 0.39} ${J + 1.4}`}
        fill="none"
        stroke="#B79568"
        strokeWidth={0.8}
        strokeOpacity={0.78}
      />
    )

    // ---- Tedavi sembolleri ----
    // Dolgu (okluzal yüzeyde sembolik)
    if (flags.filling) {
      const fw = cw * 0.3
      inner.push(
        <rect
          key="fill"
          x={cx - fw}
          y={OCC - 11}
          width={fw * 2}
          height={6}
          rx={2}
          fill="#9AA6B0"
          stroke="#6B7680"
          strokeWidth={0.5}
        />
      )
    }
    // Kron / kaplama: yarı saydam porselen kep + altın marj çizgisi
    if (flags.crown) {
      inner.push(
        <path key="cap" d={crownPath(type, cx, cw, num)} fill={crownColor} fillOpacity={0.96} stroke={crownStroke} strokeWidth={1.4} strokeLinejoin="round" />
      )
      inner.push(
        <path
          key="margin"
          d={`M ${cx - cw / 2 + 1} ${J + 4} Q ${cx} ${J + 7} ${cx + cw / 2 - 1} ${J + 4}`}
          fill="none"
          stroke={crownStroke}
          strokeWidth={1}
          strokeOpacity={0.9}
        />
      )
    }

    // ── Diyagnoz sembolleri ──
    // Mine çürüğü: dişin mesio-okluzal köşesinde küçük siyah-kahverengi leke
    if (flags.mineCaryo) {
      const sx = cx - cw * 0.28
      const sy = OCC - 5
      inner.push(
        <path
          key="mineCaryo"
          d={`M ${sx} ${sy} Q ${sx + 2} ${sy - 4} ${sx + cw * 0.18} ${sy - 2} Q ${sx + cw * 0.2} ${sy + 2} ${sx + cw * 0.1} ${sy + 3} Q ${sx - 1} ${sy + 2} ${sx} ${sy} Z`}
          fill="#1C0A00"
          fillOpacity={0.82}
          stroke="none"
        />
      )
    }
    // Dentin çürüğü: aynı leke kanalın içine kadar uzanır
    if (flags.dentinCaryo) {
      const sx = cx - cw * 0.28
      const sy = OCC - 5
      inner.push(
        <path
          key="dentinCaryo"
          d={`M ${sx} ${sy} Q ${sx + 2} ${sy - 5} ${sx + cw * 0.22} ${sy - 3} Q ${sx + cw * 0.28} ${sy + 6} ${cx - 1} ${PULP_FLOOR + 3} Q ${cx - cw * 0.15} ${PULP_FLOOR + 5} ${sx - 2} ${PULP_FLOOR + 2} Q ${sx - 3} ${sy + 4} ${sx} ${sy} Z`}
          fill="#1C0A00"
          fillOpacity={0.72}
          stroke="#2D1000"
          strokeWidth={0.35}
        />
      )
    }
    // Yetersiz kanal: siyah kanal dolgusu
    if (flags.poorCanal) {
      inner.push(
        <g key="poorCanal">
          {rs.map((rt, i) => (
            <path key={`pc${i}`} d={canalPath(rt.topX, rt.tipX, rt.tipY, cw)} fill="#1a1a1a" fillOpacity={0.82} stroke="#000" strokeWidth={0.5} />
          ))}
          <path d={pulpPath(type, cx, cw)} fill="#1a1a1a" fillOpacity={0.82} stroke="#000" strokeWidth={0.5} />
        </g>
      )
    }
    // Periapikal lezyon: kök ucunda mor hale
    if (flags.periapical) {
      inner.push(
        <g key="periapical">
          {rs.map((rt, index) => (
            <circle
              key={`lesion-${index}`}
              cx={rt.tipX}
              cy={rt.tipY - 1}
              r={Math.min(cw * 0.2, 7)}
              fill="#7C3AED"
              fillOpacity={0.15}
              stroke="#7C3AED"
              strokeWidth={1.2}
            />
          ))}
        </g>
      )
    }
    // Kret: diş gizlendiği için render gerekmez
    // Mandibular sinir: kökte yatay kesik çizgi
    if (flags.nerve) {
      const nervY = Math.round((TIP + PULP_FLOOR) / 2)
      inner.push(
        <line
          key="nerve"
          x1={0} y1={nervY} x2={vbw} y2={nervY}
          stroke="#D97706" strokeWidth={1.3} strokeDasharray="5,2.5" strokeLinecap="round"
        />
      )
    }
  }

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${vbw} ${VBH}`}
      className="drop-shadow-[0_8px_12px_rgba(120,96,57,0.10)] transition-transform duration-150 group-hover:-translate-y-0.5"
      style={{ overflow: 'visible' }}
    >
      <g transform={jaw === 'lower' ? `translate(0 ${VBH}) scale(1 -1)` : undefined}>
        {inner}
      </g>
    </svg>
  )
}

function ToothDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <linearGradient id="tc-enamel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FCFAF3" />
          <stop offset="0.48" stopColor="#F6F0DF" />
          <stop offset="1" stopColor="#DFCEA8" />
        </linearGradient>
        <linearGradient id="tc-porcelain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FEFEFB" />
          <stop offset="1" stopColor="#E7E2D2" />
        </linearGradient>
        <linearGradient id="tc-dentin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F1DDAE" />
          <stop offset="0.56" stopColor="#DCBE80" />
          <stop offset="1" stopColor="#CDA96B" />
        </linearGradient>
        <linearGradient id="tc-crown-dentin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E3C98F" />
          <stop offset="1" stopColor="#F1DDA9" />
        </linearGradient>
        <linearGradient id="tc-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#AEB7BF" />
          <stop offset="0.5" stopColor="#E6EAEE" />
          <stop offset="1" stopColor="#9BA6AF" />
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
  return <div className={`relative flex items-center justify-center ${className}`}><ToothDefs /><ToothGraphic num={14} jaw="upper" flags={flags} /></div>
}

const hasTx = (f: ToothFlags) =>
  f.canal || f.filling || f.crown || f.implant || f.extracted ||
  f.graft || f.removableProsthesis || f.mineCaryo || f.dentinCaryo || f.kret || f.nerve || f.periapical || f.poorCanal

function NumberRow({
  teeth,
  selected,
  states,
  onSelect,
  hiddenTeeth,
  markedTeeth,
  markerColor,
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
    <div className="flex justify-center gap-0.5">
      {teeth.map((n) => {
        const isSel = selected === n
        const tr = hasTx(states.get(n) ?? {})
        const hidden = hiddenTeeth?.has(n)
        const marked = markedTeeth?.has(n)
        const { vbw } = toothDims(n)
        const w = (TOOTH_HEIGHT * vbw) / VBH
        return (
          <button
            key={n}
            onClick={() => onSelect(n)}
            style={{
              width: w,
              visibility: hidden ? 'hidden' : 'visible',
              pointerEvents: hidden ? 'none' : 'auto',
              ...(marked && markerColor ? { color: markerColor, backgroundColor: markerColor + '22' } : {}),
            }}
            className={`shrink-0 rounded py-0.5 text-[12px] font-bold transition-colors ${
              isSel
                ? 'bg-[#E6FFFA] text-[#0F766E]'
                : marked
                ? ''
                : tr
                ? 'text-[#A16207]'
                : 'text-slate-500 hover:bg-white/60 hover:text-[#0F2B3D]'
            }`}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}

function TeethRow({
  teeth,
  jaw,
  selected,
  states,
  onSelect,
  hiddenTeeth,
  markedTeeth,
  markerColor,
}: {
  teeth: number[]
  jaw: Jaw
  selected: number | null
  states: Map<number, ToothFlags>
  onSelect: (n: number) => void
  hiddenTeeth?: Set<number>
  markedTeeth?: Set<number>
  markerColor?: string
}) {
  return (
    <div className={`flex justify-center gap-0.5 ${jaw === 'upper' ? 'items-end' : 'items-start'}`}>
      {teeth.map((n) => {
        const flags = states.get(n) ?? {}
        const isSel = selected === n
        const hidden = hiddenTeeth?.has(n)
        const marked = markedTeeth?.has(n)
        const { vbw } = toothDims(n)
        const cellWidth = (TOOTH_HEIGHT * vbw) / VBH
        return (
          <button
            key={n}
            onClick={() => onSelect(n)}
            style={{
              width: cellWidth,
              minWidth: cellWidth,
              ...(hidden ? { visibility: 'hidden' as const, pointerEvents: 'none' as const } : {}),
              ...(marked && markerColor ? { boxShadow: `0 0 0 2.5px ${markerColor}`, borderRadius: '12px' } : {}),
            }}
            className={`group flex shrink-0 items-center justify-center rounded-xl p-0 transition-[background-color,filter,box-shadow] duration-150 hover:bg-white/55 hover:drop-shadow-[0_10px_16px_rgba(15,43,61,0.10)] ${
              isSel
                ? 'bg-[#E6FFFA]/80 ring-2 ring-[#5FD3C1] shadow-[0_8px_18px_rgba(13,148,136,0.14)]'
                : ''
            }`}
            title={`Diş ${n}${hasTx(flags) ? ' • işlem var' : ''}`}
          >
            <ToothGraphic num={n} jaw={jaw} flags={flags} />
          </button>
        )
      })}
    </div>
  )
}

export default function ToothChart({
  upperTeeth,
  lowerTeeth,
  selected,
  states,
  onSelect,
  hiddenTeeth,
  markedTeeth,
  markerColor,
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
        <TeethRow teeth={upperTeeth} jaw="upper" selected={selected} states={states} onSelect={onSelect} hiddenTeeth={hiddenTeeth} markedTeeth={markedTeeth} markerColor={markerColor} />
        <div className="relative my-3 h-3 overflow-hidden rounded-full border-y border-[#C0526A]/20 bg-[#F8DDE1]/45">
          <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#C0526A]/35" />
          {graftMarkers.map((left, index) => <span key={`${left}-${index}`} className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-0.5" style={{ left: `${left}%` }}><i className="h-1.5 w-1.5 rounded-full border border-slate-300 bg-white shadow-sm"/><i className="h-1 w-1 rounded-full border border-slate-300 bg-white"/><i className="h-1.5 w-1.5 rounded-full border border-slate-300 bg-white shadow-sm"/></span>)}
        </div>
        <TeethRow teeth={lowerTeeth} jaw="lower" selected={selected} states={states} onSelect={onSelect} hiddenTeeth={hiddenTeeth} markedTeeth={markedTeeth} markerColor={markerColor} />
        <NumberRow teeth={lowerTeeth} selected={selected} states={states} onSelect={onSelect} hiddenTeeth={hiddenTeeth} markedTeeth={markedTeeth} markerColor={markerColor} />
      </div>
    </div>
  )
}

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
