import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { planBadgeSheet, cropMarkLines, getBadgeSheetProfile, planDuplexBadgeSheet, duplexFlipAxis } from '../../src/lib/printSheets'

const geometry = { widthMm: 80, heightMm: 120, dpi: 254 }

test('badge sheet profiles keep deterministic capacity, pagination, and crop geometry', () => {
  const a4 = planBadgeSheet(5, geometry, getBadgeSheetProfile('a4'))
  expect(a4.perPage).toBe(4)
  expect(a4.pageCount).toBe(2)
  expect(a4.placements[4].pageIndex).toBe(1)
  expect(a4.cropMarkLineCount).toBe(40)
  const marks = cropMarkLines(a4.placements[0], a4.profile)
  expect(marks).toHaveLength(8)
  expect(marks[0]).toEqual([16, 20, 19, 20])

  const a3 = planBadgeSheet(9, geometry, getBadgeSheetProfile('a3'))
  expect(a3.perPage).toBe(9)
  expect(a3.pageCount).toBe(1)
  expect(a3.placements[8]).toMatchObject({ leftMm: 198, topMm: 278 })
})

test('duplex fixture mirrors every uniquely numbered badge and preserves incomplete-page blanks', () => {
  const profile = getBadgeSheetProfile('a4')
  const fixture = ['badge-101', 'badge-102', 'badge-103', 'badge-104', 'badge-105']
  const longEdge = planDuplexBadgeSheet(fixture.length, geometry, profile, 'long-edge')
  const shortEdge = planDuplexBadgeSheet(fixture.length, geometry, profile, 'short-edge')

  expect(fixture.map((_, index) => longEdge.backPlacements[index].index)).toEqual([0, 1, 2, 3, 4])
  expect(longEdge.backPlacements.map(({ leftMm, topMm }) => [leftMm, topMm])).toEqual([
    [110, 20], [20, 20], [110, 150], [20, 150], [110, 20],
  ])
  expect(shortEdge.backPlacements.map(({ leftMm, topMm }) => [leftMm, topMm])).toEqual([
    [20, 150], [110, 150], [20, 20], [110, 20], [20, 150],
  ])
  expect(new Set(longEdge.backPlacements.map((placement) => placement.index))).toHaveProperty('size', fixture.length)
  expect(duplexFlipAxis(profile, 'long-edge')).toBe('horizontal')
  expect(duplexFlipAxis(profile, 'short-edge')).toBe('vertical')
  expect(duplexFlipAxis({ widthMm: 297, heightMm: 210 }, 'long-edge')).toBe('vertical')
})

test('selected attendees expose an A3 duplex summary and download paired PDF sheets with crop content', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await page.getByRole('button', { name: 'Import attendee CSV' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import attendee CSV' })
  await dialog.getByLabel('Choose a CSV file').setInputFiles({
    name: 'print-sheet-rows.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(['name,organization,role', 'Ada,GHSpain,Attendee', 'Grace,GHSpain,Speaker', 'Lin,Community,Volunteer', 'Mina,Community,Organizer'].join('\n')),
  })
  await dialog.getByLabel('Include row 2 in generation').uncheck()
  const summary = dialog.getByLabel('PDF proof layout summary')
  await expect(summary).toContainText('A4 PDF proof · 3 selected front badges · 4 per sheet · 1 page')
  await dialog.getByLabel('PDF proof page profile').selectOption('a3')
  await expect(summary).toContainText('A3 PDF proof · 3 selected front badges · 9 per sheet · 1 page')

  const zipDownload = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Generate selected badges (.zip)' }).click()
  await zipDownload
  await expect(dialog.getByText('Generated 6 files.', { exact: true })).toBeVisible()
  await expect(dialog.getByLabel('Include row 3 in generation')).toBeDisabled()
  await expect(dialog.getByLabel('Duplex flip behavior')).toBeVisible()
  await expect(summary).toContainText('A3 PDF proof · 3 generated front badges · 9 per sheet · 1 page · 18 mm margins · 10 mm gaps · crop marks on trim · front + matching back sheets · long-edge (horizontal mirror)')
  await dialog.getByLabel('Duplex flip behavior').selectOption('short-edge')
  await expect(summary).toContainText('short-edge (vertical mirror)')

  const pdfDownload = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download A3 PDF proof' }).click()
  const download = await pdfDownload
  expect(download.suggestedFilename()).toBe('devdays-badge-a3-duplex-short-edge.pdf')
  const downloadPath = await download.path()
  if (!downloadPath) throw new Error('PDF download has no path')
  const bytes = await readFile(downloadPath)
  const pdf = bytes.toString('latin1')
  expect(pdf).toMatch(/\/MediaBox \[0 0 841\.889\d* 1190\.551\d*\]/)
  expect((pdf.match(/\/Type \/Page\b/g) ?? []).length).toBe(2)
  expect((pdf.match(/\/Subtype \/Image\b/g) ?? []).length).toBeGreaterThanOrEqual(4)
  expect(pdf).toContain('/Width 800')
  expect(pdf).toContain('/Height 1200')
  expect(pdf).toContain('Calibration pending #145')
})
