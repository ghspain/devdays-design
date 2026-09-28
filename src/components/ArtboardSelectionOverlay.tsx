import type { TextRegion } from '../lib/validate'

interface ArtboardSelectionOverlayProps {
  regions: TextRegion[]
  width: number
  height: number
  selectedField?: string
  onSelect: (field: string) => void
}

const SUPPORTED_FIELDS = new Set([
  'city', 'date & time', 'edition', 'event details', 'event title', 'qr destination text',
  'registration label', 'registration url', 'speaker name',
])

export default function ArtboardSelectionOverlay({ regions, width, height, selectedField, onSelect }: ArtboardSelectionOverlayProps) {
  return (
    <div className="artboard-selection-overlay" aria-label="Selectable artboard elements">
      {regions.filter((region) => SUPPORTED_FIELDS.has(region.field.toLowerCase())).map((region, index) => (
        <button
          aria-describedby={`artboard-selection-description-${index}`}
          aria-label="Select this rendered text to edit"
          aria-pressed={selectedField?.toLowerCase() === region.field.toLowerCase()}
          className="artboard-selection-target"
          data-field={region.field.toLowerCase()}
          key={`${region.field}-${region.x}-${region.y}`}
          onClick={() => onSelect(region.field)}
          style={{
            left: `${region.x / width * 100}%`,
            top: `${region.y / height * 100}%`,
            width: `${region.w / width * 100}%`,
            height: `${region.h / height * 100}%`,
          }}
          type="button"
        >
          <span className="artboard-selection-target-description" id={`artboard-selection-description-${index}`}>{region.field}</span>
        </button>
      ))}
    </div>
  )
}
