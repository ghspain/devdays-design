import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { planBadgeSheet, cropMarkLines, getBadgeSheetProfile } from '../../src/lib/printSheets'

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

test('selected attendees expose an A3 proof summary and download a one-page PDF with crop content', async ({ page }) => {
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
  await expect(summary).toContainText('A3 PDF proof · 3 generated front badges · 9 per sheet · 1 page')

  const pdfDownload = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download A3 PDF proof' }).click()
  const download = await pdfDownload
  expect(download.suggestedFilename()).toBe('devdays-badge-a3-proof.pdf')
  const downloadPath = await download.path()
  if (!downloadPath) throw new Error('PDF download has no path')
  const bytes = await readFile(downloadPath)
  const pdf = bytes.toString('latin1')
  expect(pdf).toMatch(/\/MediaBox \[0 0 841\.889\d* 1190\.551\d*\]/)
  expect((pdf.match(/\/Type \/Page\b/g) ?? []).length).toBe(1)
  expect((pdf.match(/\/Subtype \/Image\b/g) ?? []).length).toBe(3)
  expect(pdf).toContain('/Width 800')
  expect(pdf).toContain('/Height 1200')
  expect(pdf).toContain('Calibration pending #145')
})
