import { expect, test } from '@playwright/test'
import { openSection, selectFormat } from './helpers'

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
})

test('removing a speaker shows a toast with Undo that restores the speaker', async ({ page }) => {
  // The speakers section only renders for non-minimal formats (luma_cover hides it).
  await selectFormat(page, 'speaker_square')
  await openSection(page, 'section-speakers')
  const removeButtons = page.getByRole('button', { name: 'Remove', exact: true })
  const before = await removeButtons.count()
  expect(before).toBeGreaterThan(0)
  await removeButtons.first().click()

  const toast = page.locator('.app-toast')
  await expect(toast).toContainText('Speaker removed.')
  await expect(toast.getByRole('button', { name: 'Undo' })).toBeVisible()

  await toast.getByRole('button', { name: 'Undo' }).click()
  await expect(toast).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(before)
})

test('removing a partner logo shows a toast with Undo that restores the logo', async ({ page }) => {
  await openSection(page, 'section-partners')
  const upload = page.locator('#sponsor-logo-upload')
  await upload.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: TINY_PNG })
  await expect(page.locator('.logo-tile')).toHaveCount(1)

  await page.locator('.logo-tile').getByRole('button', { name: 'Remove' }).click()
  const toast = page.locator('.app-toast')
  await expect(toast).toContainText('Partner logo removed.')
  await expect(toast.getByRole('button', { name: 'Undo' })).toBeVisible()

  await toast.getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('.logo-tile')).toHaveCount(1)
})

test('the speaker-removal toast auto-dismisses without clicking Undo', async ({ page }) => {
  await selectFormat(page, 'speaker_square')
  await openSection(page, 'section-speakers')
  await page.getByRole('button', { name: 'Remove', exact: true }).first().click()
  await expect(page.locator('.app-toast')).toContainText('Speaker removed.')
  // Undo window is 5s (see 🧭 DECISION in App.tsx); assert it clears after that.
  await expect(page.locator('.app-toast')).toHaveCount(0, { timeout: 8000 })
})

test('whole Reset keeps its confirm dialog and never uses a toast', async ({ page }) => {
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.getByText('Reset all fields to defaults? This will clear the current draft.')).toBeVisible()
  await expect(page.locator('.app-toast')).toHaveCount(0)
})
