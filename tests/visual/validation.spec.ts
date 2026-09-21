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
