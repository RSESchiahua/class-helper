<script setup>
import { ref } from 'vue'

const showCredit = ref(false)
let logoClickCount = 0
let logoTimer = null

function handleLogoClick() {
  logoClickCount += 1
  clearTimeout(logoTimer)

  if (logoClickCount >= 3) {
    showCredit.value = true
    logoClickCount = 0
    return
  }

  logoTimer = setTimeout(() => {
    logoClickCount = 0
  }, 1200)
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <button class="logo-button" type="button" @click="handleLogoClick" aria-label="班級助手標誌">
        <span class="logo-title">📚 班級助手</span>
        <span class="sidebar-subtitle">每天快一點，班級暖一點</span>
      </button>

      <nav>
        <RouterLink to="/">🏠 首頁</RouterLink>
        <RouterLink to="/students">👨‍🎓 學生名單</RouterLink>
        <RouterLink to="/notebook">📚 簿本繳交</RouterLink>
        <RouterLink to="/calendar">🗓️ 行事曆</RouterLink>
        <RouterLink to="/toothbrush">🦷 潔牙消毒</RouterLink>
        <RouterLink to="/library">📖 班書借閱</RouterLink>
        <RouterLink to="/status">🔔 現在狀態</RouterLink>
        <RouterLink to="/cleaning">🧹 打掃分配</RouterLink>
        <RouterLink to="/jobs">⭐ 職務分配</RouterLink>
        <RouterLink to="/seats">🪑 座位安排</RouterLink>
        <RouterLink to="/wheel">🎡 抽籤轉盤</RouterLink>
      </nav>
    </aside>

    <main class="main-content">
      <RouterView />
    </main>

    <div v-if="showCredit" class="credit-overlay" @click.self="showCredit = false">
      <section class="credit-modal" role="dialog" aria-modal="true" aria-label="班級助手製作資訊">
        <button class="credit-close" type="button" @click="showCredit = false">×</button>
        <div class="credit-logo">📚</div>
        <h2>班級助手</h2>
        <p>Created with ❤️<br />by Hua × ChatGPT</p>
      </section>
    </div>
  </div>
</template>
