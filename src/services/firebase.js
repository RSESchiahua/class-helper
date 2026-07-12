// ✅ HUA_SAFARI_FIREBASE_POPUP_DIRECT_FIX_20260712：Google 登入視窗必須在按鍵事件中立即開啟，避免 Safari 將它判定為非使用者操作而阻擋。
// ✅ HUA_FIREBASE_EXISTING_SESSION_NO_POPUP_20260712：已登入時直接測試，不再重複開啟帳號視窗。
import { deleteApp, getApp, getApps, initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'firebase/auth'
import { get, getDatabase, ref, remove, set } from 'firebase/database'

const APP_NAME = 'class-helper-personal'
let currentSignature = ''

function normalizeConfig(config) {
  const source = config && typeof config === 'object' ? config : {}
  return {
    apiKey: String(source.apiKey || '').trim(),
    authDomain: String(source.authDomain || '').trim(),
    databaseURL: String(source.databaseURL || '').trim().replace(/\/$/, ''),
    projectId: String(source.projectId || '').trim(),
    storageBucket: String(source.storageBucket || '').trim(),
    messagingSenderId: String(source.messagingSenderId || '').trim(),
    appId: String(source.appId || '').trim(),
    measurementId: String(source.measurementId || '').trim()
  }
}

function validateConfig(config) {
  const clean = normalizeConfig(config)
  const required = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId']
  const missing = required.filter(key => !clean[key])
  if (missing.length) throw new Error(`Firebase 設定缺少：${missing.join('、')}`)
  if (!/^https:\/\/.+\.(firebaseio\.com|firebasedatabase\.app)$/i.test(clean.databaseURL)) {
    throw new Error('databaseURL 格式不正確，請從 Firebase 的 Web App 設定完整複製')
  }
  return clean
}

function signature(config) {
  const clean = normalizeConfig(config)
  return JSON.stringify({
    apiKey: clean.apiKey,
    authDomain: clean.authDomain,
    databaseURL: clean.databaseURL,
    projectId: clean.projectId,
    appId: clean.appId
  })
}

// 這個函式刻意保持同步：登入按鍵觸發後，不能先等待其他 Promise，
// 否則 Safari 可能失去「使用者主動點擊」狀態並封鎖彈出視窗。
export function initializeTeacherFirebase(config) {
  const clean = validateConfig(config)
  const nextSignature = signature(clean)
  let existing = getApps().find(app => app.name === APP_NAME)

  if (existing && currentSignature && currentSignature !== nextSignature) {
    // Config 變更通常只發生在重新設定時。先移除舊 App；
    // deleteApp 是 Promise，但不等待它，避免阻斷這次使用者觸發的登入視窗。
    void deleteApp(existing).catch(() => {})
    existing = null
  }

  const app = existing || initializeApp(clean, APP_NAME)
  currentSignature = nextSignature
  const auth = getAuth(app)
  const provider = new GoogleAuthProvider()
  const database = getDatabase(app)
  return { app, auth, database, provider, config: clean }
}

export function waitForTeacherAuth(auth) {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  return new Promise(resolve => {
    let stop = () => {}
    stop = onAuthStateChanged(auth, user => {
      stop()
      resolve(user || null)
    }, () => {
      stop()
      resolve(null)
    })
  })
}

export async function signInTeacherFirebase(config, { forceChooser = false } = {}) {
  const services = initializeTeacherFirebase(config)

  // 已有有效登入狀態時直接沿用，不再打斷老師操作。
  if (services.auth.currentUser && !forceChooser) {
    return { ...services, user: services.auth.currentUser, reusedSession: true }
  }

  if (forceChooser) services.provider.setCustomParameters({ prompt: 'select_account' })

  // 首次登入仍必須立刻呼叫 signInWithPopup；不可在這之前 await。
  const credential = await signInWithPopup(services.auth, services.provider)
  if (!credential.user?.uid) throw new Error('Google 登入未完成')
  return { ...services, user: credential.user, reusedSession: false }
}

export async function testTeacherFirebase(config) {
  const services = await signInTeacherFirebase(config, { forceChooser: false })
  const user = services.user

  const checkRef = ref(services.database, `users/${user.uid}/systemChecks/wizard`)
  const testValue = {
    ok: true,
    checkedAt: new Date().toISOString(),
    projectId: services.config.projectId
  }

  await set(checkRef, testValue)
  const snapshot = await get(checkRef)
  if (!snapshot.exists() || snapshot.val()?.ok !== true) {
    throw new Error('已登入，但無法讀回測試資料，請檢查 Database 與規則')
  }
  await remove(checkRef)

  return {
    ok: true,
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    projectId: services.config.projectId,
    reusedSession: Boolean(services.reusedSession)
  }
}


export async function signOutTeacherFirebase(config) {
  const { auth } = initializeTeacherFirebase(config)
  await signOut(auth)
}

export function hasTeacherFirebaseApp() {
  return getApps().some(app => app.name === APP_NAME)
}

export function getTeacherFirebaseApp() {
  return hasTeacherFirebaseApp() ? getApp(APP_NAME) : null
}
