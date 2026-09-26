import { formatOptions, MAX_SPEAKERS } from '../constants'
import type { BannerFormat, BannerState, Speaker } from '../types'
import { renderBanner } from './renderBanner'

const packFolderByFormat: Record<BannerFormat, string> = {
  luma_cover: 'luma-cover',
  social_promo: 'social-promo',
  speaker_banner: 'speaker-banner',
  speaker_square: 'speaker-profile',
}

const isSpeakerFormat = (format: BannerFormat) =>
  format === 'speaker_banner' || format === 'speaker_square'

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
  let completed = 0

  for (const format of formatOptions) {
    const states = isSpeakerFormat(format.id) ? speakerStates(state, speakers) : [state]
    const folderName = packFolderByFormat[format.id]
    const folder = zip.folder(folderName)
    if (!folder) throw new Error(`Could not create ${folderName} folder.`)

    for (let index = 0; index < states.length; index += 1) {
      const exportState: BannerState = { ...states[index], format: format.id }
      const canvas = document.createElement('canvas')
      await renderBanner(canvas, exportState, format, false, 1)
      const blob = await canvasToBlob(canvas)
      const speaker = exportState.speakers[0]
      const speakerPart = isSpeakerFormat(format.id)
        ? `${String(index + 1).padStart(2, '0')}-${slugify(speaker?.name || '', `speaker-${index + 1}`)}`
        : citySlug
      folder.file(`${folderName}-${speakerPart}.png`, blob)
      completed += 1
      onProgress?.({ completed, total, label: format.name })
    }
  }

  onProgress?.({ completed, total, label: 'Creating ZIP' })
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
  return {
    blob,
    fileName: `devdays-${citySlug}-event-pack.zip`,
    fileCount: total,
  }
}
