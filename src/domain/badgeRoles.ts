export type BadgeRole = 'attendee' | 'speaker' | 'organizer' | 'staff' | 'volunteer' | 'sponsor'

export interface BadgeRolePresentation {
  label: string
  labelStyle: 'text' | 'chip'
  accent?: string
  ink?: string
  qrDefault: 'person-profile' | 'event-page' | 'sponsor-website'
  visibleFields: {
    organization: boolean
    title: boolean
    networkingHandle: boolean
  }
}

const darkInk = '#0D1117'

export const BADGE_ROLE_PRESENTATIONS: Record<BadgeRole, BadgeRolePresentation> = {
  speaker: {
    label: 'SPEAKER',
    labelStyle: 'text',
    qrDefault: 'person-profile',
    visibleFields: { organization: false, title: true, networkingHandle: true },
  },
  attendee: {
    label: 'ATTENDEE',
    labelStyle: 'chip',
    accent: '#9EECFF',
    ink: darkInk,
    qrDefault: 'event-page',
    visibleFields: { organization: true, title: true, networkingHandle: true },
  },
  organizer: {
    label: 'ORGANIZER',
    labelStyle: 'chip',
    accent: '#5EEC83',
    ink: darkInk,
    qrDefault: 'event-page',
    visibleFields: { organization: true, title: true, networkingHandle: true },
  },
  staff: {
    label: 'STAFF',
    labelStyle: 'chip',
    accent: '#3194FF',
    ink: darkInk,
    qrDefault: 'event-page',
    visibleFields: { organization: true, title: false, networkingHandle: false },
  },
  volunteer: {
    label: 'VOLUNTEER',
    labelStyle: 'chip',
    accent: '#D3FA36',
    ink: darkInk,
    qrDefault: 'event-page',
    visibleFields: { organization: false, title: false, networkingHandle: false },
  },
  sponsor: {
    label: 'SPONSOR / PARTNER',
    labelStyle: 'chip',
    accent: '#B870FF',
    ink: darkInk,
    qrDefault: 'sponsor-website',
    visibleFields: { organization: true, title: false, networkingHandle: true },
  },
}
