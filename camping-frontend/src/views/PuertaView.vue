<template>
  <div>
    <header class="mb-5">
      <h1 class="text-2xl font-bold text-gray-800">Puerta — venta directa</h1>
      <p class="text-gray-500 text-sm">Para quien llega sin reserva: se registra, se cobra y se genera su QR en el momento.</p>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <!-- Formulario -->
      <div class="card">
        <h2 class="font-bold text-gray-800 mb-4">Datos del visitante</h2>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div><label class="label">Nombre *</label><input v-model="form.nombre" class="input" placeholder="Nombre y apellido" /></div>
            <div><label class="label">Teléfono (WhatsApp)</label><input v-model="form.telefono" class="input" placeholder="549385…" /></div>
          </div>
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
            <div v-if="form.tipo !== 'quincho'">
              <label class="label">Personas</label>
              <input v-model.number="form.cantidad_personas" type="number" min="1" class="input" />
            </div>
            <div v-else>
              <label class="label">Quincho</label>
              <select v-model="form.quincho_id" class="input">
                <option :value="null" disabled>Elegí…</option>
                <option v-for="q in quinchos" :key="q.id" :value="q.id">{{ q.nombre }} (cap. {{ q.capacidad }})</option>
              </select>
            </div>
          </div>
          <div>
            <label class="label">Método de pago</label>
            <select v-model="form.metodo_pago" class="input">
              <option value="efectivo">💵 Efectivo</option>
              <option value="transferencia">🏦 Transferencia</option>
              <option value="mercadopago">📱 MercadoPago</option>
            </select>
          </div>
        </div>

        <p v-if="error" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">
          {{ error }}
          <router-link v-if="/caja/i.test(error)" to="/caja" class="font-semibold underline ml-1">Ir a Caja</router-link>
        </p>

        <button class="btn-primary w-full mt-4" :disabled="cargando" @click="vender">
          {{ cargando ? "Procesando…" : "Registrar, cobrar y generar QR" }}
        </button>
      </div>

      <!-- Resultado -->
      <div>
        <div v-if="!venta" class="card h-full flex items-center justify-center text-gray-400 text-center min-h-[320px]">
          Cargá los datos y generá el QR del visitante.
        </div>

        <div v-else class="card h-full min-h-[320px] text-center flex flex-col items-center justify-center"
             :class="ingresado ? 'border-2 border-monte-500' : ''">
          <template v-if="!ingresado">
            <div class="text-sm text-gray-500 mb-1">{{ venta.reserva.numero }} · {{ venta.cliente.nombre }}</div>
            <img v-if="qrImg" :src="qrImg" class="mx-auto rounded-lg border" width="200" height="200" />
            <div class="mt-3 inline-flex items-center gap-2 font-semibold px-4 py-1.5 rounded-full text-white text-sm"
                 :style="{ background: venta.zona.color }">
              Pulsera {{ venta.zona.nombre }}
            </div>
            <div class="text-gray-600 text-sm mt-2">{{ pesos(venta.reserva.monto) }} · cobrado · {{ metodoLabel }}</div>
            <button class="btn-primary mt-5" :disabled="registrando" @click="registrarIngreso">
              {{ registrando ? "Registrando…" : "✅ Registrar ingreso ahora" }}
            </button>
            <button class="btn-ghost mt-2" @click="reset">Nueva venta</button>
          </template>

          <template v-else>
            <div class="text-6xl mb-2">✅</div>
            <h2 class="text-xl font-bold text-monte-600">¡Ingreso registrado!</h2>
            <div class="mt-3 inline-flex items-center gap-2 font-semibold px-4 py-1.5 rounded-full text-white"
                 :style="{ background: venta.zona.color }">
              Pulsera {{ venta.zona.nombre }}
            </div>
            <div class="text-gray-600 text-sm mt-3">
              {{ venta.cliente.nombre }} · {{ venta.reserva.cantidad_personas }} persona(s)<br>
              Cupo {{ ingreso.cupo.usado }}/{{ ingreso.cupo.total }}
            </div>
            <button class="btn-primary mt-6" @click="reset">Nueva venta</button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import QRCode from "qrcode";
import { axios, auth, pesos } from "../utils/api.js";

const quinchos = ref([]);
const form = reactive({ nombre: "", telefono: "", tipo: "pase_dia", cantidad_personas: 1, quincho_id: null, metodo_pago: "efectivo" });
const cargando = ref(false);
const error = ref("");

const venta = ref(null);
const qrImg = ref("");
const registrando = ref(false);
const ingresado = ref(false);
const ingreso = ref(null);

const METODOS = { efectivo: "Efectivo", transferencia: "Transferencia", mercadopago: "MercadoPago" };
const metodoLabel = computed(() => METODOS[form.metodo_pago] || form.metodo_pago);

async function vender() {
  error.value = "";
  if (!form.nombre) return (error.value = "Falta el nombre");
  if (form.tipo === "quincho" && !form.quincho_id) return (error.value = "Elegí un quincho");
  cargando.value = true;
  try {
    const { data } = await axios.post("/api/puerta/venta", { ...form }, auth());
    venta.value = data;
    ingresado.value = false;
    qrImg.value = await QRCode.toDataURL(data.qr.token, { width: 200, margin: 1 });
  } catch (e) {
    error.value = e?.response?.data?.message || "No se pudo registrar la venta";
  } finally {
    cargando.value = false;
  }
}

async function registrarIngreso() {
  registrando.value = true;
  try {
    const { data } = await axios.post(
      "/api/ingresos/escanear",
      { token: venta.value.qr.token, cantidad_personas: venta.value.reserva.cantidad_personas },
      auth()
    );
    ingreso.value = data;
    ingresado.value = true;
  } catch (e) {
    error.value = e?.response?.data?.message || "No se pudo registrar el ingreso";
  } finally {
    registrando.value = false;
  }
}

function reset() {
  venta.value = null;
  qrImg.value = "";
  ingresado.value = false;
  ingreso.value = null;
  error.value = "";
  Object.assign(form, { nombre: "", telefono: "", tipo: "pase_dia", cantidad_personas: 1, quincho_id: null, metodo_pago: "efectivo" });
}

onMounted(async () => {
  const { data } = await axios.get("/api/quinchos", auth());
  quinchos.value = data;
});
</script>
