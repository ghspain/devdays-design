import type { BannerFormat, EventTheme, EventThemeId, FormatOption } from './types'

export const formatOptions: FormatOption[] = [
  {
    id: 'speaker_square',
    name: 'Speaker Profile',
    width: 1080,
    height: 1080,
    channels: ['Instagram', 'LinkedIn', 'X', 'BlueSky'],
  },
  {
    id: 'speaker_banner',
    name: 'Speaker Banner',
    width: 1080,
    height: 1350,
    channels: ['Instagram', 'LinkedIn', 'X', 'Facebook', 'BlueSky', 'Threads'],
  },
  {
    id: 'social_promo',
    name: 'Social Promo',
    width: 1080,
    height: 1350,
    channels: ['Instagram', 'LinkedIn', 'X', 'Facebook', 'BlueSky', 'Threads'],
  },
  {
    id: 'luma_cover',
    name: 'Luma Cover',
    width: 1000,
    height: 1000,
    channels: ['Luma'],
  },
]

// Every visual theme the app can render. New themes are added here (and picked
// in the sidebar) without touching the renderer, which only reads through
// `getEventTheme`. `devdays` reproduces today's hardcoded look byte-for-byte.
// Not to be confused with `lib/catalog.ts`'s `eventPresets` (saved event-data
// snapshots from the Planning catalogue, e.g. a past edition's title/city/date).
export const EVENT_THEMES: Record<EventThemeId, EventTheme> = {
  devdays: {
    id: 'devdays',
    name: 'Dev Days',
    colors: {
      primary: '#f0f6fc',
      secondary: '#8b949e',
      accent: '#0abf40',
      background: '#0d1117',
    },
    brandTitleLine1: 'GitHub Copilot',
    brandTitleLine2: 'Dev Days',
    fixedEventTitle: 'Dev Days',
    fixedGreenLabel: 'DEV DAYS 2026',
    lumaCityColor: '#00d12f',
    lightAreaTitleColor: '#1f2328',
    lightAreaMutedColor: '#57606a',
  },
}

export const DEFAULT_EVENT_THEME_ID: EventThemeId = 'devdays'

/** Resolves a theme id to its data, falling back to the default theme for unknown ids
 *  (e.g. an older history entry saved before a theme was removed). */
export function getEventTheme(id: EventThemeId | undefined): EventTheme {
  return (id && EVENT_THEMES[id]) ?? EVENT_THEMES[DEFAULT_EVENT_THEME_ID]
}

// Backward-compatible aliases so existing consumers (history defaults, etc.) keep
// working unchanged; they all resolve to the default theme's values.
export const defaultColors = EVENT_THEMES[DEFAULT_EVENT_THEME_ID].colors
export const fixedEventTitle = EVENT_THEMES[DEFAULT_EVENT_THEME_ID].fixedEventTitle

export const BANNER_HISTORY_STORAGE_KEY = 'banner-history-v1'
export const MAX_HISTORY_ITEMS = 20
export const MAX_SPEAKERS = 12
export const REPOSITORY_URL = 'https://github.com/ghspain/devdays-design'
export const eventFormatIds: BannerFormat[] = ['luma_cover', 'social_promo']
export const speakerFormatIds: BannerFormat[] = ['speaker_square', 'speaker_banner']
export const filenamePrefixByFormat: Record<BannerFormat, string> = {
  luma_cover: 'luma',
  social_promo: 'social',
  speaker_banner: 'speaker',
  speaker_square: 'speaker',
}
