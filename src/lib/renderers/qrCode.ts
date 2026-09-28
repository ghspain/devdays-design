import encodeQR from 'qr'

export type QRErrorCorrectionLevel = 'low' | 'medium' | 'quartile' | 'high'

export interface QRCodeRenderOptions {
  /** Maximum output canvas side in pixels; actual size rounds down to whole square modules. */
  maxSizePx: number
  /** Required blank border around the symbol, measured in modules. */
  quietZoneModules?: number
  errorCorrectionLevel?: QRErrorCorrectionLevel
}

/** Encode and draw a crisp, opaque QR canvas without network services or renderer-specific state. */
export function renderQRCode(content: string, options: QRCodeRenderOptions): HTMLCanvasElement {
  if (!content.trim()) throw new Error('QR content cannot be empty.')
  if (!Number.isSafeInteger(options.maxSizePx) || options.maxSizePx <= 0) {
    throw new RangeError('QR maxSizePx must be a positive safe integer.')
  }

  const quietZoneModules = options.quietZoneModules ?? 4
  if (!Number.isSafeInteger(quietZoneModules) || quietZoneModules < 4) {
    throw new RangeError('QR quiet zone must be at least four whole modules.')
  }

  const matrix = encodeQR(content, 'raw', {
    ecc: options.errorCorrectionLevel ?? 'medium',
    border: quietZoneModules,
  })
  const moduleSizePx = Math.floor(options.maxSizePx / matrix.length)
  if (moduleSizePx < 1) throw new RangeError('QR maxSizePx is too small for this content.')

  const canvas = document.createElement('canvas')
  canvas.width = matrix.length * moduleSizePx
  canvas.height = canvas.width

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D rendering is unavailable.')
  context.imageSmoothingEnabled = false
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#000000'
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (matrix[y][x]) context.fillRect(x * moduleSizePx, y * moduleSizePx, moduleSizePx, moduleSizePx)
    }
  }
  return canvas
}
