<script setup>
import { computed, reactive, ref, watch } from 'vue'

const today = new Date()
const selectedDate = ref(toDateKey(today))
const toast = ref('')
const audioEnabled = ref(localStorage.getItem('toothbrushSoundEnabled') !== 'false')
const students = computed(() => (localStorage.getItem('students') || '').split('\n').map(name => name.trim()).filter(Boolean))
const records = reactive(loadRecords())
const weekdayNames = ['日', '一', '二', '三', '四', '五', '六']
const selectedDateObject = computed(() => parseDateKey(selectedDate.value))
const selectedDateText = computed(() => `${selectedDateObject.value.getMonth() + 1}/${selectedDateObject.value.getDate()}（${weekdayNames[selectedDateObject.value.getDay()]}）`)
const dayRecord = computed(() => records[selectedDate.value] ||= {})
const brushedCount = computed(() => students.value.filter((_, index) => dayRecord.value[index]?.tooth).length)
const disinfectedCount = computed(() => students.value.filter((_, index) => dayRecord.value[index]?.desk).length)
const allDoneCount = computed(() => students.value.filter((_, index) => dayRecord.value[index]?.tooth && dayRecord.value[index]?.desk).length)

watch(records, () => localStorage.setItem('toothbrushRecords', JSON.stringify(records)), { deep: true })
watch(audioEnabled, value => localStorage.setItem('toothbrushSoundEnabled', String(value)))

function loadRecords() { try { return JSON.parse(localStorage.getItem('toothbrushRecords') || '{}') } catch { return {} } }
function toDateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function parseDateKey(dateKey) { const [y, m, d] = dateKey.split('-').map(Number); return new Date(y, m - 1, d) }
function ensureStudent(index) { return dayRecord.value[index] ||= { tooth: false, desk: false } }
function moveDate(offset) { const date = selectedDateObject.value; date.setDate(date.getDate() + offset); selectedDate.value = toDateKey(date) }
function goToday() { selectedDate.value = toDateKey(new Date()) }
function beep(type = 'tooth') {
  if (!audioEnabled.value) return
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.type = 'sine'; osc.frequency.value = type === 'desk' ? 660 : 880
    gain.gain.setValueAtTime(0.001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16)
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.18)
  } catch {}
}
function toggle(index, key) {
  const item = ensureStudent(index)
  item[key] = !item[key]
  if (item[key]) beep(key === 'desk' ? 'desk' : 'tooth')
  showToast(`${students.value[index]}：${key === 'tooth' ? '🦷 刷牙' : '🧴 桌面消毒'}${item[key] ? '完成' : '取消'}`)
}
function setAll(key, value) { students.value.forEach((_, index) => { ensureStudent(index)[key] = value }); if (value) beep(key === 'desk' ? 'desk' : 'tooth'); showToast(value ? '全班已完成' : '已取消全班紀錄') }
function clearToday() { if (!confirm(`確定清除 ${selectedDateText.value} 的紀錄嗎？`)) return; records[selectedDate.value] = {}; showToast('今日紀錄已清除') }
function showToast(message) { toast.value = message; setTimeout(() => { if (toast.value === message) toast.value = '' }, 1400) }
</script>

<template>
  <div class="page wide-page toothbrush-page">
    <div class="page-title-row">
      <div><h2>🦷 潔牙與桌面消毒</h2><p>一個畫面完成中午刷牙與飯後桌面消毒追蹤，點學生卡即可切換。</p></div>
      <div class="date-controls"><button @click="moveDate(-1)">◀</button><button @click="goToday">今天</button><button @click="moveDate(1)">▶</button></div>
    </div>

    <section class="card compact-card">
      <div class="tracking-top">
        <div><h3>{{ selectedDateText }}</h3><p class="hint">🦷 刷牙：{{ brushedCount }}/{{ students.length }}　🧴 消毒：{{ disinfectedCount }}/{{ students.length }}　✅ 全完成：{{ allDoneCount }}/{{ students.length }}</p></div>
        <label class="sound-toggle"><input v-model="audioEnabled" type="checkbox" /> 音效</label>
      </div>
      <div class="actions"><button @click="setAll('tooth', true)">🦷 全班刷牙</button><button @click="setAll('desk', true)">🧴 全班消毒</button><button @click="clearToday" class="soft-danger">清除今日</button></div>
      <div v-if="students.length === 0" class="empty">尚未建立學生名單，請先到「學生名單」貼上名單。</div>
      <div v-else class="tracking-grid">
        <article v-for="(student, index) in students" :key="student + index" class="tracking-card" :class="{ done: dayRecord[index]?.tooth && dayRecord[index]?.desk }">
          <strong><span>{{ index + 1 }}</span>{{ student }}</strong>
          <div class="tracking-buttons"><button :class="{ active: dayRecord[index]?.tooth }" @click="toggle(index, 'tooth')">🦷 刷牙</button><button :class="{ active: dayRecord[index]?.desk }" @click="toggle(index, 'desk')">🧴 消毒</button></div>
        </article>
      </div>
    </section>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>
