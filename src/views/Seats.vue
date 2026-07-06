<script setup>
import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'classHelperSeatPlan'
const groupColors = ['#dff3ea', '#fff0c2', '#ffd9d2', '#dbeafe', '#eadcff', '#d9f99d']

const students = computed(() => (localStorage.getItem('students') || '').split('\n').map(s => s.trim()).filter(Boolean))
const plan = ref(loadPlan())
const selectedGroup = ref(0)
const selectedSeats = ref(new Set())

watch(plan, value => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true })

const seats = computed(() => plan.value.seats)
const assignedNames = computed(() => new Set(seats.value.map(seat => seat.student).filter(Boolean)))
const unassignedStudents = computed(() => students.value.filter(name => !assignedNames.value.has(name)))
const gridStyle = computed(() => ({ gridTemplateColumns: `repeat(${plan.value.cols}, minmax(72px, 1fr))` }))

function loadPlan() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved?.seats?.length) return saved
  } catch {}
  const rows = 5
  const cols = 6
  return { rows, cols, seats: Array.from({ length: rows * cols }, (_, index) => ({ id: crypto.randomUUID(), student: '', group: null, leader: '' })) }
}

function rebuildSeats(rows, cols) {
  const old = [...plan.value.seats]
  const next = []
  for (let i = 0; i < rows * cols; i++) next.push(old[i] || { id: crypto.randomUUID(), student: '', group: null, leader: '' })
  plan.value.rows = rows
  plan.value.cols = cols
  plan.value.seats = next
}
function changeRows(delta) { rebuildSeats(Math.max(1, plan.value.rows + delta), plan.value.cols) }
function changeCols(delta) { rebuildSeats(plan.value.rows, Math.max(1, plan.value.cols + delta)) }
function onDragStart(event, student) { event.dataTransfer.setData('student', student) }
function removeStudent(student) { seats.value.forEach(seat => { if (seat.student === student) seat.student = '' }) }
function dropToSeat(event, seat) {
  const student = event.dataTransfer.getData('student')
  if (!student) return
  removeStudent(student)
  seat.student = student
}
function clearSeat(seat) { seat.student = ''; seat.leader = '' }
function toggleSeatSelect(seat) {
  const next = new Set(selectedSeats.value)
  next.has(seat.id) ? next.delete(seat.id) : next.add(seat.id)
  selectedSeats.value = next
}
function applyGroup() {
  seats.value.forEach(seat => { if (selectedSeats.value.has(seat.id)) seat.group = selectedGroup.value })
}
function clearGroup() {
  seats.value.forEach(seat => { if (selectedSeats.value.has(seat.id)) seat.group = null })
}
function markLeader(type) {
  seats.value.forEach(seat => { if (selectedSeats.value.has(seat.id)) seat.leader = seat.leader === type ? '' : type })
}
function groupStyle(seat) { return seat.group === null || seat.group === undefined ? {} : { background: groupColors[seat.group] } }
function resetPlan() {
  if (!confirm('確定清空座位與分組嗎？')) return
  seats.value.forEach(seat => { seat.student = ''; seat.group = null; seat.leader = '' })
  selectedSeats.value = new Set()
}
</script>

<template>
  <div class="page wide-page seats-page">
    <div class="page-title-row">
      <div>
        <h2>🪑 座位安排</h2>
        <p>上方是黑板，下方是佈告欄。拖曳學生入座，點選座位後可標分組、組長或排長。</p>
      </div>
      <button class="soft-danger" @click="resetPlan">清空座位</button>
    </div>

    <section class="seat-layout-one-screen">
      <aside class="student-palette card compact-card">
        <h3>👥 待安排</h3>
        <p class="hint">{{ unassignedStudents.length }} 位尚未入座</p>
        <div class="chips">
          <span v-for="student in unassignedStudents" :key="student" class="name-chip" draggable="true" @dragstart="onDragStart($event, student)">{{ student }}</span>
        </div>
      </aside>

      <main class="seat-plan-area card">
        <div class="seat-toolbar">
          <div class="toolbar-group"><button @click="changeRows(-1)">－排</button><strong>{{ plan.rows }} 排</strong><button @click="changeRows(1)">＋排</button></div>
          <div class="toolbar-group"><button @click="changeCols(-1)">－列</button><strong>{{ plan.cols }} 列</strong><button @click="changeCols(1)">＋列</button></div>
          <div class="toolbar-group color-picker">
            <button v-for="(color, index) in groupColors" :key="color" class="color-dot" :class="{ active: selectedGroup === index }" :style="{ background: color }" @click="selectedGroup = index"></button>
            <button @click="applyGroup">標分組</button>
            <button @click="clearGroup">清色</button>
          </div>
          <div class="toolbar-group"><button @click="markLeader('組長')">⭐ 組長</button><button @click="markLeader('排長')">📍 排長</button></div>
        </div>

        <div class="board-label">黑板</div>
        <div class="seat-grid-map" :style="gridStyle">
          <button v-for="seat in seats" :key="seat.id" class="class-seat" :class="{ selected: selectedSeats.has(seat.id), empty: !seat.student }" :style="groupStyle(seat)" @click="toggleSeatSelect(seat)" @dragover.prevent @drop="dropToSeat($event, seat)" @dblclick="clearSeat(seat)">
            <span v-if="seat.leader" class="leader-tag">{{ seat.leader }}</span>
            <strong>{{ seat.student || '空位' }}</strong>
          </button>
        </div>
        <div class="board-label bulletin">佈告欄</div>
      </main>
    </section>
  </div>
</template>
