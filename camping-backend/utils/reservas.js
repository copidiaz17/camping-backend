import crypto from "crypto";
import { Op } from "sequelize";
import Reserva from "../models/Reserva.js";
import Quincho from "../models/Quincho.js";
import CodigoQR from "../models/CodigoQR.js";

// Mapeo tipo de reserva → nombre de zona (define el color de pulsera)
export const ZONA_POR_TIPO = { quincho: "Quincho", pase_pileta: "Pileta", pase_dia: "Pileta", acampe: "Acampe" };

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

// Quinchos con su disponibilidad para una fecha (libre = sin reserva activa ese día)
export async function quinchosLibres(fecha) {
  const quinchos = await Quincho.findAll({ where: { activo: true }, order: [["id", "ASC"]] });
  const ocupadas = await Reserva.findAll({
    where: { fecha, tipo: "quincho", estado: { [Op.ne]: "cancelada" }, quincho_id: { [Op.ne]: null } },
    attributes: ["quincho_id"],
  });
  const ocupados = new Set(ocupadas.map((r) => r.quincho_id));
  return quinchos.map((q) => ({ id: q.id, nombre: q.nombre, capacidad: q.capacidad, libre: !ocupados.has(q.id) }));
}

export async function quinchoEstaLibre(quinchoId, fecha) {
  const n = await Reserva.count({ where: { fecha, tipo: "quincho", quincho_id: quinchoId, estado: { [Op.ne]: "cancelada" } } });
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
