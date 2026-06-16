<template>
  <div>
    <header class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Reservas</h1>
        <p class="text-gray-500 text-sm">Crear, cobrar y generar el QR de acceso</p>
      </div>
      <button v-if="!esGuardia" class="btn-primary" @click="abrirNueva">+ Nueva reserva</button>
    </header>

    <!-- Filtros -->
    <div class="card mb-4 flex flex-wrap items-end gap-3">
      <div>
        <label class="label">Fecha</label>
        <input v-model="filtros.fecha" type="date" class="input" @change="cargar" />
      </div>
      <div>
        <label class="label">Estado</label>
        <select v-model="filtros.estado" class="input" @change="cargar">
          <option value="">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="confirmada">Confirmada</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>
      <button class="btn-ghost" @click="limpiarFiltros">Limpiar</button>
    </div>

    <!-- Tabla -->
    <div class="card overflow-x-auto">
      <p v-if="!reservas.length" class="text-gray-400 text-sm py-8 text-center">No hay reservas con esos filtros.</p>
      <table v-else class="w-full text-sm">
        <thead class="text-left text-gray-400 border-b">
          <tr>
            <th class="py-2">N°</th><th>Cliente</th><th>Tipo</th><th>Zona</th>
            <th>Fecha</th><th class="text-center">Cupo</th><th class="text-right">Monto</th>
            <th>Estado</th><th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in reservas" :key="r.id" class="border-b last:border-0 hover:bg-gray-50">
            <td class="py-2 font-mono text-xs">{{ r.numero }}</td>
            <td>{{ r.cliente?.nombre }} {{ r.cliente?.apellido || "" }}</td>
            <td>{{ tipoLabel(r.tipo) }}</td>
            <td>
              <span class="inline-flex items-center gap-1">
                <span class="w-2.5 h-2.5 rounded-full" :style="{ background: r.zona?.color }"></span>{{ r.zona?.nombre }}
              </span>
            </td>
            <td>{{ r.fecha }}</td>
            <td class="text-center">{{ r.cupo }}</td>
            <td class="text-right">{{ pesos(r.monto) }}</td>
            <td>
              <span :class="estadoClase(r.estado)">{{ r.estado }}</span>
              <span v-if="r.estado_pago === 'pagado'" class="ml-1 text-xs text-green-600">· pagada</span>
            </td>
            <td class="text-right whitespace-nowrap">
              <button v-if="!esGuardia && r.estado === 'pendiente'" class="acc text-monte-600" @click="confirmar(r)">Confirmar</button>
              <button v-if="r.estado === 'confirmada'" class="acc text-blue-600" @click="verQR(r)">Ver QR</button>
              <button v-if="!esGuardia && r.estado !== 'cancelada'" class="acc text-red-500" @click="cancelar(r)">Cancelar</button>
              <span v-if="esGuardia && r.estado !== 'confirmada'" class="text-xs text-gray-400">solo lectura</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal nueva reserva -->
    <div v-if="modal" class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" @click.self="modal = false">
      <div class="bg-white rounded-xl w-full max-w-lg p-6">
        <h2 class="text-lg font-bold mb-4">Nueva reserva</h2>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Tipo</label>
            <select v-model="form.tipo" class="input">
              <option value="pase_dia">Pase día</option>
              <option value="pase_pileta">Pase pileta</option>
              <option value="quincho">Quincho</option>
              <option value="acampe">Acampe</option>
            </select>
          </div>
          <div>
            <label class="label">Fecha</label>
            <input v-model="form.fecha" type="date" class="input" />
          </div>
          <div v-if="form.tipo === 'quincho'" class="col-span-2">
            <label class="label">Quincho</label>
            <select v-model="form.quincho_id" class="input">
              <option :value="null" disabled>Elegí un quincho…</option>
              <option v-for="q in quinchos" :key="q.id" :value="q.id">{{ q.nombre }} (cap. {{ q.capacidad }})</option>
            </select>
          </div>
          <div v-else>
            <label class="label">Cantidad de personas</label>
            <input v-model.number="form.cantidad_personas" type="number" min="1" class="input" />
          </div>
          <div class="col-span-2 border-t pt-3 mt-1">
            <p class="text-xs font-semibold text-gray-500 mb-2">Cliente</p>
            <div class="grid grid-cols-2 gap-3">
              <input v-model="form.cliente.nombre" class="input" placeholder="Nombre *" />
              <input v-model="form.cliente.apellido" class="input" placeholder="Apellido" />
              <input v-model="form.cliente.telefono" class="input col-span-2" placeholder="WhatsApp (ej. 5493854000000)" />
            </div>
          </div>
        </div>

        <p v-if="errorForm" class="text-sm text-red-600 mt-3">{{ errorForm }}</p>
        <div class="flex justify-end gap-2 mt-5">
          <button class="btn-ghost" @click="modal = false">Cancelar</button>
          <button class="btn-primary" :disabled="guardando" @click="crear">{{ guardando ? "Guardando…" : "Crear reserva" }}</button>
        </div>
      </div>
    </div>

    <!-- Modal QR -->
    <div v-if="qrModal" class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" @click.self="qrModal = false">
      <div class="bg-white rounded-xl w-full max-w-xs p-6 text-center">
        <h2 class="text-lg font-bold mb-1">{{ qrData?.reserva?.numero }}</h2>
        <p class="text-sm text-gray-500 mb-3">{{ qrData?.reserva?.cliente }}</p>
        <img v-if="qrImg" :src="qrImg" class="mx-auto rounded-lg border" width="220" height="220" />
        <div v-if="qrData" class="mt-3 text-sm">
          <span class="inline-flex items-center gap-1.5 font-semibold">
            <span class="w-3 h-3 rounded-full" :style="{ background: qrData.pulsera?.color }"></span>
            Pulsera {{ qrData.pulsera?.zona }}
          </span>
          <div class="text-gray-500 mt-1">
            Cupo {{ qrData.cupo.usado }}/{{ qrData.cupo.total }} · válido el {{ qrData.vencimiento_fecha }}
          </div>
        </div>
        <button class="btn-ghost w-full mt-4" @click="qrModal = false">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import QRCode from "qrcode";
import { axios, auth, pesos, getUsuario } from "../utils/api.js";

// El guardia consulta reservas en modo solo lectura (no crea/confirma/cancela)
const esGuardia = getUsuario()?.rol === "guardia";

const hoy = new Date();
const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

const reservas = ref([]);
const quinchos = ref([]);
const filtros = reactive({ fecha: hoyISO, estado: "" });

const modal = ref(false);
const guardando = ref(false);
const errorForm = ref("");
const form = reactive({ tipo: "pase_dia", fecha: hoyISO, cantidad_personas: 1, quincho_id: null, cliente: { nombre: "", apellido: "", telefono: "" } });

const qrModal = ref(false);
const qrData = ref(null);
const qrImg = ref("");

const TIPOS = { quincho: "Quincho", pase_pileta: "Pase pileta", pase_dia: "Pase día", acampe: "Acampe" };
const tipoLabel = (t) => TIPOS[t] || t;
function estadoClase(e) {
  const base = "text-xs font-semibold px-2 py-0.5 rounded-full ";
  if (e === "confirmada") return base + "bg-green-100 text-green-700";
  if (e === "cancelada") return base + "bg-red-100 text-red-600";
  return base + "bg-amber-100 text-amber-700";
}

async function cargar() {
  const params = new URLSearchParams();
  if (filtros.fecha) params.set("fecha", filtros.fecha);
  if (filtros.estado) params.set("estado", filtros.estado);
  const { data } = await axios.get(`/api/reservas?${params}`, auth());
  reservas.value = data;
}
function limpiarFiltros() {
  filtros.fecha = "";
  filtros.estado = "";
  cargar();
}

function abrirNueva() {
  errorForm.value = "";
  Object.assign(form, { tipo: "pase_dia", fecha: hoyISO, cantidad_personas: 1, quincho_id: null, cliente: { nombre: "", apellido: "", telefono: "" } });
  modal.value = true;
}

async function crear() {
  errorForm.value = "";
  if (!form.cliente.nombre) return (errorForm.value = "El nombre del cliente es obligatorio");
  if (form.tipo === "quincho" && !form.quincho_id) return (errorForm.value = "Elegí un quincho");
  guardando.value = true;
  try {
    const payload = { tipo: form.tipo, fecha: form.fecha, cantidad_personas: form.cantidad_personas, cliente: { ...form.cliente } };
    if (form.tipo === "quincho") payload.quincho_id = form.quincho_id;
    await axios.post("/api/reservas", payload, auth());
    modal.value = false;
    await cargar();
  } catch (e) {
    errorForm.value = e?.response?.data?.message || "No se pudo crear la reserva";
  } finally {
    guardando.value = false;
  }
}

async function confirmar(r) {
  if (!confirm(`¿Confirmar y marcar pagada la reserva ${r.numero}? Se generará el QR.`)) return;
  await axios.post(`/api/reservas/${r.id}/confirmar`, {}, auth());
  await cargar();
}
async function cancelar(r) {
  if (!confirm(`¿Cancelar la reserva ${r.numero}?`)) return;
  await axios.post(`/api/reservas/${r.id}/cancelar`, {}, auth());
  await cargar();
}

async function verQR(r) {
  const { data } = await axios.get(`/api/qr/reserva/${r.id}`, auth());
  const qr = data[0];
  if (!qr) return alert("Esta reserva todavía no tiene QR.");
  // El detalle viene del endpoint /api/qr/:token (cupo, pulsera, etc.)
  const { data: info } = await axios.get(`/api/qr/${qr.token}`, auth());
  qrData.value = info;
  qrImg.value = await QRCode.toDataURL(qr.token, { width: 220, margin: 1 });
  qrModal.value = true;
}

onMounted(async () => {
  const [, q] = await Promise.all([cargar(), axios.get("/api/quinchos", auth())]);
  quinchos.value = q.data;
});
</script>

<style scoped>
.acc {
  @apply text-xs font-semibold px-2 py-1 rounded hover:bg-gray-100;
}
</style>
