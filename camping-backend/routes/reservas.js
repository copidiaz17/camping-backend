import express from "express";
import crypto from "crypto";
import { Op } from "sequelize";
import Reserva from "../models/Reserva.js";
import ReservaItem from "../models/ReservaItem.js";
import ReservaVehiculo from "../models/ReservaVehiculo.js";
import Cliente from "../models/Cliente.js";
import Zona from "../models/Zona.js";
import Quincho from "../models/Quincho.js";
import Asador from "../models/Asador.js";
import CodigoQR from "../models/CodigoQR.js";
import { authMiddleware } from "./auth.js";
import { hasRole } from "../middlewares/authorization.js";
import { fechaEsPasada, normalizarItems, crearReservaCompleta } from "../utils/reservas.js";

const router = express.Router();

const includeAll = [
  { model: Cliente, as: "cliente" },
  { model: Zona, as: "zona" },
  { model: Quincho, as: "quincho" },
  { model: Asador, as: "asador" },
  { model: ReservaVehiculo, as: "vehiculos" },
  { model: ReservaItem, as: "items", include: [{ model: Zona, as: "zona" }] },
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
// Body: { fecha, items:[{tipo, quincho_id?, asador_id?, cantidad_personas?, cantidad_ninos?, cantidad_adultos?}],
//         vehiculos?[], cliente_id? | cliente:{...} }   (también acepta el formato viejo de 1 concepto)
router.post("/", authMiddleware, hasRole(["admin", "cajero"]), async (req, res) => {
  try {
    const { fecha, vehiculos = [], cliente_id, cliente } = req.body;
    if (!fecha) return res.status(400).json({ message: "Falta la fecha" });
    if (fechaEsPasada(fecha)) return res.status(400).json({ message: "Esa fecha ya pasó. Elegí una fecha de hoy en adelante." });

    // ── Cliente: usar el existente o crear uno nuevo ──
    let clienteId = cliente_id;
    if (!clienteId) {
      if (!cliente || !cliente.nombre)
        return res.status(400).json({ message: "Falta el cliente (cliente_id o datos del cliente)" });
      const nuevo = await Cliente.create(cliente);
      clienteId = nuevo.id;
    }

    const items = normalizarItems(req.body);
    const { reserva } = await crearReservaCompleta({
      items, vehiculos, fecha, cliente_id: clienteId,
      estado: "pendiente", estado_pago: "pendiente", creado_por_id: req.user.id,
    });

    const completa = await Reserva.findByPk(reserva.id, { include: includeAll });
    res.status(201).json(completa);
  } catch (err) {
    if (err && err.status) return res.status(err.status).json({ message: err.message });
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
