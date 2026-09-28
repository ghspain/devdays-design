import assert from 'node:assert/strict'
import test from 'node:test'
import { projectPeople } from '../../scripts/sync-people.mjs'

test('projects only approved public fields in stable local roster order', () => {
  const planning = [
    'person_id,name,github,linkedin,x,website,avatar_url,bio,professional_title,last_verified,email',
    'person-b,Beta,beta,https://linkedin.test/b,,https://b.test,,private bio,Engineer,2026-01-02,private@example.test',
    'person-a,Alpha,,,,,https://img.test/a,another private bio,,,',
  ].join('\n')
  const roster = 'person_id,name,role,avatar_url\nperson-a,Old Alpha,Legacy A,\nperson-b,Old Beta,Legacy B,\n'
  const first = projectPeople(planning, roster)
  const second = projectPeople(planning, roster)

  assert.equal(first, second)
  assert.equal(first, [
    'person_id,name,role,avatar_url,github,linkedin,x,website,professional_title,last_verified',
    'person-a,Alpha,Legacy A,https://img.test/a,,,,,,',
    'person-b,Beta,Legacy B,,beta,https://linkedin.test/b,,https://b.test,Engineer,2026-01-02',
    '',
  ].join('\n'))
  assert.doesNotMatch(first, /private bio|private@example\.test/)
})

test('rejects missing identities and duplicate Planning IDs', () => {
  assert.throws(() => projectPeople('name,github\nA,a', 'person_id,name,role\na,A,R'), /missing required columns: person_id/)
  assert.throws(() => projectPeople('person_id,name\na,A\na,Again', 'person_id,name,role\na,A,R'), /Duplicate Planning person_id/)
  assert.throws(() => projectPeople('person_id,name\na,A', 'person_id,name,role\nb,B,R'), /no person_id b/)
})

test('does not shift approved columns after an unescaped comma in Planning free text', () => {
  const warnings = []
  const planning = 'person_id,name,github,linkedin,x,website,avatar_url,bio,professional_title,last_verified\na,Alpha,,,,,avatar,unquoted,bio,Engineer,2026-01-02'
  const current = 'person_id,name,role,avatar_url\na,Old A,Legacy,old-avatar'
  const output = projectPeople(planning, current, { warn: (warning) => warnings.push(warning) })

  assert.match(output, /a,Old A,Legacy,old-avatar,,,,,,/)
  assert.deepEqual(warnings, ['Planning row for a has an inconsistent column count; retaining the local legacy name/avatar and leaving new profile fields empty.'])
})
