import type { AttendeeBadgeInput } from './attendee'
import { BADGE_ROLE_PRESENTATIONS, type BadgeRole } from './badgeRoles'
import type { Speaker } from '../types'

export interface BadgeSubject {
  kind: 'speaker' | 'attendee'
  role: BadgeRole
  name: string
  organization?: string
  title?: string
  networkingHandle?: string
  showNetworkingHandle: boolean
  photoDataUrl?: string
}

export function speakerBadgeSubject(speaker: Speaker | undefined, publicHandle?: string): BadgeSubject {
  const networkingHandle = speaker?.badgeHandle ?? publicHandle
  return {
    kind: 'speaker',
    role: 'speaker',
    name: speaker?.name ?? '',
    title: speaker?.role,
    networkingHandle,
    showNetworkingHandle: speaker?.badgeShowHandle ?? Boolean(networkingHandle),
    photoDataUrl: speaker?.photoDataUrl,
  }
}

export function attendeeBadgeSubject(attendee: AttendeeBadgeInput): BadgeSubject {
  return {
    kind: 'attendee',
    role: attendee.badgeRole ?? 'attendee',
    name: attendee.name,
    organization: attendee.organization,
    title: attendee.role,
    networkingHandle: attendee.githubHandle,
    showNetworkingHandle: Boolean(attendee.githubHandle) && BADGE_ROLE_PRESENTATIONS[attendee.badgeRole ?? 'attendee'].visibleFields.networkingHandle,
  }
}
