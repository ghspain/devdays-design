import { expect, test } from '@playwright/test'
import { formatOptions } from '../../src/constants'

// Phase 4 (#52): a third EventTheme, `online_github`, is selectable from the
// "Design theme" Select. Same structural-smoke pattern as Phase 3's
// event-theme-community-meetup.spec.ts (see event-themes.spec.ts for why
// pixel/hash comparisons are avoided).

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await page.getByLabel('Design theme').selectOption('online_github')
})

test('selecting Online (GitHub style) updates the Design theme value', async ({ page }) => {
  await expect(page.getByLabel('Design theme')).toHaveValue('online_github')
})

for (const format of formatOptions) {
  test(`${format.id} renders at the expected size under the online_github theme`, async ({ page }) => {
    await page.locator('.format-bar select').selectOption(format.id)

    const canvas = page.getByLabel('Banner preview')
    await expect
      .poll(() =>
        canvas.evaluate((element) => {
          const bannerCanvas = element as HTMLCanvasElement
          return { width: bannerCanvas.width, height: bannerCanvas.height }
        }),
      )
      .toEqual({ width: format.width, height: format.height })

    // Polled (not a single check) because formats with a large PNG background
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
  await page.getByLabel('Design theme').selectOption('devdays')
  await expect(page.getByLabel('Design theme')).toHaveValue('devdays')
})
