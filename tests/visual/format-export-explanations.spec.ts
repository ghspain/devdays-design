import { test, expect } from '@playwright/test'

test.describe('Format and export outputs are explained', () => {
  test('format select shows description for each option', async ({ page }) => {
    await page.goto('/')

    // Primer Select renders a native <select> inside .format-bar with all options
    const formatSelectEl = page.locator('.format-bar select')
    const options = await formatSelectEl.locator('option').all()
    expect(options.length).toBeGreaterThanOrEqual(4)

    // Verify option values include all format ids
    const values = await Promise.all(options.map((opt) => opt.getAttribute('value')))
    expect(values).toContain('speaker_square')
    expect(values).toContain('speaker_banner')
    expect(values).toContain('social_promo')
    expect(values).toContain('luma_cover')
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

    // Switch to speaker_banner format using the format-bar select
    const formatSelect = page.locator('.format-bar select')
    await formatSelect.selectOption('speaker_banner')

    // Add a second speaker via the "Add speaker" button
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
    expect(packText).toContain('.zip')
    expect(packText).toContain('speaker')
  })
})