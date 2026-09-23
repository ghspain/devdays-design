import type { BannerState } from '../types'

const DRAFT_DB_NAME = 'devdays-banner-draft'
const DRAFT_STORE_NAME = 'drafts'
const DRAFT_VERSION = 1
const DRAFT_KEY = 'current'

interface DraftRecord {
  version: number
  state: BannerState
  savedAt: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DB_NAME, DRAFT_VERSION)

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

export async function readDraft(): Promise<BannerState | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readonly')
      const store = tx.objectStore(DRAFT_STORE_NAME)
      const req = store.get(DRAFT_KEY)

      req.onsuccess = () => {
        const record = req.result as DraftRecord | undefined
        if (record && record.version === DRAFT_VERSION) {
          resolve(record.state)
        } else {
          resolve(null)
        }
      }
      req.onerror = () => reject(new Error(req.error?.message ?? 'IndexedDB error'))
    })
  } catch {
    return null
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
        version: DRAFT_VERSION,
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