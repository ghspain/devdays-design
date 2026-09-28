import { expect, test } from '@playwright/test'

test('selecting artboard text focuses its property and updates the live preview', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chromium'
  if (mobile) await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  const navigation = page.locator('.asset-navigation')
  const properties = page.locator('.sidebar')
  const stage = page.locator('.stage')
  await navigation.getByRole('button', { name: /Speaker Profile/ }).click()
  if (mobile) {
    await expect(navigation).toBeVisible()
    await expect(properties).toBeVisible()
    await page.getByRole('tab', { name: 'Preview' }).click()
    await expect(navigation).toBeHidden()
    await expect(properties).toBeHidden()
    await testInfo.attach('event-studio-mobile-preview', { body: await page.screenshot(), contentType: 'image/png' })
  } else {
    const navBox = await navigation.boundingBox()
    const stageBox = await stage.boundingBox()
    const propertiesBox = await properties.boundingBox()
    expect(navBox && stageBox && propertiesBox).toBeTruthy()
    expect(navBox!.x).toBeLessThan(stageBox!.x)
    expect(stageBox!.x).toBeLessThan(propertiesBox!.x)
    await expect(properties.getByText('Properties')).toBeVisible()
    await testInfo.attach('event-studio-desktop-workspace', { body: await page.screenshot(), contentType: 'image/png' })
  }

  const speakerName = page.locator('.artboard-selection-target[data-field="speaker name"]')
  await expect(speakerName).toBeVisible()
  const before = await page.locator('.canvas-wrap canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())
  if (mobile) {
    await speakerName.click()
  } else {
    await speakerName.focus()
    await expect(speakerName).toBeFocused()
    await page.keyboard.press('Enter')
  }

  const nameInput = page.locator('input[id^="speaker-name-"]').first()
  await expect(nameInput).toBeFocused()
  await nameInput.fill('Ada Lovelace')
  await expect.poll(() => page.locator('.canvas-wrap canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()))
    .not.toBe(before)
  if (mobile) await page.getByRole('tab', { name: 'Preview' }).click()
  await expect(page.locator('.artboard-selection-target[data-field="speaker name"]')).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  if (mobile) await expect(page.getByRole('tab', { name: 'Preview' })).toHaveAttribute('aria-selected', 'true')
})

test('template navigation keeps multi-side badge selection integrated with the artboard', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('.asset-navigation').getByRole('button', { name: /Speaker Badge/ }).click()
  await expect(page.locator('.format-card[aria-pressed="true"]')).toContainText('Speaker Badge')
  if (testInfo.project.name === 'mobile-chromium') await page.getByRole('tab', { name: 'Preview' }).click()
  await expect(page.getByRole('tab', { name: 'Front' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Back' })).toBeVisible()
  await expect(page.locator('.artboard-selection-target[data-field="speaker name"]')).toBeVisible()
})
