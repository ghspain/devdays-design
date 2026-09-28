import peopleCsv from '../../data/people.csv?raw'
import sponsorsCsv from '../../data/sponsors.csv?raw'
import participationsCsv from '../../data/participations.csv?raw'
import organizersCsv from '../../data/organizers.csv?raw'
import presets from '../../data/presets.json'
import { publicProfileHandle } from '../domain/publicHandle'

export interface CatalogPerson {
  id: string
  name: string
  role: string
  avatarUrl: string
}

export type PublicProfileKind = 'github' | 'linkedin' | 'x' | 'website'

export interface PublicProfileDestination {
  kind: PublicProfileKind
  url: string
}

export interface CatalogPublicProfile {
  personId: string
  name: string
  displayRole: string
  avatarUrl: string
  lastVerified: string
  destinations: PublicProfileDestination[]
}

export interface CatalogSpeaker extends CatalogPerson {
  speakerId: string
  eventId: string
  eventDate: string
  sessionTitle: string
  sessionTime: string
}

export interface CatalogOrganization {
  id: string
  name: string
  logoForLightBackgroundUrl: string
  logoForDarkBackgroundUrl: string
  logoShortForLightBackgroundUrl: string
  logoShortForDarkBackgroundUrl: string
  logoIconForLightBackgroundUrl: string
  logoIconForDarkBackgroundUrl: string
  website: string
}

export type CatalogSponsor = CatalogOrganization
export type CatalogOrganizer = CatalogOrganization

export interface EventPreset {
  id: string
  name: string
  seriesLabel: string
  edition: string
}

function parseCsv(source: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]
    if (character === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      row.push(cell.trim())
      cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  if (cell || row.length) {
    row.push(cell.trim())
    if (row.some(Boolean)) rows.push(row)
  }

  const [header, ...body] = rows
  if (!header) return []
  return body.map((values) =>
    Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])) as Record<string, string>,
  )
}

export const catalogPeople: CatalogPerson[] = parseCsv(peopleCsv).map((person) => ({
  id: person.person_id,
  name: person.name,
  role: person.role,
  avatarUrl: person.avatar_url,
}))

function normalizeProfileUrl(kind: PublicProfileKind, value: string): string | undefined {
  const raw = value.trim()
  if (!raw) return undefined

  if (kind === 'github' && !/^(https?:\/\/)?(www\.)?github\.com\//i.test(raw)) {
    const username = raw.replace(/^@/, '')
      return /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username) ? `https://github.com/${username.toLowerCase()}` : undefined
  }

  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    if (url.username || url.password) return undefined

    if (kind === 'github') {
      if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) return undefined
      const [username, ...rest] = url.pathname.split('/').filter(Boolean)
      if (!username || rest.length || !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username)) return undefined
      return `https://github.com/${username.toLowerCase()}`
    }
    if (kind === 'linkedin') {
      if (!['linkedin.com', 'www.linkedin.com'].includes(url.hostname.toLowerCase())) return undefined
      const path = url.pathname.replace(/\/+$/, '')
      if (!/^\/(in|company)\/[^/]+$/i.test(path)) return undefined
      return `https://www.linkedin.com${path}`
    }
    if (kind === 'x') {
      if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname.toLowerCase())) return undefined
      const [username, ...rest] = url.pathname.split('/').filter(Boolean)
      if (!username || rest.length || !/^[a-z\d_]{1,15}$/i.test(username)) return undefined
      return `https://x.com/${username.toLowerCase()}`
    }
    return url.href
  } catch {
    return undefined
  }
}

const publicProfiles = new Map<string, CatalogPublicProfile>(parseCsv(peopleCsv).map((person) => {
  const destinations = (['github', 'linkedin', 'x', 'website'] as const).flatMap((kind) => {
    const url = normalizeProfileUrl(kind, person[kind] ?? '')
    return url ? [{ kind, url }] : []
  })
  return [person.person_id, {
    personId: person.person_id,
    name: person.name,
    displayRole: person.professional_title || person.role,
    avatarUrl: person.avatar_url,
    lastVerified: person.last_verified,
    destinations,
  }]
}))

export function getCatalogPublicProfile(personId: string): CatalogPublicProfile | undefined {
  return publicProfiles.get(personId)
}

/** Badge-friendly handle from a canonical public profile; never infers private identity data. */
export function getCatalogPublicHandle(profile: CatalogPublicProfile | undefined): string | undefined {
  return profile ? publicProfileHandle(profile.destinations) : undefined
}

export const catalogSponsors: CatalogSponsor[] = parseCsv(sponsorsCsv).map((sponsor) => ({
  id: sponsor.sponsor_id,
  name: sponsor.name,
  logoForLightBackgroundUrl: sponsor.logo_for_light_bg_url,
  logoForDarkBackgroundUrl: sponsor.logo_for_dark_bg_url,
  logoShortForLightBackgroundUrl: sponsor.logo_short_for_light_bg_url,
  logoShortForDarkBackgroundUrl: sponsor.logo_short_for_dark_bg_url,
  logoIconForLightBackgroundUrl: sponsor.logo_icon_for_light_bg_url,
  logoIconForDarkBackgroundUrl: sponsor.logo_icon_for_dark_bg_url,
  website: sponsor.website,
})).filter((sponsor) => sponsor.id && sponsor.name && sponsor.logoForLightBackgroundUrl)

const peopleById = new Map(catalogPeople.map((person) => [person.id, person]))

export const catalogSpeakers: CatalogSpeaker[] = parseCsv(participationsCsv)
  .filter((participation) => participation.participation_type === 'speaker')
  .flatMap((participation) => {
    const person = peopleById.get(participation.person_id)
    if (!person) return []
    return [{
      ...person,
      speakerId: participation.participation_id,
      eventId: participation.event_id,
      eventDate: participation.event_date,
      sessionTitle: participation.session_title,
      sessionTime: participation.session_time,
    }]
  })

export const catalogOrganizers: CatalogOrganizer[] = parseCsv(organizersCsv).map((organizer) => ({
  id: organizer.organizer_id,
  name: organizer.name,
  logoForLightBackgroundUrl: organizer.logo_for_light_bg_url,
  logoForDarkBackgroundUrl: organizer.logo_for_dark_bg_url,
  logoShortForLightBackgroundUrl: organizer.logo_short_for_light_bg_url,
  logoShortForDarkBackgroundUrl: organizer.logo_short_for_dark_bg_url,
  logoIconForLightBackgroundUrl: organizer.logo_icon_for_light_bg_url,
  logoIconForDarkBackgroundUrl: organizer.logo_icon_for_dark_bg_url,
  website: organizer.website,
})).filter((organizer) => organizer.id && organizer.name && organizer.logoForLightBackgroundUrl)

export const eventPresets = presets as EventPreset[]
