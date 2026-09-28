import type { BannerState, ExportScale, FormatOption } from '../types'
import type { RenderInfo } from './validate'
import { renderLegacySocialAsset } from './renderers/legacySocial'
import { renderSpeakerBadge } from './renderers/speakerBadge'
import { resolveRenderer } from './renderers/registry'

const renderers = { 'legacy-social': renderLegacySocialAsset, 'speaker-badge': renderSpeakerBadge }

export async function renderBanner(
  canvas: HTMLCanvasElement,
  state: BannerState,
  format: FormatOption,
  backgroundFailed: boolean,
  scale: ExportScale,
  renderInfo?: RenderInfo,
) {
  return resolveRenderer(format.id, renderers)(canvas, state, format, backgroundFailed, scale, renderInfo)
}
