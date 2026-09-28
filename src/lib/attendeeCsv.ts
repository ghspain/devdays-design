import { parse } from 'csv-parse/browser/esm/sync'
import { attendeeBadgeFields, type AttendeeBadgeField, type AttendeeBadgeInput, type AttendeeCsvColumnMapping } from '../domain/attendee'

export interface AttendeeCsvDataset {
  headers: string[]
  rows: string[][]
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

/** Suggest only unique header-to-field matches; ambiguous columns remain unmapped. */
export function suggestAttendeeCsvMapping(headers: string[]): AttendeeCsvColumnMapping {
  const suggestions = headers.map((header) => {
    const normalized = normalizeHeader(header)
    return attendeeBadgeFields.filter((field) => (field.aliases as readonly string[]).includes(normalized)).map((field) => field.id)
  })
  const counts = new Map<AttendeeBadgeField, number>()
  for (const fields of suggestions) {
    if (fields.length === 1) counts.set(fields[0], (counts.get(fields[0]) ?? 0) + 1)
  }
  return Object.fromEntries(suggestions.map((fields, index) => [
    index,
    fields.length === 1 && counts.get(fields[0]) === 1 ? fields[0] : 'ignore',
  ])) as AttendeeCsvColumnMapping
}

export function getUnmappedRequiredAttendeeFields(mapping: AttendeeCsvColumnMapping): AttendeeBadgeField[] {
  return attendeeBadgeFields
    .filter((field) => field.required && !Object.values(mapping).includes(field.id))
    .map((field) => field.id)
}

export function getDuplicateAttendeeMappings(mapping: AttendeeCsvColumnMapping): AttendeeBadgeField[] {
  const fields = Object.values(mapping).filter((field): field is AttendeeBadgeField => field !== 'ignore')
  return [...new Set(fields.filter((field, index) => fields.indexOf(field) !== index))]
}

export function mapAttendeeCsvRows(dataset: AttendeeCsvDataset, mapping: AttendeeCsvColumnMapping): AttendeeBadgeInput[] {
  return dataset.rows.map((row) => {
    const values: Partial<Record<AttendeeBadgeField, string>> = {}
    for (const [columnIndex, field] of Object.entries(mapping)) {
      if (field !== 'ignore') values[field] = row[Number(columnIndex)]?.trim() ?? ''
    }
    return {
      name: values.name ?? '',
      ...(values.organization ? { organization: values.organization } : {}),
      ...(values.role ? { role: values.role } : {}),
      ...(values.githubHandle ? { githubHandle: values.githubHandle } : {}),
    }
  })
}

export function parseAttendeeCsv(source: string): AttendeeCsvDataset {
  const records = parse(source, {
    bom: true,
    skip_empty_lines: true,
  })
  const [rawHeaders, ...rows] = records
  const headers = rawHeaders?.map((header) => header.trim()) ?? []

  if (!headers.length || headers.every((header) => !header)) {
    throw new Error('CSV headers are required')
  }

  return { headers, rows }
}
