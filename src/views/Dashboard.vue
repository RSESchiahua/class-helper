<script setup>
import { ref, computed } from 'vue'

const className = ref(localStorage.getItem('className') || '')
const studentSource = ref(localStorage.getItem('students') || '')

const encouragements = [
  { text: '每天進步一點點，累積起來就是很大的力量。', for: '給學生，也給老師' },
  { text: '今天也許不完美，但只要願意開始，就已經很棒。', for: '溫柔提醒' },
  { text: '安靜做好一件小事，就是讓班級變好的開始。', for: '班級小任務' },
  { text: '你的一句謝謝、一個微笑，都可能讓別人的一天變亮。', for: '今日小暖心' },
  { text: '慢慢來也沒關係，穩穩地做，就會越來越好。', for: '給努力中的我們' },
  { text: '老師和同學一起練習，一起成為更好的班級。', for: '班級助手想說' },
  { text: '把眼前的小事做好，就是最踏實的厲害。', for: '今日鼓勵' }
]

const today = new Date()
const quoteIndex = ref(today.getDate() % encouragements.length)

const students = computed(() => parseStudents(studentSource.value))
const todayKey = computed(() => toDateKey(new Date()))
const todayText = computed(() => formatToday(new Date()))
const todayEvents = computed(() => getTodayEvents(todayKey.value))
const currentQuote = computed(() => encouragements[quoteIndex.value])

function nextQuote() {
  quoteIndex.value = (quoteIndex.value + 1) % encouragements.length
}

function parseStudents(value) {
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
        .map((student, index) => {
          if (typeof student === 'string') return { number: index + 1, name: student }
          return {
            number: student.number || student.no || student.id || index + 1,
            name: student.name || student.studentName || ''
          }
        })
        .filter(student => student.name)
    }
  } catch {}

  return value
    .split('\n')
    .map((line, index) => {
      const trimmed = line.trim()
      const match = trimmed.match(/^(\d+)\s*[\.、\- ]\s*(.+)$/)
      if (match) return { number: Number(match[1]), name: match[2].trim() }
      return { number: index + 1, name: trimmed }
    })
    .filter(student => student.name)
}

function getTodayEvents(key) {
  try {
    const saved = JSON.parse(localStorage.getItem('classHelperCalendarEvents') || '{}')
    return Array.isArray(saved[key]) ? saved[key] : []
  } catch {
    return []
  }
}

function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatToday(date) {
  const week = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日（星期${week}）`
}
</script>

<template>
  <div class="dashboard home-dashboard">
    <section class="home-hero card">
      <div class="home-hero-text">
        <span class="eyebrow">🌱 今日一句</span>
        <h2>{{ currentQuote.text }}</h2>
        <p>{{ currentQuote.for }}</p>
      </div>
      <button class="quote-button" @click="nextQuote">換一句</button>
    </section>

    <section class="home-grid">
      <div class="card home-info-card">
        <h3>📚 班級資訊</h3>
        <div class="info-list">
          <p>
            <span>目前班級</span>
            <strong>{{ className || '尚未建立班級' }}</strong>
          </p>
          <p>
            <span>學生人數</span>
            <strong>{{ students.length }} 位</strong>
          </p>
          <p>
            <span>今天日期</span>
            <strong>{{ todayText }}</strong>
          </p>
        </div>
        <RouterLink class="button-link" to="/students">前往學生名單</RouterLink>
      </div>

      <div class="card home-info-card">
        <h3>📌 今日提醒</h3>
        <div v-if="todayEvents.length" class="today-events">
          <p v-for="(event, index) in todayEvents" :key="index">{{ event }}</p>
        </div>
        <div v-else class="empty-note">
          今天尚未新增提醒。<br>
          可以到行事曆寫下班級活動或重要事項。
        </div>
        <RouterLink class="button-link soft-link" to="/calendar">前往行事曆</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-dashboard {
  max-width: 1080px;
}

.home-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: clamp(22px, 4vw, 36px);
  background: linear-gradient(135deg, #ffffff 0%, #f4fbf7 48%, #fff7e8 100%);
  border: 1px solid #f1e6d8;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #4e7c68;
  font-weight: 900;
  margin-bottom: 10px;
}

.home-hero h2 {
  margin: 0;
  color: #243b53;
  font-size: clamp(26px, 4.8vw, 48px);
  line-height: 1.25;
  letter-spacing: .02em;
}

.home-hero p {
  margin: 12px 0 0;
  color: #667085;
  font-weight: 800;
}

.quote-button {
  flex: 0 0 auto;
  background: #fff;
  color: #2f6f57;
  border: 1px solid #cfe9dd;
  box-shadow: 0 6px 16px rgba(47, 111, 87, .08);
}

.home-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-top: 18px;
}

.home-info-card {
  margin-top: 0;
}

.home-info-card h3 {
  margin-top: 0;
  color: #2f6f57;
}

.info-list {
  display: grid;
  gap: 10px;
}

.info-list p {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 13px 14px;
  border-radius: 16px;
  background: #fff8f0;
}

.info-list span {
  color: #667085;
  font-weight: 800;
}

.info-list strong {
  text-align: right;
  color: #243b53;
}

.today-events {
  display: grid;
  gap: 10px;
}

.today-events p,
.empty-note {
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: #f4fbf7;
  color: #345;
  font-weight: 800;
  line-height: 1.7;
}

.empty-note {
  color: #667085;
}

.soft-link {
  background: #6bbf95;
}

@media (max-width: 820px) {
  .home-hero {
    flex-direction: column;
    align-items: stretch;
  }

  .quote-button {
    width: 100%;
  }

  .home-grid {
    grid-template-columns: 1fr;
  }

  .info-list p {
    align-items: flex-start;
    flex-direction: column;
  }

  .info-list strong {
    text-align: left;
  }
}
</style>
