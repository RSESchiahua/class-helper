<script setup>
// CONFIRM_STATUS_LINE_SPACING_20260707_2128
// CONFIRM_STATUS_BALANCED_20260707_2058
// CONFIRM_STATUS_ICONS_20260707_2115
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const STORAGE_KEY = 'classHelperStatusSchedule'
const now = ref(new Date())
const customNow = ref('')
const schedule = ref(loadSchedule())
const isSettingsOpen = ref(false)
const compactHeroStyle = computed(() => ({
  height: 'min(620px, calc(100dvh - 220px))',
  maxHeight: 'min(620px, calc(100dvh - 220px))',
  minHeight: '0',
  flex: '0 0 min(620px, calc(100dvh - 220px))',
  overflow: 'hidden',
  boxSizing: 'border-box'
}))
let timer = null

watch(schedule, value => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true })

onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 1000) })
onUnmounted(() => clearInterval(timer))

const timeSource = computed(() => customNow.value ? timeToMinutes(customNow.value) : now.value.getHours() * 60 + now.value.getMinutes())
const realTimeText = computed(() => now.value.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
const displayTimeText = computed(() => customNow.value ? `${customNow.value}:00` : realTimeText.value)
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
  <!-- CONFIRM_STATUS_BALANCED_20260707_2058: status white card is controlled by inline compactHeroStyle -->
  <div class="page wide-page status-page" :class="{ 'settings-open': isSettingsOpen }">
    <div class="page-title-row status-title-row">
      <div>
        <h2>🔔 現在狀態</h2>
        <p v-if="isSettingsOpen">依照目前時間自動切換早修、上課、下課、打掃、放學。</p>
      </div>
      <div class="status-actions">
        <button class="gear-button" :class="{ active: isSettingsOpen }" @click="isSettingsOpen = !isSettingsOpen">
          ⚙️ 作息設定
        </button>
        <button @click="openFullscreen">全螢幕</button>
      </div>
    </div>

    <section class="status-hero card" :class="{ warning: isRecessEnding }" :style="!isSettingsOpen ? compactHeroStyle : undefined">
      <div class="status-clock">
        <span class="clock-label">現在時間</span>
        <span class="clock-time">{{ displayTimeText }}</span>
      </div>
      <!-- CONFIRM_STATUS_ICONS_20260707_2115: 各作息代表圖示顯示在狀態標題旁，不再只當浮水印 -->
      <div class="status-title-display">
        <span class="status-main-icon" aria-hidden="true">{{ statusView.icon }}</span>
        <h1>{{ statusView.title }}</h1>
      </div>
      <p>{{ statusView.message }}</p>
      <!-- CONFIRM_STATUS_LINE_SPACING_20260707_2128: 剩餘時間改成醒目的小徽章，行距略分開但維持一頁式 -->
      <strong v-if="minutesLeft !== null" class="minutes-left">剩下 { minutesLeft } 分鐘</strong>
      <div class="rule-grid">
        <span v-for="rule in statusView.rules" :key="rule">{{ rule }}</span>
      </div>
    </section>

    <section v-if="isSettingsOpen" class="card compact-card schedule-editor">
      <div class="section-head">
        <div>
          <h3>⚙️ 作息時間設定</h3>
          <p>每間學校作息不同，老師可在這裡自行調整時間與提醒文字。</p>
        </div>
        <button @click="addPeriod">＋ 新增時段</button>
      </div>

      <div class="test-time-row">
        <label for="status-custom-now">測試目前時間</label>
        <input id="status-custom-now" v-model="customNow" type="time" title="測試或手動指定目前時間" />
        <button @click="customNow = ''">用現在時間</button>
      </div>

      <div class="schedule-table">
        <div v-for="(item, index) in schedule" :key="index" class="schedule-row">
          <select v-model="item.type">
            <option value="morning">早修</option>
            <option value="class">上課</option>
            <option value="recess">下課</option>
            <option value="cleaning">打掃</option>
            <option value="dismissal">放學</option>
            <option value="other">其他</option>
          </select>
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

<style scoped>
.status-page {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: calc(100vh - 120px);
}

/* 設定收起時：整個狀態頁鎖在畫面內，不讓大白框撐出捲軸 */
.status-page:not(.settings-open) {
  min-height: 0 !important;
  height: calc(100dvh - 108px) !important;
  max-height: calc(100dvh - 108px) !important;
  overflow: hidden !important;
}

.status-title-row {
  align-items: center;
  gap: 10px;
  margin-bottom: 0 !important;
  flex: 0 0 auto;
}

.status-title-row h2 {
  margin: 0;
  line-height: 1.15;
}

.status-title-row p {
  margin: 4px 0 0;
}

.status-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.gear-button {
  font-weight: 800;
  white-space: nowrap;
}

.gear-button.active {
  transform: translateY(1px);
  filter: brightness(0.97);
}

.status-hero {
  position: relative;
  flex: 0 0 auto;
  min-height: 0;
  height: clamp(390px, 46dvh, 430px);
  max-height: clamp(390px, 46dvh, 430px);
  padding: clamp(10px, 1.5vw, 18px) clamp(18px, 2.6vw, 32px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 5px;
  overflow: hidden;
  box-sizing: border-box;
}

/* 2026-07-07 status hero final-fit: 大白框高度改為受控一頁式 */
.status-page:not(.settings-open) .status-hero.card,
.status-page:not(.settings-open) section.status-hero.card {
  flex: 0 0 clamp(390px, 46dvh, 430px) !important;
  height: clamp(390px, 46dvh, 430px) !important;
  min-height: 0 !important;
  max-height: clamp(390px, 46dvh, 430px) !important;
  padding: 12px 26px 14px !important;
  gap: 5px !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

.status-page.settings-open .status-hero {
  height: auto;
  max-height: none;
  min-height: 430px;
}

.status-clock {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  line-height: 1;
}

.clock-label {
  font-size: clamp(0.82rem, 1.1vw, 1rem);
  font-weight: 800;
  opacity: 0.7;
  letter-spacing: 0.14em;
}

.clock-time {
  font-size: clamp(2.9rem, 5.8vw, 4.2rem);
  font-weight: 950;
  letter-spacing: 0.03em;
  font-variant-numeric: tabular-nums;
}

.status-page:not(.settings-open) .clock-time {
  font-size: clamp(3rem, 5.6vw, 4.25rem) !important;
}

.status-main-icon {
  font-size: clamp(1.3rem, 2.2vw, 1.8rem);
  line-height: 1;
  margin: 0;
}

/* 設定收起時，圖示只當右上角小浮水印，不佔中間高度 */
.status-page:not(.settings-open) .status-main-icon {
  position: absolute !important;
  right: 24px;
  top: 18px;
  font-size: clamp(1.1rem, 2vw, 1.7rem) !important;
  opacity: 0.14;
  pointer-events: none;
}

.status-hero h1 {
  margin: 0;
  font-size: clamp(1.85rem, 3.8vw, 2.75rem);
  line-height: 1;
  font-weight: 950;
}

.status-page:not(.settings-open) .status-hero h1 {
  font-size: clamp(1.75rem, 3.4vw, 2.55rem) !important;
  line-height: 1 !important;
}

.status-hero p {
  margin: 0;
  max-width: 900px;
  font-size: clamp(0.9rem, 1.45vw, 1.12rem);
  line-height: 1.15;
  font-weight: 900;
}

.status-page:not(.settings-open) .status-hero p {
  font-size: clamp(0.82rem, 1.1vw, 0.96rem) !important;
  line-height: 1.1 !important;
}

.status-hero strong {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 150px;
  padding: 5px 14px;
  border-radius: 999px;
  font-size: clamp(0.95rem, 1.5vw, 1.2rem);
  line-height: 1.05;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 8px 24px rgba(80, 60, 30, 0.08);
}

.rule-grid {
  width: min(100%, 820px);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 9px;
  margin-top: 6px;
}

.rule-grid span {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50px;
  padding: 7px 12px;
  border-radius: 18px;
  font-size: clamp(1.02rem, 1.55vw, 1.25rem);
  font-weight: 900;
  line-height: 1.15;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 8px 22px rgba(80, 60, 30, 0.07);
}

.status-page:not(.settings-open) .rule-grid {
  margin-top: 8px !important;
  gap: 8px !important;
}

.status-page:not(.settings-open) .rule-grid span {
  min-height: 48px !important;
  padding: 6px 12px !important;
  font-size: clamp(1rem, 1.45vw, 1.16rem) !important;
}

.schedule-editor {
  margin-top: 0;
  padding: 18px;
}

.section-head {
  align-items: center;
  gap: 12px;
}

.section-head h3 {
  margin: 0;
}

.section-head p {
  margin: 4px 0 0;
  font-size: 0.95rem;
  opacity: 0.72;
}

.test-time-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 12px 0;
  padding: 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.52);
}

.test-time-row label {
  font-weight: 900;
}

.schedule-row {
  grid-template-columns: 110px 1.1fr 125px 125px 2fr auto;
}

@media (max-height: 850px) and (min-width: 901px) {
  .status-page {
    gap: 6px;
  }

  .status-page:not(.settings-open) {
    height: calc(100dvh - 98px) !important;
    max-height: calc(100dvh - 98px) !important;
  }

  .status-page:not(.settings-open) .status-hero.card,
  .status-page:not(.settings-open) section.status-hero.card {
    flex-basis: clamp(390px, 48dvh, 430px) !important;
    height: clamp(390px, 48dvh, 430px) !important;
    max-height: clamp(390px, 48dvh, 430px) !important;
    padding: 10px 22px 12px !important;
    gap: 5px !important;
  }

  .clock-label {
    font-size: 0.78rem;
  }

  .status-page:not(.settings-open) .clock-time {
    font-size: clamp(2.7rem, 5.1vw, 3.75rem) !important;
  }

  .status-page:not(.settings-open) .status-hero h1 {
    font-size: clamp(1.55rem, 3vw, 2.15rem) !important;
  }

  .status-page:not(.settings-open) .status-hero p {
    font-size: clamp(0.76rem, 1vw, 0.9rem) !important;
  }

  .status-page:not(.settings-open) .rule-grid span {
    min-height: 44px !important;
    padding: 5px 11px !important;
    font-size: clamp(0.96rem, 1.35vw, 1.08rem) !important;
  }
}

@media (max-height: 760px) and (min-width: 901px) {
  .status-page:not(.settings-open) .status-hero.card,
  .status-page:not(.settings-open) section.status-hero.card {
    flex-basis: 390px !important;
    height: 390px !important;
    max-height: 390px !important;
  }

  .status-page:not(.settings-open) .clock-time {
    font-size: clamp(2.45rem, 4.6vw, 3.25rem) !important;
  }

  .status-page:not(.settings-open) .rule-grid span {
    min-height: 40px !important;
  }
}

@media (max-width: 900px) {
  .status-page,
  .status-page:not(.settings-open) {
    height: auto !important;
    max-height: none !important;
    min-height: auto;
    overflow: visible !important;
  }

  .status-title-row {
    align-items: flex-start;
  }

  .status-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .status-hero,
  .status-page:not(.settings-open) .status-hero.card {
    height: auto !important;
    max-height: none !important;
    min-height: 400px !important;
    padding: 20px 16px !important;
  }

  .status-page:not(.settings-open) .status-main-icon {
    position: static !important;
    opacity: 1;
    font-size: 1.8rem !important;
  }

  .rule-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .schedule-row {
    grid-template-columns: 1fr 1fr;
  }

  .schedule-row input[placeholder="給學生看的提醒"],
  .schedule-row .danger-text {
    grid-column: 1 / -1;
  }
}

@media (max-width: 560px) {
  .status-hero,
  .status-page:not(.settings-open) .status-hero.card {
    min-height: 380px !important;
    gap: 8px !important;
  }

  .clock-time,
  .status-page:not(.settings-open) .clock-time {
    font-size: clamp(2.8rem, 14vw, 3.8rem) !important;
  }

  .status-hero h1,
  .status-page:not(.settings-open) .status-hero h1 {
    font-size: clamp(1.9rem, 10vw, 2.8rem) !important;
  }

  .status-hero p,
  .status-page:not(.settings-open) .status-hero p {
    font-size: clamp(0.92rem, 4.4vw, 1.15rem) !important;
  }

  .rule-grid {
    gap: 8px;
  }

  .rule-grid span,
  .status-page:not(.settings-open) .rule-grid span {
    min-height: 48px;
    border-radius: 18px;
  }
}

/* 2026-07-07 status hero final-fit confirm-keyword
   最終覆蓋：設定收起時，把中間大白框鎖在一頁式高度內。 */
.status-page:not(.settings-open) .status-hero.card,
.status-page:not(.settings-open) section.status-hero.card {
  flex: 0 0 clamp(410px, 49dvh, 460px) !important;
  height: clamp(410px, 49dvh, 460px) !important;
  min-height: 0 !important;
  max-height: clamp(410px, 49dvh, 460px) !important;
  padding-top: 12px !important;
  padding-bottom: 14px !important;
  gap: 4px !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

.status-page:not(.settings-open) .clock-label {
  font-size: clamp(0.72rem, 0.95vw, 0.88rem) !important;
}

.status-page:not(.settings-open) .clock-time {
  font-size: clamp(2.9rem, 5.35vw, 4rem) !important;
}

.status-page:not(.settings-open) .status-hero h1 {
  font-size: clamp(1.6rem, 3.15vw, 2.35rem) !important;
}

.status-page:not(.settings-open) .status-hero p {
  font-size: clamp(0.78rem, 1.05vw, 0.92rem) !important;
  line-height: 1.08 !important;
}

.status-page:not(.settings-open) .rule-grid {
  margin-top: 6px !important;
  gap: 8px !important;
  max-width: 760px !important;
}

.status-page:not(.settings-open) .rule-grid span {
  min-height: 46px !important;
  padding: 6px 12px !important;
  font-size: clamp(0.96rem, 1.35vw, 1.08rem) !important;
}

@media (max-height: 850px) and (min-width: 901px) {
  .status-page:not(.settings-open) .status-hero.card,
  .status-page:not(.settings-open) section.status-hero.card {
    flex-basis: clamp(380px, 46dvh, 420px) !important;
    height: clamp(380px, 46dvh, 420px) !important;
    max-height: clamp(380px, 46dvh, 420px) !important;
  }
}

@media (max-height: 760px) and (min-width: 901px) {
  .status-page:not(.settings-open) .status-hero.card,
  .status-page:not(.settings-open) section.status-hero.card {
    flex-basis: 370px !important;
    height: 370px !important;
    max-height: 370px !important;
  }
}

/* CONFIRM_STATUS_BALANCED_20260707_2058: FINAL OVERRIDE — 設定收起時，強制讓大白框比上一版小一點並維持一頁式 */
.status-page:not(.settings-open) .status-hero.card,
.status-page:not(.settings-open) section.status-hero.card {
  flex: 0 0 clamp(390px, 46dvh, 430px) !important;
  height: clamp(390px, 46dvh, 430px) !important;
  min-height: 0 !important;
  max-height: clamp(390px, 46dvh, 430px) !important;
  padding: 10px 24px 12px !important;
  gap: 4px !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

.status-page:not(.settings-open) .clock-time {
  font-size: clamp(2.8rem, 5.05vw, 3.75rem) !important;
}

.status-page:not(.settings-open) .status-hero h1 {
  font-size: clamp(1.45rem, 2.85vw, 2.1rem) !important;
}

.status-page:not(.settings-open) .status-hero p {
  font-size: clamp(0.74rem, 0.95vw, 0.88rem) !important;
  line-height: 1.08 !important;
}

.status-page:not(.settings-open) .rule-grid {
  margin-top: 5px !important;
  gap: 8px !important;
  max-width: 760px !important;
}

.status-page:not(.settings-open) .rule-grid span {
  min-height: 44px !important;
  padding: 5px 12px !important;
  font-size: clamp(0.95rem, 1.32vw, 1.08rem) !important;
}

@media (max-height: 850px) and (min-width: 901px) {
  .status-page:not(.settings-open) .status-hero.card,
  .status-page:not(.settings-open) section.status-hero.card {
    flex-basis: clamp(365px, 44dvh, 400px) !important;
    height: clamp(365px, 44dvh, 400px) !important;
    max-height: clamp(365px, 44dvh, 400px) !important;
  }
}



/* CONFIRM_STATUS_BALANCED_20260707_2058
   最終版：比 20:45 截圖大很多；比 20:37 截圖矮，目標是剛好一頁式。 */
.status-page:not(.settings-open) {
  height: calc(100dvh - 104px) !important;
  max-height: calc(100dvh - 104px) !important;
  overflow: hidden !important;
}

.status-page:not(.settings-open) .status-hero.card,
.status-page:not(.settings-open) section.status-hero.card {
  flex: 0 0 min(620px, calc(100dvh - 220px)) !important;
  height: min(620px, calc(100dvh - 220px)) !important;
  min-height: 0 !important;
  max-height: min(620px, calc(100dvh - 220px)) !important;
  padding: 28px 34px 30px !important;
  gap: 10px !important;
  justify-content: center !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

.status-page:not(.settings-open) .clock-label {
  font-size: clamp(0.9rem, 1.05vw, 1.05rem) !important;
}

.status-page:not(.settings-open) .clock-time {
  font-size: clamp(4rem, 5.25vw, 5.15rem) !important;
}

.status-page:not(.settings-open) .status-main-icon {
  right: 28px !important;
  top: 22px !important;
  font-size: clamp(1.3rem, 2vw, 1.8rem) !important;
  opacity: 0.12 !important;
}

.status-page:not(.settings-open) .status-hero h1 {
  font-size: clamp(2.25rem, 4vw, 3.35rem) !important;
  line-height: 1.02 !important;
}

.status-page:not(.settings-open) .status-hero p {
  font-size: clamp(1rem, 1.45vw, 1.3rem) !important;
  line-height: 1.12 !important;
  max-width: 960px !important;
}

.status-page:not(.settings-open) .rule-grid {
  width: min(100%, 900px) !important;
  max-width: 900px !important;
  margin-top: 12px !important;
  gap: 12px !important;
}

.status-page:not(.settings-open) .rule-grid span {
  min-height: 58px !important;
  padding: 8px 16px !important;
  border-radius: 20px !important;
  font-size: clamp(1.12rem, 1.55vw, 1.36rem) !important;
}

@media (max-height: 850px) and (min-width: 901px) {
  .status-page:not(.settings-open) .status-hero.card,
  .status-page:not(.settings-open) section.status-hero.card {
    flex-basis: min(560px, calc(100dvh - 205px)) !important;
    height: min(560px, calc(100dvh - 205px)) !important;
    max-height: min(560px, calc(100dvh - 205px)) !important;
    padding-top: 22px !important;
    padding-bottom: 24px !important;
    gap: 8px !important;
  }

  .status-page:not(.settings-open) .clock-time {
    font-size: clamp(3.5rem, 5vw, 4.6rem) !important;
  }

  .status-page:not(.settings-open) .status-hero h1 {
    font-size: clamp(2rem, 3.7vw, 3rem) !important;
  }

  .status-page:not(.settings-open) .rule-grid span {
    min-height: 52px !important;
  }
}

@media (max-height: 760px) and (min-width: 901px) {
  .status-page:not(.settings-open) .status-hero.card,
  .status-page:not(.settings-open) section.status-hero.card {
    flex-basis: min(500px, calc(100dvh - 190px)) !important;
    height: min(500px, calc(100dvh - 190px)) !important;
    max-height: min(500px, calc(100dvh - 190px)) !important;
  }
}



/* CONFIRM_STATUS_ICONS_20260707_2115
   各作息代表圖示：小尺寸放在狀態標題旁，保留辨識度但不增加白框高度。 */
.status-title-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1.1vw, 14px);
  line-height: 1;
  margin: 0;
}

.status-title-display h1 {
  margin: 0;
}

.status-title-display .status-main-icon {
  position: static;
  opacity: 1;
  margin: 0;
  flex: 0 0 auto;
}

.status-page:not(.settings-open) .status-title-display {
  gap: clamp(8px, 1vw, 12px) !important;
}

.status-page:not(.settings-open) .status-title-display .status-main-icon {
  position: static !important;
  right: auto !important;
  top: auto !important;
  opacity: 1 !important;
  font-size: clamp(1.55rem, 2.15vw, 2.15rem) !important;
  line-height: 1 !important;
  pointer-events: none;
}

.status-page:not(.settings-open) .status-title-display h1 {
  margin: 0 !important;
}

@media (max-height: 850px) and (min-width: 901px) {
  .status-page:not(.settings-open) .status-title-display .status-main-icon {
    font-size: clamp(1.35rem, 1.9vw, 1.85rem) !important;
  }
}

@media (max-width: 560px) {
  .status-title-display {
    gap: 8px !important;
  }

  .status-page:not(.settings-open) .status-title-display .status-main-icon,
  .status-title-display .status-main-icon {
    font-size: clamp(1.5rem, 7vw, 2rem) !important;
  }
}


/* CONFIRM_STATUS_LINE_SPACING_20260707_2128
   狀態文字行距微調：時間、狀態、提醒、剩餘時間稍微分開；白框高度不放大，維持一頁式。 */
.status-page:not(.settings-open) .status-hero.card,
.status-page:not(.settings-open) section.status-hero.card {
  gap: 12px !important;
  justify-content: center !important;
}

.status-page:not(.settings-open) .status-clock {
  gap: 5px !important;
  margin-bottom: 2px !important;
}

.status-page:not(.settings-open) .status-title-display {
  gap: 12px !important;
  margin-top: 4px !important;
  margin-bottom: 0 !important;
}

.status-page:not(.settings-open) .status-title-display .status-main-icon {
  font-size: clamp(1.45rem, 1.9vw, 2rem) !important;
}

.status-page:not(.settings-open) .status-hero h1 {
  line-height: 1.12 !important;
}

.status-page:not(.settings-open) .status-hero p {
  line-height: 1.35 !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
}

.status-page:not(.settings-open) .minutes-left,
.status-page:not(.settings-open) .status-hero strong.minutes-left {
  margin-top: 0 !important;
  padding: 8px 22px !important;
  min-width: 180px !important;
  border-radius: 999px !important;
  font-size: clamp(1rem, 1.45vw, 1.25rem) !important;
  font-weight: 950 !important;
  letter-spacing: 0.04em !important;
  color: #2f6f55 !important;
  background: rgba(255, 248, 220, 0.96) !important;
  border: 2px solid rgba(47, 111, 85, 0.18) !important;
  box-shadow: 0 10px 24px rgba(80, 60, 30, 0.1) !important;
}

.status-page:not(.settings-open) .rule-grid {
  margin-top: 4px !important;
}

@media (max-height: 850px) and (min-width: 901px) {
  .status-page:not(.settings-open) .status-hero.card,
  .status-page:not(.settings-open) section.status-hero.card {
    gap: 9px !important;
  }

  .status-page:not(.settings-open) .status-clock {
    gap: 4px !important;
  }

  .status-page:not(.settings-open) .status-title-display {
    margin-top: 2px !important;
    gap: 10px !important;
  }

  .status-page:not(.settings-open) .minutes-left,
  .status-page:not(.settings-open) .status-hero strong.minutes-left {
    padding: 6px 18px !important;
    min-width: 160px !important;
    font-size: clamp(0.92rem, 1.25vw, 1.1rem) !important;
  }
}

@media (max-height: 760px) and (min-width: 901px) {
  .status-page:not(.settings-open) .status-hero.card,
  .status-page:not(.settings-open) section.status-hero.card {
    gap: 7px !important;
  }

  .status-page:not(.settings-open) .minutes-left,
  .status-page:not(.settings-open) .status-hero strong.minutes-left {
    padding: 5px 16px !important;
  }
}

</style>
