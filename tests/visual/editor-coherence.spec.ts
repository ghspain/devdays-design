import { expect, test } from '@playwright/test'
import { openSection, selectFormat } from './helpers'

// Editor coherence pass (epic #71): one test per phase outcome.
// - Sidebar reads as a top-to-bottom story: Event details, Speakers, then
//   Format/theme, with advanced registration controls at the bottom (#74).
// - The main download stays visually dominant over the secondary pack and
//   toolbar downloads (#73).
// - Text that the live render has to cut shows an inline indicator on the
//   exact field, and the indicator clears as soon as the text fits (#75).
// - Theme cards show a miniature banner preview built from the theme's own
//   palette (#76).
// - On mobile the sticky action bar never covers the last sidebar controls (#72).

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
})

test('sidebar order is Event, Speakers, then Format/theme, with registration advanced last', async ({ page }) => {
  // Speaker banner renders every section, including Speakers and registration.
  await selectFormat(page, 'speaker_banner')

  const yOf = async (selector: string) => {
    const box = await page.locator(selector).boundingBox()
    expect(box, `${selector} should be visible`).not.toBeNull()
    return box!.y
  }

  const eventY = await yOf('#section-event')
  const speakersY = await yOf('#section-speakers')
  const formatY = await yOf('.format-bar')
  const registrationY = await yOf('#section-registration')

  expect(eventY).toBeLessThan(speakersY)
  expect(speakersY).toBeLessThan(formatY)
  expect(formatY).toBeLessThan(registrationY)
})

test('registration footer controls live in the advanced section, not in Event', async ({ page }) => {
  await selectFormat(page, 'social_promo')

  await expect(page.locator('#section-event #registration-url')).toHaveCount(0)
  const advanced = page.locator('#section-registration')
  await expect(advanced).toBeAttached()
  await advanced.locator('summary').click()
  await expect(advanced.locator('#registration-url')).toBeVisible()
  await expect(advanced.getByRole('button', { name: /show registration footer bar/i })).toBeVisible()
})

test('main download is primary while pack and toolbar downloads stay secondary', async ({ page }) => {
  const main = page.locator('button.download-main')
  await expect(main).toBeVisible()
  await expect(main).toHaveAttribute('data-variant', 'primary')

  const pack = page.locator('button.pack-download')
  await expect(pack).toBeVisible()
  await expect(pack).not.toHaveAttribute('data-variant', 'primary')

  // #78: the stage toolbar no longer carries a download icon — all
  // downloads live in the sidebar footer.
  await expect(page.locator('button[title="Download PNG"]')).toHaveCount(0)
  await expect(page.locator('.download-summary')).not.toBeEmpty()
})

test('fields the render truncates get an inline indicator that clears once the text fits', async ({ page }) => {
  await selectFormat(page, 'social_promo')
  await openSection(page, 'section-event')
  // City is one of the fields the Social Promo render tracks for truncation.
  const city = page.locator('#event-city')

  await city.fill('A city with a really long name that overflows the banner text column')
  const warning = page.locator('.fit-warning:has(#event-city)')
  await expect(warning.locator('.fit-indicator')).toBeVisible()
  await expect(warning.locator('.fit-indicator')).toContainText('Truncates in banner')

  await city.fill('Madrid')
  await expect(page.locator('.fit-warning:has(#event-city)')).toHaveCount(0)
})

test('theme cards show a mini preview painted with the theme palette', async ({ page }) => {
  await openSection(page, 'section-event')
  const cards = page.locator('.theme-card')
  await expect(cards).toHaveCount(3)

  for (const card of await cards.all()) {
    await expect(card.locator('.theme-mini')).toBeVisible()
    await expect(card.locator('.theme-mini-title')).not.toBeEmpty()
  }

  // The selected Dev Days card paints its mini banner with the dark background.
  await expect(page.locator('.theme-card.selected .theme-mini')).toHaveCSS('background-color', 'rgb(13, 17, 23)')
})

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the sidebar keeps bottom clearance so the sticky action bar covers nothing', async ({ page }) => {
    await expect(page.locator('.sidebar-footer')).toBeVisible()
    const paddingBottom = await page
      .locator('.sidebar-content')
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom))
    expect(paddingBottom).toBeGreaterThanOrEqual(96)
  })
})
