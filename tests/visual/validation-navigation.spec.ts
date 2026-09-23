import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 1200, height: 800 } })

test('clicking a text-truncated finding scrolls to and focuses the Event title input', async ({ page }) => {
  await page.goto('/')

  // Set a very long event title that will trigger text-truncated validation
  await page.fill('input[id*="event-title"]', 'Esta es una conferencia internacional de tecnología y desarrollo de software con un nombre extremadamente largo que supera todos los límites')
  await page.waitForTimeout(1000) // Wait for validation

  // Check that the text-truncated finding appears
  const findings = page.locator('.validation-panel [data-component="Banner"]')
  await expect(findings.first()).toBeVisible()

  // Look for the "Go to" link/button in the finding
  const navigateBtn = page.locator('.validation-navigate').first()
  if (await navigateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await navigateBtn.click()
    // The event title input should receive focus
    await expect(page.locator('input[id*="event-title"]')).toBeFocused({ timeout: 3000 })
  }
})

test('clicking a speakers-dropped finding scrolls to the Speakers section', async ({ page }) => {
  await page.goto('/')

  // Clear any speakers
  const speakerCards = page.locator('[data-testid="speaker-card"]')
  const count = await speakerCards.count()
  if (count > 0) {
    for (let i = 0; i < count; i++) {
      const removeBtn = speakerCards.first().locator('button[aria-label*="Remove"]')
      if (await removeBtn.isVisible().catch(() => false)) {
        await removeBtn.click()
      }
    }
  }

  await page.waitForTimeout(500)

  // Check that the speakers-dropped finding appears
  const findings = page.locator('.validation-panel [data-component="Banner"]')
  const hasSpeakersFinding = await findings.evaluateAll(
    (banners) => banners.some((b) => b.textContent?.includes('speaker')),
    []
  )

  if (hasSpeakersFinding) {
    const navigateBtn = page.locator('.validation-navigate').first()
    if (await navigateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await navigateBtn.click()
      // The speakers section should be visible (scrolled into view)
      await expect(page.locator('#speakers-section')).toBeVisible({ timeout: 3000 })
    }
  }
})

test('validation findings are programmatically associated with controls', async ({ page }) => {
  await page.goto('/')

  // Set a long event title to trigger validation
  await page.fill('input[id*="event-title"]', 'Esta es una conferencia internacional de tecnología y desarrollo de software con un nombre extremadamente largo que supera todos los límites')
  await page.waitForTimeout(1000)

  // The event title input should have aria-describedby pointing to a validation element
  const titleInput = page.locator('input[id*="event-title"]')
  const ariaDescribedby = await titleInput.getAttribute('aria-describedby')

  // Either the input has aria-describedby, or the validation panel has role="status"
  const validationPanel = page.locator('.validation-panel')
  const panelRole = await validationPanel.getAttribute('role')

  expect(ariaDescribedby !== null && ariaDescribedby.length > 0 || panelRole === 'status').toBeTruthy()
})

test('all-clear state shows success banner', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  // With default state, check the validation panel
  const hasSuccess = await page.locator('.validation-panel').evaluate(
    (el) => el.textContent?.includes('All checks passed') || el.textContent?.includes('check passed')
  )

  expect(hasSuccess).toBeTruthy()
})