<template>
  <div>
    <header class="mb-5">
      <h1 class="text-2xl font-bold text-gray-800">Control de acceso</h1>
      <p class="text-gray-500 text-sm">Escaneá el QR de la reserva en la entrada del camping</p>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <!-- Escáner -->
      <div class="card">
        <div class="flex gap-2 mb-4">
          <button class="flex-1" :class="modo === 'camara' ? 'btn-primary' : 'btn-ghost'" @click="setModo('camara')">📷 Cámara</button>
          <button class="flex-1" :class="modo === 'manual' ? 'btn-primary' : 'btn-ghost'" @click="setModo('manual')">⌨️ Manual</button>
        </div>

        <div class="mb-4">
          <label class="label">¿Cuántas personas ingresan?</label>
          <input v-model.number="cantidad" type="number" min="1" class="input w-28" />
        </div>

        <!-- Cámara -->
        <div v-show="modo === 'camara'">
          <div id="reader" class="rounded-lg overflow-hidden bg-black/5 min-h-[260px]"></div>
          <p v-if="camError" class="text-sm text-amber-600 mt-2">{{ camError }}</p>
        </div>

        <!-- Manual -->
        <div v-if="modo === 'manual'" class="space-y-3">
          <div>
            <label class="label">Token del QR</label>
            <input v-model="tokenManual" class="input font-mono" placeholder="Pegá o escribí el token…" @keyup.enter="validarManual" />
          </div>
          <button class="btn-primary w-full" :disabled="validando" @click="validarManual">Validar ingreso</button>
        </div>
      </div>

      <!-- Resultado -->
      <div>
        <div v-if="!resultado" class="card h-full flex items-center justify-center text-gray-400 text-center min-h-[300px]">
          Esperando escaneo…
        </div>

        <div v-else class="card h-full min-h-[300px] flex flex-col items-center justify-center text-center"
             :class="resultado.ok ? 'border-2 border-monte-500' : 'border-2 border-red-400'">
          <div class="text-6xl mb-3">{{ resultado.ok ? "✅" : "🚫" }}</div>
          <h2 class="text-xl font-bold" :class="resultado.ok ? 'text-monte-600' : 'text-red-600'">{{ resultado.message }}</h2>

          <template v-if="resultado.ok">
            <div class="mt-4 inline-flex items-center gap-2 text-lg font-semibold px-4 py-2 rounded-full text-white"
                 :style="{ background: resultado.pulsera?.color }">
              Pulsera {{ resultado.pulsera?.zona }}
            </div>
            <div class="mt-4 text-gray-600">
              <div class="font-semibold">{{ resultado.reserva?.numero }} · {{ resultado.reserva?.cliente }}</div>
              <div class="text-sm">{{ resultado.ingreso?.cantidad_personas }} persona(s) · {{ resultado.ingreso?.hora }}</div>
              <div class="mt-2 text-sm">
                Cupo: <b>{{ resultado.cupo?.usado }}/{{ resultado.cupo?.total }}</b>
                · quedan <b>{{ resultado.cupo?.restante }}</b>
              </div>
            </div>
          </template>

          <button class="btn-ghost mt-6" @click="reiniciar">Escanear otro</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { Html5Qrcode } from "html5-qrcode";
import { axios, auth } from "../utils/api.js";

const modo = ref("camara");
const cantidad = ref(1);
const tokenManual = ref("");
const resultado = ref(null);
const validando = ref(false);
const camError = ref("");

let scanner = null;
let bloqueado = false; // evita disparos múltiples por frame

async function escanear(token) {
  if (!token) return;
  validando.value = true;
  try {
    const { data } = await axios.post("/api/ingresos/escanear", { token, cantidad_personas: cantidad.value }, auth());
    resultado.value = data;
  } catch (e) {
    resultado.value = e?.response?.data || { ok: false, message: "Error al validar" };
  } finally {
    validando.value = false;
  }
}

function validarManual() {
  escanear(tokenManual.value.trim());
}

async function setModo(m) {
  modo.value = m;
  await stopCam();
  if (m === "camara") {
    await nextTick();
    startCam();
  }
}

async function startCam() {
  camError.value = "";
  try {
    scanner = new Html5Qrcode("reader");
    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 240 },
      async (texto) => {
        if (bloqueado) return;
        bloqueado = true;
        await stopCam();
        await escanear(texto.trim());
      }
    );
  } catch (e) {
    camError.value = "No se pudo abrir la cámara. Usá el modo Manual o revisá los permisos.";
  }
}

async function stopCam() {
  if (scanner) {
    try {
      await scanner.stop();
      await scanner.clear();
    } catch {}
    scanner = null;
  }
}

async function reiniciar() {
  resultado.value = null;
  tokenManual.value = "";
  bloqueado = false;
  if (modo.value === "camara") {
    await nextTick();
    startCam();
  }
}

onMounted(async () => {
  await nextTick();
  if (modo.value === "camara") startCam();
});
onBeforeUnmount(stopCam);
</script>
