<script setup>
import { computed, ref, watch } from 'vue'

const viewMode = ref(localStorage.getItem('calendarViewMode') || 'month')
const currentDate = ref(new Date())
const selectedDate = ref(toDateKey(new Date()))
const eventDraft = ref('')

const savedEvents = ref(loadEvents())

watch(viewMode, value => {
  localStorage.setItem('calendarViewMode', value)
})

watch(savedEvents, value => {
  localStorage.setItem('classHelperCalendarEvents', JSON.stringify(value))
}, { deep: true })

const weekLabelsMonth = ['日', '一', '二', '三', '四', '五', '六']
const weekLabelsWeek = ['一', '二', '三', '四', '五', '六', '日']

const fixedEvents = {
  '01-01': ['元旦'],
  '02-28': ['和平紀念日'],
  '04-04': ['兒童節'],
  '05-01': ['勞動節'],
  '09-28': ['教師節'],
  '10-10': ['國慶日'],
  '10-25': ['臺灣光復節'],
  '12-25': ['行憲紀念日']
}

const taiwan2026Events = {
  '2026-02-15': ['小年夜'],
  '2026-02-16': ['除夕'],
  '2026-02-17': ['春節 初一'],
  '2026-02-18': ['春節 初二'],
  '2026-02-19': ['春節 初三'],
  '2026-02-20': ['春節連假'],
  '2026-02-27': ['和平紀念日補假'],
  '2026-04-03': ['兒童節補假'],
  '2026-04-05': ['清明節'],
  '2026-04-06': ['清明節補假'],
  '2026-06-19': ['端午節'],
  '2026-09-25': ['中秋節'],
  '2026-10-09': ['國慶日補假'],
  '2026-10-26': ['光復節補假'],
  '2026-12-25': ['行憲紀念日']
}

const solarTerms2026 = {
  '2026-01-05': ['小寒'],
  '2026-01-20': ['大寒'],
  '2026-02-04': ['立春'],
  '2026-02-18': ['雨水'],
  '2026-03-05': ['驚蟄'],
  '2026-03-20': ['春分'],
  '2026-04-05': ['清明'],
  '2026-04-20': ['穀雨'],
  '2026-05-05': ['立夏'],
  '2026-05-21': ['小滿'],
  '2026-06-05': ['芒種'],
  '2026-06-21': ['夏至'],
  '2026-07-07': ['小暑'],
  '2026-07-23': ['大暑'],
  '2026-08-07': ['立秋'],
  '2026-08-23': ['處暑'],
  '2026-09-07': ['白露'],
  '2026-09-23': ['秋分'],
  '2026-10-08': ['寒露'],
  '2026-10-23': ['霜降'],
  '2026-11-07': ['立冬'],
  '2026-11-22': ['小雪'],
  '2026-12-07': ['大雪'],
  '2026-12-21': ['冬至']
}

const monthDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // 只顯示「有包含本月日期」的週，不再固定塞滿 6 排。
  // 例如 2026 年 7 月只會顯示 5 排，不會多出最下面整排 8 月。
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - firstDay.getDay())

  const end = new Date(lastDay)
  end.setDate(lastDay.getDate() + (6 - lastDay.getDay()))

  const totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1

  return Array.from({ length: totalDays }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return createDayInfo(day, month)
  })
})

const weekDays = computed(() => {
  const base = new Date(currentDate.value)
  const day = base.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(base)
  monday.setDate(base.getDate() + diffToMonday)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return createDayInfo(date, date.getMonth())
  })
})

const titleText = computed(() => {
  if (viewMode.value === 'month') {
    const date = currentDate.value
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`
  }

  const start = weekDays.value[0].date
  const end = weekDays.value[6].date
  return `${formatMonthDay(start)}－${formatMonthDay(end)}`
})

const selectedDayInfo = computed(() => {
  const date = fromDateKey(selectedDate.value)
  return createDayInfo(date, date.getMonth())
})

function loadEvents() {
  try {
    return JSON.parse(localStorage.getItem('classHelperCalendarEvents') || '{}')
  } catch {
    return {}
  }
}

function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fromDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function weekName(date) {
  return ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
}

function formatMonthDayWithWeek(date) {
  return `${date.getMonth() + 1}/${date.getDate()}（${weekName(date)}）`
}

function createDayInfo(date, currentMonth) {
  const key = toDateKey(date)
  const mmdd = key.slice(5)
  const builtIn = [
    ...(fixedEvents[mmdd] || []),
    ...(taiwan2026Events[key] || []),
    ...(solarTerms2026[key] || [])
  ]

  const custom = savedEvents.value[key] || []

  return {
    date,
    key,
    dayNumber: date.getDate(),
    isToday: key === toDateKey(new Date()),
    isSelected: key === selectedDate.value,
    isCurrentMonth: date.getMonth() === currentMonth,
    isSunday: date.getDay() === 0,
    isSaturday: date.getDay() === 6,
    builtIn,
    custom,
    allEvents: [...builtIn, ...custom]
  }
}

function previousPeriod() {
  const next = new Date(currentDate.value)
  if (viewMode.value === 'month') next.setMonth(next.getMonth() - 1)
  else next.setDate(next.getDate() - 7)
  currentDate.value = next
}

function nextPeriod() {
  const next = new Date(currentDate.value)
  if (viewMode.value === 'month') next.setMonth(next.getMonth() + 1)
  else next.setDate(next.getDate() + 7)
  currentDate.value = next
}

function goToday() {
  const today = new Date()
  currentDate.value = today
  selectedDate.value = toDateKey(today)
}

function selectDate(day) {
  selectedDate.value = day.key
  currentDate.value = new Date(day.date)
}

function addEvent() {
  const text = eventDraft.value.trim()
  if (!text) return

  const key = selectedDate.value
  if (!savedEvents.value[key]) savedEvents.value[key] = []

  savedEvents.value[key].push(text)
  eventDraft.value = ''
}

function removeEvent(index) {
  const key = selectedDate.value
  savedEvents.value[key].splice(index, 1)
  if (savedEvents.value[key].length === 0) {
    delete savedEvents.value[key]
  }
}
</script>

<template>
  <div class="page calendar-page">
    <header class="calendar-header">
      <div>
        <h2>🗓️ 行事曆</h2>
        <p>月曆從週日開始，週曆從週一開始。節日、節氣與自訂事項會一起顯示。</p>
      </div>

      <div class="mode-switch">
        <button :class="{ active: viewMode === 'month' }" @click="viewMode = 'month'">月</button>
        <button :class="{ active: viewMode === 'week' }" @click="viewMode = 'week'">週</button>
      </div>
    </header>

    <section class="calendar-shell" :class="viewMode">
      <main class="calendar-main">
        <div class="calendar-toolbar">
          <button @click="previousPeriod">←</button>
          <strong>{{ titleText }}</strong>
          <button @click="nextPeriod">→</button>
          <button class="today-btn" @click="goToday">今天</button>
        </div>

        <div v-if="viewMode === 'month'" class="month-view">
          <div
            class="weekday"
            :class="{ sunday: index === 0, saturday: index === 6 }"
            v-for="(label, index) in weekLabelsMonth"
            :key="label"
          >
            {{ label }}
          </div>

          <button
            v-for="day in monthDays"
            :key="day.key"
            class="day-cell"
            :class="{
              muted: !day.isCurrentMonth,
              today: day.isToday,
              selected: day.isSelected,
              hasEvent: day.allEvents.length,
              sunday: day.isSunday,
              saturday: day.isSaturday
            }"
            @click="selectDate(day)"
          >
            <span class="day-number">{{ day.dayNumber }}</span>

            <div class="event-list">
              <span
                v-for="event in day.allEvents.slice(0, 2)"
                :key="event"
                class="event-pill"
              >
                {{ event }}
              </span>

              <span v-if="day.allEvents.length > 2" class="more-pill">
                +{{ day.allEvents.length - 2 }}
              </span>
            </div>
          </button>
        </div>

        <!-- ✅ HUA_MOBILE_WEEK_SCROLL_ONLY_20260710：手機僅週曆卡片區可左右滑動，頁面本身不橫向滑。 -->
        <div v-else class="week-scroll-area" aria-label="週行事曆，可左右滑動查看七天">
          <div class="week-view">
          <button
            v-for="(day, index) in weekDays"
            :key="day.key"
            class="week-day"
            :class="{
              today: day.isToday,
              selected: day.isSelected,
              sunday: day.isSunday,
              saturday: day.isSaturday
            }"
            @click="selectDate(day)"
          >
            <h3>{{ formatMonthDayWithWeek(day.date) }}</h3>

            <div class="week-events">
              <span
                v-for="event in day.allEvents"
                :key="event"
                class="event-pill"
              >
                {{ event }}
              </span>

              <span v-if="day.allEvents.length === 0" class="empty-text">
                尚無事項
              </span>
            </div>
          </button>
          </div>
        </div>
      </main>

      <aside class="detail-panel">
        <h3>📌 {{ selectedDate }}</h3>

        <div v-if="selectedDayInfo.builtIn.length" class="built-in-box">
          <h4>節日／節氣</h4>
          <p v-for="event in selectedDayInfo.builtIn" :key="event">🌼 {{ event }}</p>
        </div>

        <div class="custom-box">
          <h4>手動事項</h4>

          <div
            v-for="(event, index) in selectedDayInfo.custom"
            :key="event + index"
            class="custom-event"
          >
            <span>{{ event }}</span>
            <button @click="removeEvent(index)">刪除</button>
          </div>

          <p v-if="selectedDayInfo.custom.length === 0" class="empty-text">
            這天還沒有自訂事項。
          </p>

          <div class="add-row">
            <input
              v-model="eventDraft"
              placeholder="例如：校外教學、數學考試、交回條"
              @keyup.enter="addEvent"
            />
            <button @click="addEvent">新增</button>
          </div>
        </div>
      </aside>
    </section>
  </div>
</template>

<style scoped>
.calendar-page {
  max-width: none;
  margin: 0;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
  margin-bottom: 12px;
}

.calendar-header h2 {
  margin: 0 0 4px;
}

.calendar-header p {
  color: #5b6472;
  margin: 0;
}

.mode-switch {
  display: flex;
  gap: 8px;
  background: white;
  padding: 8px;
  border-radius: 18px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .06);
}

.mode-switch button,
.calendar-toolbar button,
.add-row button {
  border: none;
  border-radius: 14px;
  padding: 10px 16px;
  font-weight: 900;
  cursor: pointer;
}

.mode-switch button {
  background: #f2f4f7;
  color: #345;
}

.mode-switch button.active,
.today-btn {
  background: #6bbf95;
  color: white;
}

.calendar-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 14px;
  align-items: start;
}

/* 週檢視需要完整 7 欄，所以讓編輯面板移到下方，避免週日被擠出去。 */
.calendar-shell.week {
  grid-template-columns: 1fr;
}

.calendar-shell.week .detail-panel {
  max-width: none;
}

.calendar-main,
.detail-panel {
  background: white;
  border-radius: 24px;
  padding: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .08);
}

.calendar-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.calendar-toolbar strong {
  font-size: 24px;
  margin-right: auto;
}

.calendar-toolbar button {
  background: #f4fbf7;
  color: #2f6f57;
}

.calendar-shell.month .calendar-main {
  min-height: calc(100vh - 170px);
  display: flex;
  flex-direction: column;
}

.month-view {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: 30px;
  grid-auto-rows: minmax(96px, 1fr);
  gap: 8px;
  flex: 1;
}

.weekday {
  text-align: center;
  font-weight: 900;
  color: #4e7c68;
  padding: 4px;
}

.weekday.sunday {
  color: #e85b5b;
}

.weekday.saturday {
  color: #3b82f6;
}

.day-cell {
  min-height: 96px;
  height: auto;
  border: 2px solid #edf1f5;
  background: #ffffff;
  color: #1f2937;
  border-radius: 13px;
  padding: 6px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 3px;
  overflow: hidden;
}

.day-cell.muted {
  opacity: 1;
  background: #f4f6f8;
}

.day-cell.muted .day-number {
  color: #9aa3af;
}

.day-cell.sunday {
  background: #fff1f2;
  border-color: #ffd6dc;
}

.day-cell.saturday {
  background: #eff6ff;
  border-color: #cfe3ff;
}

.day-cell.today {
  background: #ecfdf3;
  border-color: #30a46c;
  box-shadow: inset 0 0 0 2px #30a46c;
}

.day-cell.selected {
  box-shadow: 0 0 0 4px #dff3ea;
}

.day-cell.sunday .day-number,
.week-day.sunday h3 {
  color: #d7354a;
}

.day-cell.saturday .day-number,
.week-day.saturday h3 {
  color: #2563eb;
}

.day-cell.hasEvent:not(.today):not(.sunday):not(.saturday) {
  background: #fffdf7;
}

.day-number {
  display: block;
  font-size: 19px;
  font-weight: 950;
  line-height: 1;
  align-self: flex-start;
  color: #1f2937;
}

.event-list {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.week-events {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.event-pill,
.more-pill {
  background: #dff3ea;
  color: #2f6f57;
  border-radius: 999px;
  padding: 2px 7px;
  font-size: 12px;
  font-weight: 850;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.more-pill {
  background: #fff1ce;
  color: #b46b00;
}

.week-view .event-pill {
  font-size: 15px;
  line-height: 1.25;
  padding: 5px 9px;
  white-space: normal;
  text-overflow: clip;
}

.week-view .empty-text {
  font-size: 15px;
  line-height: 1.4;
}

.week-view {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}

.week-day {
  min-height: 300px;
  border: 2px solid #edf1f5;
  border-radius: 18px;
  padding: 10px;
  cursor: pointer;
  background: #ffffff;
  min-width: 0;
  overflow: hidden;
  text-align: left;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
}

.week-day.sunday {
  background: #fff1f2;
  border-color: #ffd6dc;
}

.week-day.saturday {
  background: #eff6ff;
  border-color: #cfe3ff;
}

.week-day.today {
  border-color: #30a46c;
  box-shadow: inset 0 0 0 2px #30a46c;
  background: #ecfdf3;
}

.week-day.selected {
  box-shadow: 0 0 0 4px #dff3ea;
}

.week-day h3 {
  margin: 0 0 10px;
  font-size: 17px;
  white-space: nowrap;
  line-height: 1.2;
  align-self: flex-start;
}

.built-in-box,
.custom-box {
  background: #fff8f0;
  border-radius: 18px;
  padding: 14px;
  margin-top: 12px;
}

.built-in-box h4,
.custom-box h4 {
  margin: 0 0 8px;
}

.built-in-box p {
  margin: 6px 0;
}

.custom-event {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  background: white;
  border-radius: 14px;
  padding: 10px 12px;
  margin-bottom: 8px;
}

.custom-event button {
  background: #e9897e;
  color: white;
  border: none;
  border-radius: 12px;
  padding: 8px 10px;
}

.add-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  margin-top: 12px;
}

.add-row input {
  border: 2px solid #dceee6;
  border-radius: 14px;
  padding: 12px;
  font-size: 15px;
  min-width: 0;
}

.empty-text {
  color: #7b8492;
}

@media (max-width: 1100px) {
  .calendar-shell {
    grid-template-columns: 1fr;
  }

  .calendar-shell.month .calendar-main {
    min-height: calc(100vh - 185px);
  }

  .month-view {
    grid-template-rows: 28px;
    grid-auto-rows: minmax(82px, 1fr);
    gap: 6px;
  }

  .day-cell {
    min-height: 82px;
  }
}

@media (max-width: 900px) {
  .week-view {
    grid-template-columns: repeat(7, minmax(84px, 1fr));
    overflow-x: auto;
    padding-bottom: 6px;
  }

  .week-day {
    min-height: 220px;
  }
}

@media (max-width: 760px) {
  .calendar-header {
    flex-direction: column;
  }

  .calendar-toolbar strong {
    font-size: 20px;
  }

  .calendar-shell.month .calendar-main {
    min-height: auto;
  }

  .month-view {
    grid-template-rows: 26px;
    grid-auto-rows: minmax(64px, auto);
    gap: 4px;
    flex: initial;
  }

  .day-cell {
    min-height: 64px;
    padding: 5px;
  }

  .event-pill,
  .more-pill {
    font-size: 10px;
    padding: 1px 5px;
  }

  .week-view .event-pill {
    font-size: 13px;
    padding: 4px 7px;
  }
}

/* 教室大螢幕修正：週行事曆日期顏色加深，避免淡底看不清楚 */
.week-day h3,
.day-number {
  color: #243b53;
  font-weight: 900;
}
.week-day.sunday h3,
.day-cell.sunday .day-number { color: #b42318; }
.week-day.saturday h3,
.day-cell.saturday .day-number { color: #1d4ed8; }
.week-day.today h3,
.day-cell.today .day-number { color: #14532d; }
.week-day.selected h3 { color: #1f5c47; }


/* ✅ HUA_CALENDAR_MOBILE_DESKTOP_REVIEW_20260710：桌機盡量一頁式，手機可美觀滑動並方便編輯。 */
.calendar-main {
  min-width: 0;
}

.detail-panel {
  position: sticky;
  top: 16px;
}

.calendar-shell.week .detail-panel {
  position: static;
}

@media (min-width: 1101px) and (max-height: 760px) {
  .calendar-header {
    margin-bottom: 8px;
  }

  .calendar-header p {
    font-size: 14px;
  }

  .calendar-main,
  .detail-panel {
    padding: 12px;
    border-radius: 20px;
  }

  .calendar-shell.month .calendar-main {
    min-height: calc(100svh - 150px);
  }

  .month-view {
    grid-template-rows: 26px;
    grid-auto-rows: minmax(78px, 1fr);
    gap: 6px;
  }

  .day-cell {
    min-height: 78px;
  }

  .event-pill,
  .more-pill {
    font-size: 11px;
    padding: 2px 6px;
  }
}

@media (max-width: 1100px) {
  .detail-panel {
    position: static;
  }
}

@media (max-width: 760px) {
  .calendar-page {
    min-width: 0;
  }

  .calendar-header p {
    font-size: 14px;
    line-height: 1.5;
  }

  .mode-switch,
  .calendar-toolbar {
    width: 100%;
  }

  .mode-switch button {
    flex: 1;
  }

  .calendar-toolbar {
    flex-wrap: wrap;
  }

  .calendar-toolbar strong {
    flex: 1 1 100%;
    order: -1;
  }

  .calendar-main {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .month-view {
    min-width: 620px;
  }

  .week-view {
    min-width: 620px;
  }

  .detail-panel {
    padding: 14px;
  }

  .custom-event {
    align-items: flex-start;
  }

  .custom-event span {
    line-height: 1.5;
  }

  .add-row {
    grid-template-columns: 1fr;
  }

  .add-row button {
    width: 100%;
  }
}


/* ✅ HUA_MOBILE_WEEK_SCROLL_ONLY_20260710 */
.week-scroll-area { width: 100%; min-width: 0; }
@media (max-width: 760px) {
  .calendar-main { overflow-x: hidden !important; }
  .month-view { min-width: 0 !important; }
  .week-scroll-area {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 2px 2px 10px;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
  }
  .week-scroll-area::-webkit-scrollbar { height: 6px; }
  .week-scroll-area::-webkit-scrollbar-thumb { background: #cfe9dd; border-radius: 999px; }
  .week-view {
    width: max-content !important;
    max-width: none !important;
    min-width: 700px !important;
    grid-template-columns: repeat(7, 94px) !important;
    overflow: visible !important;
  }
  .week-day { min-width: 94px !important; min-height: 240px; }
  .week-day.today::before {
    content: "⭐ 今天";
    display: block;
    margin-bottom: 6px;
    color: #2f6f57;
    font-size: 12px;
    font-weight: 950;
  }
}
</style>
