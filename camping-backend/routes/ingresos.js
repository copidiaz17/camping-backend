import express from "express";
import Ingreso from "../models/Ingreso.js";
import CodigoQR from "../models/CodigoQR.js";
import Reserva from "../models/Reserva.js";
import Cliente from "../models/Cliente.js";
import Zona from "../models/Zona.js";
import Quincho from "../models/Quincho.js";
import { authMiddleware } from "./auth.js";
import { hasRole } from "../middlewares/authorization.js";

const router = express.Router();

// Fecha local (Argentina) en formato YYYY-MM-DD
function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Hora local HH:MM:SS
function horaLocal() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

const includeReserva = {
  model: Reserva,
  as: "reserva",
  include: [
    { model: Cliente, as: "cliente" },
    { model: Zona, as: "zona" },
    { model: Quincho, as: "quincho" },
  ],
};

// POST /api/ingresos/escanear (guardia/admin)
// Body: { token, cantidad_personas? }
// Valida el QR (estado, fecha, horario, cupo), descuenta el cupo y registra el ingreso.
router.post("/escanear", authMiddleware, hasRole(["admin", "guardia"]), async (req, res) => {
  try {
    const { token, cantidad_personas = 1 } = req.body;
    if (!token) return res.status(400).json({ ok: false, message: "Falta el token del QR" });

    const cantidad = Math.max(1, Number(cantidad_personas) || 1);

    const qr = await CodigoQR.findOne({ where: { token }, include: [includeReserva] });
    if (!qr) return res.status(404).json({ ok: false, message: "❌ QR inválido o inexistente" });

    const reserva = qr.reserva;

    // ── Validaciones ──
    if (qr.estado === "anulado")
      return res.status(409).json({ ok: false, message: "❌ QR anulado" });
    if (reserva && reserva.estado === "cancelada")
      return res.status(409).json({ ok: false, message: "❌ La reserva fue cancelada" });
    if (reserva && reserva.estado_pago !== "pagado")
      return res.status(409).json({ ok: false, message: "❌ La reserva no está pagada" });

    const hoy = hoyLocal();
    if (qr.vencimiento_fecha < hoy) {
      if (qr.estado !== "vencido") await qr.update({ estado: "vencido" });
      return res.status(409).json({ ok: false, message: `❌ QR vencido (era para el ${qr.vencimiento_fecha})` });
    }
    if (qr.vencimiento_fecha > hoy)
      return res.status(409).json({ ok: false, message: `⏳ QR aún no válido (es para el ${qr.vencimiento_fecha})` });

    // Horario (solo si está configurado)
    const ahora = horaLocal();
    if (qr.hora_desde && ahora < qr.hora_desde)
      return res.status(409).json({ ok: false, message: `⏳ Acceso desde las ${qr.hora_desde}` });
    if (qr.hora_hasta && ahora > qr.hora_hasta)
      return res.status(409).json({ ok: false, message: `⏳ Acceso hasta las ${qr.hora_hasta}` });

    // Cupo
    const restante = qr.cupo_total - qr.cupo_usado;
    if (qr.estado === "agotado" || restante <= 0)
      return res.status(409).json({ ok: false, message: "🚫 Cupo agotado — no quedan lugares" });
    if (cantidad > restante)
      return res.status(409).json({
        ok: false,
        message: `🚫 Cupo insuficiente: pedís ${cantidad} y quedan ${restante}`,
        cupo_restante: restante,
      });

    // ── Registrar el ingreso y descontar el cupo ──
    const ingreso = await Ingreso.create({
      reserva_id: reserva ? reserva.id : null,
      codigo_qr_id: qr.id,
      cantidad_personas: cantidad,
      registrado_por_id: req.user.id,
    });

    const nuevoUsado = qr.cupo_usado + cantidad;
    await qr.update({
      cupo_usado: nuevoUsado,
      estado: nuevoUsado >= qr.cupo_total ? "agotado" : "activo",
    });

    const zona = reserva ? reserva.zona : null;
    res.status(201).json({
      ok: true,
      message: "✅ Ingreso autorizado",
      pulsera: zona ? { zona: zona.nombre, color: zona.color } : null,
      ingreso: { id: ingreso.id, cantidad_personas: cantidad, hora: ahora },
      cupo: { total: qr.cupo_total, usado: nuevoUsado, restante: qr.cupo_total - nuevoUsado },
      reserva: reserva
        ? { numero: reserva.numero, tipo: reserva.tipo, cliente: reserva.cliente ? `${reserva.cliente.nombre} ${reserva.cliente.apellido || ""}`.trim() : null }
        : null,
    });
  } catch (err) {
    console.error("Error en escaneo de ingreso:", err);
    res.status(500).json({ ok: false, message: "Error al registrar el ingreso" });
  }
});

// GET /api/ingresos?fecha=&reserva_id= — historial de ingresos
router.get("/", authMiddleware, async (req, res) => {
  const where = {};
  if (req.query.reserva_id) where.reserva_id = req.query.reserva_id;
  const ingresos = await Ingreso.findAll({
    where,
    include: [includeReserva],
    order: [["id", "DESC"]],
    limit: 200,
  });
  res.json(ingresos);
});

export default router;
