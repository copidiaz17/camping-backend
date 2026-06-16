import axios from "axios";

const TOKEN_KEY = "camping_token";
const USER_KEY = "camping_usuario";

export function setSesion(token, usuario) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(usuario));
}
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function getUsuario() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null;
  } catch {
    return null;
  }
}
export function cerrarSesion() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Header de autorización para las peticiones protegidas
export function auth() {
  return { headers: { Authorization: `Bearer ${getToken()}` } };
}

// Formateo de plata en pesos argentinos
export function pesos(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

export { axios };
