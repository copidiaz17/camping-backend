import express from "express";
import crypto from "crypto";
import { Op } from "sequelize";
import Reserva from "../models/Reserva.js";
import ReservaVehiculo from "../models/ReservaVehiculo.js";
import Cliente from "../models/Cliente.js";
import Zona from "../models/Zona.js";
import Quincho from "../models/Quincho.js";
import Asador from "../models/Asador.js";
import CodigoQR from "../models/CodigoQR.js";
import { authMiddleware } from "./auth.js";
import { hasRole } from "../middlewares/authorization.js";
import {
  ZONA_POR_TIPO, siguienteNumero, quinchoEstaLibre, asadorEstaLibre, quinchosLibres,
  asadoresLibres, aforoUsado, fechaEsPasada, calcularMontoReserva,
} from "../utils/reservas.js";

const router = express.Router();

const includeAll = [
  { model: Cliente, as: "cliente" },
  { model: Zona, as: "zona" },
  { model: Quincho, as: "quincho" },
  { model: Asador, as: "asador" },
  { model: ReservaVehiculo, as: "vehiculos" },
];

// GET /api/reservas?fecha=&estado=&tipo=
router.get("/", authMiddleware, async (req, res) => {
  const where = {};
  if (req.query.fecha) where.fecha = req.query.fecha;
  if (req.query.estado) where.estado = req.query.estado;
  if (req.query.tipo) where.tipo = req.query.tipo;
  const reservas = await Reserva.findAll({ where, include: includeAll, order: [["id", "DESC"]], limit: 200 });
  res.json(reservas);
});

// GET /api/reservas/:id
router.get("/:id", authMiddleware, async (req, res) => {
  const reserva = await Reserva.findByPk(req.params.id, { include: includeAll });
  if (!reserva) return res.status(404).json({ message: "Reserva no encontrada" });
  res.json(reserva);
});

// POST /api/reservas (admin/cajero)
// Body: { tipo, fecha, cantidad_personas?, cantidad_ninos?, cantidad_adultos?, quincho_id?, asador_id?,
//         vehiculos?[], cliente_id? | cliente:{...} }
router.post("/", authMiddleware, hasRole(["admin", "cajero"]), async (req, res) => {
  try {
    const {
      tipo, fecha, cantidad_personas = 1, cantidad_ninos = 0, cantidad_adultos = 0,
      quincho_id = null, asador_id = null, vehiculos = [], cliente_id, cliente,
    } = req.body;

    if (!tipo || !fecha) return res.status(400).json({ message: "Faltan tipo o fecha" });
    if (!ZONA_POR_TIPO[tipo]) return res.status(400).json({ message: "Tipo de reserva inválido" });
    if (fechaEsPasada(fecha)) return res.status(400).json({ message: "Esa fecha ya pasó. Elegí una fecha de hoy en adelante." });

    // ── Cliente: usar el existente o crear uno nuevo ──
    let clienteId = cliente_id;
    if (!clienteId) {
      if (!cliente || !cliente.nombre)
        return res.status(400).json({ message: "Falta el cliente (cliente_id o datos del cliente)" });
      const nuevo = await Cliente.create(cliente);
      clienteId = nuevo.id;
    }

    // ── Zona según el tipo ──
    const zona = await Zona.findOne({ where: { nombre: ZONA_POR_TIPO[tipo] } });
    if (!zona) return res.status(400).json({ message: `No existe la zona "${ZONA_POR_TIPO[tipo]}"` });

    let quinchoIdFinal = null;
    let asadorIdFinal = null;
    let quinchoSel = null;

    if (tipo === "quincho") {
      if (!quincho_id) return res.status(400).json({ message: "Falta el quincho" });
      const quincho = await Quincho.findByPk(quincho_id);
      if (!quincho || !quincho.activo) return res.status(400).json({ message: "Quincho inválido" });
      if (!(await quinchoEstaLibre(quincho.id, fecha)))
        return res.status(409).json({ message: `El ${quincho.nombre} ya está reservado para esa fecha` });
      quinchoSel = quincho;
      quinchoIdFinal = quincho.id;
    } else if (tipo === "asador") {
      if (!asador_id) return res.status(400).json({ message: "Falta el asador" });
      const asador = await Asador.findByPk(asador_id);
      if (!asador || !asador.activo) return res.status(400).json({ message: "Asador inválido" });
      if (!(await asadorEstaLibre(asador.id, fecha)))
        return res.status(409).json({ message: `El ${asador.nombre} ya está reservado para esa fecha` });
      asadorIdFinal = asador.id;
    } else if (tipo === "pileta") {
      if ((Number(cantidad_ninos) || 0) + (Number(cantidad_adultos) || 0) < 1)
        return res.status(400).json({ message: "Indicá al menos una persona (niños o adultos) para la pileta" });
      if (zona.aforo_max > 0) {
        const usado = await aforoUsado(zona.id, fecha);
        const personas = (Number(cantidad_ninos) || 0) + (Number(cantidad_adultos) || 0);
        if (usado + personas > zona.aforo_max)
          return res.status(409).json({ message: `No hay cupo en ${zona.nombre} para esa fecha (quedan ${Math.max(0, zona.aforo_max - usado)} lugares)` });
      }
    } else if (zona.aforo_max > 0) { // acampe
      const usado = await aforoUsado(zona.id, fecha);
      const personas = Number(cantidad_personas) || 1;
      if (usado + personas > zona.aforo_max)
        return res.status(409).json({ message: `No hay cupo en ${zona.nombre} para esa fecha (quedan ${Math.max(0, zona.aforo_max - usado)} lugares)` });
    }

    // ── Monto (única fuente de verdad) ──
    const calc = await calcularMontoReserva({
      tipo, fecha, cantidad_personas, cantidad_ninos, cantidad_adultos, quincho: quinchoSel, vehiculos,
    });

    const numero = await siguienteNumero();
    const reserva = await Reserva.create({
      numero, tipo, zona_id: zona.id, quincho_id: quinchoIdFinal, asador_id: asadorIdFinal, cliente_id: clienteId,
      fecha,
      cantidad_personas: tipo === "pileta" ? (Number(cantidad_ninos) || 0) + (Number(cantidad_adultos) || 0) : (Number(cantidad_personas) || 1),
      cantidad_ninos: Number(cantidad_ninos) || 0,
      cantidad_adultos: Number(cantidad_adultos) || 0,
      cupo: calc.cupo, monto: calc.monto, recargo: calc.recargo, monto_estacionamiento: calc.monto_estacionamiento,
      estado: "pendiente", estado_pago: "pendiente", creado_por_id: req.user.id,
    });

    for (const v of calc.vehiculosDetalle) {
      await ReservaVehiculo.create({ reserva_id: reserva.id, tipo: v.tipo, descripcion: v.descripcion, precio: v.precio });
    }

    const completa = await Reserva.findByPk(reserva.id, { include: includeAll });
    res.status(201).json(completa);
  } catch (err) {
    console.error("Error creando reserva:", err);
    res.status(500).json({ message: "Error al crear la reserva" });
  }
});

// POST /api/reservas/:id/confirmar (admin/cajero) — confirma, marca pagada y genera el QR
router.post("/:id/confirmar", authMiddleware, hasRole(["admin", "cajero"]), async (req, res) => {
  const reserva = await Reserva.findByPk(req.params.id);
  if (!reserva) return res.status(404).json({ message: "Reserva no encontrada" });
  if (reserva.estado === "cancelada") return res.status(400).json({ message: "La reserva está cancelada" });

  await reserva.update({ estado: "confirmada", estado_pago: "pagado" });

  // Genera el QR solo si la reserva todavía no tiene uno activo (idempotente).
  let qr = await CodigoQR.findOne({ where: { reserva_id: reserva.id, estado: "activo" } });
  if (!qr) {
    qr = await CodigoQR.create({
      reserva_id: reserva.id,
      token: crypto.randomBytes(16).toString("hex"), // token único e impredecible
      cupo_total: reserva.cupo,
      cupo_usado: 0,
      vencimiento_fecha: reserva.fecha, // válido el día de la reserva
      estado: "activo",
    });
  }

  res.json({ ok: true, message: "Reserva confirmada", reserva, qr });
});

// POST /api/reservas/:id/cancelar (admin/cajero)
router.post("/:id/cancelar", authMiddleware, hasRole(["admin", "cajero"]), async (req, res) => {
  const reserva = await Reserva.findByPk(req.params.id);
  if (!reserva) return res.status(404).json({ message: "Reserva no encontrada" });
  await reserva.update({ estado: "cancelada" });
  res.json({ ok: true, message: "Reserva cancelada", reserva });
});

export default router;
