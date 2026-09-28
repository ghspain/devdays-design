import { expect, test, type Page } from '@playwright/test'
import { runRenderQueue, type BatchRenderJob } from '../../src/lib/renderQueue'

test('render queue keeps job order, progress totals, filenames, and individual failures', async () => {
  const progress: Array<{ completed: number; total: number; percentage: number }> = []
  const jobs: BatchRenderJob[] = [
    { id: 'row-2-front', subject: { kind: 'attendee', name: 'Ada', sourceRowNumber: 2 }, template: 'speaker-badge-front', side: 'front', filename: 'ada-front.png', render: () => Promise.resolve(new Blob(['front'])) },
    { id: 'row-2-back', subject: { kind: 'attendee', name: 'Ada', sourceRowNumber: 2 }, template: 'speaker-badge-front', side: 'back', filename: 'ada-back.png', render: () => Promise.reject(new Error('QR failed')) },
    { id: 'row-3-front', subject: { kind: 'attendee', name: 'Grace', sourceRowNumber: 3 }, template: 'speaker-badge-front', side: 'front', filename: 'grace-front.png', render: () => Promise.resolve(new Blob(['front'])) },
  ]

  const result = await runRenderQueue(jobs, ({ completed, total, percentage }) => progress.push({ completed, total, percentage }))

  expect(result.completed.map(({ job }) => job.filename)).toEqual(['ada-front.png', 'grace-front.png'])
  expect(result.failures.map(({ filename, side, message }) => ({ filename, side, message }))).toEqual([{ filename: 'ada-back.png', side: 'back', message: 'QR failed' }])
  expect(progress.map(({ completed, total, percentage }) => [completed, total, percentage])).toEqual([[1, 3, 33], [2, 3, 67], [3, 3, 100], [3, 3, 100]])
})

async function importCsv(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await page.getByRole('button', { name: 'Import attendee CSV' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import attendee CSV' })
  await dialog.getByLabel('Choose a CSV file').setInputFiles({
    name: 'batch-fixture.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,role\nAda Example,Attendee\n,Invalid\nGrace Hopper,Organizer'),
  })
  return dialog
}

test('badge generation uses only selected valid rows and reports both sides', async ({ page }) => {
  const dialog = await importCsv(page)
  await expect(dialog.getByRole('status')).toContainText('selected for generation 2')
  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Generate selected badges (.zip)' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('devdays-madrid-dev-days-badges.zip')
  await expect(dialog.getByRole('status', { name: 'Badge batch progress' })).toContainText('Complete · 4/4 · 100%')
  await expect(dialog).toContainText('Generated 4 files.')
})
