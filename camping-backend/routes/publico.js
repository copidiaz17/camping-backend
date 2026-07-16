import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import Cliente from "../models/Cliente.js";
import Reserva from "../models/Reserva.js";
import ReservaVehiculo from "../models/ReservaVehiculo.js";
import Zona from "../models/Zona.js";
import Quincho from "../models/Quincho.js";
import Asador from "../models/Asador.js";
import Tarifa from "../models/Tarifa.js";
import CodigoQR from "../models/CodigoQR.js";
import {
  ZONA_POR_TIPO, fechaEsPasada, hoyLocal, quinchosLibres, asadoresLibres,
  generarQR, normalizarItems, crearReservaCompleta,
} from "../utils/reservas.js";
import { enviarQRReserva } from "../utils/mailer.js";

const router = express.Router();

// ── Auth de visitante (token propio, distinto al del personal) ──
function firmaCliente(cliente) {
  return jwt.sign({ clienteId: cliente.id, tipo: "cliente", nombre: cliente.nombre }, process.env.JWT_SECRET, { expiresIn: "30d" });
}
function clienteAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Necesitás iniciar sesión" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.tipo !== "cliente") throw new Error("tipo inválido");
    req.clienteId = payload.clienteId;
    next();
  } catch {
    return res.status(401).json({ message: "Sesión inválida o vencida" });
  }
}

function datosPublicos(c) {
  return { id: c.id, nombre: c.nombre, apellido: c.apellido, email: c.email, telefono: c.telefono };
}

// ── POST /api/publico/registro ──
router.post("/registro", async (req, res) => {
  try {
    const { nombre, apellido, email, telefono, password } = req.body;
    if (!nombre || !password || !(email || telefono))
      return res.status(400).json({ message: "Faltan datos (nombre, contraseña y email o teléfono)" });
    if (String(password).length < 6)
      return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });

    // ¿Ya existe una cuenta con ese email o teléfono?
    const condiciones = [];
    if (email) condiciones.push({ email });
    if (telefono) condiciones.push({ telefono });
    const existente = await Cliente.findOne({ where: { [Op.or]: condiciones, password: { [Op.ne]: null } } });
    if (existente) return res.status(409).json({ message: "Ya hay una cuenta con ese email o teléfono. Iniciá sesión." });

    const hash = await bcrypt.hash(password, 10);
    // Si ya existe el cliente (cargado por el personal) sin cuenta, le agregamos la cuenta; si no, lo creamos.
    let cliente = await Cliente.findOne({ where: { [Op.or]: condiciones } });
    if (cliente) await cliente.update({ nombre, apellido, email, telefono, password: hash });
    else cliente = await Cliente.create({ nombre, apellido, email, telefono, password: hash });

    res.status(201).json({ token: firmaCliente(cliente), cliente: datosPublicos(cliente) });
  } catch (err) {
    console.error("Error en registro público:", err);
    res.status(500).json({ message: "Error al crear la cuenta" });
  }
});

// ── POST /api/publico/login ── { identificador (email o teléfono), password }
router.post("/login", async (req, res) => {
  try {
    const { identificador, password } = req.body;
    if (!identificador || !password) return res.status(400).json({ message: "Faltan datos" });
    const cliente = await Cliente.findOne({
      where: { [Op.or]: [{ email: identificador }, { telefono: identificador }], password: { [Op.ne]: null } },
    });
    if (!cliente) return res.status(400).json({ message: "Cuenta o contraseña incorrectos" });
    const ok = await bcrypt.compare(password, cliente.password);
    if (!ok) return res.status(400).json({ message: "Cuenta o contraseña incorrectos" });
    res.json({ token: firmaCliente(cliente), cliente: datosPublicos(cliente) });
  } catch (err) {
    console.error("Error en login público:", err);
    res.status(500).json({ message: "Error al iniciar sesión" });
  }
});

// ── GET /api/publico/tarifas ── (precios para mostrar en la web)
router.get("/tarifas", async (req, res) => {
  const tarifas = await Tarifa.findAll({ where: { activo: true }, order: [["precio", "ASC"]] });
  res.json(tarifas);
});

// ── GET /api/publico/disponibilidad?fecha= ── (quinchos y asadores libres para esa fecha)
router.get("/disponibilidad", async (req, res) => {
  const fecha = req.query.fecha;
  if (!fecha) return res.status(400).json({ message: "Falta la fecha" });
  res.json({ fecha, quinchos: await quinchosLibres(fecha), asadores: await asadoresLibres(fecha) });
});

// ── POST /api/publico/reservas ── (visitante logueado)
// Crea la reserva PENDIENTE DE PAGO con uno o varios conceptos. El QR se genera al pagar.
// Body: { fecha, items:[{tipo, quincho_id?, asador_id?, cantidad_personas?, cantidad_ninos?, cantidad_adultos?}], vehiculos?[] }
// (También acepta el formato viejo de 1 concepto: { tipo, fecha, cantidad_personas, ... })
router.post("/reservas", clienteAuth, async (req, res) => {
  try {
    const { fecha, vehiculos = [] } = req.body;
    if (!fecha) return res.status(400).json({ message: "Falta la fecha" });
    if (fechaEsPasada(fecha)) return res.status(400).json({ message: "Esa fecha ya pasó. Elegí una fecha de hoy en adelante." });

    const items = normalizarItems(req.body);
    const { reserva, prep } = await crearReservaCompleta({
      items, vehiculos, fecha, cliente_id: req.clienteId, estado: "pendiente", estado_pago: "pendiente",
    });

    res.status(201).json({
      reserva: { id: reserva.id, numero: reserva.numero, tipo: reserva.tipo, fecha: reserva.fecha, cupo: reserva.cupo, monto: reserva.monto },
      desglose: {
        items: prep.itemsData.map((i) => ({ tipo: i.tipo, zona: i._zona.nombre, color: i._zona.color, base: i.base_monto, cupo: i.cupo_total })),
        base_estacionamiento: prep.baseEstac,
        estacionamiento: prep.montoEstac,
        vehiculos: prep.vehiculosDetalle,
        recargo: prep.recargoTotal,
        finde: prep.finde,
        total: prep.montoTotal,
      },
      pago_pendiente: true,
    });
  } catch (err) {
    if (err && err.status) return res.status(err.status).json({ message: err.message });
    console.error("Error creando reserva pública:", err);
    res.status(500).json({ message: "Error al crear la reserva" });
  }
});

// ── POST /api/publico/reservas/:id/pagar ── (visitante logueado)
// SIMULA el pago aprobado (placeholder de MercadoPago) y RECIÉN AHÍ genera el QR.
router.post("/reservas/:id/pagar", clienteAuth, async (req, res) => {
  try {
    const reserva = await Reserva.findOne({ where: { id: req.params.id, cliente_id: req.clienteId } });
    if (!reserva) return res.status(404).json({ message: "Reserva no encontrada" });
    if (reserva.estado === "cancelada") return res.status(400).json({ message: "La reserva está cancelada" });

    // Idempotente: si ya estaba pagada, devolvemos su QR.
    if (reserva.estado_pago === "pagado") {
      const existente = await CodigoQR.findOne({ where: { reserva_id: reserva.id, estado: { [Op.ne]: "anulado" } } });
      return res.json({ ok: true, yaPagado: true, reserva, qr: existente ? { token: existente.token, cupo_total: existente.cupo_total } : null });
    }

    // 👉 Acá iría la confirmación real de MercadoPago. Por ahora se simula aprobado.
    await reserva.update({ estado_pago: "pagado", estado: "confirmada" });
    const qr = await generarQR(reserva);

    // Enviar el QR por email (fire-and-forget: no bloquea ni rompe la respuesta del pago)
    Cliente.findByPk(req.clienteId)
      .then(async (cliente) => {
        const zona = await Zona.findByPk(reserva.zona_id);
        return enviarQRReserva({ email: cliente?.email, nombre: cliente?.nombre, reserva, zona, qrToken: qr.token });
      })
      .catch((e) => console.error("[mail] no se pudo enviar el QR:", e.message));

    res.json({ ok: true, reserva, qr: { token: qr.token, cupo_total: qr.cupo_total } });
  } catch (err) {
    console.error("Error en pago público:", err);
    res.status(500).json({ message: "Error al procesar el pago" });
  }
});

// ── GET /api/publico/mis-reservas ── (visitante logueado)
// Solo muestra reservas de hoy en adelante (no las de fechas pasadas / QR vencidos).
router.get("/mis-reservas", clienteAuth, async (req, res) => {
  const reservas = await Reserva.findAll({
    where: { cliente_id: req.clienteId, fecha: { [Op.gte]: hoyLocal() } },
    include: [
      { model: Zona, as: "zona" },
      { model: Quincho, as: "quincho" },
      { model: CodigoQR, as: "codigosQR" },
    ],
    order: [["id", "DESC"]],
    limit: 50,
  });
  const salida = reservas.map((r) => {
    const qr = r.codigosQR && r.codigosQR[0] ? r.codigosQR[0] : null;
    return {
      id: r.id,
      numero: r.numero,
      tipo: r.tipo,
      fecha: r.fecha,
      cantidad_personas: r.cantidad_personas,
      estado: r.estado,
      estado_pago: r.estado_pago,
      zona: r.zona ? { nombre: r.zona.nombre, color: r.zona.color } : null,
      quincho: r.quincho ? r.quincho.nombre : null,
      cupo: qr ? { total: qr.cupo_total, usado: qr.cupo_usado } : null,
      qr: qr ? qr.token : null,
    };
  });
  res.json(salida);
});

// ── GET /api/publico/reservas/:id/estado ── (visitante logueado)
// Liviano: el celular del visitante lo consulta para saber si el guardia ya escaneó su QR.
router.get("/reservas/:id/estado", clienteAuth, async (req, res) => {
  const reserva = await Reserva.findOne({
    where: { id: req.params.id, cliente_id: req.clienteId },
    include: [{ model: CodigoQR, as: "codigosQR" }],
  });
  if (!reserva) return res.status(404).json({ message: "Reserva no encontrada" });
  const qr = reserva.codigosQR && reserva.codigosQR[0] ? reserva.codigosQR[0] : null;
  const total = qr ? qr.cupo_total : 0;
  const usado = qr ? qr.cupo_usado : 0;
  res.json({ cupo: { total, usado, restante: total - usado } });
});

export default router;
