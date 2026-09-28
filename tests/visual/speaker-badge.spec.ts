import { expect, test } from '@playwright/test'
import { attendeeBadgeSubject, speakerBadgeSubject } from '../../src/domain/badgeSubject'

test('speakers and imported attendees map to one badge display contract without inventing optional values', () => {
  expect(speakerBadgeSubject({ id: 'speaker-1', name: 'Ada Sample', role: 'Platform Engineer' }, 'ada')).toEqual({
    kind: 'speaker',
    name: 'Ada Sample',
    roleMarker: 'SPEAKER',
    title: 'Platform Engineer',
    networkingHandle: 'ada',
    showNetworkingHandle: true,
    photoDataUrl: undefined,
  })
  expect(attendeeBadgeSubject({ name: 'Sam Sample' })).toEqual({
    kind: 'attendee',
    name: 'Sam Sample',
    roleMarker: 'ATTENDEE',
    organization: undefined,
    title: undefined,
    networkingHandle: undefined,
    showNetworkingHandle: false,
  })
  expect(attendeeBadgeSubject({ name: 'Sam Sample', organization: 'GHSpain', role: 'Volunteer', githubHandle: 'sam' })).toEqual({
    kind: 'attendee',
    name: 'Sam Sample',
    roleMarker: 'ATTENDEE',
    organization: 'GHSpain',
    title: 'Volunteer',
    networkingHandle: 'sam',
    showNetworkingHandle: true,
  })
})
import { assetCatalog } from '../../src/domain/assets'
import { publicProfileHandle } from '../../src/domain/publicHandle'
import { openSection, selectFormat, selectTheme, showPreviewForViewport } from './helpers'

const badgeTemplate = assetCatalog.flatMap((asset) => asset.templates).find(({ id }) => id === 'speaker-badge-front')
interface ValidationWindow extends Window {
  __devdaysValidation?: { findings: Array<{ code: string; field?: string }> }
}

test('Speaker Badge is a distinct front template with a reusable renderer', () => {
  expect(badgeTemplate).toMatchObject({
    id: 'speaker-badge-front',
    legacyFormat: 'speaker_badge',
    sides: ['front', 'back'],
    rendererId: 'speaker-badge',
    exportProfiles: [{ width: 800, height: 1200, types: ['png', 'jpg'] }],
  })
  expect(assetCatalog.flatMap((asset) => asset.templates).find(({ id }) => id === 'speaker-banner')?.rendererId).toBe('legacy-social')
})

test('catalog public profiles expose a usable synthetic badge handle without changing canonical data', () => {
  const profile = {
    personId: 'synthetic-person',
    name: 'Synthetic Person',
    displayRole: 'Community speaker',
    avatarUrl: '',
    lastVerified: '2026-01-01',
    destinations: [{ kind: 'github' as const, url: 'https://github.com/synthetic-handle' }],
  }
  expect(publicProfileHandle(profile.destinations)).toBe('@synthetic-handle')
  expect(profile.destinations[0].url).toBe('https://github.com/synthetic-handle')
})

test('selecting a catalog speaker fills public details and the handle can be edited or hidden', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('https://avatars.githubusercontent.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="32" fill="#5eec83"/></svg>',
  }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await selectFormat(page, 'speaker_badge')
  await openSection(page, 'section-speakers')
  await page.locator('.speaker-card').first().getByRole('button', { name: 'Remove' }).click()

  const option = page.locator('.catalog-option').first()
  const name = await option.locator('strong').innerText()
  await option.locator('input[type="checkbox"]').check()
  await page.getByRole('button', { name: /Add selected speakers/ }).click()

  const card = page.locator('.speaker-card').last()
  await expect(card.getByLabel('Name')).toHaveValue(name)
  await expect(card.getByLabel('Role')).not.toHaveValue('')
  await expect(card.locator('img.speaker-card-avatar')).toHaveAttribute('src', /avatars\.githubusercontent\.com/)

  const handle = card.getByRole('textbox', { name: 'Networking handle' })
  await expect(handle).toHaveValue(/^@/)
  {
    const defaultPixels = await page.locator('canvas').evaluate((element) => {
      const canvas = element as HTMLCanvasElement
      const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
      return data.reduce((hash, pixel) => (hash * 31 + pixel) >>> 0, 0)
    })
    await handle.fill('@synthetic-edit')
    await expect.poll(() => page.locator('canvas').evaluate((element) => {
      const canvas = element as HTMLCanvasElement
      const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
      return data.reduce((hash, pixel) => (hash * 31 + pixel) >>> 0, 0)
    })).not.toBe(defaultPixels)
    const editedPixels = await page.locator('canvas').evaluate((element) => {
      const canvas = element as HTMLCanvasElement
      const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
      return data.reduce((hash, pixel) => (hash * 31 + pixel) >>> 0, 0)
    })
    const showHandle = card.getByRole('checkbox', { name: 'Show networking handle' })
    await showHandle.focus()
    await expect(showHandle).toBeFocused()
    await page.keyboard.press('Space')
    await expect(showHandle).not.toBeChecked()
    const hiddenPixels = await page.locator('canvas').evaluate((element) => {
      const canvas = element as HTMLCanvasElement
      const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
      return data.reduce((hash, pixel) => (hash * 31 + pixel) >>> 0, 0)
    })
    expect(hiddenPixels).not.toBe(editedPixels)
    await showHandle.check()
  }

  await expect(page.locator('canvas')).toHaveAttribute('width', '800')
  await expect(page.locator('canvas')).toHaveAttribute('height', '1200')
  await expect.poll(() => page.evaluate(() => (window as ValidationWindow).__devdaysValidation?.findings ?? null)).not.toBeNull()
  const findings = await page.evaluate(() => (window as ValidationWindow).__devdaysValidation!.findings)
  expect(findings.filter(({ code }) => code === 'safe-area' || code === 'low-contrast')).toEqual([])
  for (const theme of ['devdays', 'community_meetup', 'online_github'] as const) {
    await selectTheme(page, theme)
    await expect.poll(() => page.evaluate(() => (window as ValidationWindow).__devdaysValidation?.findings ?? null)).not.toBeNull()
    const themeFindings = await page.evaluate(() => (window as ValidationWindow).__devdaysValidation!.findings)
    expect(themeFindings.filter(({ code }) => code === 'safe-area' || code === 'low-contrast')).toEqual([])
  }
  if (await page.locator('.app-toast').count()) await page.locator('.app-toast').click()
  await showPreviewForViewport(page)
  await page.locator('canvas').screenshot({ path: test.info().outputPath('speaker-badge-front.png') })
  expect(errors).toEqual([])
})

test('long names/titles truncate safely and a missing profile/avatar uses initials', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await selectFormat(page, 'speaker_badge')
  await openSection(page, 'section-speakers')
  const card = page.locator('.speaker-card').first()
  await card.getByLabel('Name').fill('Synthetic Speaker With An Exceptionally Long Name That Needs Safe Truncation')
  await card.getByLabel('Role').fill('Synthetic role title with more descriptive words than the badge can display')
  await card.getByLabel('Name').press('Tab')

  await expect(page.locator('canvas')).toHaveAttribute('width', '800')
  await expect(page.locator('canvas')).toHaveAttribute('height', '1200')
  await expect.poll(() => page.evaluate(() => (window as ValidationWindow).__devdaysValidation?.findings ?? null)).not.toBeNull()
  const findings = await page.evaluate(() => (window as ValidationWindow).__devdaysValidation!.findings)
  expect(findings.some(({ code, field }) => code === 'text-truncated' && (field === 'Speaker name' || field === 'Speaker title'))).toBe(true)
  expect(findings.filter(({ code }) => code === 'safe-area' || code === 'low-contrast')).toEqual([])
  if (await page.locator('.app-toast').count()) await page.locator('.app-toast').click()
  await showPreviewForViewport(page)
  await page.locator('canvas').screenshot({ path: test.info().outputPath('speaker-badge-long-name.png') })
  if (await page.evaluate(() => window.innerWidth <= 760)) await page.getByRole('tab', { name: 'Fields' }).click()

  await card.getByLabel('Name').fill('Synthetic Speaker')
  await card.getByLabel('Role').fill('')
  await expect(card.getByRole('textbox', { name: 'Networking handle' })).toHaveAttribute('placeholder', 'No public handle available')
  await expect(card.getByRole('checkbox', { name: 'Show networking handle' })).not.toBeChecked()
  const hasInk = await page.locator('canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] > 0 && (data[index] > 30 || data[index + 1] > 30 || data[index + 2] > 30)) return true
    }
    return false
  })
  expect(hasInk).toBe(true)
  if (await page.locator('.app-toast').count()) await page.locator('.app-toast').click()
  await showPreviewForViewport(page)
  await page.locator('canvas').screenshot({ path: test.info().outputPath('speaker-badge-fallback.png') })
})

test('Speaker Badge back defaults to an available GitHub profile and supports profile overrides', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await selectFormat(page, 'speaker_badge')
  await openSection(page, 'section-speakers')
  await page.locator('.speaker-card').first().getByRole('button', { name: 'Remove' }).click()
  const option = page.locator('.catalog-option').first()
  await option.locator('input[type="checkbox"]').check()
  await page.getByRole('button', { name: /Add selected speakers/ }).click()

  await page.getByRole('tab', { name: 'Back' }).click()
  await openSection(page, 'section-qr')
  const destinationType = page.locator('#qr-destination-type')
  await expect(destinationType).toHaveValue('person-profile')
  const profileField = page.locator('#qr-person-profile')
  const choices = await profileField.locator('option').evaluateAll((options) => options.map((item) => (item as HTMLOptionElement).value))
  expect(choices.length).toBeGreaterThan(0)
  const preferred = choices.find((value) => value.endsWith('|github')) ?? choices.find((value) => value.endsWith('|website')) ?? choices[0]
  await expect(profileField).toHaveValue(preferred)
  await expect(page.locator('canvas')).toHaveAttribute('width', '800')
  await page.locator('canvas').screenshot({ path: test.info().outputPath('speaker-badge-back-profile.png') })

  for (const theme of ['devdays', 'community_meetup', 'online_github'] as const) {
    await selectTheme(page, theme)
    await expect.poll(() => page.evaluate(() => (window as ValidationWindow).__devdaysValidation?.findings ?? null)).not.toBeNull()
    const findings = await page.evaluate(() => (window as ValidationWindow).__devdaysValidation!.findings)
    expect(findings.filter(({ code }) => code === 'safe-area' || code === 'low-contrast')).toEqual([])
  }

  const override = choices.find((value) => value.endsWith('|linkedin')) ?? choices.find((value) => value !== preferred)
  if (override) {
    await profileField.selectOption(override)
    await expect(profileField).toHaveValue(override)
  }
  await page.getByRole('tab', { name: 'Front' }).click()
  await expect(page.locator('#section-qr')).toHaveCount(0)
})

test('Speaker Badge back supports custom URLs, readable text toggling, no-profile fallback and invalid feedback', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await selectFormat(page, 'speaker_badge')
  await page.getByRole('tab', { name: 'Back' }).click()
  await openSection(page, 'section-qr')
  await expect(page.locator('#qr-destination-type')).toHaveValue('none')
  await expect.poll(() => page.evaluate(() => (window as ValidationWindow).__devdaysValidation?.findings ?? null)).not.toBeNull()
  expect(await page.evaluate(() => (window as ValidationWindow).__devdaysValidation!.findings.some(({ code }) => code === 'invalid-qr-destination'))).toBe(false)

  await page.locator('#qr-destination-type').selectOption('custom-url')
  const url = page.locator('#qr-destination-url')
  await url.fill('https://events.example/synthetic-speaker')
  await expect.poll(() => page.locator('canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    return data.reduce((hash, pixel) => (hash * 31 + pixel) >>> 0, 0)
  })).not.toBe(0)
  const readableText = page.getByLabel('Readable destination text')
  await expect(readableText).toHaveAttribute('aria-pressed', 'true')
  await readableText.click()
  await expect(readableText).toHaveAttribute('aria-pressed', 'false')

  await url.fill('javascript:alert(1)')
  await expect(page.getByText('Use an HTTP or HTTPS URL.', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as ValidationWindow).__devdaysValidation?.findings ?? null)).toContainEqual(expect.objectContaining({ code: 'invalid-qr-destination' }))
  await page.locator('canvas').screenshot({ path: test.info().outputPath('speaker-badge-back-invalid.png') })
})
