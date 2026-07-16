// Datos y función de carga de la Ordenanza N° 6582/25 (Art. 110).
// Se usa desde el script seed-6582.js y desde el arranque del server (guardado).
import Tarifa from "../models/Tarifa.js";
import Quincho from "../models/Quincho.js";
import Asador from "../models/Asador.js";
import Zona from "../models/Zona.js";
import Feriado from "../models/Feriado.js";

export const TARIFAS = [
  { tipo: "quincho_grande",  categoria: "reserva",  descripcion: "Quincho grande (50 personas)", precio: 52000 },
  { tipo: "quincho_mediano", categoria: "reserva",  descripcion: "Quincho mediano (30 personas)", precio: 36400 },
  { tipo: "acampe",          categoria: "reserva",  descripcion: "Acampe (carpa)",                precio: 5000 },
  { tipo: "asador",          categoria: "reserva",  descripcion: "Asador",                        precio: 5000 },
  { tipo: "pileta_nino",     categoria: "reserva",  descripcion: "Pileta — Niños hasta 10 años",  precio: 4000 },
  { tipo: "pileta_adulto",   categoria: "reserva",  descripcion: "Pileta — Adultos",              precio: 6000 },
  { tipo: "veh_camion",       categoria: "vehiculo", descripcion: "Camión / Colectivo",   precio: 21000 },
  { tipo: "veh_motorhome",    categoria: "vehiculo", descripcion: "Motor home",           precio: 18000 },
  { tipo: "veh_casa_rodante", categoria: "vehiculo", descripcion: "Casa rodante",         precio: 11000 },
  { tipo: "veh_automovil",    categoria: "vehiculo", descripcion: "Automóvil",            precio: 2500 },
  { tipo: "veh_motocicleta",  categoria: "vehiculo", descripcion: "Motocicleta",          precio: 1500 },
  { tipo: "veh_moto_agua",    categoria: "vehiculo", descripcion: "Motos de agua / Lanchas", precio: 600 },
  { tipo: "recargo_finde", categoria: "recargo", descripcion: "Recargo sábados, domingos y feriados", precio: 2000 },
];

export const ZONAS = [
  { nombre: "Quincho", color: "#e23b3b" },
  { nombre: "Acampe",  color: "#2b6cb0" },
  { nombre: "Asador",  color: "#dd6b20" },
  { nombre: "Pileta",  color: "#38a169" },
];

// Feriados nacionales 2026 (Argentina). REVISAR/COMPLETAR en el panel:
// los trasladables (17/08, 12/10, 23/11) y feriados turísticos pueden variar.
export const FERIADOS_2026 = [
  ["2026-01-01", "Año Nuevo"],
  ["2026-02-16", "Carnaval"],
  ["2026-02-17", "Carnaval"],
  ["2026-03-24", "Día de la Memoria"],
  ["2026-04-02", "Malvinas"],
  ["2026-04-03", "Viernes Santo"],
  ["2026-05-01", "Día del Trabajador"],
  ["2026-05-25", "Revolución de Mayo"],
  ["2026-06-20", "Día de la Bandera"],
  ["2026-07-09", "Día de la Independencia"],
  ["2026-08-17", "Paso a la Inmortalidad del Gral. San Martín"],
  ["2026-10-12", "Día del Respeto a la Diversidad Cultural"],
  ["2026-11-23", "Día de la Soberanía Nacional"],
  ["2026-12-08", "Inmaculada Concepción de María"],
  ["2026-12-25", "Navidad"],
];

// Idempotente: se puede correr varias veces sin duplicar.
export async function seed6582() {
  // Tarifas (upsert por tipo/clave)
  for (const t of TARIFAS) {
    const existe = await Tarifa.findOne({ where: { tipo: t.tipo } });
    if (existe) await existe.update({ ...t, activo: true });
    else await Tarifa.create({ ...t, condicion: "general", temporada: "todo_el_anio", activo: true });
  }

  // Zonas (no pisa aforo si ya existe)
  for (const z of ZONAS) {
    await Zona.findOrCreate({ where: { nombre: z.nombre }, defaults: { ...z, aforo_max: 0, activo: true } });
  }

  // Quinchos: 5 grandes + 5 medianos (desactiva los viejos que no coincidan)
  await Quincho.update({ activo: false }, { where: {} });
  for (let i = 1; i <= 5; i++) {
    const [q] = await Quincho.findOrCreate({ where: { nombre: `Quincho Grande ${i}` }, defaults: {} });
    await q.update({ tamano: "grande", capacidad: 50, activo: true });
  }
  for (let i = 1; i <= 5; i++) {
    const [q] = await Quincho.findOrCreate({ where: { nombre: `Quincho Mediano ${i}` }, defaults: {} });
    await q.update({ tamano: "mediano", capacidad: 30, activo: true });
  }

  // Asadores: 16
  for (let i = 1; i <= 16; i++) {
    const [a] = await Asador.findOrCreate({ where: { nombre: `Asador ${i}` }, defaults: {} });
    await a.update({ activo: true });
  }

  // Feriados 2026
  for (const [fecha, descripcion] of FERIADOS_2026) {
    await Feriado.findOrCreate({ where: { fecha }, defaults: { descripcion } });
  }
}
