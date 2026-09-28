import { expect, test } from '@playwright/test'
import { assetCatalog } from '../../src/domain/assets'
import { stateForSide, switchAssetSide } from '../../src/domain/assetSides'
import { buildDefaultState } from '../../src/lib/history'
import { openSection, selectFormat } from './helpers'

test('switching asset sides retains independent content while event data stays shared', () => {
  const initial = buildDefaultState()
  const front = { ...initial, activeSide: 'front' as const, speakers: [{ id: 'front', name: 'Front person' }] }
  const back = switchAssetSide(front, 'back')
  const editedBack = { ...back, qrDestination: { kind: 'custom-url' as const, url: 'https://event.example/agenda' } }
  const frontAgain = switchAssetSide(editedBack, 'front')
  const backAgain = switchAssetSide({ ...frontAgain, event: { ...frontAgain.event, title: 'Shared event update' } }, 'back')

  expect(frontAgain.speakers).toEqual([{ id: 'front', name: 'Front person' }])
  expect(stateForSide(backAgain).qrDestination).toEqual({ kind: 'custom-url', url: 'https://event.example/agenda' })
  expect(backAgain.event.title).toBe('Shared event update')
})

test('existing production formats remain single-sided and need no side navigation', () => {
  const templates = assetCatalog.flatMap((asset) => asset.templates)
  expect(templates.map((template) => template.sides)).toEqual([['front'], ['front'], ['front'], ['front']])
})

test('single-side editor hides navigation and restores the selected side from draft', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Asset side' })).toHaveCount(0)
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('devdays-banner-draft', 1)
    request.onsuccess = () => {
      const tx = request.result.transaction('drafts', 'readwrite')
      tx.objectStore('drafts').put({
        key: 'current', version: 3,
        state: {
          format: 'speaker_banner',
          activeSide: 'back',
          sideStates: {
            front: { speakers: [{ id: 'front', name: 'Front synthetic' }] },
            back: { speakers: [{ id: 'back', name: 'Back synthetic' }] },
          },
        },
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(new Error(tx.error?.message ?? 'IndexedDB write failed'))
    }
    request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB open failed'))
  }))
  await page.reload()
  await expect(page.getByRole('tablist', { name: 'Asset side' })).toHaveCount(0)
  await expect(page.locator('.draft-status')).toContainText('Saved', { timeout: 5000 })
  await openSection(page, 'section-speakers')
  await expect(page.locator('.speaker-card').first().getByLabel('Name')).toHaveValue('Back synthetic')
})

test('multi-side metadata enables accessible navigation, independent edits, and draft restore', async ({ page }) => {
  await page.route('**/src/domain/assets.ts*', async (route) => {
    const response = await route.fetch()
    const body = await response.text()
    const multiSideBody = body.replace(/(id: "speaker-banner",[\s\S]*?sides: )\["front"\]/, '$1["front", "back"]')
    expect(multiSideBody).not.toBe(body)
    await route.fulfill({ response, body: multiSideBody })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await selectFormat(page, 'speaker_banner')
  const isMobile = await page.evaluate(() => window.innerWidth <= 760)
  if (isMobile) await page.getByRole('tab', { name: 'Preview' }).click()

  const frontTab = page.getByRole('tab', { name: 'Front' })
  const backTab = page.getByRole('tab', { name: 'Back' })
  await expect(frontTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel', { name: 'Front' })).toBeVisible()
  if (isMobile) await page.getByRole('tab', { name: 'Fields' }).click()
  await openSection(page, 'section-speakers')
  const name = page.locator('.speaker-card').first().getByLabel('Name')
  await name.fill('Synthetic front speaker')
  await name.press('Tab')
  if (isMobile) await page.getByRole('tab', { name: 'Preview' }).click()
  await frontTab.focus()
  await frontTab.press('ArrowRight')
  await expect(backTab).toBeFocused()
  await expect(backTab).toHaveAttribute('aria-selected', 'true')
  if (isMobile) await page.getByRole('tab', { name: 'Fields' }).click()
  await name.fill('Synthetic back speaker')
  await name.press('Tab')
  if (isMobile) await page.getByRole('tab', { name: 'Preview' }).click()
  await expect(page.locator('canvas')).toHaveCount(1)
  await expect(page.locator('.draft-status')).toContainText('Saved', { timeout: 5000 })

  await page.reload()
  if (isMobile) await page.getByRole('tab', { name: 'Preview' }).click()
  await expect(page.getByRole('tab', { name: 'Back' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.draft-status')).toContainText('Saved', { timeout: 5000 })
  await page.getByRole('tab', { name: 'Front' }).click()
  if (isMobile) await page.getByRole('tab', { name: 'Fields' }).click()
  await openSection(page, 'section-speakers')
  await expect(page.locator('.speaker-card').first().getByLabel('Name')).toHaveValue('Synthetic front speaker')
  if (isMobile) await page.getByRole('tab', { name: 'Preview' }).click()
  await page.getByRole('tab', { name: 'Back' }).click()
  if (isMobile) await page.getByRole('tab', { name: 'Fields' }).click()
  await expect(page.locator('.speaker-card').first().getByLabel('Name')).toHaveValue('Synthetic back speaker')
})
