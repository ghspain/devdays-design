import { BANNER_HISTORY_STORAGE_KEY, DEFAULT_EVENT_THEME_ID, defaultColors, fixedEventTitle } from '../constants'
import type { BannerHistoryItem, BannerState, EventDetails } from '../types'
import { uid } from './format'
import { isQRDestination } from '../domain/qrDestination'
import { stateForSide } from '../domain/assetSides'
import { constrainSpeakerNameOffset } from '../domain/templateManipulation'

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

function normalizeSideStates(value: unknown): BannerState['sideStates'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const source = value as Record<string, unknown>
  const result: NonNullable<BannerState['sideStates']> = {}
  for (const side of ['front', 'back'] as const) {
    const sideState = source[side]
    if (!sideState || typeof sideState !== 'object' || Array.isArray(sideState)) continue
    const candidate = sideState as Record<string, unknown>
    const elementOffsets = normalizeElementOffsets(candidate.elementOffsets)
    result[side] = {
      ...(Array.isArray(candidate.speakers) ? { speakers: candidate.speakers as BannerState['speakers'] } : {}),
      ...(Array.isArray(candidate.partners) ? { partners: candidate.partners as BannerState['partners'] } : {}),
      ...(candidate.qrDestination === null ? { qrDestination: null } : isQRDestination(candidate.qrDestination) ? { qrDestination: candidate.qrDestination } : {}),
      ...(candidate.qrReadableText === null ? { qrReadableText: null } : typeof candidate.qrReadableText === 'boolean' ? { qrReadableText: candidate.qrReadableText } : {}),
      ...(elementOffsets ? { elementOffsets } : {}),
    }
  }
  return Object.keys(result).length ? result : undefined
}

function normalizeElementOffsets(value: unknown): BannerState['elementOffsets'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const result: NonNullable<BannerState['elementOffsets']> = {}
  for (const [id, offset] of Object.entries(value)) {
    if (!offset || typeof offset !== 'object' || Array.isArray(offset)) continue
    const candidate = offset as Record<string, unknown>
    if (typeof candidate.x === 'number' && Number.isFinite(candidate.x) && typeof candidate.y === 'number' && Number.isFinite(candidate.y)) {
      result[id] = id === 'speaker-name'
        ? constrainSpeakerNameOffset({ x: candidate.x, y: candidate.y })
        : { x: candidate.x, y: candidate.y }
    }
  }
  return Object.keys(result).length ? result : undefined
}

/** Fills any missing fields so restored and freshly built states always share one shape. */
export function normalizeState(
  input?: (Omit<Partial<BannerState>, 'event'> & { event?: Partial<EventDetails> }) | null,
): BannerState {
  const sideStates = normalizeSideStates(input?.sideStates)
  const elementOffsets = normalizeElementOffsets(input?.elementOffsets)
  const normalized: BannerState = {
    ...(input?.activeSide === 'back' ? { activeSide: 'back' as const } : { activeSide: 'front' as const }),
    ...(sideStates ? { sideStates } : {}),
    ...(elementOffsets ? { elementOffsets } : {}),
    format: input?.format ?? 'luma_cover',
    theme: input?.theme ?? DEFAULT_EVENT_THEME_ID,
    colors: input?.colors ?? defaultColors,
    event: normalizeEvent(input?.event),
    speakers: Array.isArray(input?.speakers) ? input.speakers : [],
    speakersPerCard: input?.speakersPerCard === 2 ? 2 : 1,
    speakerBannerPairLayout: input?.speakerBannerPairLayout === 'stacked' ? 'stacked' : 'side_by_side',
    partners: Array.isArray(input?.partners) ? input.partners : [],
    ...(isQRDestination(input?.qrDestination) ? { qrDestination: input.qrDestination } : {}),
    ...(typeof input?.qrReadableText === 'boolean' ? { qrReadableText: input.qrReadableText } : {}),
    export: {
      type: input?.export?.type ?? 'png',
      scale: input?.export?.scale ?? 2,
    },
  }
  return stateForSide(normalized)
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
    const entries = Array.isArray(parsed)
      ? parsed // v0: the original unversioned localStorage array.
      : parsed && typeof parsed === 'object' && (parsed as { version?: unknown }).version === 1
        ? (parsed as { entries?: unknown }).entries
        : null
    if (!Array.isArray(entries)) return []
    return entries.filter(isBannerHistoryItem)
  } catch {
    return []
  }
}

export function writeBannerHistory(items: BannerHistoryItem[]) {
  localStorage.setItem(BANNER_HISTORY_STORAGE_KEY, JSON.stringify({ version: 1, entries: items }))
}
