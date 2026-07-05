<script setup>
import { ref, computed, watch } from 'vue'

const className = ref(localStorage.getItem('className') || '')
const studentText = ref(localStorage.getItem('students') || '')

const students = computed(() =>
  studentText.value
    .split('\n')
    .map(name => name.trim())
    .filter(name => name !== '')
)

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
</script>

<template>
  <div class="page">
    <h2>👨‍🎓 學生管理</h2>
    <p>可以先空著，等分班後再貼上完整學生名單。</p>

    <div class="card">
      <h3>🏫 班級名稱</h3>
      <input v-model="className" placeholder="例如：六年三班" />
    </div>

    <div class="card">
      <h3>📋 學生名單</h3>
      <p>一行一位學生，可以直接從名冊複製貼上。</p>

      <textarea
        v-model="studentText"
        placeholder="王小明&#10;李小華&#10;陳小美"
      ></textarea>

      <div class="student-actions">
        <p class="count">目前共 {{ students.length }} 位學生</p>
        <button class="danger" @click="clearStudents">清空名單</button>
      </div>
    </div>

    <div class="card" v-if="students.length > 0">
      <h3>✅ 名單預覽</h3>

      <div class="student-list">
        <div
          v-for="(student, index) in students"
          :key="student + index"
          class="student-item"
        >
          <span class="number">{{ index + 1 }}</span>
          <span>{{ student }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
input,
textarea {
  width: 100%;
  border: 2px solid #dceee6;
  border-radius: 14px;
  padding: 14px;
  font-size: 16px;
  margin-top: 10px;
}

textarea {
  min-height: 180px;
  resize: vertical;
}

.count {
  font-weight: 700;
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

.student-list {
  display: grid;
  gap: 10px;
}

.student-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f4fbf7;
  padding: 12px 14px;
  border-radius: 14px;
}

.number {
  width: 32px;
  height: 32px;
  background: #6bbf95;
  color: white;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 700;
}
</style>