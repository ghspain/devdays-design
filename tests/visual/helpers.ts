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
  await openSection(page, 'section-event')
  await themeCard(page, id).click()
}

// #79: sections start collapsed except the format section. Tests that
// interact with fields inside a collapsed section must open it first.
export async function openSection(page: Page, id: string) {
  const section = page.locator(`details#${id}`)
  // getAttribute('open') returns "" for an open <details>, which is falsy —
  // use the element's `open` property instead.
  if (!(await section.evaluate((el) => (el as HTMLDetailsElement).open))) {
    await section.locator('summary').click()
  }
}

export async function showPreviewForViewport(page: Page) {
  if (await page.evaluate(() => window.innerWidth <= 760)) {
    await page.getByRole('tab', { name: 'Preview' }).click()
  }
}
