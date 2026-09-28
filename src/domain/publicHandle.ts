export interface PublicProfileLink {
  kind: string
  url: string
}

/** Returns a human-readable handle only from a canonical public GitHub/X link. */
export function publicProfileHandle(destinations: readonly PublicProfileLink[]): string | undefined {
  const destination = destinations.find(({ kind }) => kind === 'github' || kind === 'x')
  if (!destination) return undefined
  const handle = new URL(destination.url).pathname.split('/').filter(Boolean)[0]
  return handle ? `@${handle}` : undefined
}
