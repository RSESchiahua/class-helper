<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  cloudState,
  copyCloudUid,
  downloadFullBackup,
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

// ✅ HUA_FIREBASE_SYNC_PANEL_20260711：雲端登入、同步狀態、完整備份與 UID 複製入口。
const cloudActionMessage = ref('')

const cloudStatusLabel = computed(() => {
  const labels = {
    starting: '準備中',
    'signed-out': '本機模式',
    connecting: '連線中',
    syncing: '同步中',
    synced: '已同步',
    offline: '離線',
    'permission-denied': '待授權',
    error: '連線失敗'
  }
  return labels[cloudState.status] || '雲端狀態'
})

const cloudStatusIcon = computed(() => {
  if (cloudState.status === 'synced') return '☁️'
  if (cloudState.status === 'syncing' || cloudState.status === 'connecting' || cloudState.status === 'starting') return '⏳'
  if (cloudState.status === 'offline') return '📴'
  if (cloudState.status === 'permission-denied') return '🔐'
  if (cloudState.status === 'error') return '⚠️'
  return '💾'
})

const cloudStatusClass = computed(() => `cloud-${cloudState.status}`)

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

async function handleCloudLogin() {
  cloudActionMessage.value = ''
  try {
    await signInCloud()
  } catch (error) {
    console.error(error)
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
            <small v-if="formattedLastSync && cloudState.user">最後同步：{{ formattedLastSync }}</small>
          </div>
        </div>

        <div class="cloud-sync-actions">
          <button v-if="!cloudState.user" type="button" class="cloud-primary-action" @click="handleCloudLogin">
            使用 Google 登入
          </button>
          <template v-else>
            <button type="button" class="cloud-soft-action" @click="downloadFullBackup">下載完整備份</button>
            <button v-if="cloudState.permissionDenied" type="button" class="cloud-primary-action" @click="handleCopyUid">
              複製我的 UID
            </button>
            <button v-if="cloudState.status === 'error' || cloudState.status === 'offline'" type="button" class="cloud-soft-action" @click="retryCloudSync">
              重新連線
            </button>
            <button type="button" class="cloud-text-action" @click="signOutCloud">登出</button>
          </template>
        </div>
        <span v-if="cloudActionMessage" class="cloud-action-message">{{ cloudActionMessage }}</span>
      </section>

      <RouterView />
    </main>

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
