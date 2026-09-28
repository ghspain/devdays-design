export const MM_PER_INCH = 25.4

export interface PrintGeometry {
  /** Trim size; bleed is represented separately and does not change the legacy canvas contract. */
  readonly widthMm: number
  readonly heightMm: number
  readonly dpi: number
  readonly bleedMm: number
  readonly safeAreaMm: number
  /** True while this remains an organizer-configurable example, not a stock guarantee. */
  readonly configurable: boolean
}

export interface PrintRasterSize {
  readonly width: number
  readonly height: number
}

export interface PrintRectangle {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export interface PrintBoundaries {
  readonly bleed: PrintRectangle
  readonly trim: PrintRectangle
  readonly safeArea: PrintRectangle
}

export type PrintBoundary = 'outside-bleed' | 'bleed' | 'trim' | 'safe-area'

/** Convert millimetres to pixels using nearest-integer rounding for stable exports. */
export function mmToPixels(mm: number, dpi: number): number {
  return Math.round((mm / MM_PER_INCH) * dpi)
}

/** Raster dimensions describe the trim; bleed remains explicit metadata for later print-sheet work. */
export function printRasterSize(geometry: Pick<PrintGeometry, 'widthMm' | 'heightMm' | 'dpi'>): PrintRasterSize {
  return { width: mmToPixels(geometry.widthMm, geometry.dpi), height: mmToPixels(geometry.heightMm, geometry.dpi) }
}

export function validatePrintGeometry(geometry: PrintGeometry): string[] {
  const errors: string[] = []
  if (!Number.isFinite(geometry.widthMm) || geometry.widthMm <= 0) errors.push('Width must be greater than 0 mm.')
  if (!Number.isFinite(geometry.heightMm) || geometry.heightMm <= 0) errors.push('Height must be greater than 0 mm.')
  if (!Number.isFinite(geometry.dpi) || geometry.dpi <= 0) errors.push('DPI must be greater than 0.')
  if (!Number.isFinite(geometry.bleedMm) || geometry.bleedMm < 0) errors.push('Bleed must be 0 mm or greater.')
  if (!Number.isFinite(geometry.safeAreaMm) || geometry.safeAreaMm < 0) errors.push('Safe area must be 0 mm or greater.')
  if (geometry.safeAreaMm * 2 >= geometry.widthMm || geometry.safeAreaMm * 2 >= geometry.heightMm) {
    errors.push('Safe area must fit inside the trim on every side.')
  }
  return errors
}

export function printBoundaries(geometry: PrintGeometry): PrintBoundaries {
  const { widthMm, heightMm, bleedMm, safeAreaMm } = geometry
  const trim = { left: bleedMm, top: bleedMm, right: bleedMm + widthMm, bottom: bleedMm + heightMm }
  return {
    bleed: { left: 0, top: 0, right: widthMm + bleedMm * 2, bottom: heightMm + bleedMm * 2 },
    trim,
    safeArea: {
      left: trim.left + safeAreaMm,
      top: trim.top + safeAreaMm,
      right: trim.right - safeAreaMm,
      bottom: trim.bottom - safeAreaMm,
    },
  }
}

function contains(rectangle: PrintRectangle, x: number, y: number): boolean {
  return x >= rectangle.left && x <= rectangle.right && y >= rectangle.top && y <= rectangle.bottom
}

/** Classify a point in millimetre coordinates, preferring the most constrained boundary. */
export function classifyPrintPoint(geometry: PrintGeometry, x: number, y: number): PrintBoundary {
  const boundaries = printBoundaries(geometry)
  if (contains(boundaries.safeArea, x, y)) return 'safe-area'
  if (contains(boundaries.trim, x, y)) return 'trim'
  if (contains(boundaries.bleed, x, y)) return 'bleed'
  return 'outside-bleed'
}
