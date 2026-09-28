import { useRef, useState, type ChangeEvent } from 'react'
import { Button, Dialog, FormControl } from '@primer/react'
import { parseAttendeeCsv, type AttendeeCsvDataset } from '../lib/attendeeCsv'

const INVALID_CSV_MESSAGE = 'This file could not be read as CSV. Check the file format and try another file.'

export default function AttendeeCsvImport() {
  const [isOpen, setIsOpen] = useState(false)
  const [dataset, setDataset] = useState<AttendeeCsvDataset | null>(null)
  const [error, setError] = useState('')
  const launcherRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const readId = useRef(0)

  const clearData = () => {
    readId.current += 1
    setDataset(null)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const currentRead = ++readId.current
    setDataset(null)
    setError('')

    try {
      if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Not a CSV file')
      const parsed = parseAttendeeCsv(await file.text())
      if (currentRead === readId.current) setDataset(parsed)
    } catch {
      if (currentRead === readId.current) setError(INVALID_CSV_MESSAGE)
    }
  }

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
                <p role="status">
                  {dataset.rows.length} attendee row{dataset.rows.length === 1 ? '' : 's'}
                </p>
                <h3>Detected columns</h3>
                <ul aria-label="CSV headers">
                  {dataset.headers.map((header, index) => <li key={`${header}-${index}`}>{header}</li>)}
                </ul>
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
