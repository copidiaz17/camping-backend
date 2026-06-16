import express from "express";
import crypto from "crypto";
import { Op } from "sequelize";
import Reserva from "../models/Reserva.js";
import Cliente from "../models/Cliente.js";
import Zona from "../models/Zona.js";
import Quincho from "../models/Quincho.js";
import Tarifa from "../models/Tarifa.js";
import CodigoQR from "../models/CodigoQR.js";
import { authMiddleware } from "./auth.js";
import { hasRole } from "../middlewares/authorization.js";
import { quinchoEstaLibre, aforoUsado, fechaEsPasada } from "../utils/reservas.js";

const router = express.Router();

// Mapeo tipo de reserva → nombre de zona (la zona define el color de pulsera).
// pase_dia se trata como acceso general; ajustable según las reglas reales del camping.
const ZONA_POR_TIPO = {
  quincho: "Quincho",
  pase_pileta: "Pileta",
  pase_dia: "Pileta",
  acampe: "Acampe",
};

async function siguienteNumero() {
  const year = new Date().getFullYear();
  const count = await Reserva.count({ where: { numero: { [Op.like]: `RES-${year}-%` } } });
  return `RES-${year}-${String(count + 1).padStart(4, "0")}`;
}

const includeAll = [
  { model: Cliente, as: "cliente" },
  { model: Zona, as: "zona" },
  { model: Quincho, as: "quincho" },
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
// Body: { tipo, fecha, cantidad_personas, quincho_id?, cliente_id? | cliente:{...}, condicion?, monto? }
router.post("/", authMiddleware, hasRole(["admin", "cajero"]), async (req, res) => {
  try {
    const {
      tipo, fecha, cantidad_personas = 1, quincho_id = null,
      cliente_id, cliente, condicion = "general", monto: montoBody,
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

    // ── Cupo: quincho usa la capacidad del quincho; el resto, la cantidad de personas ──
    let cupo = Number(cantidad_personas) || 1;
    let quinchoIdFinal = null;
    if (tipo === "quincho") {
      if (!quincho_id) return res.status(400).json({ message: "Falta el quincho" });
      const quincho = await Quincho.findByPk(quincho_id);
      if (!quincho || !quincho.activo) return res.status(400).json({ message: "Quincho inválido" });
      if (!(await quinchoEstaLibre(quincho.id, fecha)))
        return res.status(409).json({ message: `El ${quincho.nombre} ya está reservado para esa fecha` });
      cupo = quincho.capacidad;
      quinchoIdFinal = quincho.id;
    } else if (zona.aforo_max > 0) {
      const usado = await aforoUsado(zona.id, fecha);
      const personas = Number(cantidad_personas) || 1;
      if (usado + personas > zona.aforo_max)
        return res.status(409).json({ message: `No hay cupo en ${zona.nombre} para esa fecha (quedan ${Math.max(0, zona.aforo_max - usado)} lugares)` });
    }

    // ── Monto: del body, o calculado desde la tarifa activa ──
    let monto = montoBody;
    if (monto == null) {
      const tarifa = await Tarifa.findOne({ where: { tipo, condicion, activo: true } });
      const precio = tarifa ? Number(tarifa.precio) : 0;
      monto = tipo === "quincho" ? precio : precio * (Number(cantidad_personas) || 1);
    }

    const numero = await siguienteNumero();
    const reserva = await Reserva.create({
      numero, tipo, zona_id: zona.id, quincho_id: quinchoIdFinal, cliente_id: clienteId,
      fecha, cantidad_personas: Number(cantidad_personas) || 1, cupo, monto,
      estado: "pendiente", estado_pago: "pendiente", creado_por_id: req.user.id,
    });

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
