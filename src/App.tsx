import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Banner, Button, Checkbox, CounterLabel, FormControl, IconButton, Select, TextInput, Textarea, ToggleSwitch } from '@primer/react'
import {
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
  BannerFormat,
  BannerHistoryItem,
  BannerState,
  EventDetails,
  EventThemeId,
  FormatOption,
  Speaker,
} from './types'
import { uid } from './lib/format'
import { buildDefaultState, normalizeState, readBannerHistory, writeBannerHistory } from './lib/history'
import { readDraft, writeDraft, clearDraft } from './lib/draft'
import { fileToDataUrl, getBackgroundImage, loadImage } from './lib/image'
import { renderBanner } from './lib/renderBanner'
import { createRenderInfo, validateState, type ValidationFinding } from './lib/validate'
import { checkRenderedCanvas } from './lib/pixelChecks'
import { catalogOrganizers, catalogSpeakers, catalogSponsors, eventPresets } from './lib/catalog'
import { buildEventPack, type EventPackProgress } from './lib/exportPack'

function App() {
  const [backgroundFailed, setBackgroundFailed] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
  const validationErrorCount = validationFindings.filter((f) => f.severity === 'error').length
  const validationIssueCount = validationFindings.length
  const exportFindingsLabel =
    validationIssueCount > 0
      ? `${validationErrorCount} error${validationErrorCount === 1 ? '' : 's'}, ${validationIssueCount - validationErrorCount} warning${validationIssueCount - validationErrorCount === 1 ? '' : 's'}`
      : ''
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [state, setState] = useState<BannerState>(() => buildDefaultState())

    // Restore draft (or last export) on mount.
    useEffect(() => {
      let cancelled = false
      void (async () => {
        try {
          const draft = await readDraft()
          if (draft && !cancelled) {
            setState(normalizeState(draft))
            return
          }
        } catch {
          // ignore
        }
        try {
          const history = readBannerHistory()
          const lastExport = history[0]?.state
          if (lastExport && !cancelled) {
            setState(normalizeState(lastExport))
          }
        } catch {
          // ignore
        }
      })()
      return () => { cancelled = true }
    }, [])

  const [draftSaveStatus, setDraftSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

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
  const isTallBanner = format.width === 1080 && format.height === 1350
  const previewBaseScale = isTallBanner ? 0.78 : 1
  const namedSpeakers = useMemo(
    () => state.speakers.filter((speaker) => speaker.name.trim().length > 0).slice(0, MAX_SPEAKERS),
    [state.speakers],
  )
    /** How many PNG files the Download button will produce. */
    const downloadFileCount = isSpeakerPerBannerFormat ? namedSpeakers.length || 1 : 1
    /** Human-readable label for the Download button. */
    const downloadLabel = useMemo(() => {
      const dims = `${format.width}x${format.height}`
      if (downloadFileCount === 1) return `PNG · ${dims}`
      return `PNG · ${dims} · ${downloadFileCount} files`
    }, [format.width, format.height, downloadFileCount])
    const showMultiSpeakerPreviewGrid = isSpeakerPerBannerFormat && namedSpeakers.length > 1
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
      const findings = [...validateState(state, format.id, renderInfo), ...checkRenderedCanvas(targetCanvas, renderInfo)]
      if (cancelled) return
      setValidationFindings(findings)
      // Exposed for Playwright visual-validation specs.
      ;(window as unknown as { __devdaysValidation?: { findings: ValidationFinding[]; pixelChecks: typeof checkRenderedCanvas } }).__devdaysValidation = { findings, pixelChecks: checkRenderedCanvas }
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

  // Debounced draft save: persist the latest state to IndexedDB after 500ms of inactivity.
  useEffect(() => {
    setDraftSaveStatus('saving')
    const timer = setTimeout(() => {
          void (async () => {
            const ok = await writeDraft(state)
            setDraftSaveStatus(ok ? 'saved' : 'error')
            setTimeout(() => setDraftSaveStatus('idle'), 2000)
          })()
        }, 500)
    return () => clearTimeout(timer)
  }, [state])

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

  const removeSpeaker = (id: string) =>
    setState((previous) => ({ ...previous, speakers: previous.speakers.filter((speaker) => speaker.id !== id) }))

    /** Scroll to and focus a field by its id, with a brief highlight flash. */
    const navigateToField = (targetId: string | undefined) => {
      if (!targetId) return
      const el = document.getElementById(targetId)
      if (!el) return
      // Scroll into view with a smooth behavior
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Focus the first interactive element inside the section
      const input = el.querySelector<HTMLInputElement>('input, select, textarea')
      input?.focus()
      // Brief highlight via inline style
      el.style.transition = 'box-shadow 0.3s ease'
      el.style.boxShadow = '0 0 0 3px var(--color-accent-fg)'
      setTimeout(() => {
        el.style.boxShadow = ''
      }, 2000)
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

  const resetAll = () => {
      if (typeof window === 'undefined') return
      const confirmed = window.confirm('Reset to defaults? This will clear the saved draft.')
      if (!confirmed) return
      void clearDraft().catch(() => {})
      setState(buildDefaultState())
      setZoom(1)
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

  return (
    <div className="editor-shell">
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
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} aria-label="Editor controls">
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
          </div>

          <div className="sidebar-content">
          {backgroundFailed && <p className="warning">Background image unavailable: using gradient fallback for preview.</p>}

          <div className="format-bar">
            <FormControl id="format" className="format-select-label">
              <FormControl.Label>Format</FormControl.Label>
              <Select
                id="format"
                block
                value={state.format}
                onChange={(e) => setState((previous) => ({ ...previous, format: e.target.value as BannerFormat }))}
              >
                <Select.OptGroup label="Event formats">
                  {eventFormatIds
                    .map((id) => formatOptions.find((option) => option.id === id))
                    .filter((option): option is FormatOption => Boolean(option))
                    .map((option) => (
                      <Select.Option key={option.id} value={option.id}>
                        {option.name} — {option.width}x{option.height}
                                              {option.description ? ` — ${option.description}` : ''}
                                      </Select.Option>
                                    ))}
                                </Select.OptGroup>
                                <Select.OptGroup label="Speaker formats">
                                  {speakerFormatIds
                                    .map((id) => formatOptions.find((option) => option.id === id))
                                    .filter((option): option is FormatOption => Boolean(option))
                                    .map((option) => (
                                      <Select.Option key={option.id} value={option.id}>
                                        {option.name} — {option.width}x{option.height}
                                                                              {option.description ? ` — ${option.description}` : ''}
                                      </Select.Option>
                                    ))}
                                </Select.OptGroup>
              </Select>
            </FormControl>
          </div>

          <details className="side-section" open>
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
              </FormControl>
              <FormControl id="design-theme">
                <FormControl.Label>Design theme</FormControl.Label>
                <Select
                  id="design-theme"
                  block
                  value={state.theme}
                  onChange={(e) => applyTheme(e.target.value as EventThemeId)}
                >
                  {Object.values(EVENT_THEMES).map((theme) => (
                    <Select.Option key={theme.id} value={theme.id}>
                      {theme.name}
                    </Select.Option>
                  ))}
                </Select>
              </FormControl>
              <div className="form-grid single">
                <FormControl id="event-title">
                  <FormControl.Label>Event title</FormControl.Label>
                  <TextInput
                    id="event-title"
                    block
                    maxLength={80}
                    value={state.event.title}
                    onChange={(e) => updateEvent({ title: e.target.value })}
                  />
                </FormControl>
                {isLumaCover && (
                  <FormControl id="event-edition">
                    <FormControl.Label>Event edition</FormControl.Label>
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
                <FormControl id="event-city">
                  <FormControl.Label>City</FormControl.Label>
                  <TextInput
                    id="event-city"
                    block
                    value={state.event.city}
                    onChange={(e) => updateEvent({ city: e.target.value })}
                  />
                </FormControl>
                <FormControl id="event-datetime">
                  <FormControl.Label>Date and time</FormControl.Label>
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
                  <>
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

                        <FormControl id="registration-text">
                          <FormControl.Label>CTA text</FormControl.Label>
                          <TextInput
                            id="registration-text"
                            block
                            value={state.event.registrationText}
                            onChange={(e) => updateEvent({ registrationText: e.target.value })}
                            placeholder="Register now"
                          />
                        </FormControl>

                        <FormControl id="registration-url" required>
                          <FormControl.Label>Registration URL</FormControl.Label>
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
                  </>
                )}
              </div>
            </div>
          </details>

          {!isMinimalCover && !isSocialPromo && (
          <details className="side-section" id="speakers-section" open>
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

          {(isSpeakerBanner || isSocialPromo) && (
                    <details className="side-section" id="organizer-section" open>
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
          <details className="side-section" open>
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
                      variant="danger"
                      size="small"
                      onClick={() =>
                        setState((previous) => ({
                          ...previous,
                          partners: previous.partners.filter((item) => item.id !== partner.id),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </details>
          )}

          {error && <p className="error">{error}</p>}
          </div>

          <div className="validation-panel" aria-label="Validation findings" role="status">
                      {validationFindings.length === 0 ? (
                        <div role="status">
                          <Banner variant="success" layout="compact" flush>
                            <Banner.Title>All checks passed</Banner.Title>
                          </Banner>
                        </div>
                      ) : (
                        validationFindings.map((finding) => (
                          <Banner
                            key={`${finding.code}:${finding.field ?? ''}:${finding.message}`}
                            variant={finding.severity === 'error' ? 'critical' : 'warning'}
                            layout="compact"
                            flush
                                                    role="alert"
                                                  >
                                                      <Banner.Title>{finding.severity === 'error' ? 'Error' : 'Warning'}</Banner.Title>
                                                      <span>
                                                        {finding.message}
                              {finding.targetId && (
                                <button
                                  type="button"
                                  className="validation-navigate"
                                  onClick={() => navigateToField(finding.targetId)}
                                  aria-label={`Go to ${finding.field ?? 'field'}`}
                                >
                                  {' '}
                                  → {finding.field}
                                </button>
                              )}
                            </span>
                          </Banner>
                        ))
                      )}
                    </div>

          <div className="sidebar-footer">
            <Button variant="invisible" onClick={resetAll} title="Reset to defaults">
              Reset
            </Button>
                      {draftSaveStatus !== 'idle' && (
                        <small
                          className="draft-status"
                          aria-live="polite"
                          style={{ color: draftSaveStatus === 'error' ? 'var(--color-danger-fg)' : 'var(--color-fg-muted)' }}
                        >
                          {draftSaveStatus === 'saving' ? 'Saving…' : draftSaveStatus === 'saved' ? 'Saved' : 'Save failed'}
                        </small>
                      )}
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
                      {validationIssueCount}
                    </CounterLabel>
                  ) : null
                }
                onClick={() => {
                  void exportEventPack()
                }}
                aria-label={exportFindingsLabel ? `Event pack (.zip). Findings: ${exportFindingsLabel}` : undefined}
              >
                              Event pack (.zip) — all speakers
              </Button>
              {packProgress && (
                <small aria-live="polite">
                  {packProgress.label}
                  {packProgress.total > 0 ? ` ${packProgress.completed}/${packProgress.total}` : ''}
                </small>
              )}
            </div>
            <div className="split-download">
              <Button
                className="download-main"
                variant="primary"
                leadingVisual={DownloadIcon}
                trailingVisual={
                  validationIssueCount > 0 ? (
                    <CounterLabel
                      className={`download-badge ${validationErrorCount > 0 ? 'error' : 'warning'}`}
                      aria-hidden="true"
                    >
                      {validationIssueCount}
                    </CounterLabel>
                  ) : null
                }
                onClick={() => {
                  void exportBanner()
                }}
                aria-label={exportFindingsLabel ? `Download. Findings: ${exportFindingsLabel}` : undefined}
              >
                                {downloadLabel}
              </Button>
            </div>
          </div>
        </aside>

        <section className="stage" aria-label="Preview">
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
            <span className="toolbar-divider" aria-hidden="true" />
            <IconButton
              icon={DownloadIcon}
              size="small"
              variant="primary"
              title="Download"
              aria-label="Download"
              onClick={() => {
                void exportBanner()
              }}
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
      </div>
    </div>
  )
}

export default App
