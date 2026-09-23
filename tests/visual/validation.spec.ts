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

test('a single unbreakable word wider than the box is reported as truncated', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  // No spaces at all: wrapText used to emit it as one overflowing line with no flag (#32).
  await page.getByLabel('City').fill('M'.repeat(200))

  await expect
    .poll(() => findings(page), { timeout: 10_000 })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'text-truncated', field: 'city', severity: 'warning' }),
      ]),
    )
})

test('speaker_banner name contrast never collapses into a false error-severity finding', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await page.locator('.format-bar select').selectOption('speaker_banner')
  // Let the render + validation settle.
  await page.waitForTimeout(2_000)

  // Investigation for #32: "speaker name" measures ~2.99:1 locally (brand
  // green on light bg) but ~3.0:1 on CI runners, so the warning's presence is
  // environment-dependent. The invariant that must hold everywhere is that
  // the background estimate does not collapse onto the text color, which
  // would fake a ~1:1 ratio and report severity "error".
  const list = await findings(page)
  expect(list.filter((f) => f.code === 'low-contrast' && f.severity === 'error')).toEqual([])
  const nameFindings = list.filter((f) => f.code === 'low-contrast' && f.field === 'speaker name')
  for (const f of nameFindings) expect(f.severity).toBe('warning')
})

test('export buttons show a findings badge that never blocks export', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await expect(page.locator('.download-badge')).toHaveCount(0)

  await page.getByLabel('City').fill('Buenos Aires Capital Federal Extendiiiisima')
  await expect
    .poll(() => findings(page), { timeout: 10_000 })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'text-truncated', field: 'city', severity: 'warning' }),
      ]),
    )

  // Both export buttons get a warning-styled badge with the finding count.
  const badges = page.locator('.download-badge')
  await expect(badges).toHaveCount(2)
  await expect(badges.first()).toHaveClass(/warning/)
  await expect(badges.first()).not.toHaveText('0')

  // Export stays clickable despite findings.
  const download = page.locator('.download-main')
  await expect(download).toBeEnabled()
  await expect(download).toHaveAttribute('aria-label', /Findings/)
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

// --- Phase 4: actionable validation navigation --------------------------------

test('text-truncated city finding exposes a "Go to field" button that focuses the City input', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  // Trigger a truncation finding by entering an overlong city name.
  await page.getByLabel('City').fill('Buenos Aires Capital Federal Extendiiiisima')

  await expect
    .poll(() => findings(page), { timeout: 10_000 })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'text-truncated', field: 'city', severity: 'warning' }),
      ]),
    )

  // The validation panel should contain a "Go to field" action button for the city finding.
  // The city finding is the first finding (most recent), so we look for the button within the
  // validation panel that has aria-label "Go to field".
  await expect(page.locator('.validation-panel .validation-go-to-field')).toBeVisible()

  // Clicking the link should focus the City input.
  const cityInput = page.getByRole('textbox', { name: 'City' }).first()
  await cityInput.evaluate((el: HTMLElement) => el.blur())
  await expect(cityInput).not.toBeFocused()

  await page.locator('.validation-panel .validation-go-to-field').first().click()

  // The City input should now be focused.
  await expect(cityInput).toBeFocused({ timeout: 3000 })
})

test('speakers-dropped finding exposes a "Go to field" button that navigates to the Speakers section', async ({ page }) => {
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

  // The validation panel should contain at least one "Go to field" action button.
  await expect(page.locator('.validation-panel .validation-go-to-field').first()).toBeVisible()

  // Clicking the link should scroll to and open the Speakers section.
  const speakersSection = page.locator('#section-speakers')
  await expect(speakersSection).toBeVisible()

  await page.locator('.validation-panel .validation-go-to-field').first().click()

  // The section should be open after clicking.
  await expect(speakersSection).toHaveAttribute('open')
})

test('logos-dropped finding exposes a "Go to field" button that navigates to the Partners section', async ({ page }) => {
  await seedHistory(page, [historyItem({ partners: [1, 2, 3, 4, 5].map(partner) })])

  await expect
    .poll(() => findings(page), { timeout: 10_000 })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'logos-dropped', field: 'partner logos' }),
      ]),
    )

  // The validation panel should contain a "Go to field" action button.
  await expect(page.locator('.validation-panel .validation-go-to-field')).toBeVisible()

  // Clicking the link should scroll to and open the Partners section.
  const partnersSection = page.locator('#section-partners')
  await expect(partnersSection).toBeVisible()

  await page.locator('.validation-panel .validation-go-to-field').first().click()

  // The section should be open after clicking.
  await expect(partnersSection).toHaveAttribute('open')
})

test('validation-highlight animation class is applied to the focused field', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  // Trigger a truncation finding.
  await page.getByLabel('City').fill('Buenos Aires Capital Federal Extendiiiisima')

  await expect
    .poll(() => findings(page), { timeout: 10_000 })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'text-truncated', field: 'city', severity: 'warning' }),
      ]),
    )

  // Click the "Go to field" link and verify the highlight class is briefly applied.
  const cityInput = page.getByRole('textbox', { name: 'City' }).first()
  await cityInput.evaluate((el: HTMLElement) => el.blur())

  await page.locator('.validation-panel .validation-go-to-field').first().click()

  // The field should briefly have the validation-highlight class (removed after 2s).
  await expect
    .poll(
      async () =>
        await cityInput.evaluate((el: HTMLElement) => el.classList.contains('validation-highlight')),
      { timeout: 3000 },
    )
    .toBe(true)
})
