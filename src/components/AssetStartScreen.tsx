import { Button } from '@primer/react'
import { formatOptions } from '../constants'
import { assetCatalog } from '../domain/assets'
import type { BannerFormat } from '../types'
import './AssetStartScreen.css'

interface AssetStartScreenProps {
  onBack: () => void
  onSelectAsset: (format: BannerFormat) => void
}

export default function AssetStartScreen({ onBack, onSelectAsset }: AssetStartScreenProps) {
  return (
    <section className="asset-start-screen" aria-labelledby="asset-start-title">
      <div className="asset-start-intro">
        <p className="asset-start-eyebrow">GHSpain Event Studio</p>
        <h2 id="asset-start-title">What are you creating?</h2>
        <p>Start with the asset you need. Your event details stay available as you move between formats.</p>
        <Button variant="invisible" onClick={onBack}>Back to editor</Button>
      </div>
      <div className="asset-start-groups">
        {assetCatalog.map((asset) => (
          <section className="asset-start-group" aria-labelledby={`asset-group-${asset.id}`} key={asset.id}>
            <h3 id={`asset-group-${asset.id}`}>{asset.name}</h3>
            <div className="asset-start-grid">
              {asset.templates.map((template) => {
                const option = formatOptions.find((item) => item.id === template.legacyFormat)
                if (!option) return null
                const printGeometry = template.exportProfiles[0]?.printGeometry
                return (
                  <button
                    className="asset-start-card"
                    key={template.id}
                    type="button"
                    onClick={() => onSelectAsset(option.id)}
                  >
                    <span className="asset-start-card-preview" aria-hidden="true">
                      <span style={{ aspectRatio: `${option.width} / ${option.height}` }} />
                    </span>
                    <span className="asset-start-card-copy">
                      <strong>{option.name}</strong>
                      <span>{option.description}</span>
                      <small>{option.width} × {option.height} · {option.channels?.join(', ')}</small>
                      {printGeometry && <small>{printGeometry.widthMm} × {printGeometry.heightMm} mm · {printGeometry.dpi} DPI · configurable example</small>}
                      {printGeometry && <small>Not print-ready; calibration is a later phase.</small>}
                      {template.sides.length > 1 && <small className="asset-start-sides">Front and back sides</small>}
                    </span>
                    <span className="asset-start-card-action" aria-hidden="true">Create</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
