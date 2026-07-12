import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { installLocalStorageObserver, startCloudSync } from './services/cloudSync'

// ✅ HUA_DATA_CENTER_SPRINT1_BOOTSTRAP_20260712：預設本機優先；只有完成個人 Firebase 設定後才會啟動雲端。
installLocalStorageObserver()
void startCloudSync()

createApp(App).use(router).mount('#app')
