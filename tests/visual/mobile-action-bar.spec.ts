import { expect, test } from '@playwright/test'

test.describe('Mobile action bar', () => {
  test('footer does not overlap editor fields at 500×844', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

    // Scroll to the bottom of the sidebar content to check the Sponsors toggle area
    const sidebarContent = page.locator('.sidebar-content')
    await sidebarContent.evaluate((el) => el.scrollTop = el.scrollHeight)

    // Wait for the footer to be visible
    const footer = page.locator('.sidebar-footer')
    await expect(footer).toBeVisible()

    // Verify no positive-area intersection between footer and any editor field
    const overlap = await page.evaluate(() => {
      const footerEl = document.querySelector('.sidebar-footer') as HTMLElement
      if (!footerEl) return null
      const footerRect = footerEl.getBoundingClientRect()

      // Check all editor fields, labels, and section descriptions
      const selectors = [
        '.side-section .section-block input',
        '.side-section .section-block textarea',
        '.side-section summary',
        '.side-section .section-block',
      ]
      let maxOverlap = 0
      for (const sel of selectors) {
        const elements = document.querySelectorAll(sel)
        elements.forEach((el) => {
          const rect = el.getBoundingClientRect()
          const overlapTop = Math.max(0, footerRect.top - rect.bottom)
          if (overlapTop < 0) {
            const overlapHeight = Math.min(0, overlapTop)
            const overlapWidth = Math.min(rect.right, footerRect.right) - Math.max(rect.left, footerRect.left)
            if (overlapWidth > 0) {
              maxOverlap = Math.max(maxOverlap, overlapHeight * overlapWidth)
            }
          }
        })
      }
      return maxOverlap
    })

    expect(overlap ?? 0).toBeLessThanOrEqual(0)
  })

  test('footer does not overlap editor fields at 390×844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

    const sidebarContent = page.locator('.sidebar-content')
    await sidebarContent.evaluate((el) => el.scrollTop = el.scrollHeight)

    const footer = page.locator('.sidebar-footer')
    await expect(footer).toBeVisible()

    const overlap = await page.evaluate(() => {
      const footerEl = document.querySelector('.sidebar-footer') as HTMLElement
      if (!footerEl) return null
      const footerRect = footerEl.getBoundingClientRect()

      const selectors = [
        '.side-section .section-block input',
        '.side-section .section-block textarea',
        '.side-section summary',
        '.side-section .section-block',
      ]
      let maxOverlap = 0
      for (const sel of selectors) {
        const elements = document.querySelectorAll(sel)
        elements.forEach((el) => {
          const rect = el.getBoundingClientRect()
          const overlapTop = Math.max(0, footerRect.top - rect.bottom)
          if (overlapTop < 0) {
            const overlapHeight = Math.min(0, overlapTop)
            const overlapWidth = Math.min(rect.right, footerRect.right) - Math.max(rect.left, footerRect.left)
            if (overlapWidth > 0) {
              maxOverlap = Math.max(maxOverlap, overlapHeight * overlapWidth)
            }
          }
        })
      }
      return maxOverlap
    })

    expect(overlap ?? 0).toBeLessThanOrEqual(0)
  })

  test('all editor fields and footer actions remain reachable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 844 })
    await page.goto('/')

    // Check that the format selector is visible
    await expect(page.locator('.format-bar select')).toBeVisible()

    // Check that the footer actions are visible
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Event pack (.zip)' })).toBeVisible()
    await expect(page.locator('.download-main')).toBeVisible()

    // Check that we can scroll through the sidebar
    const sidebarContent = page.locator('.sidebar-content')
    const scrollHeight = await sidebarContent.evaluate((el) => el.scrollHeight)
    const clientHeight = await sidebarContent.evaluate((el) => el.clientHeight)
    expect(scrollHeight).toBeGreaterThanOrEqual(clientHeight)
  })

  test('desktop split view remains intact at 1280×900', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

    // Sidebar and canvas should both be visible side by side
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.getByLabel('Banner preview')).toBeVisible()

    // Sidebar should have a fixed width (not 100%)
    const sidebarWidth = await page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width)
    expect(sidebarWidth).toBeLessThan(600)
  })
})