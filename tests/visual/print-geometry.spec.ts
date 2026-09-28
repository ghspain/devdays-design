import { expect, test } from '@playwright/test'
import { assetCatalog } from '../../src/domain/assets'
import { classifyPrintPoint, printBoundaries, printRasterSize, validatePrintGeometry, type PrintGeometry } from '../../src/domain/printGeometry'
import { formatOptions } from '../../src/constants'
import { selectFormat } from './helpers'

const exampleGeometry: PrintGeometry = {
  widthMm: 80,
  heightMm: 120,
  dpi: 254,
  bleedMm: 3,
  safeAreaMm: 5,
  configurable: true,
}

test('print geometry converts millimetres to deterministic trim pixels', () => {
  expect(printRasterSize(exampleGeometry)).toEqual({ width: 800, height: 1200 })
  expect(printRasterSize({ ...exampleGeometry, widthMm: 25.4, heightMm: 25.4, dpi: 96 })).toEqual({ width: 96, height: 96 })

  const badgeProfile = assetCatalog.flatMap((asset) => asset.templates)
    .find((template) => template.id === 'speaker-badge-front')?.exportProfiles[0]
  expect(badgeProfile?.printGeometry).toMatchObject(exampleGeometry)
  expect(badgeProfile).toMatchObject({ width: 800, height: 1200 })
})

test('print boundaries distinguish bleed, trim, safe area, and invalid geometry', () => {
  const boundaries = printBoundaries(exampleGeometry)
  expect(boundaries.bleed).toEqual({ left: 0, top: 0, right: 86, bottom: 126 })
  expect(boundaries.trim).toEqual({ left: 3, top: 3, right: 83, bottom: 123 })
  expect(boundaries.safeArea).toEqual({ left: 8, top: 8, right: 78, bottom: 118 })
  expect(classifyPrintPoint(exampleGeometry, 1, 1)).toBe('bleed')
  expect(classifyPrintPoint(exampleGeometry, 4, 4)).toBe('trim')
  expect(classifyPrintPoint(exampleGeometry, 8, 8)).toBe('safe-area')
  expect(classifyPrintPoint(exampleGeometry, -1, 1)).toBe('outside-bleed')

  expect(validatePrintGeometry({ ...exampleGeometry, widthMm: 0 })).toContain('Width must be greater than 0 mm.')
  expect(validatePrintGeometry({ ...exampleGeometry, bleedMm: -1 })).toContain('Bleed must be 0 mm or greater.')
  expect(validatePrintGeometry({ ...exampleGeometry, safeAreaMm: 40 })).toContain('Safe area must fit inside the trim on every side.')
})

test('social export profiles remain pixel-only', () => {
  const templates = assetCatalog.flatMap((asset) => asset.templates)
  expect(templates.filter((template) => template.id !== 'speaker-badge-front')
    .flatMap((template) => template.exportProfiles)
    .every((profile) => profile.printGeometry === undefined)).toBe(true)
  expect(formatOptions.filter((option) => option.id !== 'speaker_badge')).toMatchObject([
    { id: 'speaker_square', width: 1080, height: 1080 },
    { id: 'speaker_banner', width: 1080, height: 1350 },
    { id: 'social_promo', width: 1080, height: 1350 },
    { id: 'luma_cover', width: 1000, height: 1000 },
  ])
})

test('badge format displays configurable physical metadata without a printer guarantee', async ({ page }) => {
  await page.goto('/')
  await selectFormat(page, 'speaker_badge')

  const selected = page.locator('.format-card[aria-pressed="true"]')
  await expect(selected).toContainText('80 × 120 mm')
  await expect(selected).toContainText('254 DPI')
  await expect(selected).toContainText(/configurable example/i)
  await expect(selected).toContainText(/not print-ready/i)
  await expect(selected).toHaveAttribute('aria-label', /80 by 120 millimetres at 254 DPI/)
  await expect(selected).toHaveAttribute('aria-label', /configurable example, not print-ready/i)
  await expect(page.getByLabel('Banner preview')).toHaveAttribute('width', '800')
  await expect(page.getByLabel('Banner preview')).toHaveAttribute('height', '1200')
})
