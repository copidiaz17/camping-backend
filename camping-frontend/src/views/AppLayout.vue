<template>
  <div class="min-h-screen flex">
    <!-- Sidebar -->
    <aside class="w-60 bg-monte-700 text-white flex flex-col shrink-0">
      <div class="px-5 py-5 border-b border-white/10">
        <div class="text-2xl">🏕️ Las Casuarinas</div>
        <div class="text-monte-100 text-xs mt-0.5">Gestión del camping</div>
      </div>

      <nav class="flex-1 p-3 space-y-1">
        <router-link v-for="item in menuVisible" :key="item.to" :to="item.to" class="nav-link" active-class="nav-active">
          <span class="text-lg">{{ item.icon }}</span> {{ item.label }}
        </router-link>
      </nav>

      <div class="p-3 border-t border-white/10">
        <div class="px-2 mb-2 text-sm">
          <div class="font-semibold">{{ usuario?.nombre }}</div>
          <div class="text-monte-100 text-xs capitalize">{{ usuario?.rol }}</div>
        </div>
        <button class="btn-ghost w-full !text-gray-700" @click="salir">Cerrar sesión</button>
      </div>
    </aside>

    <!-- Contenido -->
    <main class="flex-1 overflow-auto">
      <div class="max-w-6xl mx-auto p-6">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { getUsuario, cerrarSesion } from "../utils/api.js";

const router = useRouter();
const usuario = getUsuario();

const menu = [
  { to: "/dashboard", label: "Inicio", icon: "📊", roles: ["admin", "cajero", "guardia", "guardavidas", "municipalidad"] },
  { to: "/reservas", label: "Reservas", icon: "📅", roles: ["admin", "cajero", "guardia"] },
  { to: "/puerta", label: "Puerta", icon: "🎫", roles: ["admin", "cajero", "guardia"] },
  { to: "/acceso", label: "Control de acceso", icon: "📷", roles: ["admin", "guardia"] },
  { to: "/caja", label: "Caja", icon: "💵", roles: ["admin", "cajero", "guardia"] },
  { to: "/config", label: "Configuración", icon: "⚙️", roles: ["admin"] },
  { to: "/usuarios", label: "Personal", icon: "👥", roles: ["admin"] },
  { to: "/reportes", label: "Reportes", icon: "📈", roles: ["admin", "municipalidad"] },
];

// Solo las secciones permitidas para el rol del usuario
const menuVisible = computed(() => menu.filter((m) => m.roles.includes(usuario?.rol)));

function salir() {
  cerrarSesion();
  router.push("/login");
}
</script>

<style scoped>
.nav-link {
  @apply flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-monte-100 hover:bg-white/10 transition;
}
.nav-active {
  @apply bg-white/15 text-white;
}
</style>
