<script setup>
import { computed, reactive, ref } from 'vue'

const homeworkOptions = [
  '聯絡簿', '甲本', '乙本', '國習', '數習', '社習',
  '國作', '數作', '社作', '作文', '學習單', '回條', '考卷', '自訂'
]

const subjects = ['國語', '數學', '社會', '自然', '英語']

const students = computed(() => {
  const text = localStorage.getItem('students') || ''
  return text
    .split('\n')
    .map(name => name.trim())
    .filter(Boolean)
})

const className = computed(() => localStorage.getItem('className') || '三年○班')

const boards = reactive(Array.from({ length: 4 }, (_, index) => ({
  id: index,
  title: index === 0 ? '國習' : '聯絡簿',
  customTitle: '',
  subject: '國語',
  round: '',
  statuses: {},
  sparkle: {}
})))

const displayCount = ref(4)
const toast = ref('')
const reminderText = ref('')
const isReminderOpen = ref(false)
const isClearOpen = ref(false)
const clearTarget = ref(null)
const clearConfirm = ref(false)

const visibleBoards = computed(() => boards.slice(0, displayCount.value))

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

function setAll(board, status) {
  students.value.forEach((_, index) => {
    board.statuses[index] = status
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

  board.statuses[index] = next

  if (next === 'ok') {
    playRewardSound()
    showReward(board, index)
  }

  checkAllDone(board)
}

function showReward(board, index) {
  board.sparkle[index] = true
  showToast(`🌟 ${index + 1}號完成了！`)

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
    ? `❌ 缺交\n${missingList.map(item => `${item.number}號 ${item.name}`).join('\n')}`
    : ''

  const fixText = fixList.length
    ? `⚠️ 需訂正\n${fixList.map(item => `${item.number}號 ${item.name}`).join('\n')}`
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
</script>

<template>
  <div class="page notebook-page">
    <div class="page-header">
      <div>
        <h2>📚 簿本繳交</h2>
        <p>用座號格子快速追蹤 OK、需訂正、缺交。</p>
      </div>

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

    <div v-if="students.length === 0" class="card empty-card">
      <h3>尚未建立學生名單</h3>
      <p>請先到「學生管理」貼上學生名單。</p>
    </div>

    <div
      v-else
      class="notebook-grid"
      :class="`view-${displayCount}`"
    >
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

        <div class="seat-grid">
          <button
            v-for="(student, index) in students"
            :key="student + index"
            class="seat"
            :class="statusClass(board.statuses[index])"
            @click="toggleStatus(board, index)"
            :title="`${index + 1}號 ${student}`"
          >
            <strong>{{ index + 1 }}</strong>
            <span>{{ statusIcon(board.statuses[index]) }}</span>
            <em v-if="board.sparkle[index]">✨</em>
          </button>
        </div>
      </section>
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
  margin-bottom: 18px;
}

.page-header h2 {
  margin-bottom: 8px;
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

.notebook-grid {
  display: grid;
  gap: 18px;
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
  padding: 18px;
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
  margin-bottom: 12px;
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

.missing-btn { background: #f35f64; }
.fix-btn { background: #f4bd28; color: #333; }
.ok-btn { background: #45c96b; }
.copy-btn { background: #ff8a3d; }
.copy-btn.done { background: #45c96b; }
.clear-btn { background: #9ca3af; }

.seat-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.view-1 .seat-grid {
  grid-template-columns: repeat(8, minmax(0, 1fr));
}

.view-4 .seat-grid {
  gap: 5px;
  margin-top: 8px;
}

.seat {
  min-height: 68px;
  background: #f2f4f7;
  color: #374151;
  border: 2px solid #dde2ea;
  border-radius: 16px;
  display: grid;
  place-items: center;
  position: relative;
  padding: 6px;
}

.view-1 .seat {
  min-height: 76px;
}

.view-4 .seat {
  min-height: 48px;
  border-radius: 12px;
  padding: 3px;
}

.seat strong {
  font-size: 24px;
}

.seat span {
  font-size: 20px;
}

.view-4 .seat strong {
  font-size: 18px;
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
  background: rgba(30, 41, 59, .35);
  display: grid;
  place-items: center;
  z-index: 120;
  padding: 24px;
}

.reminder-modal {
  width: min(680px, 92vw);
  max-height: 82vh;
  overflow: auto;
  background: #fffdf8;
  border-radius: 24px;
  padding: 22px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, .25);
  border: 3px solid #f1d9b8;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.modal-header h3 {
  margin: 0;
}

.close-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #f2f4f7;
  color: #334155;
}

.reminder-modal pre {
  white-space: pre-wrap;
  background: #fff7dc;
  border: 2px dashed #e8a94b;
  border-radius: 18px;
  padding: 18px;
  font-size: 17px;
  line-height: 1.75;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.copy-again-btn {
  background: #ff8a3d;
}

.ok-close-btn {
  background: #6bbf95;
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

@media (max-width: 1100px) {
  .notebook-grid.view-2,
  .notebook-grid.view-4 {
    grid-template-columns: 1fr;
  }

  .seat-grid,
  .view-1 .seat-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .page-header {
    display: block;
  }

  .display-switch {
    margin-top: 12px;
    overflow-x: auto;
  }

  .seat-grid,
  .view-1 .seat-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
