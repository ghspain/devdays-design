import { useEffect, useRef } from 'react'
import { formatOptions } from '../constants'
import type { AttendeeBadgeInput } from '../domain/attendee'
import { attendeeBadgeSubject } from '../domain/badgeSubject'
import { BADGE_ROLE_PRESENTATIONS } from '../domain/badgeRoles'
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
  const roleLabel = BADGE_ROLE_PRESENTATIONS[attendee.badgeRole ?? 'attendee'].label.toLowerCase().replace(/^./, (letter) => letter.toUpperCase())

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
    void renderBanner(canvas, state, format, false, 1, undefined, attendeeBadgeSubject(attendee))
  }, [attendee, colors, event, theme])

  return (
    <article className="attendee-badge-preview" aria-label={`Row ${sourceRowNumber}: ${attendee.name}`}>
      <h4>{attendee.name}</h4>
      <canvas ref={canvasRef} role="img" aria-label={`${roleLabel} Badge front preview for ${attendee.name}`} />
      <p>Row {sourceRowNumber}</p>
      <ul aria-label="Preview reasons">
        {reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
    </article>
  )
}
