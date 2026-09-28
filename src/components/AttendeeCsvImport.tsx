import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Button, Dialog, FormControl } from '@primer/react'
import {
  getDuplicateAttendeeMappings,
  getUnmappedRequiredAttendeeFields,
  mapAttendeeCsvRows,
  parseAttendeeCsv,
  suggestAttendeeCsvMapping,
  type AttendeeCsvDataset,
} from '../lib/attendeeCsv'
import { attendeeBadgeFields, type AttendeeCsvColumnMapping } from '../domain/attendee'
import { validateAttendeeRows } from '../lib/attendeeValidation'

const INVALID_CSV_MESSAGE = 'This file could not be read as CSV. Check the file format and try another file.'

export default function AttendeeCsvImport() {
  const [isOpen, setIsOpen] = useState(false)
  const [dataset, setDataset] = useState<AttendeeCsvDataset | null>(null)
  const [mapping, setMapping] = useState<AttendeeCsvColumnMapping>({})
  const [rowFilter, setRowFilter] = useState<'all' | 'warning' | 'error'>('all')
  const [selectedRows, setSelectedRows] = useState<Set<number> | null>(null)
  const [error, setError] = useState('')
  const launcherRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const readId = useRef(0)

  const clearData = () => {
    readId.current += 1
    setDataset(null)
    setMapping({})
    setSelectedRows(null)
    setRowFilter('all')
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const currentRead = ++readId.current
    setDataset(null)
    setMapping({})
    setSelectedRows(null)
    setRowFilter('all')
    setError('')

    try {
      if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Not a CSV file')
      const parsed = parseAttendeeCsv(await file.text())
      if (currentRead === readId.current) {
        setDataset(parsed)
        setMapping(suggestAttendeeCsvMapping(parsed.headers))
      }
    } catch {
      if (currentRead === readId.current) setError(INVALID_CSV_MESSAGE)
    }
  }

  const missingRequired = getUnmappedRequiredAttendeeFields(mapping)
  const duplicateTargets = getDuplicateAttendeeMappings(mapping)
  const normalizedRows = useMemo(() => dataset && missingRequired.length === 0 && duplicateTargets.length === 0
    ? mapAttendeeCsvRows(dataset, mapping)
    : null, [dataset, mapping, missingRequired.length, duplicateTargets.length])
  const validatedRows = useMemo(() => {
    if (!normalizedRows) return null
    const context = document.createElement('canvas').getContext('2d')
    return context ? validateAttendeeRows(normalizedRows, context) : null
  }, [normalizedRows])
  const visibleRows = validatedRows?.filter((row) => rowFilter === 'all' || row.status === rowFilter) ?? []
  const counts = validatedRows?.reduce((result, row) => {
    result[row.status] += 1
    return result
  }, { valid: 0, warning: 0, error: 0 })
  const isIncluded = (row: NonNullable<typeof validatedRows>[number]) => row.status !== 'error' &&
    (selectedRows?.has(row.sourceRowNumber) ?? true)
  const includedCount = validatedRows?.filter(isIncluded).length ?? 0

  return (
    <>
      <Button
        ref={launcherRef}
        className="attendee-csv-launcher"
        aria-label="Import attendee CSV"
        title="Import attendee CSV"
        onClick={() => setIsOpen(true)}
      >
        <span className="attendee-csv-wide-label">Import attendee CSV</span>
        <span aria-hidden="true" className="attendee-csv-compact-label">CSV</span>
      </Button>
      {isOpen && (
        <Dialog
          title="Import attendee CSV"
          subtitle="Attendee data is processed locally in your browser and is not uploaded or saved."
          width="large"
          height="auto"
          initialFocusRef={fileInputRef}
          returnFocusRef={launcherRef}
          onClose={() => setIsOpen(false)}
        >
          <Dialog.Body>
            <FormControl id="attendee-csv-file">
              <FormControl.Label>Choose a CSV file</FormControl.Label>
              <input
                ref={fileInputRef}
                id="attendee-csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => { void handleFile(event) }}
              />
              <FormControl.Caption>Only the selected file is read; its contents stay in this browser session.</FormControl.Caption>
            </FormControl>

            {error && <p role="alert">{error}</p>}
            {dataset ? (
              <section aria-label="Imported attendee CSV">
                <h3>Map columns to badge fields</h3>
                <p>Choose one source column for each field. Unmapped columns are ignored.</p>
                {missingRequired.length > 0 && <p role="alert">Map a column to required field: {missingRequired.map((id) => attendeeBadgeFields.find((field) => field.id === id)?.label).join(', ')}.</p>}
                {duplicateTargets.length > 0 && <p role="alert">Each badge field can use only one source column. Choose a different field or ignore a duplicate.</p>}
                <div className="attendee-csv-mapping">
                  {dataset.headers.map((header, index) => (
                    <FormControl key={`${header}-${index}`} id={`attendee-csv-column-${index}`}>
                      <FormControl.Label>{header || `Column ${index + 1}`}</FormControl.Label>
                      <select
                        aria-label={`Map column ${header || index + 1}`}
                        value={mapping[index] ?? 'ignore'}
                        onChange={(event) => {
                          setSelectedRows(null)
                          setRowFilter('all')
                          setMapping((current) => ({ ...current, [index]: event.target.value as AttendeeCsvColumnMapping[number] }))
                        }}
                      >
                        <option value="ignore">Ignore column</option>
                        {attendeeBadgeFields.map((field) => {
                          const usedElsewhere = Object.entries(mapping).some(([otherIndex, target]) => Number(otherIndex) !== index && target === field.id)
                          return <option key={field.id} value={field.id} disabled={usedElsewhere}>{field.label}{field.required ? ' (required)' : ''}</option>
                        })}
                      </select>
                    </FormControl>
                  ))}
                </div>
                {validatedRows && counts ? (
                  <section aria-label="Attendee row validation">
                    <h3>Review imported rows</h3>
                    <p role="status">Total {validatedRows.length}; valid {counts.valid}; warnings {counts.warning}; errors {counts.error}; selected for generation {includedCount}.</p>
                    <FormControl id="attendee-row-filter">
                      <FormControl.Label>Filter rows</FormControl.Label>
                      <select aria-label="Filter attendee rows" value={rowFilter} onChange={(event) => setRowFilter(event.target.value as typeof rowFilter)}>
                        <option value="all">All rows</option>
                        <option value="warning">Warnings</option>
                        <option value="error">Errors</option>
                      </select>
                    </FormControl>
                    <ul className="attendee-validation-rows" aria-label="Validated attendee rows">
                      {visibleRows.map((row) => (
                        <li key={row.sourceRowNumber}>
                          <div className="attendee-validation-row-heading">
                            <strong>Row {row.sourceRowNumber}: {row.status}</strong>
                            <label>
                              <input
                                type="checkbox"
                                aria-label={`Include row ${row.sourceRowNumber} in generation`}
                                checked={isIncluded(row)}
                                disabled={row.status === 'error'}
                                onChange={(event) => setSelectedRows((current) => {
                                  const next = current ?? new Set(validatedRows.filter((item) => item.status !== 'error').map((item) => item.sourceRowNumber))
                                  const updated = new Set(next)
                                  if (event.target.checked) updated.add(row.sourceRowNumber)
                                  else updated.delete(row.sourceRowNumber)
                                  return updated
                                })}
                              />
                              Include
                            </label>
                          </div>
                          {row.findings.length > 0 && <ul>{row.findings.map((finding) => <li key={`${finding.code}-${finding.field}`}>{finding.field}: {finding.message}</li>)}</ul>}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : normalizedRows ? <p role="alert">Row validation is unavailable in this browser.</p> : null}
                <Button onClick={clearData}>Clear imported data</Button>
              </section>
            ) : !error ? (
              <p role="status">No attendee data imported.</p>
            ) : null}
          </Dialog.Body>
          <Dialog.Footer>
            <Button onClick={() => setIsOpen(false)}>Close</Button>
          </Dialog.Footer>
        </Dialog>
      )}
    </>
  )
}
