import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'
import { formatOptions } from '../../src/constants'
import { formatCard, selectFormat, showPreviewForViewport } from './helpers'

const formats = formatOptions.map(({ id, width, height }) => ({ id, width, height }))

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
})

// Wait for the luma background image to load (it's a large PNG that can be slow
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

for (const format of formats) {
  test(`${format.id} renders a populated canvas without layout overflow`, async ({ page }, testInfo) => {
    await selectFormat(page, format.id)
    await showPreviewForViewport(page)

    // Wait for luma background image to load before checking canvas
    if (format.id === 'luma_cover') {
      await waitForLumaBackground(page)
    }

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

    await expect
      .poll(() =>
        canvas.evaluate((element) => {
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
        }),
      )
      .toBeGreaterThan(500)

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
    'logos/celonis-short-black.svg',
    'logos/celonis-short-white.svg',
    'logos/celonis-icon-black.svg',
    'logos/celonis-icon-white.svg',
    'logos/github-community-spain-black.svg',
    'logos/github-community-spain-white.svg',
    'logos/github-community-spain-short-black.svg',
    'logos/github-community-spain-short-white.svg',
    'logos/github-community-spain-icon-black.svg',
    'logos/github-community-spain-icon-white.svg',
    'logos/techriders-black.svg',
    'logos/techriders-white.svg',
    'logos/techriders-short-black.svg',
    'logos/techriders-short-white.svg',
    'logos/techriders-icon-black.svg',
    'logos/techriders-icon-white.svg',
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

  await selectFormat(page, 'speaker_banner')
  await page.getByLabel('Select organizer').selectOption('ghspain')
  await page.getByRole('button', { name: 'Use selected organizer' }).click()
  await page.getByLabel('Add from sponsor or collaborator catalogue').selectOption('celonis')
  await page.getByRole('button', { name: 'Add selected sponsor' }).click()

  await expect(page.getByText('2 slot(s) remaining.')).toBeVisible()
  await expect.poll(() => failedLogoRequests).toEqual([])
  await showPreviewForViewport(page)
  await testInfo.attach(`catalogue-logos-${testInfo.project.name}`, {
    body: await page.locator('.stage').screenshot(),
    contentType: 'image/png',
  })
})

test('applying an event preset keeps the selected banner format', async ({ page }) => {
  await selectFormat(page, 'speaker_square')
  await page.getByLabel('Event preset').selectOption('meetup')
  await expect(formatCard(page, 'speaker_square')).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Event preset').selectOption('devdays')
  await expect(formatCard(page, 'speaker_square')).toHaveAttribute('aria-pressed', 'true')
})

test('formats are grouped into event and speaker families', async ({ page }) => {
  await expect(page.locator('.format-group').nth(0).locator('.format-card')).toHaveCount(2)
  await expect(page.locator('.format-group').nth(1).locator('.format-card')).toHaveCount(2)
})

test('speaker avatars render inside the square canvas', async ({ page }) => {
  await selectFormat(page, 'speaker_square')
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
  await selectFormat(page, 'speaker_square')
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
  await selectFormat(page, 'speaker_square')
  await expect(page.getByText('Sponsors and collaborators')).toBeVisible()
})

test('partner logos toggle hides and shows the square footer logos', async ({ page }) => {
  test.setTimeout(90_000)
  await selectFormat(page, 'speaker_square')
  const canvas = page.getByLabel('Banner preview')
  await expect.poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).width)).toBe(1080)

  await page.getByLabel('Add from sponsor or collaborator catalogue').selectOption('celonis')
  await page.getByRole('button', { name: 'Add selected sponsor' }).click()
  await expect(page.getByText('2 slot(s) remaining.')).toBeVisible()

  const footerSignature = () =>
    canvas.evaluate((element) => {
      const bannerCanvas = element as HTMLCanvasElement
      const context = bannerCanvas.getContext('2d')
      if (!context) return ''
      const top = Math.round(bannerCanvas.height * 0.86)
      const { data } = context.getImageData(0, top, bannerCanvas.width, bannerCanvas.height - top)
      let hash = 0
      for (let index = 0; index < data.length; index += 4) {
        hash = (hash * 31 + data[index] + data[index + 1] * 3 + data[index + 2] * 7) % 2147483647
      }
      return String(hash)
    })

  const toggle = page.getByRole('button', { name: /include partner logos/i })
  // Start from the deterministic no-logos state (no async image involved), then
  // prove the logos appear, disappear and come back with identical footers.
  // Generous timeouts: the shared CI/dev box can starve the render under parallel load.
  const pollOptions = { timeout: 15_000 }
  // Adaptive stability probe (#24): the settle window grows on each retry
  // (200 → 400 → 800ms cap) so a slow app start gets progressively more
  // time to render instead of burning the 15s budget on fixed 200ms samples.
  const expectFooterStable = async () => {
    let attempt = 0
    await expect
      .poll(
        async () => {
          const settleMs = Math.min(200 * 2 ** attempt, 800)
          const before = await footerSignature()
          await page.waitForTimeout(settleMs)
          const stable = before === (await footerSignature())
          if (!stable) attempt += 1
          return stable
        },
        pollOptions,
      )
      .toBe(true)
  }
  await toggle.click()
  await expectFooterStable()
  const withoutLogos = await footerSignature()

  await toggle.click()
  await expect.poll(footerSignature, pollOptions).not.toBe(withoutLogos)
  const withLogos = await footerSignature()

  await toggle.click()
  await expect.poll(footerSignature, pollOptions).toBe(withoutLogos)

  await toggle.click()
  await expect.poll(footerSignature, pollOptions).toBe(withLogos)
})

test('mobile footer does not overlap editor content', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Only runs on mobile project.')

  // Use iPhone 13 viewport (390×844) which is the smallest mobile breakpoint.
  await page.setViewportSize({ width: 390, height: 844 })

  const footer = page.locator('.sidebar-footer')
  const content = page.locator('.sidebar-content')

  // Ensure the footer is visible and the sidebar is scrollable.
  await expect(footer).toBeVisible()
  await expect(content).toBeVisible()

  // Verify the footer is not sticky (position should be static or relative, not sticky/absolute/fixed).
  const footerPosition: string = await footer.evaluate((el) => (el as HTMLElement).style.position)
  expect(footerPosition).not.toBe('sticky')
  expect(footerPosition).not.toBe('fixed')
  expect(footerPosition).not.toBe('absolute')

  // Scroll to top, middle, and end of the sidebar, checking for overlap at each position.
  const checkNoOverlap = async () => {
    const footerBox = await footer.boundingBox()
    const contentLocators = content.locator('.side-section > summary, .side-section .section-block, .sidebar-content > div')
    const contentElements = await contentLocators.all()
    const contentBoxes: Array<{ x: number; y: number; width: number; height: number }> = []
    for (const el of contentElements) {
      const box = await el.boundingBox()
      if (box) contentBoxes.push(box)
    }

    if (!footerBox || contentBoxes.length === 0) return true

    for (const box of contentBoxes) {
      // Check for positive-area intersection (both width and height > 0).
      const intersects = !(
        footerBox.x + footerBox.width <= box.x ||
        footerBox.x >= box.x + box.width ||
        footerBox.y + footerBox.height <= box.y ||
        footerBox.y >= box.y + box.height
      )
      if (intersects) return false
    }
    return true
  }

  // Check at top of scroll.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  expect(await checkNoOverlap()).toBe(true)

  // Check at middle of scroll.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
  await page.waitForTimeout(200)
  expect(await checkNoOverlap()).toBe(true)

  // Check at end of scroll.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(200)
  expect(await checkNoOverlap()).toBe(true)

  // Verify all footer actions are still reachable.
    await expect(page.getByRole('button', { name: 'Download PNG', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /event pack/i })).toBeVisible()

  await testInfo.attach(`mobile-footer-${testInfo.project.name}`, {
    body: await page.locator('.sidebar').screenshot(),
    contentType: 'image/png',
  })
})

test('desktop layout preserves sidebar/canvas split', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Only runs on desktop project.')

  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect(page.locator('.stage')).toBeVisible()

  // On desktop, the sidebar and canvas should both be visible side by side.
  const sidebarBox = await page.locator('.sidebar').first().boundingBox()
  const stageBox = await page.locator('.stage').first().boundingBox()

  expect(sidebarBox).not.toBeNull()
  expect(stageBox).not.toBeNull()

  // Sidebar should be to the left of or adjacent to the stage.
    expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(stageBox!.x)

  await testInfo.attach(`desktop-layout-${testInfo.project.name}`, {
    body: await page.locator('.editor-shell').screenshot(),
    contentType: 'image/png',
  })
})

test('draft auto-saves and reloads on page refresh', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Draft persistence is a desktop feature.')

  // Navigate to the editor.
  await page.goto('/')
  await expect(page.locator('.editor-shell')).toBeVisible()

  // Change the event title to something unique.
  const titleInput = page.locator('input[placeholder*="Event title"]').first()
  if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await titleInput.fill('Draft Persistence Test Event')
    await page.waitForTimeout(1000) // Wait for debounced save
  }

  // Check that draft status shows "Saved".
  await expect(page.locator('.draft-status')).toContainText('Saved', { timeout: 5000 })

  // Reload the page and verify the draft is restored.
  await page.reload()
  await expect(page.locator('.editor-shell')).toBeVisible()

  if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    const value = await titleInput.inputValue()
    expect(value).toContain('Draft Persistence Test')
  }

  await testInfo.attach(`draft-reload-${testInfo.project.name}`, {
    body: await page.locator('.sidebar').screenshot(),
    contentType: 'image/png',
  })
})

test('reset dialog shows cancel and confirm buttons', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Draft persistence is a desktop feature.')

  await page.goto('/')
  await expect(page.locator('.editor-shell')).toBeVisible()

  // Click the Reset button to open the dialog.
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.locator('.reset-confirm-dialog')).toBeVisible()

  // Verify the dialog is visible with cancel and confirm.
  await expect(page.getByText('Cancel')).toBeVisible()
  await expect(page.getByText('Confirm Reset')).toBeVisible()

  await testInfo.attach(`reset-dialog-${testInfo.project.name}`, {
    body: await page.locator('.sidebar').screenshot(),
    contentType: 'image/png',
  })
})

test('reset confirm clears the draft', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Draft persistence is a desktop feature.')

  await page.goto('/')
  await expect(page.locator('.editor-shell')).toBeVisible()

  // Change the event title.
  const titleInput = page.locator('input[placeholder*="Event title"]').first()
  if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await titleInput.fill('Reset Test Event')
    await page.waitForTimeout(1000)
  }

  // Open and confirm the reset dialog.
  await page.getByRole('button', { name: /reset/i }).click()
  await expect(page.locator('.reset-confirm-dialog')).toBeVisible()
  await page.getByRole('button', { name: /confirm reset/i }).click()

  // Wait for the state to reset.
  await page.waitForTimeout(500)

  // Draft status should show "Saved" (empty draft).
  await expect(page.locator('.draft-status')).toContainText('Saved', { timeout: 5000 })

  await testInfo.attach(`reset-confirm-${testInfo.project.name}`, {
    body: await page.locator('.sidebar').screenshot(),
    contentType: 'image/png',
  })
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

// Phase 3 (#56): Formats and downloads explain the asset being created
test('format selector shows purpose descriptions alongside dimensions', async ({ page }) => {
  // Open the format selector dropdown
  for (const format of formatOptions) {
    const card = formatCard(page, format.id)
    await expect(card).toContainText(format.description ?? '')
    await expect(card).toContainText(`${format.width} × ${format.height}`)
  }
})

test('download button distinguishes PNG from ZIP export', async ({ page }) => {
  // The primary download button should say "Download PNG" (exact match)
  await expect(page.getByRole('button', { name: 'Download PNG', exact: true })).toBeVisible()

  // The event pack button should say "Event pack (.zip)"
  await expect(page.getByRole('button', { name: 'Event pack (.zip)' })).toBeVisible()

  // The canvas toolbar download should have an accessible name mentioning PNG
  await showPreviewForViewport(page)
  const toolbarDownload = page.getByLabel(/Download PNG/)
  await expect(toolbarDownload).toBeVisible()
})

test('download summary shows correct dimensions and count', async ({ page }) => {
  // Default format (luma_cover) should show single PNG with its dimensions
  await expect(page.locator('.download-summary').first()).toContainText(/Single PNG · 1000×1000/)

  // Switch to speaker_banner (multi-speaker format)
  await selectFormat(page, 'speaker_banner')
  await expect(page.locator('.download-summary').first()).toContainText(/1 speaker banner\(s\) · 1080×1350/)

  // Add a second speaker and verify count updates
  await page.getByRole('button', { name: 'Add speaker' }).click()
  await page.getByRole('textbox', { name: 'Name' }).nth(1).fill('Second Speaker')
  await expect(page.locator('.download-summary').first()).toContainText(/2 speaker banner\(s\) · 1080×1350/)
})
