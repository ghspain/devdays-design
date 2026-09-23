import type { Page } from '@playwright/test'
import { EVENT_THEMES, formatOptions } from '../../src/constants'
import type { BannerFormat, EventThemeId } from '../../src/types'

export function formatCard(page: Page, id: BannerFormat) {
  const option = formatOptions.find((item) => item.id === id)
  if (!option) throw new Error(`Unknown banner format: ${id}`)
  return page.getByRole('button', { name: new RegExp(`^${option.name},`) })
}

export async function selectFormat(page: Page, id: BannerFormat) {
  await formatCard(page, id).click()
}

export function themeCard(page: Page, id: EventThemeId) {
  const theme = EVENT_THEMES[id]
  if (!theme) throw new Error(`Unknown design theme: ${id}`)
  return page.getByRole('button', { name: theme.name, exact: true })
}

export async function selectTheme(page: Page, id: EventThemeId) {
  await themeCard(page, id).click()
}

export async function showPreviewForViewport(page: Page) {
  if (await page.evaluate(() => window.innerWidth <= 760)) {
    await page.getByRole('tab', { name: 'Preview' }).click()
  }
}
