import { expect, test } from '@playwright/test'
import { openSection, selectFormat } from './helpers'

test('#79 only the format section is expanded on first load', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  await expect(page.locator('details#section-format')).toHaveAttribute('open')
  const renderedIds = await page.locator('details.side-section').evaluateAll((details) =>
    details.map((element) => element.id),
  )
  for (const id of renderedIds.filter((i) => i !== 'section-format')) {
    await expect(page.locator(`details#${id}`)).not.toHaveAttribute('open')
  }
  expect(renderedIds).toContain('section-format')
})

test('#79 "Show all" expands every rendered section and becomes "Collapse all"', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  const toggle = page.locator('.sections-toggle')
  await expect(toggle).toHaveText('Show all')
  await toggle.click()
  await expect(toggle).toHaveText('Collapse all')

  // Every section currently rendered for the default format must be open.
  const renderedIds = await page.locator('details.side-section').evaluateAll((details) =>
    details.map((element) => element.id),
  )
  expect(renderedIds.length).toBeGreaterThan(1)
  for (const id of renderedIds) {
    await expect(page.locator(`details#${id}`)).toHaveAttribute('open')
  }

  await toggle.click()
  await expect(toggle).toHaveText('Show all')
  for (const id of renderedIds) {
    await expect(page.locator(`details#${id}`)).not.toHaveAttribute('open')
  }
})

test('#79 expanded and collapsed state persists across format changes', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  // Open the event section, then change format: it must stay open.
  await openSection(page, 'section-event')
  await selectFormat(page, 'social_promo')
  await expect(page.locator('details#section-event')).toHaveAttribute('open')

  // Collapse it, then change format again: it must stay collapsed.
  await page.locator('#section-event summary').click()
  await selectFormat(page, 'speaker_square')
  await expect(page.locator('details#section-event')).not.toHaveAttribute('open')

  // The format section stays expanded throughout (its default state).
  await expect(page.locator('details#section-format')).toHaveAttribute('open')
})

test('#79 collapsed sections expand when validation navigation targets them', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  await openSection(page, 'section-event')
  await page.getByLabel('City').fill('Buenos Aires Capital Federal Extendiiiisima')
  await expect(page.locator('.validation-panel')).toContainText('city', { timeout: 10_000 })

  // Collapse the event section again, then use the "Go to field" action: the
  // targeted section must expand even though the user collapsed it.
  await page.locator('#section-event summary').click()
  await expect(page.locator('details#section-event')).not.toHaveAttribute('open')

  await page.locator('.validation-panel .validation-go-to-field').first().click()
  await expect(page.locator('details#section-event')).toHaveAttribute('open')
})
