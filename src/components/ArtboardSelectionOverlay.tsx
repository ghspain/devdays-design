import { useRef } from 'react'
import type { TextRegion } from '../lib/validate'

interface ArtboardSelectionOverlayProps {
  regions: TextRegion[]
  width: number
  height: number
  selectedField?: string
  onSelect: (field: string) => void
  movableElementIds?: readonly string[]
  onMove: (elementId: string, delta: { x: number; y: number }) => void
}

const SUPPORTED_FIELDS = new Set([
  'city', 'date & time', 'edition', 'event details', 'event title', 'qr destination text',
  'registration label', 'registration url', 'speaker name',
])

export default function ArtboardSelectionOverlay({ regions, width, height, selectedField, onSelect, movableElementIds = [], onMove }: ArtboardSelectionOverlayProps) {
  const drag = useRef(new Map<number, { elementId: string; lastX: number; lastY: number }>())
  return (
    <div className="artboard-selection-overlay" aria-label="Selectable artboard elements">
      {regions.filter((region) => SUPPORTED_FIELDS.has(region.field.toLowerCase())).map((region, index) => (
        <button
          aria-describedby={`artboard-selection-description-${index}`}
          aria-label="Select this rendered text to edit"
          aria-pressed={selectedField?.toLowerCase() === region.field.toLowerCase()}
          aria-keyshortcuts={region.elementId && movableElementIds.includes(region.elementId) ? 'ArrowUp ArrowDown ArrowLeft ArrowRight' : undefined}
          className={`artboard-selection-target${region.elementId && movableElementIds.includes(region.elementId) ? ' is-movable' : ''}`}
          data-field={region.field.toLowerCase()}
          key={`${region.field}-${region.x}-${region.y}`}
          onClick={() => onSelect(region.field)}
          onPointerDown={(event) => {
            if (!region.elementId || !movableElementIds.includes(region.elementId) || event.pointerType === 'touch') return
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current.set(event.pointerId, { elementId: region.elementId, lastX: event.clientX, lastY: event.clientY })
          }}
          onPointerMove={(event) => {
            const origin = drag.current.get(event.pointerId)
            if (!origin) return
            const bounds = event.currentTarget.parentElement?.getBoundingClientRect()
            if (!bounds) return
            drag.current.set(event.pointerId, { ...origin, lastX: event.clientX, lastY: event.clientY })
            onMove(origin.elementId, { x: (event.clientX - origin.lastX) * width / bounds.width, y: (event.clientY - origin.lastY) * height / bounds.height })
          }}
          onPointerUp={(event) => {
            const activeDrag = drag.current.get(event.pointerId)
            if (activeDrag) {
              onSelect(region.field)
            }
            drag.current.delete(event.pointerId)
          }}
          onPointerCancel={(event) => drag.current.delete(event.pointerId)}
          onKeyDown={(event) => {
            if (!region.elementId || !movableElementIds.includes(region.elementId)) return
            const distance = event.shiftKey ? 10 : 1
            const delta = {
              x: event.key === 'ArrowLeft' ? -distance : event.key === 'ArrowRight' ? distance : 0,
              y: event.key === 'ArrowUp' ? -distance : event.key === 'ArrowDown' ? distance : 0,
            }
            if (delta.x || delta.y) {
              event.preventDefault()
              onMove(region.elementId, delta)
            }
          }}
          style={{
            left: `${region.x / width * 100}%`,
            top: `${region.y / height * 100}%`,
            width: `${region.w / width * 100}%`,
            height: `${region.h / height * 100}%`,
          }}
          type="button"
        >
          <span className="artboard-selection-target-description" id={`artboard-selection-description-${index}`}>{region.elementId && movableElementIds.includes(region.elementId) ? `${region.field}. Drag to move; use arrow keys to adjust.` : region.field}</span>
        </button>
      ))}
    </div>
  )
}
