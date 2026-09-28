import type { AssetSide } from '../domain/assets'

export interface BatchRenderSubject {
  kind: 'speaker' | 'attendee'
  name: string
  sourceRowNumber?: number
}

export interface BatchRenderJob {
  id: string
  subject: BatchRenderSubject
  template: string
  side: AssetSide
  filename: string
  render: () => Promise<Blob>
}

export interface BatchRenderFailure {
  id: string
  subject: BatchRenderSubject
  template: string
  side: AssetSide
  filename: string
  message: string
  status?: 'failed' | 'cancelled'
}

export interface BatchRenderProgress {
  completed: number
  total: number
  stage: 'rendering' | 'packaging' | 'complete' | 'cancelled'
  percentage: number
  current?: BatchRenderJob
}

export interface BatchRenderResult {
  completed: Array<{ job: BatchRenderJob; blob: Blob }>
  failures: BatchRenderFailure[]
  cancelled: boolean
}

const yieldToBrowser = () => new Promise<void>((resolve) => {
  if (typeof window === 'undefined') setTimeout(resolve, 0)
  else window.setTimeout(resolve, 0)
})

/** Run jobs in stable order, yielding between canvases so React can paint progress. */
export async function runRenderQueue(
  jobs: readonly BatchRenderJob[],
  onProgress?: (progress: BatchRenderProgress) => void,
  options?: { signal?: AbortSignal },
): Promise<BatchRenderResult> {
  const completed: BatchRenderResult['completed'] = []
  const failures: BatchRenderFailure[] = []
  let cancelled = false

  const cancelRemaining = (start: number) => {
    cancelled = true
    for (let index = start; index < jobs.length; index += 1) {
      const job = jobs[index]
      failures.push({
        id: job.id,
        subject: job.subject,
        template: job.template,
        side: job.side,
        filename: job.filename,
        message: 'Cancelled before rendering.',
        status: 'cancelled',
      })
    }
  }

  for (let index = 0; index < jobs.length; index += 1) {
    if (options?.signal?.aborted) {
      cancelRemaining(index)
      onProgress?.({
        completed: index,
        total: jobs.length,
        stage: 'cancelled',
        percentage: jobs.length ? Math.round((index / jobs.length) * 100) : 100,
      })
      break
    }
    const job = jobs[index]
    try {
      completed.push({ job, blob: await job.render() })
    } catch (error) {
      failures.push({
        id: job.id,
        subject: job.subject,
        template: job.template,
        side: job.side,
        filename: job.filename,
        message: error instanceof Error ? error.message : 'Render failed.',
        status: 'failed',
      })
    }
    const finished = index + 1
    onProgress?.({
      completed: finished,
      total: jobs.length,
      stage: 'rendering',
      percentage: jobs.length ? Math.round((finished / jobs.length) * 100) : 100,
      current: job,
    })
    if (finished < jobs.length) {
      if (options?.signal?.aborted) {
        cancelRemaining(finished)
        onProgress?.({
          completed: finished,
          total: jobs.length,
          stage: 'cancelled',
          percentage: jobs.length ? Math.round((finished / jobs.length) * 100) : 100,
        })
        break
      }
      await yieldToBrowser()
    }
  }

  if (!cancelled) {
    onProgress?.({
      completed: jobs.length,
      total: jobs.length,
      stage: 'complete',
      percentage: 100,
    })
  }
  return { completed, failures, cancelled }
}
