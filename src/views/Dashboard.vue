<script setup>
// ✅ HUA_CONTACT_DATE_IN_HEADING_20260710：日期移到「聯絡簿」標題後方，並移除中央分隔線。
// ✅ HUA_VERTICAL_BOOK_DATE_NOTE_LINES_FIX_20260710：日期重排、提示放大置底、移除聯絡簿分隔線。
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { CLOUD_DATA_UPDATED_EVENT } from '../services/cloudSync'

const className = ref(localStorage.getItem('className') || '')
const studentSource = ref(localStorage.getItem('students') || '')


// ✅ HUA_HOME_CONTACT_BOOK_OPTIONAL_20260710：可選的直式聯絡事項，手機可直接編輯。
const showHomeSettings = ref(false)
const isEditingContactBook = ref(false)
const homeDisplay = ref(loadJson('classHelperHomeDisplay', {
  contactBook: true,
  dailyQuote: true,
  reflection: true,
  contactLayout: 'horizontal'
}))
const contactBook = ref(loadJson('classHelperContactBook', {
  homework: '',
  carry: '',
  reminder: ''
}))


// ✅ HUA_FIREBASE_DASHBOARD_LIVE_SYNC_20260711：手機編修聯絡簿後，教室桌機首頁立即更新。
function refreshDashboardFromCloud(event) {
  const keys = new Set(event?.detail?.keys || [])
  if (keys.size === 0 || keys.has('className')) {
    className.value = localStorage.getItem('className') || ''
  }
  if (keys.size === 0 || keys.has('students')) {
    studentSource.value = localStorage.getItem('students') || ''
  }
  if (keys.size === 0 || keys.has('classHelperHomeDisplay')) {
    homeDisplay.value = loadJson('classHelperHomeDisplay', {
      contactBook: true,
      dailyQuote: true,
      reflection: true,
      contactLayout: 'horizontal'
    })
  }
  if (keys.size === 0 || keys.has('classHelperContactBook')) {
    contactBook.value = loadJson('classHelperContactBook', {
      homework: '',
      carry: '',
      reminder: ''
    })
  }
}

onMounted(() => {
  window.addEventListener(CLOUD_DATA_UPDATED_EVENT, refreshDashboardFromCloud)
})

onBeforeUnmount(() => {
  window.removeEventListener(CLOUD_DATA_UPDATED_EVENT, refreshDashboardFromCloud)
})

const contactSections = computed(() => [
  { key: 'homework', icon: '📚', title: '作業', items: toLines(contactBook.value.homework) },
  { key: 'carry', icon: '🎒', title: '攜帶物品', items: toLines(contactBook.value.carry) },
  { key: 'reminder', icon: '📌', title: '提醒', items: toLines(contactBook.value.reminder) }
])

const mergedContactItems = computed(() =>
  contactSections.value.flatMap(section => section.items)
)

const isVerticalContactLayout = computed(() =>
  homeDisplay.value.contactLayout === 'vertical'
)

const verticalDateParts = computed(() => {
  const date = new Date()
  const week = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
  return {
    year: `${date.getFullYear()}年`,
    monthDay: `${date.getMonth() + 1}月${date.getDate()}日`,
    week: `星期${week}`
  }
})

watch(homeDisplay, value => {
  localStorage.setItem('classHelperHomeDisplay', JSON.stringify(value))
}, { deep: true })

watch(contactBook, value => {
  localStorage.setItem('classHelperContactBook', JSON.stringify(value))
}, { deep: true })

function loadJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '')
    return parsed && typeof parsed === 'object' ? { ...fallback, ...parsed } : fallback
  } catch {
    return fallback
  }
}

function toLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
}

function finishContactBookEditing() {
  isEditingContactBook.value = false
}

// ✅ HUA_DAILY_SEL_365_WITH_QUESTION_20260710：365 天每日一句＋SEL 互動提問，依日期固定顯示。
const dailyMessages = [
  {"quote": "慢慢來也沒關係，穩穩地做，就會越來越好。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "今天先做好一件小事，就是很棒的開始。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "努力不一定馬上被看見，但它會慢慢長成力量。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "每一次願意再試一次，都是很勇敢的表現。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "把事情做好，不用急著跟別人比。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "今天的你，只要比昨天多一點點進步就很好。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "專心把眼前的事完成，就是一種厲害。", "question": "今天我想在哪一件學習任務上，多專心一點？"},
  {"quote": "犯錯沒關係，願意修正才是成長。", "question": "今天有哪一件事，我願意誠實面對並試著改進？"},
  {"quote": "安靜努力的人，也會發出自己的光。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "一點一點累積，會變成很可靠的自己。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "遇到困難時，先深呼吸，再一步一步來。", "question": "當情緒出現時，我可以用什麼方法照顧自己？"},
  {"quote": "你不需要完美，只需要願意學習。", "question": "今天我想在哪一件學習任務上，多專心一點？"},
  {"quote": "把話好好說，把事慢慢做，今天就會更順利。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "願意幫助別人，也是在讓班級變得更好。", "question": "今天我可以用哪一個小行動，讓身邊的人感到溫暖？"},
  {"quote": "今天的溫柔和努力，都不會白費。", "question": "今天我可以用哪一個小行動，讓身邊的人感到溫暖？"},
  {"quote": "每個人都有自己的速度，照著自己的步伐前進就好。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "能把小事做好的人，也能完成重要的事。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "別小看今天的一點努力，它正在幫你前進。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "學會等待，也是一種成熟。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "你可以不快，但要記得不要放棄。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "上課專心一點點，收穫就會多一點點。", "question": "今天我想在哪一件學習任務上，多專心一點？"},
  {"quote": "願意聽別人說話，是很珍貴的能力。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "今天也試著做一個讓人安心的同學。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "說一句好話，可能會讓別人的一天變亮。", "question": "今天我可以用哪一個小行動，讓身邊的人感到溫暖？"},
  {"quote": "把自己的座位整理好，也是在整理自己的心情。", "question": "今天我想把哪一件小事做得更有條理？"},
  {"quote": "不懂可以問，願意問就是在學習。", "question": "今天我想在哪一件學習任務上，多專心一點？"},
  {"quote": "每一次舉手，都是勇敢表達自己的練習。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "做事有開始，也要練習好好完成。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "守規矩不是被限制，而是讓大家都安心。", "question": "今天我可以怎麼做，讓班級合作得更順利？"},
  {"quote": "班級變好，是靠每個人一點一點做到的。", "question": "今天我可以怎麼做，讓班級合作得更順利？"},
  {"quote": "今天的任務不一定簡單，但你可以一步一步完成。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "先完成該做的事，再享受休息，會更踏實。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "有禮貌的人，會讓身邊的人感到舒服。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "願意承認錯誤的人，比想像中更勇敢。", "question": "今天有哪一件事，我願意誠實面對並試著改進？"},
  {"quote": "別急著說做不到，先試試看。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "你正在練習成為更穩定的自己。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "好的習慣，是每天小小選擇累積出來的。", "question": "今天我想把哪一件小事做得更有條理？"},
  {"quote": "把心安定下來，事情就會比較容易做好。", "question": "當情緒出現時，我可以用什麼方法照顧自己？"},
  {"quote": "今天也給自己一個認真的開始。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "每個人都可以用自己的方式發光。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "幫忙不是小事，它會讓班級更溫暖。", "question": "今天我可以怎麼做，讓班級合作得更順利？"},
  {"quote": "尊重別人，也是在讓自己變得更好。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "願意排隊、等待、輪流，是很棒的合作。", "question": "今天我可以怎麼做，讓班級合作得更順利？"},
  {"quote": "把事情說清楚，比生氣更有力量。", "question": "當情緒出現時，我可以用什麼方法照顧自己？"},
  {"quote": "今天試著少抱怨一點，多行動一點。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "你的一個微笑，可能會讓同學安心。", "question": "今天我可以用哪一個小行動，讓身邊的人感到溫暖？"},
  {"quote": "學習有時候會卡住，但卡住不代表不能前進。", "question": "今天我想在哪一件學習任務上，多專心一點？"},
  {"quote": "會整理、會負責，就是長大的證明。", "question": "今天我想把哪一件小事做得更有條理？"},
  {"quote": "今天的努力，會變成明天的底氣。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "把簡單的事做好，就是不簡單。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "勇敢不是不害怕，而是害怕時還願意試試看。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "慢一點沒關係，重要的是有在前進。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "願意聽提醒，是讓自己進步的開始。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "每一天都是重新開始的機會。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "今天也可以選擇做一個更好的自己。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "不要只看結果，也要看見自己的努力。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "一個人認真，會帶動更多人認真。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "你的善意，會讓班級更像一個家。", "question": "今天我可以用哪一個小行動，讓身邊的人感到溫暖？"},
  {"quote": "遇到不會的題目，先不要慌，先讀懂它。", "question": "今天我想在哪一件學習任務上，多專心一點？"},
  {"quote": "做好自己的本分，就是對班級最好的幫忙。", "question": "今天我可以怎麼做，讓班級合作得更順利？"},
  {"quote": "今天的你，可以比昨天更有耐心。", "question": "當情緒出現時，我可以用什麼方法照顧自己？"},
  {"quote": "小小的進步，也值得被肯定。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "把心放在該做的事上，你會越來越穩。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "會說謝謝的人，心裡有溫度。", "question": "今天我可以用哪一個小行動，讓身邊的人感到溫暖？"},
  {"quote": "願意道歉，是很有力量的事。", "question": "今天有哪一件事，我願意誠實面對並試著改進？"},
  {"quote": "不要怕慢，只怕一直不開始。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "每一次練習，都是在替未來的自己加油。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "好好完成作業，是對自己負責。", "question": "今天我想在哪一件學習任務上，多專心一點？"},
  {"quote": "今天也記得，先照顧好自己的態度。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "當你願意合作，很多事情都會變簡單。", "question": "今天我可以怎麼做，讓班級合作得更順利？"},
  {"quote": "課堂上的專注，會讓你更接近懂的感覺。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "有些成長很安靜，但它真的正在發生。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "不用急著贏過別人，先學會管理自己。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "願意分享，是讓快樂變大的方法。", "question": "今天我可以用哪一個小行動，讓身邊的人感到溫暖？"},
  {"quote": "把東西歸位，是讓生活變清楚的開始。", "question": "今天我想把哪一件小事做得更有條理？"},
  {"quote": "今天做得好的地方，請記得給自己一點肯定。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "不會沒關係，願意學就有機會。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "每個人都有需要被鼓勵的時候。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "安靜做好事，也是一種很亮的光。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "你今天的選擇，正在塑造明天的自己。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "把時間用好，就是送給自己的禮物。", "question": "今天我想把哪一件小事做得更有條理？"},
  {"quote": "願意守信用的人，會讓人放心。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "先想一想再說話，很多誤會會變少。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "學會控制音量，也是在照顧大家的感受。", "question": "今天我可以怎麼做，讓班級合作得更順利？"},
  {"quote": "今天的一點自律，會換來更多自由。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "好好聽、慢慢想、清楚說，是很棒的學習方式。", "question": "今天我想在哪一件學習任務上，多專心一點？"},
  {"quote": "即使今天不完美，也可以努力把它過好。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "願意改進的人，永遠都有進步的可能。", "question": "今天有哪一件事，我願意誠實面對並試著改進？"},
  {"quote": "你不是一個人在努力，我們一起慢慢變好。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "把心放正，腳步就會更穩。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "今天也請相信，努力會慢慢帶你去想去的地方。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "先做好自己能做的，再期待更好的結果。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "每一次準時、每一次完成，都是可靠的累積。", "question": "今天我想把哪一件小事做得更有條理？"},
  {"quote": "溫柔不是軟弱，是有力量地照顧彼此。", "question": "今天我可以用哪一個小行動，讓身邊的人感到溫暖？"},
  {"quote": "你可以有情緒，但也可以練習好好表達。", "question": "當情緒出現時，我可以用什麼方法照顧自己？"},
  {"quote": "真正的厲害，是願意每天都進步一點。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "讓教室變舒服，從每個人的小動作開始。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "今天也一起把班級變成更溫暖的地方。", "question": "今天我可以怎麼做，讓班級合作得更順利？"},
  {"quote": "學習的路很長，不急，我們一步一步走。", "question": "今天我想在哪一件學習任務上，多專心一點？"},
  {"quote": "穩穩地做，慢慢地好，這就是很棒的成長。", "question": "讀完這句話後，我今天最想練習的是什麼？"},
  {"quote": "即使有點緊張，也願意踏出第一步。", "question": "今天有哪件小事，我願意勇敢試一次？"},
  {"quote": "把「勇氣」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「勇氣」？"},
  {"quote": "真正的勇氣，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「勇氣」？"},
  {"quote": "今天練習一點勇氣，明天的自己就會多一點力量。", "question": "如果今天要把「勇氣」送給班級，我會怎麼做？"},
  {"quote": "勇氣不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「勇氣」？"},
  {"quote": "先想想別人的感受，再決定怎麼說。", "question": "今天我可以怎麼讓同學感到被理解？"},
  {"quote": "把「同理」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「同理」？"},
  {"quote": "真正的同理，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「同理」？"},
  {"quote": "今天練習一點同理，明天的自己就會多一點力量。", "question": "如果今天要把「同理」送給班級，我會怎麼做？"},
  {"quote": "同理不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「同理」？"},
  {"quote": "答應的事情努力做到，會讓人更信任你。", "question": "今天哪一件責任，我要好好完成？"},
  {"quote": "把「責任」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「責任」？"},
  {"quote": "真正的責任，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「責任」？"},
  {"quote": "今天練習一點責任，明天的自己就會多一點力量。", "question": "如果今天要把「責任」送給班級，我會怎麼做？"},
  {"quote": "責任不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「責任」？"},
  {"quote": "誠實不一定輕鬆，卻能讓心裡更踏實。", "question": "今天我可以在哪件事上選擇誠實？"},
  {"quote": "把「誠實」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「誠實」？"},
  {"quote": "真正的誠實，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「誠實」？"},
  {"quote": "今天練習一點誠實，明天的自己就會多一點力量。", "question": "如果今天要把「誠實」送給班級，我會怎麼做？"},
  {"quote": "誠實不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「誠實」？"},
  {"quote": "尊重不是同意每件事，而是願意好好聽。", "question": "今天我會怎麼表現對別人的尊重？"},
  {"quote": "把「尊重」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「尊重」？"},
  {"quote": "真正的尊重，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「尊重」？"},
  {"quote": "今天練習一點尊重，明天的自己就會多一點力量。", "question": "如果今天要把「尊重」送給班級，我會怎麼做？"},
  {"quote": "尊重不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「尊重」？"},
  {"quote": "一起完成，比一個人逞強更有力量。", "question": "今天我可以為小組做哪一件事？"},
  {"quote": "把「合作」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「合作」？"},
  {"quote": "真正的合作，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「合作」？"},
  {"quote": "今天練習一點合作，明天的自己就會多一點力量。", "question": "如果今天要把「合作」送給班級，我會怎麼做？"},
  {"quote": "合作不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「合作」？"},
  {"quote": "沒有人提醒時也能做好，才是真正的進步。", "question": "今天哪件事我想主動做好？"},
  {"quote": "把「自律」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「自律」？"},
  {"quote": "真正的自律，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「自律」？"},
  {"quote": "今天練習一點自律，明天的自己就會多一點力量。", "question": "如果今天要把「自律」送給班級，我會怎麼做？"},
  {"quote": "自律不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「自律」？"},
  {"quote": "多等一下、多聽一句，常常就能少一個誤會。", "question": "今天我可以在哪個時刻多一點耐心？"},
  {"quote": "把「耐心」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「耐心」？"},
  {"quote": "真正的耐心，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「耐心」？"},
  {"quote": "今天練習一點耐心，明天的自己就會多一點力量。", "question": "如果今天要把「耐心」送給班級，我會怎麼做？"},
  {"quote": "耐心不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「耐心」？"},
  {"quote": "看見別人的付出，心裡就會多一點溫暖。", "question": "今天我想謝謝誰？為什麼？"},
  {"quote": "把「感恩」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「感恩」？"},
  {"quote": "真正的感恩，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「感恩」？"},
  {"quote": "今天練習一點感恩，明天的自己就會多一點力量。", "question": "如果今天要把「感恩」送給班級，我會怎麼做？"},
  {"quote": "感恩不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「感恩」？"},
  {"quote": "一個友善的眼神，也能讓人安心。", "question": "今天我可以送出哪一個友善行動？"},
  {"quote": "把「友善」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「友善」？"},
  {"quote": "真正的友善，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「友善」？"},
  {"quote": "今天練習一點友善，明天的自己就會多一點力量。", "question": "如果今天要把「友善」送給班級，我會怎麼做？"},
  {"quote": "友善不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「友善」？"},
  {"quote": "真正的傾聽，是先把自己的答案放一下。", "question": "今天我想認真聽誰說話？"},
  {"quote": "把「傾聽」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「傾聽」？"},
  {"quote": "真正的傾聽，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「傾聽」？"},
  {"quote": "今天練習一點傾聽，明天的自己就會多一點力量。", "question": "如果今天要把「傾聽」送給班級，我會怎麼做？"},
  {"quote": "傾聽不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「傾聽」？"},
  {"quote": "清楚而有禮貌地說出需要，是成熟的能力。", "question": "今天我有什麼需要，可以好好說出來？"},
  {"quote": "把「表達」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「表達」？"},
  {"quote": "真正的表達，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「表達」？"},
  {"quote": "今天練習一點表達，明天的自己就會多一點力量。", "question": "如果今天要把「表達」送給班級，我會怎麼做？"},
  {"quote": "表達不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「表達」？"},
  {"quote": "每個人都有不一樣的長處，也有需要努力的地方。", "question": "今天我想欣賞自己或同學哪個不同？"},
  {"quote": "把「接納」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「接納」？"},
  {"quote": "真正的接納，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「接納」？"},
  {"quote": "今天練習一點接納，明天的自己就會多一點力量。", "question": "如果今天要把「接納」送給班級，我會怎麼做？"},
  {"quote": "接納不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「接納」？"},
  {"quote": "願意回頭看看，才能知道下一步怎麼走。", "question": "今天有哪件事值得我重新想一想？"},
  {"quote": "把「反省」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「反省」？"},
  {"quote": "真正的反省，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「反省」？"},
  {"quote": "今天練習一點反省，明天的自己就會多一點力量。", "question": "如果今天要把「反省」送給班級，我會怎麼做？"},
  {"quote": "反省不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「反省」？"},
  {"quote": "發生不愉快後，願意修補關係是一種勇敢。", "question": "今天我可以怎麼讓一段關係變好一點？"},
  {"quote": "把「修復」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「修復」？"},
  {"quote": "真正的修復，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「修復」？"},
  {"quote": "今天練習一點修復，明天的自己就會多一點力量。", "question": "如果今天要把「修復」送給班級，我會怎麼做？"},
  {"quote": "修復不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「修復」？"},
  {"quote": "保護自己也尊重別人，是健康的相處方式。", "question": "當我不舒服時，我可以怎麼清楚表達？"},
  {"quote": "把「界線」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「界線」？"},
  {"quote": "真正的界線，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「界線」？"},
  {"quote": "今天練習一點界線，明天的自己就會多一點力量。", "question": "如果今天要把「界線」送給班級，我會怎麼做？"},
  {"quote": "界線不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「界線」？"},
  {"quote": "公平不是每個人都一樣，而是每個人得到需要的幫助。", "question": "今天我看到哪一件公平的事？"},
  {"quote": "把「公平」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「公平」？"},
  {"quote": "真正的公平，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「公平」？"},
  {"quote": "今天練習一點公平，明天的自己就會多一點力量。", "question": "如果今天要把「公平」送給班級，我會怎麼做？"},
  {"quote": "公平不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「公平」？"},
  {"quote": "不急著取笑不一樣的人，班級會更安全。", "question": "今天我可以怎麼接納與我不同的人？"},
  {"quote": "把「包容」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「包容」？"},
  {"quote": "真正的包容，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「包容」？"},
  {"quote": "今天練習一點包容，明天的自己就會多一點力量。", "question": "如果今天要把「包容」送給班級，我會怎麼做？"},
  {"quote": "包容不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「包容」？"},
  {"quote": "看見別人需要幫忙時，一句詢問會讓人很溫暖。", "question": "今天我想關心哪一位同學？"},
  {"quote": "把「關懷」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「關懷」？"},
  {"quote": "真正的關懷，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「關懷」？"},
  {"quote": "今天練習一點關懷，明天的自己就會多一點力量。", "question": "如果今天要把「關懷」送給班級，我會怎麼做？"},
  {"quote": "關懷不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「關懷」？"},
  {"quote": "主動做一件對大家有幫助的事，就是服務。", "question": "今天我願意替班級做什麼？"},
  {"quote": "把「服務」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「服務」？"},
  {"quote": "真正的服務，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「服務」？"},
  {"quote": "今天練習一點服務，明天的自己就會多一點力量。", "question": "如果今天要把「服務」送給班級，我會怎麼做？"},
  {"quote": "服務不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「服務」？"},
  {"quote": "把注意力帶回眼前，事情就會慢慢完成。", "question": "今天什麼時候我最需要提醒自己專心？"},
  {"quote": "把「專注」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「專注」？"},
  {"quote": "真正的專注，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「專注」？"},
  {"quote": "今天練習一點專注，明天的自己就會多一點力量。", "question": "如果今天要把「專注」送給班級，我會怎麼做？"},
  {"quote": "專注不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「專注」？"},
  {"quote": "多問一個為什麼，世界就會多打開一扇門。", "question": "今天我最想弄懂什麼？"},
  {"quote": "把「好奇」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「好奇」？"},
  {"quote": "真正的好奇，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「好奇」？"},
  {"quote": "今天練習一點好奇，明天的自己就會多一點力量。", "question": "如果今天要把「好奇」送給班級，我會怎麼做？"},
  {"quote": "好奇不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「好奇」？"},
  {"quote": "現在不熟練，只代表還需要多練幾次。", "question": "今天我願意再練習哪件事？"},
  {"quote": "把「練習」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「練習」？"},
  {"quote": "真正的練習，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「練習」？"},
  {"quote": "今天練習一點練習，明天的自己就會多一點力量。", "question": "如果今天要把「練習」送給班級，我會怎麼做？"},
  {"quote": "練習不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「練習」？"},
  {"quote": "進步不一定很大，但每天都可以有一點。", "question": "今天我注意到自己哪個小進步？"},
  {"quote": "把「成長」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「成長」？"},
  {"quote": "真正的成長，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「成長」？"},
  {"quote": "今天練習一點成長，明天的自己就會多一點力量。", "question": "如果今天要把「成長」送給班級，我會怎麼做？"},
  {"quote": "成長不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「成長」？"},
  {"quote": "困難時再試一次，常常就是突破的開始。", "question": "今天我不想輕易放棄哪件事？"},
  {"quote": "把「堅持」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「堅持」？"},
  {"quote": "真正的堅持，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「堅持」？"},
  {"quote": "今天練習一點堅持，明天的自己就會多一點力量。", "question": "如果今天要把「堅持」送給班級，我會怎麼做？"},
  {"quote": "堅持不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「堅持」？"},
  {"quote": "方法不通時，換一條路也能到達目的地。", "question": "今天遇到困難時，我可以換什麼方法？"},
  {"quote": "把「彈性」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「彈性」？"},
  {"quote": "真正的彈性，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「彈性」？"},
  {"quote": "今天練習一點彈性，明天的自己就會多一點力量。", "question": "如果今天要把「彈性」送給班級，我會怎麼做？"},
  {"quote": "彈性不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「彈性」？"},
  {"quote": "先想好順序，做事會更安心也更有效率。", "question": "今天我想先完成哪三件事？"},
  {"quote": "把「規劃」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「規劃」？"},
  {"quote": "真正的規劃，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「規劃」？"},
  {"quote": "今天練習一點規劃，明天的自己就會多一點力量。", "question": "如果今天要把「規劃」送給班級，我會怎麼做？"},
  {"quote": "規劃不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「規劃」？"},
  {"quote": "珍惜時間，不是一直趕，而是知道什麼最重要。", "question": "今天最重要的一件事是什麼？"},
  {"quote": "把「時間」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「時間」？"},
  {"quote": "真正的時間，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「時間」？"},
  {"quote": "今天練習一點時間，明天的自己就會多一點力量。", "question": "如果今天要把「時間」送給班級，我會怎麼做？"},
  {"quote": "時間不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「時間」？"},
  {"quote": "把物品放回原位，也是在照顧下一個使用的人。", "question": "今天我想整理好哪個地方？"},
  {"quote": "把「整理」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「整理」？"},
  {"quote": "真正的整理，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「整理」？"},
  {"quote": "今天練習一點整理，明天的自己就會多一點力量。", "question": "如果今天要把「整理」送給班級，我會怎麼做？"},
  {"quote": "整理不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「整理」？"},
  {"quote": "提早一點準備，會讓自己更有信心。", "question": "明天的事情，我今天可以先準備什麼？"},
  {"quote": "把「準備」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「準備」？"},
  {"quote": "真正的準備，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「準備」？"},
  {"quote": "今天練習一點準備，明天的自己就會多一點力量。", "question": "如果今天要把「準備」送給班級，我會怎麼做？"},
  {"quote": "準備不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「準備」？"},
  {"quote": "每一個小選擇，都在決定你想成為怎樣的人。", "question": "今天我做了哪個讓自己驕傲的選擇？"},
  {"quote": "把「選擇」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「選擇」？"},
  {"quote": "真正的選擇，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「選擇」？"},
  {"quote": "今天練習一點選擇，明天的自己就會多一點力量。", "question": "如果今天要把「選擇」送給班級，我會怎麼做？"},
  {"quote": "選擇不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「選擇」？"},
  {"quote": "做錯後願意負責，比找理由更有力量。", "question": "如果今天做錯事，我會怎麼負責？"},
  {"quote": "把「承擔」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「承擔」？"},
  {"quote": "真正的承擔，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「承擔」？"},
  {"quote": "今天練習一點承擔，明天的自己就會多一點力量。", "question": "如果今天要把「承擔」送給班級，我會怎麼做？"},
  {"quote": "承擔不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「承擔」？"},
  {"quote": "說到做到，會讓別人放心把事情交給你。", "question": "今天我想守住哪一個承諾？"},
  {"quote": "把「信用」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「信用」？"},
  {"quote": "真正的信用，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「信用」？"},
  {"quote": "今天練習一點信用，明天的自己就會多一點力量。", "question": "如果今天要把「信用」送給班級，我會怎麼做？"},
  {"quote": "信用不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「信用」？"},
  {"quote": "照顧安全，是對自己和別人的尊重。", "question": "今天我會注意哪一個安全細節？"},
  {"quote": "把「安全」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「安全」？"},
  {"quote": "真正的安全，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「安全」？"},
  {"quote": "今天練習一點安全，明天的自己就會多一點力量。", "question": "如果今天要把「安全」送給班級，我會怎麼做？"},
  {"quote": "安全不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「安全」？"},
  {"quote": "照顧身體，才有力氣學習、遊戲和幫助別人。", "question": "今天我可以怎麼照顧自己的身體？"},
  {"quote": "把「健康」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「健康」？"},
  {"quote": "真正的健康，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「健康」？"},
  {"quote": "今天練習一點健康，明天的自己就會多一點力量。", "question": "如果今天要把「健康」送給班級，我會怎麼做？"},
  {"quote": "健康不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「健康」？"},
  {"quote": "適當休息不是偷懶，而是讓自己恢復力量。", "question": "今天我需要用什麼方式好好休息？"},
  {"quote": "把「休息」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「休息」？"},
  {"quote": "真正的休息，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「休息」？"},
  {"quote": "今天練習一點休息，明天的自己就會多一點力量。", "question": "如果今天要把「休息」送給班級，我會怎麼做？"},
  {"quote": "休息不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「休息」？"},
  {"quote": "情緒是在提醒我們，心裡有事情需要被看見。", "question": "今天我現在的心情像什麼天氣？"},
  {"quote": "把「情緒」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「情緒」？"},
  {"quote": "真正的情緒，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「情緒」？"},
  {"quote": "今天練習一點情緒，明天的自己就會多一點力量。", "question": "如果今天要把「情緒」送給班級，我會怎麼做？"},
  {"quote": "情緒不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「情緒」？"},
  {"quote": "先停一下再回應，常常能做出更好的決定。", "question": "下次快生氣時，我想先做什麼？"},
  {"quote": "把「冷靜」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「冷靜」？"},
  {"quote": "真正的冷靜，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「冷靜」？"},
  {"quote": "今天練習一點冷靜，明天的自己就會多一點力量。", "question": "如果今天要把「冷靜」送給班級，我會怎麼做？"},
  {"quote": "冷靜不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「冷靜」？"},
  {"quote": "願意求助不是脆弱，而是知道怎麼照顧自己。", "question": "遇到困難時，我可以找誰幫忙？"},
  {"quote": "把「求助」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「求助」？"},
  {"quote": "真正的求助，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「求助」？"},
  {"quote": "今天練習一點求助，明天的自己就會多一點力量。", "question": "如果今天要把「求助」送給班級，我會怎麼做？"},
  {"quote": "求助不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「求助」？"},
  {"quote": "自信不是什麼都會，而是相信自己能學會。", "question": "今天我想對自己說哪一句鼓勵的話？"},
  {"quote": "把「自信」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「自信」？"},
  {"quote": "真正的自信，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「自信」？"},
  {"quote": "今天練習一點自信，明天的自己就會多一點力量。", "question": "如果今天要把「自信」送給班級，我會怎麼做？"},
  {"quote": "自信不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「自信」？"},
  {"quote": "看見自己的優點，也要記得看見別人的亮點。", "question": "今天我想稱讚誰的哪個優點？"},
  {"quote": "把「欣賞」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「欣賞」？"},
  {"quote": "真正的欣賞，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「欣賞」？"},
  {"quote": "今天練習一點欣賞，明天的自己就會多一點力量。", "question": "如果今天要把「欣賞」送給班級，我會怎麼做？"},
  {"quote": "欣賞不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「欣賞」？"},
  {"quote": "做得好也願意繼續學，會讓你走得更遠。", "question": "今天我可以向誰學習一件事？"},
  {"quote": "把「謙虛」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「謙虛」？"},
  {"quote": "真正的謙虛，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「謙虛」？"},
  {"quote": "今天練習一點謙虛，明天的自己就會多一點力量。", "question": "如果今天要把「謙虛」送給班級，我會怎麼做？"},
  {"quote": "謙虛不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「謙虛」？"},
  {"quote": "分享不只分東西，也能分享方法與好心情。", "question": "今天我願意分享什麼？"},
  {"quote": "把「分享」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「分享」？"},
  {"quote": "真正的分享，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「分享」？"},
  {"quote": "今天練習一點分享，明天的自己就會多一點力量。", "question": "如果今天要把「分享」送給班級，我會怎麼做？"},
  {"quote": "分享不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「分享」？"},
  {"quote": "一句請、謝謝、對不起，能讓相處更舒服。", "question": "今天我最想練習哪一句禮貌用語？"},
  {"quote": "把「禮貌」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「禮貌」？"},
  {"quote": "真正的禮貌，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「禮貌」？"},
  {"quote": "今天練習一點禮貌，明天的自己就會多一點力量。", "question": "如果今天要把「禮貌」送給班級，我會怎麼做？"},
  {"quote": "禮貌不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「禮貌」？"},
  {"quote": "遵守約定，是讓每個人都安心的方法。", "question": "今天哪一個班級約定最需要我做到？"},
  {"quote": "把「守序」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「守序」？"},
  {"quote": "真正的守序，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「守序」？"},
  {"quote": "今天練習一點守序，明天的自己就會多一點力量。", "question": "如果今天要把「守序」送給班級，我會怎麼做？"},
  {"quote": "守序不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「守序」？"},
  {"quote": "需要安靜時管好聲音，是對學習中的人最好的幫助。", "question": "今天我會在哪個時刻照顧好音量？"},
  {"quote": "把「安靜」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「安靜」？"},
  {"quote": "真正的安靜，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「安靜」？"},
  {"quote": "今天練習一點安靜，明天的自己就會多一點力量。", "question": "如果今天要把「安靜」送給班級，我會怎麼做？"},
  {"quote": "安靜不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「安靜」？"},
  {"quote": "願意輪流，大家才都有參與的機會。", "question": "今天我如何讓別人也有機會？"},
  {"quote": "把「輪流」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「輪流」？"},
  {"quote": "真正的輪流，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「輪流」？"},
  {"quote": "今天練習一點輪流，明天的自己就會多一點力量。", "question": "如果今天要把「輪流」送給班級，我會怎麼做？"},
  {"quote": "輪流不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「輪流」？"},
  {"quote": "真心道歉包含承認、理解和願意改變。", "question": "如果需要道歉，我會說清楚哪三件事？"},
  {"quote": "把「道歉」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「道歉」？"},
  {"quote": "真正的道歉，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「道歉」？"},
  {"quote": "今天練習一點道歉，明天的自己就會多一點力量。", "question": "如果今天要把「道歉」送給班級，我會怎麼做？"},
  {"quote": "道歉不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「道歉」？"},
  {"quote": "原諒不是忘記，而是不讓不開心一直綁住自己。", "question": "有沒有一件小事，我願意慢慢放下？"},
  {"quote": "把「原諒」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「原諒」？"},
  {"quote": "真正的原諒，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「原諒」？"},
  {"quote": "今天練習一點原諒，明天的自己就會多一點力量。", "question": "如果今天要把「原諒」送給班級，我會怎麼做？"},
  {"quote": "原諒不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「原諒」？"},
  {"quote": "今天不順利，不代表明天沒有新的可能。", "question": "我希望明天出現什麼小小的改變？"},
  {"quote": "把「希望」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「希望」？"},
  {"quote": "真正的希望，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「希望」？"},
  {"quote": "今天練習一點希望，明天的自己就會多一點力量。", "question": "如果今天要把「希望」送給班級，我會怎麼做？"},
  {"quote": "希望不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「希望」？"},
  {"quote": "找得到一件還不錯的事，心就會多一點力量。", "question": "今天發生了哪一件值得開心的小事？"},
  {"quote": "把「樂觀」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「樂觀」？"},
  {"quote": "真正的樂觀，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「樂觀」？"},
  {"quote": "今天練習一點樂觀，明天的自己就會多一點力量。", "question": "如果今天要把「樂觀」送給班級，我會怎麼做？"},
  {"quote": "樂觀不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「樂觀」？"},
  {"quote": "幸福常藏在平凡的小事裡，需要慢慢發現。", "question": "今天哪個小瞬間讓我覺得幸福？"},
  {"quote": "把「幸福」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「幸福」？"},
  {"quote": "真正的幸福，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「幸福」？"},
  {"quote": "今天練習一點幸福，明天的自己就會多一點力量。", "question": "如果今天要把「幸福」送給班級，我會怎麼做？"},
  {"quote": "幸福不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「幸福」？"},
  {"quote": "夢想會從今天的一個小行動開始長大。", "question": "為了想做的事，我今天可以踏出哪一步？"},
  {"quote": "把「夢想」放進今天的行動裡，你會看見不一樣的自己。", "question": "今天我可以用哪一個行動練習「夢想」？"},
  {"quote": "真正的夢想，常常藏在沒有人提醒時的小選擇裡。", "question": "我曾在哪個時刻看見自己或同學做到「夢想」？"},
  {"quote": "今天練習一點夢想，明天的自己就會多一點力量。", "question": "如果今天要把「夢想」送給班級，我會怎麼做？"},
  {"quote": "夢想不是一句口號，而是可以被看見的行動。", "question": "回想今天，我在哪件事上還能多一點「夢想」？"}
]

const students = computed(() => parseStudents(studentSource.value))
const todayKey = computed(() => toDateKey(new Date()))
const todayText = computed(() => formatToday(new Date()))
const todayEvents = computed(() => getTodayEvents(todayKey.value))
const dailyQuoteIndex = computed(() => getDailyQuoteIndex(new Date()))
const currentMessage = computed(() => dailyMessages[dailyQuoteIndex.value])
const currentQuote = computed(() => currentMessage.value.quote)
const currentQuestion = computed(() => currentMessage.value.question)

function getDailyQuoteIndex(date) {
  const start = new Date(date.getFullYear(), 0, 1)
  const dayDiff = Math.floor((stripTime(date) - stripTime(start)) / (1000 * 60 * 60 * 24))
  return Math.abs(dayDiff) % dailyMessages.length
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function parseStudents(value) {
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
        .map((student, index) => {
          if (typeof student === 'string') return { number: index + 1, name: student }
          return {
            number: student.number || student.no || student.id || index + 1,
            name: student.name || student.studentName || ''
          }
        })
        .filter(student => student.name)
    }
  } catch {}

  return value
    .split('\n')
    .map((line, index) => {
      const trimmed = line.trim()
      const match = trimmed.match(/^(\d+)\s*[\.、\- ]\s*(.+)$/)
      if (match) return { number: Number(match[1]), name: match[2].trim() }
      return { number: index + 1, name: trimmed }
    })
    .filter(student => student.name)
}

function getTodayEvents(key) {
  try {
    const saved = JSON.parse(localStorage.getItem('classHelperCalendarEvents') || '{}')
    return Array.isArray(saved[key]) ? saved[key] : []
  } catch {
    return []
  }
}

function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatToday(date) {
  const week = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日（星期${week}）`
}
</script>

<template>
  <div class="dashboard home-dashboard">
    <div class="home-top-actions">
      <button class="home-settings-button" type="button" @click="showHomeSettings = !showHomeSettings">
        ⚙️ 首頁設定
      </button>
    </div>

    <section v-if="showHomeSettings" class="card home-settings-card">
      <div>
        <h3>⚙️ 首頁顯示</h3>
        <p>依照班級使用方式，選擇首頁要出現的內容。</p>
      </div>
      <label><input v-model="homeDisplay.contactBook" type="checkbox"> 📝 今日聯絡事項</label>
      <label><input v-model="homeDisplay.dailyQuote" type="checkbox"> 🌱 今日一句</label>
      <label><input v-model="homeDisplay.reflection" type="checkbox"> 💭 今天想一想</label>
      <div v-if="homeDisplay.contactBook" class="contact-layout-setting">
        <strong>聯絡簿版面</strong>
        <label><input v-model="homeDisplay.contactLayout" type="radio" value="horizontal"> 橫式</label>
        <label><input v-model="homeDisplay.contactLayout" type="radio" value="vertical"> 直式（由右往左）</label>
      </div>
    </section>

    <!-- ✅ HUA_CONTACT_DYNAMIC_FONT_MOBILE_FIX_20260710：聯絡事項依數量自動縮放字級，手機改為可讀的兩排直式卡片。 -->
    <section
      v-if="homeDisplay.contactBook && isVerticalContactLayout"
      class="card contact-book-card vertical-contact-card"
    >
      <header class="contact-book-header">
        <div>
          <span class="eyebrow">📝 今日聯絡事項</span>
          <h2>直式聯絡簿模式</h2>
        </div>
        <button v-if="!isEditingContactBook" type="button" class="contact-edit-button" @click="isEditingContactBook = true">✏️ 編輯</button>
        <button v-else type="button" class="contact-done-button" @click="finishContactBookEditing">✓ 完成</button>
      </header>

      <div v-if="isEditingContactBook" class="contact-book-editor">
        <label><span>📚 作業</span><textarea v-model="contactBook.homework" rows="4" placeholder="每一行輸入一項作業"></textarea></label>
        <label><span>🎒 攜帶物品</span><textarea v-model="contactBook.carry" rows="3" placeholder="每一行輸入一項攜帶物品"></textarea></label>
        <label><span>📌 提醒</span><textarea v-model="contactBook.reminder" rows="3" placeholder="每一行輸入一項提醒"></textarea></label>
      </div>

      <div v-else class="vertical-book-spread polished-vertical-book">
        <section class="vertical-book-left">
          <div class="book-page-heading">親師交流</div>
          <div v-if="homeDisplay.dailyQuote" class="vertical-sel-content">
            <div class="vertical-sel-block vertical-quote-block">
              <span class="vertical-section-label">今日一句</span>
              <strong>{{ currentQuote }}</strong>
            </div>
            <div v-if="homeDisplay.reflection" class="vertical-sel-block vertical-question-block">
              <span class="vertical-section-label">想一想</span>
              <strong>{{ currentQuestion }}</strong>
            </div>
          </div>
          <div v-if="homeDisplay.reflection" class="vertical-response-note">
            ✍️ 請在今天的聯絡簿空白處回答哦！
          </div>
        </section>

        <section class="vertical-book-right">
          <div class="book-page-heading contact-heading-with-date">
            <span>聯絡簿</span>
            <span class="contact-heading-date">
              {{ verticalDateParts.year }} {{ verticalDateParts.monthDay }}（{{ verticalDateParts.week }}）
            </span>
          </div>
          <div
            class="vertical-contact-columns"
            :style="{ '--contact-columns': Math.max(mergedContactItems.length, 1), '--contact-count': mergedContactItems.length }"
          >
            <div v-for="(item, index) in mergedContactItems" :key="`vertical-contact-${index}`" class="vertical-contact-item">
              <span class="vertical-contact-index">{{ index + 1 }}</span>
              <span class="vertical-contact-text">{{ item }}</span>
            </div>
          </div>
        </section>
      </div>
    </section>

    <section v-if="homeDisplay.contactBook && !isVerticalContactLayout" class="card contact-book-card">
      <header class="contact-book-header">
        <div><span class="eyebrow">📝 今日聯絡事項</span><h2>請依序抄寫在聯絡簿上</h2></div>
        <button v-if="!isEditingContactBook" type="button" class="contact-edit-button" @click="isEditingContactBook = true">✏️ 編輯</button>
        <button v-else type="button" class="contact-done-button" @click="finishContactBookEditing">✓ 完成</button>
      </header>
      <div v-if="isEditingContactBook" class="contact-book-editor">
        <label><span>📚 作業</span><textarea v-model="contactBook.homework" rows="4" placeholder="每一行輸入一項作業"></textarea></label>
        <label><span>🎒 攜帶物品</span><textarea v-model="contactBook.carry" rows="3" placeholder="每一行輸入一項攜帶物品"></textarea></label>
        <label><span>📌 提醒</span><textarea v-model="contactBook.reminder" rows="3" placeholder="每一行輸入一項提醒"></textarea></label>
      </div>
      <div v-else class="contact-book-display">
        <section v-for="section in contactSections" :key="section.key" class="contact-section">
          <h3>{{ section.icon }} {{ section.title }}</h3>
          <ol><li v-for="(item, index) in section.items" :key="`${section.key}-${index}`">{{ item }}</li></ol>
        </section>
      </div>
    </section>

    <section v-if="homeDisplay.dailyQuote && !isVerticalContactLayout" class="home-hero card">
      <div class="home-hero-text">
        <span class="eyebrow">🌱 今日一句</span>
        <h2>{{ currentQuote }}</h2>
        <p>第 {{ dailyQuoteIndex + 1 }} / 365 天｜品格 × SEL</p>
        <div v-if="homeDisplay.reflection" class="daily-reflection">
          <span>💭 今天想一想</span>
          <strong class="daily-question">❓ {{ currentQuestion }}</strong>
          <small>✍️ 請在今天聯絡簿空白處回答哦！</small>
        </div>
      </div>
    </section>

    <section class="home-grid">
      <div class="card home-info-card">
        <h3>📚 班級資訊</h3>
        <div class="info-list">
          <p>
            <span>目前班級</span>
            <strong>{{ className || '尚未建立班級' }}</strong>
          </p>
          <p>
            <span>學生人數</span>
            <strong>{{ students.length }} 位</strong>
          </p>
          <p>
            <span>今天日期</span>
            <strong>{{ todayText }}</strong>
          </p>
        </div>
        <RouterLink class="button-link" to="/students">前往學生名單</RouterLink>
      </div>

      <div class="card home-info-card">
        <h3>📌 今日提醒</h3>
        <div v-if="todayEvents.length" class="today-events">
          <p v-for="(event, index) in todayEvents" :key="index">{{ event }}</p>
        </div>
        <div v-else class="empty-note">
          今天尚未新增提醒。<br>
          可以到行事曆寫下班級活動或重要事項。
        </div>
        <RouterLink class="button-link soft-link" to="/calendar">前往行事曆</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-dashboard {
  max-width: 1080px;
}

.home-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  min-height: clamp(190px, 28vh, 270px);
  padding: clamp(22px, 4vw, 38px);
  background: linear-gradient(135deg, #ffffff 0%, #f4fbf7 48%, #fff7e8 100%);
  border: 1px solid #f1e6d8;
}

.home-hero-text {
  max-width: 920px;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #4e7c68;
  font-weight: 900;
  margin-bottom: 10px;
}

.home-hero h2 {
  margin: 0;
  color: #243b53;
  font-size: clamp(28px, 4.4vw, 48px);
  line-height: 1.25;
  letter-spacing: .02em;
}

.home-hero p {
  margin: 12px 0 0;
  color: #667085;
  font-weight: 800;
}

.home-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-top: 18px;
}

.home-info-card {
  margin-top: 0;
}

.home-info-card h3 {
  margin-top: 0;
  color: #2f6f57;
}

.info-list {
  display: grid;
  gap: 10px;
}

.info-list p {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 13px 14px;
  border-radius: 16px;
  background: #fff8f0;
}

.info-list span {
  color: #667085;
  font-weight: 800;
}

.info-list strong {
  text-align: right;
  color: #243b53;
}

.today-events {
  display: grid;
  gap: 10px;
}

.today-events p,
.empty-note {
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: #f4fbf7;
  color: #345;
  font-weight: 800;
  line-height: 1.7;
}

.empty-note {
  color: #667085;
}

.soft-link {
  background: #6bbf95;
}

@media (max-width: 980px) {
  .home-hero {
    min-height: auto;
  }

  .home-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 820px) {
  .home-hero {
    align-items: stretch;
  }

  .info-list p {
    align-items: flex-start;
    flex-direction: column;
  }

  .info-list strong {
    text-align: left;
  }
}

@media (max-width: 520px) {
  .home-hero h2 {
    font-size: 28px;
  }

  .home-hero p {
    font-size: 14px;
  }
}

/* ✅ HUA_DAILY_SEL_365_CARD_20260710 */
.daily-reflection {
  display: grid;
  gap: 6px;
  margin-top: 18px;
  padding: 14px 16px;
  border: 1px solid #dceee6;
  border-radius: 18px;
  background: rgba(255,255,255,.78);
}
.daily-reflection span { color: #4e7c68; font-weight: 900; }
.daily-reflection strong { color: #345; font-size: clamp(17px, 2vw, 21px); line-height: 1.55; }
.daily-reflection small { color: #7b8492; font-weight: 800; }
@media (max-width: 760px) {
  .home-hero { min-height: auto; }
  .daily-reflection { padding: 12px; }
}


/* ✅ HUA_HOME_CONTACT_BOOK_LAYOUT_20260710：直式聯絡事項＋首頁顯示設定。 */
.home-top-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}

.home-settings-button,
.contact-edit-button,
.contact-done-button {
  padding: 9px 14px;
  border-radius: 13px;
  font-size: 14px;
}

.home-settings-card {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) repeat(3, auto);
  align-items: center;
  gap: 14px;
  margin-top: 0;
  margin-bottom: 18px;
  padding: 18px 20px;
}

.home-settings-card h3,
.home-settings-card p {
  margin: 0;
}

.home-settings-card p {
  margin-top: 5px;
  color: #667085;
  font-size: 14px;
}

.home-settings-card label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #f4fbf7;
  color: #345;
  font-weight: 850;
  white-space: nowrap;
}

.contact-book-card {
  margin-top: 0;
  padding: clamp(20px, 3vw, 30px);
  background: linear-gradient(160deg, #fffefb, #fff8f0 56%, #f4fbf7);
  border: 1px solid #eadfce;
}

.contact-book-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.contact-book-header h2 {
  margin: 2px 0 0;
  color: #243b53;
  font-size: clamp(20px, 2.6vw, 29px);
}

.contact-book-display {
  display: grid;
  grid-template-columns: 1.2fr .9fr .9fr;
  gap: 16px;
}

.contact-section {
  min-width: 0;
  padding: 16px 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, .88);
  border: 1px solid #e7eadf;
}

.contact-section h3 {
  margin: 0 0 10px;
  color: #2f6f57;
  font-size: 19px;
}

.contact-section ol {
  margin: 0;
  padding-left: 1.7em;
}

.contact-section li {
  margin: 8px 0;
  padding-left: 3px;
  color: #243b53;
  font-size: clamp(18px, 2.1vw, 25px);
  font-weight: 850;
  line-height: 1.5;
}

.contact-book-editor {
  display: grid;
  grid-template-columns: 1.2fr .9fr .9fr;
  gap: 14px;
}

.contact-book-editor label {
  display: grid;
  gap: 8px;
  color: #2f6f57;
  font-weight: 900;
}

.contact-book-editor textarea {
  width: 100%;
  min-height: 132px;
  resize: vertical;
  padding: 13px 14px;
  border: 2px solid #dceee6;
  border-radius: 16px;
  background: #fff;
  color: #243b53;
  font: inherit;
  font-size: 17px;
  line-height: 1.65;
}

.home-hero-text {
  width: 100%;
}

.home-hero h2 {
  max-width: 100%;
  font-size: clamp(27px, 4vw, 45px);
  line-break: strict;
  word-break: normal;
}

.daily-question {
  display: block;
  padding: 12px 14px;
  border-radius: 14px;
  background: #fff8dc;
  border: 1px solid #f2df9d;
}

.daily-reflection small {
  color: #2f6f57;
  font-size: 15px;
  font-weight: 900;
}

@media (max-width: 900px) {
  .home-settings-card,
  .contact-book-display,
  .contact-book-editor {
    grid-template-columns: 1fr;
  }

  .home-settings-card label {
    white-space: normal;
  }
}

@media (max-width: 760px) {
  .home-top-actions {
    justify-content: stretch;
  }

  .home-settings-button {
    width: 100%;
  }

  .contact-book-header {
    align-items: stretch;
    flex-direction: column;
  }

  .contact-edit-button,
  .contact-done-button {
    width: 100%;
  }

  .contact-section li {
    font-size: 18px;
  }

  .home-hero h2 {
    font-size: clamp(25px, 7.4vw, 34px);
    line-height: 1.34;
  }
}

</style>
