import type { BannerState } from '../types'
import { EVENT_THEMES, formatOptions } from '../constants'

const DRAFT_DB_NAME = 'devdays-banner-draft'
const DRAFT_STORE_NAME = 'drafts'
const DRAFT_SCHEMA_VERSION = 2
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

function isSupportedState(value: unknown): value is BannerState {
  if (!isRecord(value)) return false
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
  if (value.speakers !== undefined && (!Array.isArray(value.speakers) || value.speakers.some((speaker) =>
    !isRecord(speaker) || typeof speaker.id !== 'string' || typeof speaker.name !== 'string' ||
    ['role', 'photoDataUrl', 'talkTitle', 'talkTime', 'catalogId']
      .some((field) => speaker[field] !== undefined && typeof speaker[field] !== 'string')))) return false
  if (value.partners !== undefined && (!Array.isArray(value.partners) || value.partners.some((partner) =>
    !isRecord(partner) || typeof partner.id !== 'string' || typeof partner.imageDataUrl !== 'string' ||
    (partner.name !== undefined && typeof partner.name !== 'string')))) return false
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
