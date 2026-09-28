import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fields = ['person_id', 'name', 'role', 'avatar_url', 'github', 'linkedin', 'x', 'website', 'professional_title', 'last_verified']
const sourceFields = fields.filter((field) => field !== 'role')

function parseRows(csv) {
  const [rawHeaders = [], ...values] = parse(csv, {
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })
  const headers = rawHeaders.map((header) => String(header).trim())
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column headers')
  const rows = values.map((cells) => ({
    values: Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])),
    fieldCount: cells.length,
  }))
  return { rows, headers }
}

export function projectPeople(planningCsv, currentCsv, { warn = () => undefined } = {}) {
  const planning = parseRows(planningCsv)
  const current = parseRows(currentCsv)
  const requiredHeaders = ['person_id', 'name']
  const missingHeaders = requiredHeaders.filter((header) => !planning.headers.includes(header))
  if (missingHeaders.length) throw new Error(`Planning CSV is missing required columns: ${missingHeaders.join(', ')}`)

  const byId = new Map()
  for (const row of planning.rows) {
    const personId = row.values.person_id
    if (!personId) continue
    if (byId.has(personId)) throw new Error(`Duplicate Planning person_id: ${personId}`)
    byId.set(personId, row)
  }

  const seen = new Set()
  const projected = current.rows.map(({ values: person }) => {
    if (!person.person_id || seen.has(person.person_id)) throw new Error(`Invalid or duplicate local person_id: ${person.person_id || '(empty)'}`)
    seen.add(person.person_id)
    const sourceRow = byId.get(person.person_id)
    if (!sourceRow) throw new Error(`Planning has no person_id ${person.person_id}; refusing to remove it from the local catalogue`)
    if (sourceRow.fieldCount > planning.headers.length) {
      warn(`Planning row for ${person.person_id} has an inconsistent column count; retaining the local legacy name/avatar and leaving new profile fields empty.`)
      return Object.fromEntries(fields.map((field) => [
        field,
        ['person_id', 'name', 'role', 'avatar_url'].includes(field) ? person[field] ?? '' : '',
      ]))
    }
    const source = sourceRow.values
    if (!source.name) throw new Error(`Planning has no public name for person_id ${person.person_id}`)
    return Object.fromEntries(fields.map((field) => [
      field,
      field === 'role'
        ? person.role ?? ''
        : sourceFields.includes(field) ? source[field] ?? '' : '',
    ]))
  })

  return stringify(projected, { header: true, columns: fields, record_delimiter: 'unix' })
}

export async function syncPeople({ source, output = resolve(root, 'data/people.csv'), check = false }) {
  if (!source) throw new Error('Pass --source <Planning people.csv path>')
  const sourcePath = resolve(source)
  const [planningCsv, currentCsv] = await Promise.all([readFile(sourcePath, 'utf8'), readFile(output, 'utf8')])
  const result = projectPeople(planningCsv, currentCsv, { warn: (message) => console.warn(message) })
  if (result === currentCsv) return true
  if (check) return false
  await writeFile(output, result, 'utf8')
  return true
}

function parseArgs(args) {
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--source' || args[index] === '--output') {
      options[args[index].slice(2)] = args[index + 1]
      index += 1
    } else if (args[index] === '--check') {
      options.check = true
    } else {
      throw new Error(`Unknown option: ${args[index]}`)
    }
  }
  return options
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const unchanged = await syncPeople(parseArgs(process.argv.slice(2)))
    if (!unchanged) {
      console.error('People projection is out of date. Run npm run sync:people -- --source <Planning people.csv path>.')
      process.exitCode = 1
    } else {
      console.log('People projection is current.')
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
