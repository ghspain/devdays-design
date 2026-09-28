import { expect, test } from '@playwright/test'
import { openSection } from './helpers'

test('asset browser starts from production intent and returns to the shared editor state', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') {
    await page.setViewportSize({ width: 320, height: 740 })
  }
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  const titleInput = page.getByLabel('Event title')
  await openSection(page, 'section-event')
  await titleInput.fill('GHSpain Community Day')

  await page.getByRole('button', { name: 'Choose asset' }).click()
  await expect(page.getByRole('heading', { name: 'What are you creating?' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Event formats' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Speaker formats' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Networking badges' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Speaker Badge.*Front and back sides/ })).toBeVisible()

  const browserText = (await page.locator('.asset-start-screen').innerText()).toLowerCase()
  expect(browserText).not.toMatch(/event-promotion|speaker-promotion|social-promo|speaker-badge-front/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  const socialPromo = page.getByRole('button', { name: /Social Promo/ })
  await socialPromo.focus()
  await expect(socialPromo).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.format-card.selected')).toContainText('Social Promo')
  await expect(titleInput).toHaveValue('GHSpain Community Day')

  await page.getByRole('button', { name: 'Choose asset' }).click()
  await page.getByRole('button', { name: /Speaker Badge.*Front and back sides/ }).click()
  await expect(page.locator('.format-card.selected')).toContainText('Speaker Badge')
  if (testInfo.project.name === 'mobile-chromium') {
    await page.getByRole('tab', { name: 'Preview' }).click()
  }
  await expect(page.getByRole('tab', { name: 'Front' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Back' })).toBeVisible()

  if (testInfo.project.name === 'mobile-chromium') {
    await page.getByRole('tab', { name: 'Fields' }).click()
  }
  await page.getByRole('button', { name: 'Choose asset' }).click()
  await page.getByRole('button', { name: 'Back to editor' }).click()
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
