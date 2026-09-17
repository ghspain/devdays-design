import peopleCsv from '../../data/people.csv?raw'
import sponsorsCsv from '../../data/sponsors.csv?raw'
import participationsCsv from '../../data/participations.csv?raw'
import organizersCsv from '../../data/organizers.csv?raw'
import presets from '../../data/presets.json'

export interface CatalogPerson {
  id: string
  name: string
  role: string
  avatarUrl: string
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
  website: string
}

export type CatalogSponsor = CatalogOrganization
export type CatalogOrganizer = CatalogOrganization

export interface EventPreset {
  id: string
  name: string
  seriesLabel: string
  edition: string
  format: string
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

export const catalogSponsors: CatalogSponsor[] = parseCsv(sponsorsCsv).map((sponsor) => ({
  id: sponsor.sponsor_id,
  name: sponsor.name,
  logoForLightBackgroundUrl: sponsor.logo_for_light_bg_url,
  logoForDarkBackgroundUrl: sponsor.logo_for_dark_bg_url,
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
  website: organizer.website,
})).filter((organizer) => organizer.id && organizer.name && organizer.logoForLightBackgroundUrl)

export const eventPresets = presets as EventPreset[]
