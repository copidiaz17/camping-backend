<template>
  <div>
    <header class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Personal</h1>
        <p class="text-gray-500 text-sm">Usuarios del sistema y sus permisos</p>
      </div>
      <button class="btn-primary" @click="abrirNuevo">+ Nuevo usuario</button>
    </header>

    <div class="card overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-left text-gray-400 border-b">
          <tr><th class="py-2">Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th class="text-right">Acciones</th></tr>
        </thead>
        <tbody>
          <tr v-for="u in usuarios" :key="u.id" class="border-b last:border-0" :class="{ 'opacity-40': !u.activo }">
            <td class="py-2 font-medium">{{ u.nombre }}</td>
            <td class="text-gray-500">{{ u.email }}</td>
            <td><span class="text-xs font-semibold px-2 py-0.5 rounded-full" :class="rolClase(u.rol)">{{ ROLES[u.rol] || u.rol }}</span></td>
            <td>{{ u.activo ? "Activo" : "Inactivo" }}</td>
            <td class="text-right whitespace-nowrap">
              <button class="acc text-monte-600" @click="editar(u)">Editar</button>
              <button v-if="u.activo" class="acc text-red-500" @click="desactivar(u)">Desactivar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="modal" class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" @click.self="modal = false">
      <div class="bg-white rounded-xl w-full max-w-md p-6">
        <h2 class="text-lg font-bold mb-4">{{ editId ? "Editar usuario" : "Nuevo usuario" }}</h2>
        <div class="space-y-3">
          <div><label class="label">Nombre</label><input v-model="form.nombre" class="input" /></div>
          <div><label class="label">Email</label><input v-model="form.email" type="email" class="input" /></div>
          <div>
            <label class="label">Contraseña {{ editId ? "(dejar vacío para no cambiar)" : "" }}</label>
            <input v-model="form.password" type="password" class="input" :placeholder="editId ? '••••••••' : 'mínimo 6 caracteres'" />
          </div>
          <div>
            <label class="label">Rol</label>
            <select v-model="form.rol" class="input">
              <option v-for="(label, value) in ROLES" :key="value" :value="value">{{ label }}</option>
            </select>
            <p class="text-xs text-gray-400 mt-1">{{ DESC_ROL[form.rol] }}</p>
          </div>
          <div v-if="editId">
            <label class="flex items-center gap-2 text-sm">
              <input v-model="form.activo" type="checkbox" /> Activo
            </label>
          </div>
        </div>

        <p v-if="error" class="text-sm text-red-600 mt-3">{{ error }}</p>
        <div class="flex justify-end gap-2 mt-5">
          <button class="btn-ghost" @click="modal = false">Cancelar</button>
          <button class="btn-primary" :disabled="guardando" @click="guardar">{{ guardando ? "Guardando…" : "Guardar" }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { axios, auth } from "../utils/api.js";

const ROLES = {
  admin: "Administrador",
  cajero: "Cajero",
  guardia: "Guardia / Puerta",
  guardavidas: "Guardavidas",
  municipalidad: "Municipalidad",
};
const DESC_ROL = {
  admin: "Acceso total: configuración, usuarios y todo el sistema.",
  cajero: "Reservas, cobros y caja.",
  guardia: "Control de acceso, puerta (walk-in) y caja.",
  guardavidas: "Solo inicio (aforo de pileta).",
  municipalidad: "Solo lectura / reportes.",
};
function rolClase(rol) {
  return {
    admin: "bg-monte-100 text-monte-700",
    cajero: "bg-amber-100 text-amber-700",
    guardia: "bg-blue-100 text-blue-700",
    guardavidas: "bg-cyan-100 text-cyan-700",
    municipalidad: "bg-gray-100 text-gray-600",
  }[rol] || "bg-gray-100 text-gray-600";
}

const usuarios = ref([]);
const modal = ref(false);
const editId = ref(null);
const guardando = ref(false);
const error = ref("");
const form = reactive({ nombre: "", email: "", password: "", rol: "cajero", activo: true });

async function cargar() {
  const { data } = await axios.get("/api/usuarios", auth());
  usuarios.value = data;
}

function abrirNuevo() {
  editId.value = null;
  error.value = "";
  Object.assign(form, { nombre: "", email: "", password: "", rol: "cajero", activo: true });
  modal.value = true;
}
function editar(u) {
  editId.value = u.id;
  error.value = "";
  Object.assign(form, { nombre: u.nombre, email: u.email, password: "", rol: u.rol, activo: u.activo });
  modal.value = true;
}

async function guardar() {
  error.value = "";
  if (!form.nombre || !form.email) return (error.value = "Completá nombre y email");
  if (!editId.value && !form.password) return (error.value = "La contraseña es obligatoria");
  guardando.value = true;
  try {
    const body = { nombre: form.nombre, email: form.email, rol: form.rol };
    if (form.password) body.password = form.password;
    if (editId.value) {
      body.activo = form.activo;
      await axios.put(`/api/usuarios/${editId.value}`, body, auth());
    } else {
      await axios.post("/api/usuarios", body, auth());
    }
    modal.value = false;
    await cargar();
  } catch (e) {
    error.value = e?.response?.data?.message || "No se pudo guardar";
  } finally {
    guardando.value = false;
  }
}

async function desactivar(u) {
  if (!confirm(`¿Desactivar a ${u.nombre}? No va a poder iniciar sesión.`)) return;
  try {
    await axios.delete(`/api/usuarios/${u.id}`, auth());
    await cargar();
  } catch (e) {
    alert(e?.response?.data?.message || "No se pudo desactivar");
  }
}

onMounted(cargar);
</script>

<style scoped>
.acc {
  @apply text-xs font-semibold px-2 py-1 rounded hover:bg-gray-100;
}
</style>
