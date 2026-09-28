import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type SetStateAction, type ToggleEvent as ReactToggleEvent } from 'react'
import { Banner, Button, Checkbox, CounterLabel, FormControl, IconButton, Select, TextInput, Textarea, ToggleSwitch } from '@primer/react'
import {
  AlertIcon,
  ChevronDownIcon,
  CopilotIcon,
  DownloadIcon,
  HistoryIcon,
  MarkGithubIcon,
  ScreenFullIcon,
  SidebarCollapseIcon,
  SidebarExpandIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@primer/octicons-react'
import './App.css'
import AttendeeCsvImport from './components/AttendeeCsvImport'
import AssetStartScreen from './components/AssetStartScreen'
import AssetNavigation from './components/AssetNavigation'
import ArtboardSelectionOverlay from './components/ArtboardSelectionOverlay'
import {
  EVENT_THEMES,
  filenamePrefixByFormat,
  formatOptions,
  getEventTheme,
  MAX_HISTORY_ITEMS,
  MAX_SPEAKERS,
  REPOSITORY_URL,
} from './constants'
import { assetCatalog } from './domain/assets'
import { saveActiveSide, stateForSide, switchAssetSide } from './domain/assetSides'
import { constrainSpeakerNameOffset } from './domain/templateManipulation'
import type { AssetSide } from './domain/assets'
import { QRDestinationControls } from './components/QRDestinationControls'
import { defaultQRDestination, getQRDestinationControlId, qrDestinationErrorMessage } from './lib/qrDestinationControls'
import type {
  BannerHistoryItem,
  BannerState,
  EventDetails,
  EventThemeId,
  Speaker,
  SpeakersPerCard,
} from './types'
import { uid } from './lib/format'
import { buildDefaultState, normalizeState, readBannerHistory, writeBannerHistory } from './lib/history'
import { fileToDataUrl, getBackgroundImage, loadImage } from './lib/image'
import { renderBanner } from './lib/renderBanner'
import { createRenderInfo, validateState, type TextRegion, type ValidationFinding } from './lib/validate'
import { checkRenderedCanvas } from './lib/pixelChecks'
import { catalogOrganizers, catalogSpeakers, catalogSponsors, eventPresets, getCatalogPublicHandle, getCatalogPublicProfile } from './lib/catalog'
import { resolveCatalogQRDestination } from './lib/qrDestinationResolver'
import { buildEventPack, type EventPackProgress } from './lib/exportPack'
import { readDraft, writeDraft, clearDraft } from './lib/draft'

const EDITOR_GUIDE_STORAGE_KEY = 'devdays-editor-guide-dismissed-v1'
type ShellMode = 'light' | 'dark'

function shouldShowEditorGuide() {
  try {
    return window.localStorage.getItem(EDITOR_GUIDE_STORAGE_KEY) !== 'dismissed'
  } catch {
    return true
  }
}

function getSpeakerCardsForState(input: BannerState, enabled: boolean): Speaker[][] {
  if (!enabled) return []
  const named = input.speakers.filter((speaker) => speaker.name.trim().length > 0).slice(0, MAX_SPEAKERS)
  const cards: Speaker[][] = []
  for (let index = 0; index < named.length; index += input.speakersPerCard) {
    cards.push(named.slice(index, index + input.speakersPerCard))
  }
  return cards
}

function App({ shellMode, onToggleShellMode }: { shellMode: ShellMode; onToggleShellMode: () => void }) {
  const [backgroundFailed, setBackgroundFailed] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileView, setMobileView] = useState<'fields' | 'preview'>('fields')
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => window.matchMedia('(max-width: 760px)').matches,
  )
  const [showEditorGuide, setShowEditorGuide] = useState(shouldShowEditorGuide)
  const mobileFieldsScrollY = useRef(0)
  const [showHistory, setShowHistory] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState('')
  const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<string[]>([])
  const [catalogEventFilter, setCatalogEventFilter] = useState('')
  const [selectedSponsorId, setSelectedSponsorId] = useState('')
  const [selectedOrganizerId, setSelectedOrganizerId] = useState('')
  const [history, setHistory] = useState<BannerHistoryItem[]>(() => readBannerHistory())
  const [showAssetChooser, setShowAssetChooser] = useState(false)
  const [speakerPreviews, setSpeakerPreviews] = useState<Array<{ id: string; name: string; previewDataUrl: string }>>([])
  const [fontsReady, setFontsReady] = useState(() => typeof document === 'undefined' || !document.fonts)
  const [isExportingPack, setIsExportingPack] = useState(false)
  const [isExportingBanner, setIsExportingBanner] = useState(false)
  const [packProgress, setPackProgress] = useState<EventPackProgress | null>(null)
  const [validationFindings, setValidationFindings] = useState<ValidationFinding[]>([])
  const [canvasTextRegions, setCanvasTextRegions] = useState<TextRegion[]>([])
  const [selectedArtboardField, setSelectedArtboardField] = useState<string | undefined>()
  const [badgeExportFindings, setBadgeExportFindings] = useState<Array<{ side: AssetSide; findings: ValidationFinding[] }> | null>(null)
  // Fields the live preview render had to truncate (e.g. ["event title"]).
  const [truncatedFields, setTruncatedFields] = useState<string[]>([])

  // Transient toast with optional Undo action (#81, #82). Single-slot: a new
  // toast replaces the previous one. 🧭 DECISION — undo toasts last 5s, plain
  // toasts 3s; bottom-center placement; click anywhere dismisses. Revert by
  // restoring confirm dialogs for removals.
  type AppToast = { id: number; message: string; undo?: () => void }
  const [toast, setToast] = useState<AppToast | null>(null)
  const toastTimer = useRef<number | null>(null)
  const toastIdRef = useRef(0)
  const dismissToast = useCallback(() => {
    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current)
      toastTimer.current = null
    }
    setToast(null)
  }, [])
  const showToast = useCallback((message: string, undo?: () => void, durationMs = undo ? 5000 : 3000) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastIdRef.current += 1
    setToast({ id: toastIdRef.current, message, undo })
    toastTimer.current = window.setTimeout(() => {
      toastTimer.current = null
      setToast(null)
    }, durationMs)
  }, [])
  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
  }, [])
  const validationErrorCount = validationFindings.filter((f) => f.severity === 'error').length
  const validationIssueCount = validationFindings.length
  const exportFindingsLabel =
    validationIssueCount > 0
      ? `${validationErrorCount} error${validationErrorCount === 1 ? '' : 's'}, ${validationIssueCount - validationErrorCount} warning${validationIssueCount - validationErrorCount === 1 ? '' : 's'}`
      : ''

    // Map validation findings to actionable field/section links
    const FINDING_TARGET_MAP: Record<string, { elementId: string; fieldId?: string }> = {
          'missing-city': { elementId: 'section-event', fieldId: 'event-city' },
              'missing-venue': { elementId: 'section-event', fieldId: 'event-location' },
              'missing-date': { elementId: 'section-event', fieldId: 'event-datetime' },
              'missing-hashtag': { elementId: 'section-event' },
              'missing-url': { elementId: 'section-registration', fieldId: 'registration-url' },
              'missing-description': { elementId: 'section-event' },
          'speakers-dropped': { elementId: 'section-speakers' },
          'logos-dropped': { elementId: 'section-partners' },
          'missing-partner': { elementId: 'section-partners' },
          'missing-sponsor': { elementId: 'section-partners' },
              'missing-organizer': { elementId: 'section-organizer', fieldId: 'organizer-select' },
              'missing-organizer-url': { elementId: 'section-organizer', fieldId: 'registration-url' },
          'invalid-qr-destination': { elementId: 'section-qr' },
        }

        /** Map truncated field names (from renderBanner.ts) to their editor field IDs. */
            const TRUNCATED_FIELD_MAP: Record<string, { sectionId: string; fieldId?: string }> = {
          'city': { sectionId: 'section-event', fieldId: 'event-city' },
          'edition': { sectionId: 'section-event', fieldId: 'event-edition' },
              'date & time': { sectionId: 'section-event', fieldId: 'event-datetime' },
              'speaker name': { sectionId: 'section-speakers' },
              'speaker role': { sectionId: 'section-speakers' },
              'registration label': { sectionId: 'section-registration', fieldId: 'registration-text' },
              'registration URL': { sectionId: 'section-registration', fieldId: 'registration-url' },
          'event title': { sectionId: 'section-event', fieldId: 'event-title' },
              'event details': { sectionId: 'section-event' },
              'location': { sectionId: 'section-event', fieldId: 'event-location' },
        }

    /** Editor control id -> renderBanner truncated-field name, for inline fit warnings. */
    const TRUNCATION_CONTROL_KEYS: Record<string, string> = {
          'event-title': 'event title',
          'event-edition': 'edition',
          'event-city': 'city',
          'event-datetime': 'date & time',
          'registration-text': 'registration label',
          'registration-url': 'registration URL',
        }
    const isControlTruncated = (controlId: string) => {
      const key = TRUNCATION_CONTROL_KEYS[controlId]
      return !!key && truncatedFields.includes(key)
    }

        const focusEditorTarget = (target: { elementId: string; fieldId?: string }) => {
          if (isMobileViewport) setMobileView('fields')
          // Scroll to the section
          const sectionEl = document.getElementById(target.elementId)
          if (sectionEl) {
            sectionEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
            if (sectionEl.tagName === 'DETAILS' && !(sectionEl as HTMLDetailsElement).open) {
              setSectionOpen((prev) => ({ ...prev, [target.elementId]: true }))
            }
          }
          if (target.fieldId) {
            window.setTimeout(() => {
              // Primer FormControl may give its label the same id as the input;
              // prefer the actual focusable control over that earlier label node.
              const fieldEl = document.querySelector<HTMLElement>(
                `input[id="${target.fieldId}"], textarea[id="${target.fieldId}"], select[id="${target.fieldId}"], button[id="${target.fieldId}"]`,
              ) ?? document.getElementById(target.fieldId!)
              if (!fieldEl) return
              fieldEl.focus()
              fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
              fieldEl.classList.add('validation-highlight')
              window.setTimeout(() => fieldEl.classList.remove('validation-highlight'), 2000)
            }, 300)
          }
        }

        const navigateToField = (finding: ValidationFinding) => {
          // For text-truncated, use the specific field name to find the target
          let target: { elementId: string; fieldId?: string } | undefined
          if (finding.code === 'text-truncated' && finding.field) {
            const specific = TRUNCATED_FIELD_MAP[finding.field]
            if (specific) {
              target = { elementId: specific.sectionId, fieldId: specific.fieldId }
            }
          }
          if (!target) {
            target = FINDING_TARGET_MAP[finding.code]
          }
          if (finding.code === 'invalid-qr-destination' && finding.targetId) {
            target = { elementId: 'section-qr', fieldId: finding.targetId }
          }
          if (!target) return

      focusEditorTarget(target)
    }

    const selectArtboardField = (field: string) => {
      setSelectedArtboardField(field)
      const normalized = field.toLowerCase()
      const firstSpeakerId = state.speakers[0]?.id
      const target = {
        'event title': { elementId: 'section-event', fieldId: 'event-title' },
        'event identity': { elementId: 'section-event', fieldId: 'event-title' },
        'event details': { elementId: 'section-event' },
        'speaker name': { elementId: 'section-speakers', fieldId: firstSpeakerId ? `speaker-name-${firstSpeakerId}` : undefined },
        city: { elementId: 'section-event', fieldId: 'event-city' },
        edition: { elementId: 'section-event', fieldId: 'event-edition' },
        'date & time': { elementId: 'section-event', fieldId: 'event-datetime' },
        'registration label': { elementId: 'section-registration', fieldId: 'registration-text' },
        'registration url': { elementId: 'section-registration', fieldId: 'registration-url' },
        'qr destination text': { elementId: 'section-qr', fieldId: 'qr-destination-type' },
      }[normalized]
      if (target) focusEditorTarget(target)
    }

    const canvasRef = useRef<HTMLCanvasElement>(null)

  const [state, setStateRaw] = useState<BannerState>(() => buildDefaultState())
  const setState = (action: SetStateAction<BannerState>) => setStateRaw((previous) => {
    const next = typeof action === 'function' ? action(previous) : action
    const template = assetCatalog.flatMap((asset) => asset.templates).find((item) => item.legacyFormat === next.format)
    return template && template.sides.length > 1 ? saveActiveSide(next) : next
  })
  const movableElementIds = assetCatalog.flatMap((asset) => asset.templates)
    .find((template) => template.legacyFormat === state.format)?.movableElementIds ?? []
  const setTemplateElementPosition = (elementId: string, position: { x: number; y: number }) => {
    if (!movableElementIds.includes(elementId)) return
    setState((previous) => ({
      ...previous,
      elementOffsets: {
        ...previous.elementOffsets,
        [elementId]: constrainSpeakerNameOffset(position),
      },
    }))
  }
  const moveTemplateElement = (elementId: string, delta: { x: number; y: number }) => {
    if (!movableElementIds.includes(elementId)) return
    setState((previous) => {
      const current = previous.elementOffsets?.[elementId] ?? { x: 0, y: 0 }
      return {
        ...previous,
        elementOffsets: {
          ...previous.elementOffsets,
          [elementId]: constrainSpeakerNameOffset({ x: current.x + delta.x, y: current.y + delta.y }),
        },
      }
    })
  }
  const [draftStatus, setDraftStatus] = useState<'saving' | 'saved' | 'error' | null>(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [draftReady, setDraftReady] = useState(false)
  const [draftBlocked, setDraftBlocked] = useState(false)
  const draftSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const format = useMemo(
    () => formatOptions.find((item) => item.id === state.format) ?? formatOptions[0],
    [state.format],
  )
  const templateSides = assetCatalog.flatMap((asset) => asset.templates)
    .find((template) => template.legacyFormat === state.format)?.sides ?? ['front']
  const hasMultipleSides = templateSides.length > 1
  const activeSide = state.activeSide ?? 'front'
  const isLumaCover = state.format === 'luma_cover'
  const isSpeakerBanner = state.format === 'speaker_banner'
  const isSpeakerSquare = state.format === 'speaker_square'
  const isSpeakerBadge = state.format === 'speaker_badge'
  const isSocialPromo = state.format === 'social_promo'
  const isMinimalCover = isLumaCover
  const isSpeakerPerBannerFormat = isSpeakerBanner || isSpeakerSquare || isSpeakerBadge
  const qrTemplate = activeSide === 'back' ? assetCatalog.flatMap((asset) => asset.templates)
    .find((template) => template.legacyFormat === state.format && template.qr) : undefined
  const qrReadableText = qrTemplate?.qr
    ? state.qrReadableText ?? qrTemplate.qr.defaultReadableText
    : false

  // #79: collapsible sidebar sections. Open/closed state lives in React (not
  // the DOM) so it persists across format changes; only the format section is
  // open by default because it is relevant to every format.
  // 🧭 DECISION — question: which section should stay open by default, and
  // should the default reset when the format changes?
  //   options: (a) format section open, state persists; (b) collapse everything;
  //   (c) reset to defaults on each format change.
  //   investigation: the format section is the only section rendered for every
  //   format, and it is the first thing users touch when changing output.
  //   decision: (a) — format section open on load, user toggles persist across
  //   format changes. Most conservative and easily reversible: revert this
  //   commit to restore always-open sections.
  const [openSections, setSectionOpen] = useState<Record<string, boolean>>({ 'section-format': true })
  const handleSectionToggle = (id: string) => (event: ReactToggleEvent<HTMLDetailsElement>) => {
    const open = (event.target as HTMLDetailsElement).open
    setSectionOpen((prev) => (prev[id] === open ? prev : { ...prev, [id]: open }))
  }
  const renderedSectionIds = useMemo(() => {
    const ids = ['section-event']
    if (!isMinimalCover && !isSocialPromo) ids.push('section-speakers')
    ids.push('section-format')
    if (isSpeakerBanner || isSocialPromo) ids.push('section-organizer')
    if (isLumaCover || isSocialPromo || isSpeakerBanner || isSpeakerSquare) ids.push('section-partners')
    if (isSocialPromo || isSpeakerBanner) ids.push('section-registration')
    if (qrTemplate) ids.push('section-qr')
    return ids
  }, [isMinimalCover, isSocialPromo, isSpeakerBanner, isLumaCover, isSpeakerSquare, qrTemplate])
  const allSectionsOpen = renderedSectionIds.every((id) => openSections[id])
  const isTallBanner = format.width === 1080 && format.height === 1350
  const previewBaseScale = isTallBanner ? 0.78 : 1
  const qrProfiles = useMemo(() => state.speakers.flatMap((speaker) => {
    if (!speaker.personId) return []
    const profile = getCatalogPublicProfile(speaker.personId)
    return profile?.destinations.length ? [profile] : []
  }), [state.speakers])
  const qrDestination = qrTemplate?.qr
    ? state.qrDestination ?? defaultQRDestination(
      qrTemplate.qr.defaultDestinationKind,
      qrProfiles,
      catalogSponsors,
      isSpeakerBadge && qrTemplate.qr.allowNone,
    )
    : undefined
  const speakerCards = useMemo(() => {
    return getSpeakerCardsForState(state, isSpeakerPerBannerFormat)
  }, [isSpeakerPerBannerFormat, state])
  const showMultiSpeakerPreviewGrid = speakerCards.length > 1
  const downloadFileCount = speakerCards.length || 1
  const bothBadgeSideFileCount = ['front', 'back'].reduce((count, side) => {
    const sideState = stateForSide(state, side as AssetSide)
    return count + (getSpeakerCardsForState(sideState, true).length || 1)
  }, 0)
  const downloadLabel = isSpeakerBadge
    ? `${activeSide === 'front' ? 'Front' : 'Back'} PNG · ${format.width}×${format.height}${downloadFileCount > 1 ? ` · ${downloadFileCount} files` : ''}`
    : `PNG · ${format.width}×${format.height}${downloadFileCount > 1 ? ` · ${downloadFileCount} files` : ''}`
  const catalogEventOptions = useMemo(() => {
    const labels = new Map<string, string>()
    for (const item of catalogSpeakers) {
      if (labels.has(item.eventId)) continue
      const words = item.eventId.replace(/^\d{4}-\d{2}-\d{2}-/, '').split('-').filter(Boolean)
      const label = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || item.eventId
      labels.set(item.eventId, `${label} (${item.eventDate})`)
    }
    return [...labels.entries()].map(([id, label]) => ({ id, label }))
  }, [])
  const visibleCatalogSpeakers = useMemo(
    () => catalogSpeakers.filter((item) => !catalogEventFilter || item.eventId === catalogEventFilter),
    [catalogEventFilter],
  )
  const selectedBackgroundImage = useMemo(() => getBackgroundImage(state.format), [state.format])
  const previewBackgroundFailed = selectedBackgroundImage ? backgroundFailed : false

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return

    let cancelled = false
    const weights = [200, 300, 400, 500, 600, 700, 800, 900]
    Promise.all(weights.map((weight) => document.fonts.load(`${weight} 100px "Mona Sans"`)))
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setFontsReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const updateViewport = () => {
      setIsMobileViewport(media.matches)
      if (!media.matches) setMobileView('fields')
    }
    media.addEventListener('change', updateViewport)
    return () => media.removeEventListener('change', updateViewport)
  }, [])

    // Restore through the persisted-state version boundary before enabling autosave.
    useEffect(() => {
      let cancelled = false
      readDraft()
        .then((result) => {
          if (cancelled) return
          if (result.status === 'restored') {
            setState(normalizeState(result.state))
            setShowAssetChooser(false)
          }
          if (result.status === 'unsupported' || result.status === 'invalid') {
            setDraftBlocked(true)
            setDraftStatus('error')
            setDraftMessage('Saved draft is not supported. Update the app or use Reset to clear it before saving again.')
          } else if (result.status === 'error') {
            setDraftBlocked(true)
            setDraftStatus('error')
            setDraftMessage('Could not read the saved draft. Check browser storage, then reload or use Reset.')
          }
          setDraftReady(true)
        })
        .catch(() => {
          if (!cancelled) {
            setDraftBlocked(true)
            setDraftStatus('error')
            setDraftMessage('Could not read the saved draft. Check browser storage, then reload or use Reset.')
            setDraftReady(true)
          }
        })

      return () => {
        cancelled = true
      }
    }, [])

    // Debounced auto-save draft on state changes.
    useEffect(() => {
      if (!draftReady || draftBlocked) return
      if (draftSaveRef.current) clearTimeout(draftSaveRef.current)
      setDraftStatus('saving')

      draftSaveRef.current = setTimeout(() => {
        writeDraft(state)
          .then(() => setDraftStatus('saved'))
          .catch(() => setDraftStatus('error'))
      }, 500)

      return () => {
        if (draftSaveRef.current) clearTimeout(draftSaveRef.current)
      }
    }, [state, draftReady, draftBlocked])

  useEffect(() => {
    setBadgeExportFindings(null)
  }, [state])

  useEffect(() => {
    let cancelled = false

    const draw = async () => {
      if (cancelled) return
      const renderInfo = createRenderInfo()
      const previewState = {
        ...(speakerCards.length ? { ...state, speakers: speakerCards[0] } : state),
        ...(qrDestination ? { qrDestination, qrReadableText } : {}),
      }
      let targetCanvas: HTMLCanvasElement | null = null
      if (showMultiSpeakerPreviewGrid) {
        // The visible canvas is unmounted while the per-speaker grid is shown.
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
        // Render once to an offscreen canvas so validation still reflects what
        // an export would show.
        targetCanvas = document.createElement('canvas')
        try {
          await renderBanner(targetCanvas, previewState, format, previewBackgroundFailed, 1, renderInfo)
        } catch {
          return
        }
      } else {
        if (!canvasRef.current) return
        targetCanvas = canvasRef.current
        try {
          await renderBanner(targetCanvas, previewState, format, previewBackgroundFailed, 1, renderInfo)
        } catch {
          if (!cancelled) setError('Failed to render preview.')
          return
        }
      }
      const findings = [
        ...validateState(state, format.id, renderInfo),
        ...checkRenderedCanvas(targetCanvas, renderInfo),
      ]
      if (qrTemplate?.qr && qrDestination) {
        const resolution = resolveCatalogQRDestination(qrDestination)
        const message = qrDestinationErrorMessage(qrDestination, resolution, qrTemplate.qr.allowNone)
        if (message) {
          findings.push({
            code: 'invalid-qr-destination',
            severity: 'error',
            field: 'QR destination',
            message,
            targetId: getQRDestinationControlId(qrDestination),
          })
        }
      }
      // Test hook: lets Playwright specs inject findings (e.g. an 'error'
      // severity, which real themes never produce) to verify badge styling.
      const injected = (window as unknown as { __devdaysInjectedFindings?: typeof findings }).__devdaysInjectedFindings
      const effectiveFindings = injected ?? findings
      if (cancelled) return
      setValidationFindings(effectiveFindings)
      setCanvasTextRegions(showMultiSpeakerPreviewGrid ? [] : renderInfo.textRegions)
      setTruncatedFields(renderInfo.truncatedFields)
      // Exposed for Playwright visual-validation specs (reflects injected findings too).
      ;(window as unknown as { __devdaysValidation?: { findings: ValidationFinding[]; pixelChecks: typeof checkRenderedCanvas } }).__devdaysValidation = { findings: effectiveFindings, pixelChecks: checkRenderedCanvas }
    }

    // Coalesce rapid state changes into a single redraw on the next animation
    // frame. This keeps typing smooth while making variation switches feel instant.
    const frame = window.requestAnimationFrame(() => {
      void draw()
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [state, format, previewBackgroundFailed, showMultiSpeakerPreviewGrid, fontsReady, speakerCards, qrTemplate, qrDestination, qrReadableText])

  useEffect(() => {
    let cancelled = false

    const drawSpeakerPreviews = async () => {
      if (!isSpeakerPerBannerFormat || speakerCards.length <= 1) {
        setSpeakerPreviews([])
        return
      }

      const previews: Array<{ id: string; name: string; previewDataUrl: string }> = []

      for (const speakers of speakerCards) {
        const previewCanvas = document.createElement('canvas')
        const previewState: BannerState = {
          ...state,
          speakers,
        }
        await renderBanner(previewCanvas, previewState, format, previewBackgroundFailed, 1)
        previews.push({
          id: speakers.map((speaker) => speaker.id).join('-'),
          name: speakers.map((speaker) => speaker.name).join(' + '),
          previewDataUrl: previewCanvas.toDataURL('image/jpeg', 0.8),
        })
      }

      if (!cancelled) {
        setSpeakerPreviews(previews)
      }
    }

    drawSpeakerPreviews().catch(() => {
      if (!cancelled) {
        setSpeakerPreviews([])
      }
    })

    return () => {
      cancelled = true
    }
  }, [state, format, previewBackgroundFailed, isSpeakerPerBannerFormat, speakerCards, fontsReady])

  useEffect(() => {
    if (!selectedBackgroundImage) return
    loadImage(selectedBackgroundImage)
      .then(() => setBackgroundFailed(false))
      .catch(() => setBackgroundFailed(true))
  }, [selectedBackgroundImage])

  // Warm the image cache for every format's background on mount so the first
  // switch to a variation doesn't wait on a network/decode round-trip.
  useEffect(() => {
    formatOptions.forEach((option) => {
      const src = getBackgroundImage(option.id)
      if (src) loadImage(src).catch(() => undefined)
    })
  }, [])

  const updateEvent = (patch: Partial<EventDetails>) =>
    setState((prev) => ({ ...prev, event: { ...prev.event, ...patch } }))

  const updateSpeaker = (id: string, patch: Partial<Speaker>) =>
    setState((prev) => ({
      ...prev,
      speakers: prev.speakers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))

  const applyCatalogSpeakers = () => {
    const chosen = catalogSpeakers.filter((item) => selectedSpeakerIds.includes(item.speakerId))
    if (!chosen.length) return
    setState((previous) => {
      const existingCatalogIds = new Set(previous.speakers.map((speaker) => speaker.catalogId).filter(Boolean))
      const additions = chosen
        .filter((item) => !existingCatalogIds.has(item.speakerId))
        .slice(0, Math.max(0, MAX_SPEAKERS - previous.speakers.length))
        .map((item) => ({
          id: uid(),
          catalogId: item.speakerId,
          personId: item.id,
          name: item.name,
          role: getCatalogPublicProfile(item.id)?.displayRole || item.role,
          photoDataUrl: item.avatarUrl || undefined,
          talkTitle: item.sessionTitle || undefined,
          talkTime: item.sessionTime || undefined,
        }))
      return { ...previous, speakers: [...previous.speakers, ...additions] }
    })
    setSelectedSpeakerIds([])
  }

  const addManualSpeaker = () =>
    setState((previous) =>
      previous.speakers.length >= MAX_SPEAKERS
        ? previous
        : { ...previous, speakers: [...previous.speakers, { id: uid(), name: '' }] },
    )

  const removeSpeaker = (id: string) => {
    const index = state.speakers.findIndex((speaker) => speaker.id === id)
    if (index === -1) return
    const removed = state.speakers[index]
    setState((previous) => ({ ...previous, speakers: previous.speakers.filter((speaker) => speaker.id !== id) }))
    showToast('Speaker removed.', () => {
      setState((previous) => {
        if (previous.speakers.some((speaker) => speaker.id === removed.id)) return previous
        const speakers = [...previous.speakers]
        speakers.splice(Math.min(index, speakers.length), 0, removed)
        return { ...previous, speakers }
      })
    })
  }

  const addCatalogSponsor = () => {
    const sponsor = catalogSponsors.find((item) => item.id === selectedSponsorId)
    if (!sponsor || state.partners.length >= 3) return
    setState((previous) => ({
      ...previous,
      event: { ...previous.event, includeSupportedBy: true },
      partners: [...previous.partners, { id: uid(), imageDataUrl: sponsor.logoForLightBackgroundUrl, name: sponsor.name }],
    }))
  }

  const applyCatalogOrganizer = () => {
    const organizer = catalogOrganizers.find((item) => item.id === selectedOrganizerId)
    if (!organizer) return
    updateEvent({
      organizerName: organizer.name,
      organizerLogoDataUrl: organizer.logoForLightBackgroundUrl,
    })
  }

  const applyPreset = (presetId: string) => {
    const preset = eventPresets.find((item) => item.id === presetId)
    if (!preset) return
    // Presets only set event content; the banner format is an explicit user choice.
    setState((previous) => ({
      ...previous,
      event: { ...previous.event, title: preset.seriesLabel, edition: preset.edition },
    }))
  }

  // Design themes control colors + fixed brand text (see epic #48). This is
  // deliberately separate from applyPreset/eventPresets above, which is an
  // unrelated data-catalog feature (lib/catalog.ts) that only prefills event
  // content fields.
  const applyTheme = (themeId: EventThemeId) => {
    const theme = getEventTheme(themeId)
    setState((previous) => ({ ...previous, theme: theme.id, colors: theme.colors }))
  }

  const [resetConfirm, setResetConfirm] = useState(false)

    const resetAll = async () => {
      const cleared = await clearDraft()
      if (!cleared) {
        setDraftStatus('error')
        setDraftMessage('Could not clear the saved draft. Check browser storage and try again.')
        return
      }
      setDraftBlocked(false)
      setDraftMessage('')
      setState(buildDefaultState())
      setZoom(1)
    }

  const zoomIn = () => setZoom((value) => Math.min(2, Math.round((value + 0.1) * 10) / 10))
  const zoomOut = () => setZoom((value) => Math.max(0.3, Math.round((value - 0.1) * 10) / 10))
  const fitZoom = () => setZoom(1)

  const exportBanner = async (bothBadgeSides = false) => {
    // Re-entrancy guard: a double click (or a slow multi-card render) must not
    // fire duplicate downloads or duplicate history entries.
    if (isExportingBanner) return
    setIsExportingBanner(true)
    setError('')
    try {
      const mime = 'image/png'
      const sides: AssetSide[] = isSpeakerBadge
        ? bothBadgeSides ? ['front', 'back'] : [activeSide]
        : [activeSide]
      const exportStates = sides.flatMap((side) => {
        const sideState = isSpeakerBadge ? stateForSide(state, side) : state
        const cards = isSpeakerBadge ? getSpeakerCardsForState(sideState, true) : speakerCards
        const exportCards = cards.length ? cards : [sideState.speakers]
        return exportCards.map((speakers) => {
        const cardState = { ...sideState, speakers }
        const sideTemplate = assetCatalog.flatMap((asset) => asset.templates)
          .find((template) => template.legacyFormat === cardState.format && template.qr)
        const profiles = cardState.speakers.flatMap((speaker) => {
          if (!speaker.personId) return []
          const profile = getCatalogPublicProfile(speaker.personId)
          return profile?.destinations.length ? [profile] : []
        })
        const destination = isSpeakerBadge && side === 'back' && sideTemplate?.qr
          ? cardState.qrDestination ?? defaultQRDestination(
            sideTemplate.qr.defaultDestinationKind,
            profiles,
            catalogSponsors,
            sideTemplate.qr.allowNone,
          )
          : undefined
        return {
          ...cardState,
          ...(destination ? { qrDestination: destination } : {}),
          ...(destination && sideTemplate?.qr ? { qrReadableText: cardState.qrReadableText ?? sideTemplate.qr.defaultReadableText } : {}),
        }
      })
      })

      if (isSpeakerBadge) {
        const findingsBySide: Array<{ side: AssetSide; findings: ValidationFinding[] }> = []
        for (const exportState of exportStates) {
          const info = createRenderInfo()
          const checkCanvas = document.createElement('canvas')
          await renderBanner(checkCanvas, exportState, format, backgroundFailed, 1, info)
          const findings = [
            ...validateState(exportState, format.id, info),
            ...checkRenderedCanvas(checkCanvas, info),
          ]
          const template = assetCatalog.flatMap((asset) => asset.templates)
            .find((item) => item.legacyFormat === exportState.format && item.qr)
          if (exportState.activeSide === 'back' && template?.qr && exportState.qrDestination) {
            const resolution = resolveCatalogQRDestination(exportState.qrDestination)
            const message = qrDestinationErrorMessage(exportState.qrDestination, resolution, template.qr.allowNone)
            if (message) findings.push({
              code: 'invalid-qr-destination',
              severity: 'error',
              field: 'QR destination',
              message,
              targetId: getQRDestinationControlId(exportState.qrDestination),
            })
          }
          findingsBySide.push({ side: exportState.activeSide ?? 'front', findings })
        }
        setBadgeExportFindings(findingsBySide)
        if (findingsBySide.some(({ findings }) => findings.some(({ severity }) => severity === 'error'))) return
      }

      const historyItems: BannerHistoryItem[] = []

      for (let i = 0; i < exportStates.length; i += 1) {
        const exportState = {
          ...exportStates[i],
          ...(!isSpeakerBadge && qrDestination ? { qrDestination, qrReadableText } : {}),
        }
        const offscreen = document.createElement('canvas')
        await renderBanner(offscreen, exportState, format, backgroundFailed, exportState.export.scale)
        const dataUrl = offscreen.toDataURL(mime, 0.95)

        const previewCanvas = document.createElement('canvas')
        await renderBanner(previewCanvas, exportState, format, backgroundFailed, 1)
        const previewDataUrl = previewCanvas.toDataURL('image/jpeg', 0.8)

        historyItems.push({
          id: uid(),
          createdAt: new Date().toISOString(),
          state: exportState,
          previewDataUrl,
        })

        const speakerSuffix =
          exportStates.length > 1
            ? `-${(exportState.speakers.map((speaker) => speaker.name).join('-') || `speaker-${i + 1}`)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '') || `speaker-${i + 1}`}`
            : ''

        const prefix = filenamePrefixByFormat[exportState.format]
        const citySlug =
          (exportState.event.city || 'city')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'city'

        const link = document.createElement('a')
        link.href = dataUrl
        const personSlug = (exportState.speakers.map((speaker) => speaker.name).join('-') || `speaker-${i + 1}`)
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `speaker-${i + 1}`
        const titleSlug = (exportState.event.title || exportState.event.edition || '')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        link.download = isSpeakerBadge
          ? `${prefix}-${citySlug}${titleSlug ? `-${titleSlug}` : ''}-${personSlug}-${exportState.activeSide ?? 'front'}.png`
          : `${prefix}-github-copilot-dev days-${citySlug}${speakerSuffix}.png`
        link.click()
      }

      setHistory((previous) => {
        const next = [...historyItems.reverse(), ...previous].slice(0, MAX_HISTORY_ITEMS)
        writeBannerHistory(next)
        return next
      })
      showToast(
        exportStates.length > 1
          ? `Downloaded ${exportStates.length} PNG files${isSpeakerBadge && bothBadgeSides ? ' · Front and Back' : ''}.`
          : 'PNG downloaded.',
      )
    } catch {
      setError('Could not export the PNG. Try again — if it keeps failing, reload the page.')
    } finally {
      setIsExportingBanner(false)
    }
  }

  const exportEventPack = async () => {
    if (isExportingPack) return
    setError('')
    setIsExportingPack(true)
    setPackProgress({ completed: 0, total: 0, label: 'Preparing' })

    try {
      const pack = await buildEventPack(state, setPackProgress)
      const url = URL.createObjectURL(pack.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = pack.fileName
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError('Could not create the event pack. Try again.')
    } finally {
      setIsExportingPack(false)
      setPackProgress(null)
    }
  }

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Invalid file. Please upload images only.')
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new Error('File too large. Max size is 8MB per image.')
    }
    return fileToDataUrl(file)
  }

  const restoreBanner = (item: BannerHistoryItem) => {
    setState(normalizeState(item.state))
    setShowHistory(false)
  }

  const removeHistoryItem = (id: string) => {
    setHistory((previous) => {
      const next = previous.filter((item) => item.id !== id)
      writeBannerHistory(next)
      return next
    })
  }

  const clearHistory = () => {
    setHistory([])
    writeBannerHistory([])
  }

  const switchMobileView = (view: 'fields' | 'preview') => {
    if (isMobileViewport) {
      if (view === 'preview') mobileFieldsScrollY.current = window.scrollY
      setMobileView(view)
      requestAnimationFrame(() => {
        window.scrollTo(0, view === 'preview' ? 0 : mobileFieldsScrollY.current)
      })
      return
    }
    setMobileView(view)
  }

  const handleMobileViewKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!isMobileViewport || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
    event.preventDefault()
    const view = event.key === 'ArrowRight' ? 'preview' : 'fields'
    switchMobileView(view)
    document.getElementById(`mobile-${view}-tab`)?.focus()
  }

  const changeAssetSide = (side: AssetSide) => setStateRaw((previous) => switchAssetSide(previous, side))
  const handleAssetSideKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const index = templateSides.indexOf(activeSide)
    let nextIndex = index
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % templateSides.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + templateSides.length) % templateSides.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = templateSides.length - 1
    else return
    event.preventDefault()
    const nextSide = templateSides[nextIndex]
    changeAssetSide(nextSide)
    document.getElementById(`asset-side-${nextSide}`)?.focus()
  }

  const dismissEditorGuide = () => {
    try {
      window.localStorage.setItem(EDITOR_GUIDE_STORAGE_KEY, 'dismissed')
      setShowEditorGuide(false)
    } catch {
      setError('Could not save your guide preference. You can close this guide again later.')
    }
  }

  return (
    <div className="editor-shell" data-color-mode={shellMode} data-mobile-view={mobileView}>
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-icon" aria-hidden="true">
            <CopilotIcon size={20} />
          </span>
          <h1>Dev Days</h1>
        </div>

        <div className="topbar-actions">
          <button
            className="topbar-theme-toggle"
            type="button"
            aria-label={`Switch to ${shellMode === 'light' ? 'dark' : 'light'} theme`}
            aria-pressed={shellMode === 'dark'}
            onClick={onToggleShellMode}
          >
            {shellMode === 'light' ? 'Dark' : 'Light'}
          </button>
          <AttendeeCsvImport />
          <IconButton
            as="a"
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
            title="View on GitHub"
            aria-label="View the project repository on GitHub"
            icon={MarkGithubIcon}
            size="medium"
          />
          <IconButton
            icon={HistoryIcon}
            size="medium"
            title="Previous banners"
            aria-label="Toggle previous banners"
            aria-pressed={showHistory}
            onClick={() => setShowHistory((value) => !value)}
            className={showHistory ? 'topbar-history-toggle active' : 'topbar-history-toggle'}
          />
        </div>
      </header>

      <main className="editor-body">
        {showAssetChooser ? (
          <AssetStartScreen
            onBack={() => setShowAssetChooser(false)}
            onSelectAsset={(format) => {
              setState((previous) => ({ ...previous, format }))
              setShowAssetChooser(false)
              setMobileView('fields')
            }}
          />
        ) : (
        <>
        <div
          className="mobile-view-tabs"
          role={isMobileViewport ? 'tablist' : undefined}
          aria-label={isMobileViewport ? 'Editor view' : undefined}
        >
          <button
            id="mobile-fields-tab"
            aria-controls={isMobileViewport ? 'mobile-fields-panel' : undefined}
            aria-selected={isMobileViewport ? mobileView === 'fields' : undefined}
            onKeyDown={handleMobileViewKeyDown}
            onClick={() => switchMobileView('fields')}
            role={isMobileViewport ? 'tab' : undefined}
            tabIndex={mobileView === 'fields' ? 0 : -1}
            type="button"
          >
            Fields
          </button>
          <button
            id="mobile-preview-tab"
            aria-controls={isMobileViewport ? 'mobile-preview-panel' : undefined}
            aria-selected={isMobileViewport ? mobileView === 'preview' : undefined}
            onKeyDown={handleMobileViewKeyDown}
            onClick={() => switchMobileView('preview')}
            role={isMobileViewport ? 'tab' : undefined}
            tabIndex={mobileView === 'preview' ? 0 : -1}
            type="button"
          >
            Preview
          </button>
        </div>
        <AssetNavigation
          format={state.format}
          open={openSections['section-format']}
          onFormatSelect={(nextFormat) => {
            if (state.format !== nextFormat) showToast('Format changed — the fields shown adapt to this format.')
            setState((previous) => ({ ...previous, format: nextFormat }))
          }}
          onToggle={handleSectionToggle('section-format')}
        />
        <aside
          id="mobile-fields-panel"
          className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
          aria-label="Properties"
          role={isMobileViewport ? 'tabpanel' : undefined}
          aria-labelledby={isMobileViewport ? 'mobile-fields-tab' : undefined}
          tabIndex={isMobileViewport ? -1 : undefined}
        >
          <div className="sidebar-header">
            <IconButton
              icon={sidebarCollapsed ? SidebarExpandIcon : SidebarCollapseIcon}
              size="medium"
              title={sidebarCollapsed ? 'Expand panel' : 'Collapse panel'}
              aria-label={sidebarCollapsed ? 'Expand panel' : 'Collapse panel'}
              aria-expanded={!sidebarCollapsed}
              onClick={() => setSidebarCollapsed((value) => !value)}
            />
            <span className="sidebar-title">Properties</span>
            <Button className="asset-picker-toggle" size="small" onClick={() => setShowAssetChooser(true)}>
              Choose asset
            </Button>
            <button
              type="button"
              className="sections-toggle"
              onClick={() => {
                const open = !allSectionsOpen
                setSectionOpen(Object.fromEntries(renderedSectionIds.map((id) => [id, open])))
              }}
            >
              {allSectionsOpen ? 'Collapse all' : 'Show all'}
            </button>
          </div>

          <div className="sidebar-content">
          {isSpeakerBadge && activeSide === 'front' && selectedArtboardField?.toLowerCase() === 'speaker name' && movableElementIds.includes('speaker-name') && (
            <section className="element-position-controls" aria-label="Selected element position">
              <h2>Speaker name position</h2>
              <p>Drag the selected name on desktop or adjust its position here. Arrow keys move 1 px; Shift + arrow moves 10 px.</p>
              <div className="element-position-inputs">
                {(['x', 'y'] as const).map((axis) => {
                  const position = state.elementOffsets?.['speaker-name'] ?? { x: 0, y: 0 }
                  const limit = axis === 'x' ? 40 : 24
                  return (
                    <label key={axis}>
                      <span>{axis.toUpperCase()} offset</span>
                      <input
                        aria-label={`Speaker name ${axis.toUpperCase()} offset`}
                        type="number"
                        min={-limit}
                        max={limit}
                        step={1}
                        value={position[axis]}
                        onChange={(event) => {
                          const next = Number(event.target.value)
                          if (!Number.isFinite(next)) return
                          setTemplateElementPosition('speaker-name', { ...position, [axis]: next })
                        }}
                      />
                    </label>
                  )
                })}
                <Button size="small" onClick={() => setTemplateElementPosition('speaker-name', { x: 0, y: 0 })}>Reset</Button>
              </div>
            </section>
          )}
          {showEditorGuide && (
            <section className="editor-guide" role="region" aria-labelledby="editor-guide-title">
              <div className="editor-guide-header">
                <h2 id="editor-guide-title">A quick guide</h2>
                <button className="editor-guide-dismiss" onClick={dismissEditorGuide} type="button">
                  Dismiss
                </button>
              </div>
              <ol>
                <li><strong>Format</strong> chooses the image shape and channel.</li>
                <li><strong>Event preset</strong> fills event details; <strong>Design theme</strong> sets the visual identity.</li>
                <li>Edit the event, speaker, and partner details for this image.</li>
                <li>Review validation messages and follow their field links to fix issues.</li>
                <li><strong>Download PNG</strong> saves this format; <strong>Event pack (.zip)</strong> includes every format.</li>
              </ol>
            </section>
          )}
          {backgroundFailed && <p className="warning">Background image unavailable: using gradient fallback for preview.</p>}

          <details
            className="side-section"
            open={openSections['section-event']}
            onToggle={handleSectionToggle('section-event')}
            id="section-event"
          >
            <summary>
              <span>Event</span>
              <ChevronDownIcon size={16} className="chevron" />
            </summary>
            <div className="section-block">
              <FormControl id="event-preset">
                <FormControl.Label>Event preset</FormControl.Label>
                <Select id="event-preset" block defaultValue="" onChange={(e) => applyPreset(e.target.value)}>
                  <Select.Option value="">Choose a preset…</Select.Option>
                  {eventPresets.map((preset) => <Select.Option key={preset.id} value={preset.id}>{preset.name}</Select.Option>)}
                </Select>
                <FormControl.Caption>A recipe that fills event details; it does not change the format or visual identity.</FormControl.Caption>
              </FormControl>
              <div className="theme-picker">
                <span className="picker-label" id="theme-label">Design theme</span>
                <div className="theme-grid" role="group" aria-labelledby="theme-label">
                  {Object.values(EVENT_THEMES).map((theme) => (
                    <button
                      aria-pressed={state.theme === theme.id}
                      aria-label={theme.name}
                      className={`card-option theme-card${state.theme === theme.id ? ' selected' : ''}`}
                      key={theme.id}
                      onClick={() => applyTheme(theme.id)}
                      type="button"
                    >
                      <strong>{theme.name}</strong>
                      <span
                        className="theme-mini"
                        aria-hidden="true"
                        style={{ backgroundColor: theme.colors.background }}
                      >
                        <span className="theme-mini-accent" style={{ backgroundColor: theme.colors.accent }} />
                        <span className="theme-mini-title" style={{ color: theme.colors.primary }}>
                          {theme.fixedEventTitle}
                        </span>
                        <span className="theme-mini-line" style={{ backgroundColor: theme.colors.secondary }} />
                        <span className="theme-mini-line short" style={{ backgroundColor: theme.colors.secondary }} />
                      </span>
                      <span
                        className="swatch-row"
                        aria-label={`Colors: ${theme.colors.primary}, ${theme.colors.accent}, ${theme.colors.background}`}
                      >
                        {[theme.colors.primary, theme.colors.accent, theme.colors.background].map((color) => (
                          <span key={color} style={{ backgroundColor: color }} />
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-grid single">
                <FormControl id="event-title" className={isControlTruncated('event-title') ? 'fit-warning' : undefined}>
                  <FormControl.Label>Event title</FormControl.Label>
                  {isControlTruncated('event-title') && (
                    <span className="fit-indicator" title="This text was too long for the banner and will be cut with an ellipsis. Shorten it or pick a larger format.">
                      <AlertIcon size={12} /> Truncates in banner
                    </span>
                  )}
                  <TextInput
                    id="event-title"
                    block
                    maxLength={80}
                    value={state.event.title}
                    onChange={(e) => updateEvent({ title: e.target.value })}
                  />
                </FormControl>
                {isLumaCover && (
                  <FormControl id="event-edition" className={isControlTruncated('event-edition') ? 'fit-warning' : undefined}>
                    <FormControl.Label>Event edition</FormControl.Label>
                    {isControlTruncated('event-edition') && (
                      <span className="fit-indicator" title="This text was too long for the banner and will be cut with an ellipsis. Shorten it or pick a larger format.">
                        <AlertIcon size={12} /> Truncates in banner
                      </span>
                    )}
                    <TextInput
                      id="event-edition"
                      block
                      maxLength={40}
                      value={state.event.edition}
                      onChange={(e) => updateEvent({ edition: e.target.value })}
                      placeholder="Professional"
                    />
                    <FormControl.Caption>Examples: Professional or Students</FormControl.Caption>
                  </FormControl>
                )}
                <FormControl id="event-city" className={isControlTruncated('event-city') ? 'fit-warning' : undefined}>
                  <FormControl.Label>City</FormControl.Label>
                  {isControlTruncated('event-city') && (
                    <span className="fit-indicator" title="This text was too long for the banner and will be cut with an ellipsis. Shorten it or pick a larger format.">
                      <AlertIcon size={12} /> Truncates in banner
                    </span>
                  )}
                  <TextInput
                    id="event-city"
                    block
                    value={state.event.city}
                    onChange={(e) => updateEvent({ city: e.target.value })}
                  />
                </FormControl>
                <FormControl id="event-datetime" className={isControlTruncated('event-datetime') ? 'fit-warning' : undefined}>
                  <FormControl.Label>Date and time</FormControl.Label>
                  {isControlTruncated('event-datetime') && (
                    <span className="fit-indicator" title="This text was too long for the banner and will be cut with an ellipsis. Shorten it or pick a larger format.">
                      <AlertIcon size={12} /> Truncates in banner
                    </span>
                  )}
                  <TextInput
                    id="event-datetime"
                    block
                    value={state.event.dateTime}
                    onChange={(e) => updateEvent({ dateTime: e.target.value })}
                  />
                  <FormControl.Caption>Example: Apr 15 • 7:00 PM</FormControl.Caption>
                </FormControl>
                {isSocialPromo && (
                  <FormControl id="event-location">
                    <FormControl.Label>Location</FormControl.Label>
                    <Textarea
                      id="event-location"
                      block
                      rows={2}
                      value={state.event.location}
                      onChange={(e) => updateEvent({ location: e.target.value })}
                    />
                    <FormControl.Caption>Can wrap to 2 lines in Social Promo</FormControl.Caption>
                  </FormControl>
                )}
                {(isSocialPromo || isSpeakerBanner) && (
                  <p className="section-description">
                    The registration footer controls live in the advanced section at the bottom of the sidebar.
                  </p>
                )}
              </div>
            </div>
          </details>

          {!isMinimalCover && !isSocialPromo && (
          <details
            className="side-section"
            open={openSections['section-speakers']}
            onToggle={handleSectionToggle('section-speakers')}
            id="section-speakers"
          >
            <summary>
              <span>Speakers <small className="section-count">{state.speakers.length} / {MAX_SPEAKERS}</small></span>
              <ChevronDownIcon size={16} className="chevron" />
            </summary>
            <div className="section-block">
              {isSpeakerSquare || isSpeakerBanner ? (
                <FormControl id="speakers-per-card">
                  <FormControl.Label>Speakers per card</FormControl.Label>
                  <Select
                    value={String(state.speakersPerCard)}
                    onChange={(event) => setState((previous) => ({
                      ...previous,
                      speakersPerCard: Number(event.target.value) as SpeakersPerCard,
                    }))}
                  >
                    <Select.Option value="1">One speaker per card</Select.Option>
                    <Select.Option value="2">Two speakers per card</Select.Option>
                  </Select>
                </FormControl>
              ) : null}
              {isSpeakerBanner && state.speakersPerCard === 2 && (
                <FormControl id="speaker-banner-pair-layout">
                  <FormControl.Label>Pair layout</FormControl.Label>
                  <Select
                    value={state.speakerBannerPairLayout}
                    onChange={(event) => setState((previous) => ({
                      ...previous,
                      speakerBannerPairLayout: event.target.value as BannerState['speakerBannerPairLayout'],
                    }))}
                  >
                    <Select.Option value="side_by_side">Side by side</Select.Option>
                    <Select.Option value="stacked">Stacked, text to the right</Select.Option>
                  </Select>
                </FormControl>
              )}
              <fieldset className="catalog-picker">
                <legend>Speakers from Planning</legend>
                <FormControl id="catalog-event-filter">
                  <FormControl.Label>Event</FormControl.Label>
                  <Select value={catalogEventFilter} onChange={(e) => setCatalogEventFilter(e.target.value)}>
                    <Select.Option value="">All events</Select.Option>
                    {catalogEventOptions.map((event) => <Select.Option key={event.id} value={event.id}>{event.label}</Select.Option>)}
                  </Select>
                </FormControl>
                <div className="catalog-options">
                  {visibleCatalogSpeakers.map((speaker) => (
                    <label key={speaker.speakerId} className="catalog-option">
                      <Checkbox
                        checked={selectedSpeakerIds.includes(speaker.speakerId)}
                        onChange={(event) => setSelectedSpeakerIds((current) => event.target.checked ? [...current, speaker.speakerId].slice(-MAX_SPEAKERS) : current.filter((id) => id !== speaker.speakerId))}
                      />
                      <span><strong>{speaker.name}</strong><small>{speaker.sessionTitle || 'Session title pending'} · {speaker.eventDate}</small></span>
                    </label>
                  ))}
                </div>
                <Button
                  type="button"
                  disabled={!selectedSpeakerIds.length || state.speakers.length >= MAX_SPEAKERS}
                  onClick={applyCatalogSpeakers}
                >
                  {state.speakers.length >= MAX_SPEAKERS ? `Speaker limit reached (${MAX_SPEAKERS})` : `Add selected speakers (${selectedSpeakerIds.length})`}
                </Button>
              </fieldset>
              {!state.speakers.length && (
                <div className="empty-speakers" role="status">
                  <p className="section-description">
                    No speakers yet. Pick them from the Planning catalogue above or add one manually to see them on the banner.
                  </p>
                  <Button type="button" variant="default" size="small" onClick={addManualSpeaker}>
                    Add speaker
                  </Button>
                </div>
              )}
              {state.speakers.map((speaker, index) => {
                const initials = speaker.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('') || '—'
                const publicProfile = speaker.personId ? getCatalogPublicProfile(speaker.personId) : undefined
                const publicHandle = getCatalogPublicHandle(publicProfile)
                return (
                <div key={speaker.id} className="speaker-card">
                  <div className="speaker-card-head">
                    <span className="speaker-card-id">
                      {speaker.photoDataUrl ? (
                        <img className="speaker-card-avatar" src={speaker.photoDataUrl} alt="" />
                      ) : (
                        <span className="speaker-card-avatar speaker-card-avatar-initials" aria-hidden="true">{initials}</span>
                      )}
                      Speaker {index + 1}
                    </span>
                    <Button type="button" size="small" variant="danger" onClick={() => removeSpeaker(speaker.id)}>Remove</Button>
                  </div>
                  <div className="form-grid single">
                    <FormControl id={`speaker-name-${speaker.id}`}>
                      <FormControl.Label required>Name</FormControl.Label>
                      <TextInput
                        id={`speaker-name-${speaker.id}`}
                        block
                        required
                        value={speaker.name}
                        onChange={(e) => updateSpeaker(speaker.id, { name: e.target.value })}
                      />
                    </FormControl>
                    <FormControl id={`speaker-role-${speaker.id}`}>
                      <FormControl.Label>Role</FormControl.Label>
                      <TextInput
                        id={`speaker-role-${speaker.id}`}
                        block
                        value={speaker.role ?? ''}
                        onChange={(e) => updateSpeaker(speaker.id, { role: e.target.value })}
                      />
                    </FormControl>
                    <FormControl id={`speaker-photo-${speaker.id}`}>
                      <FormControl.Label>Photo</FormControl.Label>
                      <input
                          id={`speaker-photo-${speaker.id}`}
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            void (async () => {
                              try {
                                const file = event.target.files?.[0]
                                if (!file) return
                                const dataUrl = await handleFile(file)
                                updateSpeaker(speaker.id, { photoDataUrl: dataUrl })
                            } catch (fileError) {
                              const message = fileError instanceof Error ? fileError.message : 'Invalid file.'
                              setError(message)
                              showToast(message)
                            }
                          })()
                        }}
                      />
                    </FormControl>
                  </div>
                  {!!publicProfile?.destinations.length && (
                    <nav className="speaker-profile-links" aria-label={`${speaker.name} public profiles`}>
                      {publicProfile.destinations.map(({ kind, url }) => (
                        <a key={kind} href={url} target="_blank" rel="noreferrer">{kind === 'x' ? 'X' : kind === 'github' ? 'GitHub' : kind === 'linkedin' ? 'LinkedIn' : 'Website'}</a>
                      ))}
                    </nav>
                  )}
                  {isSpeakerBadge && (
                    <div className="speaker-badge-handle-controls">
                      <label>
                        <Checkbox
                          aria-label="Show networking handle"
                          checked={speaker.badgeShowHandle ?? Boolean(speaker.badgeHandle ?? publicHandle)}
                          onChange={(event) => updateSpeaker(speaker.id, { badgeShowHandle: event.target.checked })}
                        />
                        Show handle
                      </label>
                      <FormControl id={`speaker-badge-handle-${speaker.id}`}>
                        <FormControl.Label>Networking handle</FormControl.Label>
                        <TextInput
                          block
                          aria-label="Networking handle"
                          value={speaker.badgeHandle ?? publicHandle ?? ''}
                          placeholder="No public handle available"
                          onChange={(event) => updateSpeaker(speaker.id, { badgeHandle: event.target.value })}
                        />
                      </FormControl>
                    </div>
                  )}
                  {!speaker.photoDataUrl && (
                    <small className="speaker-card-hint">No photo yet: the banner will render the speaker initials.</small>
                  )}
                </div>
                )
              })}
              <Button
                type="button"
                disabled={state.speakers.length >= MAX_SPEAKERS}
                onClick={addManualSpeaker}
              >
                Add speaker
              </Button>
            </div>
          </details>
          )}

          {(isSpeakerBanner || isSocialPromo) && (
          <details
            className="side-section"
            open={openSections['section-organizer']}
            onToggle={handleSectionToggle('section-organizer')}
            id="section-organizer"
          >
            <summary>
              <span>Organizer</span>
              <ChevronDownIcon size={16} className="chevron" />
            </summary>
            <div className="section-block">
              <FormControl id="organizer-select">
                <FormControl.Label>Select organizer</FormControl.Label>
                <Select
                  id="organizer-select"
                  block
                  value={selectedOrganizerId}
                  onChange={(e) => setSelectedOrganizerId(e.target.value)}
                >
                  <Select.Option value="">Choose an organizer…</Select.Option>
                  {catalogOrganizers.map((organizer) => (
                    <Select.Option key={organizer.id} value={organizer.id}>{organizer.name}</Select.Option>
                  ))}
                </Select>
              </FormControl>
              <Button disabled={!selectedOrganizerId} onClick={applyCatalogOrganizer}>Use selected organizer</Button>
              <FormControl id="organizer-logo-upload">
                <FormControl.Label>Or upload a logo</FormControl.Label>
                <input type="file" id="organizer-logo-upload" accept="image/*" onChange={(event) => { void (async () => {
                  try {
                    const file = event.target.files?.[0]
                    if (!file) return
                    updateEvent({ organizerLogoDataUrl: await handleFile(file) })
                  } catch (fileError) {
                    const message = fileError instanceof Error ? fileError.message : 'Invalid file.'
                    setError(message)
                    showToast(message)
                  }
                })() }} />
              </FormControl>
            </div>
          </details>
          )}

          {(isLumaCover || isSocialPromo || isSpeakerBanner || isSpeakerSquare) && (
          <details
            className="side-section"
            open={openSections['section-partners']}
            onToggle={handleSectionToggle('section-partners')}
            id="section-partners"
          >
            <summary>
              <span>Sponsors and collaborators</span>
              <ChevronDownIcon size={16} className="chevron" />
            </summary>
            <div className="section-block">
              <div className="resolution-toggle">
                <div>
                  <strong id="partner-logos-label">Do you want to include partner logos?</strong>
                  <span>Turn on to show the Supported by area when logos are uploaded.</span>
                </div>
                <ToggleSwitch
                  aria-labelledby="partner-logos-label"
                  buttonLabelOn=""
                  buttonLabelOff=""
                  checked={state.event.includeSupportedBy}
                  onChange={(checked) => updateEvent({ includeSupportedBy: checked })}
                />
              </div>
              <p className="section-description">
                Add up to 3 partner logos. They appear in the footer of the banner.
              </p>
              <FormControl id="sponsor-select">
                <FormControl.Label>Add from sponsor or collaborator catalogue</FormControl.Label>
                <Select
                  id="sponsor-select"
                  block
                  value={selectedSponsorId}
                  onChange={(e) => setSelectedSponsorId(e.target.value)}
                  disabled={state.partners.length >= 3}
                >
                  <Select.Option value="">Choose a sponsor…</Select.Option>
                  {catalogSponsors.map((sponsor) => (
                    <Select.Option key={sponsor.id} value={sponsor.id}>{sponsor.name}</Select.Option>
                  ))}
                </Select>
              </FormControl>
              <Button disabled={!selectedSponsorId || state.partners.length >= 3} onClick={addCatalogSponsor}>
                Add selected sponsor
              </Button>
              <FormControl id="sponsor-logo-upload">
                <FormControl.Label>Add logo</FormControl.Label>
                <input
                  type="file"
                  id="sponsor-logo-upload"
                  accept="image/*"
                  disabled={state.partners.length >= 3}
                  onChange={(event) => {
                    void (async () => {
                      try {
                        const file = event.target.files?.[0]
                        if (!file) return
                        if (state.partners.length >= 3) {
                          const message = 'You can upload up to 3 partner logos.'
                          setError(message)
                          showToast(message)
                          return
                        }
                        const dataUrl = await handleFile(file)
                        setState((previous) => ({
                          ...previous,
                          event: { ...previous.event, includeSupportedBy: true },
                          partners: [...previous.partners, { id: uid(), imageDataUrl: dataUrl }],
                        }))
                      } catch (fileError) {
                        const message = fileError instanceof Error ? fileError.message : 'Invalid file.'
                        setError(message)
                        showToast(message)
                      }
                    })()
                  }}
                />
              </FormControl>
              <p className="section-description">
                {state.partners.length >= 3
                  ? 'Partner logo limit reached (3/3). Remove one to upload another.'
                  : `${3 - state.partners.length} slot(s) remaining.`}
              </p>

              <div className="logos-grid">
                {state.partners.map((partner) => (
                  <div key={partner.id} className="logo-tile">
                    <img src={partner.imageDataUrl} alt={partner.name ? `${partner.name} logo` : 'Partner logo'} />
                    <Button
                      variant="invisible"
                      size="small"
                      className="logo-remove"
                      onClick={() => {
                        const index = state.partners.findIndex((item) => item.id === partner.id)
                        const removed = index >= 0 ? state.partners[index] : null
                        setState((previous) => ({
                          ...previous,
                          partners: previous.partners.filter((item) => item.id !== partner.id),
                        }))
                        if (removed) {
                          showToast('Partner logo removed.', () => {
                            setState((previous) => {
                              if (previous.partners.some((item) => item.id === removed.id)) return previous
                              const partners = [...previous.partners]
                              partners.splice(Math.min(index, partners.length), 0, removed)
                              return { ...previous, partners }
                            })
                          })
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </details>
          )}

          {qrTemplate?.qr && qrDestination && (
          <details
            className="side-section"
            open={openSections['section-qr']}
            onToggle={handleSectionToggle('section-qr')}
            id="section-qr"
          >
            <summary>
              <span>QR destination</span>
              <ChevronDownIcon size={16} className="chevron" />
            </summary>
            <QRDestinationControls
              template={qrTemplate}
              value={qrDestination}
              readableText={qrReadableText}
              profiles={qrProfiles}
              sponsors={catalogSponsors}
              resolution={resolveCatalogQRDestination(qrDestination)}
              onChange={(qrDestination) => setState((previous) => ({ ...previous, qrDestination }))}
              onReadableTextChange={(qrReadableText) => setState((previous) => ({ ...previous, qrReadableText }))}
            />
          </details>
          )}

          {(isSocialPromo || isSpeakerBanner) && (
          <details
            className="side-section"
            open={openSections['section-registration']}
            onToggle={handleSectionToggle('section-registration')}
            id="section-registration"
          >
            <summary>
              <span>Advanced: registration footer</span>
              <ChevronDownIcon size={16} className="chevron" />
            </summary>
            <div className="section-block">
              <div className="resolution-toggle">
                <div>
                  <strong id="registration-bar-label">Show registration footer bar</strong>
                  <span>Adds a CTA + short URL strip at the bottom of the banner.</span>
                </div>
                <ToggleSwitch
                  aria-labelledby="registration-bar-label"
                  checked={state.event.registrationEnabled}
                  onChange={(checked) => updateEvent({ registrationEnabled: checked })}
                />
              </div>

              {state.event.registrationEnabled && (
                <>
                  <FormControl id="registration-style">
                    <FormControl.Label>Registration bar style</FormControl.Label>
                    <Select
                      id="registration-style"
                      block
                      value={state.event.registrationStyle}
                      onChange={(e) =>
                        updateEvent({ registrationStyle: e.target.value as EventDetails['registrationStyle'] })
                      }
                    >
                      <Select.Option value="cta_url">CTA + URL</Select.Option>
                      <Select.Option value="url_only">URL only</Select.Option>
                    </Select>
                  </FormControl>

                  <FormControl id="registration-text" className={isControlTruncated('registration-text') ? 'fit-warning' : undefined}>
                    <FormControl.Label>CTA text</FormControl.Label>
                    {isControlTruncated('registration-text') && (
                      <span className="fit-indicator" title="This text was too long for the banner and will be cut with an ellipsis. Shorten it or pick a larger format.">
                        <AlertIcon size={12} /> Truncates in banner
                      </span>
                    )}
                    <TextInput
                      id="registration-text"
                      block
                      value={state.event.registrationText}
                      onChange={(e) => updateEvent({ registrationText: e.target.value })}
                      placeholder="Register now"
                    />
                  </FormControl>

                  <FormControl id="registration-url" required className={isControlTruncated('registration-url') ? 'fit-warning' : undefined}>
                    <FormControl.Label>Registration URL</FormControl.Label>
                    {isControlTruncated('registration-url') && (
                      <span className="fit-indicator" title="This text was too long for the banner and will be cut with an ellipsis. Shorten it or pick a larger format.">
                        <AlertIcon size={12} /> Truncates in banner
                      </span>
                    )}
                    <TextInput
                      id="registration-url"
                      block
                      required
                      value={state.event.registrationUrl}
                      onChange={(e) => updateEvent({ registrationUrl: e.target.value })}
                      placeholder="gh.io/devdays"
                    />
                  </FormControl>
                </>
              )}
            </div>
          </details>
          )}

          {error && <p className="error" role="alert">{error}</p>}
          </div>

          <div className="validation-panel" aria-label="Validation findings" role="status">
            {isSpeakerBadge && <strong className="side-validation-heading">{activeSide === 'front' ? 'Front' : 'Back'} checks</strong>}
            {validationFindings.length === 0 ? (
              <div role="status">
                <Banner variant="success" layout="compact" flush title="All checks passed" />
              </div>
            ) : (
                        validationFindings.map((finding) => {
                                    // Resolve target: for text-truncated, use the specific field name
                                    let target: { elementId: string; fieldId?: string } | undefined
                                    if (finding.code === 'text-truncated' && finding.field) {
                                      const specific = TRUNCATED_FIELD_MAP[finding.field]
                                      if (specific) {
                                        target = { elementId: specific.sectionId, fieldId: specific.fieldId }
                                      }
                                    }
                                    if (!target) {
                                      target = FINDING_TARGET_MAP[finding.code]
                                    }
                                    if (finding.code === 'invalid-qr-destination' && finding.targetId) {
                                      target = { elementId: 'section-qr', fieldId: finding.targetId }
                                    }
                                    const hasAction = !!target
                                    const findingId = `finding-${finding.code}-${Math.random().toString(36).slice(2, 8)}`

                                    return (
                                      <div key={`${finding.code}:${finding.field ?? ''}:${finding.message}`} className="validation-finding">
                                        <Banner
                                          id={findingId}
                                          variant={finding.severity === 'error' ? 'critical' : 'warning'}
                                          layout="compact"
                                          flush
                                          title={`${finding.severity === 'error' ? 'Error' : 'Warning'}: ${finding.message}`}
                                          aria-describedby={hasAction ? findingId : undefined}
                                        />
                                        {hasAction && target && (
                                          <button
                                            type="button"
                                            className="validation-go-to-field"
                                            onClick={() => navigateToField(finding)}
                                            aria-label={`Go to ${target.fieldId ? 'field' : 'section'}`}
                                          >
                                            Go to field
                                          </button>
                                        )}
                                      </div>
                                    )
                                  })
                                )}
                              </div>
            {isSpeakerBadge && badgeExportFindings && (
              <div className="badge-export-validation" role="status" aria-label="Both-side export checks">
                <strong>{badgeExportFindings.some(({ findings }) => findings.some(({ severity }) => severity === 'error'))
                  ? 'Resolve errors before downloading both sides.'
                  : 'Both-side export checks'}</strong>
                {[...new Set(badgeExportFindings.map(({ side }) => side))].map((side) => {
                  const findings = badgeExportFindings.filter((entry) => entry.side === side).flatMap((entry) => entry.findings)
                  return (
                    <div key={side} className="badge-export-validation-side">
                      <Button variant="invisible" onClick={() => changeAssetSide(side)}>{side === 'front' ? 'Front' : 'Back'}</Button>
                      <span>{findings.length ? findings.map(({ message }) => message).join(' ') : 'All checks passed.'}</span>
                    </div>
                  )
                })}
              </div>
            )}

          <div className="sidebar-footer">
            {/* #78: single clear download hierarchy in the sidebar —
                primary PNG CTA, secondary Event pack, then meta row. */}
            <div className="footer-download-stack">
                        <div className="download-summary">
                            {isSpeakerPerBannerFormat ? (
                              <>
                                <span>
                                  {downloadFileCount} {isSpeakerBadge ? 'speaker badge(s)' : 'speaker banner(s)'} · {format.width}×{format.height} each
                                </span>
                              </>
                            ) : (
                              <>
                                <span>Single PNG · {format.width}×{format.height}</span>
                              </>
                            )}
                          </div>
                          <div className={`split-download${isSpeakerBadge ? ' split-download-badge' : ''}`}>
                          <Button
                            className="download-main"
                            variant="primary"
                            loading={isExportingBanner}
                            leadingVisual={DownloadIcon}
                            trailingVisual={
                              validationIssueCount > 0 ? (
                                <>
                                  {/* #80: badge shows an X icon (red) for errors and an
                                      AlertIcon for warnings; both render as soft chips
                                      (warning: bg #fff8c5, ink #5a3e00, inset amber ring;
                                      error: red chip) so neither reads as a blocker on
                                      the export CTA. 🧭 DECISION — icons chosen: XIcon
                                      for errors, AlertIcon for warnings; warning chip
                                      kept as soft amber surface. Revert by restoring the
                                      solid amber badge. */}
                                  <CounterLabel
                                    className={`download-badge ${validationErrorCount > 0 ? 'error' : 'warning'}`}
                                    aria-hidden="true"
                                  >
                                    {validationErrorCount > 0 ? <XIcon size={10} /> : <AlertIcon size={10} />}
                                    {validationIssueCount}
                                  </CounterLabel>
                                </>
                              ) : null
                              }
                            onClick={() => {
                              void exportBanner()
                            }}
                            aria-label={
                              exportFindingsLabel
                                ? `Download PNG. Findings: ${exportFindingsLabel}`
                                : `Download ${downloadLabel}`
                            }
                          >
                            {downloadLabel}
                          </Button>
                          {isSpeakerBadge && (
                            <Button
                              className="download-both-sides"
                              loading={isExportingBanner}
                              disabled={isExportingBanner}
                              leadingVisual={DownloadIcon}
                              onClick={() => { void exportBanner(true) }}
                              aria-label={`Download both Speaker Badge sides as ${bothBadgeSideFileCount} PNG files`}
                            >
                              Both sides · {bothBadgeSideFileCount} PNGs
                            </Button>
                          )}
                          </div>
              <div className="pack-download-block">
                <Button
                  className="pack-download"
                  loading={isExportingPack}
                  leadingVisual={DownloadIcon}
                  trailingVisual={
                    validationIssueCount > 0 ? (
                      <CounterLabel
                        className={`download-badge ${validationErrorCount > 0 ? 'error' : 'warning'}`}
                        aria-hidden="true"
                      >
                        {validationErrorCount > 0 ? <XIcon size={10} /> : <AlertIcon size={10} />}
                        {validationIssueCount}
                      </CounterLabel>
                    ) : null
                  }
                  onClick={() => {
                    void exportEventPack()
                  }}
                  aria-label={exportFindingsLabel ? `Event pack (.zip). Findings: ${exportFindingsLabel}` : undefined}
                >
                  Event pack (.zip)
                </Button>
                {packProgress && (
                  <small aria-live="polite">
                    {packProgress.label}
                    {packProgress.total > 0 ? ` ${packProgress.completed}/${packProgress.total}` : ''}
                  </small>
                )}
              </div>
            </div>
            <div className="footer-meta-row">
              <Button variant="invisible" onClick={() => setResetConfirm(true)} title="Reset to defaults">
                Reset
              </Button>
              {draftStatus && (
                <span className="draft-status" aria-live="polite">
                  {draftStatus === 'saving' && '⏳ Saving…'}
                  {draftStatus === 'saved' && '✓ Saved'}
                  {draftStatus === 'error' && `✗ ${draftMessage || 'Could not save draft'}`}
                </span>
              )}
            </div>
            {resetConfirm && (
              <div className="reset-confirm-dialog">
                <p>Reset all fields to defaults? This will clear the current draft.</p>
                <div className="reset-confirm-actions">
                  <Button variant="invisible" onClick={() => setResetConfirm(false)}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={() => { void resetAll() }}>
                    Clear draft
                  </Button>
                </div>
              </div>
            )}
          </div>
        </aside>

        <section
          id="mobile-preview-panel"
          className="stage"
          aria-label="Preview"
          role={isMobileViewport ? 'tabpanel' : undefined}
          aria-labelledby={isMobileViewport ? 'mobile-preview-tab' : undefined}
          tabIndex={isMobileViewport ? -1 : undefined}
        >
          <div className="stage-canvas">
            {hasMultipleSides && (
              <div className="asset-side-tabs" role="tablist" aria-label="Asset side">
                {templateSides.map((side) => (
                  <button
                    key={side}
                    id={`asset-side-${side}`}
                    type="button"
                    role="tab"
                    aria-controls="asset-side-preview"
                    aria-selected={activeSide === side}
                    tabIndex={activeSide === side ? 0 : -1}
                    onKeyDown={handleAssetSideKeyDown}
                    onClick={() => changeAssetSide(side)}
                  >
                    {side === 'front' ? 'Front' : 'Back'}
                  </button>
                ))}
              </div>
            )}
            {!showMultiSpeakerPreviewGrid && (
              <div
                id={hasMultipleSides ? 'asset-side-preview' : undefined}
                role={hasMultipleSides ? 'tabpanel' : undefined}
                aria-labelledby={hasMultipleSides ? `asset-side-${activeSide}` : undefined}
                className="canvas-wrap"
                style={{ aspectRatio: `${format.width} / ${format.height}`, '--preview-zoom': zoom * previewBaseScale } as CSSProperties}
              >
                <canvas
                  ref={canvasRef}
                  aria-label={speakerCards[0]?.length === 2
                    ? `Banner preview for ${speakerCards[0].map((speaker) => speaker.name).join(' and ')}`
                    : 'Banner preview'}
                />
                <ArtboardSelectionOverlay
                  regions={canvasTextRegions}
                  width={format.width}
                  height={format.height}
                  selectedField={selectedArtboardField}
                  onSelect={selectArtboardField}
                  movableElementIds={activeSide === 'front' ? movableElementIds : []}
                  onMove={moveTemplateElement}
                />
              </div>
            )}

            {showMultiSpeakerPreviewGrid && speakerPreviews.length > 0 && (
              <div className="speaker-preview-block">
                <div className="history-header">
                  <h3>Speaker cards</h3>
                  <span>{speakerPreviews.length} real-time preview(s)</span>
                </div>
                <div className="speaker-preview-grid">
                  {speakerPreviews.map((item) => (
                    <article key={item.id} className="speaker-preview-item">
                      <img src={item.previewDataUrl} alt={`Preview card for ${item.name}`} />
                      <strong>{item.name}</strong>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="stage-toolbar" role="toolbar" aria-label="Canvas tools">
            <IconButton
              icon={ZoomInIcon}
              size="small"
              title="Zoom in"
              aria-label="Zoom in"
              onClick={zoomIn}
              className="stage-icon-btn"
            />
            <IconButton
              icon={ZoomOutIcon}
              size="small"
              title="Zoom out"
              aria-label="Zoom out"
              onClick={zoomOut}
              className="stage-icon-btn"
            />
            <IconButton
              icon={ScreenFullIcon}
              size="small"
              title="Fit to screen"
              aria-label="Fit to screen"
              onClick={fitZoom}
              className="stage-icon-btn"
            />
          </div>
        </section>

        {showHistory && (
          <aside className="history-drawer" aria-label="Previous banners">
            <div className="history-header">
              <h3>Previous banners</h3>
              <div className="history-header-actions">
                <Button size="small" onClick={clearHistory} disabled={history.length === 0}>
                  Clear all
                </Button>
                <IconButton
                  icon={XIcon}
                  size="small"
                  title="Close"
                  aria-label="Close previous banners"
                  onClick={() => setShowHistory(false)}
                />
              </div>
            </div>
            {history.length === 0 ? (
              <div className="history-empty" role="status">
                <HistoryIcon size={24} aria-hidden="true" />
                <p><strong>No previous banners yet.</strong></p>
                <p>Every export is saved here automatically, so you can restore or reuse it later.</p>
              </div>
            ) : (
              <div className="history-list">
                {history.map((item) => (
                  <article key={item.id} className="history-item">
                    <img src={item.previewDataUrl} alt="Saved banner preview" />
                    <div className="history-meta">
                      <strong>{formatOptions.find((option) => option.id === item.state.format)?.name ?? item.state.format}</strong>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                      <span>{item.state.event.city || 'City'} • {item.state.event.dateTime || 'Date/Time'}</span>
                    </div>
                    <div className="history-actions">
                      <Button size="small" onClick={() => restoreBanner(item)}>
                        Open
                      </Button>
                      <Button variant="danger" size="small" onClick={() => removeHistoryItem(item.id)}>
                        Delete
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </aside>
        )}

        {toast && (
          <div className="app-toast" role="status" onClick={dismissToast}>
            <span className="app-toast-message">{toast.message}</span>
            {toast.undo && (
              <Button
                size="small"
                onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                  event.stopPropagation()
                  toast.undo?.()
                  dismissToast()
                }}
              >
                Undo
              </Button>
            )}
            <IconButton
              icon={XIcon}
              size="small"
              aria-label="Dismiss notification"
              onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                event.stopPropagation()
                dismissToast()
              }}
            />
          </div>
        )}
        </>
        )}
      </main>
    </div>
  )
}

export default App
