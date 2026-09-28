import type { AssetSide } from '../domain/assets'
import type { PrintGeometry } from '../domain/printGeometry'
import { mmToPixels } from '../domain/printGeometry'

/** Reversible page profiles: physical calibration remains a manual gate for #145. */
export interface BadgeSheetProfile {
  readonly id: 'a4' | 'a3'
  readonly label: string
  readonly widthMm: number
  readonly heightMm: number
  readonly marginMm: number
  readonly gapMm: number
  readonly cropMarkOffsetMm: number
  readonly cropMarkLengthMm: number
}

export const BADGE_SHEET_PROFILES: readonly BadgeSheetProfile[] = [
  { id: 'a4', label: 'A4', widthMm: 210, heightMm: 297, marginMm: 20, gapMm: 10, cropMarkOffsetMm: 1, cropMarkLengthMm: 3 },
  { id: 'a3', label: 'A3', widthMm: 297, heightMm: 420, marginMm: 18, gapMm: 10, cropMarkOffsetMm: 1, cropMarkLengthMm: 3 },
]

export interface BadgeSheetAsset {
  readonly id: string
  readonly filename: string
  readonly blob: Blob
  readonly side?: AssetSide
  readonly sourceRowNumber?: number
}

export interface BadgeSheetPlacement {
  readonly pageIndex: number
  readonly index: number
  readonly leftMm: number
  readonly topMm: number
  readonly widthMm: number
  readonly heightMm: number
}

export type DuplexFlipMode = 'long-edge' | 'short-edge'

export const DUPLEX_FLIP_MODES: readonly DuplexFlipMode[] = ['long-edge', 'short-edge']

export interface DuplexBadgeSheetPlan {
  readonly front: BadgeSheetPlan
  readonly backPlacements: readonly BadgeSheetPlacement[]
  readonly flipMode: DuplexFlipMode
  /** Axis mirrored on the back page: horizontal mirrors columns, vertical mirrors rows. */
  readonly flipAxis: 'horizontal' | 'vertical'
}

export interface BadgeSheetPlan {
  readonly profile: BadgeSheetProfile
  readonly badge: Pick<PrintGeometry, 'widthMm' | 'heightMm' | 'dpi'>
  readonly columns: number
  readonly rows: number
  readonly perPage: number
  readonly pageCount: number
  readonly placements: readonly BadgeSheetPlacement[]
  readonly cropMarkLineCount: number
}

export function getBadgeSheetProfile(id: BadgeSheetProfile['id']): BadgeSheetProfile {
  return BADGE_SHEET_PROFILES.find((profile) => profile.id === id) ?? BADGE_SHEET_PROFILES[0]
}

function gridCount(availableMm: number, badgeMm: number, gapMm: number): number {
  return Math.max(0, Math.floor((availableMm + gapMm) / (badgeMm + gapMm)))
}

export function planBadgeSheet(
  count: number,
  geometry: Pick<PrintGeometry, 'widthMm' | 'heightMm' | 'dpi'>,
  profile = BADGE_SHEET_PROFILES[0],
): BadgeSheetPlan {
  const columns = gridCount(profile.widthMm - profile.marginMm * 2, geometry.widthMm, profile.gapMm)
  const rows = gridCount(profile.heightMm - profile.marginMm * 2, geometry.heightMm, profile.gapMm)
  const perPage = columns * rows
  if (!perPage) throw new Error(`${profile.label} is too small for the configured badge geometry.`)
  const pageCount = Math.ceil(Math.max(0, count) / perPage)
  const placements = Array.from({ length: Math.max(0, count) }, (_, index) => {
    const slot = index % perPage
    const pageIndex = Math.floor(index / perPage)
    const column = slot % columns
    const row = Math.floor(slot / columns)
    return {
      pageIndex,
      index,
      leftMm: profile.marginMm + column * (geometry.widthMm + profile.gapMm),
      topMm: profile.marginMm + row * (geometry.heightMm + profile.gapMm),
      widthMm: geometry.widthMm,
      heightMm: geometry.heightMm,
    }
  })
  return {
    profile,
    badge: geometry,
    columns,
    rows,
    perPage,
    pageCount,
    placements,
    cropMarkLineCount: placements.length * 8,
  }
}

/**
 * 🧭 DECISION — duplex page-axis mapping
 * Question: which grid axis should each printer flip mode mirror?
 * Options: always mirror columns / always mirror rows / derive from page orientation.
 * Investigation: a long-edge turn rotates around the page's long edge; portrait pages therefore mirror columns,
 * while landscape pages mirror rows. Short-edge is the inverse. Profiles carry physical width and height.
 * Decision: derive the mirrored axis from the selected profile orientation, preserving physical front/back positions.
 * To revert: replace this mapping with a fixed axis if a calibrated printer workflow proves a different convention.
 */
export function duplexFlipAxis(profile: Pick<BadgeSheetProfile, 'widthMm' | 'heightMm'>, flipMode: DuplexFlipMode): 'horizontal' | 'vertical' {
  const portrait = profile.heightMm >= profile.widthMm
  if (flipMode === 'long-edge') return portrait ? 'horizontal' : 'vertical'
  return portrait ? 'vertical' : 'horizontal'
}

export function planDuplexBadgeSheet(
  count: number,
  geometry: Pick<PrintGeometry, 'widthMm' | 'heightMm' | 'dpi'>,
  profile = BADGE_SHEET_PROFILES[0],
  flipMode: DuplexFlipMode = 'long-edge',
): DuplexBadgeSheetPlan {
  const front = planBadgeSheet(count, geometry, profile)
  const backPlacements = front.placements.map((placement) => {
    const slot = placement.index % front.perPage
    const column = slot % front.columns
    const row = Math.floor(slot / front.columns)
    const axis = duplexFlipAxis(profile, flipMode)
    const mirroredColumn = axis === 'horizontal' ? front.columns - 1 - column : column
    const mirroredRow = axis === 'vertical' ? front.rows - 1 - row : row
    return {
      ...placement,
      leftMm: profile.marginMm + mirroredColumn * (geometry.widthMm + profile.gapMm),
      topMm: profile.marginMm + mirroredRow * (geometry.heightMm + profile.gapMm),
    }
  })
  return { front, backPlacements, flipMode, flipAxis: duplexFlipAxis(profile, flipMode) }
}

/** Eight outward-facing segments per trim box; marks never cross into the badge content. */
export function cropMarkLines(
  placement: BadgeSheetPlacement,
  profile: BadgeSheetProfile,
): Array<readonly [number, number, number, number]> {
  const { leftMm: x, topMm: y, widthMm: width, heightMm: height } = placement
  const offset = profile.cropMarkOffsetMm
  const length = profile.cropMarkLengthMm
  return [
    [x - offset - length, y, x - offset, y], [x, y - offset - length, x, y - offset],
    [x + width + offset, y, x + width + offset + length, y], [x + width, y - offset - length, x + width, y - offset],
    [x - offset - length, y + height, x - offset, y + height], [x, y + height + offset, x, y + height + offset + length],
    [x + width + offset, y + height, x + width + offset + length, y + height], [x + width, y + height + offset, x + width, y + height + offset + length],
  ]
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Could not read badge PNG.'))
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read badge PNG.'))
    }
    reader.readAsDataURL(blob)
  })
}

async function assertPngResolution(asset: BadgeSheetAsset, geometry: Pick<PrintGeometry, 'widthMm' | 'heightMm' | 'dpi'>) {
  const bytes = new Uint8Array(await asset.blob.arrayBuffer())
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    throw new Error(`Badge asset ${asset.filename} is not a PNG.`)
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  const expected = { width: mmToPixels(geometry.widthMm, geometry.dpi), height: mmToPixels(geometry.heightMm, geometry.dpi) }
  if (width < expected.width || height < expected.height) {
    throw new Error(`Badge asset ${asset.filename} is below ${geometry.dpi} DPI.`)
  }
}

export interface BadgeSheetPdfResult {
  readonly blob: Blob
  readonly fileName: string
  readonly plan: BadgeSheetPlan
  readonly duplexPlan?: DuplexBadgeSheetPlan
  readonly flipMode?: DuplexFlipMode
  readonly hasBacks: boolean
  readonly assetCount: number
}

function assetSide(asset: BadgeSheetAsset, side: AssetSide): boolean {
  return asset.side ? asset.side === side : asset.id.endsWith(`-${side}`)
}

export interface BadgeSheetAssetPair {
  readonly front: BadgeSheetAsset
  readonly back?: BadgeSheetAsset
}

/** Pair unique source rows first; ambiguous rows only use an exact stable ID fallback. */
export function pairDuplexBadgeAssets(fronts: readonly BadgeSheetAsset[], backs: readonly BadgeSheetAsset[]): readonly BadgeSheetAssetPair[] {
  const frontRowCounts = new Map<number, number>()
  const backRowCounts = new Map<number, number>()
  fronts.forEach((asset) => asset.sourceRowNumber !== undefined && frontRowCounts.set(asset.sourceRowNumber, (frontRowCounts.get(asset.sourceRowNumber) ?? 0) + 1))
  backs.forEach((asset) => asset.sourceRowNumber !== undefined && backRowCounts.set(asset.sourceRowNumber, (backRowCounts.get(asset.sourceRowNumber) ?? 0) + 1))
  const used = new Set<BadgeSheetAsset>()
  const backById = new Map<string, BadgeSheetAsset | null>()
  backs.forEach((asset) => {
    if (backById.has(asset.id)) backById.set(asset.id, null)
    else backById.set(asset.id, asset)
  })
  return fronts.map((front) => {
    const row = front.sourceRowNumber
    const rowMatch = row !== undefined && frontRowCounts.get(row) === 1 && backRowCounts.get(row) === 1
      ? backs.find((back) => !used.has(back) && back.sourceRowNumber === row)
      : undefined
    const idMatch = backById.get(front.id.replace(/-front$/, '-back'))
    const match = rowMatch ?? (idMatch && !used.has(idMatch) ? idMatch : undefined)
    if (match) used.add(match)
    return match ? { front, back: match } : { front }
  })
}

export function hasDuplexBadgePair(assets: readonly BadgeSheetAsset[]): boolean {
  const fronts = assets.filter((asset) => assetSide(asset, 'front'))
  const backs = assets.filter((asset) => assetSide(asset, 'back'))
  return pairDuplexBadgeAssets(fronts, backs).some((pair) => Boolean(pair.back))
}

/** Front-only proofs remain unchanged; when backs are present, pages alternate front/matching back sheets. */
export async function buildBadgeSheetPdf(
  assets: readonly BadgeSheetAsset[],
  geometry: Pick<PrintGeometry, 'widthMm' | 'heightMm' | 'dpi'>,
  profileId: BadgeSheetProfile['id'] = 'a4',
  flipMode: DuplexFlipMode = 'long-edge',
): Promise<BadgeSheetPdfResult> {
  const fronts = assets.filter((asset) => assetSide(asset, 'front'))
  if (!fronts.length) throw new Error('No front badge PNGs are available for the PDF proof.')
  const backs = assets.filter((asset) => assetSide(asset, 'back'))
  const pairs = pairDuplexBadgeAssets(fronts, backs)
  const pairedBacks = pairs.map((pair) => pair.back)
  const hasBacks = hasDuplexBadgePair(assets)
  const profile = getBadgeSheetProfile(profileId)
  const duplexPlan = hasBacks ? planDuplexBadgeSheet(fronts.length, geometry, profile, flipMode) : undefined
  const plan = duplexPlan?.front ?? planBadgeSheet(fronts.length, geometry, profile)
  await Promise.all([...fronts, ...pairedBacks.filter((asset): asset is BadgeSheetAsset => Boolean(asset))].map((asset) => assertPngResolution(asset, geometry)))
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: [profile.widthMm, profile.heightMm], orientation: 'portrait', compress: true })
  pdf.setProperties({ title: `DevDays ${profile.label} badge PDF proof`, subject: hasBacks ? `Duplex ${flipMode} badge sheet proof; Calibration pending #145` : 'Front-only badge sheet proof; Calibration pending #145' })
  const frontDataUrls = await Promise.all(fronts.map((asset) => blobToDataUrl(asset.blob)))
  const backDataUrls = await Promise.all(pairedBacks.map((asset) => asset ? blobToDataUrl(asset.blob) : Promise.resolve(undefined)))
  const drawPage = (pageIndex: number, placements: readonly BadgeSheetPlacement[], dataUrls: readonly (string | undefined)[]) => {
    placements.filter((placement) => placement.pageIndex === pageIndex).forEach((placement) => {
      const dataUrl = dataUrls[placement.index]
      if (!dataUrl) return
      pdf.addImage(dataUrl, 'PNG', placement.leftMm, placement.topMm, placement.widthMm, placement.heightMm, undefined, 'FAST')
      pdf.setDrawColor(80, 80, 80)
      pdf.setLineWidth(0.15)
      cropMarkLines(placement, profile).forEach(([x1, y1, x2, y2]) => pdf.line(x1, y1, x2, y2))
    })
  }
  for (let pageIndex = 0; pageIndex < plan.pageCount; pageIndex += 1) {
    if (pageIndex > 0) pdf.addPage([profile.widthMm, profile.heightMm], 'portrait')
    drawPage(pageIndex, plan.placements, frontDataUrls)
    if (hasBacks) {
      pdf.addPage([profile.widthMm, profile.heightMm], 'portrait')
      drawPage(pageIndex, duplexPlan?.backPlacements ?? [], backDataUrls)
    }
  }
  const bytes = pdf.output('arraybuffer')
  const suffix = hasBacks ? `duplex-${flipMode}` : 'proof'
  return { blob: new Blob([bytes], { type: 'application/pdf' }), fileName: `devdays-badge-${profile.id}-${suffix}.pdf`, plan, duplexPlan, flipMode: hasBacks ? flipMode : undefined, hasBacks, assetCount: fronts.length }
}
