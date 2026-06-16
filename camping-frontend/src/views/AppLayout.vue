<template>
  <div class="min-h-screen md:flex">
    <!-- Barra superior (solo mobile) -->
    <header class="md:hidden flex items-center justify-between bg-monte-700 text-white px-4 py-3 sticky top-0 z-30">
      <div class="font-semibold">🏕️ Las Casuarinas</div>
      <button class="text-2xl leading-none" @click="open = true" aria-label="Abrir menú">☰</button>
    </header>

    <!-- Fondo oscuro al abrir el menú en mobile -->
    <div v-if="open" class="fixed inset-0 bg-black/40 z-40 md:hidden" @click="open = false"></div>

    <!-- Sidebar / cajón -->
    <aside
      class="bg-monte-700 text-white flex flex-col w-64 shrink-0 z-50 fixed inset-y-0 left-0 transition-transform md:static md:translate-x-0"
      :class="open ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="px-5 py-5 border-b border-white/10 flex items-start justify-between">
        <div>
          <div class="text-2xl">🏕️ Las Casuarinas</div>
          <div class="text-monte-100 text-xs mt-0.5">Gestión del camping</div>
        </div>
        <button class="md:hidden text-2xl leading-none" @click="open = false" aria-label="Cerrar menú">×</button>
      </div>

      <nav class="flex-1 p-3 space-y-1 overflow-auto">
        <router-link v-for="item in menuVisible" :key="item.to" :to="item.to" class="nav-link" active-class="nav-active" @click="open = false">
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
      <div class="max-w-6xl mx-auto p-4 md:p-6">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { getUsuario, cerrarSesion } from "../utils/api.js";

const router = useRouter();
const usuario = getUsuario();
const open = ref(false); // menú lateral abierto en mobile

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
