import { expect, test } from '@playwright/test'

interface BatchMeasurement {
  size: number
  elapsedMs: number
  ticks: number
  maxInputGapMs: number
  fileCount: number
  zipBytes: number
  retainedPngBytes: number
  retainedApproxBytes: number
  firstFilename: string | undefined
  lastFilename: string | undefined
  progressStart: string | undefined
  progressEnd: string | undefined
  zipDigest: string
  firstPngDigest: string
  lastPngDigest: string
  releasedCanvases: boolean
}

interface BatchBenchmarkResult {
  browser: string
  hardwareConcurrency: number
  deviceMemory: number | null
  measurements: BatchMeasurement[]
  deterministic: boolean
  exportedCanvasCount: number
  releasedCanvases: boolean
}

test('synthetic attendee batches measure production rendering and release export canvases', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The repeatable benchmark runs in the supported desktop Chromium environment.')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dev Days' })).toBeVisible()

  const measurements = await page.evaluate(async (): Promise<BatchBenchmarkResult> => {
    const { buildAttendeeBadgePack } = await import('/devdays-design/src/lib/exportPack.ts') as typeof import('../../src/lib/exportPack')
    const { buildDefaultState } = await import('/devdays-design/src/lib/history.ts') as typeof import('../../src/lib/history')
    const state = buildDefaultState()
    const makeRows = (size: number) => Array.from({ length: size }, (_, index) => ({
      sourceRowNumber: index + 2,
      attendee: {
        name: `Synthetic Attendee ${index + 1}`,
        organization: 'Synthetic Organization',
        role: 'Participant',
        githubHandle: `synthetic-${index + 1}`,
      },
      status: 'valid' as const,
      findings: [],
    }))

    const digest = async (blob: Blob) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())))
      .map((byte) => byte.toString(16).padStart(2, '0')).join('')

    const measure = async (size: number) => {
      const progress: string[] = []
      let ticks = 0
      let maxInputGapMs = 0
      let lastTick = performance.now()
      const tickTimer = window.setInterval(() => {
        const now = performance.now()
        maxInputGapMs = Math.max(maxInputGapMs, now - lastTick)
        lastTick = now
        ticks += 1
      }, 0)
      const startedAt = performance.now()
      const result = await buildAttendeeBadgePack(state, makeRows(size), (update) => {
        progress.push(`${update.stage}:${update.completed}/${update.total}`)
      })
      const elapsedMs = performance.now() - startedAt
      window.clearInterval(tickTimer)
      const filenames = result.files.map(({ filename }) => filename)
      return {
        size,
        elapsedMs,
        ticks,
        maxInputGapMs,
        fileCount: result.fileCount,
        zipBytes: result.blob.size,
        retainedPngBytes: result.files.reduce((total, file) => total + file.blob.size, 0),
        retainedApproxBytes: result.blob.size + result.files.reduce((total, file) => total + file.blob.size, 0),
        firstFilename: filenames[0],
        lastFilename: filenames.at(-1),
        progressStart: progress[0],
        progressEnd: progress.at(-1),
        zipDigest: await digest(result.blob),
        firstPngDigest: await digest(result.files[0].blob),
        lastPngDigest: await digest(result.files.at(-1)!.blob),
        releasedCanvases: true,
      }
    }

    type ToBlob = (this: HTMLCanvasElement, callback: BlobCallback, type?: string, quality?: number) => void
    const originalToBlob = Reflect.get(HTMLCanvasElement.prototype, 'toBlob') as ToBlob
    const exportedCanvases: HTMLCanvasElement[] = []
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      exportedCanvases.push(this)
      return Reflect.apply(originalToBlob, this, [callback, type, quality])
    }
    try {
      const small = await measure(25)
      const medium = await measure(100)
      const large = await measure(250)
      const repeat = await measure(25)
      return {
        browser: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: 'deviceMemory' in navigator ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null : null,
        measurements: [small, medium, large],
        deterministic: small.firstPngDigest === repeat.firstPngDigest && small.lastPngDigest === repeat.lastPngDigest && small.firstFilename === repeat.firstFilename && small.lastFilename === repeat.lastFilename,
        exportedCanvasCount: exportedCanvases.length,
        releasedCanvases: exportedCanvases.every((canvas) => canvas.width === 0 && canvas.height === 0),
      }
    } finally {
      HTMLCanvasElement.prototype.toBlob = originalToBlob
    }
  })

  console.log(JSON.stringify(measurements))
  await testInfo.attach('batch-performance-measurements.json', {
    body: JSON.stringify(measurements, null, 2),
    contentType: 'application/json',
  })

  expect(measurements.measurements).toHaveLength(3)
  for (const measurement of measurements.measurements) {
    expect(measurement.fileCount).toBe(measurement.size * 2)
    expect(measurement.firstFilename).toBe(`speaker-badge/madrid-dev-days-row-2-synthetic-attendee-1-front.png`)
    expect(measurement.lastFilename).toBe(`speaker-badge/madrid-dev-days-row-${measurement.size + 1}-synthetic-attendee-${measurement.size}-back.png`)
    expect(measurement.progressStart).toBe('rendering:1/' + measurement.fileCount)
    expect(measurement.progressEnd).toBe(`complete:${measurement.fileCount}/${measurement.fileCount}`)
    expect(measurement.ticks).toBeGreaterThan(0)
    expect(measurement.zipBytes).toBeGreaterThan(0)
    expect(measurement.retainedPngBytes).toBeGreaterThan(0)
  }
  expect(measurements.deterministic).toBe(true)
  expect(measurements.exportedCanvasCount).toBeGreaterThan(0)
  expect(measurements.releasedCanvases).toBe(true)
})
