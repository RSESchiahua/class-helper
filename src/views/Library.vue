<script setup>
// ✅ HUA_LIBRARY_IOS_DATE_FIT_20260712：修正 iPhone Safari 借閱日期欄超出卡片寬度。
import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'classHelperLibraryLoans'
const HISTORY_KEY = 'classHelperLibraryHistory'

const today = new Date().toISOString().slice(0, 10)

const bookTitle = ref('')
const borrower = ref('')
const borrowDate = ref(today)
const searchText = ref('')
const toast = ref('')
const reminderText = ref('')
const duplicateLoan = ref(null)

const loans = ref(loadJson(STORAGE_KEY, []))
const history = ref(loadJson(HISTORY_KEY, []))

const students = computed(() => {
  const text = localStorage.getItem('students') || ''
  return text
    .split('\n')
    .map(name => name.trim())
    .filter(Boolean)
})

watch(loans, value => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}, { deep: true })

watch(history, value => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(value))
}, { deep: true })

const filteredLoans = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) return loans.value

  return loans.value.filter(item => {
    return item.bookTitle.toLowerCase().includes(keyword) ||
      item.borrower.toLowerCase().includes(keyword)
  })
})

const overdueLoans = computed(() => {
  return loans.value.filter(item => getBorrowDays(item.borrowDate) >= 7)
})

const todayBorrowCount = computed(() => loans.value.filter(item => item.borrowDate === today).length)
const todayReturnCount = computed(() => history.value.filter(item => item.returnDate === today).length)

function loadJson(key, defaultValue) {
  try {
    return JSON.parse(localStorage.getItem(key)) || defaultValue
  } catch {
    return defaultValue
  }
}

function normalizeBookName(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function addLoan() {
  const title = bookTitle.value.trim()

  if (!title) {
    showToast('請先輸入書名')
    return
  }

  if (!borrower.value) {
    showToast('請先選擇借閱人')
    return
  }

  const existing = loans.value.find(item => normalizeBookName(item.bookTitle) === normalizeBookName(title))

  if (existing) {
    duplicateLoan.value = existing
    return
  }

  loans.value.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    bookTitle: title,
    borrower: borrower.value,
    borrowDate: borrowDate.value || today,
    createdAt: new Date().toISOString()
  })

  bookTitle.value = ''
  borrower.value = ''
  borrowDate.value = today
  showToast('📚 借閱完成')
}

function returnBook(loan) {
  const returnDate = today

  history.value.unshift({
    ...loan,
    returnDate,
    totalDays: getBorrowDays(loan.borrowDate, returnDate)
  })

  loans.value = loans.value.filter(item => item.id !== loan.id)
  playReturnSound()
  showToast(`《${loan.bookTitle}》已歸還`)
}

function getBorrowDays(startDate, endDate = today) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24))
  return Math.max(diff + 1, 1)
}

function dayClass(days) {
  return {
    normal: days < 7,
    warning: days >= 7 && days < 14,
    danger: days >= 14
  }
}

function makeReminder() {
  if (!overdueLoans.value.length) {
    showToast('目前沒有需要催還的班書')
    return
  }

  reminderText.value = `班書歸還提醒：\n\n請以下同學記得歸還班書：\n\n${overdueLoans.value.map(item => {
    return `${item.borrower}：《${item.bookTitle}》（已借閱第${getBorrowDays(item.borrowDate)}天）`
  }).join('\n')}\n\n謝謝配合！`
}

function copyReminder() {
  navigator.clipboard?.writeText(reminderText.value)
  showToast('📋 催還訊息已複製')
}

function showToast(message) {
  toast.value = message
  setTimeout(() => {
    toast.value = ''
  }, 1600)
}

function playReturnSound() {
  const audio = new AudioContext()
  const osc = audio.createOscillator()
  const gain = audio.createGain()

  osc.connect(gain)
  gain.connect(audio.destination)

  osc.frequency.setValueAtTime(523, audio.currentTime)
  osc.frequency.setValueAtTime(784, audio.currentTime + 0.08)

  gain.gain.setValueAtTime(0.08, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.22)

  osc.start()
  osc.stop(audio.currentTime + 0.22)
}
</script>

<template>
  <div class="page library-page">
    <div class="library-header">
      <div>
        <h2>📖 班書借閱</h2>
        <p>書名自由輸入，不需要事先建立書單。</p>
      </div>

      <div class="summary">
        <div>
          <strong>{{ loans.length }}</strong>
          <span>目前借出</span>
        </div>
        <div>
          <strong>{{ todayBorrowCount }}</strong>
          <span>今日借出</span>
        </div>
        <div>
          <strong>{{ todayReturnCount }}</strong>
          <span>今日歸還</span>
        </div>
      </div>
    </div>

    <section class="card borrow-card">
      <h3>📚 借閱登記</h3>

      <div class="borrow-form">
        <label>
          <span>書名</span>
          <input v-model="bookTitle" placeholder="例如：神奇樹屋 1" />
        </label>

        <label>
          <span>借閱人</span>
          <select v-model="borrower">
            <option value="">請選擇學生</option>
            <option v-for="student in students" :key="student">{{ student }}</option>
          </select>
        </label>

        <label>
          <span>借閱日期</span>
          <input class="library-date-input" type="date" v-model="borrowDate" />
        </label>

        <button class="primary" @click="addLoan">📗 借出</button>
      </div>

      <p v-if="students.length === 0" class="hint">尚未建立學生名單，請先到「學生管理」貼上學生名單。</p>
    </section>

    <section class="tools">
      <input v-model="searchText" placeholder="搜尋書名或學生姓名" />
      <button class="reminder-btn" @click="makeReminder">
        📢 催還{{ overdueLoans.length ? `（${overdueLoans.length}）` : '' }}
      </button>
    </section>

    <section class="card">
      <h3>📕 目前借閱</h3>

      <div v-if="filteredLoans.length === 0" class="empty">
        目前沒有符合條件的借閱紀錄。
      </div>

      <div class="loan-list">
        <article v-for="loan in filteredLoans" :key="loan.id" class="loan-item">
          <div class="book-info">
            <h4>📘 {{ loan.bookTitle }}</h4>
            <p>{{ loan.borrower }}・{{ loan.borrowDate }}</p>
          </div>

          <div class="day-pill" :class="dayClass(getBorrowDays(loan.borrowDate))">
            第 {{ getBorrowDays(loan.borrowDate) }} 天
          </div>

          <button class="return-btn" @click="returnBook(loan)">還書</button>
        </article>
      </div>
    </section>

    <section class="card history-card">
      <h3>📚 最近歸還紀錄</h3>

      <div v-if="history.length === 0" class="empty">尚無歸還紀錄。</div>

      <div class="history-list">
        <div v-for="item in history.slice(0, 8)" :key="item.id + item.returnDate" class="history-item">
          <span>《{{ item.bookTitle }}》</span>
          <span>{{ item.borrower }}</span>
          <span>{{ item.borrowDate }} → {{ item.returnDate }}</span>
          <span>共 {{ item.totalDays }} 天</span>
        </div>
      </div>
    </section>

    <div v-if="duplicateLoan" class="modal-mask">
      <div class="modal">
        <h3>⚠️ 這本書目前已借出</h3>
        <p>《{{ duplicateLoan.bookTitle }}》目前由 <strong>{{ duplicateLoan.borrower }}</strong> 借閱中。</p>
        <p>借閱日期：{{ duplicateLoan.borrowDate }}，目前第 {{ getBorrowDays(duplicateLoan.borrowDate) }} 天。</p>
        <button class="primary" @click="duplicateLoan = null">知道了</button>
      </div>
    </div>

    <div v-if="reminderText" class="modal-mask">
      <div class="modal reminder-modal">
        <h3>📢 催還訊息</h3>
        <pre>{{ reminderText }}</pre>
        <div class="modal-actions">
          <button class="primary" @click="copyReminder">複製</button>
          <button class="secondary" @click="reminderText = ''">關閉</button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<style scoped>
.library-page {
  max-width: none;
}

.library-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  margin-bottom: 20px;
}

.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  min-width: 320px;
}

.summary div {
  background: white;
  border-radius: 18px;
  padding: 16px;
  text-align: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .08);
}

.summary strong {
  display: block;
  font-size: 28px;
  color: #2f6f57;
}

.summary span {
  font-size: 14px;
  color: #667085;
}

.borrow-card {
  margin-bottom: 18px;
}

.borrow-form {
  display: grid;
  grid-template-columns: 2fr 1.3fr 1fr auto;
  gap: 12px;
  align-items: end;
}

label span {
  display: block;
  font-weight: 800;
  margin-bottom: 8px;
}

input,
select {
  width: 100%;
  border: 2px solid #dceee6;
  border-radius: 14px;
  padding: 13px;
  font-size: 16px;
  background: white;
}

button {
  border: none;
  border-radius: 14px;
  padding: 13px 18px;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
}

.primary {
  background: #6bbf95;
  color: white;
}

.secondary {
  background: #eef2f7;
  color: #344054;
}

.hint,
.empty {
  color: #667085;
}

.tools {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  margin-bottom: 18px;
}

.reminder-btn {
  background: #ff8a3d;
  color: white;
}

.loan-list {
  display: grid;
  gap: 12px;
}

.loan-item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
  background: #f8fbf9;
  border: 1px solid #e6eee9;
  border-radius: 18px;
  padding: 14px 16px;
}

.book-info h4 {
  margin: 0 0 6px;
  font-size: 20px;
}

.book-info p {
  margin: 0;
  color: #667085;
}

.day-pill {
  border-radius: 999px;
  padding: 8px 12px;
  font-weight: 900;
  background: #e9faef;
  color: #1f8f48;
}

.day-pill.warning {
  background: #fff4d6;
  color: #b86b00;
}

.day-pill.danger {
  background: #ffe2e2;
  color: #c62828;
}

.return-btn {
  background: #4e7c68;
  color: white;
}

.history-card {
  margin-top: 18px;
}

.history-list {
  display: grid;
  gap: 8px;
}

.history-item {
  display: grid;
  grid-template-columns: 1.6fr .9fr 1.5fr .7fr;
  gap: 10px;
  background: #fffaf4;
  border-radius: 12px;
  padding: 10px 12px;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, .28);
  display: grid;
  place-items: center;
  z-index: 100;
  padding: 20px;
}

.modal {
  width: min(620px, 100%);
  background: white;
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, .25);
}

.reminder-modal pre {
  white-space: pre-wrap;
  background: #f8fafc;
  border-radius: 16px;
  padding: 16px;
  line-height: 1.7;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.toast {
  position: fixed;
  right: 28px;
  bottom: 28px;
  background: #2f6f57;
  color: white;
  padding: 16px 22px;
  border-radius: 18px;
  font-weight: 900;
  box-shadow: 0 10px 30px rgba(0,0,0,.2);
  z-index: 120;
}

@media (max-width: 980px) {
  .library-header,
  .borrow-form,
  .tools,
  .loan-item,
  .history-item {
    grid-template-columns: 1fr;
  }

  .library-header {
    display: block;
  }

  .summary {
    min-width: 0;
    margin-top: 12px;
  }
}


/* ✅ HUA_LIBRARY_ONE_SCREEN_MOBILE_REVIEW_20260710
   班書借閱：桌機表單與清單清楚；手機單欄、彈窗不超出。 */
@media (min-width: 981px) and (max-height: 840px) {
  .library-header {
    margin-bottom: 12px !important;
  }

  .summary div {
    padding: 12px !important;
  }

  .summary strong {
    font-size: 24px !important;
  }

  .borrow-card,
  .history-card {
    margin-top: 12px !important;
    margin-bottom: 12px !important;
  }

  .loan-list {
    gap: 8px !important;
  }

  .loan-item,
  .history-item {
    padding: 10px 12px !important;
    border-radius: 14px !important;
  }
}

@media (max-width: 760px) {
  .summary {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }

  .modal {
    width: min(94vw, 620px) !important;
    max-height: 86svh !important;
    overflow: auto !important;
    padding: 18px !important;
  }

  .modal-actions {
    flex-direction: column !important;
  }
}



/* ✅ HUA_LIBRARY_IOS_DATE_FIT_STYLE_20260712 */
.borrow-form,
.borrow-form label {
  min-width: 0;
}

.library-date-input {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
}

@media (max-width: 760px) {
  .borrow-form {
    width: 100%;
    grid-template-columns: minmax(0, 1fr);
  }

  .borrow-form > *,
  .borrow-form input,
  .borrow-form select,
  .library-date-input {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }

  .library-date-input {
    min-height: 52px;
    padding-inline: 12px;
  }
}
</style>
