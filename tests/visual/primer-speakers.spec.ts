import { expect, test } from '@playwright/test'

// Phase 3 (#42): the Speakers section uses Primer form controls while the
// catalogue/card hooks (.catalog-picker, .catalog-option, .speaker-card,
// .section-count) and the add/edit/remove flows stay intact.

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await page.locator('.format-bar select').selectOption('speaker_square')
})

test('catalogue event filter is a Primer Select inside the preserved fieldset', async ({ page }) => {
  const filter = page.locator('.catalog-picker select')
  await expect(filter).toHaveAttribute('data-component', 'Select')
  await expect(page.locator('.catalog-picker legend')).toHaveText('Speakers from Planning')
  await expect(filter).toHaveValue('')
})

test('catalogue rows use Primer checkboxes and the add flow keeps working', async ({ page }) => {
  await page.locator('.catalog-picker select').selectOption('2026-04-17-copilot-dev-days-madrid')
  const options = page.locator('.catalog-option')
  await expect(options.first()).toBeVisible()

  const boxes = options.locator('input[type=checkbox]')
  await expect(boxes.first()).toHaveAttribute('data-component', 'Checkbox')

  await options.nth(0).locator('input[type=checkbox]').check()
  await options.nth(1).locator('input[type=checkbox]').check()

  const addBtn = page.getByRole('button', { name: 'Add selected speakers (2)' })
  await expect(addBtn).toHaveClass(/prc-Button/)
  await addBtn.click()
  await expect(page.locator('.section-count')).toHaveText('3 / 12')
  await expect(page.locator('.speaker-card')).toHaveCount(3)
})

test('speaker card name and role are Primer TextInputs with visible labels', async ({ page }) => {
  const card = page.locator('.speaker-card').first()
  const name = card.getByLabel('Name')
  const role = card.getByLabel('Role')
  await expect(name).toHaveAttribute('data-component', 'input')
  await expect(role).toHaveAttribute('data-component', 'input')
  await expect(name).toHaveAttribute('aria-required', 'true')

  await card.getByLabel('Name').fill('Ada Lovelace')
  await expect(card.getByLabel('Name')).toHaveValue('Ada Lovelace')
})

test('remove is a Primer Button and photo upload stays a native file input', async ({ page }) => {
  const card = page.locator('.speaker-card').first()
  const remove = card.getByRole('button', { name: 'Remove' })
  await expect(remove).toHaveClass(/prc-Button/)

  const photo = card.getByLabel('Photo')
  await expect(photo).toHaveAttribute('type', 'file')
  await expect(photo).not.toHaveAttribute('data-component')

  const before = await page.locator('.speaker-card').count()
  await remove.click()
  await expect(page.locator('.speaker-card')).toHaveCount(before - 1)
})

test('global form styling does not leak into Primer speaker controls', async ({ page }) => {
  const leakySelects = await page.evaluate(() =>
    document.querySelectorAll('.catalog-picker select:not([data-component])').length)
  const leakyCheckboxes = await page.evaluate(() =>
    document.querySelectorAll('.catalog-option input[type="checkbox"]:not([data-component])').length)
  expect(leakySelects).toBe(0)
  expect(leakyCheckboxes).toBe(0)
  // Every non-file input in a speaker card is a Primer control (TextInput renders data-component).
  const primerNonFile = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.speaker-card input:not([type="file"])')).every((el) => el.hasAttribute('data-component')),
  )
  expect(primerNonFile).toBe(true)
})
