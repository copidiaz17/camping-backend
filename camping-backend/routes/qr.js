import express from "express";
import CodigoQR from "../models/CodigoQR.js";
import Reserva from "../models/Reserva.js";
import ReservaItem from "../models/ReservaItem.js";
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
    { model: ReservaItem, as: "items", include: [{ model: Zona, as: "zona" }] },
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

  const r = qr.reserva;
  // Conceptos de la reserva con su cupo (una reserva puede combinar quincho + pileta + ...)
  const items = (r && r.items ? r.items : []).map((it) => ({
    id: it.id,
    tipo: it.tipo,
    zona: it.zona ? it.zona.nombre : null,
    color: it.zona ? it.zona.color : null,
    cupo: { total: it.cupo_total, usado: it.cupo_usado, restante: it.cupo_total - it.cupo_usado },
  }));

  // Legacy (reservas viejas sin ítems): usar la zona de la reserva y el cupo del QR
  const legacyPulsera = r && r.zona ? { zona: r.zona.nombre, color: r.zona.color } : null;
  const legacyCupo = { total: qr.cupo_total, usado: qr.cupo_usado, restante: qr.cupo_total - qr.cupo_usado };

  res.json({
    token: qr.token,
    estado: qr.estado,
    vencimiento_fecha: qr.vencimiento_fecha,
    items,
    pulsera: items.length ? { zona: items[0].zona, color: items[0].color } : legacyPulsera,
    cupo: items.length ? items[0].cupo : legacyCupo,
    reserva: r
      ? {
          numero: r.numero,
          tipo: r.tipo,
          fecha: r.fecha,
          estado: r.estado,
          cliente: r.cliente ? `${r.cliente.nombre} ${r.cliente.apellido || ""}`.trim() : null,
        }
      : null,
  });
});

export default router;
