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
          <button class="btn-primary w-full" :disabled="validando" @click="validarManual">Buscar reserva</button>
        </div>
      </div>

      <!-- Resultado / Confirmación -->
      <div>
        <!-- Esperando -->
        <div v-if="!preview && !resultado" class="card h-full flex items-center justify-center text-gray-400 text-center min-h-[300px]">
          Esperando escaneo…
        </div>

        <!-- Paso 2: el QR se escaneó → (elegir zona si hay varias) y cargar cuántos entran -->
        <div v-else-if="preview && !resultado" class="card h-full min-h-[300px] flex flex-col">
          <div class="text-center">
            <div class="font-semibold text-gray-800">{{ preview.reserva?.numero }} · {{ preview.reserva?.cliente }}</div>
            <div class="text-sm text-gray-500">{{ preview.reserva?.fecha }}</div>
          </div>

          <!-- Varios conceptos: el guardia elige a qué zona ingresa -->
          <div v-if="preview.items && preview.items.length > 1 && !itemElegido" class="mt-5 border-t pt-4">
            <label class="label text-center block mb-2">Reserva con varias zonas — ¿a cuál ingresa?</label>
            <div class="grid gap-2">
              <button v-for="it in preview.items" :key="it.id"
                      class="flex items-center justify-between px-4 py-3 rounded-lg text-white font-semibold disabled:opacity-50"
                      :style="{ background: it.color || '#888' }"
                      :disabled="it.cupo.restante <= 0"
                      @click="elegirItem(it)">
                <span>🎟️ Pulsera {{ it.zona }}</span>
                <span class="text-sm">quedan {{ it.cupo.restante }}/{{ it.cupo.total }}</span>
              </button>
            </div>
            <button class="btn-ghost w-full mt-3" @click="reiniciar">Cancelar</button>
          </div>

          <!-- Concepto único o ya elegido: cargar cantidad -->
          <div v-else class="mt-5">
            <div class="text-center">
              <div class="inline-flex items-center gap-2 text-lg font-semibold px-4 py-2 rounded-full text-white"
                   :style="{ background: pulseraActiva.color || '#888' }">
                Pulsera {{ pulseraActiva.zona }}
              </div>
              <div class="mt-3 text-sm text-gray-600">
                Quedan <b class="text-monte-600 text-lg">{{ cupoActivo.restante }}</b> de {{ cupoActivo.total }} lugares
              </div>
            </div>
            <div v-if="cupoActivo.restante > 0" class="mt-5 border-t pt-4">
              <label class="label">¿Cuántas personas ingresan ahora?</label>
              <div class="flex items-center justify-center gap-3 mt-2">
                <button class="btn-ghost text-2xl px-4" @click="cantidad = Math.max(1, cantidad - 1)">−</button>
                <input v-model.number="cantidad" type="number" min="1" :max="cupoActivo.restante"
                       class="input text-center text-2xl font-bold w-24" />
                <button class="btn-ghost text-2xl px-4" @click="cantidad = Math.min(cupoActivo.restante, cantidad + 1)">＋</button>
              </div>
              <button class="btn-primary w-full mt-4" :disabled="validando" @click="confirmar">
                Confirmar ingreso de {{ cantidad }} {{ cantidad === 1 ? "persona" : "personas" }} →
              </button>
              <button class="btn-ghost w-full mt-2" @click="reiniciar">Cancelar</button>
            </div>
            <div v-else class="mt-5 border-t pt-4 text-center">
              <div class="text-red-600 font-semibold">🚫 Cupo agotado — no quedan lugares</div>
              <button class="btn-ghost w-full mt-3" @click="reiniciar">Escanear otro</button>
            </div>
          </div>
        </div>

        <!-- Paso 3: resultado final -->
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
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import { Html5Qrcode } from "html5-qrcode";
import { axios, auth } from "../utils/api.js";

const modo = ref("camara");
const cantidad = ref(1);
const tokenManual = ref("");
const preview = ref(null); // datos del QR escaneado (paso 2)
const resultado = ref(null); // resultado final del ingreso (paso 3)
const itemElegido = ref(null); // concepto elegido cuando la reserva tiene varias zonas
const validando = ref(false);
const camError = ref("");
let tokenActual = ""; // token del QR en curso

// Pulsera y cupo "activos" según el concepto elegido (o el único, o legacy)
const pulseraActiva = computed(() => {
  if (itemElegido.value) return { zona: itemElegido.value.zona, color: itemElegido.value.color };
  const items = preview.value?.items || [];
  if (items.length === 1) return { zona: items[0].zona, color: items[0].color };
  return preview.value?.pulsera || { zona: "", color: "#888" };
});
const cupoActivo = computed(() => {
  if (itemElegido.value) return itemElegido.value.cupo;
  const items = preview.value?.items || [];
  if (items.length === 1) return items[0].cupo;
  return preview.value?.cupo || { total: 0, usado: 0, restante: 0 };
});
function elegirItem(it) {
  itemElegido.value = it;
  cantidad.value = it.cupo.restante > 0 ? it.cupo.restante : 1;
}

let scanner = null;
let bloqueado = false; // evita disparos múltiples por frame

const TIPOS = { quincho: "Quincho", pase_pileta: "Pase pileta", pase_dia: "Pase día", acampe: "Acampe" };
function tipoLabel(t) {
  return TIPOS[t] || t || "";
}

// Paso 1: escaneó/ingresó un token → consultar el QR (NO registra todavía)
async function consultar(token) {
  if (!token) return;
  tokenActual = token;
  validando.value = true;
  resultado.value = null;
  itemElegido.value = null;
  try {
    const { data } = await axios.get("/api/qr/" + encodeURIComponent(token), auth());
    preview.value = data;
    cantidad.value = data.cupo?.restante > 0 ? data.cupo.restante : 1;
  } catch (e) {
    resultado.value = { ok: false, message: "❌ " + (e?.response?.data?.message || "QR inválido o inexistente") };
    preview.value = null;
  } finally {
    validando.value = false;
  }
}

// Paso 2: confirmar → registra el ingreso y descuenta el cupo
async function confirmar() {
  validando.value = true;
  try {
    const body = { token: tokenActual, cantidad_personas: cantidad.value };
    const items = preview.value?.items || [];
    if (itemElegido.value) body.reserva_item_id = itemElegido.value.id;
    else if (items.length === 1) body.reserva_item_id = items[0].id;

    const { data } = await axios.post("/api/ingresos/escanear", body, auth());

    // El backend pide elegir zona (varios conceptos con cupo) → mostrar el selector
    if (data.requiere_seleccion) {
      preview.value = { ...preview.value, items: data.items };
      itemElegido.value = null;
      return;
    }
    resultado.value = data;
    preview.value = null;
  } catch (e) {
    resultado.value = e?.response?.data || { ok: false, message: "Error al validar" };
    preview.value = null;
  } finally {
    validando.value = false;
  }
}

function validarManual() {
  consultar(tokenManual.value.trim());
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
        await consultar(texto.trim());
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
  preview.value = null;
  itemElegido.value = null;
  tokenActual = "";
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
