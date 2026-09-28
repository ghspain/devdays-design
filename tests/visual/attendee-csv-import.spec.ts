import { expect, test } from '@playwright/test'

test('attendee CSV import parses local quoted data and keeps it out of durable storage', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const sensitiveValue = 'zoe@example.test'
    const originalSetItem = Reflect.get(Storage.prototype, 'setItem') as (this: Storage, key: string, value: string) => void
    Storage.prototype.setItem = function (key, value) {
      if (value.includes(sensitiveValue)) window.__attendeeCsvPersisted = true
      return originalSetItem.call(this, key, value)
    }
    const originalPut = Reflect.get(IDBObjectStore.prototype, 'put') as (this: IDBObjectStore, value: unknown, key?: IDBValidKey) => IDBRequest<IDBValidKey>
    IDBObjectStore.prototype.put = function (value, key) {
      if (JSON.stringify(value).includes(sensitiveValue)) window.__attendeeCsvPersisted = true
      return originalPut.call(this, value, key)
    }
    const originalAdd = Reflect.get(IDBObjectStore.prototype, 'add') as (this: IDBObjectStore, value: unknown, key?: IDBValidKey) => IDBRequest<IDBValidKey>
    IDBObjectStore.prototype.add = function (value, key) {
      if (JSON.stringify(value).includes(sensitiveValue)) window.__attendeeCsvPersisted = true
      return originalAdd.call(this, value, key)
    }
    window.__attendeeCsvPersisted = false
  })

  const requests: string[] = []
  const consoleErrors: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  const requestsBeforeImport = requests.length

  const launcher = page.getByRole('button', { name: 'Import attendee CSV' })
  await launcher.click()
  const dialog = page.getByRole('dialog', { name: 'Import attendee CSV' })
  await expect(dialog).toContainText('processed locally in your browser')
  const screenshotPath = `test-results/${testInfo.project.name}-attendee-csv-import.png`
  await page.screenshot({ path: screenshotPath, animations: 'disabled' })
  await testInfo.attach('attendee-csv-import-dialog', { path: screenshotPath, contentType: 'image/png' })
  await dialog.getByLabel('Choose a CSV file').setInputFiles({
    name: 'synthetic-attendees.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,email,notes\r\n"Zoë Alvarez",zoe@example.test,"Talk, keynote"\r\n"Sam Lee",sam@example.test,Volunteer\r\n'),
  })

  await expect(dialog.getByText('2 attendee rows', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('list', { name: 'CSV headers' }).getByRole('listitem'))
    .toHaveText(['name', 'email', 'notes'])
  await expect(dialog).not.toContainText('zoe@example.test')
  await expect(page.evaluate(() => window.__attendeeCsvPersisted)).resolves.toBe(false)
  await expect.poll(() => requests.length).toBe(requestsBeforeImport)

  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(launcher).toBeFocused()
  expect(consoleErrors).toEqual([])
})

test('replacing an imported file discards prior rows and malformed input exposes no raw content', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await page.getByRole('button', { name: 'Import attendee CSV' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import attendee CSV' })
  const file = dialog.getByLabel('Choose a CSV file')

  await file.setInputFiles({ name: 'valid.csv', mimeType: 'text/csv', buffer: Buffer.from('name\nPat Example\n') })
  await expect(dialog.getByText('1 attendee row', { exact: true })).toBeVisible()
  await file.setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from('name,notes\n"private raw value,missing quote') })
  await expect(dialog.getByRole('alert')).toHaveText('This file could not be read as CSV. Check the file format and try another file.')
  await expect(dialog).not.toContainText('Pat Example')
  await expect(dialog).not.toContainText('private raw value')
})

test('organizers can explicitly clear imported attendee data', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await page.getByRole('button', { name: 'Import attendee CSV' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import attendee CSV' })
  const file = dialog.getByLabel('Choose a CSV file')
  await file.setInputFiles({ name: 'valid.csv', mimeType: 'text/csv', buffer: Buffer.from('name\nTaylor Sample\n') })
  await expect(dialog.getByText('1 attendee row', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Clear imported data' }).click()
  await expect(dialog.getByText('No attendee data imported.', { exact: true })).toBeVisible()
  await expect(file).toHaveValue('')
})

test('the attendee import dialog fits a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await page.getByRole('button', { name: 'Import attendee CSV' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import attendee CSV' })
  await expect(dialog.getByLabel('Choose a CSV file')).toBeVisible()
  const { dialogWidth, viewportWidth } = await page.evaluate(() => ({
    dialogWidth: document.querySelector('[role="dialog"]')?.getBoundingClientRect().width ?? 0,
    viewportWidth: window.innerWidth,
  }))
  expect(dialogWidth).toBeLessThanOrEqual(viewportWidth)
})

declare global {
  interface Window {
    __attendeeCsvPersisted: boolean
  }
}
