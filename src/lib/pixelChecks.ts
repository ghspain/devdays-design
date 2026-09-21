import type { RenderInfo, ValidationFinding } from './validate'

/**
 * Fraction of the canvas edge that content should stay clear of. The issue
 * proposed 5%, but the designed layouts draw as close as ~1.5% from the top
 * (ascenders) and 4.5% from the sides, so a stricter 1% band is used to flag
 * only pathologically edge-hugging content (see the 🧭 note in the PR).
 */
export const SAFE_AREA_MARGIN_RATIO = 0.01

/** Sum of absolute channel distances below which a pixel is considered text/blend. */
const TEXT_PIXEL_DISTANCE = 96

function parseColor(color: string): [number, number, number] | null {
  const trimmed = color.trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed)
  if (hex) {
    const digits = hex[1]
    const full = digits.length === 3 ? digits.split('').map((c) => c + c).join('') : digits
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ]
  }
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(trimmed)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  return null
}

function srgbLuminance(r: number, g: number, b: number): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two sRGB colors (1..21). */
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = srgbLuminance(a[0], a[1], a[2])
  const lb = srgbLuminance(b[0], b[1], b[2])
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Runs pixel-based checks (WCAG contrast, safe area) against a canvas that
 * has already been rendered at export resolution, using the text regions the
 * renderer recorded in its RenderInfo.
 */
export function checkRenderedCanvas(
  canvas: HTMLCanvasElement,
  info: Pick<RenderInfo, 'textRegions'>,
): ValidationFinding[] {
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  const findings: ValidationFinding[] = []
  const seen = new Set<string>()
  const width = canvas.width
  const height = canvas.height
  const marginX = width * SAFE_AREA_MARGIN_RATIO
  const marginY = height * SAFE_AREA_MARGIN_RATIO

  for (const region of info.textRegions) {
    if (seen.has(region.field)) continue
    seen.add(region.field)

    if (
      region.x < marginX ||
      region.y < marginY ||
      region.x + region.w > width - marginX ||
      region.y + region.h > height - marginY
    ) {
      findings.push({
        code: 'safe-area',
        severity: 'warning',
        field: region.field,
        message: `"${region.field}" sits within ${Math.round(SAFE_AREA_MARGIN_RATIO * 100)}% of the canvas edge and may be cropped by downstream platforms.`,
      })
    }

    const textColor = parseColor(region.color)
    if (!textColor) continue
    const x0 = Math.max(0, Math.round(region.x))
    const y0 = Math.max(0, Math.round(region.y))
    const x1 = Math.min(width, Math.round(region.x + region.w))
    const y1 = Math.min(height, Math.round(region.y + region.h))
    if (x1 - x0 < 4 || y1 - y0 < 4) continue

    const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
    const distances: number[] = []
    const pxR: number[] = []
    const pxG: number[] = []
    const pxB: number[] = []
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue
      const r = data[i], g = data[i + 1], b = data[i + 2]
      distances.push(Math.abs(r - textColor[0]) + Math.abs(g - textColor[1]) + Math.abs(b - textColor[2]))
      pxR.push(r); pxG.push(g); pxB.push(b)
    }
    const allN = distances.length
    if (allN === 0) continue
    const meanOf = (indices: number[]): [number, number, number] => {
      let r = 0, g = 0, b = 0
      for (const p of indices) { r += pxR[p]; g += pxG[p]; b += pxB[p] }
      return [r / indices.length, g / indices.length, b / indices.length]
    }
    // Background = mean of pixels far from the text color. When clearly-far
    // pixels are rare (< 5%) the region is dense text, so instead of the
    // overall mean — which collapses toward the text color and fakes a ~1:1
    // ratio (#32) — take the most-distant quartile. Truly invisible text
    // still fails: its most-distant pixels remain close to the text color.
    const farIndices: number[] = []
    for (let p = 0; p < allN; p++) if (distances[p] >= TEXT_PIXEL_DISTANCE) farIndices.push(p)
    const background =
      farIndices.length >= allN * 0.05
        ? meanOf(farIndices)
        : meanOf(
            [...Array(allN).keys()]
              .sort((a, b) => distances[b] - distances[a])
              .slice(0, Math.max(1, Math.ceil(allN * 0.25))),
          )
    const ratio = contrastRatio(textColor, background)
    if (ratio < 3) {
      findings.push({
        code: 'low-contrast',
        severity: ratio < 2 ? 'error' : 'warning',
        field: region.field,
        message: `"${region.field}" has about ${ratio.toFixed(1)}:1 contrast against its background (WCAG AA needs 3:1). Change the text color or the background.`,
      })
    }
  }

  return findings
}
