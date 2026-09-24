import { expect, test } from '@playwright/test'
import { openSection, selectFormat } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
})

test('mobile tabs switch between fields and the shared live preview', async ({ page }) => {
  const fieldsTab = page.getByRole('tab', { name: 'Fields' })
  const previewTab = page.getByRole('tab', { name: 'Preview' })

  await expect(fieldsTab).toHaveAttribute('aria-selected', 'true')
  await expect(fieldsTab).toHaveAttribute('aria-controls', 'mobile-fields-panel')
  await expect(page.locator('.sidebar')).toHaveAttribute('role', 'tabpanel')
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect(page.locator('.stage')).toBeHidden()

  await selectFormat(page, 'speaker_banner')
  await openSection(page, 'section-event')
  await page.getByLabel('Event title').fill('Community spring meetup')
  await previewTab.click()

  await expect(previewTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.sidebar')).toBeHidden()
  await expect(page.getByLabel('Banner preview')).toBeVisible()
  await expect.poll(() =>
    page.getByLabel('Banner preview').evaluate((canvas) => ({
      width: (canvas as HTMLCanvasElement).width,
      height: (canvas as HTMLCanvasElement).height,
    })),
  ).toEqual({ width: 1080, height: 1350 })

  await fieldsTab.click()
  await expect(fieldsTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('Event title')).toHaveValue('Community spring meetup')
})

test('mobile view tabs support arrow-key navigation', async ({ page }) => {
  const fieldsTab = page.getByRole('tab', { name: 'Fields' })
  const previewTab = page.getByRole('tab', { name: 'Preview' })

  await fieldsTab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(previewTab).toHaveAttribute('aria-selected', 'true')
  await expect(previewTab).toBeFocused()

  await page.keyboard.press('ArrowLeft')
  await expect(fieldsTab).toHaveAttribute('aria-selected', 'true')
  await expect(fieldsTab).toBeFocused()
})

test('mobile preview tab remains available after scrolling and fields restore their scroll position', async ({ page }) => {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const fieldsScrollY = await page.evaluate(() => window.scrollY)
  expect(fieldsScrollY).toBeGreaterThan(100)

  const previewTab = page.getByRole('tab', { name: 'Preview' })
  await expect(previewTab).toBeVisible()
  await previewTab.click()
  await expect(page.locator('.stage')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

  await page.getByRole('tab', { name: 'Fields' }).click()
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(fieldsScrollY)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
})

test('desktop keeps the fields and preview visible without mobile tabs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })

  await expect(page.getByRole('tablist', { name: 'Editor view' })).toBeHidden()
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect(page.locator('.stage')).toBeVisible()
})
