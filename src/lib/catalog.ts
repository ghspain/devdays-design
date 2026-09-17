import peopleCsv from '../../data/people.csv?raw'
import sponsorsCsv from '../../data/sponsors.csv?raw'
import presets from '../../data/presets.json'

export interface CatalogPerson {
  id: string
  name: string
  role: string
  avatarUrl: string
}

export interface CatalogSponsor {
  id: string
  name: string
  logoUrl: string
  website: string
}

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
  logoUrl: sponsor.logo_url,
  website: sponsor.website,
})).filter((sponsor) => sponsor.id && sponsor.name && sponsor.logoUrl)

export const eventPresets = presets as EventPreset[]
