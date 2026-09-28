import { expect, test } from '@playwright/test'

test('direct manipulation is available only on the badge element declared by its template', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chromium'
  if (mobile) await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  const navigation = page.locator('.asset-navigation')
  await navigation.getByRole('button', { name: /Speaker Profile/ }).click()
  if (mobile) await page.getByRole('tab', { name: 'Preview' }).click()
  const socialName = page.locator('.artboard-selection-target[data-field="speaker name"]')
  await expect(socialName).toBeVisible()
  await expect(socialName).not.toHaveClass(/is-movable/)

  if (mobile) await page.getByRole('tab', { name: 'Fields' }).click()
  await navigation.getByRole('button', { name: /Speaker Badge/ }).click()
  if (mobile) await page.getByRole('tab', { name: 'Preview' }).click()
  await expect(page.locator('.artboard-selection-target.is-movable[data-field="speaker name"]')).toBeVisible()
  await expect(page.locator('.artboard-selection-target.is-movable')).toHaveCount(1)
})

test('template-approved badge name moves within bounds and exports from the same renderer state', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chromium'
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })
  if (mobile) await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await page.locator('.asset-navigation').getByRole('button', { name: /Speaker Badge/ }).click()
  if (mobile) await page.getByRole('tab', { name: 'Preview' }).click()

  const target = page.locator('.artboard-selection-target[data-field="speaker name"]')
  await expect(target).toBeVisible()
  await expect(target).toHaveClass(/is-movable/)
  const before = await page.locator('.canvas-wrap canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())

  if (mobile) {
    await target.click()
  } else {
    const box = await target.boundingBox()
    expect(box).toBeTruthy()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width / 2 + 24, box!.y + box!.height / 2 + 12, { steps: 4 })
    await page.mouse.up()
  }

  const xOffset = page.getByRole('spinbutton', { name: 'Speaker name X offset' })
  const yOffset = page.getByRole('spinbutton', { name: 'Speaker name Y offset' })
  await expect(xOffset).toBeVisible()
  if (!mobile) {
    await expect(xOffset).not.toHaveValue('0')
    await expect(yOffset).not.toHaveValue('0')
  }

  await xOffset.fill('999')
  await expect(xOffset).toHaveValue('40')
  await xOffset.press('ArrowDown')
  await expect(xOffset).toHaveValue('39')
  await expect.poll(() => page.locator('.canvas-wrap canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()))
    .not.toBe(before)

  if (mobile) await page.getByRole('tab', { name: 'Preview' }).click()
  await page.getByRole('tab', { name: 'Back' }).click()
  await expect(page.locator('.artboard-selection-target[data-field="speaker name"]')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Front' }).click()
  if (mobile) {
    await page.getByRole('tab', { name: 'Fields' }).click()
  }
  await expect(page.getByRole('spinbutton', { name: 'Speaker name X offset' })).toHaveValue('39')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Download front PNG/ }).click()
  expect((await download).suggestedFilename()).toMatch(/front.*\.png$/i)

  await expect(page.locator('.draft-status')).toContainText('Saved', { timeout: 5000 })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  await expect(page.locator('.format-card.selected')).toContainText('Speaker Badge', { timeout: 10000 })
  if (mobile) await page.getByRole('tab', { name: 'Preview' }).click()
  const restoredTarget = page.locator('.artboard-selection-target[data-field="speaker name"]')
  await restoredTarget.click()
  await expect(page.getByRole('spinbutton', { name: 'Speaker name X offset' })).toHaveValue('39')

  await testInfo.attach(`template-direct-manipulation-${mobile ? 'mobile' : 'desktop'}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(runtimeErrors).toEqual([])
})
