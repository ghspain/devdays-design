import { assetCatalog } from '../../domain/assets'
import type { BannerFormat, BannerState, ExportScale, FormatOption } from '../../types'
import type { RenderInfo } from '../validate'

export type AssetRenderer = (
  canvas: HTMLCanvasElement,
  state: BannerState,
  format: FormatOption,
  backgroundFailed: boolean,
  scale: ExportScale,
  renderInfo?: RenderInfo,
) => Promise<void>

export function resolveRenderer(format: BannerFormat, renderers: Readonly<Record<string, AssetRenderer>>): AssetRenderer {
  const template = assetCatalog.flatMap((asset) => asset.templates).find((item) => item.legacyFormat === format)
  const renderer = template && renderers[template.rendererId]
  if (!renderer) throw new Error(`No renderer registered for asset format "${format}"`)
  return renderer
}
