import { expect, test } from '@playwright/test'
import { formatOptions } from '../../src/constants'

// Phase 1 (#49): colors and fixed brand text now come from an EventTheme
// resolved through `getEventTheme(state.theme)` instead of hardcoded
// module-level constants in `renderBanner.ts`. Exact literal parity with the
// previous constants was verified by code review (every EVENT_THEMES.devdays
// value is copied verbatim from the pre-refactor constants) and by the
// existing visual/validation suite passing unchanged. This spec is a
// structural smoke guard: it renders every format under the default
// ('devdays') theme and checks the canvas comes out at the expected
// dimensions with real, non-blank content - a full pixel hash isn't used here
// because canvas text antialiasing differs between OSes/Chromium builds and
// makes byte-for-byte hashing flaky across local and CI runners.

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
})

for (const format of formatOptions) {
  test(`${format.id} renders at the expected size under the default (devdays) theme`, async ({ page }) => {
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

    // A blank/transparent canvas (all-zero pixel data) would mean the theme
    // failed to resolve and nothing got drawn - catch that without asserting
    // exact pixel values.
    const hasContent = await canvas.evaluate((element) => {
      const bannerCanvas = element as HTMLCanvasElement
      const context = bannerCanvas.getContext('2d')
      if (!context) return false
      const { data } = context.getImageData(0, 0, bannerCanvas.width, bannerCanvas.height)
      for (let index = 0; index < data.length; index += 4) {
        if (data[index + 3] !== 0) return true
      }
      return false
    })

    expect(hasContent, `${format.id} canvas should not be blank`).toBe(true)
  })
}
