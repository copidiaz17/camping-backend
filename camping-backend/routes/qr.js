import express from "express";
import CodigoQR from "../models/CodigoQR.js";
import Reserva from "../models/Reserva.js";
import Cliente from "../models/Cliente.js";
import Zona from "../models/Zona.js";
import Quincho from "../models/Quincho.js";
import { authMiddleware } from "./auth.js";

const router = express.Router();

const includeReserva = {
  model: Reserva,
  as: "reserva",
  include: [
    { model: Cliente, as: "cliente" },
    { model: Zona, as: "zona" },
    { model: Quincho, as: "quincho" },
  ],
};

// GET /api/qr/reserva/:reservaId — el/los QR de una reserva
router.get("/reserva/:reservaId", authMiddleware, async (req, res) => {
  const qrs = await CodigoQR.findAll({
    where: { reserva_id: req.params.reservaId },
    include: [includeReserva],
    order: [["id", "DESC"]],
  });
  res.json(qrs);
});

// GET /api/qr/:token — info de un QR (para previsualizar en la entrada)
router.get("/:token", authMiddleware, async (req, res) => {
  const qr = await CodigoQR.findOne({ where: { token: req.params.token }, include: [includeReserva] });
  if (!qr) return res.status(404).json({ message: "QR no encontrado" });
  res.json({
    token: qr.token,
    estado: qr.estado,
    vencimiento_fecha: qr.vencimiento_fecha,
    cupo: { total: qr.cupo_total, usado: qr.cupo_usado, restante: qr.cupo_total - qr.cupo_usado },
    pulsera: qr.reserva && qr.reserva.zona ? { zona: qr.reserva.zona.nombre, color: qr.reserva.zona.color } : null,
    reserva: qr.reserva
      ? {
          numero: qr.reserva.numero,
          tipo: qr.reserva.tipo,
          fecha: qr.reserva.fecha,
          estado: qr.reserva.estado,
          cliente: qr.reserva.cliente ? `${qr.reserva.cliente.nombre} ${qr.reserva.cliente.apellido || ""}`.trim() : null,
        }
      : null,
  });
});

export default router;
