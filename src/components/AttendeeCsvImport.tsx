import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Button, Dialog, FormControl } from '@primer/react'
import { assetCatalog, speakerBadgePrintGeometry } from '../domain/assets'
import type { QRDestination } from '../domain/qrDestination'
import {
  getDuplicateAttendeeMappings,
  getUnmappedRequiredAttendeeFields,
  mapAttendeeCsvRows,
  parseAttendeeCsv,
  suggestAttendeeCsvMapping,
  type AttendeeCsvDataset,
} from '../lib/attendeeCsv'
import { attendeeBadgeFields, type AttendeeCsvColumnMapping } from '../domain/attendee'
import { BADGE_ROLE_PRESENTATIONS, type BadgeRole } from '../domain/badgeRoles'
import { catalogPeople, catalogSponsors, getCatalogPublicProfile } from '../lib/catalog'
import { resolveBadgeRoleQR } from '../lib/badgeRoleQr'
import { resolveCatalogQRDestination } from '../lib/qrDestinationResolver'
import { validateAttendeeRows, type ValidatedAttendeeRow } from '../lib/attendeeValidation'
import { selectRepresentativeAttendees } from '../lib/attendeePreviews'
import { buildAttendeeBadgePack, type AttendeeBatchProgress, type AttendeeBatchResult } from '../lib/exportPack'
import { BADGE_SHEET_PROFILES, buildBadgeSheetPdf, DUPLEX_FLIP_MODES, getBadgeSheetProfile, hasDuplexBadgePair, planDuplexBadgeSheet, type DuplexFlipMode } from '../lib/printSheets'
import { buildPrintCalibrationPdf, PRINT_CALIBRATION } from '../lib/printCalibration'
import { buildDefaultState } from '../lib/history'
import { QRDestinationControls } from './QRDestinationControls'
import AttendeeBadgePreview from './AttendeeBadgePreview'
import type { BannerState, EventThemeId } from '../types'

const INVALID_CSV_MESSAGE = 'This file could not be read as CSV. Check the file format and try another file.'
const qrTemplate = assetCatalog.flatMap(({ templates }) => templates).find(({ qr }) => qr)
type AttendeeBatchState = Omit<AttendeeBatchResult, 'blob'>

interface AttendeeCsvImportProps {
  theme: EventThemeId
  colors: BannerState['colors']
  event: BannerState['event']
}

export default function AttendeeCsvImport({ theme, colors, event }: AttendeeCsvImportProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [dataset, setDataset] = useState<AttendeeCsvDataset | null>(null)
  const [mapping, setMapping] = useState<AttendeeCsvColumnMapping>({})
  const [rowFilter, setRowFilter] = useState<'all' | 'warning' | 'error'>('all')
  const [selectedRows, setSelectedRows] = useState<Set<number> | null>(null)
  const [badgeRoles, setBadgeRoles] = useState<Record<number, BadgeRole>>({})
  const [qrOverrides, setQrOverrides] = useState<Record<number, string>>({})
  const [qrRuleMode, setQrRuleMode] = useState<'role-default' | 'selected-rows'>('role-default')
  const [batchQrDestination, setBatchQrDestination] = useState<QRDestination>({ kind: 'none' })
  const [batchQrReadableText, setBatchQrReadableText] = useState(true)
  const [editingQrRow, setEditingQrRow] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [batchProgress, setBatchProgress] = useState<AttendeeBatchProgress | null>(null)
  const [batchError, setBatchError] = useState('')
  const [batchResult, setBatchResult] = useState<AttendeeBatchState | null>(null)
  const [batchRows, setBatchRows] = useState<ValidatedAttendeeRow[] | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [sheetProfileId, setSheetProfileId] = useState<'a4' | 'a3'>('a4')
  const [sheetFlipMode, setSheetFlipMode] = useState<DuplexFlipMode>('long-edge')
  const [isExportingSheet, setIsExportingSheet] = useState(false)
  const [sheetError, setSheetError] = useState('')
  const [isExportingCalibration, setIsExportingCalibration] = useState(false)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const readId = useRef(0)
  const batchControllerRef = useRef<AbortController | null>(null)

  const resetBatch = () => {
    batchControllerRef.current?.abort()
    batchControllerRef.current = null
    setBatchProgress(null)
    setBatchError('')
    setBatchResult(null)
    setBatchRows(null)
    setSheetError('')
  }

  const clearData = () => {
    readId.current += 1
    setDataset(null)
    setMapping({})
    setSelectedRows(null)
    setBadgeRoles({})
    setQrOverrides({})
    setQrRuleMode('role-default')
    setBatchQrDestination({ kind: 'none' })
    setEditingQrRow(null)
    setBatchQrReadableText(true)
    setRowFilter('all')
    setError('')
    resetBatch()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const currentRead = ++readId.current
    resetBatch()
    setDataset(null)
    setMapping({})
    setSelectedRows(null)
    setBadgeRoles({})
    setQrOverrides({})
    setQrRuleMode('role-default')
    setBatchQrDestination({ kind: 'none' })
    setEditingQrRow(null)
    setBatchQrReadableText(true)
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
  const qrProfiles = useMemo(() => catalogPeople.flatMap(({ id }) => {
    const profile = getCatalogPublicProfile(id)
    return profile?.destinations.length ? [profile] : []
  }), [])
  const normalizedRows = useMemo(() => dataset && missingRequired.length === 0 && duplicateTargets.length === 0
    ? mapAttendeeCsvRows(dataset, mapping)
    : null, [dataset, mapping, missingRequired.length, duplicateTargets.length])
  const validatedRows = useMemo(() => {
    if (!normalizedRows) return null
    const context = document.createElement('canvas').getContext('2d')
    return context ? validateAttendeeRows(normalizedRows, context).map((row) => {
      const badgeRole = badgeRoles[row.sourceRowNumber] ?? 'attendee'
      const usesBatchRule = row.status !== 'error' && (selectedRows?.has(row.sourceRowNumber) ?? true)
      const rowOverride = row.attendee.qrDestination ?? (qrOverrides[row.sourceRowNumber]?.trim()
        ? { kind: 'custom-url' as const, url: qrOverrides[row.sourceRowNumber].trim() }
        : undefined)
      const qr = resolveBadgeRoleQR(
        badgeRole,
        row.attendee,
        { profiles: qrProfiles, sponsors: catalogSponsors, eventPageUrl: event.registrationUrl, getPublicProfile: getCatalogPublicProfile, getSponsor: (id) => catalogSponsors.find(({ id: sponsorId }) => sponsorId === id) },
        usesBatchRule && qrRuleMode === 'selected-rows' ? batchQrDestination : undefined,
        rowOverride,
      )
      return {
        ...row,
        attendee: {
          ...row.attendee,
          badgeRole,
          qrDestination: qr.destination,
          qrWarning: qr.warning,
          qrReadableText: usesBatchRule && qrRuleMode === 'selected-rows' ? batchQrReadableText : true,
        },
      }
    }) : null
  }, [normalizedRows, badgeRoles, qrOverrides, qrProfiles, event.registrationUrl, selectedRows, qrRuleMode, batchQrDestination, batchQrReadableText])
  const visibleRows = validatedRows?.filter((row) => rowFilter === 'all' || row.status === rowFilter) ?? []
  const counts = validatedRows?.reduce((result, row) => {
    result[row.status] += 1
    return result
  }, { valid: 0, warning: 0, error: 0 })
  const isIncluded = (row: NonNullable<typeof validatedRows>[number]) => row.status !== 'error' &&
    (selectedRows?.has(row.sourceRowNumber) ?? true)
  const includedCount = validatedRows?.filter(isIncluded).length ?? 0
  const generatedFrontCount = batchResult?.files.filter((file) => file.side === 'front' || (!file.side && file.id.endsWith('-front'))).length ?? 0
  const sheetBadgeCount = batchResult ? generatedFrontCount : includedCount
  const sheetBadgeLabel = batchResult ? 'generated front badge' : 'selected front badge'
  const sheetProfile = getBadgeSheetProfile(sheetProfileId)
  const sheetHasDuplex = batchResult ? hasDuplexBadgePair(batchResult.files) : false
  const sheetPlan = planDuplexBadgeSheet(sheetBadgeCount, speakerBadgePrintGeometry, sheetProfile, sheetFlipMode)
  const representativeRows = useMemo(() => selectRepresentativeAttendees(
    validatedRows?.filter((row) => row.status !== 'error' && (selectedRows?.has(row.sourceRowNumber) ?? true)) ?? [],
  ), [validatedRows, selectedRows])

  const generateBadges = async (retry = false) => {
    if (isGenerating || !validatedRows || (batchResult && !retry)) return
    const rows = retry && batchRows ? batchRows : validatedRows.filter(isIncluded)
    if (!rows.length) return
    const controller = new AbortController()
    batchControllerRef.current = controller
    setIsGenerating(true)
    setBatchError('')
    setSheetError('')
    if (!retry) {
      setBatchResult(null)
      setBatchRows(rows)
    }
    setBatchProgress({ completed: 0, total: retry && batchResult ? batchResult.failures.length : rows.length * 2, stage: 'rendering', percentage: 0 })
    try {
      const state = buildDefaultState()
      state.theme = theme
      state.colors = colors
      state.event = event
      const onBatchProgress = (progress: AttendeeBatchProgress) => {
        if (batchControllerRef.current === controller) setBatchProgress(progress)
      }
      const pack = await buildAttendeeBadgePack(state, rows, onBatchProgress, retry && batchResult
        ? { signal: controller.signal, retryIds: batchResult.failures.map((failure) => failure.id), previousFiles: batchResult.files }
        : { signal: controller.signal })
      if (batchControllerRef.current !== controller) return
      const url = URL.createObjectURL(pack.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = pack.fileName
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      // Keep rendered PNGs in this session so the organizer can compose the PDF
      // proof without re-rendering or uploading attendee data.
      setBatchResult({
        fileName: pack.fileName,
        fileCount: pack.fileCount,
        failures: pack.failures,
        files: pack.files,
        cancelled: pack.cancelled,
      })
    } catch {
      if (batchControllerRef.current === controller) setBatchError('Could not generate the selected badges. Try again.')
    } finally {
      setIsGenerating(false)
      if (batchControllerRef.current === controller) batchControllerRef.current = null
    }
  }

  const exportPdfProof = async () => {
    if (!batchResult || batchResult.failures.length > 0 || isExportingSheet) return
    setIsExportingSheet(true)
    setSheetError('')
    try {
      const pdf = await buildBadgeSheetPdf(batchResult.files, speakerBadgePrintGeometry, sheetProfileId, sheetFlipMode)
      const url = URL.createObjectURL(pdf.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = pdf.fileName
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setSheetError('Could not create the PDF proof. Generate the badge batch again and retry.')
    } finally {
      setIsExportingSheet(false)
    }
  }

  const exportCalibrationFixture = async () => {
    if (isExportingCalibration) return
    setIsExportingCalibration(true)
    try {
      const fixture = await buildPrintCalibrationPdf()
      const url = URL.createObjectURL(fixture.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fixture.fileName
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally {
      setIsExportingCalibration(false)
    }
  }

  const closeDialog = () => {
    resetBatch()
    setIsOpen(false)
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
          onClose={closeDialog}
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

            <section aria-label="Print calibration fixture">
              <h3>Calibrate before physical printing</h3>
              <p>
                Download the synthetic two-page fixture and print it at 100% / Actual size. Do not use Fit to page,
                Shrink oversized pages, or automatic printer scaling. Measure the 100 mm ruler and the {PRINT_CALIBRATION.trimWidthMm} × {PRINT_CALIBRATION.trimHeightMm} mm trim with a ruler,
                then compare the numbered FRONT/BACK markers after duplex printing.
              </p>
              <p>
                Automated checks verify PDF geometry only. The manual physical-printer check is the production gate;
                accept measurements within ±{PRINT_CALIBRATION.toleranceMm} mm. If outside tolerance, disable scaling,
                check the selected long-/short-edge duplex mode, adjust the printer profile, and repeat the fixture.
                Exports remain proof / calibration pending until this is documented; they are not print-ready.
              </p>
              <Button onClick={() => { void exportCalibrationFixture() }} loading={isExportingCalibration} disabled={isExportingCalibration}>
                Download print calibration fixture (PDF)
              </Button>
            </section>

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
                    <FormControl id="attendee-qr-rule">
                      <FormControl.Label>QR rule for selected rows</FormControl.Label>
                      <select aria-label="QR rule for selected rows" value={qrRuleMode} onChange={(event) => setQrRuleMode(event.target.value as typeof qrRuleMode)}>
                        <option value="role-default">Use each badge role’s recommended default</option>
                        <option value="selected-rows">Use one destination for selected rows</option>
                      </select>
                      <FormControl.Caption>Per-row URL overrides take precedence over both rules.</FormControl.Caption>
                    </FormControl>
                    {qrRuleMode === 'selected-rows' && qrTemplate && (
                      <QRDestinationControls
                        template={qrTemplate}
                        value={batchQrDestination}
                        readableText={batchQrReadableText}
                        profiles={qrProfiles}
                        sponsors={catalogSponsors}
                        resolution={resolveCatalogQRDestination(batchQrDestination)}
                        onChange={setBatchQrDestination}
                        onReadableTextChange={setBatchQrReadableText}
                      />
                    )}
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
                            <FormControl id={`attendee-badge-role-${row.sourceRowNumber}`}>
                              <FormControl.Label>Badge role</FormControl.Label>
                              <select
                                aria-label={`Badge role for row ${row.sourceRowNumber}`}
                                value={badgeRoles[row.sourceRowNumber] ?? 'attendee'}
                                onChange={(event) => setBadgeRoles((current) => ({ ...current, [row.sourceRowNumber]: event.target.value as BadgeRole }))}
                              >
                                {Object.entries(BADGE_ROLE_PRESENTATIONS).map(([role, presentation]) => (
                                  <option key={role} value={role}>{presentation.label}</option>
                                ))}
                              </select>
                            </FormControl>
                            <Button
                              size="small"
                              onClick={() => setEditingQrRow((current) => current === row.sourceRowNumber ? null : row.sourceRowNumber)}
                            >
                              {editingQrRow === row.sourceRowNumber ? 'Close QR override' : `Override QR for row ${row.sourceRowNumber}`}
                            </Button>
                            {editingQrRow === row.sourceRowNumber && (
                              <FormControl id={`attendee-qr-override-${row.sourceRowNumber}`}>
                                <FormControl.Label>Custom QR URL</FormControl.Label>
                                <input
                                  type="url"
                                  aria-label={`Custom QR URL for row ${row.sourceRowNumber}`}
                                  value={qrOverrides[row.sourceRowNumber] ?? ''}
                                  onChange={(event) => setQrOverrides((current) => ({ ...current, [row.sourceRowNumber]: event.target.value }))}
                                />
                                <FormControl.Caption>Leave blank to inherit the selected batch rule or badge-role default.</FormControl.Caption>
                              </FormControl>
                            )}
                            {row.attendee.qrWarning && <p role="status">QR warning: {row.attendee.qrWarning}</p>}
                            <label>
                              <input
                                type="checkbox"
                                aria-label={`Include row ${row.sourceRowNumber} in generation`}
                                checked={isIncluded(row)}
                                disabled={row.status === 'error' || isGenerating || Boolean(batchResult)}
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
                {validatedRows && (
                  <section className="attendee-preview-section" aria-label="Representative badge previews">
                    <h3>Representative badge previews</h3>
                    <p>Up to five selected rows, rendered with the current Speaker Badge front template. Previewing does not create or save badge files.</p>
                    {representativeRows.length > 0 ? (
                      <div className="attendee-preview-grid">
                        {representativeRows.map(({ row, reasons }) => (
                          <AttendeeBadgePreview
                            key={row.sourceRowNumber}
                            sourceRowNumber={row.sourceRowNumber}
                            attendee={row.attendee}
                            reasons={reasons}
                            theme={theme}
                            colors={colors}
                            event={event}
                          />
                        ))}
                      </div>
                    ) : <p role="status">Include a valid or warning row to preview its badge.</p>}
                  </section>
                )}
                {validatedRows && (
                  <section aria-label="Badge batch generation">
                    <h3>Generate selected badges</h3>
                    <p>Only included valid or warning rows are rendered. Each row creates separate front and back PNGs.</p>
                    <section aria-label="PDF proof sheet">
                      <h4>PDF proof sheet</h4>
                      <FormControl id="attendee-sheet-profile">
                        <FormControl.Label>Page profile</FormControl.Label>
                        <select aria-label="PDF proof page profile" value={sheetProfileId} onChange={(event) => setSheetProfileId(event.target.value as 'a4' | 'a3')}>
                          {BADGE_SHEET_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.label} · {profile.widthMm} × {profile.heightMm} mm</option>)}
                        </select>
                      </FormControl>
                      {sheetHasDuplex && (
                        <FormControl id="attendee-sheet-flip-mode">
                          <FormControl.Label>Duplex flip behavior</FormControl.Label>
                          <select aria-label="Duplex flip behavior" value={sheetFlipMode} onChange={(event) => setSheetFlipMode(event.target.value as DuplexFlipMode)}>
                            {DUPLEX_FLIP_MODES.map((mode) => <option key={mode} value={mode}>{mode === 'long-edge' ? 'Long edge (mirror columns)' : 'Short edge (mirror rows)'}</option>)}
                          </select>
                          <FormControl.Caption>Back sheets are paired with the matching front and mirrored on the selected axis.</FormControl.Caption>
                        </FormControl>
                      )}
                      <p aria-live="polite" aria-label="PDF proof layout summary">
                        {sheetProfile.label} PDF proof · {sheetBadgeCount} {sheetBadgeLabel}{sheetBadgeCount === 1 ? '' : 's'} · {sheetPlan.front.perPage} per sheet · {sheetPlan.front.pageCount} page{sheetPlan.front.pageCount === 1 ? '' : 's'} · {sheetProfile.marginMm} mm margins · {sheetProfile.gapMm} mm gaps · crop marks on trim · {sheetHasDuplex ? `front + matching back sheets · ${sheetFlipMode} (${sheetPlan.flipAxis} mirror)` : 'front only'} · calibration pending #145.
                      </p>
                      {sheetHasDuplex && batchResult && (
                        <div aria-label="PDF proof duplex diagnostic">
                          <p>Front sheet 1 ↔ matching back sheet 1; badge positions after the {sheetFlipMode} flip:</p>
                          <ul>
                            {sheetPlan.front.placements.filter((placement) => placement.pageIndex === 0).map((placement) => {
                              const back = sheetPlan.backPlacements.find((candidate) => candidate.index === placement.index)
                              return <li key={placement.index}>Badge {placement.index + 1}: front ({placement.leftMm}, {placement.topMm}) mm → back ({back?.leftMm ?? 'blank'}, {back?.topMm ?? 'blank'}) mm</li>
                            })}
                          </ul>
                        </div>
                      )}
                      <Button onClick={() => { void exportPdfProof() }} disabled={!batchResult || isGenerating || isExportingSheet || Boolean(batchResult?.failures.length)} loading={isExportingSheet}>
                        Download {sheetProfile.label} PDF proof
                      </Button>
                      {sheetError && <p role="alert">{sheetError}</p>}
                    </section>
                    <Button onClick={() => { void generateBadges() }} disabled={isGenerating || includedCount === 0 || Boolean(batchResult)} loading={isGenerating}>
                      Generate selected badges (.zip)
                    </Button>
                    {isGenerating && <Button onClick={() => batchControllerRef.current?.abort()}>Cancel generation</Button>}
                    {batchResult?.failures.length ? (
                      <Button onClick={() => { void generateBadges(true) }} disabled={isGenerating}>
                        Retry failed/cancelled jobs
                      </Button>
                    ) : null}
                    {batchResult && !isGenerating && <Button onClick={resetBatch}>Reset batch</Button>}
                    {batchProgress && (
                      <p role="status" aria-label="Badge batch progress">
                        {batchProgress.stage === 'rendering' ? 'Rendering' : batchProgress.stage === 'packaging' ? 'Creating ZIP' : batchProgress.stage === 'cancelled' ? 'Cancelled' : 'Complete'} · {batchProgress.completed}/{batchProgress.total} · {batchProgress.percentage}%
                      </p>
                    )}
                    {batchError && <p role="alert">{batchError}</p>}
                    {batchResult && (
                      <>
                        <p role="status">
                          Generated {batchResult.fileCount} file{batchResult.fileCount === 1 ? '' : 's'}{batchResult.failures.length ? `; ${batchResult.failures.length} job${batchResult.failures.length === 1 ? '' : 's'} failed.` : '.'}
                        </p>
                        {batchResult.failures.length > 0 && (
                          <ul aria-label="Badge batch failures">
                            {batchResult.failures.map((failure) => (
                              <li key={failure.id}>
                                Row {failure.subject.sourceRowNumber ?? 'unknown'} · {failure.side === 'front' ? 'Front' : 'Back'} · {failure.template}: {failure.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </section>
                )}
                <Button onClick={clearData}>Clear attendee data</Button>
              </section>
            ) : !error ? (
              <p role="status">No attendee data imported.</p>
            ) : null}
          </Dialog.Body>
          <Dialog.Footer>
            <Button onClick={closeDialog}>Close</Button>
          </Dialog.Footer>
        </Dialog>
      )}
    </>
  )
}
