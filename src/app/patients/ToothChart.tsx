'use client'

import React from 'react'
import { classifyDiagnosis, classifyTreatment, type ToothFlags } from './toothFlags'

export { classifyDiagnosis, classifyTreatment }
export type { ToothFlags, ToothBooleanFlag } from './toothFlags'

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
  const half = cw / 2
  const l = cx - half
  const r = cx + half
  const digit = toothDigit(num)
  const dir = archDirection(num)

  if (t === 'incisor') {
    const lateral = digit === 2
    // Anatomik kural: mesial köşe keskine yakın, distal köşe daha yuvarlaktır.
    const mesDrop = lateral ? 1.6 : 0.7
    const disDrop = lateral ? 4.2 : 2.4
    const leftDrop = dir > 0 ? mesDrop : disDrop
    const rightDrop = dir > 0 ? disDrop : mesDrop
    return `M ${l + 2.4} ${J}
      C ${l - 1.2} ${J + 11} ${l - 0.8} ${OCC - 15} ${l + 1.6} ${OCC - 6 - leftDrop}
      Q ${l + 2.2} ${OCC - leftDrop} ${l + half * 0.42} ${OCC - leftDrop + 1.6}
      Q ${cx} ${OCC + (lateral ? 2.6 : 1.6)} ${r - half * 0.42} ${OCC - rightDrop + 1.6}
      Q ${r - 2.2} ${OCC - rightDrop} ${r - 1.6} ${OCC - 6 - rightDrop}
      C ${r + 0.8} ${OCC - 15} ${r + 1.2} ${J + 11} ${r - 2.4} ${J}
      Q ${cx} ${J + 4.4} ${l + 2.4} ${J} Z`
  }
  if (t === 'canine') {
    // Tüberkül hafif mesialde; mesial yamaç kısa, distal yamaç uzundur.
    const cuspX = cx - dir * half * 0.1
    const mesY = OCC - 6
    const disY = OCC - 9.5
    const leftY = dir > 0 ? mesY : disY
    const rightY = dir > 0 ? disY : mesY
    return `M ${l + 2} ${J}
      C ${l - 1.4} ${J + 10} ${l - 1} ${OCC - 16} ${l + 2.6} ${leftY - 2}
      Q ${l + 3.4} ${leftY} ${l + half * 0.34} ${leftY + 1.6}
      Q ${cuspX - half * 0.28} ${OCC - 2.2} ${cuspX} ${OCC + 5.2}
      Q ${cuspX + half * 0.3} ${OCC - 2.6} ${r - half * 0.34} ${rightY + 1.6}
      Q ${r - 3.4} ${rightY} ${r - 2.6} ${rightY - 2}
      C ${r + 1} ${OCC - 16} ${r + 1.4} ${J + 10} ${r - 2} ${J}
      Q ${cx} ${J + 4.2} ${l + 2} ${J} Z`
  }
  if (t === 'premolar') {
    // İki tüberkül: bukkal tüberkül daha belirgin, aralarında fissür çentiği.
    const first = digit === 4
    const cuspL = cx - half * 0.42
    const cuspR = cx + half * 0.42
    const cuspLY = OCC + (first ? 3.6 : 2.8)
    const cuspRY = OCC + (first ? 2.2 : 3)
    return `M ${l + 2} ${J}
      C ${l - 1.6} ${J + 10} ${l - 1.2} ${OCC - 14} ${l + 2.6} ${OCC - 6}
      Q ${cuspL - half * 0.16} ${OCC - 1.6} ${cuspL} ${cuspLY}
      Q ${cx - half * 0.1} ${OCC - 4.8} ${cx} ${OCC - 6.6}
      Q ${cx + half * 0.1} ${OCC - 4.8} ${cuspR} ${cuspRY}
      Q ${cuspR + half * 0.16} ${OCC - 1.6} ${r - 2.6} ${OCC - 6}
      C ${r + 1.2} ${OCC - 14} ${r + 1.6} ${J + 10} ${r - 2} ${J}
      Q ${cx} ${J + 4.6} ${l + 2} ${J} Z`
  }

  // Molar: dört tüberkül, derin fissürler, kontak noktalarında geniş gövde.
  const firstMolar = digit === 6
  const cusp = firstMolar ? 3.8 : 3
  const notch = 5.2
  return `M ${l + 2.6} ${J}
    C ${l - 2} ${J + 9} ${l - 1.8} ${OCC - 13} ${l + 2.8} ${OCC - 6.5}
    Q ${l + cw * 0.1} ${OCC - 1.2} ${l + cw * 0.18} ${OCC + cusp}
    Q ${l + cw * 0.29} ${OCC - notch} ${l + cw * 0.4} ${OCC + cusp * 0.8}
    Q ${cx} ${OCC - notch + 1.6} ${l + cw * 0.6} ${OCC + cusp * 0.85}
    Q ${l + cw * 0.71} ${OCC - notch} ${l + cw * 0.82} ${OCC + cusp}
    Q ${r - cw * 0.1} ${OCC - 1.2} ${r - 2.8} ${OCC - 6.5}
    C ${r + 1.8} ${OCC - 13} ${r + 2} ${J + 9} ${r - 2.6} ${J}
    Q ${cx} ${J + 4.8} ${l + 2.6} ${J} Z`
}

function crownDetailPaths(t: ToothType, cx: number, cw: number, num: number): string[] {
  const digit = toothDigit(num)
  const dir = archDirection(num)
  if (t === 'incisor') {
    // İnsizal üçlüde iki mamelon oluğu + servikal kavis
    return [
      `M ${cx - cw * 0.13} ${OCC - 14} Q ${cx - cw * 0.15} ${OCC - 6} ${cx - cw * 0.1} ${OCC - 1.5}`,
      `M ${cx + cw * 0.13} ${OCC - 14} Q ${cx + cw * 0.15} ${OCC - 6} ${cx + cw * 0.1} ${OCC - 1.5}`,
      `M ${cx - cw * 0.28} ${J + 9} Q ${cx} ${J + (digit === 2 ? 12.5 : 13.5)} ${cx + cw * 0.28} ${J + 9}`,
    ]
  }
  if (t === 'canine') {
    // Labial kret (tüberküle inen dikey sırt) + servikal kavis
    return [
      `M ${cx - dir * cw * 0.02} ${J + 9} C ${cx - dir * cw * 0.04} ${J + 20} ${cx - dir * cw * 0.05} ${OCC - 8} ${cx - dir * cw * 0.05} ${OCC + 1}`,
      `M ${cx - cw * 0.28} ${J + 9} Q ${cx} ${J + 13} ${cx + cw * 0.28} ${J + 9}`,
    ]
  }
  if (t === 'premolar') {
    // Merkez fissür + mesial/distal pit çentikleri
    return [
      `M ${cx - cw * 0.3} ${OCC - 4.4} Q ${cx} ${OCC - (digit === 4 ? 10 : 9)} ${cx + cw * 0.3} ${OCC - 4.4}`,
      `M ${cx - cw * 0.36} ${OCC - 7} Q ${cx - cw * 0.32} ${OCC - 5.2} ${cx - cw * 0.29} ${OCC - 6.8}`,
      `M ${cx + cw * 0.36} ${OCC - 7} Q ${cx + cw * 0.32} ${OCC - 5.2} ${cx + cw * 0.29} ${OCC - 6.8}`,
      `M ${cx - cw * 0.26} ${J + 9} Q ${cx} ${J + 13} ${cx + cw * 0.26} ${J + 9}`,
    ]
  }
  // Molar: H-desenli fissür sistemi + bukkal oluklar + servikal kavis
  return [
    `M ${cx - cw * 0.3} ${OCC - 4} Q ${cx - cw * 0.16} ${OCC - 9} ${cx - cw * 0.02} ${OCC - 5.2}`,
    `M ${cx + cw * 0.02} ${OCC - 5.2} Q ${cx + cw * 0.16} ${OCC - 9} ${cx + cw * 0.3} ${OCC - 4}`,
    `M ${cx - cw * 0.02} ${OCC - 5.2} L ${cx + cw * 0.02} ${OCC - 5.2}`,
    `M ${cx - cw * 0.22} ${J + 10} C ${cx - cw * 0.28} ${J + 20} ${cx - cw * 0.25} ${OCC - 12} ${cx - cw * 0.33} ${OCC - 7}`,
    `M ${cx + cw * 0.22} ${J + 10} C ${cx + cw * 0.28} ${J + 20} ${cx + cw * 0.25} ${OCC - 12} ${cx + cw * 0.33} ${OCC - 7}`,
    `M ${cx - cw * 0.28} ${J + 9} Q ${cx} ${J + 13.5} ${cx + cw * 0.28} ${J + 9}`,
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
    // Apekse doğru belirgin sivrilme, yuvarlak kök ucu
    return {
      path: `M ${l} ${J + 1}
        C ${l - 1 * belly} ${J - 6} ${tipX - topW * 0.32} ${mid} ${tipX - 0.9} ${tipY + 4}
        Q ${tipX} ${tipY - 1.8} ${tipX + 0.9} ${tipY + 4}
        C ${tipX + topW * 0.28} ${mid} ${r + 0.8 * belly} ${J - 6} ${r} ${J + 1}
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

  // Doğal diş hattı: pembemsi yerine sıcak kahve-gri (anatomik atlas görünümü)
  const baseStroke = '#9A7B5C'
  const detailStroke = '#C2A672'
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
    // Mine parlaklığı: kronun üst-mesial bölümünde yumuşak ışık lekesi
    if (!flags.crown) inner.push(
      <ellipse
        key="gloss"
        cx={cx - cw * 0.16}
        cy={J + 13}
        rx={cw * 0.15}
        ry={6.5}
        fill="#FFFFFF"
        opacity={flags.removableProsthesis ? 0.28 : 0.4}
      />
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
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="#F7F1E2" />
          <stop offset="1" stopColor="#E4D4B0" />
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
        // Çekilmiş dişte yalnız diş görseli gizlenir; numara sabit kalır (soluk).
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
      {teeth.map((n, i) => {
        const flags = states.get(n) ?? {}
        const isSel = selected === n
        const hidden = hiddenTeeth?.has(n)
        const marked = markedTeeth?.has(n)
        const { vbw } = toothDims(n)
        const cellWidth = (TOOTH_HEIGHT * vbw) / VBH
        // Gülüş hattı: ön dişler okluzal düzleme doğru hafifçe uzanır (doğal ark kavisi)
        const halfIdx = (teeth.length - 1) / 2
        const tPos = halfIdx === 0 ? 0 : (i - halfIdx) / halfIdx
        const smile = (1 - Math.pow(Math.abs(tPos), 1.7)) * 6
        return (
          <button
            key={n}
            onClick={() => onSelect(n)}
            style={{
              width: cellWidth,
              minWidth: cellWidth,
              transform: `translateY(${jaw === 'upper' ? smile : -smile}px)`,
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
        <div className="relative my-4 h-3">
          <span className="absolute inset-x-8 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,transparent_0%,#EBB7BF_18%,#DE93A0_50%,#EBB7BF_82%,transparent_100%)]" />
          <span className="absolute inset-x-16 top-1/2 h-px translate-y-[2px] rounded-full bg-[#C0526A]/25" />
          {graftMarkers.map((left, index) => <span key={`${left}-${index}`} className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-0.5" style={{ left: `${left}%` }}><i className="h-1.5 w-1.5 rounded-full border border-slate-300 bg-white shadow-sm"/><i className="h-1 w-1 rounded-full border border-slate-300 bg-white"/><i className="h-1.5 w-1.5 rounded-full border border-slate-300 bg-white shadow-sm"/></span>)}
        </div>
        <TeethRow teeth={lowerTeeth} jaw="lower" selected={selected} states={states} onSelect={onSelect} hiddenTeeth={hiddenTeeth} markedTeeth={markedTeeth} markerColor={markerColor} />
        <NumberRow teeth={lowerTeeth} selected={selected} states={states} onSelect={onSelect} hiddenTeeth={hiddenTeeth} markedTeeth={markedTeeth} markerColor={markerColor} />
      </div>
    </div>
  )
}

