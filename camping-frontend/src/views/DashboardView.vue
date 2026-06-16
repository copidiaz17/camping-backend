<template>
  <div>
    <header class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800">Hola, {{ usuario?.nombre }} 👋</h1>
      <p class="text-gray-500 text-sm capitalize">{{ hoyTexto }}</p>
    </header>

    <!-- Tarjetas resumen -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="card">
        <div class="text-gray-500 text-sm">Reservas de hoy</div>
        <div class="text-3xl font-bold text-monte-600">{{ reservasHoy.length }}</div>
      </div>
      <div class="card">
        <div class="text-gray-500 text-sm">Personas ingresadas</div>
        <div class="text-3xl font-bold text-pulsera-acampe">{{ personasIngresadas }}</div>
      </div>
      <div class="card">
        <div class="text-gray-500 text-sm">Caja</div>
        <div class="text-2xl font-bold" :class="caja.abierta ? 'text-monte-600' : 'text-gray-400'">
          {{ caja.abierta ? "Abierta" : "Cerrada" }}
        </div>
        <div v-if="caja.abierta" class="text-xs text-gray-500 mt-1">
          En efectivo: {{ pesos(caja.resumen?.esperado_efectivo) }}
        </div>
      </div>
      <div class="card">
        <div class="text-gray-500 text-sm">Ingresos del turno</div>
        <div class="text-2xl font-bold text-monte-600">{{ pesos(caja.resumen?.ingresos?.total) }}</div>
      </div>
    </div>

    <!-- Reservas del día -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-bold text-gray-800">Reservas de hoy</h2>
        <router-link to="/reservas" class="text-sm text-monte-600 font-semibold">Ver todas →</router-link>
      </div>

      <p v-if="!reservasHoy.length" class="text-gray-400 text-sm py-6 text-center">No hay reservas para hoy.</p>

      <table v-else class="w-full text-sm">
        <thead class="text-left text-gray-400 border-b">
          <tr>
            <th class="py-2">N°</th>
            <th>Cliente</th>
            <th>Tipo</th>
            <th>Zona</th>
            <th>Estado</th>
            <th class="text-right">Monto</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in reservasHoy" :key="r.id" class="border-b last:border-0">
            <td class="py-2 font-mono text-xs">{{ r.numero }}</td>
            <td>{{ r.cliente?.nombre }} {{ r.cliente?.apellido || "" }}</td>
            <td>{{ tipoLabel(r.tipo) }}</td>
            <td>
              <span class="inline-flex items-center gap-1">
                <span class="w-2.5 h-2.5 rounded-full" :style="{ background: r.zona?.color }"></span>
                {{ r.zona?.nombre }}
              </span>
            </td>
            <td><span :class="estadoClase(r.estado)">{{ r.estado }}</span></td>
            <td class="text-right">{{ pesos(r.monto) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { axios, auth, getUsuario, pesos } from "../utils/api.js";

const usuario = getUsuario();
const reservasHoy = ref([]);
const caja = ref({ abierta: false, resumen: null });
const personasIngresadas = ref(0);

const hoy = new Date();
const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
const hoyTexto = hoy.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const TIPOS = { quincho: "Quincho", pase_pileta: "Pase pileta", pase_dia: "Pase día", acampe: "Acampe" };
function tipoLabel(t) {
  return TIPOS[t] || t;
}
function estadoClase(e) {
  const base = "text-xs font-semibold px-2 py-0.5 rounded-full ";
  if (e === "confirmada") return base + "bg-green-100 text-green-700";
  if (e === "cancelada") return base + "bg-red-100 text-red-600";
  return base + "bg-amber-100 text-amber-700";
}

onMounted(async () => {
  try {
    const [r, c, i] = await Promise.all([
      axios.get(`/api/reservas?fecha=${hoyISO}`, auth()),
      axios.get("/api/caja/actual", auth()),
      axios.get("/api/ingresos", auth()),
    ]);
    reservasHoy.value = r.data;
    caja.value = c.data;
    personasIngresadas.value = i.data
      .filter((ing) => (ing.createdAt || "").slice(0, 10) === hoyISO)
      .reduce((acc, ing) => acc + (ing.cantidad_personas || 0), 0);
  } catch (e) {
    console.error("Error cargando dashboard", e);
  }
});
</script>
