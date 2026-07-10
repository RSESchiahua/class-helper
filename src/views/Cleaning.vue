<script setup>
// ✅ HUA_CLEANING_ONE_SCREEN_MOBILE_REVIEW_20260710：打掃分配頁由全域 CSS 控制桌機一頁式與手機單欄。
import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'classHelperCleaningAssignments'

const students = computed(() => (localStorage.getItem('students') || '').split('\n').map(s => s.trim()).filter(Boolean))
const draftTitle = ref('')
const areas = ref(loadAreas())

watch(areas, value => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true })

const assignedNames = computed(() => new Set(areas.value.flatMap(area => area.students || [])))
const unassignedStudents = computed(() => students.value.filter(name => !assignedNames.value.has(name)))

function loadAreas() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(saved) && saved.length) return saved
  } catch {}
  return [
    { id: crypto.randomUUID(), title: '教室地板', note: '掃地、拖地、排桌椅', students: [] },
    { id: crypto.randomUUID(), title: '黑板與講桌', note: '擦黑板、整理講桌周邊', students: [] },
    { id: crypto.randomUUID(), title: '走廊與窗台', note: '掃走廊、擦窗台', students: [] },
    { id: crypto.randomUUID(), title: '資源回收', note: '整理回收、垃圾分類', students: [] }
  ]
}

function onDragStart(event, student) {
  event.dataTransfer.setData('student', student)
}

function dropToArea(event, area) {
  const student = event.dataTransfer.getData('student')
  if (!student) return
  removeStudent(student)
  area.students.push(student)
}

function removeStudent(student) {
  areas.value.forEach(area => {
    area.students = area.students.filter(name => name !== student)
  })
}

function addArea() {
  const title = draftTitle.value.trim() || '新打掃工作'
  areas.value.push({ id: crypto.randomUUID(), title, note: '', students: [] })
  draftTitle.value = ''
}

function removeArea(index) {
  if (!confirm('確定刪除這個打掃工作嗎？學生會回到未分配名單。')) return
  areas.value.splice(index, 1)
}

function resetAssignments() {
  if (!confirm('確定清空所有打掃分配嗎？')) return
  areas.value.forEach(area => { area.students = [] })
}
</script>

<template>
  <!-- ✅ HUA_CLEANING_ONE_SCREEN_MOBILE_REVIEW_20260710 -->
  <div class="page wide-page assign-page">
    <div class="page-title-row">
      <div>
        <h2>🧹 打掃分配</h2>
        <p>掃區還沒確定也沒關係：先編輯工作卡，之後把學生名字拖曳到負責工作。</p>
      </div>
      <button class="soft-danger" @click="resetAssignments">清空分配</button>
    </div>

    <section class="one-screen-layout">
      <aside class="student-palette card compact-card">
        <h3>👥 未分配學生</h3>
        <p class="hint">{{ unassignedStudents.length }} 位尚未分配</p>
        <div class="chips">
          <span v-for="student in unassignedStudents" :key="student" class="name-chip" draggable="true" @dragstart="onDragStart($event, student)">{{ student }}</span>
        </div>
      </aside>

      <main class="assignment-board">
        <div class="add-row card compact-card">
          <input v-model="draftTitle" placeholder="新增打掃工作，例如：掃具櫃、外掃區、午餐整理" @keyup.enter="addArea" />
          <button @click="addArea">＋ 新增工作</button>
        </div>

        <div class="assignment-grid">
          <article v-for="(area, index) in areas" :key="area.id" class="assign-card" @dragover.prevent @drop="dropToArea($event, area)">
            <div class="assign-card-head">
              <input v-model="area.title" class="title-input" />
              <button class="tiny danger-text" @click="removeArea(index)">刪除</button>
            </div>
            <textarea v-model="area.note" placeholder="工作內容提醒，可留空" />
            <div class="assigned-list">
              <span v-for="student in area.students" :key="student" class="name-chip assigned" draggable="true" @dragstart="onDragStart($event, student)" @dblclick="removeStudent(student)">{{ student }} ✕</span>
              <span v-if="area.students.length === 0" class="drop-hint">拖曳學生到這裡</span>
            </div>
          </article>
        </div>
      </main>
    </section>
  </div>
</template>
