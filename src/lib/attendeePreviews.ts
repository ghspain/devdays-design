import type { ValidatedAttendeeRow } from './attendeeValidation'

export const MAX_ATTENDEE_PREVIEWS = 5

export interface RepresentativeAttendee {
  row: ValidatedAttendeeRow
  reasons: string[]
}

/** Pick a bounded, deterministic set that shows both a typical and edge-case row. */
export function selectRepresentativeAttendees(rows: ValidatedAttendeeRow[]): RepresentativeAttendee[] {
  const eligible = rows.filter((row) => row.status !== 'error')
  const selected = new Map<number, RepresentativeAttendee>()
  const add = (row: ValidatedAttendeeRow | undefined, reason: string) => {
    if (!row) return
    const current = selected.get(row.sourceRowNumber)
    if (current) {
      if (!current.reasons.includes(reason)) current.reasons.push(reason)
    } else if (selected.size < MAX_ATTENDEE_PREVIEWS) {
      selected.set(row.sourceRowNumber, { row, reasons: [reason] })
    }
  }

  add(eligible[0], 'first selected row')
  add(eligible.reduce<ValidatedAttendeeRow | undefined>((longest, row) => {
    if (!longest) return row
    const length = row.attendee.name.length
    const longestLength = longest.attendee.name.length
    return length > longestLength || (length === longestLength && row.sourceRowNumber < longest.sourceRowNumber) ? row : longest
  }, undefined), 'longest name')

  const missingFields = [
    ['organization', 'missing organization'],
    ['role', 'missing role'],
    ['githubHandle', 'missing GitHub profile'],
  ] as const
  for (const [field, reason] of missingFields) {
    add(eligible.find(({ attendee }) => !attendee[field]?.trim()), reason)
  }

  return [...selected.values()]
}
