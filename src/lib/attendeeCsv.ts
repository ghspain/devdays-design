import { parse } from 'csv-parse/browser/esm/sync'

export interface AttendeeCsvDataset {
  headers: string[]
  rows: string[][]
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
