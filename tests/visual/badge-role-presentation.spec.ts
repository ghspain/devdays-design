import { expect, test } from '@playwright/test'
import { BADGE_ROLE_PRESENTATIONS, type BadgeRole } from '../../src/domain/badgeRoles'
import { contrastRatio } from '../../src/lib/pixelChecks'

const roles: BadgeRole[] = ['attendee', 'speaker', 'organizer', 'staff', 'volunteer', 'sponsor']
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as [number, number, number]

test('all badge roles have unique labels and the shared speaker layout defaults to compatibility', () => {
  const presentations = roles.map((role) => BADGE_ROLE_PRESENTATIONS[role])
  expect(presentations.map(({ label }) => label)).toEqual(['ATTENDEE', 'SPEAKER', 'ORGANIZER', 'STAFF', 'VOLUNTEER', 'SPONSOR / PARTNER'])
  expect(new Set(presentations.map(({ label }) => label)).size).toBe(roles.length)
  expect(BADGE_ROLE_PRESENTATIONS.speaker).toMatchObject({ labelStyle: 'text', visibleFields: { organization: false, title: true, networkingHandle: true } })
  expect(BADGE_ROLE_PRESENTATIONS.staff.visibleFields).toEqual({ organization: true, title: false, networkingHandle: false })
  expect(BADGE_ROLE_PRESENTATIONS.volunteer.visibleFields).toEqual({ organization: false, title: false, networkingHandle: false })
  expect(BADGE_ROLE_PRESENTATIONS.sponsor.visibleFields).toEqual({ organization: true, title: false, networkingHandle: true })
})

test('role-chip palette uses approved Dev Days colors with accessible dark ink', () => {
  for (const role of roles.filter((item) => item !== 'speaker')) {
    const { accent, ink } = BADGE_ROLE_PRESENTATIONS[role]
    expect(accent).toBeTruthy()
    expect(ink).toBeTruthy()
    expect(contrastRatio(rgb(ink!), rgb(accent!))).toBeGreaterThanOrEqual(4.5)
  }
})

test('changing an imported row badge role updates its preview without dropping mapped attendee data', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await page.getByRole('button', { name: 'Import attendee CSV' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import attendee CSV' })
  await dialog.getByLabel('Choose a CSV file').setInputFiles({
    name: 'synthetic-badge-roles.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,organization,role,github_username\nJordan Example,GHSpain,Engineer,jordan\n'),
  })

  const row = dialog.getByRole('listitem').filter({ hasText: 'Row 2: valid' })
  const roleSelect = row.getByLabel('Badge role for row 2')
  const canvas = dialog.getByRole('region', { name: 'Representative badge previews' }).locator('canvas').first()
  await expect(roleSelect).toHaveValue('attendee')
  await expect(canvas).toHaveAttribute('aria-label', 'Attendee Badge front preview for Jordan Example')
  await roleSelect.selectOption('staff')
  await expect(canvas).toHaveAttribute('aria-label', 'Staff Badge front preview for Jordan Example')
  await expect.poll(() => canvas.evaluate((element) => {
    const pixel = (element as HTMLCanvasElement).getContext('2d')?.getImageData(100, 215, 1, 1).data
    return pixel ? Array.from(pixel) : []
  })).toEqual([49, 148, 255, 255])
  const dialogScreenshot = `test-results/${testInfo.project.name}-badge-role-editor.png`
  await dialog.screenshot({ path: dialogScreenshot, animations: 'disabled' })
  await testInfo.attach('badge-role-editor', { path: dialogScreenshot, contentType: 'image/png' })
  await expect(dialog.getByRole('status')).toContainText('Total 1; valid 1; warnings 0; errors 0; selected for generation 1.')
  await expect(dialog.getByRole('article', { name: 'Row 2: Jordan Example' })).toBeVisible()

  await roleSelect.selectOption('sponsor')
  await expect(canvas).toHaveAttribute('aria-label', 'Sponsor / partner Badge front preview for Jordan Example')
  await expect.poll(() => canvas.evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext('2d')
    if (!context) return 0
    const { data } = context.getImageData(80, 197, 300, 36)
    let accentPixels = 0
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] === 184 && data[index + 1] === 112 && data[index + 2] === 255) accentPixels += 1
    }
    return accentPixels
  })).toBeGreaterThan(1000)

  await roleSelect.selectOption('speaker')
  await expect(canvas).toHaveAttribute('aria-label', 'Speaker Badge front preview for Jordan Example')

  await canvas.scrollIntoViewIfNeeded()
  const screenshotPath = `test-results/${testInfo.project.name}-badge-role-staff.png`
  await canvas.screenshot({ path: screenshotPath, animations: 'disabled' })
  await testInfo.attach('staff-badge-preview', { path: screenshotPath, contentType: 'image/png' })
})
