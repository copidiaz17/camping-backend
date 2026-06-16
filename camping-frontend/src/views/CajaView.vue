<template>
  <div>
    <header class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Caja</h1>
        <p class="text-gray-500 text-sm">Turno, cobros, movimientos y arqueo</p>
      </div>
      <span v-if="estado.abierta" class="text-sm font-semibold text-monte-600 bg-monte-50 px-3 py-1 rounded-full">● Caja abierta</span>
      <span v-else class="text-sm font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">○ Caja cerrada</span>
    </header>

    <!-- Caja cerrada: abrir -->
    <div v-if="!estado.abierta" class="card max-w-md mx-auto text-center py-8">
      <div class="text-4xl mb-3">🔒</div>
      <h2 class="font-bold text-gray-800 mb-1">No hay una caja abierta</h2>
      <p class="text-gray-500 text-sm mb-5">Abrí la caja con el monto inicial para empezar a cobrar.</p>
      <div class="flex items-end gap-2 justify-center">
        <div class="text-left">
          <label class="label">Monto inicial</label>
          <input v-model.number="montoInicial" type="number" min="0" class="input w-40" placeholder="0" />
        </div>
        <button class="btn-primary" :disabled="trabajando" @click="abrir">Abrir caja</button>
      </div>
    </div>

    <!-- Caja abierta -->
    <div v-else class="space-y-5">
      <!-- Resumen -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card"><div class="text-gray-500 text-sm">Inicial</div><div class="text-xl font-bold">{{ pesos(R.monto_inicial) }}</div></div>
        <div class="card"><div class="text-gray-500 text-sm">Ingresos</div><div class="text-xl font-bold text-monte-600">{{ pesos(R.ingresos?.total) }}</div></div>
        <div class="card"><div class="text-gray-500 text-sm">Egresos</div><div class="text-xl font-bold text-red-500">{{ pesos(R.egresos?.total) }}</div></div>
        <div class="card bg-monte-50 border-monte-100"><div class="text-gray-500 text-sm">Esperado en efectivo</div><div class="text-xl font-bold text-monte-700">{{ pesos(R.esperado_efectivo) }}</div></div>
      </div>

      <!-- Desglose por método -->
      <div class="card">
        <h3 class="font-bold text-gray-800 mb-3">Ingresos por método</h3>
        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="rounded-lg bg-gray-50 py-3"><div class="text-xs text-gray-500">💵 Efectivo</div><div class="font-bold">{{ pesos(R.ingresos?.efectivo) }}</div></div>
          <div class="rounded-lg bg-gray-50 py-3"><div class="text-xs text-gray-500">🏦 Transferencia</div><div class="font-bold">{{ pesos(R.ingresos?.transferencia) }}</div></div>
          <div class="rounded-lg bg-gray-50 py-3"><div class="text-xs text-gray-500">📱 MercadoPago</div><div class="font-bold">{{ pesos(R.ingresos?.mercadopago) }}</div></div>
        </div>
      </div>

      <!-- Acciones -->
      <div class="flex flex-wrap gap-2">
        <button class="btn-primary" @click="abrirCobro">💳 Cobrar reserva</button>
        <button class="btn-ghost" @click="abrirMovimiento">+ Movimiento manual</button>
        <button class="btn-ghost ml-auto !text-red-600 !border-red-200 hover:!bg-red-50" @click="abrirCierre">Cerrar caja</button>
      </div>

      <!-- Movimientos -->
      <div class="card overflow-x-auto">
        <h3 class="font-bold text-gray-800 mb-3">Movimientos del turno</h3>
        <p v-if="!movimientos.length" class="text-gray-400 text-sm py-6 text-center">Sin movimientos todavía.</p>
        <table v-else class="w-full text-sm">
          <thead class="text-left text-gray-400 border-b">
            <tr><th class="py-2">Hora</th><th>Concepto</th><th>Método</th><th>Tipo</th><th class="text-right">Monto</th></tr>
          </thead>
          <tbody>
            <tr v-for="m in movimientos" :key="m.id" class="border-b last:border-0">
              <td class="py-2 text-gray-500">{{ hora(m.createdAt) }}</td>
              <td>{{ m.concepto }}</td>
              <td class="capitalize">{{ m.metodo_pago }}</td>
              <td><span :class="m.tipo === 'egreso' ? 'text-red-500' : 'text-monte-600'">{{ m.tipo }}</span></td>
              <td class="text-right font-semibold" :class="m.tipo === 'egreso' ? 'text-red-500' : ''">
                {{ m.tipo === "egreso" ? "−" : "+" }}{{ pesos(m.monto) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal cobrar reserva -->
    <Modal v-if="modal === 'cobro'" titulo="Cobrar reserva" @cerrar="modal = ''">
      <div v-if="!porCobrar.length" class="text-gray-400 text-sm py-4 text-center">No hay reservas pendientes de pago.</div>
      <div v-else class="space-y-3">
        <div>
          <label class="label">Reserva</label>
          <select v-model="cobro.reserva_id" class="input">
            <option :value="null" disabled>Elegí una reserva…</option>
            <option v-for="r in porCobrar" :key="r.id" :value="r.id">
              {{ r.numero }} · {{ r.cliente?.nombre }} {{ r.cliente?.apellido || "" }} · {{ pesos(r.monto) }}
            </option>
          </select>
        </div>
        <div>
          <label class="label">Método de pago</label>
          <select v-model="cobro.metodo_pago" class="input">
            <option value="efectivo">💵 Efectivo</option>
            <option value="transferencia">🏦 Transferencia</option>
            <option value="mercadopago">📱 MercadoPago</option>
          </select>
        </div>
      </div>
      <template #acciones>
        <button class="btn-primary" :disabled="trabajando || !cobro.reserva_id" @click="cobrar">Cobrar</button>
      </template>
    </Modal>

    <!-- Modal movimiento manual -->
    <Modal v-if="modal === 'mov'" titulo="Movimiento manual" @cerrar="modal = ''">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Tipo</label>
            <select v-model="mov.tipo" class="input"><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select>
          </div>
          <div>
            <label class="label">Método</label>
            <select v-model="mov.metodo_pago" class="input">
              <option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="mercadopago">MercadoPago</option>
            </select>
          </div>
        </div>
        <div><label class="label">Concepto</label><input v-model="mov.concepto" class="input" placeholder="Ej. Venta kiosco, compra hielo…" /></div>
        <div><label class="label">Monto</label><input v-model.number="mov.monto" type="number" min="0" class="input" /></div>
      </div>
      <template #acciones>
        <button class="btn-primary" :disabled="trabajando" @click="guardarMov">Registrar</button>
      </template>
    </Modal>

    <!-- Modal cierre / arqueo -->
    <Modal v-if="modal === 'cierre'" titulo="Cerrar caja — arqueo" @cerrar="modal = ''">
      <div v-if="!arqueo" class="space-y-3">
        <div class="rounded-lg bg-gray-50 p-3 text-sm">
          <div class="flex justify-between"><span>Esperado en efectivo</span><b>{{ pesos(R.esperado_efectivo) }}</b></div>
          <p class="text-xs text-gray-400 mt-1">Contá el efectivo de la caja y declaralo abajo.</p>
        </div>
        <div><label class="label">Efectivo contado</label><input v-model.number="cierre.monto_declarado" type="number" min="0" class="input" /></div>
        <div><label class="label">Observaciones (opcional)</label><input v-model="cierre.observaciones" class="input" /></div>
      </div>
      <div v-else class="text-center py-2">
        <div class="text-4xl mb-2">{{ arqueo.estado === "cuadra" ? "✅" : "⚠️" }}</div>
        <h3 class="font-bold text-lg" :class="arqueo.estado === 'cuadra' ? 'text-monte-600' : 'text-amber-600'">
          {{ arqueo.estado === "cuadra" ? "La caja cuadra" : arqueo.estado === "sobrante" ? "Hay un sobrante" : "Hay un faltante" }}
        </h3>
        <div class="mt-3 text-sm inline-block text-left">
          <div class="flex justify-between gap-8"><span>Esperado</span><b>{{ pesos(arqueo.esperado_efectivo) }}</b></div>
          <div class="flex justify-between gap-8"><span>Declarado</span><b>{{ pesos(arqueo.declarado) }}</b></div>
          <div class="flex justify-between gap-8 border-t mt-1 pt-1"><span>Diferencia</span>
            <b :class="arqueo.diferencia === 0 ? 'text-monte-600' : 'text-amber-600'">{{ pesos(arqueo.diferencia) }}</b>
          </div>
        </div>
      </div>
      <template #acciones>
        <button v-if="!arqueo" class="btn-primary !bg-red-600 hover:!bg-red-700" :disabled="trabajando" @click="cerrar">Confirmar cierre</button>
        <button v-else class="btn-primary" @click="finCierre">Listo</button>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, h } from "vue";
import { axios, auth, pesos } from "../utils/api.js";

// Mini-componente Modal inline (header + slot + acciones)
const Modal = {
  props: { titulo: String },
  emits: ["cerrar"],
  setup(props, { slots, emit }) {
    return () =>
      h("div", { class: "fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50", onClick: (e) => e.target === e.currentTarget && emit("cerrar") }, [
        h("div", { class: "bg-white rounded-xl w-full max-w-md p-6" }, [
          h("h2", { class: "text-lg font-bold mb-4" }, props.titulo),
          slots.default && slots.default(),
          h("div", { class: "flex justify-end gap-2 mt-5" }, [
            h("button", { class: "btn-ghost", onClick: () => emit("cerrar") }, "Cancelar"),
            slots.acciones && slots.acciones(),
          ]),
        ]),
      ]);
  },
};

const estado = ref({ abierta: false });
const movimientos = ref([]);
const porCobrar = ref([]);
const trabajando = ref(false);

const montoInicial = ref(0);
const modal = ref("");
const cobro = reactive({ reserva_id: null, metodo_pago: "efectivo" });
const mov = reactive({ tipo: "ingreso", concepto: "", metodo_pago: "efectivo", monto: 0 });
const cierre = reactive({ monto_declarado: 0, observaciones: "" });
const arqueo = ref(null);

const R = computed(() => estado.value.resumen || {});

function hora(iso) {
  return iso ? new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "";
}

async function cargar() {
  const { data } = await axios.get("/api/caja/actual", auth());
  estado.value = data;
  movimientos.value = data.caja?.movimientos?.slice().sort((a, b) => b.id - a.id) || [];
}
async function cargarPorCobrar() {
  const { data } = await axios.get("/api/reservas", auth());
  porCobrar.value = data.filter((r) => r.estado !== "cancelada" && r.estado_pago !== "pagado");
}

async function abrir() {
  trabajando.value = true;
  try {
    await axios.post("/api/caja/abrir", { monto_inicial: montoInicial.value || 0 }, auth());
    await cargar();
  } catch (e) {
    alert(e?.response?.data?.message || "No se pudo abrir la caja");
  } finally {
    trabajando.value = false;
  }
}

function abrirCobro() {
  cobro.reserva_id = null;
  cobro.metodo_pago = "efectivo";
  cargarPorCobrar();
  modal.value = "cobro";
}
async function cobrar() {
  trabajando.value = true;
  try {
    await axios.post("/api/caja/cobrar-reserva", { ...cobro }, auth());
    modal.value = "";
    await cargar();
  } catch (e) {
    alert(e?.response?.data?.message || "No se pudo cobrar");
  } finally {
    trabajando.value = false;
  }
}

function abrirMovimiento() {
  Object.assign(mov, { tipo: "ingreso", concepto: "", metodo_pago: "efectivo", monto: 0 });
  modal.value = "mov";
}
async function guardarMov() {
  if (!mov.concepto || !mov.monto) return alert("Completá concepto y monto");
  trabajando.value = true;
  try {
    await axios.post("/api/caja/movimientos", { ...mov }, auth());
    modal.value = "";
    await cargar();
  } catch (e) {
    alert(e?.response?.data?.message || "No se pudo registrar");
  } finally {
    trabajando.value = false;
  }
}

function abrirCierre() {
  arqueo.value = null;
  cierre.monto_declarado = R.value.esperado_efectivo || 0;
  cierre.observaciones = "";
  modal.value = "cierre";
}
async function cerrar() {
  trabajando.value = true;
  try {
    const { data } = await axios.post("/api/caja/cerrar", { ...cierre }, auth());
    arqueo.value = data.arqueo;
  } catch (e) {
    alert(e?.response?.data?.message || "No se pudo cerrar");
  } finally {
    trabajando.value = false;
  }
}
async function finCierre() {
  modal.value = "";
  arqueo.value = null;
  await cargar();
}

onMounted(cargar);
</script>
