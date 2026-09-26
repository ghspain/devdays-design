import { expect, test } from '@playwright/test'
import { openSection, selectFormat, showPreviewForViewport } from './helpers'

// Phase 4 (#43): Organizer, Sponsors, top bar, stage toolbar and the history
// drawer are Primer controls (Select/FormControl, Button, IconButton,
// ToggleSwitch), and the stylesheet no longer carries the hand-rolled
// component CSS that Primer now owns.

const tinyLogo =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function historyItem() {
  return {
    id: `h-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    previewDataUrl: tinyLogo,
    state: {
      format: 'speaker_square',
      speakers: [],
      partners: [],
      event: { includeSupportedBy: true },
    },
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  // speaker_banner shows both the Organizer and the Sponsors sections.
  await selectFormat(page, 'speaker_banner')
})

test('organizer catalogue uses a Primer Select with a FormControl label', async ({ page }) => {
  await openSection(page, 'section-organizer')
  const select = page.getByLabel('Select organizer')
  await expect(select).toHaveAttribute('data-component', 'Select')
  await expect(select).toHaveValue('')

  const apply = page.getByRole('button', { name: 'Use selected organizer' })
  await expect(apply).toHaveClass(/prc-Button/)
  await expect(apply).toBeDisabled()
  await select.selectOption('ghspain')
  await expect(apply).toBeEnabled()
  await apply.click()
  // After applying, the logo upload stays a native file input inside a labelled FormControl.
  const logo = page.getByLabel('Or upload a logo')
  await expect(logo).toHaveAttribute('type', 'file')
  await expect(logo).not.toHaveAttribute('data-component')
})

test('sponsor catalogue, add/remove flow and ToggleSwitch are accessible', async ({ page }) => {
  await openSection(page, 'section-partners')
  const toggle = page.getByRole('button', { name: /include partner logos/i })
  const toggleRow = page.locator('#section-partners .resolution-toggle')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(toggleRow).not.toContainText(/\b(On|Off)\b/)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(toggleRow).not.toContainText(/\b(On|Off)\b/)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  const select = page.getByLabel('Add from sponsor or collaborator catalogue')
  await expect(select).toHaveAttribute('data-component', 'Select')

  const add = page.getByRole('button', { name: 'Add selected sponsor' })
  await expect(add).toHaveClass(/prc-Button/)
  await expect(add).toBeDisabled()
  await select.selectOption('celonis')
  await expect(add).toBeEnabled()
  await add.click()

  const tile = page.locator('.logo-tile').first()
  await expect(tile).toBeVisible()
  const remove = tile.getByRole('button', { name: 'Remove' })
  await expect(remove).toHaveClass(/prc-Button/)
  await remove.click()
  await expect(page.locator('.logo-tile')).toHaveCount(0)

  await expect(page.getByLabel('Add logo')).toHaveAttribute('type', 'file')
})

test('top bar and sidebar controls are IconButtons with stable aria-labels', async ({ page }) => {
  const repo = page.getByRole('link', { name: 'View the project repository on GitHub' })
  await expect(repo).toHaveAttribute('data-component', 'IconButton')
  await expect(repo).toHaveAttribute('href', /github\.com/)

  const historyBtn = page.getByRole('button', { name: 'Toggle previous banners' })
  await expect(historyBtn).toHaveAttribute('data-component', 'IconButton')
  await expect(historyBtn).toHaveAttribute('aria-pressed', 'false')

  const collapse = page.getByRole('button', { name: 'Collapse panel' })
  await expect(collapse).toHaveAttribute('data-component', 'IconButton')
  await expect(collapse).toHaveAttribute('aria-expanded', 'true')
  const sectionsToggle = page.locator('.sections-toggle')
  const validationPanel = page.locator('.validation-panel')
  await expect(sectionsToggle).toBeVisible()
  await expect(validationPanel).toBeVisible()
  await collapse.click()
  await expect(page.locator('.sidebar.collapsed')).toBeVisible()
  await expect(sectionsToggle).toBeHidden()
  await expect(validationPanel).toBeHidden()
  const hasHorizontalOverflow = await page
    .locator('.sidebar.collapsed')
    .evaluate((sidebar) => sidebar.scrollWidth > sidebar.clientWidth)
  expect(hasHorizontalOverflow).toBe(false)
  const expand = page.getByRole('button', { name: 'Expand panel' })
  await expect(expand).toHaveAttribute('aria-expanded', 'false')
  await expand.click()
  await expect(page.locator('.sidebar.collapsed')).toHaveCount(0)
  await expect(sectionsToggle).toBeVisible()
  await expect(validationPanel).toBeVisible()
})

test('stage toolbar buttons are IconButtons readable over the dark stage', async ({ page }) => {
  await showPreviewForViewport(page)
  const toolbar = page.getByRole('toolbar', { name: 'Canvas tools' })
  await expect(toolbar).toBeVisible()
  for (const name of ['Zoom in', 'Zoom out', 'Fit to screen']) {
    await expect(toolbar.getByRole('button', { name })).toHaveAttribute('data-component', 'IconButton')
  }
  // #78: the toolbar no longer carries a Download button.
  await expect(toolbar.getByRole('button', { name: 'Download' })).toHaveCount(0)
  // .stage-icon-btn in App.css inverts the icon colour for the dark canvas surface.
  const color = await toolbar.getByRole('button', { name: 'Zoom in' }).evaluate((el) => getComputedStyle(el).color)
  expect(color).toBe('rgb(230, 237, 243)')
})

test('history drawer uses Primer Buttons and an IconButton to close', async ({ page }) => {
  await page.addInitScript((payload) => window.localStorage.setItem('banner-history-v1', JSON.stringify(payload)), [historyItem()])
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  await page.getByRole('button', { name: 'Toggle previous banners' }).click()
  const drawer = page.locator('.history-drawer')
  await expect(drawer).toBeVisible()

  const clear = drawer.getByRole('button', { name: 'Clear all' })
  await expect(clear).toHaveClass(/prc-Button/)
  await expect(drawer.getByRole('button', { name: 'Open' })).toHaveClass(/prc-Button/)
  await expect(drawer.getByRole('button', { name: 'Delete' })).toHaveClass(/prc-Button/)

  const close = drawer.getByRole('button', { name: 'Close previous banners' })
  await expect(close).toHaveAttribute('data-component', 'IconButton')
  await close.click()
  await expect(drawer).toBeHidden()

  // Re-open and restore through the Primer "Open" Button.
  await page.getByRole('button', { name: 'Toggle previous banners' }).click()
  await drawer.getByRole('button', { name: 'Open' }).click()
  await expect(drawer).toBeHidden()
})

test('orphaned component CSS and tokens are gone while .stage keeps dark tokens', async ({ page }) => {
  const removed = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    return {
      selectors: document.querySelectorAll('.icon-btn, .topbar-history-btn, .switch, .secondary-button').length,
      tokens: ['--app-switch-track', '--app-switch-thumb', '--app-button-bg', '--app-download-bg'].map((token) =>
        root.getPropertyValue(token).trim(),
      ),
    }
  })
  expect(removed.selectors).toBe(0)
  for (const token of removed.tokens) {
    expect(token).toBe('')
  }
  // The stage still re-declares its own dark palette for the canvas surface.
  const stageHeaderBg = await page.locator('.stage').evaluate((el) => getComputedStyle(el).getPropertyValue('--app-header-bg').trim())
  expect(stageHeaderBg).toBe('rgba(13, 17, 23, 0.92)')
})
