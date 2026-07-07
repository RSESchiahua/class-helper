<script setup>
import { computed, ref } from 'vue'

// SIDEBAR_DRAG_SORT_20260707：功能列只儲存顯示順序，不改變路由功能。
const SIDEBAR_ORDER_KEY = 'classAssistantSidebarOrderV1'

const defaultNavItems = [
  { key: 'dashboard', path: '/', label: '🏠 首頁' },
  { key: 'students', path: '/students', label: '👨‍🎓 學生名單' },
  { key: 'notebook', path: '/notebook', label: '📚 簿本繳交' },
  { key: 'calendar', path: '/calendar', label: '🗓️ 行事曆' },
  { key: 'toothbrush', path: '/toothbrush', label: '🦷 潔牙消毒' },
  { key: 'points', path: '/points', label: '⭐ 積分獎勵' },
  { key: 'library', path: '/library', label: '📖 班書借閱' },
  { key: 'status', path: '/status', label: '🔔 現在狀態' },
  { key: 'cleaning', path: '/cleaning', label: '🧹 打掃分配' },
  { key: 'jobs', path: '/jobs', label: '⭐ 職務分配' },
  { key: 'seats', path: '/seats', label: '🪑 座位安排' },
  { key: 'wheel', path: '/wheel', label: '🎡 抽籤轉盤' }
]

const defaultOrder = defaultNavItems.map(item => item.key)

function loadSidebarOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(SIDEBAR_ORDER_KEY) || '[]')
    if (Array.isArray(saved)) {
      return saved.filter(key => defaultOrder.includes(key))
    }
  } catch (error) {
    console.warn('功能列排序讀取失敗，已使用預設順序。', error)
  }

  return []
}

const showCredit = ref(false)
const sidebarOrder = ref(loadSidebarOrder())
const draggedKey = ref('')
let logoClickCount = 0
let logoTimer = null

const orderedNavItems = computed(() => {
  const itemMap = new Map(defaultNavItems.map(item => [item.key, item]))
  const savedItems = sidebarOrder.value
    .map(key => itemMap.get(key))
    .filter(Boolean)
  const newItems = defaultNavItems.filter(item => !sidebarOrder.value.includes(item.key))

  return [...savedItems, ...newItems]
})

function saveSidebarOrder(items = orderedNavItems.value) {
  const keys = items.map(item => item.key)
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

function handleNavDragStart(event, key) {
  draggedKey.value = key
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', key)
}

function handleNavDrop(event, targetKey) {
  const sourceKey = draggedKey.value || event.dataTransfer.getData('text/plain')
  draggedKey.value = ''

  if (!sourceKey || sourceKey === targetKey) return

  const nextItems = [...orderedNavItems.value]
  const sourceIndex = nextItems.findIndex(item => item.key === sourceKey)
  const targetIndex = nextItems.findIndex(item => item.key === targetKey)

  if (sourceIndex < 0 || targetIndex < 0) return

  const [movedItem] = nextItems.splice(sourceIndex, 1)
  nextItems.splice(targetIndex, 0, movedItem)
  saveSidebarOrder(nextItems)
}

function resetSidebarOrder() {
  sidebarOrder.value = [...defaultOrder]
  localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(defaultOrder))
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <button class="logo-button" type="button" @click="handleLogoClick" aria-label="班級助手標誌">
        <span class="logo-title">📚 班級助手</span>
        <span class="sidebar-subtitle">每天快一點，班級暖一點</span>
      </button>

      <!-- SIDEBAR_DRAG_SORT_20260707 -->
      <nav class="sidebar-nav" aria-label="主要功能，可拖曳排序">
        <RouterLink
          v-for="item in orderedNavItems"
          :key="item.key"
          class="sidebar-link"
          :class="{ dragging: draggedKey === item.key }"
          :to="item.path"
          draggable="true"
          @dragstart="handleNavDragStart($event, item.key)"
          @dragover.prevent
          @drop.prevent="handleNavDrop($event, item.key)"
          @dragend="draggedKey = ''"
        >
          <span class="nav-label">{{ item.label }}</span>
          <span class="drag-handle" aria-hidden="true">⋮⋮</span>
        </RouterLink>
      </nav>

      <button class="sidebar-reset-sort" type="button" @click="resetSidebarOrder">
        ↺ 重設功能排序
      </button>
    </aside>

    <main class="main-content">
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
