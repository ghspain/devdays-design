import type { QRDestination, QRDestinationResolution } from '../domain/qrDestination'
import type { CatalogPublicProfile, CatalogSponsor, PublicProfileKind } from './catalog'

export function defaultQRDestination(
  kind: QRDestination['kind'],
  profiles: readonly CatalogPublicProfile[],
  sponsors: readonly CatalogSponsor[],
  allowNoneFallback = false,
): QRDestination {
  if (kind === 'none') return { kind: 'none' }
  if (kind === 'person-profile') {
    const priorities: PublicProfileKind[] = ['github', 'website', 'linkedin', 'x']
    const match = priorities.flatMap((profileKind) => profiles
      .filter(({ destinations }) => destinations.some((destination) => destination.kind === profileKind))
      .map((profile) => ({ profile, profileKind })))[0]
    return match
      ? { kind, personId: match.profile.personId, profileKind: match.profileKind }
      : allowNoneFallback ? { kind: 'none' } : { kind, personId: '', profileKind: 'github' }
  }
  if (kind === 'event-agenda' || kind === 'event-page') return { kind, url: '' }
  if (kind === 'sponsor-website') return { kind, sponsorId: sponsors[0]?.id ?? '' }
  return { kind, url: '' }
}

export function qrDestinationErrorMessage(
  destination: QRDestination,
  resolution: QRDestinationResolution,
  allowNone: boolean,
): string | undefined {
  if (destination.kind === 'none') return allowNone ? undefined : 'Choose a QR destination.'
  if (resolution.status !== 'invalid') return undefined
  if (resolution.reason === 'unavailable') return 'This destination is no longer available. Choose another destination.'
  if (resolution.reason === 'unsupported-scheme') return 'Use an HTTP or HTTPS URL.'
  return 'Enter a valid HTTP or HTTPS URL.'
}

export function getQRDestinationControlId(destination: QRDestination): string {
  if (destination.kind === 'person-profile') return 'qr-person-profile'
  if (destination.kind === 'custom-url' || destination.kind === 'event-agenda' || destination.kind === 'event-page') return 'qr-destination-url'
  if (destination.kind === 'sponsor-website') return 'qr-sponsor'
  return 'qr-destination-type'
}
