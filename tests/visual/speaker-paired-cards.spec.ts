import { expect, test } from '@playwright/test'
import { openSection, selectFormat, showPreviewForViewport } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await selectFormat(page, 'speaker_square')
  await openSection(page, 'section-speakers')
})

test('two speakers can share one square card and the choice survives reload', async ({ page }) => {
  const perCard = page.getByRole('combobox', { name: 'Speakers per card' })
  await expect(perCard).toHaveValue('1')

  const cards = page.locator('.speaker-card')
  await cards.nth(0).getByLabel('Name').fill('Ada Lovelace')
  await page.getByRole('button', { name: 'Add speaker' }).click()
  await cards.nth(1).getByLabel('Name').fill('Grace Hopper')
  await perCard.selectOption('2')
  await expect(page.getByRole('button', { name: /Download PNG/ })).not.toContainText('2 files')
  await showPreviewForViewport(page)

  await expect(page.getByLabel('Banner preview for Ada Lovelace and Grace Hopper')).toBeVisible()
  await expect(page.locator('.speaker-preview-item')).toHaveCount(0)

  await page.waitForTimeout(600)
  await page.reload()
  await openSection(page, 'section-speakers')
  await expect(page.getByRole('combobox', { name: 'Speakers per card' })).toHaveValue('2')
  await showPreviewForViewport(page)
  await expect(page.getByLabel('Banner preview for Ada Lovelace and Grace Hopper')).toBeVisible()
})

test('paired speakers export as one image', async ({ page }) => {
  const cards = page.locator('.speaker-card')
  await cards.nth(0).getByLabel('Name').fill('Ada Lovelace')
  await page.getByRole('button', { name: 'Add speaker' }).click()
  await cards.nth(1).getByLabel('Name').fill('Grace Hopper')
  await page.getByRole('combobox', { name: 'Speakers per card' }).selectOption('2')

  const downloads: string[] = []
  page.on('download', (download) => downloads.push(download.suggestedFilename()))
  await page.getByRole('button', { name: /Download PNG/ }).click()
  await expect.poll(() => downloads.length).toBe(1)
  await page.waitForTimeout(300)
  expect(downloads).toHaveLength(1)
})

test('two-per-card mode puts an odd final speaker on its own card', async ({ page }) => {
  const cards = page.locator('.speaker-card')
  await cards.nth(0).getByLabel('Name').fill('Ada Lovelace')
  await page.getByRole('button', { name: 'Add speaker' }).click()
  await cards.nth(1).getByLabel('Name').fill('Grace Hopper')
  await page.getByRole('button', { name: 'Add speaker' }).click()
  await cards.nth(2).getByLabel('Name').fill('Katherine Johnson')
  await page.getByRole('combobox', { name: 'Speakers per card' }).selectOption('2')
  await expect(page.getByRole('button', { name: /Download PNG/ })).toContainText('2 files')
  await showPreviewForViewport(page)

  const previews = page.locator('.speaker-preview-item')
  await expect(previews).toHaveCount(2)
  await expect(previews.nth(0)).toContainText('Ada Lovelace + Grace Hopper')
  await expect(previews.nth(1)).toContainText('Katherine Johnson')
})
