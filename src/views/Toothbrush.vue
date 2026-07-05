<script setup>
import { computed, reactive, ref, watch } from 'vue'

const today = new Date()
const selectedDate = ref(toDateKey(today))
const toast = ref('')

const students = computed(() => {
  const text = localStorage.getItem('students') || ''
  return text
    .split('\n')
    .map(name => name.trim())
    .filter(Boolean)
})

const records = reactive(loadRecords())

const weekdayNames = ['日', '一', '二', '三', '四', '五', '六']

const selectedDateObject = computed(() => parseDateKey(selectedDate.value))
const selectedWeekday = computed(() => selectedDateObject.value.getDay())
const isTuesday = computed(() => selectedWeekday.value === 2)
const isWeekend = computed(() => selectedWeekday.value === 0 || selectedWeekday.value === 6)

const selectedDateText = computed(() => {
  const date = selectedDateObject.value
  return `${date.getMonth() + 1}/${date.getDate()}（${weekdayNames[date.getDay()]}）`
})

const dayRecord = computed(() => {
  if (!records[selectedDate.value]) {
    records[selectedDate.value] = {}
  }

  return records[selectedDate.value]
})

const brushedCount = computed(() =>
  students.value.filter((_, index) => ['brushed', 'rinsed'].includes(dayRecord.value[index])).length
)

const rinsedCount = computed(() =>
  students.value.filter((_, index) => dayRecord.value[index] === 'rinsed').length
)

const unfinishedCount = computed(() =>
  Math.max(students.value.length - brushedCount.value, 0)
)

watch(records, () => {
  localStorage.setItem('toothbrushRecords', JSON.stringify(records))
}, { deep: true })

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem('toothbrushRecords') || '{}')
  } catch {
    return {}
  }
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function moveDate(offset) {
  const date = selectedDateObject.value
  date.setDate(date.getDate() + offset)
  selectedDate.value = toDateKey(date)
}

function goToday() {
  selectedDate.value = toDateKey(new Date())
}

function statusIcon(status) {
  if (status === 'brushed') return '🪥'
  if (status === 'rinsed') return '💧'
  return '－'
}

function statusLabel(status) {
  if (status === 'brushed') return '已刷牙'
  if (status === 'rinsed') return '已漱口'
  return '未完成'
}

function statusClass(status) {
  return {
    brushed: status === 'brushed',
    rinsed: status === 'rinsed'
  }
}

function toggleStatus(index) {
  const current = dayRecord.value[index] || 'none'
  const next = {
    none: 'brushed',
    brushed: 'rinsed',
    rinsed: 'none'
  }

  dayRecord.value[index] = next[current]

  if (next[current] === 'brushed') {
    showToast(`${index + 1}號已刷牙 🪥`)
  }

  if (next[current] === 'rinsed') {
    showToast(`${index + 1}號已漱口 💧`)
  }
}

function setAll(status) {
  students.value.forEach((_, index) => {
    dayRecord.value[index] = status
  })

  showToast(status === 'rinsed' ? '全班已設為已漱口 💧' : '全班已設為已刷牙 🪥')
}

function clearToday() {
  if (!confirm(`確定要清除 ${selectedDateText.value} 的潔牙紀錄嗎？`)) return
  records[selectedDate.value] = {}
  showToast('今日潔牙紀錄已清除')
}

function showToast(message) {
  toast.value = message
  setTimeout(() => {
    if (toast.value === message) {
      toast.value = ''
    }
  }, 1400)
}
</script>

<template>
  <div class="page toothbrush-page">
    <div class="page-header">
      <div>
        <h2>🪥 刷牙漱口追蹤</h2>
        <p>平日中午刷牙；週二加強漱口。點座號一次＝已刷牙，第二次＝已漱口。</p>
      </div>

      <div class="date-controls">
        <button @click="moveDate(-1)">◀ 前一天</button>
        <button class="today-btn" @click="goToday">今天</button>
        <button @click="moveDate(1)">後一天 ▶</button>
      </div>
    </div>

    <section class="card">
      <div class="tracking-top">
        <div>
          <h3>{{ selectedDateText }}</h3>
          <p v-if="isTuesday" class="hint rinse-hint">💧 今天是週二：刷牙後記得漱口。</p>
          <p v-else-if="isWeekend" class="hint weekend-hint">🌿 今天是假日，可視需要記錄。</p>
          <p v-else class="hint">🪥 今天中午潔牙追蹤。</p>
        </div>

        <div class="summary">
          <span>🪥 {{ brushedCount }}/{{ students.length }}</span>
          <span>💧 {{ rinsedCount }}/{{ students.length }}</span>
          <span>待完成 {{ unfinishedCount }}</span>
        </div>
      </div>

      <div class="actions">
        <button class="brushed-btn" @click="setAll('brushed')">🪥 全班已刷牙</button>
        <button class="rinsed-btn" @click="setAll('rinsed')">💧 全班已漱口</button>
        <button class="clear-btn" @click="clearToday">🧹 清除今日</button>
      </div>

      <div v-if="students.length === 0" class="empty">
        尚未建立學生名單，請先到「學生管理」貼上名單。
      </div>

      <div v-else class="seat-grid" :class="{ tuesday: isTuesday }">
        <button
          v-for="(student, index) in students"
          :key="student + index"
          class="seat"
          :class="statusClass(dayRecord[index])"
          :title="`${index + 1}號 ${student}：${statusLabel(dayRecord[index])}`"
          @click="toggleStatus(index)"
        >
          <strong>{{ index + 1 }}</strong>
          <span>{{ statusIcon(dayRecord[index]) }}</span>
        </button>
      </div>
    </section>

    <div class="legend">
      <span><b class="none-dot">－</b> 未完成</span>
      <span><b class="brush-dot">🪥</b> 已刷牙</span>
      <span><b class="rinse-dot">💧</b> 已漱口</span>
    </div>

    <div v-if="toast" class="toast">
      {{ toast }}
    </div>
  </div>
</template>

<style scoped>
.toothbrush-page {
  max-width: none;
  margin: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  margin-bottom: 18px;
}

.page-header h2 {
  margin-bottom: 8px;
}

.date-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.date-controls button,
.actions button {
  border: none;
  border-radius: 14px;
  padding: 10px 14px;
  font-weight: 800;
  cursor: pointer;
}

.today-btn {
  background: #6bbf95;
  color: white;
}

.tracking-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 14px;
}

.tracking-top h3 {
  margin: 0 0 8px;
  font-size: 28px;
  color: #2f6f57;
}

.hint {
  margin: 0;
  color: #64748b;
  font-weight: 700;
}

.rinse-hint {
  color: #2563eb;
}

.weekend-hint {
  color: #d97706;
}

.summary {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.summary span {
  background: #f4fbf7;
  color: #2f6f57;
  border-radius: 999px;
  padding: 8px 12px;
  font-weight: 900;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.brushed-btn {
  background: #45c96b;
  color: white;
}

.rinsed-btn {
  background: #60a5fa;
  color: white;
}

.clear-btn {
  background: #e9897e;
  color: white;
}

.empty {
  background: #fff7dc;
  border-radius: 18px;
  padding: 18px;
  font-weight: 800;
  color: #8a5a00;
}

.seat-grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(54px, 1fr));
  gap: 10px;
}

.seat {
  min-height: 72px;
  border-radius: 18px;
  border: 2px solid #dde2ea;
  background: #f2f4f7;
  color: #374151;
  display: grid;
  place-items: center;
  cursor: pointer;
  position: relative;
  transition: transform .15s ease, box-shadow .15s ease;
}

.seat:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,.12);
}

.seat strong {
  font-size: 26px;
}

.seat span {
  font-size: 22px;
}

.seat.brushed {
  background: #e9faef;
  border-color: #8ce0a4;
  color: #1f8f48;
}

.seat.rinsed {
  background: #eaf2ff;
  border-color: #93c5fd;
  color: #1d4ed8;
}

.legend {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 14px;
  font-weight: 900;
  color: #475569;
}

.legend span {
  background: white;
  border-radius: 999px;
  padding: 8px 12px;
}

.toast {
  position: fixed;
  right: 28px;
  bottom: 28px;
  background: #2f6f57;
  color: white;
  padding: 16px 22px;
  border-radius: 20px;
  font-size: 22px;
  font-weight: 900;
  box-shadow: 0 10px 30px rgba(0,0,0,.2);
  z-index: 99;
}

@media (max-width: 1100px) {
  .seat-grid {
    grid-template-columns: repeat(7, minmax(54px, 1fr));
  }
}

@media (max-width: 760px) {
  .page-header,
  .tracking-top {
    flex-direction: column;
  }

  .date-controls,
  .summary {
    justify-content: flex-start;
  }

  .seat-grid {
    grid-template-columns: repeat(4, minmax(54px, 1fr));
  }
}
</style>
