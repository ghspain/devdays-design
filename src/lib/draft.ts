import type { BannerState } from '../types'
import { isQRDestination } from '../domain/qrDestination'
import { EVENT_THEMES, formatOptions } from '../constants'

const DRAFT_DB_NAME = 'devdays-banner-draft'
const DRAFT_STORE_NAME = 'drafts'
const DRAFT_SCHEMA_VERSION = 3
const DRAFT_DATABASE_VERSION = 1
const DRAFT_KEY = 'current'

export type DraftReadResult =
  | { status: 'empty' }
  | { status: 'restored'; state: BannerState }
  | { status: 'unsupported' | 'invalid' | 'error' }

interface DraftRecord {
  version?: number
  state?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isSupportedSpeaker(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' &&
    ['role', 'photoDataUrl', 'talkTitle', 'talkTime', 'catalogId', 'personId', 'badgeHandle']
      .every((field) => value[field] === undefined || typeof value[field] === 'string') &&
    (value.badgeShowHandle === undefined || typeof value.badgeShowHandle === 'boolean')
}

function isSupportedState(value: unknown): value is BannerState {
  if (!isRecord(value)) return false
  if (value.activeSide !== undefined && value.activeSide !== 'front' && value.activeSide !== 'back') return false
  if (value.elementOffsets !== undefined && (!isRecord(value.elementOffsets) || Object.values(value.elementOffsets).some((offset) =>
    !isRecord(offset) || typeof offset.x !== 'number' || !Number.isFinite(offset.x) || typeof offset.y !== 'number' || !Number.isFinite(offset.y)))) return false
  if (value.sideStates !== undefined) {
    if (!isRecord(value.sideStates)) return false
    for (const [side, sideState] of Object.entries(value.sideStates)) {
      if ((side !== 'front' && side !== 'back') || !isRecord(sideState)) return false
      if (sideState.speakers !== undefined && (!Array.isArray(sideState.speakers) || sideState.speakers.some((speaker) => !isSupportedSpeaker(speaker)))) return false
      if (sideState.partners !== undefined && (!Array.isArray(sideState.partners) || sideState.partners.some((partner) =>
        !isRecord(partner) || typeof partner.id !== 'string' || typeof partner.imageDataUrl !== 'string' ||
        (partner.name !== undefined && typeof partner.name !== 'string')))) return false
      if (sideState.qrDestination !== undefined && sideState.qrDestination !== null && !isQRDestination(sideState.qrDestination)) return false
      if (sideState.qrReadableText !== undefined && sideState.qrReadableText !== null && typeof sideState.qrReadableText !== 'boolean') return false
      if (sideState.elementOffsets !== undefined && (!isRecord(sideState.elementOffsets) || Object.values(sideState.elementOffsets).some((offset) =>
        !isRecord(offset) || typeof offset.x !== 'number' || !Number.isFinite(offset.x) || typeof offset.y !== 'number' || !Number.isFinite(offset.y)))) return false
    }
  }
  if (value.format !== undefined && !formatOptions.some(({ id }) => id === value.format)) return false
  if (value.theme !== undefined && (typeof value.theme !== 'string' || !Object.hasOwn(EVENT_THEMES, value.theme))) return false
  if (value.speakersPerCard !== undefined && value.speakersPerCard !== 1 && value.speakersPerCard !== 2) return false
  if (value.speakerBannerPairLayout !== undefined && value.speakerBannerPairLayout !== 'side_by_side' && value.speakerBannerPairLayout !== 'stacked') return false
  if (value.colors !== undefined && (!isRecord(value.colors) ||
    ['primary', 'secondary', 'accent', 'background'].some((color) => typeof (value.colors as Record<string, unknown>)[color] !== 'string'))) return false
  if (value.event !== undefined && (!isRecord(value.event) ||
    ['title', 'edition', 'city', 'dateTime', 'location', 'organizerName', 'organizerLogoDataUrl', 'registrationText', 'registrationUrl']
      .some((field) => (value.event as Record<string, unknown>)[field] !== undefined && typeof (value.event as Record<string, unknown>)[field] !== 'string') ||
    ['includeSupportedBy', 'registrationEnabled']
      .some((field) => (value.event as Record<string, unknown>)[field] !== undefined && typeof (value.event as Record<string, unknown>)[field] !== 'boolean') ||
    (value.event.registrationStyle !== undefined && value.event.registrationStyle !== 'cta_url' && value.event.registrationStyle !== 'url_only'))) return false
  if (value.speakers !== undefined && (!Array.isArray(value.speakers) || value.speakers.some((speaker) => !isSupportedSpeaker(speaker)))) return false
  if (value.partners !== undefined && (!Array.isArray(value.partners) || value.partners.some((partner) =>
    !isRecord(partner) || typeof partner.id !== 'string' || typeof partner.imageDataUrl !== 'string' ||
    (partner.name !== undefined && typeof partner.name !== 'string')))) return false
  if (value.qrDestination !== undefined && !isQRDestination(value.qrDestination)) return false
  if (value.qrReadableText !== undefined && typeof value.qrReadableText !== 'boolean') return false
  if (value.export !== undefined && (!isRecord(value.export) ||
    (value.export.type !== undefined && value.export.type !== 'png' && value.export.type !== 'jpg') ||
    (value.export.scale !== undefined && value.export.scale !== 1 && value.export.scale !== 2))) return false
  return true
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DB_NAME, DRAFT_DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DRAFT_STORE_NAME)) {
        db.createObjectStore(DRAFT_STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB error'))
  })
}

export async function readDraft(): Promise<DraftReadResult> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readonly')
      const store = tx.objectStore(DRAFT_STORE_NAME)
      const req = store.get(DRAFT_KEY)

      req.onsuccess = () => {
        const record = req.result as DraftRecord | undefined
        if (!record) return resolve({ status: 'empty' })
        if (record.version !== undefined && (!Number.isInteger(record.version) || record.version < 1)) return resolve({ status: 'invalid' })
        if (record.version !== undefined && record.version > DRAFT_SCHEMA_VERSION) return resolve({ status: 'unsupported' })
        if (!isSupportedState(record.state)) return resolve({ status: 'invalid' })
        resolve({ status: 'restored', state: record.state })
      }
      req.onerror = () => reject(new Error(req.error?.message ?? 'IndexedDB error'))
    })
  } catch {
    return { status: 'error' }
  }
}

export async function writeDraft(state: BannerState): Promise<boolean> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite')
      const store = tx.objectStore(DRAFT_STORE_NAME)
      store.put({
        key: DRAFT_KEY,
        version: DRAFT_SCHEMA_VERSION,
        state,
        savedAt: new Date().toISOString(),
      })

      tx.oncomplete = () => resolve(true)
            tx.onerror = () => reject(new Error(tx.error?.message ?? 'IndexedDB error'))
    })
  } catch {
    return false
  }
}

export async function clearDraft(): Promise<boolean> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite')
      const store = tx.objectStore(DRAFT_STORE_NAME)
      store.delete(DRAFT_KEY)

      tx.oncomplete = () => resolve(true)
            tx.onerror = () => reject(new Error(tx.error?.message ?? 'IndexedDB error'))
    })
  } catch {
    return false
  }
}
