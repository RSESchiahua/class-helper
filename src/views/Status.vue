<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const STORAGE_KEY = 'classHelperStatusSchedule'
const now = ref(new Date())
const customNow = ref('')
const schedule = ref(loadSchedule())
let timer = null

watch(schedule, value => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true })

onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 1000) })
onUnmounted(() => clearInterval(timer))

const timeSource = computed(() => customNow.value ? timeToMinutes(customNow.value) : now.value.getHours() * 60 + now.value.getMinutes())
const realTimeText = computed(() => now.value.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
const currentPeriod = computed(() => {
  const m = timeSource.value
  return schedule.value.find(item => m >= timeToMinutes(item.start) && m < timeToMinutes(item.end)) || { type: 'other', title: '彈性時間', start: '', end: '', message: '請看老師指示，安靜完成現在的任務。' }
})
const minutesLeft = computed(() => currentPeriod.value.end ? Math.max(0, timeToMinutes(currentPeriod.value.end) - timeSource.value) : null)
const isRecessEnding = computed(() => currentPeriod.value.type === 'recess' && minutesLeft.value !== null && minutesLeft.value <= 2)
const statusView = computed(() => {
  if (isRecessEnding.value) return { icon: '⏰', title: '準備上課', message: '倒數兩分鐘，請收心、收拾物品，回座位坐好。', rules: ['喝水上廁所結束', '拿出下節課用品', '安靜回座位', '等待老師或科任老師'] }
  const map = {
    morning: ['🌞', '早修時間', ['安靜進教室', '交作業與聯絡簿', '完成早修任務', '不聊天、不走動']],
    class: ['📖', '上課時間', ['專心聽講', '需要發言請舉手', '準備好課本用品', '尊重正在說話的人']],
    recess: ['🔔', '下課時間', ['收拾桌面', '靠好椅子', '上廁所、裝水', '注意安全']],
    cleaning: ['🧹', '打掃時間', ['拿掃具', '完成負責區域', '掃具歸位', '請衛生長檢查']],
    dismissal: ['🎒', '放學時間', ['整理書包', '椅子靠好', '檢查抽屜地面', '依路隊安靜離開']],
    other: ['🌿', '彈性時間', ['看老師指示', '保持安靜', '完成手邊任務']]
  }
  const [icon, fallbackTitle, rules] = map[currentPeriod.value.type] || map.other
  return { icon, title: currentPeriod.value.title || fallbackTitle, message: currentPeriod.value.message, rules }
})
function loadSchedule() {
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); if (Array.isArray(saved) && saved.length) return saved } catch {}
  return [
    { type: 'morning', title: '早修時間', start: '07:50', end: '08:35', message: '請安靜進入教室，完成早修與交作業。' },
    { type: 'class', title: '第一節上課', start: '08:40', end: '09:20', message: '進入上課狀態，準備好課本用品。' },
    { type: 'recess', title: '第一節下課', start: '09:20', end: '09:30', message: '下課活動，記得上廁所與裝水。' },
    { type: 'class', title: '第二節上課', start: '09:30', end: '10:10', message: '請回座位，專心上課。' },
    { type: 'recess', title: '第二節下課', start: '10:10', end: '10:20', message: '下課活動，倒數兩分鐘會提醒回座位。' },
    { type: 'cleaning', title: '打掃時間', start: '15:10', end: '15:25', message: '請到自己的打掃區，快速完成整理。' },
    { type: 'dismissal', title: '放學時間', start: '15:50', end: '16:10', message: '整理書包與座位，準備放學。' }
  ]
}
function timeToMinutes(time) { const [h, m] = time.split(':').map(Number); return h * 60 + m }
function addPeriod() { schedule.value.push({ type: 'class', title: '新增時段', start: '08:00', end: '08:40', message: '' }) }
function removePeriod(index) { schedule.value.splice(index, 1) }
function openFullscreen() { document.documentElement.requestFullscreen?.() }
</script>

<template>
  <div class="page wide-page status-page">
    <div class="page-title-row">
      <div><h2>🔔 現在狀態</h2><p>依照目前時間自動切換早修、上課、下課、打掃、放學；時間表可手動編輯。</p></div>
      <button @click="openFullscreen">全螢幕</button>
    </div>

    <section class="status-hero card" :class="{ warning: isRecessEnding }">
      <div class="status-clock"><span>{{ realTimeText }}</span><input v-model="customNow" type="time" title="測試或手動指定目前時間" /><button @click="customNow = ''">用現在時間</button></div>
      <div class="status-main-icon">{{ statusView.icon }}</div>
      <h1>{{ statusView.title }}</h1>
      <p>{{ statusView.message }}</p>
      <strong v-if="minutesLeft !== null">剩下 {{ minutesLeft }} 分鐘</strong>
      <div class="rule-grid"><span v-for="rule in statusView.rules" :key="rule">{{ rule }}</span></div>
    </section>

    <section class="card compact-card schedule-editor">
      <div class="section-head"><h3>🕒 作息時間編輯</h3><button @click="addPeriod">＋ 新增時段</button></div>
      <div class="schedule-table">
        <div v-for="(item, index) in schedule" :key="index" class="schedule-row">
          <select v-model="item.type"><option value="morning">早修</option><option value="class">上課</option><option value="recess">下課</option><option value="cleaning">打掃</option><option value="dismissal">放學</option><option value="other">其他</option></select>
          <input v-model="item.title" placeholder="畫面標題" />
          <input v-model="item.start" type="time" />
          <input v-model="item.end" type="time" />
          <input v-model="item.message" placeholder="給學生看的提醒" />
          <button class="tiny danger-text" @click="removePeriod(index)">刪除</button>
        </div>
      </div>
    </section>
  </div>
</template>
