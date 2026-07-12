<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CLOUD_DATA_UPDATED_EVENT,
  chooseLocalStorageMode
} from './services/cloudSync'
import { STORAGE_MODE_KEY, setStorageMode } from './services/dataCenter'

// ✅ HUA_CLOUD_REFRESH_ROUTER_VIEW_20260712：雲端資料更新後重建目前功能頁，讓所有 localStorage 畫面立即刷新。
// ✅ HUA_DATA_CENTER_SPRINT1_APP_20260712：同步與備份入口集中到資料中心；首頁不再顯示共用 Firebase 面板。
// ✅ HUA_CORE_NAV_FIXED_ORDER_20260711：首頁、學生名單、班務分配、課表與作息、現在狀態固定在最上方；其餘功能才可拖曳排序。
// ✅ HUA_SIDEBAR_GROUP_CLASS_AFFAIRS_20260710：班務分配為可展開群組。
const SIDEBAR_ORDER_KEY = 'classAssistantSidebarOrderV1'
const CLASS_AFFAIRS_OPEN_KEY = 'classAssistantClassAffairsOpenV1'
const CORE_NAV_KEYS = ['dashboard', 'students', 'classAffairs', 'schedule', 'status', 'dataCenter']

const route = useRoute()
const router = useRouter()

// ✅ HUA_FIRST_RUN_STORAGE_CHOICE_RESTORED_20260712：新裝置第一次開啟時，必須先選擇本機模式或個人 Firebase。
const FIRST_RUN_WIZARD_FLAG = 'classHelperOpenFirebaseWizardV1'
const storageChoiceOpen = ref(localStorage.getItem(STORAGE_MODE_KEY) === null)
const storageChoiceBusy = ref(false)

async function chooseFirstRunLocalMode() {
  if (storageChoiceBusy.value) return
  storageChoiceBusy.value = true
  try {
    await chooseLocalStorageMode()
    storageChoiceOpen.value = false
  } finally {
    storageChoiceBusy.value = false
  }
}

async function chooseFirstRunFirebaseMode() {
  if (storageChoiceBusy.value) return
  storageChoiceBusy.value = true
  try {
    setStorageMode('firebase')
    localStorage.setItem(FIRST_RUN_WIZARD_FLAG, 'true')
    storageChoiceOpen.value = false
    await router.push('/data-center')
  } finally {
    storageChoiceBusy.value = false
  }
}

// ✅ HUA_FIREBASE_WIZARD_APP_20260712：個人 Firebase 與備份集中於『資料與同步』頁，App 僅負責導覽與共用版面。
const defaultNavItems = [
  { key: 'dashboard', path: '/', label: '🏠 首頁', fixed: true },
  { key: 'students', path: '/students', label: '👨‍🎓 學生名單', fixed: true },
  { key: 'classAffairs', label: '🧩 班務分配', type: 'group', fixed: true },
  { key: 'schedule', path: '/schedule', label: '📅 課表與作息', fixed: true },
  { key: 'status', path: '/status', label: '🔔 現在狀態', fixed: true },
  { key: 'dataCenter', path: '/data-center', label: '💾 資料與同步', fixed: true },
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
const dataRefreshKey = ref(0)
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


function handleCloudDataUpdated() {
  dataRefreshKey.value += 1
}

onMounted(() => {
  window.addEventListener(CLOUD_DATA_UPDATED_EVENT, handleCloudDataUpdated)
})

onBeforeUnmount(() => {
  window.removeEventListener(CLOUD_DATA_UPDATED_EVENT, handleCloudDataUpdated)
})

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

          <div v-if="item.key === 'dataCenter'" class="sidebar-core-divider" aria-hidden="true">
            <span>日常工具・可排序</span>
          </div>
        </template>
      </nav>

      <button class="sidebar-reset-sort" type="button" @click="resetSidebarOrder">
        ↺ 重設日常工具排序
      </button>
    </aside>

    <main class="main-content">
      <RouterView :key="dataRefreshKey" />
    </main>

    <div v-if="storageChoiceOpen" class="storage-choice-overlay first-run-storage-choice">
      <section class="storage-choice-modal" role="dialog" aria-modal="true" aria-labelledby="first-run-storage-title" aria-describedby="first-run-storage-description">
        <div class="storage-choice-heading">
          <span aria-hidden="true">🗂️</span>
          <div>
            <h2 id="first-run-storage-title">第一次使用，請選擇資料儲存方式</h2>
            <p id="first-run-storage-description">兩種模式之後都能在「資料與同步」更改；班級助手不會替老師保管 Firebase 帳號或班級資料。</p>
          </div>
        </div>

        <div class="storage-choice-grid">
          <button
            type="button"
            class="storage-option-card"
            :disabled="storageChoiceBusy"
            @click="chooseFirstRunLocalMode"
          >
            <span class="storage-option-title-row"><span class="storage-option-icon" aria-hidden="true">💻</span><strong>本機模式</strong></span>
            <small>不用登入，立刻開始使用；資料只存在這個瀏覽器。清除網站資料、換裝置或裝置故障時，資料可能遺失。</small>
            <em>適合先試用或只用單一裝置</em>
          </button>

          <button
            type="button"
            class="storage-option-card cloud-option"
            :disabled="storageChoiceBusy"
            @click="chooseFirstRunFirebaseMode"
          >
            <span class="storage-option-title-row"><span class="storage-option-icon" aria-hidden="true">☁️</span><strong>個人 Firebase 模式</strong></span>
            <small>由老師建立並管理自己的 Firebase，可在電腦、手機和平板同步。首次需要依設定精靈完成一次連線。</small>
            <em>適合跨裝置與長期使用</em>
          </button>
        </div>

        <p class="storage-choice-note">選擇本機模式不會鎖死功能；日後仍可前往「💾 資料與同步」啟用個人 Firebase。</p>
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
