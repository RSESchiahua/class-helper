// ✅ HUA_FIREBASE_BOOTSTRAP_20260711：啟動班級助手 Firebase 登入與即時同步。
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { installLocalStorageObserver, startCloudSync } from './services/cloudSync'

installLocalStorageObserver()
startCloudSync()

createApp(App).use(router).mount('#app')
