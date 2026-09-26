import { expect, test } from '@playwright/test'
import { formatOptions } from '../../src/constants'
import { selectFormat } from './helpers'

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

// Wait for the luma background image to load (it's a large background image that can be slow
// when running tests in parallel with many workers). We wait for the canvas to
// have non-zero alpha pixels, which indicates the background has been drawn.
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
})

for (const format of formatOptions) {
  test(`${format.id} renders at the expected size under the default (devdays) theme`, async ({ page }) => {
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

    // A blank/transparent canvas (all-zero pixel data) would mean the theme
    // failed to resolve and nothing got drawn - catch that without asserting
    // exact pixel values. Polled (not a single check) because formats with a
    // large background image (e.g. luma_cover) can still be mid-decode under
    // parallel test workers; a single early read would flake.
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
