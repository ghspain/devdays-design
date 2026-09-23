import type { BannerState } from '../types'

const DRAFT_DB_NAME = 'DevDaysEditorDraft'
const DRAFT_DB_VERSION = 1
const DRAFT_STORE_NAME = 'drafts'
const DRAFT_KEY = 'current'

interface DraftRecord {
  key: string
  version: number
  state: BannerState
  savedAt: string
}

/** Returns a promise that resolves when the draft database is ready. */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DB_NAME, DRAFT_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DRAFT_STORE_NAME)) {
        db.createObjectStore(DRAFT_STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(new Error(request.error?.message ?? 'Failed to open IndexedDB'))
  })
}

/** Read the latest draft from IndexedDB. Returns null if no draft exists. */
export async function readDraft(): Promise<BannerState | null> {
  try {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DRAFT_STORE_NAME, 'readonly')
      const store = transaction.objectStore(DRAFT_STORE_NAME)
      const request = store.get(DRAFT_KEY)

      request.onsuccess = () => {
              const record = request.result as DraftRecord | undefined
        if (!record || record.version !== DRAFT_DB_VERSION) {
          resolve(null)
          return
        }
        resolve(record.state)
      }

            request.onerror = () => reject(new Error(request.error?.message ?? 'Failed to read draft'))
    })
  } catch {
    return null
  }
}

/** Save a draft to IndexedDB. Returns true on success, false on failure. */
export async function saveDraft(state: BannerState): Promise<boolean> {
  try {
    const db = await openDatabase()
    return new Promise((resolve) => {
      const transaction = db.transaction(DRAFT_STORE_NAME, 'readwrite')
      const store = transaction.objectStore(DRAFT_STORE_NAME)
      const record: DraftRecord = {
        key: DRAFT_KEY,
        version: DRAFT_DB_VERSION,
        state,
        savedAt: new Date().toISOString(),
      }
      const request = store.put(record)

      request.onsuccess = () => resolve(true)
      request.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

/** Clear the current draft from IndexedDB. */
export async function clearDraft(): Promise<void> {
  try {
    const db = await openDatabase()
    return new Promise((resolve) => {
      const transaction = db.transaction(DRAFT_STORE_NAME, 'readwrite')
      const store = transaction.objectStore(DRAFT_STORE_NAME)
      const request = store.delete(DRAFT_KEY)

      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
    })
  } catch {
    // Best effort: don't throw on clear failures.
  }
}