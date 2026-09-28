import { expect, test } from '@playwright/test'
import { getDuplicateAttendeeMappings, getUnmappedRequiredAttendeeFields, mapAttendeeCsvRows, suggestAttendeeCsvMapping } from '../../src/lib/attendeeCsv'

test('attendee column suggestions handle GHSpain-like and renamed synthetic headers', () => {
  const ghspainHeaders = ['name', 'role', 'company_name', 'github_username', 'email']
  const alternateHeaders = ['full name', 'position', 'organization', 'username', 'registration code']
  expect(Object.values(suggestAttendeeCsvMapping(ghspainHeaders))).toEqual(['name', 'role', 'organization', 'githubHandle', 'ignore'])
  expect(Object.values(suggestAttendeeCsvMapping(alternateHeaders))).toEqual(['name', 'role', 'organization', 'githubHandle', 'ignore'])
})

test('required field gaps and conflicting targets are explicit; mapping creates the normalized badge contract', () => {
  const mapping = { 0: 'name', 1: 'organization', 2: 'role', 3: 'githubHandle', 4: 'ignore' } as const
  expect(getUnmappedRequiredAttendeeFields({ 0: 'ignore' })).toEqual(['name'])
  expect(getDuplicateAttendeeMappings({ 0: 'name', 1: 'name' })).toEqual(['name'])
  expect(getDuplicateAttendeeMappings(mapping)).toEqual([])
  expect(mapAttendeeCsvRows({
    headers: ['full name', 'company_name', 'position', 'github_username', 'private_note'],
    rows: [['Ada Lovelace', 'Analytical Engines', 'Speaker', '@ada', 'discard me']],
  }, mapping)).toEqual([{ name: 'Ada Lovelace', organization: 'Analytical Engines', role: 'Speaker', githubHandle: '@ada' }])
})

test('ambiguous duplicate headers are left unmapped until the organizer chooses one', () => {
  expect(Object.values(suggestAttendeeCsvMapping(['name', 'full_name']))).toEqual(['ignore', 'ignore'])
})
