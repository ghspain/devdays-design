import { expect, test, type Page } from '@playwright/test'

interface Finding {
  code: string
  severity: string
  message: string
  field?: string
}

const tinyLogo =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const partner = (index: number) => ({ id: `p${index}`, name: `Partner ${index}`, imageDataUrl: tinyLogo })

const speaker = (index: number) => ({ id: `s${index}`, name: `Speaker Number ${index}`, role: `Role ${index}` })

function historyItem(overrides: Record<string, unknown>) {
  return {
    id: `h-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    previewDataUrl: tinyLogo,
    state: {
      format: 'luma_cover',
      speakers: [],
      partners: [],
      event: { includeSupportedBy: true },
      ...overrides,
    },
  }
}

async function seedHistory(page: Page, items: unknown[]) {
  await page.addInitScript(
    (payload) => window.localStorage.setItem('banner-history-v1', JSON.stringify(payload)),
    items,
  )
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await page.getByRole('button', { name: 'Previous banners' }).click()
  await page.locator('.history-item button', { hasText: 'Open' }).first().click()
  await expect(page.locator('.history-drawer')).toBeHidden()
}

const findings = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __devdaysValidation?: { findings: Finding[] }
        }
      ).__devdaysValidation?.findings ?? [],
  )

test('validation panel shows the all-clear state for the default banner', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await expect(page.locator('.validation-panel')).toContainText('All checks passed')
  await expect.poll(() => findings(page), { timeout: 10_000 }).toEqual([])
})

test('overlong city text is reported as truncated', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  await page.getByLabel('City').fill('Buenos Aires Capital Federal Extendiiiisima')

  await expect
    .poll(() => findings(page), { timeout: 10_000 })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'text-truncated', field: 'city', severity: 'warning' }),
      ]),
    )
  await expect(page.locator('.validation-panel')).toContainText('city')
})

test('partner logos beyond the format cap are reported as dropped', async ({ page }) => {
  await seedHistory(page, [historyItem({ partners: [1, 2, 3, 4, 5].map(partner) })])

  await expect
    .poll(() => findings(page), { timeout: 10_000 })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'logos-dropped', field: 'partner logos' }),
      ]),
    )
  await expect(page.locator('.validation-panel')).toContainText('partner logos')
})

test('partner logos within the cap do not raise a finding', async ({ page }) => {
  await seedHistory(page, [historyItem({ partners: [1, 2, 3].map(partner) })])

  await expect
    .poll(() => findings(page), { timeout: 10_000 })
    .toEqual(expect.not.arrayContaining([expect.objectContaining({ code: 'logos-dropped' })]))
})

test('speakers beyond the format limit are reported as dropped', async ({ page }) => {
  await seedHistory(page, [
    historyItem({ format: 'speaker_square', speakers: Array.from({ length: 13 }, (_, i) => speaker(i + 1)) }),
  ])

  await expect
    .poll(() => findings(page), { timeout: 10_000 })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'speakers-dropped', field: 'speakers' }),
      ]),
    )
})

test('single featured speaker on speaker_banner is not reported as dropped', async ({ page }) => {
  await seedHistory(page, [
    historyItem({ format: 'speaker_banner', speakers: [speaker(1)] }),
  ])

  await expect
    .poll(() => findings(page), { timeout: 10_000 })
    .toEqual(expect.not.arrayContaining([expect.objectContaining({ code: 'speakers-dropped' })]))
})

// --- Phase 2: pixel checks (contrast + safe area) ---------------------------

interface PixelRegion {
  field: string
  x: number
  y: number
  w: number
  h: number
  color: string
}

function runPixelChecks(page: Page, background: string, regions: PixelRegion[]) {
  return page.evaluate(
    async ({ bg, regionList }) => {
      const w = window as unknown as {
        __devdaysValidation?: {
          pixelChecks: (canvas: HTMLCanvasElement, info: { textRegions: PixelRegion[] }) => Finding[]
        }
      }
      const deadline = Date.now() + 5_000
      while (!w.__devdaysValidation?.pixelChecks && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50))
      }
      if (!w.__devdaysValidation?.pixelChecks) throw new Error('pixelChecks hook missing')
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 400
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      return w.__devdaysValidation.pixelChecks(canvas, { textRegions: regionList })
    },
    { bg: background, regionList: regions },
  )
}

test('near-invisible text (white on near-white) is reported as low-contrast error', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  const result = await runPixelChecks(page, '#fdfdfd', [
    { field: 'event title', x: 100, y: 100, w: 400, h: 60, color: '#ffffff' },
  ])
  expect(result).toEqual([
    expect.objectContaining({ code: 'low-contrast', severity: 'error', field: 'event title' }),
  ])
})

test('readable text on a light background raises no contrast finding', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  const result = await runPixelChecks(page, '#fdfdfd', [
    { field: 'event title', x: 100, y: 100, w: 400, h: 60, color: '#111111' },
  ])
  expect(result).toEqual([])
})

test('text hugging the canvas edge is reported as a safe-area warning', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  const result = await runPixelChecks(page, '#fdfdfd', [
    { field: 'city', x: 2, y: 100, w: 400, h: 60, color: '#111111' },
  ])
  expect(result).toEqual([expect.objectContaining({ code: 'safe-area', severity: 'warning', field: 'city' })])
})

for (const formatId of ['luma_cover', 'speaker_banner', 'social_promo', 'speaker_square']) {
  test(`designed ${formatId} default render raises no contrast or safe-area findings`, async ({ page }) => {
    await seedHistory(page, [historyItem({ format: formatId })])

    // The all-clear panel proves the full findings list (which now includes
    // pixel checks) stayed empty for the designed palette/background combo.
    await expect(page.locator('.validation-panel')).toContainText('All checks passed', { timeout: 10_000 })
    const codes = (await findings(page)).map((f) => f.code)
    expect(codes).not.toContain('low-contrast')
    expect(codes).not.toContain('safe-area')
  })
}
