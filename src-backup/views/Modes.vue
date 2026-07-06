<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const now = ref(new Date())
const selectedMode = ref(localStorage.getItem('classHelperMode') || 'auto')
const customMessage = ref(localStorage.getItem('classHelperModeCustomMessage') || '')
const nextIsSubject = ref(localStorage.getItem('classHelperNextIsSubject') === 'true')
let timer = null

const weekdayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

// 依學校作息預設的下課時段，可之後依班級實際日課表微調。
const recessPeriods = [
  { start: '09:20', end: '09:30', label: '第一節下課' },
  { start: '10:10', end: '10:20', label: '第二節下課' },
  { start: '11:00', end: '11:10', label: '第三節下課' },
  { start: '14:00', end: '14:10', label: '下午第一段下課' },
  { start: '14:50', end: '15:10', label: '下午第二段下課' }
]

const morningPlans = {
  1: {
    icon: '📝',
    title: '週一早修｜每週一讀',
    subtitle: '老師開會中，請安靜完成每週一讀。',
    rules: ['完成每週一讀', '完成後可安靜做自己的事', '不可任意走動', '不可聊天吵鬧']
  },
  2: {
    icon: '🇹🇼',
    title: '週二早修｜戶外升旗',
    subtitle: '整理服裝儀容，準備到戶外升旗。',
    rules: ['排隊迅速安靜', '注意服裝儀容', '聽從幹部與老師指示', '不推擠、不喧嘩']
  },
  3: {
    icon: '📖',
    title: '週三早修｜寧靜閱讀',
    subtitle: '拿出書本，進入安靜閱讀時間。',
    rules: ['安靜閱讀', '不聊天', '不走動', '閱讀完可繼續安靜看書']
  },
  4: {
    icon: '🎬',
    title: '週四早修｜公播影片',
    subtitle: '安靜觀看公播影片，留意影片內容。',
    rules: ['眼睛看螢幕', '保持安靜', '不影響他人觀看', '結束後聽從老師指示']
  },
  5: {
    icon: '💻',
    title: '週五早修｜視訊升旗',
    subtitle: '面向螢幕，安靜參與視訊升旗。',
    rules: ['面向螢幕', '保持安靜', '坐姿端正', '不做其他事情']
  }
}

const staticModes = {
  quiet: {
    icon: '🤫',
    title: '安靜模式',
    subtitle: '請降低音量，專心完成手邊的任務。',
    rules: ['音量放低', '不任意走動', '需要幫忙請舉手', '完成後安靜等待']
  },
  nap: {
    icon: '😴',
    title: '午休模式',
    subtitle: '請安靜睡覺，才會長大。',
    rules: ['安靜睡覺', '不聊天', '不走動', '讓身體好好長大', '起床後再整理物品']
  },
  recess: {
    icon: '🔔',
    title: '下課模式',
    subtitle: '離開座位前，請先收拾桌面、靠好椅子。',
    rules: ['收拾桌面', '靠好椅子', '利用時間上廁所', '記得裝水']
  }
}

watch(selectedMode, value => {
  localStorage.setItem('classHelperMode', value)
})

watch(customMessage, value => {
  localStorage.setItem('classHelperModeCustomMessage', value)
})

watch(nextIsSubject, value => {
  localStorage.setItem('classHelperNextIsSubject', String(value))
})

onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  clearInterval(timer)
})

const timeText = computed(() =>
  now.value.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
)

const dateText = computed(() =>
  now.value.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
)

const weekdayText = computed(() => weekdayNames[now.value.getDay()])

function toMinutes(time) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

const currentMinutes = computed(() => now.value.getHours() * 60 + now.value.getMinutes())

function isInRange(start, end) {
  return currentMinutes.value >= toMinutes(start) && currentMinutes.value < toMinutes(end)
}

const currentRecess = computed(() =>
  recessPeriods.find(period => isInRange(period.start, period.end))
)

const minutesToClass = computed(() => {
  if (!currentRecess.value) return null
  return toMinutes(currentRecess.value.end) - currentMinutes.value
})

const isAlmostClassTime = computed(() =>
  actualMode.value === 'recess' &&
  currentRecess.value &&
  minutesToClass.value !== null &&
  minutesToClass.value <= 2 &&
  minutesToClass.value >= 0
)

const isMorningTime = computed(() => isInRange('07:50', '08:35'))
const isNapTime = computed(() => isInRange('12:40', '13:20'))

const actualMode = computed(() => {
  if (selectedMode.value !== 'auto') return selectedMode.value
  if (currentRecess.value) return 'recess'
  if (isNapTime.value) return 'nap'
  if (isMorningTime.value) return 'morning'
  return 'quiet'
})

const displayPlan = computed(() => {
  if (actualMode.value === 'morning') {
    return morningPlans[now.value.getDay()] || {
      icon: '🌞',
      title: '早修模式',
      subtitle: '請安靜進入早修狀態。',
      rules: ['保持安靜', '整理桌面', '準備早修用品', '等待老師指示']
    }
  }

  if (actualMode.value === 'recess') {
    const rules = [...staticModes.recess.rules]

    if (isAlmostClassTime.value) {
      rules.unshift(nextIsSubject.value ? '快去走廊排隊！' : '快回座位坐好！')
    }

    if (nextIsSubject.value) {
      rules.push('下節科任課：帶好課本用品，到走廊排隊')
    }

    return {
      ...staticModes.recess,
      title: isAlmostClassTime.value ? '準備上課！' : staticModes.recess.title,
      subtitle: isAlmostClassTime.value
        ? nextIsSubject.value
          ? '上課前 2 分鐘，請帶好用品，立刻到走廊排隊。'
          : '上課前 2 分鐘，請收拾物品，立刻回座位坐好。'
        : currentRecess.value
          ? `${currentRecess.value.label}｜${staticModes.recess.subtitle}`
          : staticModes.recess.subtitle,
      rules
    }
  }

  return staticModes[actualMode.value]
})

const modeClass = computed(() => ({
  morning: actualMode.value === 'morning',
  recess: actualMode.value === 'recess',
  nap: actualMode.value === 'nap',
  quiet: actualMode.value === 'quiet',
  warning: isAlmostClassTime.value
}))

function setMode(mode) {
  selectedMode.value = mode
}

function clearCustomMessage() {
  customMessage.value = ''
}

function openFullscreen() {
  const element = document.documentElement
  if (element.requestFullscreen) {
    element.requestFullscreen()
  }
}
</script>

<template>
  <div class="page modes-page">
    <div class="mode-header">
      <div>
        <h2>🔔 多元模式</h2>
        <p>依班級情境切換大螢幕提醒。時間整合在模式框右上角。</p>
      </div>
    </div>

    <div class="control-card">
      <div class="mode-buttons">
        <button :class="{ active: selectedMode === 'auto' }" @click="setMode('auto')">✨ 自動</button>
        <button :class="{ active: selectedMode === 'morning' }" @click="setMode('morning')">🌞 早修</button>
        <button :class="{ active: selectedMode === 'recess' }" @click="setMode('recess')">🔔 下課</button>
        <button :class="{ active: selectedMode === 'nap' }" @click="setMode('nap')">😴 午休</button>
        <button :class="{ active: selectedMode === 'quiet' }" @click="setMode('quiet')">🤫 安靜</button>
        <button class="fullscreen-btn" @click="openFullscreen">📺 全螢幕</button>
      </div>

      <div class="compact-settings">
        <label class="checkbox-line">
          <input type="checkbox" v-model="nextIsSubject">
          <span>下節是科任課</span>
        </label>

        <input v-model="customMessage" placeholder="臨時公告，例如：請帶水壺、下課先交回條" />
        <button class="clear-btn" @click="clearCustomMessage">清除公告</button>
      </div>
    </div>

    <section class="display-panel" :class="modeClass">
      <div class="panel-clock">
        <strong>{{ timeText }}</strong>
        <span>{{ dateText }}　{{ weekdayText }}</span>
      </div>

      <div class="mode-icon">{{ displayPlan.icon }}</div>
      <h1>{{ displayPlan.title }}</h1>
      <p class="subtitle">{{ customMessage || displayPlan.subtitle }}</p>

      <div class="rules">
        <div
          v-for="rule in displayPlan.rules"
          :key="rule"
          class="rule-item"
        >
          {{ rule }}
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.modes-page {
  max-width: none;
  height: calc(100vh - 48px);
  margin: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 10px;
  overflow: hidden;
}

.mode-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.mode-header h2 {
  margin: 0 0 4px;
}

.mode-header p {
  margin: 0;
  font-size: 15px;
}

.control-card {
  background: #ffffff;
  border-radius: 22px;
  padding: 12px 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .08);
}

.mode-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mode-buttons button {
  background: #f4fbf7;
  color: #2f6f57;
  border: 2px solid #dff3ea;
  border-radius: 14px;
  padding: 10px 14px;
  font-size: 16px;
  font-weight: 800;
}

.mode-buttons button.active {
  background: #6bbf95;
  color: white;
  border-color: #6bbf95;
}

.mode-buttons .fullscreen-btn {
  margin-left: auto;
  background: #8db3e2;
  color: white;
  border-color: #8db3e2;
}

.compact-settings {
  margin-top: 10px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
}

.checkbox-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  white-space: nowrap;
}

.checkbox-line input {
  width: 18px;
  height: 18px;
}

.compact-settings input[type='text'],
.compact-settings input:not([type]) {
  border: 2px solid #dceee6;
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 15px;
}

.clear-btn {
  background: #e9897e;
  border-radius: 14px;
  padding: 10px 14px;
  font-size: 15px;
}

.display-panel {
  min-height: 0;
  height: 100%;
  border-radius: 30px;
  padding: 24px 34px 22px;
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto auto auto auto 1fr;
  justify-items: center;
  align-items: center;
  text-align: center;
  box-shadow: 0 12px 36px rgba(0, 0, 0, .14);
  color: #263238;
}

.display-panel.morning {
  background: linear-gradient(135deg, #fff2b8, #fff8e8);
}

.display-panel.recess {
  background: linear-gradient(135deg, #dff3ff, #f1fbff);
}

.display-panel.nap {
  background: linear-gradient(135deg, #dbeafe, #eef2ff);
}

.display-panel.quiet {
  background: linear-gradient(135deg, #e8f6ef, #ffffff);
}

.display-panel.warning {
  background: linear-gradient(135deg, #ff6b6b, #ffe0d6);
  animation: warningPulse 1s infinite;
}

.panel-clock {
  width: min(760px, 92%);
  background: rgba(255,255,255,.94);
  color: #1f5f49;
  border: 4px solid rgba(47,111,87,.20);
  border-radius: 30px;
  padding: 14px 22px 12px;
  display: grid;
  gap: 4px;
  text-align: center;
  box-shadow: 0 10px 28px rgba(0,0,0,.14);
}

.panel-clock strong {
  font-size: clamp(64px, 9vw, 118px);
  line-height: .95;
  letter-spacing: 4px;
  font-variant-numeric: tabular-nums;
}

.panel-clock span {
  font-size: clamp(18px, 2vw, 30px);
  font-weight: 900;
  color: #34495e;
}

.warning .panel-clock {
  color: #991b1b;
  border-color: rgba(153, 27, 27, .40);
  background: rgba(255,255,255,.98);
}

.mode-icon {
  font-size: clamp(42px, 6vh, 72px);
}

.display-panel h1 {
  font-size: clamp(38px, 6vh, 64px);
  margin: 4px 0;
}

.subtitle {
  font-size: clamp(22px, 3vh, 34px);
  font-weight: 900;
  margin: 2px 0 10px;
  line-height: 1.3;
  max-width: 1100px;
}

.rules {
  align-self: stretch;
  width: min(1080px, 100%);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.rule-item {
  background: rgba(255,255,255,.82);
  border-radius: 22px;
  padding: 14px 18px;
  font-size: clamp(22px, 3vh, 32px);
  font-weight: 900;
  display: grid;
  place-items: center;
  box-shadow: 0 6px 18px rgba(0,0,0,.08);
}

.warning .rule-item:first-child {
  background: rgba(255,255,255,.95);
  color: #b91c1c;
  border: 3px solid rgba(185, 28, 28, .35);
}

@keyframes warningPulse {
  0%, 100% { box-shadow: 0 12px 36px rgba(239, 68, 68, .22); }
  50% { box-shadow: 0 12px 48px rgba(239, 68, 68, .72); }
}

@media (max-width: 900px) {
  .modes-page {
    height: auto;
    min-height: calc(100vh - 48px);
    overflow: visible;
  }

  .compact-settings {
    grid-template-columns: 1fr;
  }

  .mode-buttons .fullscreen-btn {
    margin-left: 0;
  }

  .display-panel {
    min-height: 520px;
    padding: 18px 18px 22px;
  }

  .panel-clock {
    width: 100%;
    border-radius: 24px;
  }

  .rules {
    grid-template-columns: 1fr;
  }
}
</style>
