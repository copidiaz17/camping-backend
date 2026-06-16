import bcrypt from "bcryptjs";
import { sequelize } from "./database.js";
import Usuario from "./models/Usuario.js";
import Zona from "./models/Zona.js";
import Quincho from "./models/Quincho.js";
import Tarifa from "./models/Tarifa.js";

await sequelize.authenticate();
await sequelize.sync();

// ── Usuario admin ──
const hash = await bcrypt.hash("admin123", 10);
const [, adminCreado] = await Usuario.findOrCreate({
  where: { email: "admin@lascasuarinas.gob.ar" },
  defaults: { nombre: "Administrador", email: "admin@lascasuarinas.gob.ar", password: hash, rol: "admin" },
});
console.log(adminCreado ? "✅ Admin creado (admin@lascasuarinas.gob.ar / admin123)" : "ℹ️  Admin ya existía");

// ── Usuario guardia/puerta (escanea, cobra y registra walk-ins) ──
const hashG = await bcrypt.hash("guardia123", 10);
const [, guardiaCreado] = await Usuario.findOrCreate({
  where: { email: "guardia@lascasuarinas.gob.ar" },
  defaults: { nombre: "Guardia Puerta", email: "guardia@lascasuarinas.gob.ar", password: hashG, rol: "guardia" },
});
console.log(guardiaCreado ? "✅ Guardia creado (guardia@lascasuarinas.gob.ar / guardia123)" : "ℹ️  Guardia ya existía");

// ── Cajero y Municipalidad (ejemplos de cada rol) ──
for (const u of [
  { nombre: "Cajero", email: "cajero@lascasuarinas.gob.ar", pass: "cajero123", rol: "cajero" },
  { nombre: "Municipalidad", email: "muni@lascasuarinas.gob.ar", pass: "muni123", rol: "municipalidad" },
]) {
  const h = await bcrypt.hash(u.pass, 10);
  const [, creado] = await Usuario.findOrCreate({ where: { email: u.email }, defaults: { nombre: u.nombre, email: u.email, password: h, rol: u.rol } });
  console.log(creado ? `✅ ${u.rol} creado (${u.email} / ${u.pass})` : `ℹ️  ${u.rol} ya existía`);
}

// ── Zonas (con color de pulsera) ──
const zonas = [
  { nombre: "Quincho", color: "#e23b3b", aforo_max: 0 },   // rojo
  { nombre: "Pileta", color: "#2e7d4f", aforo_max: 80 },   // verde
  { nombre: "Acampe", color: "#2471a3", aforo_max: 0 },    // azul
];
for (const z of zonas) await Zona.findOrCreate({ where: { nombre: z.nombre }, defaults: z });
console.log("✅ Zonas: Quincho (rojo), Pileta (verde), Acampe (azul)");

// ── Quinchos (8, capacidad 50) ──
for (let i = 1; i <= 8; i++) {
  await Quincho.findOrCreate({
    where: { nombre: `Quincho ${i}` },
    defaults: { nombre: `Quincho ${i}`, capacidad: 50, descripcion: "Parrilla, mesas y sombra" },
  });
}
console.log("✅ 8 quinchos cargados (capacidad 50)");

// ── Tarifas de EJEMPLO (José ajusta los precios reales) ──
const tarifas = [
  { tipo: "pase_dia", descripcion: "Pase de día", precio: 3500, condicion: "general", temporada: "todo_el_anio" },
  { tipo: "pase_pileta", descripcion: "Pase de día + Pileta", precio: 5500, condicion: "general", temporada: "todo_el_anio" },
  { tipo: "quincho", descripcion: "Quincho (día)", precio: 45000, condicion: "general", temporada: "todo_el_anio" },
  { tipo: "acampe", descripcion: "Acampe (por noche)", precio: 4000, condicion: "general", temporada: "todo_el_anio" },
];
for (const t of tarifas) {
  await Tarifa.findOrCreate({ where: { tipo: t.tipo, condicion: t.condicion, temporada: t.temporada }, defaults: t });
}
console.log("✅ Tarifas de ejemplo cargadas (⚠️ precios de muestra — reemplazar por los reales)");

console.log("\n🌲 Seed completo.");
process.exit(0);
