export type BannerFormat =
  | 'speaker_square'
  | 'speaker_banner'
  | 'social_promo'
  | 'luma_cover'

export type ExportType = 'png' | 'jpg'
export type ExportScale = 1 | 2
export type SpeakersPerCard = 1 | 2
export type SpeakerBannerPairLayout = 'side_by_side' | 'stacked'

/** Identifies a bundle of colors and fixed brand text the renderer draws with.
 *  Not to be confused with `lib/catalog.ts`'s `EventPreset` (a saved event-data
 *  snapshot from the Planning catalogue) - this is the *visual* identity. */
export type EventThemeId = 'devdays' | 'community_meetup' | 'online_github'

export interface EventTheme {
  id: EventThemeId
  /** Shown in the theme picker. */
  name: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
  }
  /** Two-line fixed brand title drawn on the Speaker Banner / Social Promo formats. */
  brandTitleLine1: string
  brandTitleLine2: string
  /** Fallback event title used when the organizer hasn't entered one yet. */
  fixedEventTitle: string
  /** Fixed green label shared by the Luma cover and the Speaker Banner. */
  fixedGreenLabel: string
  lumaCityColor: string
  /** Text colors used on the light (lower) half of the speaker/social backgrounds. */
  lightAreaTitleColor: string
  lightAreaMutedColor: string
}

export interface Speaker {
  id: string
  /** Participation id from the Planning catalogue, used to dedupe additions. */
  catalogId?: string
  name: string
  role?: string
  photoDataUrl?: string
  talkTitle?: string
  talkTime?: string
}

export interface PartnerLogo {
  id: string
  imageDataUrl: string
  name?: string
}

export interface EventDetails {
  title: string
  edition: string
  city: string
  dateTime: string
  location: string
  organizerName: string
  organizerLogoDataUrl?: string
  includeSupportedBy: boolean
  registrationEnabled: boolean
  registrationStyle: 'cta_url' | 'url_only'
  registrationText: string
  registrationUrl: string
}

export interface BannerState {
  format: BannerFormat
  /** Which EventTheme supplied the current colors/labels. */
  theme: EventThemeId
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
  }
  event: EventDetails
  speakers: Speaker[]
  speakersPerCard: SpeakersPerCard
  speakerBannerPairLayout: SpeakerBannerPairLayout
  partners: PartnerLogo[]
  export: {
    type: ExportType
    scale: ExportScale
  }
}

export interface BannerHistoryItem {
  id: string
  createdAt: string
  state: BannerState
  previewDataUrl: string
}

export interface FormatOption {
  id: BannerFormat
  name: string
  width: number
  height: number
  channels?: string[]
  /** Short purpose/channel guidance shown beside the format name. */
  description?: string
}
