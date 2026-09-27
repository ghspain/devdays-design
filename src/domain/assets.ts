import type { BannerFormat, ExportScale, ExportType } from '../types'

export type AssetSide = 'front' | 'back'

export interface ExportProfile {
  readonly id: string
  readonly width: number
  readonly height: number
  readonly types: readonly ExportType[]
  readonly scales: readonly ExportScale[]
}

export interface AssetTemplateDefinition {
  /** Stable template identity; independent from its current UI/legacy format id. */
  readonly id: string
  readonly name: string
  readonly description: string
  readonly channels: readonly string[]
  readonly sides: readonly AssetSide[]
  readonly exportProfiles: readonly ExportProfile[]
  /** Adapter for persisted BannerState.format values used by existing renderers. */
  readonly legacyFormat?: BannerFormat
}

export interface AssetDefinition {
  /** Stable business identity shared by compatible templates. */
  readonly id: string
  readonly name: string
  readonly templates: readonly AssetTemplateDefinition[]
}

const imageTypes = ['png', 'jpg'] as const satisfies readonly ExportType[]
const imageScales = [1, 2] as const satisfies readonly ExportScale[]

/** Canonical domain metadata for the four production asset templates. */
export const assetCatalog: readonly AssetDefinition[] = [
  {
    id: 'event-promotion',
    name: 'Event formats',
    templates: [
      {
        id: 'luma-cover',
        legacyFormat: 'luma_cover',
        name: 'Luma Cover',
        description: 'Square cover image for Luma event pages',
        channels: ['Luma'],
        sides: ['front'],
        exportProfiles: [{ id: 'luma-square', width: 1000, height: 1000, types: imageTypes, scales: imageScales }],
      },
      {
        id: 'social-promo',
        legacyFormat: 'social_promo',
        name: 'Social Promo',
        description: 'Event promotion banner for social feeds',
        channels: ['Instagram', 'LinkedIn', 'X', 'Facebook', 'BlueSky', 'Threads'],
        sides: ['front'],
        exportProfiles: [{ id: 'social-portrait', width: 1080, height: 1350, types: imageTypes, scales: imageScales }],
      },
    ],
  },
  {
    id: 'speaker-promotion',
    name: 'Speaker formats',
    templates: [
      {
        id: 'speaker-profile',
        legacyFormat: 'speaker_square',
        name: 'Speaker Profile',
        description: 'Square profile banner for social media posts',
        channels: ['Instagram', 'LinkedIn', 'X', 'BlueSky'],
        sides: ['front'],
        exportProfiles: [{ id: 'speaker-square', width: 1080, height: 1080, types: imageTypes, scales: imageScales }],
      },
      {
        id: 'speaker-banner',
        legacyFormat: 'speaker_banner',
        name: 'Speaker Banner',
        description: 'Tall speaker banner with talk details',
        channels: ['Instagram', 'LinkedIn', 'X', 'Facebook', 'BlueSky', 'Threads'],
        sides: ['front'],
        exportProfiles: [{ id: 'speaker-portrait', width: 1080, height: 1350, types: imageTypes, scales: imageScales }],
      },
    ],
  },
]

/** The old banner format list remains a compatibility view, in its original export order. */
export const legacyFormatOrder = ['speaker_square', 'speaker_banner', 'social_promo', 'luma_cover'] as const
