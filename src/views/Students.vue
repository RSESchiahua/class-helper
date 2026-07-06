<script setup>
import { ref, computed, watch } from 'vue'

const className = ref(localStorage.getItem('className') || '')
const studentText = ref(localStorage.getItem('students') || '')

function parseStudentLine(line, index) {
  const text = line.trim()
  const match = text.match(/^(\d{1,2})[\s、.．,-]+(.+)$/)

  if (match) {
    return {
      seatNo: Number(match[1]),
      name: match[2].trim(),
      raw: text
    }
  }

  return {
    seatNo: index + 1,
    name: text,
    raw: text
  }
}

const students = computed(() =>
  studentText.value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
    .map(parseStudentLine)
)

const seatSummary = computed(() => {
  if (students.value.length === 0) return '尚未建立名單'
  const seatNos = students.value.map(student => student.seatNo)
  const min = Math.min(...seatNos)
  const max = Math.max(...seatNos)
  return `${min}～${max} 號，共 ${students.value.length} 位學生`
})

watch(className, value => {
  localStorage.setItem('className', value)
})

watch(studentText, value => {
  localStorage.setItem('students', value)
})

function clearStudents() {
  if (confirm('確定要清空學生名單嗎？')) {
    studentText.value = ''
  }
}

function loadExampleWithEmptyNumbers() {
  studentText.value = [
    '1 王小明',
    '2 李小華',
    '3 陳小安',
    '15 張小宇',
    '21 林小美',
    '22 黃小晴'
  ].join('\n')
}
</script>

<template>
  <div class="page students-page">
    <div class="page-title-row">
      <div>
        <h2>👨‍🎓 學生管理</h2>
        <p>建立全班共用名單。座號可以不連續，空號不會影響後續功能。</p>
      </div>
    </div>

    <div class="student-editor-grid">
      <section class="card compact-card">
        <h3>🏫 班級名稱</h3>
        <input v-model="className" placeholder="例如：三年五班" />
      </section>

      <section class="card compact-card student-import-card">
        <div class="section-head">
          <div>
            <h3>📋 學生名單</h3>
            <p class="hint">可輸入「座號＋姓名」，例如：1 王小明、21 林小美。</p>
          </div>
          <button class="tiny soft-button" @click="loadExampleWithEmptyNumbers">範例</button>
        </div>

        <textarea
          v-model="studentText"
          placeholder="1 王小明&#10;2 李小華&#10;15 張小宇&#10;21 林小美"
        ></textarea>

        <div class="student-actions">
          <p class="count">{{ seatSummary }}</p>
          <button class="danger" @click="clearStudents">清空名單</button>
        </div>
      </section>
    </div>

    <section class="card" v-if="students.length > 0">
      <div class="section-head">
        <div>
          <h3>✅ 名單預覽</h3>
          <p class="hint">以一致、溫暖的姓名卡片呈現，全班名單一眼就能確認。</p>
        </div>
        <span class="student-total">{{ students.length }} 位</span>
      </div>

      <div class="student-card-grid">
        <article
          v-for="student in students"
          :key="student.seatNo + student.name"
          class="student-card"
        >
          <span class="seat-number">{{ String(student.seatNo).padStart(2, '0') }}</span>
          <strong class="student-name">{{ student.name }}</strong>
        </article>
      </div>
    </section>

    <section class="card empty-state" v-else>
      <div>🌱</div>
      <h3>名單可以先空著</h3>
      <p>等分班名單確定後，再一次貼上即可。</p>
    </section>
  </div>
</template>

<style scoped>
.students-page {
  max-width: 1100px;
}

.student-editor-grid {
  display: grid;
  grid-template-columns: minmax(220px, 320px) 1fr;
  gap: 18px;
  align-items: start;
}

input,
textarea {
  width: 100%;
  border: 2px solid #dceee6;
  border-radius: 16px;
  padding: 14px;
  font-size: 16px;
  margin-top: 10px;
  background: #fffdfa;
  color: #243b53;
}

textarea {
  min-height: 170px;
  resize: vertical;
  line-height: 1.7;
}

h3 {
  margin-top: 0;
}

.count {
  font-weight: 900;
  color: #2f6f57;
}

.student-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.danger {
  background: #e9897e;
}

.soft-button {
  background: #f4fbf7;
  color: #2f6f57;
  border: 1px solid #cfe9dd;
}

.student-total {
  background: #dff3ea;
  color: #2f6f57;
  border-radius: 999px;
  padding: 8px 12px;
  font-weight: 900;
  white-space: nowrap;
}

.student-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.student-card {
  min-height: 86px;
  background: #fffaf2;
  border: 1px solid #eadfce;
  border-radius: 20px;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  box-shadow: 0 6px 18px rgba(92, 74, 49, 0.08);
}

.student-card:hover {
  transform: translateY(-2px);
  transition: 0.18s ease;
  box-shadow: 0 10px 24px rgba(92, 74, 49, 0.12);
}

.seat-number {
  min-width: 42px;
  height: 28px;
  background: #efe2cc;
  color: #6a5538;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  font-weight: 900;
  font-size: 14px;
  letter-spacing: 0.04em;
}

.student-name {
  display: block;
  width: 100%;
  font-size: 18px;
  color: #263238;
  margin-top: 8px;
  line-height: 1.25;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.empty-state {
  text-align: center;
  color: #667085;
}

.empty-state div {
  font-size: 52px;
}

@media (max-width: 900px) {
  .student-editor-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .students-page {
    max-width: 100%;
  }

  .student-actions,
  .section-head {
    align-items: stretch;
    flex-direction: column;
  }

  .student-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .student-card {
    min-height: 80px;
    border-radius: 18px;
    padding: 12px 10px;
  }

  .student-name {
    font-size: 16px;
  }

  .seat-number {
    min-width: 38px;
    height: 26px;
    font-size: 13px;
  }
}
</style>
