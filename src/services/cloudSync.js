// ✅ HUA_PERSONAL_FIREBASE_REAL_SYNC_20260712：本機優先、個人 Firebase 即時同步、版本衝突保護與跨裝置更新。
// ✅ HUA_CLOUD_IDENTITY_SWITCH_PROTECTION_20260712：切換 Firebase 專案或 Google 帳號時不再自動上傳本機班級資料，必須由老師明確選擇。
// ✅ HUA_APP_CHECK_SYNC_ERROR_GUIDANCE_20260712：App Check 權杖或強制狀態異常時，顯示可理解的修正提示。
import { reactive, readonly } from 'vue'
import { get, onValue, ref, runTransaction } from 'firebase/database'
import {
  exportFullBackup,
  getClassDataSummaryFromObject,
  getLastCloudIdentity,
  getPersonalFirebaseConfig,
  getStorageMode,
  hasMeaningfulClassData,
  isClassDataKey,
  readClassData,
  replaceClassData,
  sanitizeClassData,
  saveLastCloudIdentity,
  setStorageMode
} from './dataCenter'
import {
  initializeTeacherFirebase,
  signInTeacherFirebase,
  signOutTeacherFirebase,
  waitForTeacherAuth
} from './firebase'

export const CLOUD_DATA_UPDATED_EVENT = 'class-helper-cloud-data-updated'
export const CLOUD_STATE_UPDATED_EVENT = 'class-helper-cloud-state-updated'
const LOCAL_STORAGE_MUTATION_EVENT = 'class-helper-local-storage-mutated'
const SYNC_META_KEY = 'classHelperCloudSyncMetaV1'
const DEVICE_ID_KEY = 'classHelperDeviceIdV1'
const FORCE_UPLOAD_PENDING_KEY = 'classHelperCloudForceUploadPendingV1'
const CLOUD_SCHEMA_VERSION = 1
const CLOUD_PATH_SEGMENT = 'classHelper/currentClass'
const SYNC_DEBOUNCE_MS = 700

const state = reactive({
  user: null,
  status: 'local-only',
  message: '資料只儲存在這台裝置',
  lastSyncAt: '',
  isOnline: navigator.onLine,
  uid: '',
  permissionDenied: false,
  hasCloudData: false,
  localOnly: true,
  syncMode: getStorageMode(),
  needsModeChoice: false,
  conflictPending: false,
  conflictLocalCount: 0,
  conflictCloudCount: 0,
  conflictCloudUpdatedAt: '',
  pendingChanges: false,
  projectId: '',
  email: ''
})
export const cloudState = readonly(state)

let observerInstalled = false
let storagePrototypePatched = false
let applyingCloudData = false
let syncTimer = null
let observerPollId = null
let lastObservedHash = ''
let cloudUnsubscribe = null
let activeServices = null
let activeCloudRef = null
let pendingRemotePayload = null
let connectionToken = 0

function emitState() {
  window.dispatchEvent(new CustomEvent(CLOUD_STATE_UPDATED_EVENT))
}

function setState(patch) {
  Object.assign(state, patch)
  emitState()
}

function nowIso() {
  return new Date().toISOString()
}

function isAppCheckError(error) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')
  return /app.?check|recaptcha/i.test(`${code} ${message}`)
}

function friendlyCloudError(error, deniedMessage = 'Firebase 拒絕存取，請檢查安全規則與 App Check') {
  const denied = error?.code === 'PERMISSION_DENIED' || error?.code === 'permission-denied'
  if (isAppCheckError(error)) return 'App Check 驗證失敗，請確認 Site Key、正式網域與 Firebase App Check 設定'
  if (denied) return deniedMessage
  return error?.message || '無法啟動雲端同步'
}

function safeJson(raw, fallback = null) {
  try {
    const value = JSON.parse(raw || '')
    return value ?? fallback
  } catch {
    return fallback
  }
}

function getDeviceId() {
  const saved = localStorage.getItem(DEVICE_ID_KEY)
  if (saved) return saved
  const id = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  localStorage.setItem(DEVICE_ID_KEY, id)
  return id
}

function canonicalData(data) {
  return Object.fromEntries(
    Object.entries(data || {})
      .filter(([, value]) => typeof value === 'string')
      .sort(([a], [b]) => a.localeCompare(b))
  )
}

function hashText(text) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function hashClassData(data = readClassData()) {
  return hashText(JSON.stringify(canonicalData(data)))
}

function payloadHash(payload) {
  if (!payload || typeof payload !== 'object') return ''
  return String(payload.dataHash || hashClassData(payload.classData || {}))
}

function normalizeRemotePayload(value) {
  if (!value || typeof value !== 'object') return null
  const classData = canonicalData(sanitizeClassData(value.classData || {}))
  return {
    schemaVersion: Number(value.schemaVersion) || CLOUD_SCHEMA_VERSION,
    revision: Math.max(0, Number(value.revision) || 0),
    updatedAt: String(value.updatedAt || ''),
    updatedBy: String(value.updatedBy || ''),
    dataHash: String(value.dataHash || hashClassData(classData)),
    classData
  }
}

function buildPayload(classData, revision) {
  const cleanData = canonicalData(classData)
  return {
    schemaVersion: CLOUD_SCHEMA_VERSION,
    revision: Math.max(1, Number(revision) || 1),
    updatedAt: nowIso(),
    updatedBy: getDeviceId(),
    dataHash: hashClassData(cleanData),
    classData: cleanData
  }
}

function getSyncMeta() {
  const saved = safeJson(localStorage.getItem(SYNC_META_KEY), {})
  if (!saved || typeof saved !== 'object') return {}
  return saved
}

function saveSyncMeta(remotePayload, localHash = payloadHash(remotePayload)) {
  const revision = Number(remotePayload?.revision) || 0
  const cloudHash = revision > 0 ? payloadHash(remotePayload) : String(remotePayload?.dataHash || '')
  const meta = {
    uid: state.uid,
    projectId: state.projectId,
    cloudRevision: revision,
    cloudHash,
    syncedHash: localHash,
    lastSyncAt: nowIso()
  }
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta))
  saveLastCloudIdentity({ uid: state.uid, projectId: state.projectId })
  setState({ lastSyncAt: meta.lastSyncAt })
  return meta
}

function getIdentityMeta() {
  const meta = getSyncMeta()
  if (meta.uid !== state.uid || meta.projectId !== state.projectId) return {}
  return meta
}

function clearSyncTimer() {
  if (syncTimer) window.clearTimeout(syncTimer)
  syncTimer = null
}

function stopRealtimeListener() {
  if (typeof cloudUnsubscribe === 'function') cloudUnsubscribe()
  cloudUnsubscribe = null
}

function resetConnection() {
  connectionToken += 1
  clearSyncTimer()
  stopRealtimeListener()
  activeServices = null
  activeCloudRef = null
  pendingRemotePayload = null
}

function setLocalOnlyState(message = '資料只儲存在這台裝置') {
  setState({
    user: null,
    status: 'local-only',
    message,
    uid: '',
    permissionDenied: false,
    hasCloudData: false,
    localOnly: true,
    syncMode: 'local',
    conflictPending: false,
    conflictLocalCount: 0,
    conflictCloudCount: 0,
    conflictCloudUpdatedAt: '',
    pendingChanges: false,
    projectId: '',
    email: ''
  })
}

function patchLocalStorage() {
  if (storagePrototypePatched) return
  storagePrototypePatched = true
  const prototype = Object.getPrototypeOf(window.localStorage)
  const originalSetItem = prototype.setItem
  const originalRemoveItem = prototype.removeItem
  const originalClear = prototype.clear

  prototype.setItem = function patchedSetItem(key, value) {
    const oldValue = this === window.localStorage ? this.getItem(key) : null
    originalSetItem.call(this, key, value)
    if (this === window.localStorage && oldValue !== String(value)) {
      window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_MUTATION_EVENT, {
        detail: { key: String(key), oldValue, newValue: String(value) }
      }))
    }
  }

  prototype.removeItem = function patchedRemoveItem(key) {
    const oldValue = this === window.localStorage ? this.getItem(key) : null
    originalRemoveItem.call(this, key)
    if (this === window.localStorage && oldValue !== null) {
      window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_MUTATION_EVENT, {
        detail: { key: String(key), oldValue, newValue: null }
      }))
    }
  }

  prototype.clear = function patchedClear() {
    const keys = this === window.localStorage
      ? Array.from({ length: this.length }, (_, index) => this.key(index)).filter(Boolean)
      : []
    originalClear.call(this)
    if (this === window.localStorage) {
      for (const key of keys) {
        window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_MUTATION_EVENT, {
          detail: { key, oldValue: null, newValue: null }
        }))
      }
    }
  }
}

function scheduleLocalUpload() {
  if (applyingCloudData || getStorageMode() !== 'firebase') return
  setState({ pendingChanges: true })
  if (!navigator.onLine) {
    setState({ status: 'offline', message: '目前離線；變更已安全保存在這台裝置', localOnly: false })
    return
  }
  if (!activeCloudRef || !state.uid || state.conflictPending) return
  clearSyncTimer()
  syncTimer = window.setTimeout(() => {
    syncTimer = null
    void syncNow()
  }, SYNC_DEBOUNCE_MS)
}

function handleLocalStorageMutation(event) {
  const key = event?.detail?.key
  if (!key || !isClassDataKey(key)) return
  lastObservedHash = hashClassData()
  scheduleLocalUpload()
}

function handleStorageEvent(event) {
  if (!event.key || !isClassDataKey(event.key)) return
  scheduleLocalUpload()
}

function handleOnline() {
  setState({ isOnline: true })
  if (getStorageMode() === 'firebase') void retryCloudSync()
}

function handleOffline() {
  setState({
    isOnline: false,
    status: getStorageMode() === 'firebase' ? 'offline' : 'local-only',
    message: getStorageMode() === 'firebase'
      ? '目前離線；資料仍會先保存在這台裝置'
      : '資料只儲存在這台裝置'
  })
}

export function installLocalStorageObserver() {
  if (observerInstalled) return
  observerInstalled = true
  try {
    patchLocalStorage()
  } catch (error) {
    console.warn('無法攔截 localStorage，已改用輪詢偵測同步變更。', error)
  }
  lastObservedHash = hashClassData()
  window.addEventListener(LOCAL_STORAGE_MUTATION_EVENT, handleLocalStorageMutation)
  window.addEventListener('storage', handleStorageEvent)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Safari 等瀏覽器若限制覆寫 Storage 方法，仍以低頻雜湊輪詢補捉同分頁變更。
  observerPollId = window.setInterval(() => {
    const nextHash = hashClassData()
    if (nextHash === lastObservedHash) return
    lastObservedHash = nextHash
    scheduleLocalUpload()
  }, 1400)
}

function setConflict(remotePayload) {
  const localData = readClassData()
  const localSummary = getClassDataSummaryFromObject(localData)
  const cloudSummary = getClassDataSummaryFromObject(remotePayload?.classData || {})
  pendingRemotePayload = remotePayload
  clearSyncTimer()
  setState({
    status: 'conflict',
    message: '發現這台裝置與雲端都有不同資料，請選擇要保留哪一份',
    conflictPending: true,
    conflictLocalCount: localSummary.dataKeyCount,
    conflictCloudCount: cloudSummary.dataKeyCount,
    conflictCloudUpdatedAt: remotePayload?.updatedAt || '',
    pendingChanges: true,
    localOnly: false
  })
}

function clearConflict() {
  pendingRemotePayload = null
  setState({
    conflictPending: false,
    conflictLocalCount: 0,
    conflictCloudCount: 0,
    conflictCloudUpdatedAt: ''
  })
}

function applyRemotePayload(remotePayload) {
  const normalized = normalizeRemotePayload(remotePayload)
  if (!normalized) return false
  applyingCloudData = true
  try {
    replaceClassData(normalized.classData)
    lastObservedHash = normalized.dataHash
  } finally {
    applyingCloudData = false
  }
  saveSyncMeta(normalized, normalized.dataHash)
  clearConflict()
  setState({
    status: 'synced',
    message: '已從雲端更新到最新資料',
    hasCloudData: true,
    localOnly: false,
    pendingChanges: false
  })
  window.dispatchEvent(new CustomEvent(CLOUD_DATA_UPDATED_EVENT, {
    detail: { source: 'cloud', revision: normalized.revision, updatedAt: normalized.updatedAt }
  }))
  return true
}

async function fetchRemotePayload() {
  if (!activeCloudRef) return null
  const snapshot = await get(activeCloudRef)
  return snapshot.exists() ? normalizeRemotePayload(snapshot.val()) : null
}

async function uploadLocalSnapshot({ force = false } = {}) {
  if (!activeCloudRef || !state.uid) throw new Error('尚未連接個人 Firebase')
  if (!navigator.onLine) throw new Error('目前離線，資料已保存在這台裝置')

  const localData = readClassData()
  const localHash = hashClassData(localData)
  const meta = getIdentityMeta()
  const expectedCloudHash = String(meta.cloudHash || '')

  setState({ status: 'syncing', message: '正在把這台裝置的變更同步到雲端…', pendingChanges: true, localOnly: false })

  const result = await runTransaction(activeCloudRef, currentValue => {
    const current = normalizeRemotePayload(currentValue)
    const currentHash = payloadHash(current)

    if (!force) {
      const remoteMatchesKnown = (!current && !expectedCloudHash) || currentHash === expectedCloudHash
      const remoteAlreadyMatchesLocal = currentHash && currentHash === localHash
      if (!remoteMatchesKnown && !remoteAlreadyMatchesLocal) return undefined
      if (remoteAlreadyMatchesLocal) return currentValue
    }

    const nextRevision = (Number(current?.revision) || 0) + 1
    return buildPayload(localData, nextRevision)
  }, { applyLocally: false })

  if (!result.committed) {
    const latest = await fetchRemotePayload()
    if (latest) setConflict(latest)
    throw new Error('雲端資料在同步前已被其他裝置更新')
  }

  const remotePayload = normalizeRemotePayload(result.snapshot.val()) || buildPayload(localData, 1)
  saveSyncMeta(remotePayload, localHash)
  lastObservedHash = localHash
  localStorage.removeItem(FORCE_UPLOAD_PENDING_KEY)
  clearConflict()
  setState({
    status: 'synced',
    message: '已同步',
    hasCloudData: true,
    localOnly: false,
    pendingChanges: false,
    permissionDenied: false
  })
  return remotePayload
}

async function alignInitialData(remotePayload) {
  const localData = readClassData()
  const localHash = hashClassData(localData)
  const localMeaningful = hasMeaningfulClassData(localData)
  const meta = getIdentityMeta()
  const previousIdentity = getLastCloudIdentity()
  const identityChanged = Boolean(
    previousIdentity?.uid &&
    previousIdentity?.projectId &&
    (previousIdentity.uid !== state.uid || previousIdentity.projectId !== state.projectId)
  )

  // 同一瀏覽器若改連另一個 Firebase／Google 帳號，舊班級資料不能自動上傳。
  // 即使新雲端是空的，也交由老師明確選擇「保留本機」或「採用雲端」。
  if (identityChanged && localMeaningful) {
    const safeRemotePayload = remotePayload || {
      schemaVersion: CLOUD_SCHEMA_VERSION,
      revision: 0,
      updatedAt: '',
      updatedBy: '',
      dataHash: hashClassData({}),
      classData: {}
    }
    setConflict(safeRemotePayload)
    setState({
      message: '偵測到這台裝置曾連接另一個 Firebase 或 Google 帳號。為避免班級資料混用，請先確認要保留本機資料或採用目前帳號的雲端資料。'
    })
    return
  }

  if (!remotePayload) {
    if (localMeaningful) await uploadLocalSnapshot({ force: true })
    else {
      saveSyncMeta({ revision: 0, dataHash: '', classData: {} }, localHash)
      setState({ status: 'synced', message: '已連線；目前尚無班級資料', hasCloudData: false, localOnly: false, pendingChanges: false })
    }
    return
  }

  const remoteHash = payloadHash(remotePayload)
  const remoteMeaningful = hasMeaningfulClassData(remotePayload.classData)

  if (localHash === remoteHash) {
    saveSyncMeta(remotePayload, localHash)
    setState({ status: 'synced', message: '已同步', hasCloudData: true, localOnly: false, pendingChanges: false })
    return
  }

  if (!localMeaningful && remoteMeaningful) {
    applyRemotePayload(remotePayload)
    return
  }

  if (!localMeaningful && !remoteMeaningful) {
    applyRemotePayload(remotePayload)
    return
  }

  if (localMeaningful && !remoteMeaningful) {
    saveSyncMeta(remotePayload, remoteHash)
    await uploadLocalSnapshot({ force: true })
    return
  }

  if (meta.syncedHash && localHash === meta.syncedHash) {
    applyRemotePayload(remotePayload)
    return
  }

  if (meta.cloudHash && remoteHash === meta.cloudHash) {
    await uploadLocalSnapshot()
    return
  }

  setConflict(remotePayload)
}

function handleRemoteSnapshot(snapshot) {
  const remotePayload = snapshot.exists() ? normalizeRemotePayload(snapshot.val()) : null
  if (!remotePayload) return

  const localData = readClassData()
  const localHash = hashClassData(localData)
  const remoteHash = payloadHash(remotePayload)
  const meta = getIdentityMeta()

  if (remoteHash === localHash) {
    saveSyncMeta(remotePayload, localHash)
    setState({ status: 'synced', message: '已同步', hasCloudData: true, localOnly: false, pendingChanges: false })
    return
  }

  if (localHash === meta.syncedHash) {
    applyRemotePayload(remotePayload)
    return
  }

  if (remoteHash === meta.cloudHash) {
    scheduleLocalUpload()
    return
  }

  setConflict(remotePayload)
}

function startRealtimeListener(token) {
  stopRealtimeListener()
  if (!activeCloudRef) return
  cloudUnsubscribe = onValue(activeCloudRef, snapshot => {
    if (token !== connectionToken || getStorageMode() !== 'firebase') return
    handleRemoteSnapshot(snapshot)
  }, error => {
    if (token !== connectionToken) return
    const denied = error?.code === 'PERMISSION_DENIED' || error?.code === 'permission-denied'
    setState({
      status: 'error',
      message: friendlyCloudError(error, 'Firebase 拒絕存取；請檢查安全規則，若已開啟 App Check 強制執行也請確認權杖'),
      permissionDenied: denied,
      localOnly: false
    })
  })
}

async function connectCloud({ interactive = false } = {}) {
  const config = getPersonalFirebaseConfig()
  if (!config) {
    setState({ status: 'setup-required', message: '請先完成個人 Firebase 設定精靈', localOnly: true, syncMode: 'firebase' })
    return false
  }

  if (!navigator.onLine) {
    setState({ status: 'offline', message: '目前離線；資料仍會先保存在這台裝置', localOnly: false, syncMode: 'firebase', isOnline: false })
    return false
  }

  resetConnection()
  const token = connectionToken
  setState({
    status: 'connecting',
    message: '正在連接老師自己的 Firebase…',
    syncMode: 'firebase',
    localOnly: false,
    permissionDenied: false,
    isOnline: true
  })

  try {
    let services = await initializeTeacherFirebase(config)
    let user = await waitForTeacherAuth(services.auth)
    if (!user && interactive) {
      services = await signInTeacherFirebase(config, { forceChooser: true })
      user = services.user
    }

    if (!user?.uid) {
      setState({ status: 'sign-in-required', message: '請登入 Google，才能讀取老師自己的雲端資料', localOnly: false })
      return false
    }

    if (token !== connectionToken) return false
    activeServices = services
    activeCloudRef = ref(services.database, `users/${user.uid}/${CLOUD_PATH_SEGMENT}`)
    setState({
      user,
      uid: user.uid,
      email: user.email || '',
      projectId: services.config.projectId,
      status: 'connecting',
      message: '正在比對這台裝置與雲端資料…',
      syncMode: 'firebase',
      localOnly: false
    })

    if (localStorage.getItem(FORCE_UPLOAD_PENDING_KEY) === 'true') {
      await uploadLocalSnapshot({ force: true })
      if (token !== connectionToken) return false
      startRealtimeListener(token)
      return true
    }

    const remotePayload = await fetchRemotePayload()
    if (token !== connectionToken) return false
    await alignInitialData(remotePayload)
    if (token !== connectionToken) return false
    startRealtimeListener(token)
    return true
  } catch (error) {
    if (token !== connectionToken) return false
    console.error('Firebase 同步啟動失敗', error)
    const denied = error?.code === 'PERMISSION_DENIED' || error?.code === 'permission-denied'
    setState({
      status: navigator.onLine ? 'error' : 'offline',
      message: friendlyCloudError(error),
      permissionDenied: denied,
      localOnly: false
    })
    return false
  }
}

export async function startCloudSync(options = {}) {
  installLocalStorageObserver()
  const wantsCloud = getStorageMode() === 'firebase'
  if (!wantsCloud) {
    resetConnection()
    setLocalOnlyState()
    return false
  }
  return connectCloud({ interactive: Boolean(options.interactive) })
}

export async function chooseLocalStorageMode() {
  setStorageMode('local')
  resetConnection()
  setLocalOnlyState('已切換為本機模式；雲端資料不會被刪除')
  return true
}

export async function enableCloudSync({ interactive = true } = {}) {
  if (!getPersonalFirebaseConfig()) throw new Error('請先到資料與同步完成個人 Firebase 設定')
  setStorageMode('firebase')
  setState({ syncMode: 'firebase' })
  return connectCloud({ interactive })
}

export async function signInCloud() {
  return enableCloudSync({ interactive: true })
}

export async function signOutCloud() {
  const config = getPersonalFirebaseConfig()
  resetConnection()
  if (config) await signOutTeacherFirebase(config)
  setState({
    user: null,
    uid: '',
    email: '',
    status: getStorageMode() === 'firebase' ? 'sign-in-required' : 'local-only',
    message: getStorageMode() === 'firebase' ? '已登出；本機資料仍保留' : '資料只儲存在這台裝置',
    pendingChanges: false,
    conflictPending: false
  })
  return true
}

export async function retryCloudSync() {
  return startCloudSync({ interactive: false })
}

export async function syncNow({ force = false } = {}) {
  if (getStorageMode() !== 'firebase') return false
  if (force) localStorage.setItem(FORCE_UPLOAD_PENDING_KEY, 'true')
  const neededConnection = !activeCloudRef || !state.uid
  if (neededConnection) {
    const connected = await connectCloud({ interactive: false })
    if (!connected || !activeCloudRef) return false
    if (force && localStorage.getItem(FORCE_UPLOAD_PENDING_KEY) !== 'true') return true
  }
  try {
    await uploadLocalSnapshot({ force })
    return true
  } catch (error) {
    if (!state.conflictPending) {
      setState({
        status: navigator.onLine ? 'error' : 'offline',
        message: error?.message || '同步失敗，稍後可重試',
        pendingChanges: true,
        localOnly: false
      })
    }
    return false
  }
}

export async function resolveSyncConflict(strategy) {
  if (!state.conflictPending) return false
  if (strategy === 'cloud') {
    if (!pendingRemotePayload) throw new Error('找不到可使用的雲端資料')
    return applyRemotePayload(pendingRemotePayload)
  }
  if (strategy === 'local') {
    await uploadLocalSnapshot({ force: true })
    return true
  }
  return false
}

export function downloadFullBackup() {
  return exportFullBackup()
}

export async function copyCloudUid() {
  if (!state.uid) return false
  await navigator.clipboard.writeText(state.uid)
  return true
}
