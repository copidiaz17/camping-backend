<template>
  <div>
    <header class="mb-5">
      <h1 class="text-2xl font-bold text-gray-800">Configuración</h1>
      <p class="text-gray-500 text-sm">Tarifas, quinchos y zonas del camping</p>
    </header>

    <!-- Tabs -->
    <div class="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
      <button v-for="t in tabs" :key="t.id" class="px-4 py-2 rounded-md text-sm font-semibold transition"
              :class="tab === t.id ? 'bg-white shadow-sm text-monte-700' : 'text-gray-500'" @click="tab = t.id">
        {{ t.label }}
      </button>
    </div>

    <!-- ───────── TARIFAS ───────── -->
    <div v-if="tab === 'tarifas'" class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-bold text-gray-800">Tarifas <span class="text-gray-400 font-normal text-sm">— precios que se aplican a las reservas</span></h2>
        <button class="btn-primary" @click="nuevaTarifa">+ Nueva tarifa</button>
      </div>
      <table class="w-full text-sm">
        <thead class="text-left text-gray-400 border-b">
          <tr><th class="py-2">Tipo</th><th>Descripción</th><th>Condición</th><th>Temporada</th><th class="text-right">Precio</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="t in tarifas" :key="t.id" class="border-b last:border-0" :class="{ 'opacity-40': !t.activo }">
            <td class="py-2 font-medium">{{ TIPOS[t.tipo] || t.tipo }}</td>
            <td>{{ t.descripcion || "—" }}</td>
            <td class="capitalize">{{ t.condicion }}</td>
            <td>{{ TEMP[t.temporada] || t.temporada }}</td>
            <td class="text-right font-semibold">{{ pesos(t.precio) }}</td>
            <td class="text-right whitespace-nowrap">
              <button class="acc text-monte-600" @click="editarTarifa(t)">Editar</button>
              <button v-if="t.activo" class="acc text-red-500" @click="bajaTarifa(t)">Desactivar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ───────── QUINCHOS ───────── -->
    <div v-if="tab === 'quinchos'" class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-bold text-gray-800">Quinchos</h2>
        <button class="btn-primary" @click="nuevoQuincho">+ Nuevo quincho</button>
      </div>
      <table class="w-full text-sm">
        <thead class="text-left text-gray-400 border-b">
          <tr><th class="py-2">Nombre</th><th class="text-center">Capacidad</th><th>Descripción</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="q in quinchos" :key="q.id" class="border-b last:border-0" :class="{ 'opacity-40': !q.activo }">
            <td class="py-2 font-medium">{{ q.nombre }}</td>
            <td class="text-center">{{ q.capacidad }}</td>
            <td>{{ q.descripcion || "—" }}</td>
            <td class="text-right whitespace-nowrap">
              <button class="acc text-monte-600" @click="editarQuincho(q)">Editar</button>
              <button v-if="q.activo" class="acc text-red-500" @click="bajaQuincho(q)">Desactivar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ───────── ZONAS ───────── -->
    <div v-if="tab === 'zonas'" class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-bold text-gray-800">Zonas <span class="text-gray-400 font-normal text-sm">— definen el color de pulsera y el aforo</span></h2>
        <button class="btn-primary" @click="nuevaZona">+ Nueva zona</button>
      </div>
      <table class="w-full text-sm">
        <thead class="text-left text-gray-400 border-b">
          <tr><th class="py-2">Zona</th><th>Color de pulsera</th><th class="text-center">Aforo máx.</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="z in zonas" :key="z.id" class="border-b last:border-0" :class="{ 'opacity-40': !z.activo }">
            <td class="py-2 font-medium">{{ z.nombre }}</td>
            <td><span class="inline-flex items-center gap-2"><span class="w-4 h-4 rounded-full border" :style="{ background: z.color }"></span>{{ z.color }}</span></td>
            <td class="text-center">{{ z.aforo_max === 0 ? "Sin tope" : z.aforo_max }}</td>
            <td class="text-right whitespace-nowrap">
              <button class="acc text-monte-600" @click="editarZona(z)">Editar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ───────── MODAL ───────── -->
    <div v-if="modal" class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" @click.self="modal = ''">
      <div class="bg-white rounded-xl w-full max-w-md p-6">
        <h2 class="text-lg font-bold mb-4">{{ tituloModal }}</h2>

        <!-- Form Tarifa -->
        <div v-if="modal === 'tarifa'" class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div><label class="label">Tipo</label>
              <select v-model="fTarifa.tipo" class="input"><option v-for="(l, k) in TIPOS" :key="k" :value="k">{{ l }}</option></select>
            </div>
            <div><label class="label">Precio</label><input v-model.number="fTarifa.precio" type="number" min="0" class="input" /></div>
            <div><label class="label">Condición</label>
              <select v-model="fTarifa.condicion" class="input"><option value="general">General</option><option value="residente">Residente</option><option value="jubilado">Jubilado</option></select>
            </div>
            <div><label class="label">Temporada</label>
              <select v-model="fTarifa.temporada" class="input"><option value="todo_el_anio">Todo el año</option><option value="alta">Alta</option><option value="baja">Baja</option></select>
            </div>
          </div>
          <div><label class="label">Descripción</label><input v-model="fTarifa.descripcion" class="input" placeholder="Ej. Pase día adulto" /></div>
        </div>

        <!-- Form Quincho -->
        <div v-if="modal === 'quincho'" class="space-y-3">
          <div><label class="label">Nombre</label><input v-model="fQuincho.nombre" class="input" /></div>
          <div><label class="label">Capacidad</label><input v-model.number="fQuincho.capacidad" type="number" min="1" class="input" /></div>
          <div><label class="label">Descripción</label><input v-model="fQuincho.descripcion" class="input" /></div>
        </div>

        <!-- Form Zona -->
        <div v-if="modal === 'zona'" class="space-y-3">
          <div><label class="label">Nombre</label><input v-model="fZona.nombre" class="input" /></div>
          <div><label class="label">Color de pulsera</label>
            <div class="flex items-center gap-2"><input v-model="fZona.color" type="color" class="h-10 w-14 rounded border" /><input v-model="fZona.color" class="input font-mono" /></div>
          </div>
          <div><label class="label">Aforo máximo (0 = sin tope)</label><input v-model.number="fZona.aforo_max" type="number" min="0" class="input" /></div>
        </div>

        <p v-if="errorModal" class="text-sm text-red-600 mt-3">{{ errorModal }}</p>
        <div class="flex justify-end gap-2 mt-5">
          <button class="btn-ghost" @click="modal = ''">Cancelar</button>
          <button class="btn-primary" :disabled="guardando" @click="guardar">{{ guardando ? "Guardando…" : "Guardar" }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { axios, auth, pesos } from "../utils/api.js";

const TIPOS = { pase_dia: "Pase día", pase_pileta: "Pase pileta", quincho: "Quincho", acampe: "Acampe" };
const TEMP = { todo_el_anio: "Todo el año", alta: "Alta", baja: "Baja" };

const tabs = [
  { id: "tarifas", label: "Tarifas" },
  { id: "quinchos", label: "Quinchos" },
  { id: "zonas", label: "Zonas" },
];
const tab = ref("tarifas");

const tarifas = ref([]);
const quinchos = ref([]);
const zonas = ref([]);

const modal = ref("");
const guardando = ref(false);
const errorModal = ref("");
const editId = ref(null);

const fTarifa = reactive({ tipo: "pase_dia", precio: 0, condicion: "general", temporada: "todo_el_anio", descripcion: "" });
const fQuincho = reactive({ nombre: "", capacidad: 50, descripcion: "" });
const fZona = reactive({ nombre: "", color: "#2e7d4f", aforo_max: 0 });

const tituloModal = computed(() => {
  const accion = editId.value ? "Editar" : "Nueva";
  return { tarifa: `${accion} tarifa`, quincho: `${accion} quincho`, zona: `${accion} zona` }[modal.value] || "";
});

async function cargar() {
  const [t, q, z] = await Promise.all([
    axios.get("/api/tarifas", auth()),
    axios.get("/api/quinchos", auth()),
    axios.get("/api/zonas", auth()),
  ]);
  tarifas.value = t.data;
  quinchos.value = q.data;
  zonas.value = z.data;
}

// ── Tarifas ──
function nuevaTarifa() {
  editId.value = null;
  Object.assign(fTarifa, { tipo: "pase_dia", precio: 0, condicion: "general", temporada: "todo_el_anio", descripcion: "" });
  errorModal.value = "";
  modal.value = "tarifa";
}
function editarTarifa(t) {
  editId.value = t.id;
  Object.assign(fTarifa, { tipo: t.tipo, precio: Number(t.precio), condicion: t.condicion, temporada: t.temporada, descripcion: t.descripcion || "" });
  errorModal.value = "";
  modal.value = "tarifa";
}
async function bajaTarifa(t) {
  if (!confirm(`¿Desactivar la tarifa "${TIPOS[t.tipo]} ${t.descripcion || ""}"?`)) return;
  await axios.delete(`/api/tarifas/${t.id}`, auth());
  await cargar();
}

// ── Quinchos ──
function nuevoQuincho() {
  editId.value = null;
  Object.assign(fQuincho, { nombre: "", capacidad: 50, descripcion: "" });
  errorModal.value = "";
  modal.value = "quincho";
}
function editarQuincho(q) {
  editId.value = q.id;
  Object.assign(fQuincho, { nombre: q.nombre, capacidad: q.capacidad, descripcion: q.descripcion || "" });
  errorModal.value = "";
  modal.value = "quincho";
}
async function bajaQuincho(q) {
  if (!confirm(`¿Desactivar el quincho "${q.nombre}"?`)) return;
  await axios.delete(`/api/quinchos/${q.id}`, auth());
  await cargar();
}

// ── Zonas ──
function nuevaZona() {
  editId.value = null;
  Object.assign(fZona, { nombre: "", color: "#2e7d4f", aforo_max: 0 });
  errorModal.value = "";
  modal.value = "zona";
}
function editarZona(z) {
  editId.value = z.id;
  Object.assign(fZona, { nombre: z.nombre, color: z.color, aforo_max: z.aforo_max });
  errorModal.value = "";
  modal.value = "zona";
}

async function guardar() {
  errorModal.value = "";
  guardando.value = true;
  try {
    const map = {
      tarifa: { base: "/api/tarifas", body: { ...fTarifa } },
      quincho: { base: "/api/quinchos", body: { ...fQuincho } },
      zona: { base: "/api/zonas", body: { ...fZona } },
    };
    const { base, body } = map[modal.value];
    if (editId.value) await axios.put(`${base}/${editId.value}`, body, auth());
    else await axios.post(base, body, auth());
    modal.value = "";
    await cargar();
  } catch (e) {
    errorModal.value = e?.response?.data?.message || "No se pudo guardar";
  } finally {
    guardando.value = false;
  }
}

onMounted(cargar);
</script>

<style scoped>
.acc {
  @apply text-xs font-semibold px-2 py-1 rounded hover:bg-gray-100;
}
</style>
