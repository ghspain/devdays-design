import { expect, test } from '@playwright/test'
import decodeQR from 'qr/decode.js'
import encodeQR from 'qr'

const payload = 'https://events.example/schedule?id=2026'
const quietZoneModules = 5
const errorCorrectionLevel = 'high'

test('Canvas QR adapter renders deterministic square modules with a configurable quiet zone and round-trips', async ({ page }) => {
  await page.goto('/')
  const externalRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== new URL(page.url()).origin) externalRequests.push(request.url())
  })
  const rendered = await page.evaluate(async ({ payload, quietZoneModules, errorCorrectionLevel }) => {
    const { renderQRCode } = await import('/devdays-design/src/lib/renderers/qrCode.ts') as unknown as {
      renderQRCode: (content: string, options: { maxSizePx: number; quietZoneModules: number; errorCorrectionLevel: string }) => HTMLCanvasElement
    }
    const first = renderQRCode(payload, { maxSizePx: 512, quietZoneModules, errorCorrectionLevel })
    const second = renderQRCode(payload, { maxSizePx: 512, quietZoneModules, errorCorrectionLevel })
    const context = first.getContext('2d')!
    return {
      width: first.width,
      height: first.height,
      dataUrl: first.toDataURL(),
      duplicateDataUrl: second.toDataURL(),
      pixels: Array.from(context.getImageData(0, 0, first.width, first.height).data),
    }
  }, { payload, quietZoneModules, errorCorrectionLevel })

  const matrix = encodeQR(payload, 'raw', { ecc: errorCorrectionLevel, border: quietZoneModules })
  const modulePixels = rendered.width / matrix.length
  expect(Number.isInteger(modulePixels)).toBe(true)
  expect(rendered.width).toBe(rendered.height)
  expect(rendered.width).toBeLessThanOrEqual(512)
  expect(rendered.dataUrl).toBe(rendered.duplicateDataUrl)
  expect(externalRequests).toEqual([])

  for (let moduleY = 0; moduleY < quietZoneModules; moduleY += 1) {
    for (let moduleX = 0; moduleX < matrix.length; moduleX += 1) {
      expect(matrix[moduleY][moduleX]).toBe(false)
      expect(matrix[matrix.length - 1 - moduleY][moduleX]).toBe(false)
    }
  }

  const rgba = Uint8Array.from(rendered.pixels)
  expect(decodeQR({ width: rendered.width, height: rendered.height, data: rgba })).toBe(payload)
})

test('QR adapter rejects blank content, undersized canvases, and inadequate quiet zones', async ({ page }) => {
  await page.goto('/')
  const errors = await page.evaluate(async ({ payload }) => {
    const { renderQRCode } = await import('/devdays-design/src/lib/renderers/qrCode.ts') as unknown as {
      renderQRCode: (content: string, options: { maxSizePx: number; quietZoneModules?: number }) => HTMLCanvasElement
    }
    const failure = (run: () => unknown) => {
      try { run(); return 'no error' } catch (error) { return error instanceof Error ? error.message : String(error) }
    }
    return [
      failure(() => renderQRCode(' ', { maxSizePx: 256 })),
      failure(() => renderQRCode(payload, { maxSizePx: 8 })),
      failure(() => renderQRCode(payload, { maxSizePx: 256, quietZoneModules: 3 })),
    ]
  }, { payload })

  expect(errors).toEqual([
    'QR content cannot be empty.',
    'QR maxSizePx is too small for this content.',
    'QR quiet zone must be at least four whole modules.',
  ])
})
