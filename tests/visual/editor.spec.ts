import { expect, test } from '@playwright/test'

const formats = [
  { id: 'speaker_square', width: 1080, height: 1080 },
  { id: 'speaker_banner', width: 1600, height: 900 },
  { id: 'luma_cover', width: 1080, height: 1350 },
  { id: 'social_promo', width: 1080, height: 1350 },
] as const

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
})

for (const format of formats) {
  test(`${format.id} renders a populated canvas without layout overflow`, async ({ page }, testInfo) => {
    await page.locator('.format-bar select').selectOption(format.id)

    const canvas = page.getByLabel('Banner preview')
    await expect(canvas).toBeVisible()
    await expect
      .poll(() =>
        canvas.evaluate((element) => {
          const bannerCanvas = element as HTMLCanvasElement
          return { width: bannerCanvas.width, height: bannerCanvas.height }
        }),
      )
      .toEqual({ width: format.width, height: format.height })

    const renderedPixels = await canvas.evaluate((element) => {
      const bannerCanvas = element as HTMLCanvasElement
      const context = bannerCanvas.getContext('2d')
      if (!context) return 0
      const pixels = context.getImageData(0, 0, bannerCanvas.width, bannerCanvas.height).data
      let populated = 0
      const step = Math.max(4, Math.floor(pixels.length / 4000 / 4) * 4)
      for (let index = 3; index < pixels.length; index += step) {
        if (pixels[index] > 0) populated += 1
      }
      return populated
    })
    expect(renderedPixels).toBeGreaterThan(500)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)

    await testInfo.attach(`${format.id}-${testInfo.project.name}`, {
      body: await page.locator('.stage').screenshot(),
      contentType: 'image/png',
    })
  })
}
