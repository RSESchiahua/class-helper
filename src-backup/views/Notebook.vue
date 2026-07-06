<script setup>
import { computed, reactive, ref, watch } from 'vue'

const homeworkOptions = [
  '聯絡簿', '甲本', '乙本', '國習', '數習', '社習',
  '國作', '數作', '社作', '作文', '學習單', '回條', '考卷', '自訂'
]

const subjects = ['國語', '數學', '社會', '自然', '英語']

const STORAGE_KEY = 'notebookBoardsV2'
const WEEKLY_KEY = 'notebookWeeklyRecordsV2'
const NOTIFIED_KEY = 'notebookNotifiedV2'

const students = computed(() => {
  const text = localStorage.getItem('students') || ''
  return text
    .split('\n')
    .map(name => name.trim())
    .filter(Boolean)
})

const className = computed(() => localStorage.getItem('className') || '三年○班')

function createDefaultBoards() {
  return Array.from({ length: 4 }, (_, index) => ({
    id: index,
    title: index === 0 ? '國習' : '聯絡簿',
    customTitle: '',
    subject: '國語',
    round: '',
    statuses: {},
    sparkle: {}
  }))
}

function loadBoards() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(saved) && saved.length) {
      return createDefaultBoards().map((board, index) => ({
        ...board,
        ...(saved[index] || {}),
        sparkle: {}
      }))
    }
  } catch (error) {
    console.warn('簿本資料讀取失敗：', error)
  }
  return createDefaultBoards()
}

const boards = reactive(loadBoards())
const displayCount = ref(4)
const toast = ref('')
const reminderText = ref('')
const isReminderOpen = ref(false)
const isClearOpen = ref(false)
const clearTarget = ref(null)
const clearConfirm = ref(false)
const isWeeklyOpen = ref(false)
const selectedWeeklyStudent = ref(null)

const weeklyRecords = ref(loadJson(WEEKLY_KEY, []))
const notifiedMap = ref(loadJson(NOTIFIED_KEY, {}))

const visibleBoards = computed(() => boards.slice(0, displayCount.value))

watch(
  boards,
  () => {
    const clean = boards.map(board => ({
      id: board.id,
      title: board.title,
      customTitle: board.customTitle,
      subject: board.subject,
      round: board.round,
      statuses: board.statuses
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
  },
  { deep: true }
)

watch(weeklyRecords, () => {
  localStorage.setItem(WEEKLY_KEY, JSON.stringify(weeklyRecords.value))
}, { deep: true })

watch(notifiedMap, () => {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notifiedMap.value))
}, { deep: true })

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || fallback
  } catch {
    return fallback
  }
}

function showToast(message, duration = 1600) {
  toast.value = message
  setTimeout(() => {
    if (toast.value === message) toast.value = ''
  }, duration)
}

function playRewardSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    const audio = new AudioContextClass()
    const osc = audio.createOscillator()
    const gain = audio.createGain()

    osc.connect(gain)
    gain.connect(audio.destination)

    osc.frequency.setValueAtTime(660, audio.currentTime)
    osc.frequency.setValueAtTime(880, audio.currentTime + 0.08)

    gain.gain.setValueAtTime(0.08, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25)

    osc.start()
    osc.stop(audio.currentTime + 0.25)
  } catch (error) {
    console.warn('音效播放失敗：', error)
  }
}

function getTitle(board) {
  if (board.title === '自訂') return board.customTitle || '自訂作業'
  if (board.title === '考卷') {
    return `${board.subject}考卷${board.round ? `第${board.round}回` : ''}`
  }
  return board.title
}

function studentLabel(index) {
  const name = students.value[index] || `學生${index + 1}`
  return `${name}（${String(index + 1).padStart(2, '0')}）`
}

function todayKey() {
  const date = new Date()
  return toDateKey(date)
}

function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getWeekStart(date = new Date()) {
  const copy = new Date(date)
  const day = copy.getDay() || 7
  copy.setDate(copy.getDate() - day + 1)
  copy.setHours(0, 0, 0, 0)
  return toDateKey(copy)
}

const currentWeekStart = computed(() => getWeekStart())

function setAll(board, status) {
  students.value.forEach((_, index) => {
    updateStudentStatus(board, index, status)
  })

  if (status === 'ok') {
    checkAllDone(board)
  }
}

function toggleStatus(board, index) {
  const current = board.statuses[index] || 'none'
  const nextMap = {
    none: 'missing',
    missing: 'fix',
    fix: 'ok',
    ok: 'none'
  }
  const next = nextMap[current]

  updateStudentStatus(board, index, next, current)

  if (next === 'ok') {
    playRewardSound()
    showReward(board, index)
  }

  checkAllDone(board)
}

function updateStudentStatus(board, index, next, previous = board.statuses[index] || 'none') {
  board.statuses[index] = next

  if (previous === 'missing' || previous === 'fix') {
    resolveWeeklyRecord(board, index, previous)
  }

  if (next === 'missing' || next === 'fix') {
    addWeeklyRecord(board, index, next)
  }
}

function addWeeklyRecord(board, index, status) {
  const title = getTitle(board)
  const recordKey = `${currentWeekStart.value}|${todayKey()}|${board.id}|${title}|${index}|${status}`
  const exists = weeklyRecords.value.some(record => record.key === recordKey)
  if (exists) return

  weeklyRecords.value.push({
    key: recordKey,
    weekStart: currentWeekStart.value,
    date: todayKey(),
    boardId: board.id,
    title,
    studentIndex: index,
    studentName: students.value[index] || '',
    status,
    resolved: false,
    notified: false,
    createdAt: new Date().toISOString()
  })
}

function resolveWeeklyRecord(board, index, status) {
  const title = getTitle(board)
  weeklyRecords.value.forEach(record => {
    if (
      record.weekStart === currentWeekStart.value &&
      record.boardId === board.id &&
      record.title === title &&
      record.studentIndex === index &&
      record.status === status &&
      !record.resolved
    ) {
      record.resolved = true
      record.resolvedAt = new Date().toISOString()
    }
  })
}

function showReward(board, index) {
  board.sparkle[index] = true
  showToast(`🌟 ${studentLabel(index)} 完成了！`)

  setTimeout(() => {
    board.sparkle[index] = false
  }, 1000)
}

function isAllOk(board) {
  return students.value.length > 0 && students.value.every((_, index) => board.statuses[index] === 'ok')
}

function checkAllDone(board) {
  if (!students.value.length) return

  if (isAllOk(board)) {
    showToast(`🎉 ${getTitle(board)} 全班完成！`, 2200)
    playRewardSound()
  }
}

function statusIcon(status) {
  if (status === 'ok') return '✅'
  if (status === 'fix') return '⚠️'
  if (status === 'missing') return '❌'
  return '－'
}

function statusText(status) {
  if (status === 'ok') return 'OK'
  if (status === 'fix') return '需訂正'
  if (status === 'missing') return '缺交'
  return '未設定'
}

function statusClass(status) {
  return {
    ok: status === 'ok',
    fix: status === 'fix',
    missing: status === 'missing'
  }
}

function getReminderItems(board, status) {
  return students.value
    .map((name, index) => ({
      name,
      number: index + 1,
      label: studentLabel(index),
      status: board.statuses[index]
    }))
    .filter(item => item.status === status)
}

function reminderCount(board) {
  return getReminderItems(board, 'fix').length + getReminderItems(board, 'missing').length
}

function reminderButtonText(board) {
  if (isAllOk(board)) return '✅ 全數完成'
  const count = reminderCount(board)
  return count === 0 ? '✅ 無需催繳' : `📋 LINE催繳（${count}）`
}

function boardStats(board) {
  return {
    ok: students.value.filter((_, index) => board.statuses[index] === 'ok').length,
    fix: students.value.filter((_, index) => board.statuses[index] === 'fix').length,
    missing: students.value.filter((_, index) => board.statuses[index] === 'missing').length,
    none: students.value.filter((_, index) => !board.statuses[index] || board.statuses[index] === 'none').length
  }
}

function openClearDialog(board) {
  clearTarget.value = board
  clearConfirm.value = false
  isClearOpen.value = true
}

function closeClearDialog() {
  isClearOpen.value = false
  clearConfirm.value = false
  clearTarget.value = null
}

function clearBoardRecords() {
  if (!clearTarget.value || !clearConfirm.value) return

  clearTarget.value.statuses = {}
  clearTarget.value.sparkle = {}

  showToast(`🧹 已清除「${getTitle(clearTarget.value)}」紀錄`)
  closeClearDialog()
}

function makeReminder(board) {
  const title = getTitle(board)
  const fixList = getReminderItems(board, 'fix')
  const missingList = getReminderItems(board, 'missing')
  const total = fixList.length + missingList.length

  if (total === 0) {
    showToast('🟢 沒有需要催繳的學生！')
    return
  }

  const missingText = missingList.length
    ? `❌ 缺交\n${missingList.map(item => item.label).join('\n')}`
    : ''

  const fixText = fixList.length
    ? `⚠️ 需訂正\n${fixList.map(item => item.label).join('\n')}`
    : ''

  reminderText.value =
`【${className.value} 簿本提醒】

家長您好：

今日「${title}」尚未完成如下
${[missingText, fixText].filter(Boolean).join('\n\n')}

麻煩協助提醒孩子完成訂正或補交。
謝謝您的配合！`

  copyReminder()
  isReminderOpen.value = true
  showToast(`📋 已建立催繳訊息（${total}人）`)
}

function copyReminder() {
  navigator.clipboard?.writeText(reminderText.value)
  showToast('📋 已複製，可直接貼到 LINE')
}

const activeWeeklyRecords = computed(() => {
  return weeklyRecords.value.filter(record => record.weekStart === currentWeekStart.value && !record.resolved)
})

const weeklySummary = computed(() => {
  return students.value.map((name, index) => {
    const records = activeWeeklyRecords.value.filter(record => record.studentIndex === index)
    const missing = records.filter(record => record.status === 'missing')
    const fix = records.filter(record => record.status === 'fix')
    return {
      index,
      name,
      label: studentLabel(index),
      missingCount: missing.length,
      fixCount: fix.length,
      total: missing.length + fix.length,
      missing,
      fix,
      records,
      notified: Boolean(notifiedMap.value[`${currentWeekStart.value}-${index}`])
    }
  })
})

const studentsNeedNotify = computed(() => weeklySummary.value.filter(item => item.total > 0))
const zeroProblemStudents = computed(() => weeklySummary.value.filter(item => item.total === 0))
const topProblemStudents = computed(() => [...studentsNeedNotify.value].sort((a, b) => b.total - a.total).slice(0, 5))

const selectedWeekly = computed(() => {
  if (selectedWeeklyStudent.value === null) return studentsNeedNotify.value[0] || null
  return weeklySummary.value.find(item => item.index === selectedWeeklyStudent.value) || null
})

function openWeeklyPanel() {
  selectedWeeklyStudent.value = studentsNeedNotify.value[0]?.index ?? null
  isWeeklyOpen.value = true
}

function weeklyMessage(item = selectedWeekly.value) {
  if (!item) return ''

  const missingLines = item.missing.length
    ? `❌ 缺交（${item.missing.length}次）\n${item.missing.map(record => `・${formatDate(record.date)} ${record.title}`).join('\n')}`
    : ''

  const fixLines = item.fix.length
    ? `⚠️ 未訂正（${item.fix.length}次）\n${item.fix.map(record => `・${formatDate(record.date)} ${record.title}`).join('\n')}`
    : ''

  return `家長您好：

這裡是${className.value}本週簿本提醒。

${item.name}本週目前尚有：
${[missingLines, fixLines].filter(Boolean).join('\n\n')}

麻煩您協助提醒孩子完成補交與訂正，讓孩子養成每日整理簿本的好習慣。
謝謝您的配合！`
}

function copyWeeklyMessage(item = selectedWeekly.value) {
  if (!item) return
  const text = weeklyMessage(item)
  navigator.clipboard?.writeText(text)
  showToast(`📋 已複製 ${item.label} 的家長訊息`)
}

function copyAllWeeklyMessages() {
  const text = studentsNeedNotify.value
    .map(item => `【${item.label}】\n${weeklyMessage(item)}`)
    .join('\n\n--------------------\n\n')

  if (!text) {
    showToast('本週沒有需要通知的學生')
    return
  }

  navigator.clipboard?.writeText(text)
  showToast('📋 已複製本週全部通知')
}

function toggleNotified(item) {
  const key = `${currentWeekStart.value}-${item.index}`
  if (notifiedMap.value[key]) {
    delete notifiedMap.value[key]
  } else {
    notifiedMap.value[key] = new Date().toISOString()
  }
}

function resetWeeklyRecords() {
  const ok = window.confirm('確定要清除本週簿本通知紀錄嗎？這不會清除目前四項簿本狀態。')
  if (!ok) return
  weeklyRecords.value = weeklyRecords.value.filter(record => record.weekStart !== currentWeekStart.value)
  Object.keys(notifiedMap.value).forEach(key => {
    if (key.startsWith(currentWeekStart.value)) delete notifiedMap.value[key]
  })
  showToast('🧹 已清除本週通知紀錄')
}

function formatDate(dateText) {
  const [, month, day] = dateText.split('-')
  return `${Number(month)}/${Number(day)}`
}
</script>

<template>
  <div class="page notebook-page">
    <div class="page-header">
      <div>
        <h2>📚 簿本繳交</h2>
        <p>用學生姓名快速追蹤 OK、需訂正、缺交，並累計本週家長通知。</p>
      </div>

      <div class="header-actions">
        <button class="weekly-btn" @click="openWeeklyPanel">
          📩 本週通知（{{ studentsNeedNotify.length }}）
        </button>
        <div class="display-switch">
          <span>顯示：</span>
          <button
            v-for="count in [1, 2, 4]"
            :key="count"
            :class="{ active: displayCount === count }"
            @click="displayCount = count"
          >
            {{ count }}項
          </button>
        </div>
      </div>
    </div>

    <div v-if="students.length === 0" class="card empty-card">
      <h3>尚未建立學生名單</h3>
      <p>請先到「學生管理」貼上學生名單。</p>
    </div>

    <div v-else class="layout-grid">
      <aside class="weekly-overview">
        <div class="overview-card highlight">
          <span>本週需通知</span>
          <strong>{{ studentsNeedNotify.length }}</strong>
          <small>位學生</small>
        </div>
        <div class="overview-card">
          <span>未完成總次數</span>
          <strong>{{ activeWeeklyRecords.length }}</strong>
          <small>缺交＋未訂正</small>
        </div>
        <div class="overview-list">
          <h3>📊 本週關注</h3>
          <p v-if="topProblemStudents.length === 0">本週目前很穩定，沒有需要通知的學生。</p>
          <button
            v-for="item in topProblemStudents"
            :key="item.index"
            class="rank-row"
            @click="selectedWeeklyStudent = item.index; isWeeklyOpen = true"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.total }}次</strong>
          </button>
        </div>
        <div class="overview-list zero-list">
          <h3>🌟 零缺交未訂正</h3>
          <p v-if="zeroProblemStudents.length === 0">目前沒有零紀錄名單。</p>
          <div class="zero-tags">
            <span v-for="item in zeroProblemStudents.slice(0, 12)" :key="item.index">
              {{ item.name }}
            </span>
          </div>
          <small v-if="zeroProblemStudents.length > 12">還有 {{ zeroProblemStudents.length - 12 }} 位</small>
        </div>
      </aside>

      <div class="notebook-main">
        <div class="notebook-grid" :class="`view-${displayCount}`">
          <section
            v-for="board in visibleBoards"
            :key="board.id"
            class="notebook-card"
          >
            <div class="board-toolbar">
              <select v-model="board.title">
                <option v-for="option in homeworkOptions" :key="option">
                  {{ option }}
                </option>
              </select>

              <button class="missing-btn" @click="setAll(board, 'missing')">❌ 全缺</button>
              <button class="fix-btn" @click="setAll(board, 'fix')">⚠️ 全訂正</button>
              <button class="ok-btn" @click="setAll(board, 'ok')">✅ 全OK</button>
              <button
                class="copy-btn"
                :class="{ done: reminderCount(board) === 0 }"
                @click="makeReminder(board)"
              >
                {{ reminderButtonText(board) }}
              </button>
              <button class="clear-btn" @click="openClearDialog(board)">🧹 新紀錄</button>
            </div>

            <div v-if="board.title === '考卷'" class="exam-row">
              <select v-model="board.subject">
                <option v-for="subject in subjects" :key="subject">
                  {{ subject }}
                </option>
              </select>
              <input v-model="board.round" placeholder="回次，例如：2" />
            </div>

            <input
              v-if="board.title === '自訂'"
              v-model="board.customTitle"
              placeholder="請輸入作業名稱，例如：閱讀單、自然習作"
            />

            <div class="board-title-line">
              <strong>{{ getTitle(board) }}</strong>
              <span>點擊順序：－ → ❌ → ⚠️ → ✅</span>
            </div>

            <div class="seat-grid">
              <button
                v-for="(student, index) in students"
                :key="student + index"
                class="seat"
                :class="statusClass(board.statuses[index])"
                @click="toggleStatus(board, index)"
                :title="`${studentLabel(index)}：${statusText(board.statuses[index])}`"
              >
                <strong>{{ student }}</strong>
                <small>{{ String(index + 1).padStart(2, '0') }}</small>
                <span>{{ statusIcon(board.statuses[index]) }}</span>
                <em v-if="board.sparkle[index]">✨</em>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div v-if="isReminderOpen" class="modal-backdrop" @click.self="isReminderOpen = false">
      <div class="reminder-modal">
        <div class="modal-header">
          <h3>📋 催繳訊息</h3>
          <button class="close-btn" @click="isReminderOpen = false">✕</button>
        </div>

        <pre>{{ reminderText }}</pre>

        <div class="modal-actions">
          <button class="copy-again-btn" @click="copyReminder">再複製一次</button>
          <button class="ok-close-btn" @click="isReminderOpen = false">關閉</button>
        </div>
      </div>
    </div>

    <div v-if="isWeeklyOpen" class="modal-backdrop" @click.self="isWeeklyOpen = false">
      <div class="weekly-modal">
        <div class="modal-header">
          <div>
            <h3>📩 本週家長通知中心</h3>
            <p>週起始：{{ currentWeekStart }}｜先複製 LINE 訊息，不自動發送。</p>
          </div>
          <button class="close-btn" @click="isWeeklyOpen = false">✕</button>
        </div>

        <div class="weekly-modal-grid">
          <div class="student-summary-list">
            <button
              v-for="item in studentsNeedNotify"
              :key="item.index"
              class="summary-student"
              :class="{ active: selectedWeekly?.index === item.index, notified: item.notified }"
              @click="selectedWeeklyStudent = item.index"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.total }}次</strong>
              <small>{{ item.notified ? '已通知' : '未通知' }}</small>
            </button>
            <p v-if="studentsNeedNotify.length === 0" class="empty-weekly">本週目前沒有需要通知的學生。</p>
          </div>

          <div class="weekly-message-panel">
            <template v-if="selectedWeekly">
              <div class="selected-student-header">
                <h4>{{ selectedWeekly.label }}</h4>
                <button
                  class="notified-toggle"
                  :class="{ done: selectedWeekly.notified }"
                  @click="toggleNotified(selectedWeekly)"
                >
                  {{ selectedWeekly.notified ? '✅ 已通知' : '□ 標記已通知' }}
                </button>
              </div>

              <div class="detail-columns">
                <div>
                  <h5>❌ 缺交</h5>
                  <p v-if="selectedWeekly.missing.length === 0">無</p>
                  <ul>
                    <li v-for="record in selectedWeekly.missing" :key="record.key">
                      {{ formatDate(record.date) }}｜{{ record.title }}
                    </li>
                  </ul>
                </div>
                <div>
                  <h5>⚠️ 未訂正</h5>
                  <p v-if="selectedWeekly.fix.length === 0">無</p>
                  <ul>
                    <li v-for="record in selectedWeekly.fix" :key="record.key">
                      {{ formatDate(record.date) }}｜{{ record.title }}
                    </li>
                  </ul>
                </div>
              </div>

              <pre>{{ weeklyMessage(selectedWeekly) }}</pre>

              <div class="modal-actions">
                <button class="copy-again-btn" @click="copyWeeklyMessage(selectedWeekly)">複製此生訊息</button>
                <button class="copy-all-btn" @click="copyAllWeeklyMessages">複製全部通知</button>
                <button class="clear-btn" @click="resetWeeklyRecords">清除本週紀錄</button>
              </div>
            </template>
            <template v-else>
              <div class="empty-weekly-large">🎉 本週沒有需要通知的孩子。</div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isClearOpen && clearTarget" class="modal-backdrop" @click.self="closeClearDialog">
      <div class="reminder-modal clear-modal">
        <div class="modal-header">
          <h3>🧹 開始新的紀錄</h3>
          <button class="close-btn" @click="closeClearDialog">✕</button>
        </div>

        <p class="clear-warning">
          確定要清除「<strong>{{ getTitle(clearTarget) }}</strong>」的學生狀態嗎？
          <br>
          作業名稱會保留，只會清除這一項作業的 OK／需訂正／缺交紀錄。
        </p>

        <div class="clear-stats">
          <div>✅ OK：{{ boardStats(clearTarget).ok }} 位</div>
          <div>⚠️ 需訂正：{{ boardStats(clearTarget).fix }} 位</div>
          <div>❌ 缺交：{{ boardStats(clearTarget).missing }} 位</div>
          <div>－ 未設定：{{ boardStats(clearTarget).none }} 位</div>
        </div>

        <label class="confirm-check">
          <input type="checkbox" v-model="clearConfirm">
          我確認要清除這項作業紀錄
        </label>

        <div class="modal-actions">
          <button class="ok-close-btn" @click="closeClearDialog">取消</button>
          <button
            class="danger-confirm-btn"
            :disabled="!clearConfirm"
            @click="clearBoardRecords"
          >
            確認清除
          </button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="toast">
      {{ toast }}
    </div>
  </div>
</template>

<style scoped>
.notebook-page {
  max-width: none;
  margin: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.page-header h2 {
  margin-bottom: 8px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.weekly-btn {
  background: linear-gradient(135deg, #ff8a3d, #f4bd28);
  color: white;
  font-weight: 900;
  box-shadow: 0 8px 18px rgba(255, 138, 61, .25);
}

.display-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, .7);
  padding: 10px;
  border-radius: 18px;
}

.display-switch span {
  font-weight: 800;
  white-space: nowrap;
}

.display-switch button {
  background: #f4fbf7;
  color: #2f6f57;
  border: 2px solid #dff3ea;
  padding: 10px 14px;
  border-radius: 14px;
}

.display-switch button.active {
  background: #6bbf95;
  color: white;
}

.empty-card {
  max-width: 600px;
}

.layout-grid {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.weekly-overview {
  display: grid;
  gap: 12px;
  position: sticky;
  top: 12px;
}

.overview-card,
.overview-list {
  background: white;
  border-radius: 22px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .08);
}

.overview-card {
  display: grid;
  gap: 3px;
}

.overview-card span,
.overview-card small {
  color: #64748b;
  font-weight: 800;
}

.overview-card strong {
  font-size: 42px;
  line-height: 1;
  color: #2f6f57;
}

.overview-card.highlight {
  background: #fff7dc;
  border: 2px solid #f1d9b8;
}

.overview-list h3 {
  margin: 0 0 10px;
  font-size: 18px;
}

.overview-list p {
  color: #64748b;
  line-height: 1.6;
  margin: 0;
}

.rank-row {
  width: 100%;
  background: #f8fafc;
  color: #334155;
  border: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 10px;
  border-radius: 14px;
}

.zero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.zero-tags span {
  background: #e9faef;
  color: #1f8f48;
  border-radius: 999px;
  padding: 6px 10px;
  font-weight: 800;
  font-size: 13px;
}

.notebook-grid {
  display: grid;
  gap: 16px;
}

.notebook-grid.view-1 {
  grid-template-columns: minmax(0, 1fr);
}

.notebook-grid.view-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.notebook-grid.view-4 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.notebook-card {
  background: white;
  border-radius: 24px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .08);
  min-width: 0;
}

.view-4 .notebook-card {
  padding: 12px;
  border-radius: 18px;
}

.board-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 10px;
}

.board-toolbar select {
  min-width: 104px;
  flex: 1 1 100px;
}

select,
input {
  border: 2px solid #f1d9b8;
  border-radius: 14px;
  padding: 10px;
  font-size: 15px;
  min-width: 0;
}

.board-toolbar button {
  padding: 10px 12px;
  font-size: 14px;
  white-space: nowrap;
}

.view-4 .board-toolbar {
  gap: 6px;
  margin-bottom: 8px;
}

.view-4 .board-toolbar button,
.view-4 .board-toolbar select,
.view-4 input {
  padding: 7px 8px;
  font-size: 13px;
  border-radius: 12px;
}

.exam-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.board-title-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  color: #64748b;
  margin: 6px 0 10px;
  font-size: 13px;
}

.board-title-line strong {
  font-size: 18px;
  color: #334155;
}

.missing-btn { background: #f35f64; }
.fix-btn { background: #f4bd28; color: #333; }
.ok-btn { background: #45c96b; }
.copy-btn { background: #ff8a3d; }
.copy-btn.done { background: #45c96b; }
.clear-btn { background: #9ca3af; }
.copy-all-btn { background: #8b7cf6; }

.seat-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 9px;
  margin-top: 10px;
}

.view-1 .seat-grid {
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.view-4 .seat-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
  margin-top: 8px;
}

.seat {
  min-height: 78px;
  background: #f2f4f7;
  color: #374151;
  border: 2px solid #dde2ea;
  border-radius: 16px;
  display: grid;
  grid-template-rows: auto auto auto;
  place-items: center;
  position: relative;
  padding: 6px 4px;
}

.view-1 .seat {
  min-height: 86px;
}

.view-4 .seat {
  min-height: 58px;
  border-radius: 12px;
  padding: 3px;
}

.seat strong {
  font-size: 18px;
  line-height: 1.1;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.seat small {
  font-size: 12px;
  opacity: .75;
  font-weight: 800;
}

.seat span {
  font-size: 22px;
}

.view-4 .seat strong {
  font-size: 13px;
}

.view-4 .seat small {
  font-size: 10px;
}

.view-4 .seat span {
  font-size: 15px;
}

.seat em {
  position: absolute;
  right: 6px;
  top: 4px;
  font-style: normal;
  animation: pop .8s ease;
}

.seat.ok {
  background: #e9faef;
  border-color: #8ce0a4;
  color: #1f8f48;
}

.seat.fix {
  background: #fff7dc;
  border-color: #f4d56d;
  color: #d37a00;
}

.seat.missing {
  background: #ffe8e8;
  border-color: #ff9a9a;
  color: #c62828;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, .62);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  z-index: 120;
  padding: 24px;
}

.reminder-modal,
.weekly-modal {
  width: min(960px, 94vw);
  max-height: 88vh;
  overflow: auto;
  background: linear-gradient(180deg, #fffdf8 0%, #fff7ed 100%);
  border-radius: 28px;
  padding: 24px;
  box-shadow: 0 28px 80px rgba(15, 23, 42, .45);
  border: 4px solid #ffffff;
  outline: 3px solid #f1d9b8;
  color: #1f2937;
}

.reminder-modal {
  width: min(700px, 92vw);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  background: #ffffff;
  border: 2px solid #f1d9b8;
  border-radius: 20px;
  padding: 14px 16px;
  margin-bottom: 16px;
  box-shadow: 0 8px 24px rgba(100, 116, 139, .12);
}

.modal-header h3 {
  margin: 0;
  color: #1e293b;
  font-size: 26px;
  font-weight: 950;
}

.modal-header p {
  margin: 6px 0 0;
  color: #475569;
  font-weight: 700;
}

.close-btn {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #f1f5f9;
  color: #334155;
  border: 2px solid #d9e2ec;
  font-size: 22px;
  font-weight: 950;
}

.reminder-modal pre,
.weekly-message-panel pre {
  white-space: pre-wrap;
  background: #fffbeb;
  border: 3px dashed #f59e0b;
  border-radius: 20px;
  padding: 18px;
  font-size: 17px;
  line-height: 1.8;
  color: #1f2937;
  font-weight: 750;
}

.weekly-modal-grid {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 18px;
  margin-top: 16px;
}

.student-summary-list {
  background: #ffffff;
  border: 2px solid #e2e8f0;
  border-radius: 22px;
  padding: 14px;
  max-height: 62vh;
  overflow: auto;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.7), 0 10px 24px rgba(100,116,139,.12);
}

.summary-student {
  width: 100%;
  background: #f8fafc;
  color: #334155;
  border: 2px solid #cbd5e1;
  border-radius: 16px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 3px 8px;
  text-align: left;
  margin-bottom: 10px;
  padding: 12px 14px;
  font-size: 16px;
  font-weight: 900;
}

.summary-student small {
  grid-column: 1 / 3;
  color: #64748b;
}

.summary-student.active {
  border-color: #22c55e;
  background: #dcfce7;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, .18);
}

.summary-student.notified {
  opacity: .68;
}

.weekly-message-panel {
  background: #ffffff;
  border: 2px solid #e2e8f0;
  border-radius: 22px;
  padding: 18px;
  box-shadow: 0 10px 24px rgba(100, 116, 139, .12);
}

.selected-student-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.selected-student-header h4 {
  margin: 0;
  font-size: 26px;
}

.notified-toggle {
  background: #f4bd28;
  color: #334155;
}

.notified-toggle.done {
  background: #45c96b;
  color: white;
}

.detail-columns {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin: 14px 0;
}

.detail-columns > div {
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 18px;
  padding: 16px;
  color: #1f2937;
}

.detail-columns h5 {
  margin: 0 0 8px;
  font-size: 17px;
}

.detail-columns ul {
  margin: 0;
  padding-left: 18px;
  line-height: 1.8;
}

.empty-weekly,
.empty-weekly-large {
  color: #64748b;
  line-height: 1.7;
}

.empty-weekly-large {
  background: #e9faef;
  border-radius: 18px;
  padding: 28px;
  font-size: 24px;
  font-weight: 900;
  text-align: center;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.copy-again-btn {
  background: #ff8a3d;
  color: white;
  box-shadow: 0 8px 18px rgba(255, 138, 61, .28);
}

.copy-all-btn {
  background: #22c55e;
  color: white;
  box-shadow: 0 8px 18px rgba(34, 197, 94, .24);
}

.ok-close-btn {
  background: #6bbf95;
  color: white;
}

.clear-warning {
  background: #fff7dc;
  border: 2px solid #f1d9b8;
  border-radius: 16px;
  padding: 14px;
  line-height: 1.7;
}

.clear-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin: 16px 0;
}

.clear-stats div {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px;
  font-weight: 800;
}

.confirm-check {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 16px 0;
  font-weight: 800;
}

.confirm-check input {
  width: 22px;
  height: 22px;
}

.danger-confirm-btn {
  background: #e9897e;
}

.danger-confirm-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

.toast {
  position: fixed;
  right: 28px;
  bottom: 28px;
  background: #2f6f57;
  color: white;
  padding: 18px 24px;
  border-radius: 20px;
  font-size: 22px;
  font-weight: 800;
  box-shadow: 0 10px 30px rgba(0,0,0,.2);
  z-index: 150;
}

@keyframes pop {
  0% { transform: scale(.3); opacity: 0; }
  50% { transform: scale(1.4); opacity: 1; }
  100% { transform: scale(1); opacity: 0; }
}

@media (max-width: 1200px) {
  .layout-grid {
    grid-template-columns: 1fr;
  }

  .weekly-overview {
    position: static;
    grid-template-columns: repeat(2, 1fr);
  }

  .zero-list {
    grid-column: 1 / 3;
  }
}

@media (max-width: 1100px) {
  .notebook-grid.view-2,
  .notebook-grid.view-4 {
    grid-template-columns: 1fr;
  }

  .seat-grid,
  .view-1 .seat-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .page-header {
    display: block;
  }

  .header-actions {
    justify-content: flex-start;
  }

  .display-switch {
    margin-top: 12px;
    overflow-x: auto;
  }

  .weekly-overview {
    grid-template-columns: 1fr;
  }

  .zero-list {
    grid-column: auto;
  }

  .seat-grid,
  .view-1 .seat-grid,
  .view-4 .seat-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .weekly-modal-grid,
  .detail-columns {
    grid-template-columns: 1fr;
  }
}
</style>
