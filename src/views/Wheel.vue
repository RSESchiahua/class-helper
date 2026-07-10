<template>
  <div class="wheel-page">
    <section class="wheel-header">
      <div>
        <h2>🎡 抽籤轉盤</h2>
        <p>公平、隨機、可愛又有音效的小幫手。</p>
      </div>
      <button class="sound-toggle" type="button" @click="soundOn = !soundOn">
        {{ soundOn ? '🔊 音效開啟' : '🔇 音效關閉' }}
      </button>
    </section>

    <section class="wheel-layout">
      <main class="wheel-stage">
        <div class="pointer">⭐</div>
        <div class="wheel-wrap">
          <div class="wheel" :style="wheelStyle">
            <div
              v-for="(item, index) in wheelItems"
              :key="item + index"
              class="slice-label"
              :style="labelStyle(index)"
            >
              <span>{{ item }}</span>
            </div>
          </div>
          <div class="wheel-center">
            <div class="star">⭐</div>
            <small>幸運抽籤</small>
          </div>
        </div>

        <div class="wheel-bottom">
          <div class="action-row">
            <button class="draw-button" type="button" :disabled="isSpinning || wheelItems.length === 0" @click="startDraw">
              {{ isSpinning ? '抽籤中...' : `▶ 開始抽籤${drawCount > 1 ? ` ${drawCount} 人` : ''}` }}
            </button>
            <button class="soft-button" type="button" :disabled="isSpinning" @click="resetWheel">↻ 重設轉盤</button>
          </div>

          <div class="result-card" :class="{ show: latestResults.length }">
            <div class="confetti">🎉 ✨ 🎊</div>
            <p>抽中囉！</p>
            <strong>{{ latestResults.length ? latestResults.join('、') : '準備開始' }}</strong>
          </div>
        </div>
      </main>

      <aside class="control-panel">
        <div class="panel-card">
          <h3>1 選擇抽籤類型</h3>
          <div class="segmented">
            <button :class="{ active: mode === 'students' }" @click="mode = 'students'">👤 抽人</button>
            <button :class="{ active: mode === 'groups' }" @click="mode = 'groups'">👥 抽組</button>
            <button :class="{ active: mode === 'custom' }" @click="mode = 'custom'">✏️ 自訂</button>
          </div>
        </div>

        <div class="panel-card compact">
          <h3>2 名單設定</h3>
          <template v-if="mode === 'students'">
            <p class="hint">自動讀取「學生名單」資料。若尚未建立，會先用 1～29 號。</p>
          </template>
          <template v-else-if="mode === 'groups'">
            <label class="field-label">組數</label>
            <div class="stepper">
              <button @click="groupCount = Math.max(1, groupCount - 1)">−</button>
              <input v-model.number="groupCount" type="number" min="1" max="12" />
              <button @click="groupCount = Math.min(12, groupCount + 1)">＋</button>
            </div>
          </template>
          <template v-else>
            <label class="field-label">自訂內容，每行一個</label>
            <textarea v-model="customText" rows="4" placeholder="例如：掃地\n擦黑板\n發簿本"></textarea>
          </template>
        </div>

        <div class="panel-card compact">
          <h3>3 抽取設定</h3>
          <div class="setting-line">
            <span>連抽數量</span>
            <div class="stepper small">
              <button @click="drawCount = Math.max(1, drawCount - 1)">−</button>
              <input v-model.number="drawCount" type="number" min="1" :max="Math.max(1, availableItems.length)" />
              <button @click="drawCount = Math.min(Math.max(1, availableItems.length), drawCount + 1)">＋</button>
            </div>
          </div>
          <label class="check-line">
            <input v-model="excludeDrawn" type="checkbox" />
            <span>抽過後自動排除，不重複抽到</span>
          </label>
        </div>

        <div class="panel-card results">
          <div class="panel-title-row">
            <h3>已抽出結果（{{ drawnItems.length }}）</h3>
            <button class="clear" type="button" @click="clearHistory">🗑 清空</button>
          </div>
          <ol v-if="drawnItems.length">
            <li v-for="(item, index) in drawnItems" :key="item + index">
              <span class="rank">{{ index + 1 }}</span>
              <b>{{ item }}</b>
              <button type="button" @click="removeDrawn(index)">×</button>
            </li>
          </ol>
          <p v-else class="empty">尚未抽出任何項目。</p>
        </div>
      </aside>
    </section>

    <footer class="tips">
      💡 小提醒：抽過的項目會自動排除；需要重新開始時，按「重設轉盤」即可。
    </footer>
  </div>
</template>

<script setup>
// ✅ HUA_WHEEL_ONE_SCREEN_MOBILE_REVIEW_20260710：此頁已加入桌機一頁式與手機響應式檢查。
import { computed, nextTick, ref, watch } from 'vue'

const mode = ref('students')
const soundOn = ref(true)
const isSpinning = ref(false)
const rotation = ref(0)
const latestResults = ref([])
const drawnItems = ref([])
const excludeDrawn = ref(true)
const drawCount = ref(1)
const groupCount = ref(6)
const customText = ref('掃地\n擦黑板\n發簿本\n收作業\n領餐桶\n整理書櫃')

const palette = ['#ffe3e0', '#fff0c2', '#dff3d8', '#d8efff', '#eadcff', '#ffe1f2', '#dff5ef', '#fff6d8']

const students = computed(() => {
  const text = localStorage.getItem('students') || ''
  const names = text.split('\n').map(n => n.trim()).filter(Boolean)
  return names.length ? names : Array.from({ length: 29 }, (_, i) => `${i + 1}號`)
})

const groups = computed(() => Array.from({ length: Number(groupCount.value) || 1 }, (_, i) => `第 ${i + 1} 組`))

const customItems = computed(() => customText.value.split('\n').map(n => n.trim()).filter(Boolean))

const sourceItems = computed(() => {
  if (mode.value === 'groups') return groups.value
  if (mode.value === 'custom') return customItems.value
  return students.value
})

const availableItems = computed(() => {
  if (!excludeDrawn.value) return sourceItems.value
  const drawn = new Set(drawnItems.value)
  return sourceItems.value.filter(item => !drawn.has(item))
})

const wheelItems = computed(() => availableItems.value.length ? availableItems.value : sourceItems.value)

const wheelStyle = computed(() => {
  const items = wheelItems.value
  const slice = 360 / Math.max(items.length, 1)
  const stops = items.map((_, i) => {
    const color = palette[i % palette.length]
    return `${color} ${i * slice}deg ${(i + 1) * slice}deg`
  }).join(', ')
  return {
    background: `conic-gradient(${stops})`,
    transform: `rotate(${rotation.value}deg)`
  }
})

function labelStyle(index) {
  const count = Math.max(wheelItems.value.length, 1)
  const angle = (360 / count) * index + 360 / count / 2
  return {
    transform: `rotate(${angle}deg) translateY(-128px) rotate(90deg)`,
    fontSize: count > 24 ? '13px' : count > 16 ? '15px' : '18px'
  }
}

function playSpinSound() {
  if (!soundOn.value) return
  const audio = new AudioContext()
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(360, audio.currentTime)
  osc.frequency.exponentialRampToValueAtTime(920, audio.currentTime + 0.35)
  gain.gain.setValueAtTime(0.04, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.38)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start()
  osc.stop(audio.currentTime + 0.38)
}

function playWinSound() {
  if (!soundOn.value) return
  const audio = new AudioContext()
  ;[523, 659, 784, 1046].forEach((freq, i) => {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, audio.currentTime + i * 0.08)
    gain.gain.setValueAtTime(0.07, audio.currentTime + i * 0.08)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + i * 0.08 + 0.22)
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start(audio.currentTime + i * 0.08)
    osc.stop(audio.currentTime + i * 0.08 + 0.22)
  })
}

async function startDraw() {
  if (isSpinning.value || !availableItems.value.length) return
  latestResults.value = []
  const count = Math.min(Math.max(1, Number(drawCount.value) || 1), availableItems.value.length)
  const pool = [...availableItems.value]
  const winners = []

  isSpinning.value = true
  playSpinSound()
  rotation.value += 1080 + Math.floor(Math.random() * 720)
  await wait(900)

  for (let i = 0; i < count; i++) {
    const pickIndex = Math.floor(Math.random() * pool.length)
    const winner = pool.splice(pickIndex, 1)[0]
    winners.push(winner)
    if (i < count - 1) {
      playSpinSound()
      rotation.value += 360 + Math.floor(Math.random() * 360)
      await wait(420)
    }
  }

  latestResults.value = winners
  if (excludeDrawn.value) drawnItems.value.push(...winners)
  else drawnItems.value.push(...winners)
  playWinSound()
  await nextTick()
  isSpinning.value = false
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function resetWheel() {
  drawnItems.value = []
  latestResults.value = []
  rotation.value = 0
}

function clearHistory() {
  drawnItems.value = []
  latestResults.value = []
}

function removeDrawn(index) {
  drawnItems.value.splice(index, 1)
}

watch(mode, () => {
  latestResults.value = []
  drawnItems.value = []
  drawCount.value = 1
})
</script>

<style scoped>
.wheel-page {
  height: calc(100vh - 64px);
  overflow: hidden;
  padding: 24px 28px 14px;
  color: #2f3a4a;
  background:
    radial-gradient(circle at 20% 10%, rgba(255, 226, 189, .5), transparent 28%),
    radial-gradient(circle at 75% 18%, rgba(213, 238, 255, .7), transparent 26%),
    linear-gradient(135deg, #fffaf1, #f8fbff);
}

.wheel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.wheel-header h2 {
  margin: 0 0 4px;
  font-size: 30px;
}

.wheel-header p {
  margin: 0;
  color: #7b8794;
  font-weight: 600;
}

.sound-toggle,
.soft-button,
.draw-button,
.segmented button,
.stepper button,
.clear {
  border: 0;
  cursor: pointer;
  font-weight: 800;
}

.sound-toggle,
.soft-button {
  background: white;
  border: 1px solid #f0dfc8;
  color: #6b5a48;
  border-radius: 16px;
  padding: 12px 18px;
  box-shadow: 0 6px 16px rgba(111, 78, 55, .08);
}

.wheel-layout {
  display: grid;
  grid-template-columns: minmax(540px, 1fr) 420px;
  gap: 18px;
  height: calc(100% - 72px);
}

.wheel-stage,
.control-panel {
  min-height: 0;
}

.wheel-stage {
  /* 確認關鍵字：WHEEL_RESET_NO_OVERLAP_20260707 */
  position: relative;
  border-radius: 28px;
  background: rgba(255, 255, 255, .78);
  border: 1px solid rgba(255, 211, 138, .7);
  box-shadow: 0 14px 40px rgba(99, 73, 43, .1);
  display: grid;
  place-items: center;
  grid-template-rows: 1fr auto;
  gap: 10px;
  padding: 16px 20px 18px;
}

.pointer {
  position: absolute;
  top: 22px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(#ffd978, #ffb84f);
  border: 4px solid #fff4cf;
  border-radius: 999px;
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  font-size: 28px;
  z-index: 4;
  box-shadow: 0 8px 18px rgba(198, 132, 36, .28);
}

.wheel-wrap {
  position: relative;
  width: min(58vh, 510px);
  height: min(58vh, 510px);
  margin-top: 6px;
}

.wheel {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 16px solid #ffc85c;
  box-shadow: inset 0 0 0 6px rgba(255, 255, 255, .75), 0 16px 30px rgba(181, 129, 53, .2);
  transition: transform 1s cubic-bezier(.12,.72,.18,1);
  position: relative;
  overflow: hidden;
}

.wheel::after {
  content: '';
  position: absolute;
  inset: 14px;
  border-radius: 50%;
  border: 2px dashed rgba(255,255,255,.75);
}

.slice-label {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 90px;
  margin-left: -45px;
  transform-origin: center 0;
  text-align: center;
  font-weight: 900;
  color: #4d3c2f;
  text-shadow: 0 1px 0 rgba(255,255,255,.75);
}

.slice-label span {
  display: inline-block;
  max-width: 86px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wheel-center {
  position: absolute;
  inset: 50%;
  transform: translate(-50%, -50%);
  width: 132px;
  height: 132px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #fffdf5;
  border: 6px solid #ffd16b;
  box-shadow: 0 8px 22px rgba(180, 120, 36, .22);
  font-weight: 900;
  color: #a8752b;
}

.star { font-size: 54px; line-height: 1; }

.wheel-bottom {
  width: min(100%, 650px);
  display: grid;
  grid-template-columns: minmax(350px, auto) minmax(190px, 240px);
  gap: 14px;
  align-items: stretch;
  justify-content: center;
}

.action-row {
  position: relative;
  z-index: 3;
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  margin-top: 0;
}

.draw-button {
  min-width: 230px;
  background: linear-gradient(180deg, #73c463, #54aa46);
  color: white;
  border-radius: 22px;
  padding: 17px 30px;
  font-size: 22px;
  box-shadow: 0 8px 0 #3d8434, 0 16px 28px rgba(78, 145, 65, .22);
}

.draw-button:disabled { opacity: .6; cursor: not-allowed; }

.result-card {
  position: static;
  width: auto;
  min-height: 92px;
  border-radius: 22px;
  background: #fff8df;
  border: 2px solid #ffe1a1;
  padding: 12px 14px;
  text-align: center;
  opacity: .42;
  transform: scale(.98);
  transition: .25s ease;
  pointer-events: none;
  display: grid;
  place-items: center;
}
.result-card.show { opacity: 1; transform: scale(1); }
.result-card p { margin: 2px 0; font-weight: 900; color: #9a6a28; }
.result-card strong {
  max-width: 210px;
  font-size: 24px;
  line-height: 1.15;
  color: #e5842f;
  word-break: break-word;
}
.confetti { font-size: 22px; line-height: 1; }

.control-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.panel-card {
  background: rgba(255,255,255,.88);
  border: 1px solid #f0dfc8;
  border-radius: 22px;
  padding: 16px;
  box-shadow: 0 10px 26px rgba(99, 73, 43, .08);
}
.panel-card.compact { padding: 14px 16px; }
.panel-card h3 { margin: 0 0 10px; font-size: 17px; color: #4f6f39; }

.segmented { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.segmented button {
  padding: 12px 8px;
  border-radius: 14px;
  background: #f5f7fb;
  color: #5a6b80;
  border: 1px solid #e6edf5;
}
.segmented button.active {
  background: #e9f8df;
  color: #3c8a34;
  border-color: #8ad17d;
}

.hint, .empty { color: #7b8794; margin: 0; line-height: 1.55; }
.field-label { display: block; font-weight: 800; margin-bottom: 8px; }
textarea, input {
  width: 100%;
  border: 1px solid #eadbc8;
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 16px;
  background: #fffdf9;
}
textarea { resize: none; }

.setting-line,
.check-line,
.panel-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.check-line { justify-content: flex-start; margin-top: 12px; font-weight: 700; }
.check-line input { width: auto; }

.stepper {
  display: grid;
  grid-template-columns: 42px 80px 42px;
  gap: 6px;
  align-items: center;
}
.stepper.small { grid-template-columns: 36px 66px 36px; }
.stepper button {
  height: 38px;
  border-radius: 12px;
  background: #fff2dc;
  color: #9a6a28;
  font-size: 20px;
}
.stepper input { text-align: center; padding: 8px; }

.results { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.clear { background: transparent; color: #e05a50; }
ol { list-style: none; margin: 0; padding: 0; overflow: auto; }
li {
  display: grid;
  grid-template-columns: 34px 1fr 28px;
  align-items: center;
  gap: 10px;
  padding: 9px 4px;
  border-bottom: 1px solid #f1e6d8;
}
.rank {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #ffe7b8;
  color: #d88922;
  font-weight: 900;
}
li button { border: 0; background: transparent; color: #a98070; font-size: 22px; cursor: pointer; }

.tips {
  height: 34px;
  display: grid;
  place-items: center;
  color: #7f8c8d;
  font-weight: 700;
}

@media (max-width: 1100px) {
  .wheel-page { overflow: auto; height: auto; }
  .wheel-layout { grid-template-columns: 1fr; height: auto; }
  .control-panel { overflow: visible; }
}

@media (max-width: 760px) {
  .wheel-bottom {
    grid-template-columns: 1fr;
  }
  .action-row {
    flex-wrap: wrap;
  }
  .result-card strong {
    max-width: none;
  }
}


/* ✅ HUA_WHEEL_ONE_SCREEN_MOBILE_REVIEW_20260710
   抽籤轉盤：桌機轉盤與設定同頁；手機改成上下排列不擠壓。 */
@media (min-width: 1101px) and (max-height: 820px) {
  .wheel-page {
    height: calc(100svh - 40px) !important;
    padding: 18px 22px 12px !important;
  }

  .wheel-header {
    margin-bottom: 10px !important;
  }

  .wheel-header h2 {
    font-size: 26px !important;
  }

  .wheel-layout {
    grid-template-columns: minmax(460px, 1fr) 360px !important;
    gap: 14px !important;
    height: calc(100% - 64px) !important;
  }

  .panel-card {
    padding: 12px !important;
    border-radius: 18px !important;
  }

  .panel-card h3 {
    font-size: 15px !important;
    margin-bottom: 7px !important;
  }
}

@media (max-width: 760px) {
  .wheel-page {
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    padding: 14px 10px 24px !important;
  }

  .wheel-header {
    flex-direction: column !important;
    align-items: stretch !important;
  }

  .wheel-layout {
    grid-template-columns: 1fr !important;
    height: auto !important;
  }
}

</style>
