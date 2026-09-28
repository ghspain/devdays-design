import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QRDestinationControls } from '../../../src/components/QRDestinationControls'
import { resolveQRDestination, type QRDestination } from '../../../src/domain/qrDestination'
import type { AssetTemplateDefinition } from '../../../src/domain/assets'
import type { CatalogPublicProfile } from '../../../src/lib/catalog'
import { defaultQRDestination } from '../../../src/lib/qrDestinationControls'

const template: AssetTemplateDefinition = {
  id: 'test-qr-template',
  name: 'Test QR template',
  description: 'Synthetic test fixture only',
  channels: [],
  sides: ['back'],
  rendererId: 'fixture',
  exportProfiles: [],
  qr: {
    defaultDestinationKind: 'person-profile',
    allowNone: true,
    allowReadableText: true,
    defaultReadableText: true,
  },
}
const profiles: CatalogPublicProfile[] = [{
  personId: 'synthetic-person',
  name: 'Example Person',
  displayRole: 'Synthetic profile fixture',
  avatarUrl: '',
  lastVerified: '2026-01-01',
  destinations: [{ kind: 'github', url: 'https://github.example/synthetic-person' }],
}, {
  personId: 'other-synthetic-person',
  name: 'Another Example',
  displayRole: 'Not the selected subject',
  avatarUrl: '',
  lastVerified: '2026-01-01',
  destinations: [{ kind: 'website', url: 'https://example.test/other' }],
}]
const selectedPersonProfiles = profiles.filter(({ personId }) => personId === 'synthetic-person')

export function Harness() {
  const templateDefault = defaultQRDestination(template.qr!.defaultDestinationKind, selectedPersonProfiles, [])
  const defaultDestination = new URLSearchParams(location.search).has('missing-profile')
    ? { kind: 'person-profile' as const, personId: 'synthetic-missing-person', profileKind: 'github' as const }
    : templateDefault
  const [destination, setDestination] = useState<QRDestination>(defaultDestination)
  const [readableText, setReadableText] = useState(template.qr!.defaultReadableText)
  const resolution = resolveQRDestination(destination, {
    getPublicProfile: (personId) => profiles.find((profile) => profile.personId === personId),
    getSponsor: () => undefined,
  })
  return (
    <>
      <QRDestinationControls
        template={template}
        value={destination}
        readableText={readableText}
        profiles={selectedPersonProfiles}
        sponsors={[]}
        resolution={resolution}
        onChange={setDestination}
        onReadableTextChange={setReadableText}
      />
      <output id="qr-harness-state">{JSON.stringify({ destination, readableText, resolution })}</output>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<Harness />)
