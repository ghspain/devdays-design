import { expect, test } from '@playwright/test'
import { openSection, selectFormat } from './helpers'

test('selected speaker shows safe public links and keeps the display role editable', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await selectFormat(page, 'speaker_square')
  await openSection(page, 'section-speakers')
  await page.locator('.catalog-picker select').selectOption('2026-04-17-copilot-dev-days-madrid')

  const sergio = page.locator('.catalog-option').filter({ hasText: 'Sergio Valverde' })
  await sergio.locator('input[type=checkbox]').check()
  await page.getByRole('button', { name: 'Add selected speakers (1)' }).click()

  const card = page.locator('.speaker-card').last()
  await expect(card.getByLabel('Role')).toHaveValue('Ingeniero de Plataforma en Lunik · GitHub Star · Organizador de GitHub Community Spain')
  const links = card.locator('.speaker-profile-links a')
  await expect(links).toHaveCount(2)
  await expect(links.nth(0)).toHaveAttribute('href', 'https://github.com/svg153')
  await expect(links.nth(1)).toHaveAttribute('href', 'https://www.linkedin.com/in/svg153')
  await expect(links.first()).toHaveAttribute('rel', 'noreferrer')
  await links.first().focus()
  await expect(links.first()).toBeFocused()

  await card.getByLabel('Role').fill('Community Host')
  await expect(card.getByLabel('Role')).toHaveValue('Community Host')
})

test('selected speaker with no public destinations has no empty profile links', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await selectFormat(page, 'speaker_square')
  await openSection(page, 'section-speakers')
  await page.locator('.catalog-picker select').selectOption('2026-04-17-copilot-dev-days-madrid')

  const ramon = page.locator('.catalog-option').filter({ hasText: 'Ramon Palomares' })
  await ramon.locator('input[type=checkbox]').check()
  await page.getByRole('button', { name: 'Add selected speakers (1)' }).click()
  await expect(page.locator('.speaker-card').last().getByLabel('Role')).toHaveValue('')
  await expect(page.locator('.speaker-profile-links')).toHaveCount(0)
})

test('misclassified LinkedIn values are omitted instead of becoming links', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await selectFormat(page, 'speaker_square')
  await openSection(page, 'section-speakers')
  await page.locator('.catalog-picker select').selectOption('2026-04-17-copilot-dev-days-madrid')

  const jorge = page.locator('.catalog-option').filter({ hasText: 'Jorge Fernández Sánchez' })
  await jorge.locator('input[type=checkbox]').check()
  await page.getByRole('button', { name: 'Add selected speakers (1)' }).click()
  await expect(page.locator('.speaker-profile-links')).toHaveCount(0)
})
