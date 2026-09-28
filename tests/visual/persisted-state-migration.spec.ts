import { expect, test } from '@playwright/test'
import { openSection } from './helpers'

const legacyState = {
  format: 'speaker_banner',
  theme: 'community_meetup',
  colors: { primary: '#123456', secondary: '#234567', accent: '#345678', background: '#f0f0f0' },
  event: { title: 'Synthetic migration event', city: 'Madrid', dateTime: 'May 2', location: 'Room 3' },
  speakers: [
    { id: 'synthetic-1', name: 'Synthetic One', role: 'Host' },
    { id: 'synthetic-2', name: 'Synthetic Two', role: 'Guest' },
  ],
  speakersPerCard: 2,
  speakerBannerPairLayout: 'stacked',
  partners: [{ id: 'synthetic-partner', name: 'Synthetic sponsor', imageDataUrl: '' }],
  export: { type: 'jpg', scale: 2 },
}

async function writeDraftRecord(page: import('@playwright/test').Page, record: unknown) {
  await page.evaluate((value) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('devdays-banner-draft', 1)
    request.onsuccess = () => {
      const tx = request.result.transaction('drafts', 'readwrite')
      tx.objectStore('drafts').put({ key: 'current', ...value as object })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(new Error(tx.error?.message ?? 'IndexedDB write failed'))
    }
    request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB open failed'))
  }), record)
}

async function readDraftRecord(page: import('@playwright/test').Page) {
  return page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open('devdays-banner-draft', 1)
    request.onsuccess = () => {
      const get = request.result.transaction('drafts', 'readonly').objectStore('drafts').get('current')
      get.onsuccess = () => resolve(get.result)
      get.onerror = () => reject(new Error(get.error?.message ?? 'IndexedDB read failed'))
    }
    request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB open failed'))
  }))
}

test('pre-migration draft restores editor state and autosaves the versioned normalized form', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await writeDraftRecord(page, { version: 1, state: legacyState, savedAt: '2025-01-01T00:00:00.000Z' })
  await page.reload()

  await expect(page.getByLabel('Event title')).toHaveValue('Synthetic migration event')
  await expect(page.locator('.format-card.selected')).toContainText('Speaker Banner')
  await expect(page.getByLabel('Pair layout')).toHaveValue('stacked')
  await expect(page.locator('.speaker-card').first().getByLabel('Name')).toHaveValue('Synthetic One')
  await expect(page.locator('.draft-status')).toContainText('Saved', { timeout: 5000 })

  const stored = await readDraftRecord(page)
  expect(stored).toMatchObject({
    version: 2,
    state: {
      format: 'speaker_banner', theme: 'community_meetup', speakersPerCard: 2,
      speakerBannerPairLayout: 'stacked', partners: legacyState.partners, export: legacyState.export,
      event: { title: legacyState.event.title, edition: 'Professional', registrationEnabled: true },
    },
  })
})

test('newer draft data is preserved and explains the reset fallback', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  const newer = { version: 99, state: legacyState, marker: 'preserve-me' }
  await writeDraftRecord(page, newer)
  await page.reload()

  await expect(page.locator('.draft-status')).toContainText('not supported')
  await expect(page.locator('.draft-status')).toContainText('use Reset')
  await openSection(page, 'section-event')
  await page.getByLabel('Event title').fill('Unsaved synthetic edit')
  await page.waitForTimeout(700)

  const stored = await readDraftRecord(page)
  expect(stored).toMatchObject(newer)

  const invalid = { version: 1, state: { ...legacyState, format: 'future_format' }, marker: 'keep-invalid' }
  await writeDraftRecord(page, invalid)
  await page.reload()
  await expect(page.locator('.draft-status')).toContainText('not supported')
  const invalidStored = await readDraftRecord(page)
  expect(invalidStored).toMatchObject(invalid)

  const malformed = {
    version: 1,
    state: { ...legacyState, event: { ...legacyState.event, city: 42 } },
    marker: 'keep-malformed',
  }
  await writeDraftRecord(page, malformed)
  await page.reload()
  await expect(page.locator('.draft-status')).toContainText('not supported')
  const malformedStored = await readDraftRecord(page)
  expect(malformedStored).toMatchObject(malformed)

  for (const state of [
    { ...legacyState, speakersPerCard: 3 },
    { ...legacyState, speakerBannerPairLayout: 'diagonal' },
  ]) {
    const invalidEnum = { version: 1, state, marker: 'keep-invalid-enum' }
    await writeDraftRecord(page, invalidEnum)
    await page.reload()
    await expect(page.locator('.draft-status')).toContainText('not supported')
    expect(await readDraftRecord(page)).toMatchObject(invalidEnum)
  }

  const reset = page.getByRole('button', { name: 'Reset' })
  await reset.focus()
  await reset.press('Enter')
  await page.getByRole('button', { name: 'Clear draft' }).click()
  await expect(page.getByLabel('Event title')).toHaveValue('Dev Days')
})

test('QR destination overrides and readable-text settings survive draft restore', async ({ page }) => {
  await page.goto('/')
  const state = {
    ...legacyState,
    qrDestination: { kind: 'custom-url', url: 'https://event.example/agenda' },
    qrReadableText: false,
  }
  await writeDraftRecord(page, { version: 2, state, savedAt: '2026-01-01T00:00:00.000Z' })
  await page.reload()
  await expect(page.locator('.draft-status')).toContainText('Saved')
  expect(await readDraftRecord(page)).toMatchObject({ state: { qrDestination: state.qrDestination, qrReadableText: false } })

  const malformed = { version: 2, state: { ...state, qrDestination: { kind: 'future-destination' } }, marker: 'preserve-invalid-qr' }
  await writeDraftRecord(page, malformed)
  await page.reload()
  await expect(page.locator('.draft-status')).toContainText('not supported')
  expect(await readDraftRecord(page)).toMatchObject(malformed)
})
