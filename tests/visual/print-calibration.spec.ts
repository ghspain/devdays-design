import { expect, test } from '@playwright/test'
import { buildPrintCalibrationPdf, PRINT_CALIBRATION } from '../../src/lib/printCalibration'

test('synthetic calibration fixture has reproducible A4 geometry and front/back markers', async () => {
  const fixture = await buildPrintCalibrationPdf()
  const pdf = Buffer.from(await fixture.blob.arrayBuffer()).toString('latin1')
  const mmToPdfPoints = (millimetres: number) => millimetres * 72 / 25.4
  const rects = [...pdf.matchAll(/(-?[0-9.]+) (-?[0-9.]+) (-?[0-9.]+) (-?[0-9.]+) re/g)]
    .map((match) => match.slice(1).map(Number))
  const lines = [...pdf.matchAll(/(-?[0-9.]+) (-?[0-9.]+) m[\r\n]+(-?[0-9.]+) (-?[0-9.]+) l/g)]
    .map((match) => match.slice(1).map(Number))

  expect(fixture.fileName).toBe(PRINT_CALIBRATION.fileName)
  expect(pdf).toMatch(/\/MediaBox \[0 0 595\.27\d* 841\.88\d*\]/)
  expect((pdf.match(/\/Type \/Page\b/g) ?? []).length).toBe(2)
  expect(rects).toHaveLength(4)
  for (const trim of [rects[0], rects[2]]) {
    expect(trim[0]).toBeCloseTo(mmToPdfPoints(65), 5)
    expect(trim[1]).toBeCloseTo(mmToPdfPoints(297 - 62), 5)
    expect(trim[2]).toBeCloseTo(mmToPdfPoints(80), 5)
    expect(trim[3]).toBeCloseTo(-mmToPdfPoints(120), 5)
  }
  for (const safe of [rects[1], rects[3]]) {
    expect(safe[0]).toBeCloseTo(mmToPdfPoints(70), 5)
    expect(safe[1]).toBeCloseTo(mmToPdfPoints(297 - 67), 5)
    expect(safe[2]).toBeCloseTo(mmToPdfPoints(70), 5)
    expect(safe[3]).toBeCloseTo(-mmToPdfPoints(110), 5)
  }
  const rulerBaselines = lines.filter(([x1, y1, x2, y2]) =>
    Math.abs(x1 - mmToPdfPoints(55)) < 0.00001 && Math.abs(y1 - mmToPdfPoints(297 - 205)) < 0.00001 &&
    Math.abs(x2 - mmToPdfPoints(155)) < 0.00001 && Math.abs(y2 - mmToPdfPoints(297 - 205)) < 0.00001,
  )
  expect(rulerBaselines).toHaveLength(2)
  for (const [, , x2, y2] of rulerBaselines) {
    expect(x2).toBeCloseTo(mmToPdfPoints(155), 5)
    expect(y2).toBeCloseTo(mmToPdfPoints(297 - 205), 5)
  }
  expect(pdf).toContain('FRONT 1')
  expect(pdf).toContain('BACK 1')
  expect(pdf).toContain('100 mm ruler reference')
  expect(pdf).toContain('TRIM 80')
})

test('attendee import exposes the physical calibration gate and scaling warning', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Import attendee CSV' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import attendee CSV' })
  const calibration = dialog.getByRole('region', { name: 'Print calibration fixture' })
  await expect(calibration).toContainText('100% / Actual size')
  await expect(calibration).toContainText('Fit to page')
  await expect(calibration).toContainText('manual physical-printer check is the production gate')
  const download = page.waitForEvent('download')
  await calibration.getByRole('button', { name: 'Download print calibration fixture (PDF)' }).click()
  expect((await download).suggestedFilename()).toBe(PRINT_CALIBRATION.fileName)
})
