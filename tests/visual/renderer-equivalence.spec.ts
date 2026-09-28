import { expect, test } from '@playwright/test'
import { EVENT_THEMES, formatOptions } from '../../src/constants'
import type { BannerState, FormatOption } from '../../src/types'
import type { RenderInfo } from '../../src/lib/validate'

type Renderer = (
  canvas: HTMLCanvasElement,
  state: BannerState,
  format: FormatOption,
  backgroundFailed: boolean,
  scale: 1,
  renderInfo?: RenderInfo,
) => Promise<void>

test('registered dispatch preserves legacy pixels and render metadata for every existing format and theme', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()
  const legacyFormats = formatOptions.filter(({ id }) => id !== 'speaker_badge')
  const results = await page.evaluate(async ({ formats, themes }) => {
    await document.fonts.ready
    const importModule = (path: string) => import(new URL(path, window.location.href).href) as Promise<Record<string, unknown>>
    const [bannerModule, legacyModule, historyModule, validationModule] = await Promise.all([
      importModule('src/lib/renderBanner.ts'),
      importModule('src/lib/renderers/legacySocial.ts'),
      importModule('src/lib/history.ts'),
      importModule('src/lib/validate.ts'),
    ])
    const renderBanner = bannerModule.renderBanner as Renderer
    const renderLegacy = legacyModule.renderLegacySocialAsset as Renderer
    const buildDefaultState = historyModule.buildDefaultState as () => BannerState
    const createRenderInfo = validationModule.createRenderInfo as () => RenderInfo
    const comparisons: { format: string; theme: string; pixelsEqual: boolean; metadataEqual: boolean }[] = []

    for (const format of formats) {
      for (const theme of themes) {
        const state = buildDefaultState()
        state.format = format.id
        state.theme = theme.id
        state.colors = { ...theme.colors }
        const routedCanvas = document.createElement('canvas')
        const legacyCanvas = document.createElement('canvas')
        const routedInfo = createRenderInfo()
        const legacyInfo = createRenderInfo()

        await renderBanner(routedCanvas, state, format, false, 1, routedInfo)
        await renderLegacy(legacyCanvas, state, format, false, 1, legacyInfo)

        const routedPixels = routedCanvas.getContext('2d')!.getImageData(0, 0, routedCanvas.width, routedCanvas.height).data
        const legacyPixels = legacyCanvas.getContext('2d')!.getImageData(0, 0, legacyCanvas.width, legacyCanvas.height).data
        const pixelsEqual = routedCanvas.width === legacyCanvas.width && routedCanvas.height === legacyCanvas.height &&
          routedPixels.length === legacyPixels.length && routedPixels.every((pixel, index) => pixel === legacyPixels[index])
        const metadataEqual = JSON.stringify(routedInfo) === JSON.stringify(legacyInfo)
        comparisons.push({ format: format.id, theme: theme.id, pixelsEqual, metadataEqual })
      }
    }
    return comparisons
  }, { formats: legacyFormats, themes: Object.values(EVENT_THEMES) })

  await testInfo.attach('renderer-equivalence-12-combinations.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  })
  expect(results).toHaveLength(12)
  expect(results.filter(({ pixelsEqual, metadataEqual }) => pixelsEqual && metadataEqual)).toHaveLength(12)
})
