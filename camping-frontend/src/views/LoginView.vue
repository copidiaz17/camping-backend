<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-monte-700 via-monte-600 to-monte-500 p-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-6 text-white">
        <div class="text-5xl mb-2">🏕️</div>
        <h1 class="text-2xl font-bold">Camping Las Casuarinas</h1>
        <p class="text-monte-100 text-sm">Sistema de gestión</p>
      </div>

      <form class="card space-y-4" @submit.prevent="entrar">
        <div>
          <label class="label">Email</label>
          <input v-model="email" type="email" class="input" placeholder="admin@lascasuarinas.gob.ar" autofocus />
        </div>
        <div>
          <label class="label">Contraseña</label>
          <input v-model="password" type="password" class="input" placeholder="••••••••" />
        </div>

        <p v-if="error" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{{ error }}</p>

        <button type="submit" class="btn-primary w-full" :disabled="cargando">
          {{ cargando ? "Ingresando…" : "Ingresar" }}
        </button>
      </form>

      <p class="text-center text-monte-100 text-xs mt-4">Municipalidad · acceso del personal</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { axios, setSesion } from "../utils/api.js";

const router = useRouter();
const email = ref("");
const password = ref("");
const error = ref("");
const cargando = ref(false);

async function entrar() {
  error.value = "";
  cargando.value = true;
  try {
    const { data } = await axios.post("/api/auth/login", { email: email.value, password: password.value });
    setSesion(data.token, data.usuario);
    router.push("/dashboard");
  } catch (e) {
    error.value = e?.response?.data?.message || "No se pudo iniciar sesión";
  } finally {
    cargando.value = false;
  }
}
</script>
