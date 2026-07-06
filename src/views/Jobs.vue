<script setup>
import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'classHelperJobAssignments'
const students = computed(() => (localStorage.getItem('students') || '').split('\n').map(s => s.trim()).filter(Boolean))
const jobs = ref(loadJobs())
const draftTitle = ref('')
const draftSlots = ref(1)

watch(jobs, value => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true })

const assignedNames = computed(() => new Set(jobs.value.flatMap(job => job.students || [])))
const unassignedStudents = computed(() => students.value.filter(name => !assignedNames.value.has(name)))

function loadJobs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(saved) && saved.length) return saved
  } catch {}
  return [
    { id: crypto.randomUUID(), title: '班長', slots: 1, note: '協助老師、集合提醒', students: [] },
    { id: crypto.randomUUID(), title: '副班長', slots: 1, note: '協助班長、臨時支援', students: [] },
    { id: crypto.randomUUID(), title: '秩序長', slots: 2, note: '早修、午休、排隊秩序', students: [] },
    { id: crypto.randomUUID(), title: '衛生長', slots: 2, note: '潔牙、打掃、桌面消毒提醒', students: [] }
  ]
}

function onDragStart(event, student) { event.dataTransfer.setData('student', student) }
function removeStudent(student) { jobs.value.forEach(job => { job.students = job.students.filter(name => name !== student) }) }
function dropToJob(event, job) {
  const student = event.dataTransfer.getData('student')
  if (!student) return
  removeStudent(student)
  job.students.push(student)
}
function addJob() {
  jobs.value.push({ id: crypto.randomUUID(), title: draftTitle.value.trim() || '新職務', slots: Number(draftSlots.value) || 1, note: '', students: [] })
  draftTitle.value = ''
  draftSlots.value = 1
}
function removeJob(index) {
  if (!confirm('確定刪除這個職務嗎？')) return
  jobs.value.splice(index, 1)
}
</script>

<template>
  <div class="page wide-page assign-page">
    <div class="page-title-row">
      <div>
        <h2>⭐ 職務分配</h2>
        <p>預設班長、副班長、秩序長、衛生長；其他職務可自由新增與修改。</p>
      </div>
    </div>

    <section class="one-screen-layout">
      <aside class="student-palette card compact-card">
        <h3>👥 可安排學生</h3>
        <p class="hint">{{ unassignedStudents.length }} 位尚未分配職務</p>
        <div class="chips">
          <span v-for="student in unassignedStudents" :key="student" class="name-chip" draggable="true" @dragstart="onDragStart($event, student)">{{ student }}</span>
        </div>
      </aside>

      <main class="assignment-board">
        <div class="add-row card compact-card">
          <input v-model="draftTitle" placeholder="新增職務，例如：圖書長、電燈長" @keyup.enter="addJob" />
          <input v-model="draftSlots" type="number" min="1" max="10" class="slot-input" />
          <button @click="addJob">＋ 新增職務</button>
        </div>

        <div class="assignment-grid">
          <article v-for="(job, index) in jobs" :key="job.id" class="assign-card" @dragover.prevent @drop="dropToJob($event, job)">
            <div class="assign-card-head">
              <input v-model="job.title" class="title-input" />
              <span class="slot-badge">{{ job.students.length }}/{{ job.slots }}</span>
              <button class="tiny danger-text" @click="removeJob(index)">刪除</button>
            </div>
            <textarea v-model="job.note" placeholder="職務內容提醒，可留空" />
            <div class="assigned-list">
              <span v-for="student in job.students" :key="student" class="name-chip assigned" draggable="true" @dragstart="onDragStart($event, student)" @dblclick="removeStudent(student)">{{ student }} ✕</span>
              <span v-if="job.students.length === 0" class="drop-hint">拖曳學生到這裡</span>
            </div>
          </article>
        </div>
      </main>
    </section>
  </div>
</template>
