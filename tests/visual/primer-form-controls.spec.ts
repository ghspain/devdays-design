import { expect, test } from '@playwright/test'
import { formatCard, selectFormat } from './helpers'

// Phase 2 (#41): format bar and Event section use Primer form controls.
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
})

test('format cards keep both format families and update the banner', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Event formats' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Speaker formats' })).toBeVisible()

  await selectFormat(page, 'speaker_square')
  await expect(formatCard(page, 'speaker_square')).toHaveAttribute('aria-pressed', 'true')
  const canvas = page.getByLabel('Banner preview')
  await expect
    .poll(() => canvas.evaluate((el) => (el as HTMLCanvasElement).height))
    .toBe(1080)
})

test('event fields are Primer controls still reachable by label', async ({ page }) => {
  await selectFormat(page, 'social_promo')

  await expect(page.getByLabel('Event preset')).toHaveAttribute('data-component', 'Select')
  await expect(page.getByLabel('Event title')).toHaveAttribute('data-component', 'input')
  await expect(page.getByLabel('Date and time')).toHaveAttribute('data-component', 'input')
  await expect(page.getByLabel('Location')).toHaveAttribute('data-component', 'Textarea')

  await page.getByLabel('City').fill('Madrid')
  await expect(page.getByLabel('City')).toHaveValue('Madrid')
})

test('preset flow fills the event fields', async ({ page }) => {
  await selectFormat(page, 'social_promo')
  await page.getByLabel('Event preset').selectOption('devdays')
  const title = await page.getByLabel('Event title').inputValue()
  expect(title.length).toBeGreaterThan(0)
  // Selecting a preset must not change the chosen format.
  await expect(formatCard(page, 'social_promo')).toHaveAttribute('aria-pressed', 'true')
})

test('registration toggle exposes its accessible name and switches state', async ({ page }) => {
  await selectFormat(page, 'social_promo')
  // The registration controls moved into the advanced section (#74).
  await page.locator('#section-registration summary').click()

  const toggle = page.getByRole('button', { name: /show registration footer bar/i })
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  // Style/CTA/URL controls disappear with the toggle off.
  await expect(page.getByLabel('Registration bar style')).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Registration bar style')).toHaveAttribute('data-component', 'Select')
})

test('registration URL stays required', async ({ page }) => {
  await selectFormat(page, 'social_promo')
  await expect(page.getByLabel('Registration URL')).toHaveAttribute('aria-required', 'true')
})
