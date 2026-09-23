import { expect, test } from '@playwright/test'

// Phase 1 (#63, epic #62): on mobile the sidebar footer is `position: sticky;
// bottom: 0` so export actions stay reachable while scrolling a long form.
// A sticky-bottom bar transiently covering content while the user actively
// scrolls past it is expected/inherent to this pattern (see backlog #65 for
// the larger mobile-flow rework) - that is NOT what this phase fixes.
//
// What *is* a real, deterministic defect: at the natural resting position
// once the user finishes scrolling to the end of the sidebar, the last real
// content of `.validation-panel` (e.g. "All checks passed") cleared the
// footer by a razor-thin, fragile margin (~9px, live-measured) with no
// reserved space - one extra warning line or a slightly larger font would
// have pushed it back under the bar. `.validation-panel` now reserves an
// 8rem bottom clearance so this margin is robust.

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
})

test('mobile: validation panel content clears the sticky footer with a safe margin at rest', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  // Open every collapsible section so the sidebar is at its tallest,
  // reproducing the worst-case scroll depth from the critique.
  const sections = page.locator('.side-section:not([open]) > summary')
  const sectionCount = await sections.count()
  for (let i = 0; i < sectionCount; i += 1) {
    await sections.nth(i).click()
  }

  // Scroll to the true end of the page - the resting position a user lands
  // on once done reviewing the form, not a mid-scroll snapshot (a
  // sticky-bottom bar necessarily passes over content transiently while
  // actively scrolling; that is expected and out of scope here).
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(150)

  const footerTop = await page.locator('.sidebar-footer').evaluate((el) => el.getBoundingClientRect().top)

  const lastLineBottom = await page.locator('.validation-panel').evaluate((el) => {
    const lines = el.querySelectorAll(':scope > *')
    const last = lines[lines.length - 1] ?? el
    return last.getBoundingClientRect().bottom
  })

  // A comfortable safety margin, not a hair's breadth: locks in the
  // reserved clearance rather than an accidental few-pixel gap.
  expect(footerTop - lastLineBottom).toBeGreaterThanOrEqual(60)
})

test('desktop sidebar footer keeps its non-sticky layout unaffected', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })

  const footerPosition = await page
    .locator('.sidebar-footer')
    .evaluate((el) => getComputedStyle(el).position)
  expect(footerPosition).not.toBe('sticky')
})
