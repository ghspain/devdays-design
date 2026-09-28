import { expect, test } from '@playwright/test'
import { formatOptions } from '../../src/constants'
import { assetCatalog, type AssetDefinition } from '../../src/domain/assets'
import { resolveRenderer, resolveTemplateRenderer, type AssetRenderer } from '../../src/lib/renderers/registry'

const testRenderer: AssetRenderer = async () => {}

const pairedBadgeContract: AssetDefinition = {
  id: 'speaker-networking-badge',
  name: 'Speaker badges',
  templates: [{
    id: 'speaker-badge-v1',
    name: 'Networking badge',
    description: 'Front and back speaker badge',
    channels: [],
    sides: ['front', 'back'],
    rendererId: 'renderer-test-42',
    exportProfiles: [{ id: 'badge-image', width: 900, height: 1200, types: ['png'], scales: [1] }],
  }],
}

test('asset templates expose stable identity, sides, and independent export profiles', () => {
  const templates = assetCatalog.flatMap((asset) => asset.templates)
  const expectedTemplateIds = ['luma-cover', 'social-promo', 'speaker-profile', 'speaker-banner', 'speaker-badge-front']
  const expectedCatalogFormats = ['luma_cover', 'social_promo', 'speaker_square', 'speaker_banner', 'speaker_badge']
  const expectedExportOrder = ['speaker_square', 'speaker_banner', 'social_promo', 'luma_cover', 'speaker_badge']

  expect(templates.map((template) => template.id)).toEqual(expectedTemplateIds)
  expect(templates.map((template) => template.legacyFormat)).toEqual(expectedCatalogFormats)
  expect(assetCatalog.map((asset) => asset.id)).toEqual(['event-promotion', 'speaker-promotion', 'speaker-badge'])
  expect(formatOptions.map((option) => option.id)).toEqual(expectedExportOrder)

  for (const template of templates) {
    expect(template.id).toBeTruthy()
    expect(template.sides).toEqual(template.id === 'speaker-badge-front' ? ['front', 'back'] : ['front'])
    if (template.id === 'speaker-badge-front') {
      expect(template.qr).toMatchObject({ defaultDestinationKind: 'person-profile', allowNone: true, allowReadableText: true })
    }
    const rendererId = template.id === 'speaker-badge-front' ? 'speaker-badge' : 'legacy-social'
    expect(template.rendererId).toBe(rendererId)
    expect(resolveRenderer(template.legacyFormat!, { 'legacy-social': testRenderer, 'speaker-badge': testRenderer })).toBe(testRenderer)
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

})

test('a test-only asset resolves by template and renderer metadata without a legacy format', () => {
  const testCatalog = [...assetCatalog, pairedBadgeContract]
  const template = testCatalog.flatMap((asset) => asset.templates).find(({ id }) => id === 'speaker-badge-v1')!

  expect(assetCatalog).not.toContain(pairedBadgeContract)
  expect(template.legacyFormat).toBeUndefined()
  expect(template.sides).toEqual(['front', 'back'])
  expect(template.exportProfiles[0]).toMatchObject({ id: 'badge-image', width: 900, height: 1200, types: ['png'], scales: [1] })
  expect(resolveTemplateRenderer(template, { 'renderer-test-42': testRenderer })).toBe(testRenderer)
})

test('format picker keeps the four existing outputs and adds a separate badge family', async ({ page }, testInfo) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Event formats' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Speaker formats' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Networking badges' })).toBeVisible()
  await expect(page.locator('.format-group').nth(0).locator('.format-card')).toHaveCount(2)
  await expect(page.locator('.format-group').nth(1).locator('.format-card')).toHaveCount(2)
  await expect(page.locator('.format-group').nth(2).locator('.format-card')).toHaveCount(1)
  await expect(page.locator('.format-card')).toHaveCount(5)
  await expect(page.locator('.format-group').nth(0).locator('.format-card').nth(0)).toHaveAttribute('aria-label', /Luma Cover/)
  await expect(page.locator('.format-group').nth(0).locator('.format-card').nth(1)).toHaveAttribute('aria-label', /Social Promo/)
  await expect(page.locator('.format-group').nth(2).locator('.format-card')).toHaveAttribute('aria-label', /Speaker Badge/)

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
