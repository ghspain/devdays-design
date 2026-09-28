import { BADGE_ROLE_PRESENTATIONS, type BadgeRole } from '../domain/badgeRoles'
import type { AttendeeBadgeInput } from '../domain/attendee'
import { resolveQRDestination, type QRDestination, type QRDestinationContext, type QRDestinationResolution } from '../domain/qrDestination'
import type { CatalogPublicProfile, CatalogSponsor } from './catalog'
import { defaultQRDestination } from './qrDestinationControls'

export interface BadgeRoleQRResult {
  destination: QRDestination
  resolution: QRDestinationResolution
  source: 'role-default' | 'batch-rule' | 'row-override'
  warning?: string
}

function resolveOrNone(
  destination: QRDestination,
  context: QRDestinationContext,
  source: BadgeRoleQRResult['source'],
): BadgeRoleQRResult {
  const resolution = resolveQRDestination(destination, context)
  if (resolution.status !== 'invalid') return { destination, resolution, source }
  return {
    destination: { kind: 'none' },
    resolution: { status: 'none' },
    source,
    warning: 'This QR destination is unavailable or invalid; no QR will be generated.',
  }
}

function matchSponsor(organization: string | undefined, sponsors: readonly CatalogSponsor[]) {
  const normalize = (value: string) => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
  const name = organization?.trim()
  return name ? sponsors.find((sponsor) => normalize(sponsor.name) === normalize(name)) : undefined
}

/** Apply row and batch overrides before resolving a role's safe public-data default. */
export function resolveBadgeRoleQR(
  role: BadgeRole,
  attendee: Pick<AttendeeBadgeInput, 'organization' | 'personId'>,
  context: QRDestinationContext & {
    profiles: readonly CatalogPublicProfile[]
    sponsors: readonly CatalogSponsor[]
    eventPageUrl: string
  },
  batchDestination?: QRDestination,
  rowDestination?: QRDestination,
): BadgeRoleQRResult {
  if (rowDestination) return resolveOrNone(rowDestination, context, 'row-override')
  if (batchDestination) return resolveOrNone(batchDestination, context, 'batch-rule')

  const defaultKind = BADGE_ROLE_PRESENTATIONS[role].qrDefault
  if (defaultKind === 'person-profile') {
    const profile = context.profiles.find(({ personId }) => personId === attendee.personId)
    const destination = defaultQRDestination(defaultKind, profile ? [profile] : [], [], true)
    if (destination.kind === 'none') {
      return { destination, resolution: { status: 'none' }, source: 'role-default', warning: 'No public profile is linked to this row; choose a QR destination or leave it blank.' }
    }
    return resolveOrNone(destination, context, 'role-default')
  }

  if (defaultKind === 'sponsor-website') {
    const sponsor = matchSponsor(attendee.organization, context.sponsors)
    if (!sponsor?.website) {
      return { destination: { kind: 'none' }, resolution: { status: 'none' }, source: 'role-default', warning: 'No matching public sponsor website was found; choose a QR destination or leave it blank.' }
    }
    return resolveOrNone({ kind: 'sponsor-website', sponsorId: sponsor.id }, context, 'role-default')
  }

  if (!context.eventPageUrl.trim()) {
    return { destination: { kind: 'none' }, resolution: { status: 'none' }, source: 'role-default', warning: 'No event page URL is available; choose a QR destination or leave it blank.' }
  }
  return resolveOrNone({ kind: 'event-page', url: context.eventPageUrl }, context, 'role-default')
}
