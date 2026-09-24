import { expect, test } from '@playwright/test'
import { selectFormat } from './helpers'

// #78: one clear download hierarchy — a single primary PNG CTA in the
// sidebar footer, the Event pack (.zip) as a secondary action, and no
// download control left in the stage toolbar.

test('the sidebar exposes a single primary download CTA', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  // Exactly one primary download button lives in the sidebar footer.
  const footer = page.locator('.sidebar-footer')
  await expect(footer.locator('button[data-variant="primary"]')).toHaveCount(1)
  const main = page.locator('button.download-main')
  await expect(main).toBeVisible()
  await expect(main).toHaveAttribute('data-variant', 'primary')
})

test('the Event pack (.zip) is a secondary action in the same footer', async ({ page }) => {
  await page.goto('/')
  const pack = page.locator('button.pack-download')
  await expect(pack).toBeVisible()
  await expect(pack).toHaveAccessibleName(/Event pack \(\.zip\)/)
  await expect(pack).not.toHaveAttribute('data-variant', 'primary')

  // It sits inside the same footer as the primary CTA.
  await expect(page.locator('.sidebar-footer button.pack-download')).toBeVisible()
})

test('the stage toolbar has no download control on any format', async ({ page }) => {
  await page.goto('/')
  for (const format of ['luma_cover', 'speaker_banner', 'social_promo', 'speaker_square']) {
    await selectFormat(page, format)
    await expect(page.locator('.stage-toolbar button[title="Download PNG"]')).toHaveCount(0)
    await expect(page.locator('.stage-toolbar [aria-label*="Download"]')).toHaveCount(0)
  }
})
