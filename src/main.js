import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { installLocalStorageObserver, startCloudSync } from './services/cloudSync'

// HUA_SYNC_CHOICE_OPT_IN_BOOTSTRAP_20260712
installLocalStorageObserver()
void startCloudSync()

createApp(App).use(router).mount('#app')