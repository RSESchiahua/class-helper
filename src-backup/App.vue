<template>
  <div class="app-shell">
    <aside class="sidebar">
      <h1>📚 班級助手</h1>

      <nav>
        <RouterLink to="/">🏠 首頁</RouterLink>
        <RouterLink to="/students">👨‍🎓  學生名單</RouterLink>
        <RouterLink to="/notebook">📚  簿本繳交</RouterLink>
        <RouterLink to="/calendar">🗓️  行事曆</RouterLink>
        <RouterLink to="/toothbrush">🪥  潔牙追蹤</RouterLink>
        <RouterLink to="/library">📖  班書借閱</RouterLink>
        <RouterLink to="/modes">🔔  多元模式</RouterLink>
        <RouterLink to="/wheel">🎡  抽籤轉盤</RouterLink>
      </nav>
    </aside>

    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>