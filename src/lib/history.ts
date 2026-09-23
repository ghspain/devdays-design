import { BANNER_HISTORY_STORAGE_KEY, DEFAULT_EVENT_THEME_ID, defaultColors, fixedEventTitle } from '../constants'
import type { BannerHistoryItem, BannerState, EventDetails } from '../types'
import { uid } from './format'

function normalizeEvent(event?: Partial<EventDetails>): EventDetails {
  return {
    title: event?.title ?? fixedEventTitle,
    edition: event?.edition ?? 'Professional',
    city: event?.city ?? '',
    dateTime: event?.dateTime ?? '',
    location: event?.location ?? '',
    organizerName: event?.organizerName ?? '',
    organizerLogoDataUrl: event?.organizerLogoDataUrl ?? '',
    includeSupportedBy: event?.includeSupportedBy ?? false,
    registrationEnabled: event?.registrationEnabled ?? true,
    registrationStyle: event?.registrationStyle ?? 'cta_url',
    registrationText: event?.registrationText ?? 'Register now',
    registrationUrl: event?.registrationUrl ?? 'gh.io/devdays',
  }
}

/** Fills any missing fields so restored and freshly built states always share one shape. */
export function normalizeState(
  input?: (Omit<Partial<BannerState>, 'event'> & { event?: Partial<EventDetails> }) | null,
): BannerState {
  return {
    format: input?.format ?? 'luma_cover',
    theme: input?.theme ?? DEFAULT_EVENT_THEME_ID,
    colors: input?.colors ?? defaultColors,
    event: normalizeEvent(input?.event),
    speakers: Array.isArray(input?.speakers) ? input.speakers : [],
    partners: Array.isArray(input?.partners) ? input.partners : [],
    export: {
      type: input?.export?.type ?? 'png',
      scale: input?.export?.scale ?? 2,
    },
  }
}

export function buildDefaultState(): BannerState {
  return normalizeState({
    format: 'luma_cover',
    theme: DEFAULT_EVENT_THEME_ID,
    colors: defaultColors,
    event: {
      title: fixedEventTitle,
      edition: 'Professional',
      city: 'Madrid',
      dateTime: 'Apr 15 • 7:00 PM',
      location: 'North Convention Center',
      organizerName: 'GitHub Community Brasil',
    },
    speakers: [
      {
        id: uid(),
        name: 'Speaker Name',
        role: 'Speaker Role',
      },
    ],
    partners: [],
    export: {
      type: 'png',
      scale: 2,
    },
  })
}

function isBannerHistoryItem(value: unknown): value is BannerHistoryItem {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.previewDataUrl === 'string' &&
    typeof candidate.state === 'object' &&
    candidate.state !== null
  )
}

export function readBannerHistory(): BannerHistoryItem[] {
  try {
    const raw = localStorage.getItem(BANNER_HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isBannerHistoryItem)
  } catch {
    return []
  }
}

export function writeBannerHistory(items: BannerHistoryItem[]) {
  localStorage.setItem(BANNER_HISTORY_STORAGE_KEY, JSON.stringify(items))
}
