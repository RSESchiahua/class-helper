// ✅ HUA_FIREBASE_CLOUD_SYNC_CORE_20260711：Google 登入、localStorage 雲端備份、手機與桌機即時同步核心。
import { reactive, readonly } from 'vue'
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'firebase/auth'
import {
  get,
  onValue,
  ref as databaseRef,
  set,
  update
} from 'firebase/database'
import {
  firebaseAuth,
  firebaseDatabase,
  googleProvider,
  prepareFirebaseAuth
} from './firebase'

export const CLOUD_DATA_UPDATED_EVENT = 'class-helper-cloud-data-updated'
const LOCAL_STORAGE_CHANGED_EVENT = 'class-helper-local-storage-changed'
const DEVICE_ID_KEY = 'classHelperCloudDeviceIdV1'
const LAST_SYNC_KEY = 'classHelperCloudLastSyncV1'
const DIRTY_KEYS_KEY = 'classHelperCloudDirtyKeysV1'
const CLOUD_RESERVED_PREFIX = 'classHelperCloud'

const state = reactive({
  user: null,
  status: 'starting',
  message: '正在準備雲端同步…',
  lastSyncAt: localStorage.getItem(LAST_SYNC_KEY) || '',
  isOnline: navigator.onLine,
  uid: '',
  permissionDenied: false,
  hasCloudData: false,
  localOnly: true
})

export const cloudState = readonly(state)

let storageObserverInstalled = false
let applyingRemote = false
let stopEntriesListener = null
let activeUserRoot = null
let activeEntriesRef = null
let lastCloudEntries = new Map()
const pendingWriteTimers = new Map()

const nativeStorageSetItem = Storage.prototype.setItem
const nativeStorageRemoveItem = Storage.prototype.removeItem
const nativeStorageClear = Storage.prototype.clear

function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    nativeStorageSetItem.call(localStorage, DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

const deviceId = getDeviceId()

function shouldSyncKey(key) {
  const text = String(key || '')
  return Boolean(text) && !text.startsWith(CLOUD_RESERVED_PREFIX) && !text.startsWith('firebase:')
}


function readDirtyKeys() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DIRTY_KEYS_KEY) || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeDirtyKeys(value) {
  nativeStorageSetItem.call(localStorage, DIRTY_KEYS_KEY, JSON.stringify(value))
}

function markDirtyKey(key) {
  if (!shouldSyncKey(key)) return
  const dirty = readDirtyKeys()
  dirty[key] = Date.now()
  writeDirtyKeys(dirty)
}

function clearDirtyKey(key) {
  const dirty = readDirtyKeys()
  if (!(key in dirty)) return
  delete dirty[key]
  writeDirtyKeys(dirty)
}

function clearAllDirtyKeys() {
  writeDirtyKeys({})
}

function encodeStorageKey(key) {
  const bytes = new TextEncoder().encode(String(key))
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function readLocalSnapshot() {
  const result = {}
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!shouldSyncKey(key)) continue
    result[key] = localStorage.getItem(key)
  }
  return result
}

function writeLastSync(value = new Date().toISOString()) {
  state.lastSyncAt = value
  nativeStorageSetItem.call(localStorage, LAST_SYNC_KEY, value)
}

function dispatchCloudUpdate(keys, reason = 'remote') {
  if (!keys.length) return
  window.dispatchEvent(new CustomEvent(CLOUD_DATA_UPDATED_EVENT, {
    detail: { keys: [...new Set(keys)], reason }
  }))
}

function normalizeCloudEntries(value) {
  const map = new Map()
  if (!value || typeof value !== 'object') return map

  for (const entry of Object.values(value)) {
    if (!entry || typeof entry !== 'object' || !shouldSyncKey(entry.key)) continue
    map.set(String(entry.key), {
      key: String(entry.key),
      value: entry.value === null || entry.value === undefined ? null : String(entry.value),
      updatedAt: Number(entry.updatedAt) || 0,
      deviceId: String(entry.deviceId || '')
    })
  }
  return map
}

function applyCloudEntries(nextEntries, { removeMissing = false, skipKeys = new Set() } = {}) {
  const changedKeys = []
  applyingRemote = true

  try {
    for (const [key, entry] of nextEntries.entries()) {
      if (skipKeys.has(key)) continue
      const currentValue = localStorage.getItem(key)
      if (entry.value === null) {
        if (currentValue !== null) {
          nativeStorageRemoveItem.call(localStorage, key)
          changedKeys.push(key)
        }
      } else if (currentValue !== entry.value) {
        nativeStorageSetItem.call(localStorage, key, entry.value)
        changedKeys.push(key)
      }
    }

    if (removeMissing) {
      for (const key of lastCloudEntries.keys()) {
        if (skipKeys.has(key)) continue
        if (!nextEntries.has(key) && localStorage.getItem(key) !== null) {
          nativeStorageRemoveItem.call(localStorage, key)
          changedKeys.push(key)
        }
      }
    }
  } finally {
    applyingRemote = false
  }

  lastCloudEntries = nextEntries
  dispatchCloudUpdate(changedKeys)
  return changedKeys
}

async function uploadLocalSnapshot() {
  if (!activeUserRoot) return

  const localSnapshot = readLocalSnapshot()
  const now = Date.now()
  const updates = {
    'meta/updatedAt': now,
    'meta/updatedByDevice': deviceId,
    'meta/schemaVersion': 1
  }

  for (const [key, value] of Object.entries(localSnapshot)) {
    updates[`entries/${encodeStorageKey(key)}`] = {
      key,
      value,
      updatedAt: now,
      deviceId
    }
  }

  state.status = 'syncing'
  state.message = '正在上傳這台電腦的既有資料…'
  await update(activeUserRoot, updates)
  clearAllDirtyKeys()
  writeLastSync()
  state.status = 'synced'
  state.message = '雲端同步完成'
  state.localOnly = false
}

async function uploadLocalOnlyKeys(cloudEntries) {
  if (!activeUserRoot) return
  const localSnapshot = readLocalSnapshot()
  const updates = {}
  const now = Date.now()

  for (const [key, value] of Object.entries(localSnapshot)) {
    if (cloudEntries.has(key)) continue
    updates[`entries/${encodeStorageKey(key)}`] = {
      key,
      value,
      updatedAt: now,
      deviceId
    }
  }

  if (Object.keys(updates).length === 0) return
  updates['meta/updatedAt'] = now
  updates['meta/updatedByDevice'] = deviceId
  await update(activeUserRoot, updates)
}


async function uploadDirtyKeys() {
  if (!activeUserRoot) return
  const dirty = readDirtyKeys()
  const keys = Object.keys(dirty).filter(shouldSyncKey)
  if (keys.length === 0) return

  const updates = {}
  const now = Date.now()
  for (const key of keys) {
    const value = localStorage.getItem(key)
    const path = `entries/${encodeStorageKey(key)}`
    updates[path] = value === null
      ? null
      : { key, value, updatedAt: Number(dirty[key]) || now, deviceId }
  }
  updates['meta/updatedAt'] = now
  updates['meta/updatedByDevice'] = deviceId
  updates['meta/schemaVersion'] = 1

  await update(activeUserRoot, updates)
  clearAllDirtyKeys()
}

function handleCloudPermissionError(error) {
  console.warn('Firebase 雲端資料讀寫尚未授權：', error)
  state.permissionDenied = error?.code === 'PERMISSION_DENIED' || error?.code === 'permission-denied'
  state.status = state.permissionDenied ? 'permission-denied' : 'error'
  state.message = state.permissionDenied
    ? '已登入，但資料庫尚未加入你的 UID 權限'
    : '雲端連線失敗，資料仍保存在本機'
  state.localOnly = true
}

function beginRealtimeListener() {
  if (!activeEntriesRef) return
  stopEntriesListener?.()

  stopEntriesListener = onValue(
    activeEntriesRef,
    snapshot => {
      const nextEntries = normalizeCloudEntries(snapshot.val())
      applyCloudEntries(nextEntries, { removeMissing: true })
      state.hasCloudData = nextEntries.size > 0
      state.permissionDenied = false
      state.status = navigator.onLine ? 'synced' : 'offline'
      state.message = navigator.onLine ? '雲端同步完成' : '目前離線，變更會先留在本機'
      state.localOnly = false
      writeLastSync()
    },
    handleCloudPermissionError
  )
}

async function connectSignedInUser(user) {
  stopEntriesListener?.()
  stopEntriesListener = null
  lastCloudEntries = new Map()
  state.permissionDenied = false
  state.uid = user.uid
  state.status = 'connecting'
  state.message = '正在連接你的班級雲端資料…'

  activeUserRoot = databaseRef(firebaseDatabase, `users/${user.uid}/current`)
  activeEntriesRef = databaseRef(firebaseDatabase, `users/${user.uid}/current/entries`)

  try {
    const snapshot = await get(activeUserRoot)
    const cloudRoot = snapshot.val()
    const cloudEntries = normalizeCloudEntries(cloudRoot?.entries)

    if (cloudEntries.size === 0) {
      await uploadLocalSnapshot()
    } else {
      state.hasCloudData = true
      const dirtyKeys = new Set(Object.keys(readDirtyKeys()))
      applyCloudEntries(cloudEntries, { skipKeys: dirtyKeys })
      await uploadDirtyKeys()
      await uploadLocalOnlyKeys(cloudEntries)
      writeLastSync()
      state.status = 'synced'
      state.message = '雲端同步完成'
      state.localOnly = false
    }

    beginRealtimeListener()
  } catch (error) {
    handleCloudPermissionError(error)
  }
}

async function writeStorageKeyToCloud(key, value) {
  if (!activeEntriesRef || !state.user || state.permissionDenied || !navigator.onLine) return
  if (!shouldSyncKey(key)) return

  const previous = lastCloudEntries.get(key)
  const normalizedValue = value === null || value === undefined ? null : String(value)
  if (previous?.value === normalizedValue) {
    clearDirtyKey(key)
    return
  }

  state.status = 'syncing'
  state.message = '正在同步剛剛的變更…'

  try {
    const entryRef = databaseRef(
      firebaseDatabase,
      `users/${state.user.uid}/current/entries/${encodeStorageKey(key)}`
    )

    if (normalizedValue === null) {
      await set(entryRef, null)
    } else {
      await set(entryRef, {
        key,
        value: normalizedValue,
        updatedAt: Date.now(),
        deviceId
      })
    }

    await update(activeUserRoot, {
      'meta/updatedAt': Date.now(),
      'meta/updatedByDevice': deviceId,
      'meta/schemaVersion': 1
    })

    clearDirtyKey(key)
    writeLastSync()
    state.status = 'synced'
    state.message = '雲端同步完成'
    state.localOnly = false
  } catch (error) {
    handleCloudPermissionError(error)
  }
}

function scheduleStorageWrite(key, value) {
  if (!shouldSyncKey(key)) return
  clearTimeout(pendingWriteTimers.get(key))
  const timer = window.setTimeout(() => {
    pendingWriteTimers.delete(key)
    writeStorageKeyToCloud(key, value)
  }, 320)
  pendingWriteTimers.set(key, timer)
}

function handleLocalStorageChanged(event) {
  if (applyingRemote) return
  const { key, value } = event.detail || {}
  markDirtyKey(key)
  scheduleStorageWrite(key, value)
}

function handleOnline() {
  state.isOnline = true
  if (state.user && !state.permissionDenied) {
    state.status = 'connecting'
    state.message = '網路已恢復，正在重新同步…'
    connectSignedInUser(state.user)
  }
}

function handleOffline() {
  state.isOnline = false
  state.status = 'offline'
  state.message = '目前離線，變更會先留在這台裝置'
}

export function installLocalStorageObserver() {
  if (storageObserverInstalled) return
  storageObserverInstalled = true

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    nativeStorageSetItem.call(this, key, value)
    if (this === localStorage && !applyingRemote) {
      window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_CHANGED_EVENT, {
        detail: { key: String(key), value: String(value) }
      }))
    }
  }

  Storage.prototype.removeItem = function patchedRemoveItem(key) {
    nativeStorageRemoveItem.call(this, key)
    if (this === localStorage && !applyingRemote) {
      window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_CHANGED_EVENT, {
        detail: { key: String(key), value: null }
      }))
    }
  }

  Storage.prototype.clear = function patchedClear() {
    const keys = []
    if (this === localStorage) {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index)
        if (shouldSyncKey(key)) keys.push(key)
      }
    }

    nativeStorageClear.call(this)

    if (this === localStorage && !applyingRemote) {
      keys.forEach(key => {
        window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_CHANGED_EVENT, {
          detail: { key, value: null }
        }))
      })
    }
  }

  window.addEventListener(LOCAL_STORAGE_CHANGED_EVENT, handleLocalStorageChanged)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
}

export async function startCloudSync() {
  try {
    await prepareFirebaseAuth()
    await getRedirectResult(firebaseAuth).catch(error => {
      if (error?.code !== 'auth/no-auth-event') console.warn('Google 重新導向登入結果：', error)
    })

    onAuthStateChanged(firebaseAuth, user => {
      state.user = user
      state.uid = user?.uid || ''

      if (!user) {
        stopEntriesListener?.()
        stopEntriesListener = null
        activeUserRoot = null
        activeEntriesRef = null
        lastCloudEntries = new Map()
        state.status = 'signed-out'
        state.message = '尚未登入，現在使用本機資料'
        state.permissionDenied = false
        state.localOnly = true
        return
      }

      connectSignedInUser(user)
    })
  } catch (error) {
    console.error('Firebase 初始化失敗：', error)
    state.status = 'error'
    state.message = 'Firebase 初始化失敗，仍可使用本機版'
  }
}

export async function signInCloud() {
  state.status = 'connecting'
  state.message = '正在開啟 Google 登入…'
  try {
    await signInWithPopup(firebaseAuth, googleProvider)
  } catch (error) {
    const redirectCodes = new Set([
      'auth/popup-blocked',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment'
    ])

    if (redirectCodes.has(error?.code)) {
      await signInWithRedirect(firebaseAuth, googleProvider)
      return
    }

    state.status = 'signed-out'
    state.message = error?.code === 'auth/popup-closed-by-user'
      ? '已取消登入，資料仍保存在本機'
      : 'Google 登入失敗，請稍後再試'
    throw error
  }
}

export async function signOutCloud() {
  await signOut(firebaseAuth)
}

export async function retryCloudSync() {
  if (!state.user) return signInCloud()
  await connectSignedInUser(state.user)
}

export async function copyCloudUid() {
  if (!state.uid) return false
  await navigator.clipboard.writeText(state.uid)
  return true
}

export function downloadFullBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: '班級助手 Firebase 正式版',
    cloudStatus: state.status,
    data: readLocalSnapshot()
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `班級助手完整備份-${date}.json`
  link.click()
  URL.revokeObjectURL(url)
}
