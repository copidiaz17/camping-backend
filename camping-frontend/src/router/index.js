import { createRouter, createWebHistory } from "vue-router";
import { getToken, getUsuario } from "../utils/api.js";

const TODOS = ["admin", "cajero", "guardia", "guardavidas", "municipalidad"];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/login", name: "login", component: () => import("../views/LoginView.vue") },
    {
      path: "/",
      component: () => import("../views/AppLayout.vue"),
      children: [
        { path: "", redirect: "/dashboard" },
        { path: "dashboard", name: "dashboard", component: () => import("../views/DashboardView.vue"), meta: { roles: TODOS } },
        { path: "reservas", name: "reservas", component: () => import("../views/ReservasView.vue"), meta: { roles: ["admin", "cajero", "guardia"] } },
        { path: "puerta", name: "puerta", component: () => import("../views/PuertaView.vue"), meta: { roles: ["admin", "cajero", "guardia"] } },
        { path: "acceso", name: "acceso", component: () => import("../views/AccesoView.vue"), meta: { roles: ["admin", "guardia"] } },
        { path: "caja", name: "caja", component: () => import("../views/CajaView.vue"), meta: { roles: ["admin", "cajero", "guardia"] } },
        { path: "config", name: "config", component: () => import("../views/ConfiguracionView.vue"), meta: { roles: ["admin"] } },
        { path: "usuarios", name: "usuarios", component: () => import("../views/UsuariosView.vue"), meta: { roles: ["admin"] } },
        { path: "reportes", name: "reportes", component: () => import("../views/ReportesView.vue"), meta: { roles: ["admin", "municipalidad"] } },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/dashboard" },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

// Guard global: exige sesión y respeta el rol de cada sección.
router.beforeEach((to) => {
  if (to.path === "/login") return true;
  if (!getToken()) return "/login";
  const usuario = getUsuario();
  const roles = to.meta?.roles;
  if (roles && usuario && !roles.includes(usuario.rol)) return "/dashboard";
  return true;
});

export default router;
