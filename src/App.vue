<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  chooseLocalStorageMode,
  cloudState,
  copyCloudUid,
  downloadFullBackup,
  enableCloudSync,
  resolveSyncConflict,
  retryCloudSync,
  signInCloud,
  signOutCloud
} from './services/cloudSync'

// ✅ HUA_CORE_NAV_FIXED_ORDER_20260711：首頁、學生名單、班務分配、課表與作息、現在狀態固定在最上方；其餘功能才可拖曳排序。
// ✅ HUA_SIDEBAR_GROUP_CLASS_AFFAIRS_20260710：班務分配為可展開群組。
const SIDEBAR_ORDER_KEY = 'classAssistantSidebarOrderV1'
const CLASS_AFFAIRS_OPEN_KEY = 'classAssistantClassAffairsOpenV1'
const CORE_NAV_KEYS = ['dashboard', 'students', 'classAffairs', 'schedule', 'status']

const route = useRoute()

// ✅ HUA_SYNC_CHOICE_OPT_IN_PANEL_20260712：首次使用先選本機或雲端，之後可隨時切換；切換不會刪除既有資料。
const cloudActionMessage = ref('')
const storageChoiceOpen = ref(false)
const storageActionBusy = ref(false)
const conflictActionBusy = ref(false)

watch(
  () => cloudState.needsModeChoice,
  needsChoice => {
    if (needsChoice) storageChoiceOpen.value = true
  },
  { immediate: true }
)

const cloudStatusLabel = computed(() => {
  const labels = {
    'choice-needed': '選擇儲存方式',
    'local-only': '本機儲存',
    starting: '準備中',
    'signed-out': '雲端待登入',
    connecting: '連線中',
    syncing: '同步中',
    synced: '已同步',
    conflict: '等待選擇',
    offline: '離線',
    'permission-denied': '待更新規則',
    error: '連線失敗'
  }
  return labels[cloudState.status] || '資料狀態'
})

const cloudStatusIcon = computed(() => {
  if (cloudState.status === 'synced') return '☁️'
  if (cloudState.status === 'syncing' || cloudState.status === 'connecting' || cloudState.status === 'starting') return '⏳'
  if (cloudState.status === 'conflict') return '🔀'
  if (cloudState.status === 'offline') return '📴'
  if (cloudState.status === 'permission-denied') return '🔐'
  if (cloudState.status === 'error') return '⚠️'
  return '💾'
})

const cloudStatusClass = computed(() => `cloud-${cloudState.status}`)
const isCloudMode = computed(() => cloudState.syncMode === 'cloud')
const isLocalMode = computed(() => cloudState.syncMode === 'local')
const storageModeLabel = computed(() => {
  if (isCloudMode.value) return 'Google 雲端同步'
  if (isLocalMode.value) return '只儲存在這台裝置'
  return '尚未選擇'
})

const formattedLastSync = computed(() => {
  if (!cloudState.lastSyncAt) return ''
  const date = new Date(cloudState.lastSyncAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
})

function openStorageChoice() {
  storageChoiceOpen.value = true
}

function closeStorageChoice() {
  if (cloudState.needsModeChoice || storageActionBusy.value) return
  storageChoiceOpen.value = false
}

async function handleChooseLocalMode() {
  storageActionBusy.value = true
  cloudActionMessage.value = ''
  try {
    await chooseLocalStorageMode()
    storageChoiceOpen.value = false
    cloudActionMessage.value = '已改用本機儲存'
  } catch (error) {
    console.error(error)
    cloudActionMessage.value = '切換失敗，請稍後再試'
  } finally {
    storageActionBusy.value = false
  }
  setTimeout(() => { cloudActionMessage.value = '' }, 2200)
}

async function handleChooseCloudMode() {
  storageActionBusy.value = true
  cloudActionMessage.value = ''
  try {
    await enableCloudSync()
    storageChoiceOpen.value = false
  } catch (error) {
    console.error(error)
  } finally {
    storageActionBusy.value = false
  }
}

async function handleCloudLogin() {
  cloudActionMessage.value = ''
  try {
    await signInCloud()
  } catch (error) {
    console.error(error)
  }
}

async function handleResolveConflict(source) {
  conflictActionBusy.value = true
  cloudActionMessage.value = ''
  try {
    const resolved = await resolveSyncConflict(source)
    cloudActionMessage.value = resolved
      ? source === 'local' ? '已保留這台裝置的資料' : '已載入雲端資料'
      : '尚未完成資料選擇'
  } catch (error) {
    console.error(error)
    cloudActionMessage.value = '處理失敗，資料仍保留在本機'
  } finally {
    conflictActionBusy.value = false
  }
  setTimeout(() => { cloudActionMessage.value = '' }, 2400)
}

async function handleUseLocalFromConflict() {
  conflictActionBusy.value = true
  try {
    await handleChooseLocalMode()
  } finally {
    conflictActionBusy.value = false
  }
}

async function handleCopyUid() {
  try {
    const copied = await copyCloudUid()
    cloudActionMessage.value = copied ? '已複製 UID' : '目前還沒有 UID'
  } catch {
    cloudActionMessage.value = '無法自動複製，請稍後再試'
  }
  setTimeout(() => { cloudActionMessage.value = '' }, 1800)
}

const defaultNavItems = [
  { key: 'dashboard', path: '/', label: '🏠 首頁', fixed: true },
  { key: 'students', path: '/students', label: '👨‍🎓 學生名單', fixed: true },
  { key: 'classAffairs', label: '🧩 班務分配', type: 'group', fixed: true },
  { key: 'schedule', path: '/schedule', label: '📅 課表與作息', fixed: true },
  { key: 'status', path: '/status', label: '🔔 現在狀態', fixed: true },
  { key: 'notebook', path: '/notebook', label: '📚 簿本繳交' },
  { key: 'calendar', path: '/calendar', label: '🗓️ 行事曆' },
  { key: 'toothbrush', path: '/toothbrush', label: '🦷 潔牙消毒' },
  { key: 'points', path: '/points', label: '⭐ 積分獎勵' },
  { key: 'library', path: '/library', label: '📖 班書借閱' },
  { key: 'wheel', path: '/wheel', label: '🎡 抽籤轉盤' }
]

const classAffairNavItems = [
  { key: 'cleaning', path: '/cleaning', label: '🧹 打掃分配' },
  { key: 'jobs', path: '/jobs', label: '⭐ 職務分配' },
  { key: 'seats', path: '/seats', label: '🪑 座位安排' }
]

const fixedNavItems = defaultNavItems.filter(item => item.fixed)
const movableNavItems = defaultNavItems.filter(item => !item.fixed)
const defaultMovableOrder = movableNavItems.map(item => item.key)

function loadSidebarOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(SIDEBAR_ORDER_KEY) || '[]')
    if (!Array.isArray(saved)) return [...defaultMovableOrder]

    // 舊版曾把所有項目一起儲存；這裡只取可移動項目，固定核心順序不受舊資料影響。
    const validSaved = saved.filter(key => defaultMovableOrder.includes(key))
    const missing = defaultMovableOrder.filter(key => !validSaved.includes(key))
    return [...validSaved, ...missing]
  } catch (error) {
    console.warn('功能列排序讀取失敗，已使用預設順序。', error)
    return [...defaultMovableOrder]
  }
}

function loadClassAffairsOpen() {
  return localStorage.getItem(CLASS_AFFAIRS_OPEN_KEY) === 'true'
}

const showCredit = ref(false)
const sidebarOrder = ref(loadSidebarOrder())
const classAffairsOpen = ref(loadClassAffairsOpen())
const draggedKey = ref('')
let logoClickCount = 0
let logoTimer = null

const orderedMovableNavItems = computed(() => {
  const itemMap = new Map(movableNavItems.map(item => [item.key, item]))
  return sidebarOrder.value.map(key => itemMap.get(key)).filter(Boolean)
})

const orderedNavItems = computed(() => [...fixedNavItems, ...orderedMovableNavItems.value])

const isClassAffairsActive = computed(() => {
  return classAffairNavItems.some(item => route.path.startsWith(item.path))
})

const showClassAffairsChildren = computed(() => {
  return classAffairsOpen.value || isClassAffairsActive.value
})

watch(classAffairsOpen, value => {
  localStorage.setItem(CLASS_AFFAIRS_OPEN_KEY, value ? 'true' : 'false')
})

function isFixedItem(itemOrKey) {
  const key = typeof itemOrKey === 'string' ? itemOrKey : itemOrKey?.key
  return CORE_NAV_KEYS.includes(key)
}

function saveSidebarOrder(items = orderedMovableNavItems.value) {
  const keys = items.map(item => item.key).filter(key => defaultMovableOrder.includes(key))
  sidebarOrder.value = keys
  localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(keys))
}

function handleLogoClick() {
  logoClickCount += 1
  clearTimeout(logoTimer)

  if (logoClickCount >= 3) {
    showCredit.value = true
    logoClickCount = 0
    return
  }

  logoTimer = setTimeout(() => {
    logoClickCount = 0
  }, 1200)
}

function toggleClassAffairs() {
  classAffairsOpen.value = !classAffairsOpen.value
}

function handleNavDragStart(event, key) {
  if (isFixedItem(key)) {
    event.preventDefault()
    return
  }

  draggedKey.value = key
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', key)
}

function handleNavDrop(event, targetKey) {
  const sourceKey = draggedKey.value || event.dataTransfer.getData('text/plain')
  draggedKey.value = ''

  if (!sourceKey || sourceKey === targetKey || isFixedItem(sourceKey) || isFixedItem(targetKey)) return

  const nextItems = [...orderedMovableNavItems.value]
  const sourceIndex = nextItems.findIndex(item => item.key === sourceKey)
  const targetIndex = nextItems.findIndex(item => item.key === targetKey)

  if (sourceIndex < 0 || targetIndex < 0) return

  const [movedItem] = nextItems.splice(sourceIndex, 1)
  nextItems.splice(targetIndex, 0, movedItem)
  saveSidebarOrder(nextItems)
}

function resetSidebarOrder() {
  sidebarOrder.value = [...defaultMovableOrder]
  classAffairsOpen.value = false
  localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(defaultMovableOrder))
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <button class="logo-button" type="button" @click="handleLogoClick" aria-label="班級助手標誌">
        <span class="logo-title">📚 班級助手</span>
        <span class="sidebar-subtitle">每天快一點，班級暖一點</span>
      </button>

      <nav class="sidebar-nav" aria-label="主要功能；上方核心功能固定，下方日常工具可拖曳排序">
        <template v-for="item in orderedNavItems" :key="item.key">
          <button
            v-if="item.type === 'group'"
            type="button"
            class="sidebar-link sidebar-group-toggle"
            :class="{
              active: isClassAffairsActive,
              expanded: showClassAffairsChildren,
              dragging: draggedKey === item.key,
              'sidebar-core-item': item.fixed
            }"
            :draggable="!item.fixed"
            :aria-expanded="showClassAffairsChildren"
            @click="toggleClassAffairs"
            @dragstart="handleNavDragStart($event, item.key)"
            @dragover.prevent
            @drop.prevent="handleNavDrop($event, item.key)"
            @dragend="draggedKey = ''"
          >
            <span class="nav-label">{{ item.label }}</span>
            <span class="group-chevron" aria-hidden="true">{{ showClassAffairsChildren ? '⌄' : '›' }}</span>
            <span v-if="!item.fixed" class="drag-handle" aria-hidden="true">⋮⋮</span>
          </button>

          <RouterLink
            v-else
            class="sidebar-link"
            :class="{
              dragging: draggedKey === item.key,
              'sidebar-core-item': item.fixed
            }"
            :to="item.path"
            :draggable="!item.fixed"
            @dragstart="handleNavDragStart($event, item.key)"
            @dragover.prevent
            @drop.prevent="handleNavDrop($event, item.key)"
            @dragend="draggedKey = ''"
          >
            <span class="nav-label">{{ item.label }}</span>
            <span v-if="!item.fixed" class="drag-handle" aria-hidden="true">⋮⋮</span>
          </RouterLink>

          <div
            v-if="item.key === 'classAffairs' && showClassAffairsChildren"
            class="sidebar-subnav"
            aria-label="班務分配子功能"
          >
            <RouterLink
              v-for="child in classAffairNavItems"
              :key="child.key"
              class="sidebar-link sidebar-sublink"
              :to="child.path"
            >
              <span class="nav-label">{{ child.label }}</span>
            </RouterLink>
          </div>

          <div v-if="item.key === 'status'" class="sidebar-core-divider" aria-hidden="true">
            <span>日常工具・可排序</span>
          </div>
        </template>
      </nav>

      <button class="sidebar-reset-sort" type="button" @click="resetSidebarOrder">
        ↺ 重設日常工具排序
      </button>
    </aside>

    <main class="main-content">
      <section class="cloud-sync-panel" :class="cloudStatusClass" aria-live="polite">
        <div class="cloud-sync-status">
          <span class="cloud-sync-icon" aria-hidden="true">{{ cloudStatusIcon }}</span>
          <div>
            <strong>{{ cloudStatusLabel }}</strong>
            <small>{{ cloudState.message }}</small>
            <small class="cloud-storage-mode">儲存方式：{{ storageModeLabel }}</small>
            <small v-if="formattedLastSync && isCloudMode && cloudState.user">最後同步：{{ formattedLastSync }}</small>
          </div>
        </div>

        <div class="cloud-sync-actions">
          <button
            v-if="cloudState.needsModeChoice"
            type="button"
            class="cloud-primary-action"
            @click="openStorageChoice"
          >
            選擇儲存方式
          </button>

          <template v-else-if="isLocalMode">
            <button type="button" class="cloud-primary-action" @click="openStorageChoice">啟用雲端同步</button>
            <button type="button" class="cloud-soft-action" @click="downloadFullBackup">下載本機備份</button>
          </template>

          <template v-else>
            <button v-if="!cloudState.user" type="button" class="cloud-primary-action" @click="handleCloudLogin">
              使用 Google 登入
            </button>
            <button type="button" class="cloud-soft-action" @click="downloadFullBackup">下載完整備份</button>
            <button v-if="cloudState.permissionDenied" type="button" class="cloud-primary-action" @click="handleCopyUid">
              複製我的 UID
            </button>
            <button
              v-if="cloudState.status === 'error' || cloudState.status === 'offline'"
              type="button"
              class="cloud-soft-action"
              @click="retryCloudSync"
            >
              重新連線
            </button>
            <button type="button" class="cloud-soft-action" @click="openStorageChoice">儲存設定</button>
            <button v-if="cloudState.user" type="button" class="cloud-text-action" @click="signOutCloud">登出</button>
          </template>
        </div>
        <span v-if="cloudActionMessage" class="cloud-action-message">{{ cloudActionMessage }}</span>
      </section>

      <RouterView />
    </main>

    <div
      v-if="storageChoiceOpen"
      class="storage-choice-overlay"
      @click.self="closeStorageChoice"
    >
      <section class="storage-choice-modal" role="dialog" aria-modal="true" aria-labelledby="storage-choice-title">
        <button
          v-if="!cloudState.needsModeChoice"
          class="storage-choice-close"
          type="button"
          :disabled="storageActionBusy"
          aria-label="關閉儲存設定"
          @click="closeStorageChoice"
        >×</button>

        <div class="storage-choice-heading">
          <span aria-hidden="true">🗂️</span>
          <div>
            <h2 id="storage-choice-title">選擇資料儲存方式</h2>
            <p>老師可以先使用本機版，之後再隨時開啟雲端同步。</p>
          </div>
        </div>

        <div class="storage-choice-grid">
          <button
            type="button"
            class="storage-option-card"
            :class="{ selected: isLocalMode }"
            :disabled="storageActionBusy"
            @click="handleChooseLocalMode"
          >
            <span class="storage-option-icon" aria-hidden="true">💾</span>
            <strong>只儲存在這台裝置</strong>
            <small>不登入、不連接 Firebase，適合只在一台電腦使用。</small>
            <em v-if="isLocalMode">目前使用中</em>
          </button>

          <button
            type="button"
            class="storage-option-card cloud-option"
            :class="{ selected: isCloudMode }"
            :disabled="storageActionBusy"
            @click="handleChooseCloudMode"
          >
            <span class="storage-option-icon" aria-hidden="true">☁️</span>
            <strong>啟用 Google 雲端同步</strong>
            <small>可讓電腦與手機使用同一份資料；每位老師只能讀寫自己的資料。</small>
            <em v-if="isCloudMode">目前使用中</em>
          </button>
        </div>

        <p class="storage-choice-note">
          切換為本機模式不會刪除既有雲端備份；再次啟用時，若兩邊資料不同，系統會先讓你選擇。
        </p>
      </section>
    </div>

    <div v-if="cloudState.conflictPending" class="storage-choice-overlay conflict-overlay">
      <section class="storage-choice-modal conflict-modal" role="dialog" aria-modal="true" aria-labelledby="sync-conflict-title">
        <div class="storage-choice-heading">
          <span aria-hidden="true">🔀</span>
          <div>
            <h2 id="sync-conflict-title">請選擇要保留哪一份資料</h2>
            <p>這台裝置與雲端都有不同內容，系統不會自行覆蓋。</p>
          </div>
        </div>

        <div class="conflict-summary">
          <span>這台裝置：約 {{ cloudState.conflictLocalCount }} 項</span>
          <span>雲端：約 {{ cloudState.conflictCloudCount }} 項</span>
        </div>

        <div class="conflict-actions">
          <button
            type="button"
            class="cloud-primary-action"
            :disabled="conflictActionBusy"
            @click="handleResolveConflict('local')"
          >
            保留這台裝置的資料
          </button>
          <button
            type="button"
            class="cloud-soft-action"
            :disabled="conflictActionBusy"
            @click="handleResolveConflict('cloud')"
          >
            使用雲端資料
          </button>
          <button
            type="button"
            class="cloud-soft-action conflict-backup-button"
            :disabled="conflictActionBusy"
            @click="downloadFullBackup"
          >
            先下載完整備份
          </button>
          <button
            type="button"
            class="cloud-text-action conflict-local-button"
            :disabled="conflictActionBusy"
            @click="handleUseLocalFromConflict"
          >
            先改用本機模式
          </button>
        </div>

        <p class="storage-choice-note warning-note">前兩個選項會以所選資料為準，另一份不同的內容將被取代；建議先下載完整備份。</p>
      </section>
    </div>

    <div v-if="showCredit" class="credit-overlay" @click.self="showCredit = false">
      <section class="credit-modal" role="dialog" aria-modal="true" aria-label="班級助手製作資訊">
        <button class="credit-close" type="button" @click="showCredit = false">×</button>
        <div class="credit-logo">📚</div>
        <h2>班級助手</h2>
        <p>Created with ❤️<br />by Hua × ChatGPT</p>
      </section>
    </div>
  </div>
</template>
