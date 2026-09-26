import { expect, test, type Page } from '@playwright/test'

function primaryDownload(page: Page) {
  return page.locator('button.download-main')
}

function packDownload(page: Page) {
  return page.locator('button.pack-download')
}

test.beforeEach(async ({ page }) => {
  // Real themes never produce findings on first render (truncation depends on
  // font auto-scaling), so both warning tests use the injection hook for a
  // deterministic warning badge. 🧭 DECISION — injected findings instead of
  // natural warnings; revert by re-deriving warnings from real state.
  await page.addInitScript(() => {
    ;(window as unknown as { __devdaysInjectedFindings?: unknown[] }).__devdaysInjectedFindings = [
      { code: 'injected-warning', severity: 'warning', message: 'Injected warning for badge test' },
    ]
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
})

test('warning findings render an amber warning-icon badge and do not block the export CTA', async ({ page }) => {
  const badge = primaryDownload(page).locator('.download-badge')
  await expect(badge).toHaveClass(/warning/)
  await expect(badge.locator('svg.octicon-alert')).toHaveCount(1)

  // The badge count matches the number of findings reported by the app.
  const findingsCount = await page.evaluate(() => {
    const hook = (window as unknown as { __devdaysValidation?: { findings?: unknown[] } }).__devdaysValidation
    return hook?.findings?.length ?? 0
  })
  expect(await badge.innerText()).toContain(String(findingsCount))

  // Warnings must not look like a blocker: CTA stays enabled and primary.
  await expect(primaryDownload(page)).toBeEnabled()
  const ctaBackground = await primaryDownload(page).evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(ctaBackground).not.toBe('rgba(0, 0, 0, 0)')
})

test('warning badge uses soft amber chip styling so it does not read as a blocker', async ({ page }) => {
  const badge = primaryDownload(page).locator('.download-badge')
  await expect(badge).toHaveClass(/warning/)
  const style = await badge.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { background: cs.backgroundColor, shadow: cs.boxShadow, color: cs.color }
  })
  // 🧭 DECISION — audit P1: the old transparent outline rendered the count at
  // 1.79:1 against the button, so the badge is now a soft amber chip. It must
  // stay a chip: never the solid red error fill (a warning is not a blocker).
  expect(style.background).toBe('rgb(255, 248, 197)')
  expect(style.background).not.toBe('rgb(207, 34, 46)')
  expect(style.shadow).not.toBe('none')
  // Dark amber ink keeps the count readable on the chip (≥ 7:1).
  expect(style.color).toBe('rgb(90, 62, 0)')
})

test('error findings render a red X-icon badge on both download buttons', async ({ page }) => {
  // Inject error findings via the test hook (real themes never produce an
  // 'error' severity, so the app exposes __devdaysInjectedFindings).
  await page.addInitScript(() => {
    ;(window as unknown as { __devdaysInjectedFindings?: unknown[] }).__devdaysInjectedFindings = [
      { code: 'injected-error', severity: 'error', field: 'event title', message: 'Injected error for badge test' },
      { code: 'injected-warning', severity: 'warning', message: 'Injected warning for badge test' },
    ]
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  const primaryBadge = primaryDownload(page).locator('.download-badge')
  await expect(primaryBadge).toHaveClass(/error/)
  await expect(primaryBadge.locator('svg.octicon-x')).toHaveCount(1)
  const primaryStyle = await primaryBadge.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(primaryStyle).toBe('rgb(207, 34, 46)')

  const packBadge = packDownload(page).locator('.download-badge')
  await expect(packBadge).toHaveClass(/error/)
  await expect(packBadge.locator('svg.octicon-x')).toHaveCount(1)

  // Errors surface in the aria-label so they are announced to screen readers.
  await expect(primaryDownload(page)).toHaveAttribute('aria-label', /Findings:/)
})
