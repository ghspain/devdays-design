import { expect, test } from '@playwright/test'
import { selectFormat } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await expect(page.locator('.app-toast')).toHaveCount(0)
})

test('changing format shows the format-changed toast', async ({ page }) => {
  await selectFormat(page, 'speaker_square')
  const toast = page.locator('.app-toast')
  await expect(toast).toContainText('Format changed — edition and location fields updated.')
  // No undo action on this toast.
  await expect(toast.getByRole('button', { name: 'Undo' })).toHaveCount(0)
})

test('the format-changed toast dismisses on click', async ({ page }) => {
  await selectFormat(page, 'speaker_square')
  const toast = page.locator('.app-toast')
  await expect(toast).toContainText('Format changed')
  await toast.click()
  await expect(toast).toHaveCount(0)
})

test('the format-changed toast auto-dismisses after ~3 seconds', async ({ page }) => {
  await selectFormat(page, 'speaker_square')
  const toast = page.locator('.app-toast')
  await expect(toast).toContainText('Format changed')
  await expect(toast).toHaveCount(0, { timeout: 4500 })
})

test('switching to the same format again does not duplicate the toast', async ({ page }) => {
  await selectFormat(page, 'speaker_square')
  await expect(page.locator('.app-toast')).toContainText('Format changed')
  // Toast is single-slot; clicking a card that is already selected must not
  // retrigger it after dismissal.
  await page.locator('.app-toast').click()
  await expect(page.locator('.app-toast')).toHaveCount(0)
  await selectFormat(page, 'speaker_square')
  await expect(page.locator('.app-toast')).toHaveCount(0)
})
