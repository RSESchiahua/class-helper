import { createRouter, createWebHistory } from "vue-router";

import Dashboard from "../views/Dashboard.vue";
import Students from "../views/Students.vue";
import Notebook from "../views/Notebook.vue";
import Calendar from "../views/Calendar.vue";
import Toothbrush from "../views/Toothbrush.vue";
import Library from "../views/Library.vue";
import Modes from "../views/Modes.vue";
import Wheel from "../views/Wheel.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "Dashboard", component: Dashboard },
    { path: "/students", name: "Students", component: Students },
    { path: "/notebook", name: "Notebook", component: Notebook },
    { path: "/calendar", name: "Calendar", component: Calendar },
    { path: "/toothbrush", name: "Toothbrush", component: Toothbrush },
    { path: "/library", name: "Library", component: Library },
    { path: "/modes", name: "Modes", component: Modes },
    { path: "/wheel", name: "Wheel", component: Wheel },
  ],
});

export default router;