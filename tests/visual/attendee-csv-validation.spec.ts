import { expect, test } from '@playwright/test'

test('row validation reports errors and template warnings, filters rows, and keeps selection local', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await page.getByRole('button', { name: 'Import attendee CSV' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import attendee CSV' })
  const file = dialog.getByLabel('Choose a CSV file')
  await file.setInputFiles({
    name: 'synthetic-row-validation.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from([
      'name,role,github_username,email,private_note',
      'Ada Example,Speaker,ada,ada@example.test,do not display',
      ',Volunteer,invalid handle,hidden@example.test,also private',
      `${'A'.repeat(100)},Organizer,https://attendee:private@github.com/octocat,guest@example.test,synthetic note`,
      'Morgan Sample,Attendee,octocat,morgan@example.test,another private value',
    ].join('\n')),
  })

  const rows = dialog.getByRole('list', { name: 'Validated attendee rows' })
  await expect(rows).toContainText('Row 2: valid')
  await expect(rows).toContainText('Row 3: error')
  await expect(rows).toContainText('Name: Add a name or exclude this row.')
  await expect(rows).toContainText('Row 4: warning')
  await expect(rows).toContainText('likely to be shortened by the Speaker Badge template')
  await expect(rows).toContainText('Use a GitHub username or an https://github.com/<username> URL')
  await expect(dialog.getByRole('status')).toContainText('Total 4; valid 2; warnings 1; errors 1; selected for generation 3.')
  await expect(rows).not.toContainText('ada@example.test')
  await expect(rows).not.toContainText('do not display')
  await expect(rows).not.toContainText('hidden@example.test')
  const screenshotPath = `test-results/${testInfo.project.name}-attendee-row-validation.png`
  await page.screenshot({ path: screenshotPath, animations: 'disabled' })
  await testInfo.attach('attendee-row-validation', { path: screenshotPath, contentType: 'image/png' })

  const invalidRow = rows.getByLabel('Include row 3 in generation')
  await expect(invalidRow).toBeDisabled()
  await expect(invalidRow).not.toBeChecked()
  await dialog.getByLabel('Filter attendee rows').selectOption('warning')
  await expect(rows.locator(':scope > li')).toHaveCount(1)
  const warningRow = rows.getByLabel('Include row 4 in generation')
  await expect(warningRow).toBeChecked()
  await warningRow.uncheck()
  await expect(dialog.getByRole('status')).toContainText('selected for generation 2')
  await dialog.getByLabel('Filter attendee rows').selectOption('error')
  await expect(rows.locator(':scope > li')).toHaveCount(1)
  await expect(rows.getByLabel('Include row 3 in generation')).toBeDisabled()
  await file.setInputFiles({ name: 'replacement.csv', mimeType: 'text/csv', buffer: Buffer.from('name\nReplacement Example\n') })
  await expect(dialog.getByLabel('Filter attendee rows')).toHaveValue('all')
  await expect(rows).toContainText('Row 2: valid')
  expect(consoleErrors).toEqual([])
})

test('extreme text is flagged before font measurement', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await page.getByRole('button', { name: 'Import attendee CSV' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import attendee CSV' })
  await dialog.getByLabel('Choose a CSV file').setInputFiles({
    name: 'synthetic-long-name.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`name\n${'A'.repeat(1200)}\n`),
  })
  const rows = dialog.getByRole('list', { name: 'Validated attendee rows' })
  await expect(rows).toContainText('Name exceeds the preflight limit of 1000 characters.')
  await expect(rows).toContainText('Row 2: warning')
})
