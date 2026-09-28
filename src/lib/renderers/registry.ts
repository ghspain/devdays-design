import { assetCatalog } from '../../domain/assets'
import type { AssetTemplateDefinition } from '../../domain/assets'
import type { BannerFormat, BannerState, ExportScale, FormatOption } from '../../types'
import type { RenderInfo } from '../validate'
import type { BadgeSubject } from '../../domain/badgeSubject'

export type AssetRenderer = (
  canvas: HTMLCanvasElement,
  state: BannerState,
  format: FormatOption,
  backgroundFailed: boolean,
  scale: ExportScale,
  renderInfo?: RenderInfo,
  badgeSubject?: BadgeSubject,
) => Promise<void>

export function resolveTemplateRenderer(template: AssetTemplateDefinition, renderers: Readonly<Record<string, AssetRenderer>>): AssetRenderer {
  const renderer = renderers[template.rendererId]
  if (!renderer) throw new Error(`No renderer registered for asset template "${template.id}"`)
  return renderer
}

export function resolveRenderer(format: BannerFormat, renderers: Readonly<Record<string, AssetRenderer>>): AssetRenderer {
  const template = assetCatalog.flatMap((asset) => asset.templates).find((item) => item.legacyFormat === format)
  if (!template) throw new Error(`No renderer registered for asset format "${format}"`)
  if (!renderers[template.rendererId]) throw new Error(`No renderer registered for asset format "${format}"`)
  return resolveTemplateRenderer(template, renderers)
}
