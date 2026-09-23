import { expect, test } from '@playwright/test'

// Phase 2 (#50): organizers can switch the event design theme from the
// editor sidebar. The control is intentionally labeled "Design theme" and
// kept separate from the pre-existing "Event preset" Select (lib/catalog.ts,
// an unrelated data-catalog feature) - see epic #48.

const tinyLogo =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function historyItem(theme?: string) {
  return {
    id: `h-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    previewDataUrl: tinyLogo,
    state: {
      format: 'speaker_square',
      theme,
      speakers: [],
      partners: [],
      event: { includeSupportedBy: true },
    },
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
})

test('the sidebar exposes a Design theme Select distinct from Event preset', async ({ page }) => {
  const eventPreset = page.getByLabel('Event preset')
  await expect(eventPreset).toHaveAttribute('data-component', 'Select')

  const designTheme = page.getByLabel('Design theme')
  await expect(designTheme).toHaveAttribute('data-component', 'Select')
  await expect(designTheme).toHaveValue('devdays')
  await expect(designTheme.locator('option')).toHaveCount(1)
})

test('switching the banner format does not change the selected design theme', async ({ page }) => {
  await page.locator('.format-bar select').selectOption('speaker_square')
  await expect(page.getByLabel('Design theme')).toHaveValue('devdays')
  await page.locator('.format-bar select').selectOption('luma_cover')
  await expect(page.getByLabel('Design theme')).toHaveValue('devdays')
})

test('reopening a saved history item restores its design theme', async ({ page }) => {
  await page.addInitScript((payload) => window.localStorage.setItem('banner-history-v1', JSON.stringify(payload)), [
    historyItem('devdays'),
  ])
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  await page.getByRole('button', { name: 'Toggle previous banners' }).click()
  const drawer = page.locator('.history-drawer')
  await expect(drawer).toBeVisible()
  await drawer.getByRole('button', { name: 'Open' }).click()
  await expect(drawer).toBeHidden()

  await expect(page.getByLabel('Design theme')).toHaveValue('devdays')
})
