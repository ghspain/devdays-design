import { expect, test, type Download } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { openSection, selectFormat } from './helpers'

test('Speaker Badge downloads the active face and both sides with deterministic names and matching dimensions', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible({ timeout: 10_000 })
  await selectFormat(page, 'speaker_badge')
  await expect(page.getByRole('tab', { name: 'Front' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: /Download Front PNG · 800×1200/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download both Speaker Badge sides as 2 PNG files' })).toBeVisible()

  const downloads: Download[] = []
  page.on('download', (download) => downloads.push(download))
  await page.getByRole('button', { name: /Download Front PNG/ }).click()
  await expect.poll(() => downloads.length).toBe(1)
  expect(downloads[0].suggestedFilename()).toMatch(/^speaker-badge-.*-front\.png$/)

  await page.getByRole('button', { name: 'Download both Speaker Badge sides as 2 PNG files' }).click()
  await expect.poll(() => downloads.length).toBe(3)
  const names = downloads.map((download) => download.suggestedFilename())
  expect(names.slice(1)).toEqual([
    expect.stringMatching(/^speaker-badge-.*-front\.png$/),
    expect.stringMatching(/^speaker-badge-.*-back\.png$/),
  ])
  expect(names[1]).toBe(names[0])
  expect(names[2]).toBe(names[1].replace(/-front\.png$/, '-back.png'))
  const paths = await Promise.all(downloads.slice(1).map((download) => download.path()))
  const images = await Promise.all(paths.filter((path): path is string => !!path).map((path) => readFile(path)))
  const dimensions = images.map((bytes) => [bytes.readUInt32BE(16), bytes.readUInt32BE(20)])
  expect(dimensions).toEqual([[1600, 2400], [1600, 2400]])
  await expect(page.getByRole('status', { name: 'Both-side export checks' })).toContainText('Front')
  await expect(page.getByRole('status', { name: 'Both-side export checks' })).toContainText('Back')
})

test('a back QR error stays associated with Back and blocks a both-side download', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible({ timeout: 10_000 })
  await selectFormat(page, 'speaker_badge')
  await page.getByRole('tab', { name: 'Back' }).click()
  await openSection(page, 'section-qr')
  await page.locator('#qr-destination-type').selectOption('custom-url')
  await page.locator('#qr-destination-url').fill('javascript:alert(1)')
  await expect(page.locator('#qr-destination-url-validationMessage')).toBeVisible()
  await page.getByRole('tab', { name: 'Front' }).click()
  await expect(page.locator('.validation-panel')).not.toContainText('invalid QR destination')

  let downloads = 0
  page.on('download', () => { downloads += 1 })
  await page.getByRole('button', { name: 'Download both Speaker Badge sides as 2 PNG files' }).click()
  await expect(page.getByRole('status', { name: 'Both-side export checks' })).toContainText('Back')
  await expect(page.getByRole('status', { name: 'Both-side export checks' })).toContainText('HTTP or HTTPS URL')
  await expect.poll(() => downloads).toBe(0)
})
