import { expect, test } from '@playwright/test'
import { resolveQRDestination, type QRDestinationContext } from '../../src/domain/qrDestination'
import { defaultQRDestination } from '../../src/lib/qrDestinationControls'

const context: QRDestinationContext = {
  getPublicProfile: (personId) => personId === 'person-1' ? {
    personId,
    name: 'Synthetic Speaker',
    displayRole: 'Speaker',
    avatarUrl: '',
    lastVerified: '2026-01-01',
    destinations: [{ kind: 'github', url: 'https://github.com/synthetic-speaker' }],
  } : undefined,
  getSponsor: (sponsorId) => sponsorId === 'sponsor-1'
    ? { name: 'Synthetic Sponsor', website: 'https://sponsor.example' }
    : undefined,
}

test('none resolves without content', () => {
  expect(resolveQRDestination({ kind: 'none' }, context)).toEqual({ status: 'none' })
})

test('speaker badge default prefers GitHub, then website, LinkedIn, and X; no profile falls back to none', () => {
  const profile = (personId: string, kinds: Array<'github' | 'website' | 'linkedin' | 'x'>) => ({
    personId,
    name: 'Synthetic Speaker',
    displayRole: 'Speaker',
    avatarUrl: '',
    lastVerified: '2026-01-01',
    destinations: kinds.map((kind) => ({ kind, url: `https://${kind}.example/synthetic` })),
  })
  const linkedinFirst = profile('linkedin-first', ['linkedin', 'website', 'github'])
  expect(defaultQRDestination('person-profile', [linkedinFirst], [])).toEqual({
    kind: 'person-profile', personId: 'linkedin-first', profileKind: 'github',
  })
  const onlyWebsite = profile('website-only', ['website'])
  expect(defaultQRDestination('person-profile', [onlyWebsite], [])).toEqual({
    kind: 'person-profile', personId: 'website-only', profileKind: 'website',
  })
  expect(defaultQRDestination('person-profile', [], [], true)).toEqual({ kind: 'none' })
})

test('person profile resolves through the normalized public-profile API contract', () => {
  expect(resolveQRDestination({ kind: 'person-profile', personId: 'person-1', profileKind: 'github' }, context)).toEqual({
    status: 'resolved',
    content: 'https://github.com/synthetic-speaker',
    label: 'GitHub · Synthetic Speaker',
  })
  expect(resolveQRDestination({ kind: 'person-profile', personId: 'missing', profileKind: 'github' }, context)).toEqual({
    status: 'invalid', reason: 'unavailable',
  })
  expect(resolveQRDestination({ kind: 'person-profile', personId: 'person-1', profileKind: 'linkedin' }, context)).toEqual({
    status: 'invalid', reason: 'unavailable',
  })
})

test('catalog adapter resolves profiles through the shipped public-profile API', async ({ page }) => {
  await page.goto('/')
  const results = await page.evaluate(async () => {
    const module = await import('/devdays-design/src/lib/qrDestinationResolver.ts') as unknown as {
      resolveCatalogQRDestination: (destination: {
        kind: 'person-profile'
        personId: string
        profileKind: 'github'
      }) => { status: string; content?: string; label?: string; reason?: string }
    }
    return [
      module.resolveCatalogQRDestination({ kind: 'person-profile', personId: 'sergio-valverde', profileKind: 'github' }),
      module.resolveCatalogQRDestination({ kind: 'person-profile', personId: 'ramon-palomares', profileKind: 'github' }),
    ]
  })
  expect(results).toEqual([
    { status: 'resolved', content: 'https://github.com/svg153', label: 'GitHub · Sergio Valverde' },
    { status: 'invalid', reason: 'unavailable' },
  ])
})

test('event agenda and event page URLs resolve with stable labels', () => {
  expect(resolveQRDestination({ kind: 'event-agenda', url: 'agenda.example/schedule' }, context)).toEqual({
    status: 'resolved', content: 'https://agenda.example/schedule', label: 'Event agenda',
  })
  expect(resolveQRDestination({ kind: 'event-page', url: 'https://event.example/?source=qr' }, context)).toEqual({
    status: 'resolved', content: 'https://event.example/?source=qr', label: 'Event page',
  })
})

test('sponsor website resolves through a sponsor reference and reports missing websites', () => {
  expect(resolveQRDestination({ kind: 'sponsor-website', sponsorId: 'sponsor-1' }, context)).toEqual({
    status: 'resolved', content: 'https://sponsor.example/', label: 'Synthetic Sponsor website',
  })
  expect(resolveQRDestination({ kind: 'sponsor-website', sponsorId: 'missing' }, context)).toEqual({
    status: 'invalid', reason: 'unavailable',
  })
  expect(resolveQRDestination({ kind: 'sponsor-website', sponsorId: 'sponsor-1' }, {
    ...context,
    getSponsor: () => ({ name: 'Synthetic Sponsor', website: '' }),
  })).toEqual({ status: 'invalid', reason: 'invalid-url' })
})

test('custom URL normalizes safely and rejects unsafe schemes or credentials', () => {
  expect(resolveQRDestination({ kind: 'custom-url', url: 'http://example.test/path', label: 'My event' }, context)).toEqual({
    status: 'resolved', content: 'http://example.test/path', label: 'My event',
  })
  expect(resolveQRDestination({ kind: 'custom-url', url: 'javascript:alert(1)' }, context)).toEqual({
    status: 'invalid', reason: 'unsupported-scheme',
  })
  expect(resolveQRDestination({ kind: 'custom-url', url: 'https://user:secret@example.test' }, context)).toEqual({
    status: 'invalid', reason: 'invalid-url',
  })
  expect(resolveQRDestination({ kind: 'custom-url', url: '' }, context)).toEqual({
    status: 'invalid', reason: 'invalid-url',
  })
})
