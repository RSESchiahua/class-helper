// ✅ HUA_SYNC_CHOICE_OPT_IN_CORE_20260712：老師可自行選擇本機儲存或 Google 雲端同步；切換模式不會刪除既有資料。
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
const SYNC_MODE_KEY = 'classHelperCloudSyncModeV2'
const CLOUD_RESERVED_PREFIX = 'classHelperCloud'

const nativeStorageSetItem = Storage.prototype.setItem
const nativeStorageRemoveItem = Storage.prototype.removeItem
const nativeStorageClear = Storage.prototype.clear

function readSavedSyncMode() {
  const saved = localStorage.getItem(SYNC_MODE_KEY)
  return saved === 'local' || saved === 'cloud' ? saved : 'unselected'
}

const initialSyncMode = readSavedSyncMode()

const state = reactive({
  user: null,
  status: initialSyncMode === 'unselected'
    ? 'choice-needed'
    : initialSyncMode === 'local'
      ? 'local-only'
      : 'starting',
  message: initialSyncMode === 'unselected'
    ? '請先選擇資料要只留在本機，或啟用雲端同步'
    : initialSyncMode === 'local'
      ? '資料只儲存在這台裝置'
      : '正在準備雲端同步…',
  lastSyncAt: localStorage.getItem(LAST_SYNC_KEY) || '',
  isOnline: navigator.onLine,
  uid: '',
  permissionDenied: false,
  hasCloudData: false,
  localOnly: initialSyncMode !== 'cloud',
  syncMode: initialSyncMode,
  needsModeChoice: initialSyncMode === 'unselected',
  conflictPending: false,
  conflictLocalCount: 0,
  conflictCloudCount: 0
})

export const cloudState = readonly(state)

let storageObserverInstalled = false
let cloudSyncStarted = false
let applyingRemote = false
let stopEntriesListener = null
let activeUserRoot = null
let activeEntriesRef = null
let lastCloudEntries = new Map()
let pendingConflictEntries = null
const pendingWriteTimers = new Map()

function setSavedSyncMode(mode) {
  state.syncMode = mode
  state.needsModeChoice = false
  nativeStorageSetItem.call(localStorage, SYNC_MODE_KEY, mode)
}

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

function snapshotsEquivalent(localSnapshot, cloudEntries) {
  const localKeys = Object.keys(localSnapshot)
  if (localKeys.length !== cloudEntries.size) return false

  return localKeys.every(key => {
    const cloudEntry = cloudEntries.get(key)
    return cloudEntry && cloudEntry.value === localSnapshot[key]
  })
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
      const localKeys = Object.keys(readLocalSnapshot())
      for (const key of localKeys) {
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

function clearConflictState() {
  pendingConflictEntries = null
  state.conflictPending = false
  state.conflictLocalCount = 0
  state.conflictCloudCount = 0
}

function clearPendingWriteTimers() {
  for (const timer of pendingWriteTimers.values()) clearTimeout(timer)
  pendingWriteTimers.clear()
}

function detachCloudConnection({ clearReferences = true } = {}) {
  stopEntriesListener?.()
  stopEntriesListener = null
  clearPendingWriteTimers()
  lastCloudEntries = new Map()
  clearConflictState()

  if (clearReferences) {
    activeUserRoot = null
    activeEntriesRef = null
  }
}

function setLocalModeState(message = '資料只儲存在這台裝置') {
  state.status = 'local-only'
  state.message = message
  state.permissionDenied = false
  state.localOnly = true
  state.hasCloudData = false
}

async function uploadLocalSnapshot({ replaceCloud = false } = {}) {
  if (!activeUserRoot || !activeEntriesRef) return

  const localSnapshot = readLocalSnapshot()
  const now = Date.now()
  const entries = {}

  for (const [key, value] of Object.entries(localSnapshot)) {
    entries[encodeStorageKey(key)] = {
      key,
      value,
      updatedAt: now,
      deviceId
    }
  }

  state.status = 'syncing'
  state.message = replaceCloud
    ? '正在以這台裝置的資料更新雲端…'
    : '正在上傳這台裝置的既有資料…'

  if (replaceCloud) {
    await set(activeEntriesRef, Object.keys(entries).length ? entries : null)
    await update(activeUserRoot, {
      'meta/updatedAt': now,
      'meta/updatedByDevice': deviceId,
      'meta/schemaVersion': 2
    })
  } else {
    const updates = {
      'meta/updatedAt': now,
      'meta/updatedByDevice': deviceId,
      'meta/schemaVersion': 2
    }
    for (const [encodedKey, entry] of Object.entries(entries)) {
      updates[`entries/${encodedKey}`] = entry
    }
    await update(activeUserRoot, updates)
  }

  clearAllDirtyKeys()
  writeLastSync()
  state.hasCloudData = Object.keys(localSnapshot).length > 0
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
  updates['meta/schemaVersion'] = 2
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
  updates['meta/schemaVersion'] = 2

  await update(activeUserRoot, updates)
  clearAllDirtyKeys()
}

function handleCloudPermissionError(error) {
  console.warn('Firebase 雲端資料讀寫尚未授權：', error)
  state.permissionDenied = error?.code === 'PERMISSION_DENIED' || error?.code === 'permission-denied'
  state.status = state.permissionDenied ? 'permission-denied' : 'error'
  state.message = state.permissionDenied
    ? '已登入，但 Firebase 資料庫規則尚未更新'
    : '雲端連線失敗，資料仍保存在本機'
  state.localOnly = true
}

function beginRealtimeListener() {
  if (!activeEntriesRef || state.syncMode !== 'cloud') return
  stopEntriesListener?.()

  stopEntriesListener = onValue(
    activeEntriesRef,
    snapshot => {
      if (state.syncMode !== 'cloud' || state.conflictPending) return
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
  if (state.syncMode !== 'cloud') return

  stopEntriesListener?.()
  stopEntriesListener = null
  lastCloudEntries = new Map()
  clearConflictState()
  state.permissionDenied = false
  state.uid = user.uid
  state.status = 'connecting'
  state.message = '正在檢查這台裝置與雲端資料…'

  activeUserRoot = databaseRef(firebaseDatabase, `users/${user.uid}/current`)
  activeEntriesRef = databaseRef(firebaseDatabase, `users/${user.uid}/current/entries`)

  try {
    const snapshot = await get(activeUserRoot)
    if (state.syncMode !== 'cloud') return

    const cloudRoot = snapshot.val()
    const cloudEntries = normalizeCloudEntries(cloudRoot?.entries)
    const localSnapshot = readLocalSnapshot()
    const localCount = Object.keys(localSnapshot).length
    const dirtyKeys = new Set(Object.keys(readDirtyKeys()).filter(shouldSyncKey))

    state.hasCloudData = cloudEntries.size > 0

    if (cloudEntries.size === 0) {
      await uploadLocalSnapshot()
      beginRealtimeListener()
      return
    }

    if (localCount === 0) {
      applyCloudEntries(cloudEntries, { removeMissing: true })
      clearAllDirtyKeys()
      writeLastSync()
      state.status = 'synced'
      state.message = '已載入你的雲端資料'
      state.localOnly = false
      beginRealtimeListener()
      return
    }

    if (dirtyKeys.size > 0) {
      applyCloudEntries(cloudEntries, { removeMissing: true, skipKeys: dirtyKeys })
      await uploadDirtyKeys()
      await uploadLocalOnlyKeys(cloudEntries)
      writeLastSync()
      state.status = 'synced'
      state.message = '離線期間的變更已同步'
      state.localOnly = false
      beginRealtimeListener()
      return
    }

    if (snapshotsEquivalent(localSnapshot, cloudEntries)) {
      lastCloudEntries = cloudEntries
      writeLastSync()
      state.status = 'synced'
      state.message = '雲端同步完成'
      state.localOnly = false
      beginRealtimeListener()
      return
    }

    pendingConflictEntries = cloudEntries
    state.conflictPending = true
    state.conflictLocalCount = localCount
    state.conflictCloudCount = cloudEntries.size
    state.status = 'conflict'
    state.message = '這台裝置與雲端都有不同資料，請選擇要保留哪一份'
    state.localOnly = true
  } catch (error) {
    handleCloudPermissionError(error)
  }
}

async function writeStorageKeyToCloud(key, value) {
  if (state.syncMode !== 'cloud' || state.conflictPending) return
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
      'meta/schemaVersion': 2
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
  if (applyingRemote || state.syncMode !== 'cloud') return
  const { key, value } = event.detail || {}
  markDirtyKey(key)
  scheduleStorageWrite(key, value)
}

function handleOnline() {
  state.isOnline = true
  if (state.syncMode === 'cloud' && state.user && !state.permissionDenied) {
    state.status = 'connecting'
    state.message = '網路已恢復，正在重新同步…'
    connectSignedInUser(state.user)
  } else if (state.syncMode === 'local') {
    setLocalModeState()
  }
}

function handleOffline() {
  state.isOnline = false
  if (state.syncMode === 'cloud') {
    state.status = 'offline'
    state.message = '目前離線，變更會先留在這台裝置'
  } else if (state.syncMode === 'local') {
    setLocalModeState()
  }
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
  if (cloudSyncStarted) return
  cloudSyncStarted = true

  try {
    await prepareFirebaseAuth()
    await getRedirectResult(firebaseAuth).catch(error => {
      if (error?.code !== 'auth/no-auth-event') console.warn('Google 重新導向登入結果：', error)
    })

    onAuthStateChanged(firebaseAuth, user => {
      state.user = user
      state.uid = user?.uid || ''

      if (state.syncMode === 'unselected') {
        detachCloudConnection()
        state.status = 'choice-needed'
        state.message = '請先選擇資料要只留在本機，或啟用雲端同步'
        state.localOnly = true
        return
      }

      if (state.syncMode === 'local') {
        detachCloudConnection()
        setLocalModeState()
        return
      }

      if (!user) {
        detachCloudConnection()
        state.status = 'signed-out'
        state.message = '雲端同步已開啟，請使用 Google 登入'
        state.permissionDenied = false
        state.localOnly = true
        return
      }

      connectSignedInUser(user)
    })
  } catch (error) {
    console.error('Firebase 初始化失敗：', error)
    state.status = 'error'
    state.message = 'Firebase 初始化失敗，仍可使用本機資料'
    state.localOnly = true
  }
}

export async function chooseLocalStorageMode() {
  setSavedSyncMode('local')
  detachCloudConnection()
  clearAllDirtyKeys()
  setLocalModeState('已切換為本機儲存；雲端舊備份不會被刪除')

  if (firebaseAuth.currentUser) {
    try {
      await signOut(firebaseAuth)
    } catch (error) {
      console.warn('Google 登出失敗，但本機模式已生效：', error)
    }
  }
}

export async function enableCloudSync() {
  setSavedSyncMode('cloud')
  state.localOnly = true
  state.status = 'connecting'
  state.message = '正在準備啟用雲端同步…'

  const user = firebaseAuth.currentUser
  if (user) {
    state.user = user
    state.uid = user.uid
    await connectSignedInUser(user)
    return
  }

  await signInCloud()
}

export async function signInCloud() {
  if (state.syncMode !== 'cloud') setSavedSyncMode('cloud')
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
      ? '已取消登入；資料仍保存在這台裝置'
      : 'Google 登入失敗，請稍後再試'
    state.localOnly = true
    throw error
  }
}

export async function signOutCloud() {
  detachCloudConnection()
  await signOut(firebaseAuth)
  state.status = 'signed-out'
  state.message = '已登出；雲端同步設定仍保留，可隨時重新登入'
  state.localOnly = true
}

export async function retryCloudSync() {
  if (state.syncMode !== 'cloud') return enableCloudSync()
  if (!state.user) return signInCloud()
  await connectSignedInUser(state.user)
}

export async function resolveSyncConflict(source) {
  if (!state.conflictPending || !pendingConflictEntries) return false
  if (!activeUserRoot || !activeEntriesRef || !state.user) return false

  try {
    if (source === 'local') {
      await uploadLocalSnapshot({ replaceCloud: true })
    } else if (source === 'cloud') {
      state.status = 'syncing'
      state.message = '正在以雲端資料更新這台裝置…'
      applyCloudEntries(pendingConflictEntries, { removeMissing: true })
      clearAllDirtyKeys()
      writeLastSync()
      state.status = 'synced'
      state.message = '已使用雲端資料'
      state.localOnly = false
    } else {
      return false
    }

    clearConflictState()
    beginRealtimeListener()
    return true
  } catch (error) {
    handleCloudPermissionError(error)
    return false
  }
}

export async function copyCloudUid() {
  if (!state.uid) return false
  await navigator.clipboard.writeText(state.uid)
  return true
}

export function downloadFullBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: state.syncMode === 'cloud' ? '班級助手雲端同步版' : '班級助手本機版',
    storageMode: state.syncMode,
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