import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import Cliente from "../models/Cliente.js";
import Reserva from "../models/Reserva.js";
import Zona from "../models/Zona.js";
import Quincho from "../models/Quincho.js";
import Tarifa from "../models/Tarifa.js";
import CodigoQR from "../models/CodigoQR.js";
import { ZONA_POR_TIPO, fechaEsPasada, siguienteNumero, quinchosLibres, quinchoEstaLibre, aforoUsado, generarQR } from "../utils/reservas.js";

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

// ── GET /api/publico/disponibilidad?fecha= ── (quinchos libres para esa fecha)
router.get("/disponibilidad", async (req, res) => {
  const fecha = req.query.fecha;
  if (!fecha) return res.status(400).json({ message: "Falta la fecha" });
  res.json({ fecha, quinchos: await quinchosLibres(fecha) });
});

// ── POST /api/publico/reservas ── (visitante logueado)
// Crea la reserva PENDIENTE DE PAGO. El QR se genera recién al pagar (POST /reservas/:id/pagar).
router.post("/reservas", clienteAuth, async (req, res) => {
  try {
    const { tipo, fecha, cantidad_personas = 1, quincho_id = null, condicion = "general" } = req.body;
    if (!tipo || !fecha) return res.status(400).json({ message: "Faltan tipo o fecha" });
    if (!ZONA_POR_TIPO[tipo]) return res.status(400).json({ message: "Tipo de reserva inválido" });
    if (fechaEsPasada(fecha)) return res.status(400).json({ message: "Esa fecha ya pasó. Elegí una fecha de hoy en adelante." });

    const zona = await Zona.findOne({ where: { nombre: ZONA_POR_TIPO[tipo] } });
    if (!zona) return res.status(400).json({ message: `No existe la zona "${ZONA_POR_TIPO[tipo]}"` });

    // Disponibilidad de quincho (sin doble-reserva) / aforo de la zona
    let cupo = Number(cantidad_personas) || 1;
    let quinchoIdFinal = null;
    if (tipo === "quincho") {
      let quincho = quincho_id ? await Quincho.findByPk(quincho_id) : null;
      if (quincho && !(await quinchoEstaLibre(quincho.id, fecha)))
        return res.status(409).json({ message: `El ${quincho.nombre} ya está reservado para esa fecha` });
      if (!quincho) {
        const libres = (await quinchosLibres(fecha)).filter((q) => q.libre);
        if (!libres.length) return res.status(409).json({ message: "No hay quinchos disponibles para esa fecha" });
        quincho = await Quincho.findByPk(libres[0].id);
      }
      cupo = quincho.capacidad;
      quinchoIdFinal = quincho.id;
    } else if (zona.aforo_max > 0) {
      const usado = await aforoUsado(zona.id, fecha);
      const personas = Number(cantidad_personas) || 1;
      if (usado + personas > zona.aforo_max)
        return res.status(409).json({ message: `No hay cupo en ${zona.nombre} para esa fecha (quedan ${Math.max(0, zona.aforo_max - usado)} lugares)` });
    }

    // Monto desde la tarifa (con la condición elegida; si no existe, cae a general)
    const tarifa =
      (await Tarifa.findOne({ where: { tipo, condicion, activo: true } })) ||
      (await Tarifa.findOne({ where: { tipo, condicion: "general", activo: true } }));
    const precio = tarifa ? Number(tarifa.precio) : 0;
    const monto = tipo === "quincho" ? precio : precio * (Number(cantidad_personas) || 1);

    const numero = await siguienteNumero();
    const reserva = await Reserva.create({
      numero, tipo, zona_id: zona.id, quincho_id: quinchoIdFinal, cliente_id: req.clienteId,
      fecha, cantidad_personas: Number(cantidad_personas) || 1, cupo, monto,
      estado: "pendiente", estado_pago: "pendiente", // ⚠️ el QR se genera al pagar
    });

    res.status(201).json({
      reserva: { id: reserva.id, numero: reserva.numero, tipo: reserva.tipo, fecha: reserva.fecha, cantidad_personas: reserva.cantidad_personas, cupo: reserva.cupo, monto: reserva.monto },
      zona: { nombre: zona.nombre, color: zona.color },
      pago_pendiente: true,
    });
  } catch (err) {
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

    res.json({ ok: true, reserva, qr: { token: qr.token, cupo_total: qr.cupo_total } });
  } catch (err) {
    console.error("Error en pago público:", err);
    res.status(500).json({ message: "Error al procesar el pago" });
  }
});

// ── GET /api/publico/mis-reservas ── (visitante logueado)
router.get("/mis-reservas", clienteAuth, async (req, res) => {
  const reservas = await Reserva.findAll({
    where: { cliente_id: req.clienteId },
    include: [
      { model: Zona, as: "zona" },
      { model: CodigoQR, as: "codigosQR" },
    ],
    order: [["id", "DESC"]],
    limit: 50,
  });
  const salida = reservas.map((r) => ({
    numero: r.numero,
    tipo: r.tipo,
    fecha: r.fecha,
    cantidad_personas: r.cantidad_personas,
    estado: r.estado,
    estado_pago: r.estado_pago,
    zona: r.zona ? { nombre: r.zona.nombre, color: r.zona.color } : null,
    qr: r.codigosQR && r.codigosQR[0] ? r.codigosQR[0].token : null,
  }));
  res.json(salida);
});

export default router;
