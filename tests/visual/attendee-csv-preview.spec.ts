import { expect, test } from '@playwright/test'
import type { ValidatedAttendeeRow } from '../../src/lib/attendeeValidation'
import { MAX_ATTENDEE_PREVIEWS, selectRepresentativeAttendees } from '../../src/lib/attendeePreviews'
import { selectTheme, themeCard } from './helpers'

test('representative attendee selection is deterministic, includes useful edge cases, and stays bounded', () => {
  const rows: ValidatedAttendeeRow[] = [
    { sourceRowNumber: 2, attendee: { name: 'Ada', organization: 'GHSpain', role: 'Speaker', githubHandle: 'ada' }, status: 'valid', findings: [] },
    { sourceRowNumber: 3, attendee: { name: 'A very long attendee name', organization: 'GHSpain', role: 'Organizer', githubHandle: 'organizer' }, status: 'warning', findings: [] },
    { sourceRowNumber: 4, attendee: { name: 'No organization', role: 'Volunteer', githubHandle: 'volunteer' }, status: 'valid', findings: [] },
    { sourceRowNumber: 5, attendee: { name: 'No role', organization: 'Community', githubHandle: 'member' }, status: 'valid', findings: [] },
    { sourceRowNumber: 6, attendee: { name: 'No profile', organization: 'Community', role: 'Attendee' }, status: 'valid', findings: [] },
    { sourceRowNumber: 7, attendee: { name: '', role: 'Invalid' }, status: 'error', findings: [] },
  ]
  rows.push(...Array.from({ length: 1000 }, (_, index) => ({
    sourceRowNumber: index + 8,
    attendee: { name: `Synthetic attendee ${index}`, organization: 'Community', role: 'Attendee', githubHandle: `member-${index}` },
    status: 'valid' as const,
    findings: [],
  })))

  const previews = selectRepresentativeAttendees(rows)
  expect(previews.map(({ row }) => row.sourceRowNumber)).toEqual([2, 3, 4, 5, 6])
  expect(previews[0].reasons).toContain('first selected row')
  expect(previews[1].reasons).toContain('longest name')
  expect(previews[2].reasons).toContain('missing organization')
  expect(previews[3].reasons).toContain('missing role')
  expect(previews[4].reasons).toContain('missing GitHub profile')
  expect(previews).toHaveLength(MAX_ATTENDEE_PREVIEWS)
  expect(selectRepresentativeAttendees(rows).map(({ row }) => row.sourceRowNumber)).toEqual([2, 3, 4, 5, 6])
})

test('organizers see bounded representative badge previews that follow included rows and mapping changes', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await page.getByRole('button', { name: 'Import attendee CSV' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import attendee CSV' })
  await dialog.getByLabel('Choose a CSV file').setInputFiles({
    name: 'synthetic-preview-rows.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from([
      'name,organization,role,github_username',
      'Ada Sample,GHSpain,Speaker,ada',
      'Very Long Representative Attendee Name,GHSpain,Organizer,organizer',
      'No Organization,,Volunteer,volunteer',
      'No Role,Community,,member',
      'No GitHub,Community,Attendee,',
      'Bonus Person,Community,Attendee,bonus',
    ].join('\n')),
  })

  const previewSection = dialog.getByRole('region', { name: 'Representative badge previews' })
  await expect(previewSection).toContainText('Up to five selected rows')
  await expect(previewSection.locator('.attendee-badge-preview canvas')).toHaveCount(5)
  await expect(previewSection.locator('[aria-label="Row 2: Ada Sample"]')).toContainText('first selected row')
  await expect(previewSection.locator('[aria-label="Row 3: Very Long Representative Attendee Name"]')).toContainText('longest name')
  await expect(previewSection.locator('[aria-label="Row 4: No Organization"]')).toContainText('missing organization')
  await expect(previewSection.locator('[aria-label="Row 5: No Role"]')).toContainText('missing role')
  await expect(previewSection.locator('[aria-label="Row 6: No GitHub"]')).toContainText('missing GitHub profile')
  await expect(previewSection.locator('canvas').first()).toHaveAttribute('width', '800')
  await expect(previewSection.locator('canvas').first()).toHaveAttribute('height', '1200')
  await expect(previewSection.locator('canvas').first()).toHaveAttribute('aria-label', 'Attendee Badge front preview for Ada Sample')
  const initialAccent = await previewSection.locator('canvas').first().evaluate((element) =>
    Array.from((element as HTMLCanvasElement).getContext('2d')!.getImageData(400, 38, 1, 1).data),
  )
  expect(initialAccent).not.toEqual([9, 105, 218, 255])
  await previewSection.scrollIntoViewIfNeeded()
  const screenshotPath = `test-results/${testInfo.project.name}-attendee-representative-previews.png`
  await previewSection.screenshot({ path: screenshotPath, animations: 'disabled' })
  await testInfo.attach('attendee-representative-previews', { path: screenshotPath, contentType: 'image/png' })

  await dialog.getByLabel('Include row 2 in generation').uncheck()
  await expect(previewSection.locator('.attendee-badge-preview')).toHaveCount(4)
  await expect(previewSection.locator('[aria-label="Row 3: Very Long Representative Attendee Name"]')).toContainText('first selected row')
  await dialog.getByLabel('Map column github_username').selectOption('ignore')
  await expect(previewSection.locator('[aria-label="Row 2: Ada Sample"]')).toContainText('missing GitHub profile')
  await expect(previewSection.locator('.attendee-badge-preview canvas')).toHaveCount(4)

  await dialog.getByRole('button', { name: 'Close' }).last().click()
  await selectTheme(page, 'online_github')
  await expect(themeCard(page, 'online_github')).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Import attendee CSV' }).click()
  const onlineCanvas = page.getByRole('dialog', { name: 'Import attendee CSV' }).locator('.attendee-badge-preview canvas').first()
  await expect.poll(() => onlineCanvas.evaluate((element) => {
    const pixel = (element as HTMLCanvasElement).getContext('2d')?.getImageData(400, 38, 1, 1).data
    return pixel ? Array.from(pixel) : []
  })).toEqual([9, 105, 218, 255])
})
