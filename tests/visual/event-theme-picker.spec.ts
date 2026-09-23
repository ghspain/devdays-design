import { expect, test } from '@playwright/test'
import { selectFormat, themeCard } from './helpers'

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

test('the sidebar exposes visual Design theme cards distinct from Event preset', async ({ page }) => {
  const eventPreset = page.getByLabel('Event preset')
  await expect(eventPreset).toHaveAttribute('data-component', 'Select')

  const themeGroup = page.getByRole('group', { name: 'Design theme' })
  await expect(themeGroup.locator('.theme-card')).toHaveCount(3)
  await expect(themeCard(page, 'devdays')).toHaveAttribute('aria-pressed', 'true')
  await expect(themeCard(page, 'community_meetup').locator('.swatch-row span')).toHaveCount(3)
})

test('switching the banner format does not change the selected design theme', async ({ page }) => {
  await selectFormat(page, 'speaker_square')
  await expect(themeCard(page, 'devdays')).toHaveAttribute('aria-pressed', 'true')
  await selectFormat(page, 'luma_cover')
  await expect(themeCard(page, 'devdays')).toHaveAttribute('aria-pressed', 'true')
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

  await expect(themeCard(page, 'devdays')).toHaveAttribute('aria-pressed', 'true')
})
