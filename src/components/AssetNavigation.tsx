import { formatOptions } from '../constants'
import { assetCatalog } from '../domain/assets'
import type { BannerFormat } from '../types'
import type { ToggleEvent } from 'react'

interface AssetNavigationProps {
  format: BannerFormat
  open: boolean
  onFormatSelect: (format: BannerFormat) => void
  onToggle: (event: ToggleEvent<HTMLDetailsElement>) => void
}

export default function AssetNavigation({ format, open, onFormatSelect, onToggle }: AssetNavigationProps) {
  return (
    <aside className="asset-navigation" aria-label="Assets and templates">
      <details className="side-section" id="section-format" open={open} onToggle={onToggle}>
        <summary>
          <span>Assets &amp; templates</span>
          <span className="asset-navigation-hint">Choose an output</span>
        </summary>
        <nav className="asset-navigation-list format-groups" aria-label="Asset templates">
          {assetCatalog.map((asset) => (
            <section className="asset-navigation-group format-group" key={asset.id} aria-labelledby={`asset-nav-${asset.id}`}>
              <h2 id={`asset-nav-${asset.id}`}>{asset.name}</h2>
              {asset.templates.map((template) => {
                const option = formatOptions.find((item) => item.id === template.legacyFormat)
                if (!option) return null
                const printGeometry = template.exportProfiles[0]?.printGeometry
                return (
                  <button
                    aria-label={`${option.name}, ${option.width} by ${option.height}, ${option.description ?? ''}, ${option.channels?.join(', ') ?? ''}${printGeometry ? `, ${printGeometry.widthMm} by ${printGeometry.heightMm} millimetres at ${printGeometry.dpi} DPI` : ''}`}
                    aria-current={format === option.id ? 'page' : undefined}
                    aria-pressed={format === option.id}
                    className={`asset-navigation-item format-card${format === option.id ? ' selected' : ''}`}
                    key={template.id}
                    onClick={() => onFormatSelect(option.id)}
                    type="button"
                  >
                    <span className="asset-navigation-ratio" aria-hidden="true" style={{ aspectRatio: `${option.width} / ${option.height}` }} />
                    <span className="asset-navigation-copy">
                      <strong>{option.name}</strong>
                      <small>{option.width} × {option.height}</small>
                      {printGeometry && <small className="asset-navigation-print-profile">{printGeometry.widthMm} × {printGeometry.heightMm} mm · {printGeometry.dpi} DPI</small>}
                      <small className="asset-navigation-description">{option.description}</small>
                      {printGeometry && <small className="asset-navigation-print-note">Configurable example · not print-ready</small>}
                      {template.sides.length > 1 && <small>Front / back</small>}
                    </span>
                  </button>
                )
              })}
            </section>
          ))}
        </nav>
      </details>
    </aside>
  )
}
