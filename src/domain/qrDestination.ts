import type { CatalogPublicProfile, PublicProfileKind } from '../lib/catalog'

export type QRDestination =
  | { kind: 'none' }
  | { kind: 'person-profile'; personId: string; profileKind: PublicProfileKind }
  | { kind: 'event-agenda'; url: string }
  | { kind: 'event-page'; url: string }
  | { kind: 'sponsor-website'; sponsorId: string }
  | { kind: 'custom-url'; url: string; label?: string }

export interface QRDestinationContext {
  getPublicProfile: (personId: string) => CatalogPublicProfile | undefined
  getSponsor: (sponsorId: string) => { name: string; website: string } | undefined
}

/** Runtime check for QR data restored from local draft storage. */
export function isQRDestination(value: unknown): value is QRDestination {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  switch (candidate.kind) {
    case 'none':
      return true
    case 'person-profile':
      return typeof candidate.personId === 'string' && ['github', 'linkedin', 'x', 'website'].includes(String(candidate.profileKind))
    case 'event-agenda':
    case 'event-page':
    case 'sponsor-website':
      return typeof (candidate.kind === 'sponsor-website' ? candidate.sponsorId : candidate.url) === 'string'
    case 'custom-url':
      return typeof candidate.url === 'string' && (candidate.label === undefined || typeof candidate.label === 'string')
    default:
      return false
  }
}

export type QRDestinationResolution =
  | { status: 'none' }
  | { status: 'resolved'; content: string; label?: string }
  | { status: 'invalid'; reason: 'unavailable' | 'invalid-url' | 'unsupported-scheme' }

function normalizeUrl(value: string): { url: string } | { reason: 'invalid-url' | 'unsupported-scheme' } {
  const raw = value.trim()
  if (!raw) return { reason: 'invalid-url' }

  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { reason: 'unsupported-scheme' }
    if (!url.hostname || url.username || url.password) return { reason: 'invalid-url' }
    return { url: url.href }
  } catch {
    return { reason: 'invalid-url' }
  }
}

function resolveUrl(value: string, label?: string): QRDestinationResolution {
  const normalized = normalizeUrl(value)
  if ('reason' in normalized) return { status: 'invalid', reason: normalized.reason }
  return { status: 'resolved', content: normalized.url, ...(label ? { label } : {}) }
}

/** Resolve reusable QR state to deterministic content without coupling it to a renderer or asset. */
export function resolveQRDestination(
  destination: QRDestination,
  context: QRDestinationContext,
): QRDestinationResolution {
  switch (destination.kind) {
    case 'none':
      return { status: 'none' }
    case 'person-profile': {
      const profile = context.getPublicProfile(destination.personId)
      const match = profile?.destinations.find(({ kind }) => kind === destination.profileKind)
      if (!profile || !match) return { status: 'invalid', reason: 'unavailable' }
      const platformLabel = { github: 'GitHub', linkedin: 'LinkedIn', x: 'X', website: 'Website' }[destination.profileKind]
      const label = `${platformLabel} · ${profile.name}`
      return resolveUrl(match.url, label)
    }
    case 'event-agenda':
      return resolveUrl(destination.url, 'Event agenda')
    case 'event-page':
      return resolveUrl(destination.url, 'Event page')
    case 'sponsor-website': {
      const sponsor = context.getSponsor(destination.sponsorId)
      if (!sponsor) return { status: 'invalid', reason: 'unavailable' }
      return resolveUrl(sponsor.website, `${sponsor.name} website`)
    }
    case 'custom-url':
      return resolveUrl(destination.url, destination.label?.trim() || undefined)
    default:
      return { status: 'invalid', reason: 'unavailable' }
  }
}
