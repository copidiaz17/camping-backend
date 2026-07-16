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
              <option value="quincho">Quincho</option>
              <option value="pileta">Pileta</option>
              <option value="asador">Asador</option>
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
          <template v-else-if="form.tipo === 'asador'">
            <div>
              <label class="label">Asador</label>
              <select v-model="form.asador_id" class="input">
                <option :value="null" disabled>Elegí un asador…</option>
                <option v-for="a in asadores" :key="a.id" :value="a.id">{{ a.nombre }}</option>
              </select>
            </div>
            <div>
              <label class="label">Personas</label>
              <input v-model.number="form.cantidad_personas" type="number" min="1" class="input" />
            </div>
          </template>
          <template v-else-if="form.tipo === 'pileta'">
            <div>
              <label class="label">Niños (hasta 10)</label>
              <input v-model.number="form.cantidad_ninos" type="number" min="0" class="input" />
            </div>
            <div>
              <label class="label">Adultos</label>
              <input v-model.number="form.cantidad_adultos" type="number" min="0" class="input" />
            </div>
          </template>
          <div v-else>
            <label class="label">Cantidad de personas</label>
            <input v-model.number="form.cantidad_personas" type="number" min="1" class="input" />
          </div>

          <!-- Estacionamiento (opcional, varios) -->
          <div class="col-span-2 border-t pt-3 mt-1">
            <p class="text-xs font-semibold text-gray-500 mb-2">Estacionamiento (opcional)</p>
            <div class="flex gap-2">
              <select v-model="vehSel" class="input flex-1">
                <option value="">Agregar vehículo…</option>
                <option v-for="v in vehiculosCat" :key="v.tipo" :value="v.tipo">{{ v.descripcion }} — {{ pesos(v.precio) }}</option>
              </select>
              <button type="button" class="btn-ghost whitespace-nowrap" @click="addVeh">+ Agregar</button>
            </div>
            <div v-for="(c, i) in form.vehiculos" :key="i" class="flex justify-between items-center text-sm mt-2 bg-gray-50 rounded px-3 py-1.5">
              <span>🚗 {{ vehDesc(c) }}</span>
              <button type="button" class="text-red-500" @click="form.vehiculos.splice(i, 1)">✕</button>
            </div>
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
const asadores = ref([]);
const vehiculosCat = ref([]);
const vehSel = ref("");
const filtros = reactive({ fecha: hoyISO, estado: "" });

const modal = ref(false);
const guardando = ref(false);
const errorForm = ref("");
const FORM_INICIAL = () => ({ tipo: "quincho", fecha: hoyISO, cantidad_personas: 1, cantidad_ninos: 0, cantidad_adultos: 2, quincho_id: null, asador_id: null, vehiculos: [], cliente: { nombre: "", apellido: "", telefono: "" } });
const form = reactive(FORM_INICIAL());

const qrModal = ref(false);
const qrData = ref(null);
const qrImg = ref("");

const TIPOS = { quincho: "Quincho", pileta: "Pileta", asador: "Asador", acampe: "Acampe", pase_pileta: "Pase pileta", pase_dia: "Pase día" };
const tipoLabel = (t) => TIPOS[t] || t;
const vehDesc = (clave) => {
  const v = vehiculosCat.value.find((x) => x.tipo === clave);
  return v ? `${v.descripcion} — ${pesos(v.precio)}` : clave;
};
function addVeh() {
  if (vehSel.value) { form.vehiculos.push(vehSel.value); vehSel.value = ""; }
}
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
  vehSel.value = "";
  Object.assign(form, FORM_INICIAL());
  modal.value = true;
}

async function crear() {
  errorForm.value = "";
  if (!form.cliente.nombre) return (errorForm.value = "El nombre del cliente es obligatorio");
  if (form.tipo === "quincho" && !form.quincho_id) return (errorForm.value = "Elegí un quincho");
  if (form.tipo === "asador" && !form.asador_id) return (errorForm.value = "Elegí un asador");
  if (form.tipo === "pileta" && form.cantidad_ninos + form.cantidad_adultos < 1) return (errorForm.value = "Indicá al menos una persona (niños o adultos)");
  guardando.value = true;
  try {
    const payload = { tipo: form.tipo, fecha: form.fecha, vehiculos: form.vehiculos, cliente: { ...form.cliente } };
    if (form.tipo === "quincho") payload.quincho_id = form.quincho_id;
    else if (form.tipo === "asador") { payload.asador_id = form.asador_id; payload.cantidad_personas = form.cantidad_personas; }
    else if (form.tipo === "pileta") { payload.cantidad_ninos = form.cantidad_ninos; payload.cantidad_adultos = form.cantidad_adultos; }
    else payload.cantidad_personas = form.cantidad_personas;
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
  const [, q, a, t] = await Promise.all([
    cargar(),
    axios.get("/api/quinchos", auth()),
    axios.get("/api/asadores", auth()),
    axios.get("/api/tarifas?soloActivas=1", auth()),
  ]);
  quinchos.value = q.data;
  asadores.value = a.data;
  vehiculosCat.value = (t.data || []).filter((x) => x.categoria === "vehiculo");
});
</script>

<style scoped>
.acc {
  @apply text-xs font-semibold px-2 py-1 rounded hover:bg-gray-100;
}
</style>
