import { expect, test } from '@playwright/test'
import { openSection } from './helpers'

test.describe('Event drafts survive reloads', () => {
  test('editing event title and reload restores the draft', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

    // Edit the event title
    const titleInput = page.getByLabel('Event title')
    await openSection(page, 'section-event')
    await titleInput.fill('My Custom Event')
    await expect(titleInput).toHaveValue('My Custom Event')

    // Wait for draft save status
    await expect(page.locator('.draft-status')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.draft-status')).toContainText('Saved', { timeout: 5000 })

    // Reload the page
    await page.reload()
    await expect(titleInput).toHaveValue('My Custom Event', { timeout: 10000 })
  })

  test('editing format and reload restores the draft', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

      // Change format by clicking the Speaker Profile card
      await page.getByRole('button', { name: /Speaker Profile/ }).click()
      await expect(page.locator('.format-card.selected')).toContainText('Speaker Profile', { timeout: 3000 })

    // Wait for draft save
    await expect(page.locator('.draft-status')).toContainText('Saved', { timeout: 5000 })

    // Reload
    await page.reload()
      await expect(page.locator('.format-card.selected')).toContainText('Speaker Profile', { timeout: 10000 })
  })

  test('reset confirm clears the draft and restores defaults', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

      // Edit the event title
      const titleInput = page.getByLabel('Event title')
      await openSection(page, 'section-event')
      await titleInput.fill('Temporary Event')
      await expect(titleInput).toHaveValue('Temporary Event')

      // Wait for draft save
      await expect(page.locator('.draft-status')).toContainText('Saved', { timeout: 5000 })

      // Click Reset and confirm via custom dialog
      await page.getByRole('button', { name: 'Reset' }).click()
      await page.getByRole('button', { name: 'Clear draft' }).click()

      // The title should be restored to default
      await expect(titleInput).toHaveValue('Dev Days', { timeout: 5000 })
    })

  test('reset cancel keeps the draft', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

      // Edit the event title
      const titleInput = page.getByLabel('Event title')
      await openSection(page, 'section-event')
      await titleInput.fill('Temporary Event')
      await expect(titleInput).toHaveValue('Temporary Event')

      // Wait for draft save
      await expect(page.locator('.draft-status')).toContainText('Saved', { timeout: 5000 })

      // Click Reset and cancel via custom dialog
      await page.getByRole('button', { name: 'Reset' }).click()
      await page.getByRole('button', { name: 'Cancel' }).click()

      // The title should still be the temporary one
      await expect(titleInput).toHaveValue('Temporary Event', { timeout: 5000 })
    })

  test('draft save status is accessible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

    // Edit something to trigger a save
    const titleInput = page.getByLabel('Event title')
    await openSection(page, 'section-event')
    await titleInput.fill('Test Event')

    // Check that the draft status has aria-live
    const draftStatus = page.locator('.draft-status')
    await expect(draftStatus).toHaveAttribute('aria-live', 'polite')
  })
})