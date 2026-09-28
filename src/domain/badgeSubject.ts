import type { AttendeeBadgeInput } from './attendee'
import type { Speaker } from '../types'

export interface BadgeSubject {
  kind: 'speaker' | 'attendee'
  name: string
  roleMarker: string
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
    name: speaker?.name ?? '',
    roleMarker: 'SPEAKER',
    title: speaker?.role,
    networkingHandle,
    showNetworkingHandle: speaker?.badgeShowHandle ?? Boolean(networkingHandle),
    photoDataUrl: speaker?.photoDataUrl,
  }
}

export function attendeeBadgeSubject(attendee: AttendeeBadgeInput): BadgeSubject {
  return {
    kind: 'attendee',
    name: attendee.name,
    roleMarker: 'ATTENDEE',
    organization: attendee.organization,
    title: attendee.role,
    networkingHandle: attendee.githubHandle,
    showNetworkingHandle: Boolean(attendee.githubHandle),
  }
}
