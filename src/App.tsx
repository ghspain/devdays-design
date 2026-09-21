import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
  filenamePrefixByFormat,
  formatOptions,
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
  FormatOption,
  Speaker,
} from './types'
import { uid } from './lib/format'
import { buildDefaultState, normalizeState, readBannerHistory, writeBannerHistory } from './lib/history'
import { fileToDataUrl, getBackgroundImage, loadImage } from './lib/image'
import { renderBanner } from './lib/renderBanner'
import { createRenderInfo, validateState, type ValidationFinding } from './lib/validate'
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
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [state, setState] = useState<BannerState>(() => buildDefaultState())

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
      if (showMultiSpeakerPreviewGrid) {
        // The visible canvas is unmounted while the per-speaker grid is shown.
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
        // Render once to an offscreen canvas so validation still reflects what
        // an export would show.
        try {
          await renderBanner(document.createElement('canvas'), state, format, previewBackgroundFailed, 1, renderInfo)
        } catch {
          return
        }
      } else {
        if (!canvasRef.current) return
        try {
          await renderBanner(canvasRef.current, state, format, previewBackgroundFailed, 1, renderInfo)
        } catch {
          if (!cancelled) setError('Failed to render preview.')
          return
        }
      }
      const findings = validateState(state, format.id, renderInfo)
      if (cancelled) return
      setValidationFindings(findings)
      // Exposed for Playwright visual-validation specs.
      ;(window as unknown as { __devdaysValidation?: { findings: ValidationFinding[] } }).__devdaysValidation = { findings }
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

  const removeSpeaker = (id: string) =>
    setState((previous) => ({ ...previous, speakers: previous.speakers.filter((speaker) => speaker.id !== id) }))

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

  const resetAll = () => {
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
          <a
            className="icon-btn"
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
            title="View on GitHub"
            aria-label="View the project repository on GitHub"
          >
            <MarkGithubIcon size={18} />
          </a>
          <button
            type="button"
            className={`topbar-history-btn ${showHistory ? 'active' : ''}`}
            title="Previous banners"
            aria-label="Toggle previous banners"
            aria-pressed={showHistory}
            onClick={() => setShowHistory((value) => !value)}
          >
            <HistoryIcon size={16} />
            <span>Previous banners</span>
          </button>
        </div>
      </header>

      <div className="editor-body">
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} aria-label="Editor controls">
          <div className="sidebar-header">
            <button
              type="button"
              className="icon-btn"
              title={sidebarCollapsed ? 'Expand panel' : 'Collapse panel'}
              aria-label={sidebarCollapsed ? 'Expand panel' : 'Collapse panel'}
              aria-expanded={!sidebarCollapsed}
              onClick={() => setSidebarCollapsed((value) => !value)}
            >
              {sidebarCollapsed ? <SidebarExpandIcon size={18} /> : <SidebarCollapseIcon size={18} />}
            </button>
            <span className="sidebar-title">Design</span>
          </div>

          <div className="sidebar-content">
          {backgroundFailed && <p className="warning">Background image unavailable: using gradient fallback for preview.</p>}

          <div className="format-bar">
            <label className="format-select-label">
              <span className="label-row">
                Format
              </span>
              <select
                value={state.format}
                onChange={(e) => setState((previous) => ({ ...previous, format: e.target.value as BannerFormat }))}
              >
                <optgroup label="Event formats">
                  {eventFormatIds
                    .map((id) => formatOptions.find((option) => option.id === id))
                    .filter((option): option is FormatOption => Boolean(option))
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} — {option.width}x{option.height}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Speaker formats">
                  {speakerFormatIds
                    .map((id) => formatOptions.find((option) => option.id === id))
                    .filter((option): option is FormatOption => Boolean(option))
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} — {option.width}x{option.height}
                      </option>
                    ))}
                </optgroup>
              </select>
            </label>
          </div>

          <details className="side-section" open>
            <summary>
              <span>Event</span>
              <ChevronDownIcon size={16} className="chevron" />
            </summary>
            <div className="section-block">
              <label>
                Event preset
                <select defaultValue="" onChange={(e) => applyPreset(e.target.value)}>
                  <option value="">Choose a preset…</option>
                  {eventPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                </select>
              </label>
              <div className="form-grid single">
                <label>
                  Event title
                  <input type="text" maxLength={80} value={state.event.title} onChange={(e) => updateEvent({ title: e.target.value })} />
                </label>
                {isLumaCover && (
                  <label>
                    <span className="label-row">
                      Event edition
                      <small>Examples: Professional or Students</small>
                    </span>
                    <input
                      type="text"
                      maxLength={40}
                      value={state.event.edition}
                      onChange={(e) => updateEvent({ edition: e.target.value })}
                      placeholder="Professional"
                    />
                  </label>
                )}
                <label>
                  City
                  <input
                    type="text"
                    value={state.event.city}
                    onChange={(e) => updateEvent({ city: e.target.value })}
                  />
                </label>
                <label>
                  <span className="label-row">
                    Date and time
                    <small>Example: Apr 15 • 7:00 PM</small>
                  </span>
                  <input
                    type="text"
                    value={state.event.dateTime}
                    onChange={(e) => updateEvent({ dateTime: e.target.value })}
                  />
                </label>
                {isSocialPromo && (
                  <label>
                    <span className="label-row">
                      Location
                      <small>Can wrap to 2 lines in Social Promo</small>
                    </span>
                    <textarea
                      rows={2}
                      value={state.event.location}
                      onChange={(e) => updateEvent({ location: e.target.value })}
                    />
                  </label>
                )}
                {(isSocialPromo || isSpeakerBanner) && (
                  <>
                    <button
                      type="button"
                      className="resolution-toggle"
                      onClick={() => updateEvent({ registrationEnabled: !state.event.registrationEnabled })}
                    >
                      <div>
                        <strong>Show registration footer bar</strong>
                        <span>Adds a CTA + short URL strip at the bottom of the banner.</span>
                      </div>
                      <span className={`switch ${state.event.registrationEnabled ? 'on' : ''}`} aria-hidden="true">
                        <span />
                      </span>
                    </button>

                    {state.event.registrationEnabled && (
                      <>
                        <label>
                          Registration bar style
                          <select
                            value={state.event.registrationStyle}
                            onChange={(e) =>
                              updateEvent({ registrationStyle: e.target.value as EventDetails['registrationStyle'] })
                            }
                          >
                            <option value="cta_url">CTA + URL</option>
                            <option value="url_only">URL only</option>
                          </select>
                        </label>

                        <label>
                          CTA text
                          <input
                            type="text"
                            value={state.event.registrationText}
                            onChange={(e) => updateEvent({ registrationText: e.target.value })}
                            placeholder="Register now"
                          />
                        </label>

                        <label>
                          Registration URL *
                          <input
                            type="text"
                            value={state.event.registrationUrl}
                            onChange={(e) => updateEvent({ registrationUrl: e.target.value })}
                            placeholder="gh.io/devdays"
                          />
                        </label>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </details>

          {!isMinimalCover && !isSocialPromo && (
          <details className="side-section" open>
            <summary>
              <span>Speakers <small className="section-count">{state.speakers.length} / {MAX_SPEAKERS}</small></span>
              <ChevronDownIcon size={16} className="chevron" />
            </summary>
            <div className="section-block">
              <fieldset className="catalog-picker">
                <legend>Speakers from Planning</legend>
                <label>
                  Event
                  <select value={catalogEventFilter} onChange={(e) => setCatalogEventFilter(e.target.value)}>
                    <option value="">All events</option>
                    {catalogEventOptions.map((event) => <option key={event.id} value={event.id}>{event.label}</option>)}
                  </select>
                </label>
                <div className="catalog-options">
                  {visibleCatalogSpeakers.map((speaker) => (
                    <label key={speaker.speakerId} className="catalog-option">
                      <input type="checkbox" checked={selectedSpeakerIds.includes(speaker.speakerId)} onChange={(event) => setSelectedSpeakerIds((current) => event.target.checked ? [...current, speaker.speakerId].slice(-MAX_SPEAKERS) : current.filter((id) => id !== speaker.speakerId))} />
                      <span><strong>{speaker.name}</strong><small>{speaker.sessionTitle || 'Session title pending'} · {speaker.eventDate}</small></span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!selectedSpeakerIds.length || state.speakers.length >= MAX_SPEAKERS}
                  onClick={applyCatalogSpeakers}
                >
                  {state.speakers.length >= MAX_SPEAKERS ? `Speaker limit reached (${MAX_SPEAKERS})` : `Add selected speakers (${selectedSpeakerIds.length})`}
                </button>
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
                    <button type="button" className="danger" onClick={() => removeSpeaker(speaker.id)}>Remove</button>
                  </div>
                  <div className="form-grid single">
                    <label>
                      Name *
                      <input
                        type="text"
                        value={speaker.name}
                        onChange={(e) => updateSpeaker(speaker.id, { name: e.target.value })}
                      />
                    </label>
                    <label>
                      Role
                      <input
                        type="text"
                        value={speaker.role ?? ''}
                        onChange={(e) => updateSpeaker(speaker.id, { role: e.target.value })}
                      />
                    </label>
                    <label>
                      Photo
                      <input
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
                    </label>
                  </div>
                  {!speaker.photoDataUrl && (
                    <small className="speaker-card-hint">No photo yet: the banner will render the speaker initials.</small>
                  )}
                </div>
                )
              })}
              <button
                type="button"
                className="secondary-button"
                disabled={state.speakers.length >= MAX_SPEAKERS}
                onClick={addManualSpeaker}
              >
                Add speaker
              </button>
            </div>
          </details>
          )}

          {(isSpeakerBanner || isSocialPromo) && (
          <details className="side-section" open>
            <summary>
              <span>Organizer</span>
              <ChevronDownIcon size={16} className="chevron" />
            </summary>
            <div className="section-block">
              <label>
                Select organizer
                <select value={selectedOrganizerId} onChange={(e) => setSelectedOrganizerId(e.target.value)}>
                  <option value="">Choose an organizer…</option>
                  {catalogOrganizers.map((organizer) => <option key={organizer.id} value={organizer.id}>{organizer.name}</option>)}
                </select>
              </label>
              <button type="button" className="secondary-button" disabled={!selectedOrganizerId} onClick={applyCatalogOrganizer}>Use selected organizer</button>
              <label>
                Or upload a logo
                <input type="file" accept="image/*" onChange={(event) => { void (async () => {
                  try {
                    const file = event.target.files?.[0]
                    if (!file) return
                    updateEvent({ organizerLogoDataUrl: await handleFile(file) })
                  } catch (fileError) {
                    setError(fileError instanceof Error ? fileError.message : 'Invalid file.')
                  }
                })() }} />
              </label>
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
              <button
                type="button"
                className="resolution-toggle"
                onClick={() => updateEvent({ includeSupportedBy: !state.event.includeSupportedBy })}
              >
                <div>
                  <strong>Do you want to include partner logos?</strong>
                  <span>Turn on to show the Supported by area when logos are uploaded.</span>
                </div>
                <span className={`switch ${state.event.includeSupportedBy ? 'on' : ''}`} aria-hidden="true">
                  <span />
                </span>
              </button>
              <p className="section-description">
                Add up to 3 partner logos. They appear in the footer of the banner.
              </p>
              <label>
                Add from sponsor or collaborator catalogue
                <select value={selectedSponsorId} onChange={(e) => setSelectedSponsorId(e.target.value)} disabled={state.partners.length >= 3}>
                  <option value="">Choose a sponsor…</option>
                  {catalogSponsors.map((sponsor) => (
                    <option key={sponsor.id} value={sponsor.id}>{sponsor.name}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="secondary-button" disabled={!selectedSponsorId || state.partners.length >= 3} onClick={addCatalogSponsor}>
                Add selected sponsor
              </button>
              <label>
                Add logo
                <input
                  type="file"
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
              </label>
              <p className="section-description">
                {state.partners.length >= 3
                  ? 'Partner logo limit reached (3/3). Remove one to upload another.'
                  : `${3 - state.partners.length} slot(s) remaining.`}
              </p>

              <div className="logos-grid">
                {state.partners.map((partner) => (
                  <div key={partner.id} className="logo-tile">
                    <img src={partner.imageDataUrl} alt="Partner logo" />
                    <button
                      type="button"
                      className="danger"
                      onClick={() =>
                        setState((previous) => ({
                          ...previous,
                          partners: previous.partners.filter((item) => item.id !== partner.id),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </details>
          )}

          {error && <p className="error">{error}</p>}
          </div>

          <div className="validation-panel" aria-label="Validation findings">
            {validationFindings.length === 0 ? (
              <p className="validation-ok" role="status">
                <span className="validation-dot ok" aria-hidden="true" />
                All checks passed
              </p>
            ) : (
              <ul className="validation-list">
                {validationFindings.map((finding) => (
                  <li key={`${finding.code}:${finding.field ?? ''}:${finding.message}`} className={`validation-item ${finding.severity}`}>
                    <span className={`validation-dot ${finding.severity}`} aria-hidden="true" />
                    <span>{finding.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="sidebar-footer">
            <button type="button" className="ghost" onClick={resetAll} title="Reset to defaults">
              Reset
            </button>
            <div className="pack-download-block">
              <button
                type="button"
                className="pack-download"
                disabled={isExportingPack}
                onClick={() => {
                  void exportEventPack()
                }}
              >
                <DownloadIcon size={16} />
                <span>{isExportingPack ? 'Creating pack…' : 'Event pack (.zip)'}</span>
              </button>
              {packProgress && (
                <small aria-live="polite">
                  {packProgress.label}
                  {packProgress.total > 0 ? ` ${packProgress.completed}/${packProgress.total}` : ''}
                </small>
              )}
            </div>
            <div className="split-download">
              <button
                type="button"
                className="download-main"
                onClick={() => {
                  void exportBanner()
                }}
              >
                <DownloadIcon size={16} />
                <span>Download</span>
              </button>
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
            <button type="button" className="icon-btn" title="Zoom in" aria-label="Zoom in" onClick={zoomIn}>
              <ZoomInIcon size={18} />
            </button>
            <button type="button" className="icon-btn" title="Zoom out" aria-label="Zoom out" onClick={zoomOut}>
              <ZoomOutIcon size={18} />
            </button>
            <button type="button" className="icon-btn" title="Fit to screen" aria-label="Fit to screen" onClick={fitZoom}>
              <ScreenFullIcon size={18} />
            </button>
            <span className="toolbar-divider" aria-hidden="true" />
            <button
              type="button"
              className="icon-btn download"
              title="Download"
              aria-label="Download"
              onClick={() => {
                void exportBanner()
              }}
            >
              <DownloadIcon size={18} />
            </button>
          </div>
        </section>

        {showHistory && (
          <aside className="history-drawer" aria-label="Previous banners">
            <div className="history-header">
              <h3>Previous banners</h3>
              <div className="history-header-actions">
                <button type="button" onClick={clearHistory} disabled={history.length === 0}>
                  Clear all
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Close"
                  aria-label="Close previous banners"
                  onClick={() => setShowHistory(false)}
                >
                  <XIcon size={16} />
                </button>
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
                      <button type="button" onClick={() => restoreBanner(item)}>
                        Open
                      </button>
                      <button type="button" className="danger" onClick={() => removeHistoryItem(item.id)}>
                        Delete
                      </button>
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
