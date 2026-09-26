import { expect, test } from '@playwright/test'
import { formatOptions } from '../../src/constants'
import { selectFormat, selectTheme, themeCard } from './helpers'

// Phase 4 (#52): a third EventTheme, `online_github`, is selectable from the
// "Design theme" Select. Same structural-smoke pattern as Phase 3's
// event-theme-community-meetup.spec.ts (see event-themes.spec.ts for why
// pixel/hash comparisons are avoided).

// Wait for the luma background image to load (it's a large background image that can be slow
// when running tests in parallel with many workers).
async function waitForLumaBackground(page: import('@playwright/test').Page) {
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const canvas = document.querySelector('canvas[aria-label="Banner preview"]') as HTMLCanvasElement
        if (!canvas) return false
        const ctx = canvas.getContext('2d')
        if (!ctx) return false
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        for (let index = 0; index < data.length; index += 4) {
          if (data[index + 3] !== 0) return true
        }
        return false
      })
    }, { timeout: 15000 })
    .toBe(true)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await selectTheme(page, 'online_github')
})

test('selecting Online (GitHub style) marks its visual theme card selected', async ({ page }) => {
  await expect(themeCard(page, 'online_github')).toHaveAttribute('aria-pressed', 'true')
})

for (const format of formatOptions) {
  test(`${format.id} renders at the expected size under the online_github theme`, async ({ page }) => {
    await selectFormat(page, format.id)

    // Wait for luma background image to load before checking canvas
    if (format.id === 'luma_cover') {
      await waitForLumaBackground(page)
    }

    const canvas = page.getByLabel('Banner preview')
    await expect
      .poll(() =>
        canvas.evaluate((element) => {
          const bannerCanvas = element as HTMLCanvasElement
          return { width: bannerCanvas.width, height: bannerCanvas.height }
        }),
      )
      .toEqual({ width: format.width, height: format.height })

    // Polled (not a single check) because formats with a large background image
    // (e.g. luma_cover) can still be mid-decode under parallel test workers;
    // a single early read would flake.
    await expect
      .poll(() =>
        canvas.evaluate((element) => {
          const bannerCanvas = element as HTMLCanvasElement
          const context = bannerCanvas.getContext('2d')
          if (!context) return false
          const { data } = context.getImageData(0, 0, bannerCanvas.width, bannerCanvas.height)
          for (let index = 0; index < data.length; index += 4) {
            if (data[index + 3] !== 0) return true
          }
          return false
        }),
        { message: `${format.id} canvas should not be blank` },
      )
      .toBe(true)
  })
}

test('switching back to Dev Days restores the devdays theme value', async ({ page }) => {
  await selectTheme(page, 'devdays')
  await expect(themeCard(page, 'devdays')).toHaveAttribute('aria-pressed', 'true')
})
