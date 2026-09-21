import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'
import { formatOptions } from '../../src/constants'

const formats = formatOptions.map(({ id, width, height }) => ({ id, width, height }))

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

test('catalogue logos are packaged as readable transparent SVG assets', async ({ page }) => {
  const logos = [
    'logos/celonis-black.svg',
    'logos/celonis-white.svg',
    'logos/github-community-spain-black.svg',
    'logos/github-community-spain-white.svg',
    'logos/techriders-black.svg',
    'logos/techriders-white.svg',
  ]

  for (const logo of logos) {
    const response = await page.request.get(new URL(logo, page.url()).href)
    expect(response.ok(), `${logo} should be available`).toBe(true)
    expect(response.headers()['content-type']).toContain('image/svg+xml')
    expect((await response.body()).byteLength).toBeGreaterThan(500)
  }
})

test('speaker banner renders selected organizer and sponsor logos', async ({ page }, testInfo) => {
  const failedLogoRequests: string[] = []
  page.on('requestfailed', (request) => {
    if (request.url().includes('/logos/')) failedLogoRequests.push(request.url())
  })

  await page.locator('.format-bar select').selectOption('speaker_banner')
  await page.getByLabel('Select organizer').selectOption('ghspain')
  await page.getByRole('button', { name: 'Use selected organizer' }).click()
  await page.getByLabel('Add from sponsor or collaborator catalogue').selectOption('celonis')
  await page.getByRole('button', { name: 'Add selected sponsor' }).click()

  await expect(page.getByText('2 slot(s) remaining.')).toBeVisible()
  await expect.poll(() => failedLogoRequests).toEqual([])
  await testInfo.attach(`catalogue-logos-${testInfo.project.name}`, {
    body: await page.locator('.stage').screenshot(),
    contentType: 'image/png',
  })
})

test('applying an event preset keeps the selected banner format', async ({ page }) => {
  await page.locator('.format-bar select').selectOption('speaker_square')
  await page.getByLabel('Event preset').selectOption('meetup')
  await expect(page.locator('.format-bar select')).toHaveValue('speaker_square')
  await page.getByLabel('Event preset').selectOption('devdays')
  await expect(page.locator('.format-bar select')).toHaveValue('speaker_square')
})

test('formats are grouped into event and speaker families', async ({ page }) => {
  await expect(page.locator('.format-bar optgroup[label="Event formats"] option')).toHaveCount(2)
  await expect(page.locator('.format-bar optgroup[label="Speaker formats"] option')).toHaveCount(2)
})

test('speaker avatars render inside the square canvas', async ({ page }) => {
  await page.locator('.format-bar select').selectOption('speaker_square')
  const canvas = page.getByLabel('Banner preview')
  await expect
    .poll(() =>
      canvas.evaluate((element) => (element as HTMLCanvasElement).width),
    )
    .toBe(1080)

  const countAccentPixels = () =>
    canvas.evaluate((element) => {
      const bannerCanvas = element as HTMLCanvasElement
      const context = bannerCanvas.getContext('2d')
      if (!context) return 0
      const top = Math.round(bannerCanvas.height * 0.4)
      const bandHeight = Math.round(bannerCanvas.height * 0.35)
      const { data } = context.getImageData(0, top, bannerCanvas.width, bandHeight)
      let count = 0
      for (let index = 0; index < data.length; index += 4) {
        if (Math.abs(data[index] - 10) < 8 && Math.abs(data[index + 1] - 191) < 8 && Math.abs(data[index + 2] - 64) < 8) count += 1
      }
      return count
    })

  while ((await page.locator('.speaker-card').count()) > 0) {
    await page.locator('.speaker-card').first().getByRole('button', { name: 'Remove' }).click()
  }
  await expect(page.getByText('No speakers yet.')).toBeVisible()
  const baseline = await countAccentPixels()

  await page.getByRole('button', { name: 'Add speaker' }).click()
  await expect.poll(countAccentPixels).toBeGreaterThan(baseline + 5000)
})

test('catalogue speaker selection adds cumulatively with dedupe and a counter', async ({ page }) => {
  await page.locator('.format-bar select').selectOption('speaker_square')
  const counter = page.locator('.section-count')
  await expect(counter).toHaveText('1 / 12')

  await page.locator('.catalog-picker select').selectOption('2026-04-17-copilot-dev-days-madrid')
  const options = page.locator('.catalog-option')
  await expect(options.first()).toBeVisible()

  await options.nth(0).locator('input[type=checkbox]').check()
  await options.nth(1).locator('input[type=checkbox]').check()
  await page.getByRole('button', { name: 'Add selected speakers (2)' }).click()
  await expect(counter).toHaveText('3 / 12')
  await expect(page.locator('.speaker-card')).toHaveCount(3)
  await expect(options.locator('input[type=checkbox]:checked')).toHaveCount(0)

  await options.nth(0).locator('input[type=checkbox]').check()
  await options.nth(1).locator('input[type=checkbox]').check()
  await page.getByRole('button', { name: 'Add selected speakers (2)' }).click()
  await expect(counter).toHaveText('3 / 12')

  await page.locator('.speaker-card').first().getByRole('button', { name: 'Remove' }).click()
  await expect(counter).toHaveText('2 / 12')
})

test('sponsors section is available on the speaker square format', async ({ page }) => {
  await page.locator('.format-bar select').selectOption('speaker_square')
  await expect(page.getByText('Sponsors and collaborators')).toBeVisible()
})

test('event pack downloads every format in one ZIP', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'The mobile project validates the responsive control layout.')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Event pack (.zip)' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('devdays-madrid-event-pack.zip')

  const downloadPath = await download.path()
  if (!downloadPath) throw new Error('The event pack download did not create a file.')
  const zip = await JSZip.loadAsync(await readFile(downloadPath))
  const files = Object.keys(zip.files).filter((path) => !zip.files[path].dir)

  expect(files).toEqual([
    'speaker-profile/speaker-profile-01-speaker-name.png',
    'speaker-banner/speaker-banner-01-speaker-name.png',
    'social-promo/social-promo-madrid.png',
    'luma-cover/luma-cover-madrid.png',
  ])
})
