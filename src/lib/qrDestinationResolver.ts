import { resolveQRDestination, type QRDestination, type QRDestinationResolution } from '../domain/qrDestination'
import { catalogSponsors, getCatalogPublicProfile } from './catalog'

/** App adapter: resolve public people through the canonical profile API and sponsors through the catalogue. */
export function resolveCatalogQRDestination(destination: QRDestination): QRDestinationResolution {
  return resolveQRDestination(destination, {
    getPublicProfile: getCatalogPublicProfile,
    getSponsor: (sponsorId) => {
      const sponsor = catalogSponsors.find(({ id }) => id === sponsorId)
      return sponsor ? { name: sponsor.name, website: sponsor.website } : undefined
    },
  })
}
