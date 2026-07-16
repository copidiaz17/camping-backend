import crypto from "crypto";
import { Op } from "sequelize";
import Reserva from "../models/Reserva.js";
import Quincho from "../models/Quincho.js";
import Asador from "../models/Asador.js";
import Tarifa from "../models/Tarifa.js";
import Feriado from "../models/Feriado.js";
import CodigoQR from "../models/CodigoQR.js";

// Mapeo tipo de reserva → nombre de zona (define el color de pulsera)
export const ZONA_POR_TIPO = { quincho: "Quincho", acampe: "Acampe", asador: "Asador", pileta: "Pileta" };

// Fecha local (Argentina) YYYY-MM-DD
export function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function fechaEsPasada(fecha) {
  return String(fecha) < hoyLocal();
}

export async function siguienteNumero() {
  const year = new Date().getFullYear();
  const count = await Reserva.count({ where: { numero: { [Op.like]: `RES-${year}-%` } } });
  return `RES-${year}-${String(count + 1).padStart(4, "0")}`;
}

// ── Precios (catálogo de tarifas activas) ──
// Devuelve { clave: { precio, descripcion } }
export async function cargarTarifas() {
  const tarifas = await Tarifa.findAll({ where: { activo: true } });
  const map = {};
  for (const t of tarifas) map[t.tipo] = { precio: Number(t.precio), descripcion: t.descripcion };
  return map;
}

// ── ¿La fecha (YYYY-MM-DD) es sábado, domingo o feriado cargado? ──
export async function esFinDeOFeriado(fecha) {
  const [y, m, d] = String(fecha).split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=domingo, 6=sábado (determinista, sin zona horaria)
  if (dow === 0 || dow === 6) return true;
  const feriado = await Feriado.findOne({ where: { fecha } });
  return !!feriado;
}

// ── Cálculo del monto de una reserva (única fuente de verdad) ──
// tipo: quincho | acampe | asador | pileta
// vehiculos: array de claves de tarifa, ej: ["veh_automovil", "veh_motocicleta"]
export async function calcularMontoReserva({
  tipo, fecha, cantidad_personas = 1, cantidad_ninos = 0, cantidad_adultos = 0, quincho = null, vehiculos = [],
}) {
  const T = await cargarTarifas();
  const precio = (clave) => (T[clave] ? T[clave].precio : 0);
  const finde = await esFinDeOFeriado(fecha);
  const rec = finde ? precio("recargo_finde") : 0;

  let montoIngreso = 0;
  let recargoTotal = 0;
  let cupo = Number(cantidad_personas) || 1;

  if (tipo === "quincho") {
    const clave = quincho?.tamano === "mediano" ? "quincho_mediano" : "quincho_grande";
    montoIngreso = precio(clave) + rec;
    recargoTotal += rec;
    cupo = quincho?.capacidad || cupo;
  } else if (tipo === "acampe") {
    montoIngreso = precio("acampe") + rec; // por carpa (fijo por reserva)
    recargoTotal += rec;
    cupo = Number(cantidad_personas) || 1;
  } else if (tipo === "asador") {
    montoIngreso = precio("asador") + rec;
    recargoTotal += rec;
    cupo = Number(cantidad_personas) || 1;
  } else if (tipo === "pileta") {
    const ninos = Number(cantidad_ninos) || 0;
    const adultos = Number(cantidad_adultos) || 0;
    montoIngreso = ninos * (precio("pileta_nino") + rec) + adultos * (precio("pileta_adulto") + rec);
    recargoTotal += (ninos + adultos) * rec;
    cupo = ninos + adultos || 1;
  }

  // Estacionamiento: cada vehículo suma su precio + recargo (el recargo aplica a todo)
  const vehiculosDetalle = [];
  let montoEstacionamiento = 0;
  for (const clave of vehiculos || []) {
    if (!T[clave]) continue;
    const p = T[clave].precio + rec;
    montoEstacionamiento += p;
    recargoTotal += rec;
    vehiculosDetalle.push({ tipo: clave, descripcion: T[clave].descripcion, precio: p });
  }

  return {
    monto: montoIngreso + montoEstacionamiento,
    monto_ingreso: montoIngreso,
    monto_estacionamiento: montoEstacionamiento,
    recargo: recargoTotal,
    cupo,
    finde,
    vehiculosDetalle,
  };
}

// ── Quinchos: disponibilidad ──
export async function quinchosLibres(fecha) {
  const quinchos = await Quincho.findAll({ where: { activo: true }, order: [["id", "ASC"]] });
  const ocupadas = await Reserva.findAll({
    where: { fecha, tipo: "quincho", estado: { [Op.ne]: "cancelada" }, quincho_id: { [Op.ne]: null } },
    attributes: ["quincho_id"],
  });
  const ocupados = new Set(ocupadas.map((r) => r.quincho_id));
  return quinchos.map((q) => ({ id: q.id, nombre: q.nombre, tamano: q.tamano, capacidad: q.capacidad, libre: !ocupados.has(q.id) }));
}

export async function quinchoEstaLibre(quinchoId, fecha) {
  const n = await Reserva.count({ where: { fecha, tipo: "quincho", quincho_id: quinchoId, estado: { [Op.ne]: "cancelada" } } });
  return n === 0;
}

// ── Asadores: disponibilidad (mismo criterio que quinchos: uno por día) ──
export async function asadoresLibres(fecha) {
  const asadores = await Asador.findAll({ where: { activo: true }, order: [["id", "ASC"]] });
  const ocupadas = await Reserva.findAll({
    where: { fecha, tipo: "asador", estado: { [Op.ne]: "cancelada" }, asador_id: { [Op.ne]: null } },
    attributes: ["asador_id"],
  });
  const ocupados = new Set(ocupadas.map((r) => r.asador_id));
  return asadores.map((a) => ({ id: a.id, nombre: a.nombre, libre: !ocupados.has(a.id) }));
}

export async function asadorEstaLibre(asadorId, fecha) {
  const n = await Reserva.count({ where: { fecha, tipo: "asador", asador_id: asadorId, estado: { [Op.ne]: "cancelada" } } });
  return n === 0;
}

// Personas ya reservadas en una zona para una fecha (los quinchos no cuentan al aforo de la zona)
export async function aforoUsado(zonaId, fecha) {
  const rs = await Reserva.findAll({
    where: { zona_id: zonaId, fecha, estado: { [Op.ne]: "cancelada" } },
    attributes: ["cantidad_personas", "tipo"],
  });
  return rs.reduce((a, r) => a + (r.tipo === "quincho" ? 0 : r.cantidad_personas || 0), 0);
}

// Genera el código QR de una reserva (se hace SOLO cuando está pagada)
export async function generarQR(reserva) {
  return CodigoQR.create({
    reserva_id: reserva.id,
    token: crypto.randomBytes(16).toString("hex"),
    cupo_total: reserva.cupo,
    cupo_usado: 0,
    vencimiento_fecha: reserva.fecha,
    estado: "activo",
  });
}
