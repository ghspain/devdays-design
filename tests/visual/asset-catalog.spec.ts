import { expect, test } from '@playwright/test'
import { formatOptions } from '../../src/constants'
import { assetCatalog, type AssetDefinition } from '../../src/domain/assets'

const pairedBadgeContract: AssetDefinition = {
  id: 'speaker-networking-badge',
  name: 'Speaker badges',
  templates: [{
    id: 'speaker-badge-v1',
    name: 'Networking badge',
    description: 'Front and back speaker badge',
    channels: [],
    sides: ['front', 'back'],
    exportProfiles: [{ id: 'badge-image', width: 900, height: 1200, types: ['png'], scales: [1] }],
  }],
}

test('asset templates expose stable identity, sides, and independent export profiles', () => {
  const templates = assetCatalog.flatMap((asset) => asset.templates)
  const expectedTemplateIds = ['luma-cover', 'social-promo', 'speaker-profile', 'speaker-banner']
  const expectedCatalogFormats = ['luma_cover', 'social_promo', 'speaker_square', 'speaker_banner']
  const expectedExportOrder = ['speaker_square', 'speaker_banner', 'social_promo', 'luma_cover']

  expect(templates.map((template) => template.id)).toEqual(expectedTemplateIds)
  expect(templates.map((template) => template.legacyFormat)).toEqual(expectedCatalogFormats)
  expect(assetCatalog.map((asset) => asset.id)).toEqual(['event-promotion', 'speaker-promotion'])
  expect(formatOptions.map((option) => option.id)).toEqual(expectedExportOrder)

  for (const template of templates) {
    expect(template.id).toBeTruthy()
    expect(template.sides).toEqual(['front'])
    expect(template.exportProfiles).toHaveLength(1)
    expect(template.exportProfiles[0]).toMatchObject({
      width: expect.any(Number),
      height: expect.any(Number),
      types: ['png', 'jpg'],
      scales: [1, 2],
    })
    expect(formatOptions.find((option) => option.id === template.legacyFormat)).toMatchObject({
      name: template.name,
      width: template.exportProfiles[0].width,
      height: template.exportProfiles[0].height,
    })
  }

  expect(pairedBadgeContract.templates[0].sides).toEqual(['front', 'back'])
  expect(pairedBadgeContract.templates[0].legacyFormat).toBeUndefined()
})

test('format picker still exposes the same four production outputs by asset family', async ({ page }, testInfo) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Event formats' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Speaker formats' })).toBeVisible()
  await expect(page.locator('.format-group').nth(0).locator('.format-card')).toHaveCount(2)
  await expect(page.locator('.format-group').nth(1).locator('.format-card')).toHaveCount(2)
  await expect(page.locator('.format-card')).toHaveCount(4)
  await expect(page.locator('.format-group').nth(0).locator('.format-card').nth(0)).toHaveAttribute('aria-label', /Luma Cover/)
  await expect(page.locator('.format-group').nth(0).locator('.format-card').nth(1)).toHaveAttribute('aria-label', /Social Promo/)

  for (const option of formatOptions) {
    await expect(page.getByRole('button', { name: new RegExp(option.name) })).toBeVisible()
  }

  const firstFormat = page.locator('.format-card').first()
  await firstFormat.focus()
  await expect(firstFormat).toBeFocused()
  expect(runtimeErrors).toEqual([])
  await testInfo.attach(`asset-format-picker-${testInfo.project.name}`, {
    body: await page.locator('.format-groups').screenshot(),
    contentType: 'image/png',
  })
})
