import { test, expect } from '@playwright/test'
import { openSection } from './helpers'

test.describe('Format and export outputs are explained', () => {
  test('format cards show name and description for each format', async ({ page }) => {
    await page.goto('/')

    // Format cards render as toggle buttons with descriptive aria-labels
    const cards = page.locator('.format-card')
    expect(await cards.count()).toBeGreaterThanOrEqual(4)

    const labels = await cards.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
    expect(labels.some((l) => l?.includes('Speaker Profile'))).toBeTruthy()
    expect(labels.some((l) => l?.includes('Speaker Banner'))).toBeTruthy()
    expect(labels.some((l) => l?.includes('Social Promo'))).toBeTruthy()
    expect(labels.some((l) => l?.includes('Luma Cover'))).toBeTruthy()

    // Each card's label includes a description beyond the name and dimensions
    const withDescription = labels.filter((l) => l && l.split(',').length >= 3)
    expect(withDescription.length).toBe(labels.length)
  })

  test('download button shows dimensions and file count', async ({ page }) => {
    await page.goto('/')

    // Default format is luma_cover (1000x1000)
    const downloadBtn = page.locator('button.download-main')
    await expect(downloadBtn).toBeVisible()

    // Check that the button text contains dimensions
    const buttonText = await downloadBtn.textContent()
    expect(buttonText).toContain('PNG')
    expect(buttonText).toContain('1000')
  })

  test('download button shows file count for speaker formats with multiple speakers', async ({
    page,
  }) => {
    await page.goto('/')

    // Switch to speaker_banner format via its format card
    await page.getByRole('button', { name: /Speaker Banner/ }).click()

    // Add a second speaker via the "Add speaker" button
    await openSection(page, 'section-speakers')
    const addSpeakerBtn = page.getByRole('button', { name: 'Add speaker' })
    await addSpeakerBtn.click()

      // Fill in the second speaker name (TextInput with id containing speaker-name-)
      const speakerNameInputs = page.locator('input[id*="speaker-name-"]')
      await speakerNameInputs.last().fill('Jane Doe')

      // Wait for the download button to update with "files" (plural)
      const downloadBtn = page.locator('button.download-main')
      await expect(downloadBtn).toContainText('files')
    })

  test('event pack button distinguishes ZIP from PNG download', async ({ page }) => {
    await page.goto('/')

    // The ZIP button should contain "Event pack" and ".zip"
    const packBtn = page.locator('button.pack-download')
    await expect(packBtn).toBeVisible()

    const packText = await packBtn.textContent()
    expect(packText).toContain('Event pack')
    expect(packText).toContain('.zip')

    // The PNG button must not be confused with the ZIP button
    const downloadBtn = page.locator('button.download-main')
    const downloadText = await downloadBtn.textContent()
    expect(downloadText).not.toContain('.zip')
    expect(downloadText).toContain('PNG')
  })
})