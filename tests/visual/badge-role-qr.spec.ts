import { expect, test } from '@playwright/test'
import { resolveBadgeRoleQR } from '../../src/lib/badgeRoleQr'
import type { CatalogPublicProfile, CatalogSponsor } from '../../src/lib/catalog'

const profile: CatalogPublicProfile = {
  personId: 'synthetic-person-1',
  name: 'Taylor Example',
  displayRole: 'Community speaker',
  avatarUrl: '',
  lastVerified: '2026-01-01',
  destinations: [
    { kind: 'website', url: 'https://speaker.example/' },
    { kind: 'github', url: 'https://github.com/synthetic-speaker' },
  ],
}
const sponsor: CatalogSponsor = {
  id: 'synthetic-sponsor-1',
  name: 'Synthetic Company',
  logoForLightBackgroundUrl: '',
  logoForDarkBackgroundUrl: '',
  logoShortForLightBackgroundUrl: '',
  logoShortForDarkBackgroundUrl: '',
  logoIconForLightBackgroundUrl: '',
  logoIconForDarkBackgroundUrl: '',
  website: 'https://company.example/',
}
const context = {
  profiles: [profile],
  sponsors: [sponsor],
  eventPageUrl: 'https://events.example/agenda',
  getPublicProfile: (personId: string) => personId === profile.personId ? profile : undefined,
  getSponsor: (sponsorId: string) => sponsorId === sponsor.id ? { name: sponsor.name, website: sponsor.website } : undefined,
}

test('role QR defaults resolve public speaker, event, and matching sponsor destinations', () => {
  expect(resolveBadgeRoleQR('speaker', { personId: profile.personId }, context)).toMatchObject({
    source: 'role-default',
    destination: { kind: 'person-profile', profileKind: 'github' },
    resolution: { status: 'resolved', content: 'https://github.com/synthetic-speaker' },
  })
  expect(resolveBadgeRoleQR('attendee', {}, context)).toMatchObject({
    destination: { kind: 'event-page', url: context.eventPageUrl },
    resolution: { status: 'resolved', content: context.eventPageUrl },
  })
  expect(resolveBadgeRoleQR('sponsor', { organization: sponsor.name }, context)).toMatchObject({
    destination: { kind: 'sponsor-website', sponsorId: sponsor.id },
    resolution: { status: 'resolved', content: sponsor.website },
  })
})

test('missing or invalid role-default data falls back to no QR with an explicit warning', () => {
  expect(resolveBadgeRoleQR('speaker', { personId: 'missing-person' }, context)).toMatchObject({
    destination: { kind: 'none' }, source: 'role-default', warning: expect.stringContaining('No public profile'),
  })
  expect(resolveBadgeRoleQR('sponsor', { organization: 'Unknown Company' }, context)).toMatchObject({
    destination: { kind: 'none' }, source: 'role-default', warning: expect.stringContaining('No matching public sponsor'),
  })
  expect(resolveBadgeRoleQR('attendee', {}, { ...context, eventPageUrl: 'javascript:alert(1)' })).toMatchObject({
    destination: { kind: 'none' }, source: 'role-default', warning: expect.stringContaining('invalid'),
  })
  expect(resolveBadgeRoleQR('attendee', {}, context, undefined, { kind: 'custom-url', url: 'javascript:alert(1)' })).toMatchObject({
    destination: { kind: 'none' }, source: 'row-override', warning: expect.stringContaining('invalid'),
  })
})

test('row override wins over batch and role defaults; batch wins over role defaults', () => {
  const batch = { kind: 'event-page' as const, url: 'https://events.example/batch' }
  const row = { kind: 'custom-url' as const, url: 'https://events.example/row' }
  const rowResult = resolveBadgeRoleQR('attendee', {}, context, batch, row)
  expect(rowResult).toMatchObject({ source: 'row-override', resolution: { status: 'resolved', content: row.url } })
  expect(resolveBadgeRoleQR('volunteer', {}, context, batch)).toMatchObject({
    source: 'batch-rule', resolution: { status: 'resolved', content: batch.url },
  })
  expect(resolveBadgeRoleQR('organizer', {}, context, batch, row)).toMatchObject({
    source: 'row-override', resolution: { status: 'resolved', content: row.url },
  })
})

test('organizer batch QR rule and row override remain editable in the local attendee importer', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await page.getByRole('button', { name: 'Import attendee CSV' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import attendee CSV' })
  await dialog.getByLabel('Choose a CSV file').setInputFiles({
    name: 'synthetic-role-qr.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from([
      'name,organization,person_id,qr_url',
      'Sam Example,Synthetic Company,synthetic-person-1,https://events.example/imported',
      'Alex Example,Synthetic Company,,',
    ].join('\n')),
  })
  const row = dialog.getByRole('listitem').filter({ hasText: 'Row 2: valid' })
  const secondRow = dialog.getByRole('listitem').filter({ hasText: 'Row 3: valid' })
  await dialog.getByLabel('QR rule for selected rows').selectOption('selected-rows')
  await dialog.locator('#qr-destination-type').selectOption('custom-url')
  await dialog.locator('#qr-destination-url').fill('https://events.example/batch')
  const preview = dialog.getByRole('article', { name: 'Row 2: Sam Example' })
  const secondPreview = dialog.getByRole('article', { name: 'Row 3: Alex Example' })
  await expect(preview).toContainText('Back QR: https://events.example/imported')
  await expect(secondPreview).toContainText('Back QR: https://events.example/batch')

  await secondRow.getByRole('button', { name: 'Override QR for row 3' }).click()
  const override = dialog.getByLabel('Custom QR URL for row 3')
  await override.fill('https://events.example/row')
  await expect(secondPreview).toContainText('Back QR: https://events.example/row')
  await row.getByLabel('Badge role for row 2').selectOption('organizer')
  await expect(preview.getByLabel('Organizer Badge front preview for Sam Example')).toBeVisible()
  await expect(preview).toContainText('Back QR: https://events.example/imported')
  await secondRow.getByLabel('Badge role for row 3').selectOption('staff')
  await expect(secondPreview.getByLabel('Staff Badge front preview for Alex Example')).toBeVisible()
  await expect(override).toHaveValue('https://events.example/row')
  await expect(secondPreview).toContainText('Back QR: https://events.example/row')
  await expect(dialog.getByText(/QR warning:/)).toHaveCount(0)
  const screenshotPath = `test-results/${testInfo.project.name}-badge-role-qr.png`
  await dialog.screenshot({ path: screenshotPath, animations: 'disabled' })
  await testInfo.attach('badge-role-qr-editor', { path: screenshotPath, contentType: 'image/png' })
})
