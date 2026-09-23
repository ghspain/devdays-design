import { expect, test } from '@playwright/test'

const guideKey = 'devdays-editor-guide-dismissed-v1'

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    const initializedKey = `${key}-test-initialized`
    if (!window.sessionStorage.getItem(initializedKey)) {
      window.localStorage.removeItem(key)
      window.sessionStorage.setItem(initializedKey, 'true')
    }
  }, guideKey)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
})

test('the quick guide explains formats, presets, themes, validation, and exports', async ({ page }) => {
  const guide = page.getByRole('region', { name: 'A quick guide' })
  await expect(guide).toBeVisible()
  await expect(guide).toContainText('Format chooses the image shape and channel')
  await expect(guide).toContainText('Event preset fills event details')
  await expect(guide).toContainText('Design theme sets the visual identity')
  await expect(guide).toContainText('Review validation messages')
  await expect(guide).toContainText('Download PNG')
  await expect(guide).toContainText('Event pack (.zip)')
})

test('dismissing the guide persists without changing the editor draft', async ({ page }) => {
  const title = page.getByLabel('Event title')
  await title.fill('Organizer draft title')
  await page.getByRole('button', { name: 'Dismiss' }).click()

  await expect(page.getByRole('region', { name: 'A quick guide' })).toBeHidden()
  await expect(title).toHaveValue('Organizer draft title')
  await expect(page.locator('.draft-status')).toContainText('Saved', { timeout: 5000 })
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), guideKey)).toBe('dismissed')

  await page.reload()
  await expect(page.getByRole('region', { name: 'A quick guide' })).toHaveCount(0)
  await expect(page.getByLabel('Event title')).toHaveValue('Organizer draft title')
})

test('the quick guide fits on a narrow viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const guide = page.getByRole('region', { name: 'A quick guide' })
  await expect(guide).toBeVisible()
  await expect(guide.getByRole('button', { name: 'Dismiss' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(1)
})

test('the editor stays usable when local storage is blocked', async ({ browser }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage access is blocked', 'SecurityError')
      },
    })
  })
  const page = await context.newPage()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'A quick guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByText(/Could not save your guide preference/)).toBeVisible()

  await context.close()
})
