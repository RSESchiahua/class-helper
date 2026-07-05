<script setup>
import { ref, computed } from 'vue'

const className = ref(localStorage.getItem('className') || '')
const studentText = ref(localStorage.getItem('students') || '')

const students = computed(() => {
  return studentText.value
    .split('\n')
    .map(name => name.trim())
    .filter(name => name !== '')
})
</script>

<template>
  <div class="dashboard">
    <h2>🏠 首頁</h2>
    <p>歡迎使用班級助手！</p>

    <div class="card">
      <h3>📚 班級資訊</h3>

      <p v-if="className">
        目前班級：<strong>{{ className }}</strong>
      </p>

      <p v-else>
        目前尚未建立班級
      </p>

      <p>學生人數：{{ students.length }} 位</p>

      <RouterLink class="button-link" to="/students">
        前往學生管理
      </RouterLink>
    </div>

    <div class="card">
      <h3>⚡ 快速功能</h3>

      <div class="quick-grid">
        <RouterLink to="/notebook">📚 簿本繳交</RouterLink>
        <RouterLink to="/calendar">🗓️ 行事曆</RouterLink>
        <RouterLink to="/toothbrush">🪥 潔牙追蹤</RouterLink>
        <RouterLink to="/library">📖 班書借閱</RouterLink>
        <RouterLink to="/modes">🔔 多元模式</RouterLink>
        <RouterLink to="/wheel">🎡 抽籤轉盤</RouterLink>
      </div>
    </div>
  </div>
</template>