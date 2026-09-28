import { formatOptions, MAX_SPEAKERS } from '../constants'
import type { BannerFormat, BannerState, Speaker } from '../types'
import { renderBanner } from './renderBanner'
import { attendeeBadgeSubject } from '../domain/badgeSubject'
import type { ValidatedAttendeeRow } from './attendeeValidation'
import { runRenderQueue, type BatchRenderFailure, type BatchRenderJob, type BatchRenderProgress } from './renderQueue'

const packFolderByFormat: Record<BannerFormat, string> = {
  luma_cover: 'luma-cover',
  social_promo: 'social-promo',
  speaker_banner: 'speaker-banner',
  speaker_square: 'speaker-profile',
  speaker_badge: 'speaker-badge',
}

const isSpeakerFormat = (format: BannerFormat) =>
  format === 'speaker_banner' || format === 'speaker_square' || format === 'speaker_badge'

export const slugify = (value: string, fallback: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not create PNG file.'))
    }, 'image/png')
  })

const speakerStates = (state: BannerState, speakers: Speaker[]) =>
  speakers.map((speaker) => ({ ...state, speakers: [speaker] }))

export interface EventPackProgress {
  completed: number
  total: number
  label: string
  stage?: BatchRenderProgress['stage']
  percentage?: number
  current?: string
}

const progressLabel = (progress: BatchRenderProgress) => {
  if (progress.stage === 'packaging') return 'Creating ZIP'
  if (progress.stage === 'complete') return 'Complete'
  return progress.current ? `Rendering ${progress.current.subject.name || progress.current.filename}` : 'Rendering'
}

export async function buildEventPack(
  state: BannerState,
  onProgress?: (progress: EventPackProgress) => void,
) {
  // Lazy-load JSZip so the ~100KB dependency stays out of the initial bundle.
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const speakers = state.speakers
    .filter((speaker) => speaker.name.trim().length > 0)
    .slice(0, MAX_SPEAKERS)
  const total = formatOptions.reduce(
    (count, format) => count + (isSpeakerFormat(format.id) ? speakers.length : 1),
    0,
  )
  const citySlug = slugify(state.event.city, 'event')
  const jobs: BatchRenderJob[] = []
  for (const format of formatOptions) {
    const states = isSpeakerFormat(format.id) ? speakerStates(state, speakers) : [state]
    const folderName = packFolderByFormat[format.id]
    for (let index = 0; index < states.length; index += 1) {
      const exportState: BannerState = { ...states[index], format: format.id }
      const speaker = exportState.speakers[0]
      const speakerPart = isSpeakerFormat(format.id)
        ? `${String(index + 1).padStart(2, '0')}-${slugify(speaker?.name || '', `speaker-${index + 1}`)}`
        : citySlug
      const filename = `${folderName}/${folderName}-${speakerPart}.png`
      jobs.push({
        id: `${format.id}-${index + 1}`,
        subject: { kind: 'speaker', name: speaker?.name || citySlug },
        template: format.id,
        side: 'front',
        filename,
        render: async () => {
          const canvas = document.createElement('canvas')
          await renderBanner(canvas, exportState, format, false, 1)
          return canvasToBlob(canvas)
        },
      })
    }
  }

  const result = await runRenderQueue(jobs, (progress) => onProgress?.({
    completed: progress.completed,
    total: progress.total,
    label: progressLabel(progress),
    stage: progress.stage,
    percentage: progress.percentage,
    current: progress.current?.filename,
  }))
  if (result.failures.length) throw new Error(`Could not render ${result.failures.length} event pack asset(s).`)
  const completed = result.completed.length
  onProgress?.({ completed, total, label: 'Creating ZIP', stage: 'packaging', percentage: 100 })
  for (const item of result.completed) zip.file(item.job.filename, item.blob)
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
  onProgress?.({ completed, total, label: 'Complete', stage: 'complete', percentage: 100 })
  return {
    blob,
    fileName: `devdays-${citySlug}-event-pack.zip`,
    fileCount: total,
  }
}

const badgeFormat = formatOptions.find(({ id }) => id === 'speaker_badge') ?? (() => {
  throw new Error('Speaker Badge template is not configured')
})()

export interface AttendeeBatchProgress {
  completed: number
  total: number
  stage: BatchRenderProgress['stage']
  percentage: number
  current?: string
}

export interface AttendeeBatchResult {
  blob: Blob
  fileName: string
  fileCount: number
  failures: BatchRenderFailure[]
}

export async function buildAttendeeBadgePack(
  state: BannerState,
  rows: readonly ValidatedAttendeeRow[],
  onProgress?: (progress: AttendeeBatchProgress) => void,
): Promise<AttendeeBatchResult> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const citySlug = slugify(state.event.city, 'event')
  const titleSlug = slugify(state.event.title || state.event.edition, 'dev-days')
  const jobs: BatchRenderJob[] = []

  rows.filter((row) => row.status !== 'error').forEach((row) => {
    const subject = attendeeBadgeSubject(row.attendee)
    const nameSlug = slugify(subject.name, `row-${row.sourceRowNumber}`)
    ;(['front', 'back'] as const).forEach((side) => {
      const filename = `speaker-badge/${citySlug}-${titleSlug}-row-${row.sourceRowNumber}-${nameSlug}-${side}.png`
      const renderState: BannerState = {
        ...state,
        format: 'speaker_badge',
        activeSide: side,
        speakers: [],
        ...(side === 'back' && row.attendee.qrDestination
          ? { qrDestination: row.attendee.qrDestination, qrReadableText: row.attendee.qrReadableText ?? true }
          : {}),
      }
      jobs.push({
        id: `row-${row.sourceRowNumber}-${side}`,
        subject: { kind: 'attendee', name: subject.name, sourceRowNumber: row.sourceRowNumber },
        template: 'speaker-badge-front',
        side,
        filename,
        render: async () => {
          const canvas = document.createElement('canvas')
          await renderBanner(canvas, renderState, badgeFormat, false, 1, undefined, subject)
          return canvasToBlob(canvas)
        },
      })
    })
  })

  const result = await runRenderQueue(jobs, (progress) => onProgress?.({
    completed: progress.completed,
    total: progress.total,
    stage: progress.stage,
    percentage: progress.percentage,
    current: progress.current?.filename,
  }))
  onProgress?.({ completed: result.completed.length, total: jobs.length, stage: 'packaging', percentage: 100 })
  result.completed.forEach(({ job, blob }) => zip.file(job.filename, blob))
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
  onProgress?.({ completed: jobs.length, total: jobs.length, stage: 'complete', percentage: 100 })
  return {
    blob,
    fileName: `devdays-${citySlug}-${titleSlug}-badges.zip`,
    fileCount: result.completed.length,
    failures: result.failures,
  }
}
