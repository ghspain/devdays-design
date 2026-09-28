import { FormControl, Select, TextInput, ToggleSwitch } from '@primer/react'
import type { CatalogPublicProfile, CatalogSponsor, PublicProfileKind } from '../lib/catalog'
import type { AssetTemplateDefinition } from '../domain/assets'
import type { QRDestination, QRDestinationResolution } from '../domain/qrDestination'
import { defaultQRDestination, qrDestinationErrorMessage } from '../lib/qrDestinationControls'

const profileLabels: Record<PublicProfileKind, string> = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
  x: 'X',
  website: 'Website',
}

interface QRDestinationControlsProps {
  template: AssetTemplateDefinition
  value: QRDestination
  readableText: boolean
  profiles: readonly CatalogPublicProfile[]
  sponsors: readonly CatalogSponsor[]
  resolution: QRDestinationResolution
  onChange: (destination: QRDestination) => void
  onReadableTextChange: (enabled: boolean) => void
}

export function QRDestinationControls({
  template,
  value,
  readableText,
  profiles,
  sponsors,
  resolution,
  onChange,
  onReadableTextChange,
}: QRDestinationControlsProps) {
  const capability = template.qr
  if (!capability) return null

  const error = qrDestinationErrorMessage(value, resolution, capability.allowNone)
  const selectionError = value.kind === 'none' ? error : undefined
  const destinationError = value.kind === 'none' ? undefined : error
  const profileChoices = profiles.flatMap((profile) => profile.destinations.map((destination) => ({
    value: `${profile.personId}|${destination.kind}`,
    label: `${profile.name} — ${profileLabels[destination.kind]}`,
    destination: { kind: 'person-profile' as const, personId: profile.personId, profileKind: destination.kind },
  })))
  const selectedProfile = value.kind === 'person-profile'
    ? `${value.personId}|${value.profileKind}`
    : ''

  const updateUrl = (url: string) => {
    if (value.kind === 'event-agenda' || value.kind === 'event-page' || value.kind === 'custom-url') onChange({ ...value, url })
  }

  return (
    <div className="section-block qr-destination-controls">
      <FormControl id="qr-destination-type" required={!capability.allowNone}>
        <FormControl.Label>QR destination</FormControl.Label>
        <Select
          value={value.kind}
          onChange={(event) => onChange(defaultQRDestination(event.target.value as QRDestination['kind'], profiles, sponsors))}
          validationStatus={selectionError ? 'error' : undefined}
        >
          {capability.allowNone && <Select.Option value="none">No QR</Select.Option>}
          <Select.Option value="person-profile">Person profile</Select.Option>
          <Select.Option value="event-agenda">Event agenda</Select.Option>
          <Select.Option value="event-page">Event page</Select.Option>
          <Select.Option value="sponsor-website">Sponsor website</Select.Option>
          <Select.Option value="custom-url">Custom URL</Select.Option>
        </Select>
        {selectionError && <FormControl.Validation variant="error">{selectionError}</FormControl.Validation>}
      </FormControl>

      {value.kind === 'person-profile' && (
        <FormControl id="qr-person-profile" required>
          <FormControl.Label>Public profile</FormControl.Label>
          <Select
            value={selectedProfile}
            onChange={(event) => {
              const choice = profileChoices.find((option) => option.value === event.target.value)
              if (choice) onChange(choice.destination)
            }}
            validationStatus={destinationError ? 'error' : undefined}
          >
            {!profileChoices.length && <Select.Option value="">No public profiles available</Select.Option>}
            {selectedProfile && !profileChoices.some((choice) => choice.value === selectedProfile) && <Select.Option value={selectedProfile}>Unavailable profile destination</Select.Option>}
            {profileChoices.map((choice) => <Select.Option key={choice.value} value={choice.value}>{choice.label}</Select.Option>)}
          </Select>
          {destinationError && <FormControl.Validation variant="error">{destinationError}</FormControl.Validation>}
          {!profileChoices.length && <FormControl.Caption>No public destinations are available for a person.</FormControl.Caption>}
        </FormControl>
      )}

      {value.kind === 'sponsor-website' && (
        <FormControl id="qr-sponsor" required>
          <FormControl.Label>Sponsor</FormControl.Label>
          <Select
            value={value.sponsorId}
            onChange={(event) => onChange({ kind: 'sponsor-website', sponsorId: event.target.value })}
            validationStatus={destinationError ? 'error' : undefined}
          >
            {!sponsors.length && <Select.Option value="">No sponsors available</Select.Option>}
            {sponsors.map((sponsor) => <Select.Option key={sponsor.id} value={sponsor.id}>{sponsor.name}</Select.Option>)}
          </Select>
          {destinationError && <FormControl.Validation variant="error">{destinationError}</FormControl.Validation>}
        </FormControl>
      )}

      {(value.kind === 'event-agenda' || value.kind === 'event-page' || value.kind === 'custom-url') && (
        <FormControl id="qr-destination-url" required>
          <FormControl.Label>{value.kind === 'custom-url' ? 'Custom URL' : 'Destination URL'}</FormControl.Label>
          <TextInput
            block
            type="url"
            value={value.url}
            onChange={(event) => updateUrl(event.target.value)}
            validationStatus={destinationError ? 'error' : undefined}
          />
          {destinationError && <FormControl.Validation variant="error">{destinationError}</FormControl.Validation>}
          <FormControl.Caption>HTTP and HTTPS destinations only.</FormControl.Caption>
        </FormControl>
      )}

      {capability.allowReadableText && (
        <div className="qr-readable-toggle">
          <strong id="qr-readable-text-label">Readable destination text</strong>
          <ToggleSwitch
            checked={readableText}
            onChange={onReadableTextChange}
            aria-labelledby="qr-readable-text-label"
          />
        </div>
      )}
      {capability.allowReadableText && <span className="section-description">Show a readable label independently of QR encoding.</span>}
    </div>
  )
}

