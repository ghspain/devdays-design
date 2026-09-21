/** Optional out-flag: set when the text did not fit and had to be cut. */
export type TruncatedFlag = { value: boolean }

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number, truncated?: TruncatedFlag) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''

  for (const rawWord of words) {
    let word = rawWord
    if (ctx.measureText(word).width > maxWidth) {
      // Unbreakable token wider than the box: previously it overflowed
      // silently (#32). Cut it to fit and flag the truncation.
      if (truncated) truncated.value = true
      while (word.length > 0 && ctx.measureText(`${word}...`).width > maxWidth) {
        word = word.slice(0, -1)
      }
      word = `${word}...`
    }
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width <= maxWidth) {
      line = test
    } else {
      if (line) lines.push(line)
      line = word
    }
  }

  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines

  if (truncated) truncated.value = true
  const kept = lines.slice(0, maxLines)
  while (ctx.measureText(`${kept[maxLines - 1]}...`).width > maxWidth && kept[maxLines - 1].length > 0) {
    kept[maxLines - 1] = kept[maxLines - 1].slice(0, -1)
  }
  kept[maxLines - 1] = `${kept[maxLines - 1]}...`
  return kept
}

export function wrapTextWithBreaks(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number, truncated?: TruncatedFlag) {
  const chunks = text
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (chunks.length === 0) return ['']

  const lines: string[] = []
  for (const chunk of chunks) {
    const remaining = maxLines - lines.length
    if (remaining <= 0) {
      if (truncated) truncated.value = true
      break
    }
    const inner: TruncatedFlag = { value: false }
    const wrapped = wrapText(ctx, chunk, maxWidth, remaining, inner)
    lines.push(...wrapped)
    if (inner.value && truncated) truncated.value = true
  }

  return lines.slice(0, maxLines)
}

export function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
