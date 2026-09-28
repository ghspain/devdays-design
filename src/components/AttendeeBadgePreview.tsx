import { useEffect, useRef } from 'react'
import { formatOptions } from '../constants'
import type { AttendeeBadgeInput } from '../domain/attendee'
import { buildDefaultState } from '../lib/history'
import { renderBanner } from '../lib/renderBanner'
import type { BannerState, EventThemeId } from '../types'

interface AttendeeBadgePreviewProps {
  sourceRowNumber: number
  attendee: AttendeeBadgeInput
  reasons: string[]
  theme: EventThemeId
  colors: BannerState['colors']
  event: BannerState['event']
}

export default function AttendeeBadgePreview({ sourceRowNumber, attendee, reasons, theme, colors, event }: AttendeeBadgePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const format = formatOptions.find(({ id }) => id === 'speaker_badge')
    if (!canvas || !format) return

    const state = buildDefaultState()
    state.format = 'speaker_badge'
    state.activeSide = 'front'
    state.theme = theme
    state.colors = colors
    state.event = event
    state.speakers = [{
      ...state.speakers[0],
      name: attendee.name,
      role: attendee.role,
      badgeHandle: attendee.githubHandle,
      badgeShowHandle: Boolean(attendee.githubHandle),
    }]
    void renderBanner(canvas, state, format, false, 1)
  }, [attendee, colors, event, theme])

  return (
    <article className="attendee-badge-preview" aria-label={`Row ${sourceRowNumber}: ${attendee.name}`}>
      <h4>{attendee.name}</h4>
      <canvas ref={canvasRef} role="img" aria-label={`Speaker Badge front preview for ${attendee.name}`} />
      <p>Row {sourceRowNumber}</p>
      <ul aria-label="Preview reasons">
        {reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
    </article>
  )
}
