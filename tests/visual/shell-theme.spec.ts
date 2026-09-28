import { expect, test } from '@playwright/test'

function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = color.startsWith('#')
      ? color.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16))
      : color.match(/[\d.]+/g)?.slice(0, 3).map(Number)
    if (!channels || channels.length !== 3) throw new Error(`Expected an RGB color, got ${color}`)
    const linear = channels.map((channel) => {
      const value = channel / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
  }
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

test('shell theme is accessible, independent from the artwork, and remembered', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') {
    await page.setViewportSize({ width: 320, height: 740 })
  }
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem('shell-theme-test-started')) {
      window.localStorage.removeItem('devdays-shell-theme-v1')
      window.sessionStorage.setItem('shell-theme-test-started', 'true')
    }
  })
  await page.goto('/')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  const shell = page.locator('.editor-shell')
  const themeToggle = page.getByRole('button', { name: 'Switch to dark theme' })
  await expect(shell).toHaveAttribute('data-color-mode', 'light')
  await expect(page.locator('[data-component="ThemeProvider"]')).toHaveAttribute('data-color-mode', 'light')

  const light = await page.evaluate(() => {
    const title = document.querySelector('.sidebar-title')!
    const sidebar = document.querySelector('.sidebar')!
    const stage = document.querySelector('.stage')!
    return {
      foreground: getComputedStyle(title).color,
      background: getComputedStyle(sidebar).backgroundColor,
      stage: getComputedStyle(stage).backgroundColor,
      font: getComputedStyle(document.querySelector('.topbar h1')!).fontFamily,
      statuses: ['--action-primary', '--status-error', '--status-warning', '--status-success']
        .map((token) => getComputedStyle(document.querySelector('.editor-shell')!).getPropertyValue(token).trim()),
    }
  })
  expect(contrastRatio(light.foreground, light.background)).toBeGreaterThanOrEqual(4.5)
  for (const color of light.statuses) expect(contrastRatio(color, light.background)).toBeGreaterThanOrEqual(4.5)
  expect(light.font).toContain('Mona Sans')

  await page.keyboard.press('Tab')
  await expect(themeToggle).toBeFocused()
  expect(await themeToggle.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
  expect(await themeToggle.evaluate((element) => getComputedStyle(element).outlineWidth)).toBe('2px')
  await themeToggle.click()

  await expect(shell).toHaveAttribute('data-color-mode', 'dark')
  await expect(page.locator('[data-component="ThemeProvider"]')).toHaveAttribute('data-color-mode', 'dark')
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toHaveAttribute('aria-pressed', 'true')
  const dark = await page.evaluate(() => {
    const title = document.querySelector('.sidebar-title')!
    const sidebar = document.querySelector('.sidebar')!
    const stage = document.querySelector('.stage')!
    return {
      foreground: getComputedStyle(title).color,
      background: getComputedStyle(sidebar).backgroundColor,
      stage: getComputedStyle(stage).backgroundColor,
      statuses: ['--action-primary', '--status-error', '--status-warning', '--status-success']
        .map((token) => getComputedStyle(document.querySelector('.editor-shell')!).getPropertyValue(token).trim()),
    }
  })
  expect(contrastRatio(dark.foreground, dark.background)).toBeGreaterThanOrEqual(4.5)
  for (const color of dark.statuses) expect(contrastRatio(color, dark.background)).toBeGreaterThanOrEqual(4.5)
  expect(dark.stage).toBe(light.stage)

  await page.reload()
  await expect(page.locator('.editor-shell')).toHaveAttribute('data-color-mode', 'dark')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reducedMotionDuration = await page.locator('.format-card').first().evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).transitionDuration),
  )
  expect(reducedMotionDuration).toBeLessThanOrEqual(0.00001)
})
