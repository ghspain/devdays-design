import { expect, test } from '@playwright/test'
import { formatOptions } from '../../src/constants'
import { formatCard } from './helpers'
import type { ValidationFinding } from '../../src/lib/validate'

const fixture = '/devdays-design/tests/visual/fixtures/qr-controls-harness.html'

test('QR controls inherit template defaults, filter public profile options, validate overrides, and allow no QR', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()) })
  await page.goto(fixture)

  await expect(page.locator('#qr-destination-type')).toHaveValue('person-profile')
  await expect(page.locator('#qr-person-profile option')).toHaveCount(1)
  await expect(page.locator('#qr-harness-state')).toContainText('https://github.example/synthetic-person')

  await page.locator('#qr-destination-type').selectOption('custom-url')
  const customUrl = page.locator('#qr-destination-url')
  await customUrl.fill('javascript:alert(1)')
  await expect(page.getByText('Use an HTTP or HTTPS URL.', { exact: true })).toBeVisible()
  await expect(customUrl).toHaveAttribute('aria-invalid', 'true')
  await expect(customUrl).toHaveAttribute('aria-describedby', /qr-destination-url-validationMessage/)

  await customUrl.fill('https://events.example/agenda')
  await expect(page.getByText('Use an HTTP or HTTPS URL.', { exact: true })).toHaveCount(0)
  await expect(page.locator('#qr-harness-state')).toContainText('https://events.example/agenda')

  const readableText = page.getByLabel('Readable destination text')
  await readableText.click()
  await expect(readableText).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('#qr-harness-state')).toContainText('"readableText":false')
  await page.locator('#qr-destination-type').selectOption('none')
  await expect(page.locator('#qr-destination-url')).toHaveCount(0)
  await expect(page.locator('#qr-harness-state')).toContainText('"kind":"none"')
  await expect(page.getByText('Use an HTTP or HTTPS URL.', { exact: true })).toHaveCount(0)
  expect(browserErrors).toEqual([])
})

test('unavailable profile destinations are reported on the profile field', async ({ page }) => {
  await page.goto(`${fixture}?missing-profile`)
  await expect(page.getByText('This destination is no longer available. Choose another destination.', { exact: true })).toBeVisible()
  await expect(page.locator('#qr-person-profile')).toHaveAttribute('aria-invalid', 'true')
})

test('current non-QR social formats do not expose QR controls', async ({ page }) => {
  await page.goto('/')
  for (const format of formatOptions) {
    await formatCard(page, format.id).click()
    await expect(page.locator('#section-qr')).toHaveCount(0)
  }
})

test('QR validation finding navigates to and focuses the matching control', async ({ page }) => {
  const finding: ValidationFinding = {
    code: 'invalid-qr-destination',
    severity: 'error',
    field: 'QR destination',
    message: 'Synthetic invalid QR destination.',
    targetId: 'qr-destination-url',
  }
  await page.addInitScript((value) => {
    (window as Window & { __devdaysInjectedFindings?: ValidationFinding[] }).__devdaysInjectedFindings = [value]
  }, finding)
  await page.goto('/')
  await page.locator('body').evaluate((body) => {
    const section = document.createElement('details')
    section.id = 'section-qr'
    section.open = true
    const summary = document.createElement('summary')
    summary.textContent = 'QR destination'
    const field = document.createElement('input')
    field.id = 'qr-destination-url'
    section.append(summary, field)
    body.append(section)
  })
  const findingBanner = page.locator('.validation-finding').filter({ hasText: 'Synthetic invalid QR destination.' })
  await findingBanner.getByRole('button', { name: 'Go to field' }).click()
  await expect(page.locator('#qr-destination-url')).toBeFocused()
})
