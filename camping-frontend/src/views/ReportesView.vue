<template>
  <div>
    <header class="mb-5">
      <h1 class="text-2xl font-bold text-gray-800">Reportes</h1>
      <p class="text-gray-500 text-sm">Resumen de actividad del camping</p>
    </header>

    <!-- Filtros de período -->
    <div class="card mb-4 flex flex-wrap items-end gap-3">
      <div><label class="label">Desde</label><input v-model="desde" type="date" class="input" /></div>
      <div><label class="label">Hasta</label><input v-model="hasta" type="date" class="input" /></div>
      <button class="btn-primary" :disabled="cargando" @click="cargar">{{ cargando ? "Cargando…" : "Ver" }}</button>
      <div class="flex gap-1 ml-auto">
        <button class="btn-ghost text-xs" @click="rango('mes')">Este mes</button>
        <button class="btn-ghost text-xs" @click="rango('anio')">Este año</button>
      </div>
    </div>

    <template v-if="data">
      <!-- KPIs -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div class="card"><div class="text-gray-500 text-sm">Reservas</div><div class="text-3xl font-bold text-monte-600">{{ data.kpis.reservas }}</div></div>
        <div class="card"><div class="text-gray-500 text-sm">Recaudado</div><div class="text-2xl font-bold text-monte-700">{{ pesos(data.kpis.recaudado) }}</div></div>
        <div class="card"><div class="text-gray-500 text-sm">Personas ingresadas</div><div class="text-3xl font-bold text-pulsera-acampe">{{ data.kpis.personas }}</div></div>
        <div class="card"><div class="text-gray-500 text-sm">Ticket promedio</div><div class="text-2xl font-bold text-gray-700">{{ pesos(data.kpis.ticket_promedio) }}</div></div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <!-- Recaudación por método -->
        <div class="card">
          <h3 class="font-bold text-gray-800 mb-3">💰 Recaudación por método</h3>
          <div v-if="!Object.keys(data.recaudacionPorMetodo).length" class="text-gray-400 text-sm py-4 text-center">Sin datos</div>
          <div v-for="(monto, metodo) in data.recaudacionPorMetodo" :key="metodo" class="flex justify-between py-2 border-b last:border-0">
            <span class="capitalize text-gray-600">{{ METODOS[metodo] || metodo }}</span>
            <b>{{ pesos(monto) }}</b>
          </div>
        </div>

        <!-- Reservas por tipo -->
        <div class="card">
          <h3 class="font-bold text-gray-800 mb-3">📅 Reservas por tipo</h3>
          <div v-if="!Object.keys(data.reservasPorTipo).length" class="text-gray-400 text-sm py-4 text-center">Sin datos</div>
          <div v-for="(n, tipo) in data.reservasPorTipo" :key="tipo" class="mb-2">
            <div class="flex justify-between text-sm mb-1"><span>{{ TIPOS[tipo] || tipo }}</span><b>{{ n }}</b></div>
            <div class="h-2 bg-gray-100 rounded-full overflow-hidden"><div class="h-full bg-monte-500 rounded-full" :style="{ width: pct(n, maxTipo) + '%' }"></div></div>
          </div>
        </div>

        <!-- Reservas por zona -->
        <div class="card">
          <h3 class="font-bold text-gray-800 mb-3">📍 Reservas por zona</h3>
          <div v-for="(d, zona) in data.reservasPorZona" :key="zona" class="flex items-center gap-3 py-2 border-b last:border-0">
            <span class="w-3 h-3 rounded-full" :style="{ background: d.color }"></span>
            <span class="flex-1 text-gray-600">{{ zona }}</span>
            <b>{{ d.reservas }}</b>
          </div>
        </div>

        <!-- Personas por zona -->
        <div class="card">
          <h3 class="font-bold text-gray-800 mb-3">🎟️ Personas ingresadas por zona</h3>
          <div v-if="!Object.keys(data.personasPorZona).length" class="text-gray-400 text-sm py-4 text-center">Sin ingresos en el período</div>
          <div v-for="(n, zona) in data.personasPorZona" :key="zona" class="flex justify-between py-2 border-b last:border-0">
            <span class="text-gray-600">{{ zona }}</span><b>{{ n }}</b>
          </div>
        </div>
      </div>

      <!-- Por día -->
      <div class="card mt-5">
        <h3 class="font-bold text-gray-800 mb-3">📈 Recaudación por día</h3>
        <div v-if="!data.porDia.length" class="text-gray-400 text-sm py-4 text-center">Sin datos en el período</div>
        <div v-else class="flex items-end gap-2 h-40">
          <div v-for="d in data.porDia" :key="d.dia" class="flex-1 flex flex-col items-center justify-end" :title="`${d.dia}: ${pesos(d.monto)}`">
            <div class="w-full bg-monte-500 rounded-t" :style="{ height: pct(d.monto, maxDia) + '%' }"></div>
            <span class="text-[10px] text-gray-400 mt-1 rotate-45 origin-left whitespace-nowrap">{{ d.dia.slice(5) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { axios, auth, pesos } from "../utils/api.js";

const TIPOS = { quincho: "Quincho", pase_pileta: "Pase pileta", pase_dia: "Pase día", acampe: "Acampe" };
const METODOS = { efectivo: "Efectivo", transferencia: "Transferencia", mercadopago: "MercadoPago" };

const hoy = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const desde = ref(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`);
const hasta = ref(iso(hoy));

const data = ref(null);
const cargando = ref(false);

const maxTipo = computed(() => Math.max(1, ...Object.values(data.value?.reservasPorTipo || { x: 1 })));
const maxDia = computed(() => Math.max(1, ...(data.value?.porDia || []).map((d) => d.monto)));
const pct = (v, max) => Math.round((v / max) * 100);

function rango(tipo) {
  if (tipo === "mes") { desde.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`; hasta.value = iso(hoy); }
  else { desde.value = `${hoy.getFullYear()}-01-01`; hasta.value = `${hoy.getFullYear()}-12-31`; }
  cargar();
}

async function cargar() {
  cargando.value = true;
  try {
    const { data: d } = await axios.get(`/api/reportes?desde=${desde.value}&hasta=${hasta.value}`, auth());
    data.value = d;
  } catch (e) {
    console.error("Error cargando reportes", e);
  } finally {
    cargando.value = false;
  }
}

onMounted(cargar);
</script>
