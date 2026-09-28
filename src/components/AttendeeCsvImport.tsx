import { useRef, useState, type ChangeEvent } from 'react'
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

const INVALID_CSV_MESSAGE = 'This file could not be read as CSV. Check the file format and try another file.'

export default function AttendeeCsvImport() {
  const [isOpen, setIsOpen] = useState(false)
  const [dataset, setDataset] = useState<AttendeeCsvDataset | null>(null)
  const [mapping, setMapping] = useState<AttendeeCsvColumnMapping>({})
  const [error, setError] = useState('')
  const launcherRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const readId = useRef(0)

  const clearData = () => {
    readId.current += 1
    setDataset(null)
    setMapping({})
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const currentRead = ++readId.current
    setDataset(null)
    setMapping({})
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
  const normalizedRows = dataset && missingRequired.length === 0 && duplicateTargets.length === 0
    ? mapAttendeeCsvRows(dataset, mapping)
    : null

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
                        onChange={(event) => setMapping((current) => ({ ...current, [index]: event.target.value as AttendeeCsvColumnMapping[number] }))}
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
                {normalizedRows ? <p role="status">{normalizedRows.length} attendee row{normalizedRows.length === 1 ? '' : 's'} ready for badge fields.</p> : null}
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
