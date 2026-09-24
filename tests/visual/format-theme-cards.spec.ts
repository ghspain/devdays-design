import { expect, test } from '@playwright/test'
import { EVENT_THEMES, formatOptions } from '../../src/constants'
import { formatCard, openSection, selectFormat, selectTheme, themeCard } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
})

test('format cards expose their purpose, dimensions, channels, and matching preview proportions', async ({ page }) => {
  for (const option of formatOptions) {
    const card = formatCard(page, option.id)
    await expect(card).toContainText(option.description ?? '')
    await expect(card).toContainText(`${option.width} × ${option.height}`)
    for (const channel of option.channels ?? []) {
      await expect(card).toContainText(channel)
    }

    const ratio = await card.locator('.format-ratio').evaluate((element) => {
      const { width, height } = element.getBoundingClientRect()
      return width / height
    })
    expect(ratio).toBeCloseTo(option.width / option.height, 1)
  }
})

test('selecting format and theme cards updates the existing editor state', async ({ page }) => {
  await selectFormat(page, 'speaker_banner')
  await expect(formatCard(page, 'speaker_banner')).toHaveAttribute('aria-pressed', 'true')
  await expect(formatCard(page, 'luma_cover')).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => page.getByLabel('Banner preview').evaluate((canvas) => (canvas as HTMLCanvasElement).height))
    .toBe(1350)

  await openSection(page, 'section-event')
  await selectTheme(page, 'community_meetup')
  await expect(themeCard(page, 'community_meetup')).toHaveAttribute('aria-pressed', 'true')
  const swatches = await themeCard(page, 'community_meetup').locator('.swatch-row span').evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).backgroundColor),
  )
  expect(swatches).toEqual([
    'rgb(240, 246, 252)',
    'rgb(163, 113, 247)',
    'rgb(13, 17, 23)',
  ])

  for (const theme of Object.values(EVENT_THEMES)) {
    await expect(themeCard(page, theme.id)).toBeVisible()
  }
})

test('format cards remain usable without horizontal overflow on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(formatCard(page, 'luma_cover')).toBeVisible()
  await openSection(page, 'section-event')
  await expect(themeCard(page, 'devdays')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(1)
})
