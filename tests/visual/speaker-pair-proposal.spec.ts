import { expect, test } from '@playwright/test'

test('paired-speaker UI proposal lets users edit and group two speakers on one card', async ({ page }) => {
  await page.goto('?proposal=two-speakers')

  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  await expect(page.getByRole('heading', { name: 'Speakers' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Speakers per card' })).toHaveValue('2')
  await expect(page.getByLabel('Preview card with 2 speakers')).toContainText('Ada Lovelace')
  await expect(page.getByLabel('Preview card with 2 speakers')).toContainText('Grace Hopper')

  await page.getByLabel('Name').nth(0).fill('Ada Lovelace, updated')
  await expect(page.getByLabel('Preview card with 2 speakers')).toContainText('Ada Lovelace, updated')

  await page.locator('.proposal-catalogue-person').first().locator('input[type="checkbox"]').uncheck()
  await page.getByLabel(/Katherine Johnson/).check()
  await page.getByRole('button', { name: 'Update card with selected speakers' }).click()
  await expect(page.getByLabel('Preview card with 2 speakers')).toContainText('Katherine Johnson')
  await expect(page.getByLabel('Preview card with 2 speakers')).toContainText('Grace Hopper')
  await expect(page.locator('.proposal-profile')).toHaveCount(2)
})
