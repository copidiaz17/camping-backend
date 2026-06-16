import { createApp } from "vue";
import App from "./App.vue";
import router from "./router/index.js";
import "./style.css";
import axios from "axios";

// En producción VITE_API_URL apunta al backend (Render). En dev, el proxy de Vite maneja /api.
if (import.meta.env.VITE_API_URL) {
  axios.defaults.baseURL = import.meta.env.VITE_API_URL;
}

createApp(App).use(router).mount("#app");
