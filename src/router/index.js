import { createRouter, createWebHashHistory } from 'vue-router'

import Dashboard from '../views/Dashboard.vue'
import Students from '../views/Students.vue'
import Notebook from '../views/Notebook.vue'
import Calendar from '../views/Calendar.vue'
import Toothbrush from '../views/Toothbrush.vue'
import Points from '../views/Points.vue'
import Library from '../views/Library.vue'
import Status from '../views/Status.vue'
import Schedule from '../views/Schedule.vue'
import Wheel from '../views/Wheel.vue'
import Cleaning from '../views/Cleaning.vue'
import Jobs from '../views/Jobs.vue'
import Seats from '../views/Seats.vue'

// ✅ HUA_SCHEDULE_ROUTE_STATUS_LINK_20260711：新增 /schedule 課表頁，與 Status.vue 共用作息資料。
// ✅ HUA_STATUS_IS_MODES_ROUTE_CONFIRM_20260710：Status.vue 就是原本的 Modes／現在狀態頁，保留 /modes 自動轉址到 /status。
// POINTS_ROUTE_20260707：新增獨立積分頁，班書借閱不納入積分。
const routes = [
  { path: '/', component: Dashboard },
  { path: '/students', component: Students },
  { path: '/notebook', component: Notebook },
  { path: '/calendar', component: Calendar },
  { path: '/toothbrush', component: Toothbrush },
  { path: '/points', component: Points },
  { path: '/library', component: Library },
  { path: '/modes', redirect: '/status' },
  { path: '/status', component: Status },
  { path: '/schedule', component: Schedule },
  { path: '/cleaning', component: Cleaning },
  { path: '/jobs', component: Jobs },
  { path: '/seats', component: Seats },
  { path: '/wheel', component: Wheel }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
