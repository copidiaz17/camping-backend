import express from "express";
import { Op } from "sequelize";
import Reserva from "../models/Reserva.js";
import Zona from "../models/Zona.js";
import Ingreso from "../models/Ingreso.js";
import MovimientoCaja from "../models/MovimientoCaja.js";
import { authMiddleware } from "./auth.js";
import { hasRole } from "../middlewares/authorization.js";

const router = express.Router();

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function primerDiaMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// GET /api/reportes?desde=&hasta= (admin + municipalidad — solo lectura)
router.get("/", authMiddleware, hasRole(["admin", "municipalidad"]), async (req, res) => {
  try {
    const hasta = req.query.hasta || hoyLocal();
    const desde = req.query.desde || primerDiaMes();
    const desdeDT = new Date(`${desde}T00:00:00`);
    const hastaDT = new Date(`${hasta}T23:59:59.999`);

    // ── Reservas del período (por fecha de reserva), no canceladas ──
    const reservas = await Reserva.findAll({
      where: { fecha: { [Op.between]: [desde, hasta] }, estado: { [Op.ne]: "cancelada" } },
      include: [{ model: Zona, as: "zona", attributes: ["nombre", "color"] }],
    });

    let totalMonto = 0;
    const reservasPorTipo = {};
    const reservasPorZona = {};
    const porDia = {};
    for (const r of reservas) {
      const m = Number(r.monto) || 0;
      totalMonto += m;
      reservasPorTipo[r.tipo] = (reservasPorTipo[r.tipo] || 0) + 1;
      const zn = r.zona?.nombre || "—";
      if (!reservasPorZona[zn]) reservasPorZona[zn] = { reservas: 0, color: r.zona?.color || "#888" };
      reservasPorZona[zn].reservas++;
      porDia[r.fecha] = (porDia[r.fecha] || 0) + m;
    }

    // ── Recaudación por método (movimientos de caja, ingresos) ──
    const movs = await MovimientoCaja.findAll({
      where: { tipo: "ingreso", createdAt: { [Op.between]: [desdeDT, hastaDT] } },
      attributes: ["metodo_pago", "monto"],
    });
    const recaudacionPorMetodo = {};
    let totalRecaudado = 0;
    for (const mv of movs) {
      const m = Number(mv.monto) || 0;
      recaudacionPorMetodo[mv.metodo_pago] = (recaudacionPorMetodo[mv.metodo_pago] || 0) + m;
      totalRecaudado += m;
    }

    // ── Personas ingresadas (escaneos) ──
    const ingresos = await Ingreso.findAll({
      where: { createdAt: { [Op.between]: [desdeDT, hastaDT] } },
      include: [{ model: Reserva, as: "reserva", include: [{ model: Zona, as: "zona", attributes: ["nombre"] }] }],
      attributes: ["cantidad_personas", "createdAt"],
    });
    let totalPersonas = 0;
    const personasPorZona = {};
    for (const i of ingresos) {
      const n = i.cantidad_personas || 0;
      totalPersonas += n;
      const zn = i.reserva?.zona?.nombre || "—";
      personasPorZona[zn] = (personasPorZona[zn] || 0) + n;
    }

    res.json({
      periodo: { desde, hasta },
      kpis: {
        reservas: reservas.length,
        recaudado: totalRecaudado,
        personas: totalPersonas,
        ticket_promedio: reservas.length > 0 ? Math.round(totalMonto / reservas.length) : 0,
      },
      recaudacionPorMetodo,
      reservasPorTipo,
      reservasPorZona,
      personasPorZona,
      porDia: Object.entries(porDia).map(([dia, monto]) => ({ dia, monto })).sort((a, b) => a.dia.localeCompare(b.dia)),
    });
  } catch (err) {
    console.error("Error en reportes:", err);
    res.status(500).json({ message: "Error al generar el reporte" });
  }
});

export default router;
