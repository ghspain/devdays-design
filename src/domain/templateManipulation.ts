export interface ElementOffset {
  x: number
  y: number
}

/** Speaker-name movement stays inside its generous card inset and clear of neighboring fields. */
export function constrainSpeakerNameOffset(offset: ElementOffset): ElementOffset {
  const x = Math.min(40, Math.max(-40, offset.x))
  const y = Math.min(24, Math.max(-24, offset.y))
  return { x, y }
}
