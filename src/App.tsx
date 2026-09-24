import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ToggleEvent as ReactToggleEvent } from 'react'
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
import {
  eventFormatIds,
  EVENT_THEMES,
  filenamePrefixByFormat,
  formatOptions,
  getEventTheme,
  MAX_HISTORY_ITEMS,
  MAX_SPEAKERS,
  REPOSITORY_URL,
  speakerFormatIds,
} from './constants'
import type {
  BannerHistoryItem,
  BannerState,
  EventDetails,
  EventThemeId,
  Speaker,
} from './types'
import { uid } from './lib/format'
import { buildDefaultState, normalizeState, readBannerHistory, writeBannerHistory } from './lib/history'
import { fileToDataUrl, getBackgroundImage, loadImage } from './lib/image'
import { renderBanner } from './lib/renderBanner'
import { createRenderInfo, validateState, type ValidationFinding } from './lib/validate'
import { checkRenderedCanvas } from './lib/pixelChecks'
import { catalogOrganizers, catalogSpeakers, catalogSponsors, eventPresets } from './lib/catalog'
import { buildEventPack, type EventPackProgress } from './lib/exportPack'
import { readDraft, writeDraft, clearDraft } from './lib/draft'

const EDITOR_GUIDE_STORAGE_KEY = 'devdays-editor-guide-dismissed-v1'

function shouldShowEditorGuide() {
  try {
    return window.localStorage.getItem(EDITOR_GUIDE_STORAGE_KEY) !== 'dismissed'
  } catch {
    return true
  }
}

function App() {
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
  const [speakerPreviews, setSpeakerPreviews] = useState<Array<{ id: string; name: string; previewDataUrl: string }>>([])
  const [fontsReady, setFontsReady] = useState(() => typeof document === 'undefined' || !document.fonts)
  const [isExportingPack, setIsExportingPack] = useState(false)
  const [packProgress, setPackProgress] = useState<EventPackProgress | null>(null)
  const [validationFindings, setValidationFindings] = useState<ValidationFinding[]>([])
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
          if (!target) return

      // Scroll to the section
      const sectionEl = document.getElementById(target.elementId)
      if (sectionEl) {
        sectionEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Open the section if it's collapsed (through React state so the
        // controlled <details> stays in sync).
        if (sectionEl.tagName === 'DETAILS' && !(sectionEl as HTMLDetailsElement).open) {
          setSectionOpen((prev) => ({ ...prev, [target.elementId]: true }))
        }
      }

      // Focus the specific field if available
      if (target.fieldId) {
        const fieldEl = document.getElementById(target.fieldId)
        if (fieldEl) {
          setTimeout(() => {
            fieldEl.focus()
            fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
            // Briefly highlight the field
            fieldEl.classList.add('validation-highlight')
            setTimeout(() => fieldEl.classList.remove('validation-highlight'), 2000)
          }, 300)
        }
      }
    }

    const canvasRef = useRef<HTMLCanvasElement>(null)

  const [state, setState] = useState<BannerState>(() => buildDefaultState())
  const [draftStatus, setDraftStatus] = useState<'saving' | 'saved' | 'error' | null>(null)
  const draftSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const format = useMemo(
    () => formatOptions.find((item) => item.id === state.format) ?? formatOptions[0],
    [state.format],
  )
  const isLumaCover = state.format === 'luma_cover'
  const isSpeakerBanner = state.format === 'speaker_banner'
  const isSpeakerSquare = state.format === 'speaker_square'
  const isSocialPromo = state.format === 'social_promo'
  const isMinimalCover = isLumaCover
  const isSpeakerPerBannerFormat = isSpeakerBanner || isSpeakerSquare

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
    return ids
  }, [isMinimalCover, isSocialPromo, isSpeakerBanner, isLumaCover, isSpeakerSquare])
  const allSectionsOpen = renderedSectionIds.every((id) => openSections[id])
  const isTallBanner = format.width === 1080 && format.height === 1350
  const previewBaseScale = isTallBanner ? 0.78 : 1
  const namedSpeakers = useMemo(
    () => state.speakers.filter((speaker) => speaker.name.trim().length > 0).slice(0, MAX_SPEAKERS),
    [state.speakers],
  )
  const showMultiSpeakerPreviewGrid = isSpeakerPerBannerFormat && namedSpeakers.length > 1
  const downloadFileCount =
    isSpeakerPerBannerFormat && namedSpeakers.length > 1 ? namedSpeakers.length : 1
  const downloadLabel = `PNG · ${format.width}×${format.height}${downloadFileCount > 1 ? ` · ${downloadFileCount} files` : ''}`
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

    // Load the latest draft on mount. If a draft exists, restore it; otherwise
    // keep the default state so the user sees the pre-filled template.
    useEffect(() => {
      let cancelled = false
      readDraft()
        .then((draft) => {
          if (!cancelled && draft) {
            setState(normalizeState(draft))
          }
        })
        .catch(() => {
          if (!cancelled) setDraftStatus('error')
        })

      return () => {
        cancelled = true
      }
    }, [])

    // Debounced auto-save draft on state changes.
    useEffect(() => {
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
    }, [state])

  useEffect(() => {
    let cancelled = false

    const draw = async () => {
      if (cancelled) return
      const renderInfo = createRenderInfo()
      let targetCanvas: HTMLCanvasElement | null = null
      if (showMultiSpeakerPreviewGrid) {
        // The visible canvas is unmounted while the per-speaker grid is shown.
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
        // Render once to an offscreen canvas so validation still reflects what
        // an export would show.
        targetCanvas = document.createElement('canvas')
        try {
          await renderBanner(targetCanvas, state, format, previewBackgroundFailed, 1, renderInfo)
        } catch {
          return
        }
      } else {
        if (!canvasRef.current) return
        targetCanvas = canvasRef.current
        try {
          await renderBanner(targetCanvas, state, format, previewBackgroundFailed, 1, renderInfo)
        } catch {
          if (!cancelled) setError('Failed to render preview.')
          return
        }
      }
      const findings = [
        ...validateState(state, format.id, renderInfo),
        ...checkRenderedCanvas(targetCanvas, renderInfo),
      ]
      // Test hook: lets Playwright specs inject findings (e.g. an 'error'
      // severity, which real themes never produce) to verify badge styling.
      const injected = (window as unknown as { __devdaysInjectedFindings?: typeof findings }).__devdaysInjectedFindings
      const effectiveFindings = injected ?? findings
      if (cancelled) return
      setValidationFindings(effectiveFindings)
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
  }, [state, format, previewBackgroundFailed, showMultiSpeakerPreviewGrid, fontsReady])

  useEffect(() => {
    let cancelled = false

    const drawSpeakerPreviews = async () => {
      if (!isSpeakerPerBannerFormat || namedSpeakers.length <= 1) {
        setSpeakerPreviews([])
        return
      }

      const previews: Array<{ id: string; name: string; previewDataUrl: string }> = []

      for (const speaker of namedSpeakers) {
        const previewCanvas = document.createElement('canvas')
        const previewState: BannerState = {
          ...state,
          speakers: [speaker],
        }
        await renderBanner(previewCanvas, previewState, format, previewBackgroundFailed, 1)
        previews.push({
          id: speaker.id,
          name: speaker.name,
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
  }, [state, format, previewBackgroundFailed, isSpeakerPerBannerFormat, namedSpeakers, fontsReady])

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
          name: item.name,
          role: item.role,
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

    const resetAll = () => {
      setState(buildDefaultState())
      setZoom(1)
      clearDraft().catch(() => undefined)
    }

  const zoomIn = () => setZoom((value) => Math.min(2, Math.round((value + 0.1) * 10) / 10))
  const zoomOut = () => setZoom((value) => Math.max(0.3, Math.round((value - 0.1) * 10) / 10))
  const fitZoom = () => setZoom(1)

  const exportBanner = async () => {
    setError('')
    try {
      const mime = 'image/png'
      const speakersToExport = isSpeakerPerBannerFormat
        ? state.speakers.filter((speaker) => speaker.name.trim().length > 0).slice(0, MAX_SPEAKERS)
        : []
      const exportStates =
        speakersToExport.length > 1
          ? speakersToExport.map((speaker) => ({
              ...state,
              speakers: [speaker],
            }))
          : [state]

      const historyItems: BannerHistoryItem[] = []

      for (let i = 0; i < exportStates.length; i += 1) {
        const exportState = exportStates[i]
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
            ? `-${(exportState.speakers[0]?.name || `speaker-${i + 1}`)
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
        link.download = `${prefix}-github-copilot-dev days-${citySlug}${speakerSuffix}.png`
        link.click()
      }

      setHistory((previous) => {
        const next = [...historyItems.reverse(), ...previous].slice(0, MAX_HISTORY_ITEMS)
        writeBannerHistory(next)
        return next
      })
    } catch {
      setError('Could not export file.')
    }
  }

  const exportEventPack = async () => {
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
      setError('Could not create the event pack.')
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

  const dismissEditorGuide = () => {
    try {
      window.localStorage.setItem(EDITOR_GUIDE_STORAGE_KEY, 'dismissed')
      setShowEditorGuide(false)
    } catch {
      setError('Could not save your guide preference. You can close this guide again later.')
    }
  }

  return (
    <div className="editor-shell" data-mobile-view={mobileView}>
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-icon" aria-hidden="true">
            <CopilotIcon size={20} />
          </span>
          <h1>Dev Days</h1>
        </div>

        <div className="topbar-actions">
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

      <div className="editor-body">
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
        <aside
          id="mobile-fields-panel"
          className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
          aria-label="Editor controls"
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
            <span className="sidebar-title">Design</span>
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
                <p className="section-description">No speakers yet. Add them from the Planning catalogue or create one manually.</p>
              )}
              {state.speakers.map((speaker, index) => {
                const initials = speaker.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('') || '—'
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
                              setError(fileError instanceof Error ? fileError.message : 'Invalid file.')
                            }
                          })()
                        }}
                      />
                    </FormControl>
                  </div>
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

          <details
            className="side-section"
            open={openSections['section-format']}
            onToggle={handleSectionToggle('section-format')}
            id="section-format"
          >
            <summary>
              <span>Format</span>
              <ChevronDownIcon size={16} className="chevron" />
            </summary>
            <div className="section-block format-bar">
              <span className="picker-label" id="format-label">Choose a banner size</span>
              <div className="format-groups" role="group" aria-labelledby="format-label">
              {[
                { label: 'Event formats', ids: eventFormatIds },
                { label: 'Speaker formats', ids: speakerFormatIds },
              ].map((group) => (
                <div className="format-group" key={group.label}>
                  <h3>{group.label}</h3>
                  <div className="format-grid-pair">
                    {group.ids.map((id) => {
                      const option = formatOptions.find((item) => item.id === id)
                      if (!option) return null
                      return (
                        <button
                          aria-pressed={state.format === option.id}
                          aria-label={`${option.name}, ${option.width} by ${option.height}, ${option.description ?? ''}, ${option.channels?.join(', ') ?? ''}`}
                          className={`card-option format-card${state.format === option.id ? ' selected' : ''}`}
                          key={option.id}
                          onClick={() => {
                            // #82: brief toast when the format changes and fields get
                            // hidden/shown. Does not change state persistence.
                            if (state.format !== option.id) {
                              showToast('Format changed — edition and location fields updated.')
                            }
                            setState((previous) => ({ ...previous, format: option.id }))
                          }}
                          type="button"
                        >
                          <span className="format-ratio-wrap" aria-hidden="true">
                            <span
                              className="format-ratio"
                              style={{
                                aspectRatio: `${option.width} / ${option.height}`,
                                backgroundColor: state.colors.background,
                                borderColor: state.colors.secondary,
                              }}
                            >
                              <span style={{ backgroundColor: state.colors.accent }} />
                            </span>
                          </span>
                          <strong>{option.name}</strong>
                          <small>{option.width} × {option.height}</small>
                          <small>{option.description}</small>
                          <small>Channels: {option.channels?.join(', ')}</small>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            </div>
          </details>

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
                    setError(fileError instanceof Error ? fileError.message : 'Invalid file.')
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
                          setError('You can upload up to 3 partner logos.')
                          return
                        }
                        const dataUrl = await handleFile(file)
                        setState((previous) => ({
                          ...previous,
                          event: { ...previous.event, includeSupportedBy: true },
                          partners: [...previous.partners, { id: uid(), imageDataUrl: dataUrl }],
                        }))
                      } catch (fileError) {
                        setError(fileError instanceof Error ? fileError.message : 'Invalid file.')
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
                    <img src={partner.imageDataUrl} alt="Partner logo" />
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

          {error && <p className="error">{error}</p>}
          </div>

          <div className="validation-panel" aria-label="Validation findings" role="status">
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

          <div className="sidebar-footer">
            {/* #78: single clear download hierarchy in the sidebar —
                primary PNG CTA, secondary Event pack, then meta row. */}
            <div className="footer-download-stack">
                        <div className="download-summary">
                            {isSpeakerPerBannerFormat ? (
                              <>
                                <span>
                                  {namedSpeakers.length} speaker banner(s) · {format.width}×{format.height} each
                                </span>
                              </>
                            ) : (
                              <>
                                <span>Single PNG · {format.width}×{format.height}</span>
                              </>
                            )}
                          </div>
                          <div className="split-download">
                          <Button
                            className="download-main"
                            variant="primary"
                            leadingVisual={DownloadIcon}
                            trailingVisual={
                              validationIssueCount > 0 ? (
                                <>
                                  {/* #80: badge shows an X icon (red) for errors and a
                                      warning icon (amber, outline style so it does not
                                      read as a blocker on the export CTA). 🧭 DECISION
                                      — icons chosen: XIcon for errors, AlertIcon for
                                      warnings; warning badge restyled as amber outline.
                                      Revert by restoring the solid amber badge. */}
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
                  {draftStatus === 'error' && '✗ Draft error'}
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
                  <Button variant="danger" onClick={resetAll}>
                    Confirm Reset
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
            {!showMultiSpeakerPreviewGrid && (
              <div
                className="canvas-wrap"
                style={{ aspectRatio: `${format.width} / ${format.height}`, '--preview-zoom': zoom * previewBaseScale } as CSSProperties}
              >
                <canvas ref={canvasRef} aria-label="Banner preview" />
              </div>
            )}

            {showMultiSpeakerPreviewGrid && speakerPreviews.length > 0 && (
              <div className="speaker-preview-block">
                <div className="history-header">
                  <h3>Speaker banners</h3>
                  <span>{speakerPreviews.length} real-time preview(s)</span>
                </div>
                <div className="speaker-preview-grid">
                  {speakerPreviews.map((item) => (
                    <article key={item.id} className="speaker-preview-item">
                      <img src={item.previewDataUrl} alt={`Preview banner for ${item.name}`} />
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
              <p className="history-empty">No previous banners yet. Export one to save it here.</p>
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
      </div>
    </div>
  )
}

export default App
