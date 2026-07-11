// ✅ HUA_FIREBASE_CONFIG_20260711：班級助手 Firebase 正式版設定。
import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence
} from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyBCPRiegG9P_HPV-PcCMvODe1IB8HlhTZU',
  authDomain: 'class-helper-2026.firebaseapp.com',
  databaseURL: 'https://class-helper-2026-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'class-helper-2026',
  storageBucket: 'class-helper-2026.firebasestorage.app',
  messagingSenderId: '108615421628',
  appId: '1:108615421628:web:01b1e8acb2f1daed1ecab9'
}

const firebaseApp = initializeApp(firebaseConfig)

export const firebaseAuth = getAuth(firebaseApp)
export const firebaseDatabase = getDatabase(firebaseApp)
export const googleProvider = new GoogleAuthProvider()

googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function prepareFirebaseAuth() {
  await setPersistence(firebaseAuth, browserLocalPersistence)
}
