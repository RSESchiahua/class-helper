import { createRouter, createWebHashHistory } from 'vue-router'

import Dashboard from '../views/Dashboard.vue'
import Students from '../views/Students.vue'
import Notebook from '../views/Notebook.vue'
import Calendar from '../views/Calendar.vue'
import Toothbrush from '../views/Toothbrush.vue'
import Library from '../views/Library.vue'
import Status from '../views/Status.vue'
import Wheel from '../views/Wheel.vue'
import Cleaning from '../views/Cleaning.vue'
import Jobs from '../views/Jobs.vue'
import Seats from '../views/Seats.vue'

const routes = [
  { path: '/', component: Dashboard },
  { path: '/students', component: Students },
  { path: '/notebook', component: Notebook },
  { path: '/calendar', component: Calendar },
  { path: '/toothbrush', component: Toothbrush },
  { path: '/library', component: Library },
  { path: '/modes', redirect: '/status' },
  { path: '/status', component: Status },
  { path: '/cleaning', component: Cleaning },
  { path: '/jobs', component: Jobs },
  { path: '/seats', component: Seats },
  { path: '/wheel', component: Wheel }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
