<script setup>
// POINTS_V5_CONFIRMED_WITH_SEATS_20260707：已對照 Seats.vue 的 classHelperSeatPlan，學生三欄、音效、小組加分、兌換X置中都在這份檔案。
import { computed, ref, watch } from 'vue'

// POINTS_REWARD_SYSTEM_20260707_NO_LIBRARY：積分獎勵獨立運作，班書借閱先不納入積分。
const POINT_RECORDS_KEY = 'classAssistantPointRecordsV1'
const POINT_REWARDS_KEY = 'classAssistantPointRewardsV1'
const POINT_SOUND_KEY = 'classAssistantPointSoundV1'
const POINT_GROUP_SIZE_KEY = 'classAssistantPointGroupSizeV1'
const POINTS_SEAT_GROUPS_KEY = 'classHelperSeatGroupsForPoints' // POINTS_SEATS_EXACT_KEY_20260707

// POINTS_GROUP_SOUND_LAYOUT_20260707：學生卡片改成更小三欄、小組加分與積分音效已加入。
// POINTS_SEAT_GROUP_AUTO_SCAN_20260707：小組加分會優先讀取 Seats.vue 寫入的 classHelperSeatGroupsForPoints，再讀 classHelperSeatPlan；讀不到才暫用名單每組人數分組。

const quickAmounts = [1, 2, 5, -1, -2]
const positiveReasons = ['認真上課', '主動幫忙', '準時完成', '友善合作', '完成職務', '進步表現']
const remindReasons = ['作業缺交', '未訂正', '干擾秩序', '忘記物品']
const defaultRewards = [
  { id: 'seat', name: '優先選座位', cost: 20, enabled: true },
  { id: 'wheel', name: '抽籤加權一次', cost: 10, enabled: true },
  { id: 'helper', name: '小老師特權', cost: 15, enabled: true },
  { id: 'prize', name: '小獎勵一次', cost: 30, enabled: true }
]

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

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : fallback
  } catch (error) {
    console.warn(`${key} 讀取失敗，已使用預設資料。`, error)
    return fallback
  }
}

function getLocalDateKey(value = new Date()) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTime(value) {
  return new Date(value).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function isThisWeek(value) {
  const date = new Date(value)
  const today = new Date()
  const todayDay = today.getDay() === 0 ? 7 : today.getDay()
  const monday = new Date(today)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(today.getDate() - todayDay + 1)

  const nextMonday = new Date(monday)
  nextMonday.setDate(monday.getDate() + 7)

  return date >= monday && date < nextMonday
}

function makeStudentKey(student) {
  return `${student.seatNo}__${student.name}`
}

function safeFileName(text) {
  return String(text || '班級助手')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
}

const className = ref(localStorage.getItem('className') || '班級')
const studentText = ref(localStorage.getItem('students') || '')
const records = ref(loadJson(POINT_RECORDS_KEY, []))
const rewards = ref(loadJson(POINT_REWARDS_KEY, defaultRewards))
const selectedKey = ref('')
const selectedReason = ref('認真上課')
const targetMode = ref('student')
const selectedGroupId = ref('fallback-1')
const audioEnabled = ref(localStorage.getItem(POINT_SOUND_KEY) !== 'off')
const groupSize = ref(Number(localStorage.getItem(POINT_GROUP_SIZE_KEY)) || 4)
const seatGroupRefreshSeed = ref(0)
const note = ref('')
const customDelta = ref(1)
const activePanel = ref('records')
const newRewardName = ref('')
const newRewardCost = ref(10)
const importInput = ref(null)

const students = computed(() =>
  studentText.value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
    .map(parseStudentLine)
    .map(student => ({ ...student, key: makeStudentKey(student) }))
)

const studentMap = computed(() => new Map(students.value.map(student => [student.key, student])))

const totals = computed(() => {
  const result = {}

  for (const student of students.value) {
    result[student.key] = 0
  }

  for (const record of records.value) {
    if (record.studentKey in result) {
      result[record.studentKey] += Number(record.delta) || 0
    }
  }

  return result
})

const selectedStudent = computed(() => studentMap.value.get(selectedKey.value) || students.value[0] || null)

const selectedTotal = computed(() => {
  if (!selectedStudent.value) return 0
  return totals.value[selectedStudent.value.key] || 0
})


const normalizedGroupSize = computed(() => {
  const size = Number(groupSize.value)
  if (!Number.isFinite(size)) return 4
  return Math.min(10, Math.max(2, Math.round(size)))
})

const studentBySeatNo = computed(() => {
  const map = new Map()
  for (const student of students.value) {
    map.set(Number(student.seatNo), student)
  }
  return map
})

const studentByName = computed(() => {
  const map = new Map()
  for (const student of students.value) {
    map.set(normalizeName(student.name), student)
  }
  return map
})

const groupSourceStudents = computed(() =>
  students.value.slice().sort((a, b) => a.seatNo - b.seatNo || a.name.localeCompare(b.name, 'zh-Hant'))
)

function normalizeName(value) {
  return String(value || '')
    .replace(/[\s　]/g, '')
    .replace(/[()（）【】\[\]{}]/g, '')
    .trim()
}

function uniqueStudents(list) {
  const seen = new Set()
  const result = []

  for (const student of list) {
    if (!student || seen.has(student.key)) continue
    seen.add(student.key)
    result.push(student)
  }

  return result.sort((a, b) => a.seatNo - b.seatNo || a.name.localeCompare(b.name, 'zh-Hant'))
}

function matchStudent(candidate) {
  if (candidate === null || candidate === undefined || candidate === '') return null

  if (typeof candidate === 'number') {
    return studentBySeatNo.value.get(candidate) || null
  }

  if (typeof candidate === 'string') {
    const text = candidate.trim()
    if (!text) return null

    if (studentMap.value.has(text)) return studentMap.value.get(text)

    const seatMatch = text.match(/\d{1,2}/)
    if (seatMatch) {
      const student = studentBySeatNo.value.get(Number(seatMatch[0]))
      if (student) return student
    }

    const normalizedText = normalizeName(text.replace(/^\d{1,2}[\s、.．,-]*/, ''))
    if (studentByName.value.has(normalizedText)) return studentByName.value.get(normalizedText)

    for (const student of students.value) {
      const normalizedStudentName = normalizeName(student.name)
      if (normalizedText.includes(normalizedStudentName) || normalizedStudentName.includes(normalizedText)) {
        return student
      }
    }

    return null
  }

  if (typeof candidate !== 'object') return null

  const directKey = candidate.studentKey || candidate.key || candidate.studentId || candidate.studentID
  if (directKey && studentMap.value.has(String(directKey))) {
    return studentMap.value.get(String(directKey))
  }

  const directStudent = candidate.student || candidate.assignedStudent || candidate.person || candidate.child || candidate.member
  const directMatch = matchStudent(directStudent)
  if (directMatch) return directMatch

  const rawSeatNo = candidate.seatNo ?? candidate.no ?? candidate.number ?? candidate.studentNo ?? candidate.studentNumber ?? candidate.seatNumber ?? candidate.seat
  if (rawSeatNo !== undefined && rawSeatNo !== null && rawSeatNo !== '') {
    const seatMatch = String(rawSeatNo).match(/\d{1,2}/)
    if (seatMatch) {
      const student = studentBySeatNo.value.get(Number(seatMatch[0]))
      if (student) return student
    }
  }

  const rawName = candidate.name ?? candidate.studentName ?? candidate.raw ?? candidate.value ?? candidate.label ?? candidate.text ?? candidate.title
  if (rawName) {
    return matchStudent(String(rawName))
  }

  return null
}

function makeGroup(id, name, members, sourceKey = '') {
  const cleanMembers = uniqueStudents(members)
  if (cleanMembers.length === 0) return null

  return {
    id: String(id),
    name: String(name || id || '小組'),
    members: cleanMembers,
    sourceKey,
    total: cleanMembers.reduce((sum, student) => sum + (totals.value[student.key] || 0), 0)
  }
}

function groupsFromExplicitList(list, sourceKey) {
  if (!Array.isArray(list)) return []

  return list
    .map((group, index) => {
      if (!group || typeof group !== 'object') return null
      const memberSource = group.members || group.students || group.children || group.items || group.list || group.names || group.seatNos || group.studentKeys || group.studentIds || group.seats
      if (!Array.isArray(memberSource)) return null

      const members = memberSource.map(item => matchStudent(item)).filter(Boolean)
      const rawId = group.id ?? group.groupId ?? group.key ?? group.name ?? group.label ?? index + 1
      const rawName = group.name || group.label || group.title || `第 ${index + 1} 組`
      return makeGroup(`seat-${String(rawId)}-${index}`, rawName, members, sourceKey)
    })
    .filter(Boolean)
}

function groupsFromMapObject(mapObject, sourceKey) {
  if (!mapObject || typeof mapObject !== 'object' || Array.isArray(mapObject)) return []

  return Object.entries(mapObject)
    .map(([key, value], index) => {
      if (!Array.isArray(value)) return null
      const members = value.map(item => matchStudent(item)).filter(Boolean)
      return makeGroup(`seat-map-${key}-${index}`, key, members, sourceKey)
    })
    .filter(Boolean)
}


function formatSeatGroupName(value) {
  const text = String(value ?? '').trim()
  const number = Number(text)

  // Seats.vue 的分組色塊是從 0 開始存：0 代表第 1 組、1 代表第 2 組。
  if (Number.isInteger(number) && number >= 0 && number < 100) {
    return `第 ${number + 1} 組`
  }

  return text || '小組'
}

function groupsFromSeatEntries(entries, sourceKey) {
  if (!Array.isArray(entries)) return []

  const groupFields = ['groupId', 'group', 'groupName', 'teamId', 'team', 'tableId', 'table', 'rowGroup', 'columnGroup', 'colorGroup', 'colorId']
  const buckets = new Map()

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue

    let groupValue = null
    for (const field of groupFields) {
      if (entry[field] !== undefined && entry[field] !== null && entry[field] !== '') {
        groupValue = entry[field]
        break
      }
    }

    if (groupValue === null) continue

    const student = matchStudent(entry.student || entry.assignedStudent || entry.assigned || entry.studentInfo || entry)
    if (!student) continue

    const groupKey = String(groupValue)
    if (!buckets.has(groupKey)) buckets.set(groupKey, [])
    buckets.get(groupKey).push(student)
  }

  return Array.from(buckets.entries())
    .map(([key, members], index) => makeGroup(`seat-entry-${key}-${index}`, formatSeatGroupName(key), members, sourceKey))
    .filter(Boolean)
}

function flattenObjects(value, limit = 160) {
  const result = []
  const stack = [value]
  const seen = new Set()

  while (stack.length && result.length < limit) {
    const current = stack.pop()
    if (!current || typeof current !== 'object') continue
    if (seen.has(current)) continue
    seen.add(current)

    if (Array.isArray(current)) {
      for (const item of current) stack.push(item)
      continue
    }

    result.push(current)
    for (const next of Object.values(current)) {
      if (next && typeof next === 'object') stack.push(next)
    }
  }

  return result
}

function extractSeatGroups(parsed, sourceKey) {
  const found = []
  const explicitKeys = ['groups', 'seatGroups', 'groupList', 'teams', 'tables']
  const mapKeys = ['groupMap', 'groupsMap', 'teamMap']
  const seatKeys = ['seats', 'seatMap', 'seatList', 'assignments', 'layout', 'cells', 'grid']

  if (Array.isArray(parsed)) {
    found.push(...groupsFromExplicitList(parsed, sourceKey))
    found.push(...groupsFromSeatEntries(parsed, sourceKey))
  }

  if (parsed && typeof parsed === 'object') {
    for (const object of flattenObjects(parsed)) {
      for (const key of explicitKeys) {
        if (Array.isArray(object[key])) found.push(...groupsFromExplicitList(object[key], sourceKey))
        if (object[key] && typeof object[key] === 'object' && !Array.isArray(object[key])) found.push(...groupsFromMapObject(object[key], sourceKey))
      }

      for (const key of mapKeys) {
        found.push(...groupsFromMapObject(object[key], sourceKey))
      }

      for (const key of seatKeys) {
        const value = object[key]
        if (Array.isArray(value)) found.push(...groupsFromSeatEntries(value, sourceKey))
        if (value && typeof value === 'object' && !Array.isArray(value)) found.push(...groupsFromSeatEntries(Object.values(value), sourceKey))
      }
    }
  }

  const valid = found.filter(group => group.members.length > 0)
  const bySignature = new Map()

  for (const group of valid) {
    const signature = group.members.map(member => member.key).join('|')
    if (!signature || bySignature.has(signature)) continue
    bySignature.set(signature, group)
  }

  const unique = Array.from(bySignature.values())
  const coveredStudents = new Set(unique.flatMap(group => group.members.map(member => member.key)))

  if (unique.length >= 2 && coveredStudents.size >= 2) {
    return unique.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant', { numeric: true }))
  }

  return []
}

function loadSeatArrangementGroups() {
  if (students.value.length === 0) return null

  const keys = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key) continue
    if (/point|reward|sidebar|student|className|library|book/i.test(key)) continue
    if (/seat|seats|座位|group|groups|分組|team|teams|table|tables/i.test(key)) keys.push(key)
  }

  const preferredKeys = [
    POINTS_SEAT_GROUPS_KEY,
    'classHelperSeatPlan',
    'classAssistantSeatGroupsV1',
    'classAssistantSeatAssignmentsV1',
    'classAssistantSeatPlanV1',
    'classAssistantSeatsV1',
    'classAssistantSeatMapV1',
    'seatGroups',
    'seatAssignments',
    'seats'
  ]

  const orderedKeys = [...new Set([...preferredKeys, ...keys])]

  for (const key of orderedKeys) {
    const raw = localStorage.getItem(key)
    if (!raw) continue

    try {
      const parsed = JSON.parse(raw)
      const groups = extractSeatGroups(parsed, key)
      if (groups.length > 0) {
        return { source: 'seat', sourceKey: key, groups }
      }
    } catch (error) {
      // 有些 localStorage 不是 JSON，略過即可。
    }
  }

  return null
}

function buildFallbackGroups() {
  const size = normalizedGroupSize.value
  const groups = []

  for (let index = 0; index < groupSourceStudents.value.length; index += size) {
    const members = groupSourceStudents.value.slice(index, index + size)
    const id = Math.floor(index / size) + 1
    const group = makeGroup(`fallback-${id}`, `第 ${id} 組`, members, 'students-fallback')
    if (group) groups.push(group)
  }

  return groups
}

const groupData = computed(() => {
  seatGroupRefreshSeed.value
  const seatGroups = loadSeatArrangementGroups()

  if (seatGroups) return seatGroups

  return {
    source: 'fallback',
    sourceKey: 'students-fallback',
    groups: buildFallbackGroups()
  }
})

const pointGroups = computed(() => groupData.value.groups)
const groupSourceIsFallback = computed(() => groupData.value.source !== 'seat')
const groupSourceLabel = computed(() => {
  if (groupData.value.source === 'seat') {
    return `已讀取座位安排分組：${groupData.value.sourceKey}`
  }
  return `尚未讀到座位安排分組，暫用學生名單每 ${normalizedGroupSize.value} 人分組。`
})

const selectedGroup = computed(() =>
  pointGroups.value.find(group => group.id === selectedGroupId.value) || pointGroups.value[0] || null
)

const selectedGroupMemberNames = computed(() => {
  if (!selectedGroup.value) return '尚無小組成員'
  return selectedGroup.value.members.map(student => `${student.seatNo} ${student.name}`).join('、')
})

const totalPoints = computed(() => Object.values(totals.value).reduce((sum, value) => sum + value, 0))

const todayRecords = computed(() => {
  const today = getLocalDateKey()
  return records.value
    .filter(record => getLocalDateKey(record.createdAt) === today)
    .slice()
    .reverse()
})

const latestRecords = computed(() => records.value.slice().reverse().slice(0, 40))

const studentScoreCards = computed(() =>
  students.value
    .map(student => ({ ...student, total: totals.value[student.key] || 0 }))
    .sort((a, b) => a.seatNo - b.seatNo || a.name.localeCompare(b.name, 'zh-Hant'))
)

const ranking = computed(() =>
  students.value
    .map(student => ({ ...student, total: totals.value[student.key] || 0 }))
    .sort((a, b) => b.total - a.total || a.seatNo - b.seatNo)
)

const weekStars = computed(() => {
  const weekTotals = {}

  for (const student of students.value) {
    weekTotals[student.key] = 0
  }

  for (const record of records.value) {
    if (record.delta > 0 && isThisWeek(record.createdAt) && record.studentKey in weekTotals) {
      weekTotals[record.studentKey] += Number(record.delta) || 0
    }
  }

  return students.value
    .map(student => ({ ...student, total: weekTotals[student.key] || 0 }))
    .filter(student => student.total > 0)
    .sort((a, b) => b.total - a.total || a.seatNo - b.seatNo)
    .slice(0, 5)
})

const enabledRewards = computed(() => rewards.value.filter(reward => reward.enabled !== false))

watch(records, value => {
  localStorage.setItem(POINT_RECORDS_KEY, JSON.stringify(value))
}, { deep: true })

watch(rewards, value => {
  localStorage.setItem(POINT_REWARDS_KEY, JSON.stringify(value))
}, { deep: true })

watch(audioEnabled, value => {
  localStorage.setItem(POINT_SOUND_KEY, value ? 'on' : 'off')
})

watch(groupSize, value => {
  localStorage.setItem(POINT_GROUP_SIZE_KEY, String(normalizedGroupSize.value || value || 4))
})

watch(pointGroups, value => {
  if (value.length === 0) {
    selectedGroupId.value = 1
    return
  }

  const groupStillExists = value.some(group => group.id === selectedGroupId.value)
  if (!groupStillExists) {
    selectedGroupId.value = value[0].id
  }
}, { immediate: true })

watch(students, value => {
  if (value.length === 0) {
    selectedKey.value = ''
    return
  }

  const selectedStillExists = value.some(student => student.key === selectedKey.value)
  if (!selectedKey.value || !selectedStillExists) {
    selectedKey.value = value[0].key
  }
}, { immediate: true })

function selectStudent(student) {
  selectedKey.value = student.key
}

function refreshSeatGroups() {
  seatGroupRefreshSeed.value += 1
}

function togglePointSound() {
  audioEnabled.value = !audioEnabled.value
  if (audioEnabled.value) {
    playPointsSound(1)
  }
}

let audioContext = null

function getAudioContext() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null
    if (!audioContext) audioContext = new AudioContextClass()
    if (audioContext.state === 'suspended') audioContext.resume()
    return audioContext
  } catch (error) {
    console.warn('積分音效無法播放。', error)
    return null
  }
}

function playPointsSound(delta) {
  if (!audioEnabled.value) return

  const context = getAudioContext()
  if (!context) return

  const amount = Number(delta) || 0
  const now = context.currentTime
  const notes = amount >= 0
    ? [523.25, 659.25, 783.99, 1046.5]
    : [392, 349.23, 329.63]
  const duration = amount >= 0 ? 0.09 : 0.12
  const gap = amount >= 0 ? 0.075 : 0.105
  const peak = amount >= 0 ? 0.13 : 0.08

  notes.forEach((frequency, index) => {
    const start = now + index * gap
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = amount >= 0 ? 'triangle' : 'sine'
    oscillator.frequency.setValueAtTime(frequency, start)
    gain.gain.setValueAtTime(0.001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  })
}

function makePointRecord(student, amount, reason, recordNote, type = 'adjust', extra = {}) {
  records.value.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    studentKey: student.key,
    seatNo: student.seatNo,
    name: student.name,
    delta: amount,
    reason: reason || '未填原因',
    note: String(recordNote || '').trim(),
    type,
    createdAt: new Date().toISOString(),
    ...extra
  })
}

function normalizePointAmount(delta) {
  const amount = Number(delta)
  if (!Number.isFinite(amount) || amount === 0) {
    alert('請輸入不是 0 的分數。')
    return null
  }
  return amount
}

function createRecord(delta, reason, recordNote = note.value, type = 'adjust') {
  const student = selectedStudent.value
  if (!student) {
    alert('請先到「學生名單」建立學生資料。')
    return false
  }

  const amount = normalizePointAmount(delta)
  if (amount === null) return false

  makePointRecord(student, amount, reason, recordNote, type)
  note.value = ''
  playPointsSound(amount)
  return true
}

function createGroupRecord(delta, reason, recordNote = note.value) {
  const group = selectedGroup.value
  if (!group || group.members.length === 0) {
    alert('目前沒有可加分的小組，請先建立學生名單。')
    return false
  }

  const amount = normalizePointAmount(delta)
  if (amount === null) return false

  for (const student of group.members) {
    makePointRecord(
      student,
      amount,
      `${group.name}｜${reason || '未填原因'}`,
      recordNote,
      'group-adjust',
      { groupId: group.id, groupName: group.name }
    )
  }

  note.value = ''
  activePanel.value = 'records'
  playPointsSound(amount)
  return true
}

function applyPointAmount(amount) {
  if (targetMode.value === 'group') {
    createGroupRecord(amount, selectedReason.value)
    return
  }

  createRecord(amount, selectedReason.value)
}

function applyQuickAmount(amount) {
  applyPointAmount(amount)
}

function applyCustomAmount() {
  applyPointAmount(customDelta.value)
}

function deleteRecord(recordId) {
  records.value = records.value.filter(record => record.id !== recordId)
}

function resetAllPoints() {
  if (confirm('確定要清空所有積分紀錄嗎？這會讓全班積分歸零。')) {
    records.value = []
  }
}

function redeemReward(reward) {
  if (!selectedStudent.value) return
  const cost = Math.abs(Number(reward.cost) || 0)

  if (cost <= 0) {
    alert('獎勵需要設定大於 0 的分數。')
    return
  }

  if (selectedTotal.value < cost) {
    alert(`${selectedStudent.value.name} 目前 ${selectedTotal.value} 分，還不能兌換「${reward.name}」。`)
    return
  }

  if (confirm(`確定讓 ${selectedStudent.value.name} 兌換「${reward.name}」並扣 ${cost} 分嗎？`)) {
    createRecord(-cost, `兌換：${reward.name}`, '', 'redeem')
    activePanel.value = 'records'
  }
}

function addReward() {
  const name = newRewardName.value.trim()
  const cost = Math.abs(Number(newRewardCost.value))

  if (!name || !Number.isFinite(cost) || cost <= 0) {
    alert('請輸入獎勵名稱，以及大於 0 的兌換分數。')
    return
  }

  rewards.value.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    cost,
    enabled: true
  })

  newRewardName.value = ''
  newRewardCost.value = 10
}

function removeReward(rewardId) {
  if (confirm('確定要移除這個獎勵項目嗎？')) {
    rewards.value = rewards.value.filter(reward => reward.id !== rewardId)
  }
}

function exportPoints() {
  const payload = {
    exportedAt: new Date().toISOString(),
    className: className.value,
    pointRecords: records.value,
    pointRewards: rewards.value,
    note: 'POINTS_V5_CONFIRMED_WITH_SEATS_20260707 / POINTS_SEATS_EXACT_KEY_20260707 / POINTS_REWARD_SYSTEM_20260707_NO_LIBRARY'
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeFileName(className.value)}-積分備份-${getLocalDateKey()}.json`
  link.click()
  URL.revokeObjectURL(url)
}

function triggerImport() {
  importInput.value?.click()
}

function importPoints(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'))
      const nextRecords = parsed.pointRecords || parsed.records || []
      const nextRewards = parsed.pointRewards || parsed.rewards || rewards.value

      if (!Array.isArray(nextRecords) || !Array.isArray(nextRewards)) {
        throw new Error('備份格式不正確')
      }

      if (confirm('確定要匯入積分備份嗎？目前的積分紀錄會被備份檔取代。')) {
        records.value = nextRecords
        rewards.value = nextRewards
      }
    } catch (error) {
      alert('匯入失敗，請確認是否為積分備份 JSON 檔。')
      console.error(error)
    } finally {
      event.target.value = ''
    }
  }
  reader.readAsText(file)
}
</script>

<template>
  <!-- POINTS_V5_CONFIRMED_WITH_SEATS_20260707 -->
  <!-- POINTS_REWARD_SYSTEM_20260707_NO_LIBRARY -->
  <div class="page points-page">
    <div class="page-title-row points-title-row">
      <div>
        <h2>⭐ 積分獎勵</h2>
        <p>獨立記錄個人積分與兌換獎勵；班書借閱先不納入積分。</p>
      </div>
      <div class="points-tools">
        <button type="button" class="soft-button sound-button" @click="togglePointSound">{{ audioEnabled ? '🔊 音效開啟' : '🔇 音效關閉' }}</button>
        <button type="button" class="soft-button" @click="exportPoints">匯出積分</button>
        <button type="button" class="soft-button" @click="triggerImport">匯入積分</button>
        <button type="button" class="soft-danger" @click="resetAllPoints">清空紀錄</button>
        <input ref="importInput" class="hidden-file" type="file" accept="application/json" @change="importPoints" />
      </div>
    </div>

    <section v-if="students.length === 0" class="card empty-points-state">
      <div>🌱</div>
      <h3>還沒有學生名單</h3>
      <p>請先到「學生名單」貼上座號與姓名，積分頁就會自動共用同一份名單。</p>
    </section>

    <section v-else class="points-layout">
      <aside class="card compact-card points-students-card">
        <div class="points-summary">
          <span>{{ className || '班級' }}</span>
          <strong>全班 {{ totalPoints }} 分</strong>
        </div>

        <div class="points-student-grid">
          <button
            v-for="student in studentScoreCards"
            :key="student.key"
            type="button"
            class="points-student-card"
            :class="{ selected: selectedKey === student.key }"
            @click="selectStudent(student)"
          >
            <span class="points-seat">{{ String(student.seatNo).padStart(2, '0') }}</span>
            <strong>{{ student.name }}</strong>
            <em>{{ student.total }} 分</em>
          </button>
        </div>
      </aside>

      <section class="card compact-card points-action-card">
        <div class="target-toggle" aria-label="選擇個人或小組加分">
          <button type="button" :class="{ active: targetMode === 'student' }" @click="targetMode = 'student'">👤 個人加分</button>
          <button type="button" :class="{ active: targetMode === 'group' }" @click="targetMode = 'group'">👥 小組加分</button>
        </div>

        <div v-if="targetMode === 'student' && selectedStudent" class="selected-student-box">
          <span>目前選取</span>
          <h3>{{ selectedStudent.name }}（{{ selectedStudent.seatNo }}）</h3>
          <strong>{{ selectedTotal }} 分</strong>
        </div>

        <div v-else class="group-point-box">
          <div class="group-source-row" :class="{ fallback: groupSourceIsFallback }">
            <span>{{ groupSourceLabel }}</span>
            <button type="button" @click="refreshSeatGroups">重新讀取座位分組</button>
          </div>

          <div v-if="groupSourceIsFallback" class="group-size-row">
            <label>
              暫用每組人數
              <input v-model.number="groupSize" type="number" min="2" max="10" />
            </label>
            <span>若要完全依照「座位安排」分組，請確認座位安排頁已儲存分組資料。</span>
          </div>

          <div v-if="selectedGroup" class="selected-student-box group-selected-box">
            <span>目前小組</span>
            <h3>{{ selectedGroup.name }}</h3>
            <p>{{ selectedGroupMemberNames }}</p>
            <strong>{{ selectedGroup.total }} 分</strong>
          </div>

          <div class="points-group-grid">
            <button
              v-for="group in pointGroups"
              :key="group.id"
              type="button"
              class="points-group-card"
              :class="{ selected: selectedGroupId === group.id }"
              @click="selectedGroupId = group.id"
            >
              <strong>{{ group.name }}</strong>
              <span>{{ group.members.map(member => member.seatNo).join('、') }} 號</span>
              <em>全組 {{ group.total }} 分</em>
            </button>
          </div>
        </div>

        <div class="reason-block">
          <h4>加分原因</h4>
          <div class="reason-chips">
            <button
              v-for="reason in positiveReasons"
              :key="reason"
              type="button"
              class="reason-chip"
              :class="{ active: selectedReason === reason }"
              @click="selectedReason = reason"
            >
              {{ reason }}
            </button>
          </div>
        </div>

        <div class="reason-block">
          <h4>提醒原因</h4>
          <div class="reason-chips">
            <button
              v-for="reason in remindReasons"
              :key="reason"
              type="button"
              class="reason-chip remind"
              :class="{ active: selectedReason === reason }"
              @click="selectedReason = reason"
            >
              {{ reason }}
            </button>
          </div>
        </div>

        <div class="quick-point-buttons">
          <button
            v-for="amount in quickAmounts"
            :key="amount"
            type="button"
            :class="amount > 0 ? 'point-plus' : 'point-minus'"
            @click="applyQuickAmount(amount)"
          >
            {{ targetMode === 'group' ? `全組 ${amount > 0 ? '+' + amount : amount}` : amount > 0 ? `+${amount}` : amount }}
          </button>
        </div>

        <div class="custom-point-row">
          <input v-model.number="customDelta" type="number" placeholder="自訂分數" />
          <button type="button" @click="applyCustomAmount">套用自訂</button>
        </div>

        <textarea v-model="note" placeholder="備註可不填，例如：幫忙整理講桌、主動提醒同學……"></textarea>
      </section>

      <aside class="card compact-card points-side-card">
        <div class="points-tabs">
          <button type="button" :class="{ active: activePanel === 'records' }" @click="activePanel = 'records'">今日紀錄</button>
          <button type="button" :class="{ active: activePanel === 'ranking' }" @click="activePanel = 'ranking'">排行亮點</button>
          <button type="button" :class="{ active: activePanel === 'rewards' }" @click="activePanel = 'rewards'">獎勵兌換</button>
        </div>

        <div v-if="activePanel === 'records'" class="panel-scroll">
          <p v-if="todayRecords.length === 0" class="hint center-hint">今天還沒有積分紀錄。</p>
          <article v-for="record in todayRecords" :key="record.id" class="record-item">
            <div>
              <strong>{{ record.name }}（{{ record.seatNo }}）</strong>
              <p>{{ record.reason }}<span v-if="record.note">｜{{ record.note }}</span></p>
              <small>{{ formatTime(record.createdAt) }}</small>
            </div>
            <div class="record-score" :class="record.delta > 0 ? 'plus' : 'minus'">
              {{ record.delta > 0 ? `+${record.delta}` : record.delta }}
            </div>
            <button type="button" class="delete-record" @click="deleteRecord(record.id)">×</button>
          </article>

          <details v-if="latestRecords.length > todayRecords.length" class="history-details">
            <summary>查看最近紀錄</summary>
            <article v-for="record in latestRecords" :key="`latest-${record.id}`" class="record-item small">
              <div>
                <strong>{{ record.name }}（{{ record.seatNo }}）</strong>
                <p>{{ record.reason }}</p>
                <small>{{ formatTime(record.createdAt) }}</small>
              </div>
              <div class="record-score" :class="record.delta > 0 ? 'plus' : 'minus'">
                {{ record.delta > 0 ? `+${record.delta}` : record.delta }}
              </div>
            </article>
          </details>
        </div>

        <div v-else-if="activePanel === 'ranking'" class="panel-scroll">
          <h4>本週亮點</h4>
          <p v-if="weekStars.length === 0" class="hint">本週還沒有加分紀錄。</p>
          <ol v-else class="star-list">
            <li v-for="student in weekStars" :key="`star-${student.key}`">
              <span>{{ student.name }}（{{ student.seatNo }}）</span>
              <strong>+{{ student.total }}</strong>
            </li>
          </ol>

          <h4>目前積分</h4>
          <ol class="ranking-list">
            <li v-for="student in ranking" :key="`rank-${student.key}`">
              <span>{{ student.name }}（{{ student.seatNo }}）</span>
              <strong>{{ student.total }}</strong>
            </li>
          </ol>
        </div>

        <div v-else class="panel-scroll">
          <div class="reward-form">
            <input v-model="newRewardName" placeholder="新增獎勵名稱" />
            <input v-model.number="newRewardCost" type="number" min="1" placeholder="分數" />
            <button type="button" @click="addReward">新增</button>
          </div>

          <article v-for="reward in enabledRewards" :key="reward.id" class="reward-item">
            <div>
              <strong>{{ reward.name }}</strong>
              <p>{{ reward.cost }} 分可兌換</p>
            </div>
            <div class="reward-actions">
              <button type="button" @click="redeemReward(reward)">兌換</button>
              <button type="button" class="delete-record" @click="removeReward(reward.id)">×</button>
            </div>
          </article>
        </div>
      </aside>
    </section>
  </div>
</template>

<style scoped>
.points-page {
  max-width: 1280px;
}

.points-title-row {
  align-items: center;
}

.points-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.soft-button {
  background: #f4fbf7;
  color: #2f6f57;
  border: 1px solid #cfe9dd;
}

.hidden-file {
  display: none;
}

.empty-points-state {
  text-align: center;
  color: #667085;
}

.empty-points-state div {
  font-size: 52px;
}

.points-layout {
  display: grid;
  grid-template-columns: minmax(340px, .95fr) minmax(320px, 1fr) minmax(320px, 1.05fr);
  gap: 16px;
  align-items: stretch;
  min-height: calc(100vh - 136px);
}

.points-students-card,
.points-action-card,
.points-side-card {
  min-height: 0;
}

.points-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  color: #667085;
  font-weight: 900;
}

.points-summary strong {
  color: #2f6f57;
  background: #dff3ea;
  border-radius: 999px;
  padding: 6px 10px;
}

.points-student-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  max-height: calc(100vh - 222px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px 10px 18px 4px;
  align-content: start;
  scroll-padding-bottom: 18px;
  scrollbar-gutter: stable;
}

.points-student-card {
  min-height: 82px;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 3px;
  padding: 8px 6px;
  background: #fffaf2;
  color: #243b53;
  border: 2px solid #eadfce;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(92, 74, 49, .08);
}

.points-student-card.selected {
  background: #f0fdf4;
  border-color: #6bbf95;
  box-shadow: 0 0 0 3px rgba(107, 191, 149, .18);
}

.points-seat {
  min-width: 32px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #efe2cc;
  color: #6a5538;
  font-size: 12px;
  font-weight: 950;
}

.points-student-card strong {
  font-size: 16px;
  line-height: 1.18;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.points-student-card em {
  color: #2f6f57;
  font-style: normal;
  font-weight: 950;
  font-size: 14px;
}

.sound-button {
  white-space: nowrap;
}

.target-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.target-toggle button {
  padding: 10px 12px;
  border-radius: 16px;
  background: #f8fafc;
  color: #475569;
  border: 1px solid #e5e7eb;
}

.target-toggle button.active {
  background: #dff3ea;
  color: #2f6f57;
  border-color: #9fd8bf;
  box-shadow: 0 0 0 3px rgba(107, 191, 149, .14);
}

.group-point-box {
  display: grid;
  gap: 10px;
}


.group-source-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 16px;
  background: #f0fdf4;
  color: #2f6f57;
  border: 1px solid #cfe9dd;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.4;
}

.group-source-row.fallback {
  background: #fff7ed;
  color: #9a3412;
  border-color: #fed7aa;
}

.group-source-row button {
  padding: 7px 9px;
  border-radius: 12px;
  background: #ffffff;
  color: #2f6f57;
  border: 1px solid #cfe9dd;
  font-size: 12px;
  white-space: nowrap;
}

.group-size-row {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 10px;
  color: #667085;
  font-size: 13px;
  font-weight: 850;
}

.group-size-row label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #2f6f57;
  white-space: nowrap;
}

.group-size-row input {
  width: 64px;
  border: 2px solid #dceee6;
  border-radius: 12px;
  padding: 7px 8px;
  font-size: 14px;
  background: #fffdfa;
}

.selected-student-box {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 12px;
  align-items: center;
  padding: 16px;
  border-radius: 22px;
  background: linear-gradient(135deg, #f4fbf7, #fffaf2);
  border: 1px solid #dceee6;
}

.selected-student-box span {
  color: #667085;
  font-size: 13px;
  font-weight: 900;
}

.selected-student-box h3 {
  grid-column: 1;
  margin: 0;
  font-size: 28px;
  color: #2f6f57;
}

.selected-student-box strong {
  grid-row: 1 / span 2;
  grid-column: 2;
  font-size: 34px;
  color: #8a5600;
  background: #fff0c2;
  border-radius: 18px;
  padding: 10px 14px;
}

.group-selected-box p {
  grid-column: 1 / -1;
  margin: 0;
  color: #667085;
  font-weight: 800;
  line-height: 1.45;
}

.points-group-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.points-group-card {
  min-height: 72px;
  display: grid;
  gap: 2px;
  justify-items: center;
  align-content: center;
  padding: 8px;
  border-radius: 16px;
  background: #fffaf2;
  color: #243b53;
  border: 2px solid #eadfce;
}

.points-group-card.selected {
  background: #f0fdf4;
  border-color: #6bbf95;
  box-shadow: 0 0 0 3px rgba(107, 191, 149, .16);
}

.points-group-card span {
  color: #667085;
  font-size: 13px;
  font-weight: 850;
}

.points-group-card em {
  color: #2f6f57;
  font-style: normal;
  font-weight: 950;
  font-size: 13px;
}

.reason-block {
  margin-top: 14px;
}

.reason-block h4,
.points-side-card h4 {
  margin: 0 0 8px;
  color: #2f6f57;
}

.reason-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.reason-chip {
  background: #f4fbf7;
  color: #2f6f57;
  border: 1px solid #cfe9dd;
  padding: 8px 11px;
  border-radius: 999px;
  font-size: 14px;
}

.reason-chip.remind {
  background: #fff7ed;
  color: #9a3412;
  border-color: #fed7aa;
}

.reason-chip.active {
  background: #6bbf95;
  color: white;
  border-color: #6bbf95;
}

.quick-point-buttons {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-top: 16px;
}

.quick-point-buttons button {
  min-height: 56px;
  font-size: 20px;
  line-height: 1.12;
  border-radius: 18px;
}

.point-plus {
  background: #6bbf95;
}

.point-minus {
  background: #e9897e;
}

.custom-point-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  margin-top: 10px;
}

.custom-point-row input,
.points-action-card textarea,
.reward-form input {
  min-width: 0;
  border: 2px solid #dceee6;
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 15px;
  background: #fffdfa;
}

.points-action-card textarea {
  width: 100%;
  min-height: 76px;
  margin-top: 10px;
  resize: vertical;
  line-height: 1.6;
}

.points-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.points-tabs button {
  padding: 9px 8px;
  border-radius: 14px;
  background: #f8fafc;
  color: #475569;
  border: 1px solid #e5e7eb;
  font-size: 14px;
}

.points-tabs button.active {
  background: #dff3ea;
  color: #2f6f57;
  border-color: #cfe9dd;
}

.panel-scroll {
  max-height: calc(100vh - 210px);
  overflow: auto;
  padding-right: 2px;
}

.center-hint {
  text-align: center;
  margin-top: 32px;
}

.record-item,
.reward-item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
  align-items: center;
  padding: 10px;
  border-radius: 16px;
  background: #fffdfa;
  border: 1px solid #f1e6d8;
  margin-bottom: 8px;
}

.record-item.small {
  opacity: .86;
}

.record-item strong,
.reward-item strong {
  color: #243b53;
}

.record-item p,
.reward-item p {
  margin: 3px 0;
  color: #667085;
  font-weight: 750;
  line-height: 1.35;
}

.record-item small {
  color: #94a3b8;
  font-weight: 850;
}

.record-score {
  min-width: 46px;
  text-align: center;
  border-radius: 999px;
  padding: 7px 8px;
  font-weight: 950;
}

.record-score.plus {
  background: #dcfce7;
  color: #166534;
}

.record-score.minus {
  background: #fee2e2;
  color: #991b1b;
}

.delete-record {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  flex: 0 0 30px;
  padding: 0;
  border-radius: 999px;
  background: #f8fafc;
  color: #94a3b8;
  border: 1px solid #e5e7eb;
  font-size: 0;
  line-height: 1;
  text-align: center;
  appearance: none;
}

.delete-record::before {
  content: '×';
  display: block;
  font-size: 18px;
  line-height: 1;
  transform: translateY(-1px);
}

.history-details {
  margin-top: 10px;
}

.history-details summary {
  cursor: pointer;
  color: #2f6f57;
  font-weight: 900;
  margin-bottom: 8px;
}

.star-list,
.ranking-list {
  display: grid;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
}

.star-list li,
.ranking-list li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #fffdfa;
  border: 1px solid #f1e6d8;
  font-weight: 900;
}

.star-list strong,
.ranking-list strong {
  color: #2f6f57;
}

.reward-form {
  display: grid;
  grid-template-columns: 1fr 82px auto;
  gap: 8px;
  margin-bottom: 12px;
}

.reward-form button,
.reward-actions button {
  padding: 9px 11px;
  font-size: 14px;
  border-radius: 12px;
}

.reward-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.reward-actions .delete-record {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  flex: 0 0 30px;
  padding: 0;
  border-radius: 999px;
  font-size: 0;
  line-height: 1;
}

@media (max-width: 1120px) {
  .points-layout {
    grid-template-columns: 1fr 1fr;
  }

  .points-side-card {
    grid-column: 1 / -1;
  }

  .panel-scroll {
    max-height: 420px;
  }
}

@media (max-width: 760px) {
  .points-title-row {
    align-items: stretch;
  }

  .points-tools {
    justify-content: flex-start;
  }

  .points-layout {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .points-student-grid,
  .panel-scroll {
    max-height: none;
  }

  .points-student-grid {
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  }

  .group-size-row,
  .points-group-grid {
    grid-template-columns: 1fr;
  }

  .quick-point-buttons {
    grid-template-columns: repeat(3, 1fr);
  }

  .custom-point-row,
  .reward-form {
    grid-template-columns: 1fr;
  }
}
</style>
