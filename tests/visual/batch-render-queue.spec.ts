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

test('render queue cancels pending jobs without rerunning them', async () => {
  const controller = new AbortController()
  const calls: string[] = []
  const jobs: BatchRenderJob[] = ['first', 'second', 'third'].map((id) => ({
    id,
    subject: { kind: 'attendee', name: id },
    template: 'speaker-badge-front',
    side: 'front',
    filename: `${id}.png`,
    render: () => {
      calls.push(id)
      if (id === 'first') controller.abort()
      return Promise.resolve(new Blob([id]))
    },
  }))

  const result = await runRenderQueue(jobs, undefined, { signal: controller.signal })

  expect(calls).toEqual(['first'])
  expect(result.completed.map(({ job }) => job.id)).toEqual(['first'])
  expect(result.failures.map(({ id, status }) => ({ id, status }))).toEqual([
    { id: 'second', status: 'cancelled' },
    { id: 'third', status: 'cancelled' },
  ])
  expect(result.cancelled).toBe(true)
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
  await expect(dialog.getByRole('button', { name: 'Retry failed/cancelled jobs' })).toHaveCount(0)
})

test('badge generation can be cancelled mid-run while retaining completed work', async ({ page }) => {
  const dialog = await importCsv(page)
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = (callback) => {
      window.setTimeout(() => callback(new Blob(['png'])), 50)
    }
  })
  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Generate selected badges (.zip)' }).click()
  await dialog.getByRole('button', { name: 'Cancel generation' }).click()
  await downloadPromise
  await expect(dialog.getByRole('status', { name: 'Badge batch progress' })).toContainText('Cancelled')
  await expect(dialog.getByRole('list', { name: 'Badge batch failures' })).toContainText('Cancelled before rendering.')
})

test('replacing the CSV during a slow batch drops the stale result without downloading it', async ({ page }) => {
  const dialog = await importCsv(page)
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = (callback) => {
      window.setTimeout(() => callback(new Blob(['png'])), 100)
    }
  })
  const downloads: string[] = []
  page.on('download', (download) => downloads.push(download.suggestedFilename()))
  await dialog.getByRole('button', { name: 'Generate selected badges (.zip)' }).click()
  await dialog.getByLabel('Choose a CSV file').setInputFiles({
    name: 'replacement.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,role\nReplacement Person,Attendee'),
  })
  await expect(dialog.getByRole('status').filter({ hasText: 'selected for generation 1' })).toBeVisible()
  await page.waitForTimeout(250)
  expect(downloads).toEqual([])
  await expect(dialog.getByRole('status', { name: 'Badge batch progress' })).toHaveCount(0)
  await expect(dialog).not.toContainText('Generated ')
})

test('badge generation reports failed attendee rows and sides without row details', async ({ page }) => {
  const dialog = await importCsv(page)
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = (callback) => callback(null)
  })
  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Generate selected badges (.zip)' }).click()
  await downloadPromise
  const failures = dialog.getByRole('list', { name: 'Badge batch failures' })
  await expect(failures).toContainText('Row 2 · Front · speaker-badge-front: Could not create PNG file.')
  await expect(failures).toContainText('Row 2 · Back · speaker-badge-front: Could not create PNG file.')
  await expect(failures).toContainText('Row 4 · Front · speaker-badge-front: Could not create PNG file.')
  await expect(failures).toContainText('Row 4 · Back · speaker-badge-front: Could not create PNG file.')
  await expect(failures).not.toContainText('Ada Example')
  await expect(failures).not.toContainText('Grace Hopper')
})

test('badge retry rerenders only failed jobs and restores the final count', async ({ page }) => {
  const dialog = await importCsv(page)
  await page.evaluate(() => {
    let calls = 0
    HTMLCanvasElement.prototype.toBlob = (callback) => {
      calls += 1
      callback(calls === 2 ? null : new Blob(['png']))
    }
  })
  const firstDownload = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Generate selected badges (.zip)' }).click()
  await firstDownload
  await expect(dialog).toContainText('Generated 3 files; 1 job failed.')

  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = (callback) => callback(new Blob(['png']))
  })
  const retryDownload = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Retry failed/cancelled jobs' }).click()
  await retryDownload
  await expect(dialog).toContainText('Generated 4 files.')
  await expect(dialog.getByRole('list', { name: 'Badge batch failures' })).toHaveCount(0)
})
