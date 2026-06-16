import express from "express";
import Caja from "../models/Caja.js";
import MovimientoCaja from "../models/MovimientoCaja.js";
import Reserva from "../models/Reserva.js";
import Cliente from "../models/Cliente.js";
import { authMiddleware } from "./auth.js";
import { hasRole } from "../middlewares/authorization.js";

const router = express.Router();

const includeMovs = {
  model: MovimientoCaja,
  as: "movimientos",
  include: [{ model: Reserva, as: "reserva", include: [{ model: Cliente, as: "cliente" }] }],
};

// Calcula los totales de una caja a partir de sus movimientos.
function resumen(caja) {
  const movs = caja.movimientos || [];
  const r = {
    ingresos: { efectivo: 0, transferencia: 0, mercadopago: 0, total: 0 },
    egresos: { efectivo: 0, transferencia: 0, mercadopago: 0, total: 0 },
  };
  for (const m of movs) {
    const monto = Number(m.monto);
    const grupo = m.tipo === "egreso" ? r.egresos : r.ingresos;
    grupo[m.metodo_pago] += monto;
    grupo.total += monto;
  }
  const inicial = Number(caja.monto_inicial);
  const esperado_efectivo = inicial + r.ingresos.efectivo - r.egresos.efectivo;
  return { monto_inicial: inicial, ...r, esperado_efectivo, balance: r.ingresos.total - r.egresos.total };
}

async function cajaAbierta() {
  return Caja.findOne({ where: { estado: "abierta" }, include: [includeMovs], order: [["id", "DESC"]] });
}

// GET /api/caja/actual — la caja abierta con sus movimientos y totales
router.get("/actual", authMiddleware, async (req, res) => {
  const caja = await cajaAbierta();
  if (!caja) return res.json({ abierta: false });
  res.json({ abierta: true, caja, resumen: resumen(caja) });
});

// GET /api/caja — historial de cajas
router.get("/", authMiddleware, async (req, res) => {
  const cajas = await Caja.findAll({ order: [["id", "DESC"]], limit: 100 });
  res.json(cajas);
});

// GET /api/caja/:id — detalle con movimientos y totales
router.get("/:id", authMiddleware, async (req, res) => {
  const caja = await Caja.findByPk(req.params.id, { include: [includeMovs] });
  if (!caja) return res.status(404).json({ message: "Caja no encontrada" });
  res.json({ caja, resumen: resumen(caja) });
});

// POST /api/caja/abrir { monto_inicial } (admin/cajero)
router.post("/abrir", authMiddleware, hasRole(["admin", "cajero", "guardia"]), async (req, res) => {
  const yaAbierta = await Caja.findOne({ where: { estado: "abierta" } });
  if (yaAbierta) return res.status(409).json({ message: "Ya hay una caja abierta. Cerrala antes de abrir otra." });
  const monto_inicial = Number(req.body.monto_inicial) || 0;
  const caja = await Caja.create({ monto_inicial, estado: "abierta", abierta_por_id: req.user.id });
  res.status(201).json({ ok: true, message: "Caja abierta", caja });
});

// POST /api/caja/movimientos { tipo, concepto, metodo_pago, monto, reserva_id? } (admin/cajero)
router.post("/movimientos", authMiddleware, hasRole(["admin", "cajero", "guardia"]), async (req, res) => {
  const caja = await Caja.findOne({ where: { estado: "abierta" } });
  if (!caja) return res.status(409).json({ message: "No hay una caja abierta" });
  const { tipo = "ingreso", concepto, metodo_pago = "efectivo", monto, reserva_id = null } = req.body;
  if (!concepto || monto == null) return res.status(400).json({ message: "Faltan concepto o monto" });
  const mov = await MovimientoCaja.create({
    caja_id: caja.id, tipo, concepto, metodo_pago,
    monto: Number(monto), reserva_id, registrado_por_id: req.user.id,
  });
  res.status(201).json({ ok: true, message: "Movimiento registrado", movimiento: mov });
});

// POST /api/caja/cobrar-reserva { reserva_id, metodo_pago } (admin/cajero)
// Registra el cobro del monto de la reserva en la caja abierta y la marca pagada/confirmada.
router.post("/cobrar-reserva", authMiddleware, hasRole(["admin", "cajero", "guardia"]), async (req, res) => {
  const { reserva_id, metodo_pago = "efectivo" } = req.body;
  const caja = await Caja.findOne({ where: { estado: "abierta" } });
  if (!caja) return res.status(409).json({ message: "No hay una caja abierta" });

  const reserva = await Reserva.findByPk(reserva_id);
  if (!reserva) return res.status(404).json({ message: "Reserva no encontrada" });
  if (reserva.estado === "cancelada") return res.status(400).json({ message: "La reserva está cancelada" });
  if (reserva.estado_pago === "pagado") return res.status(409).json({ message: "La reserva ya está pagada" });

  const mov = await MovimientoCaja.create({
    caja_id: caja.id, tipo: "ingreso",
    concepto: `Cobro reserva ${reserva.numero}`,
    metodo_pago, monto: Number(reserva.monto),
    reserva_id: reserva.id, registrado_por_id: req.user.id,
  });
  await reserva.update({ estado_pago: "pagado", estado: reserva.estado === "pendiente" ? "confirmada" : reserva.estado });

  res.status(201).json({ ok: true, message: "Reserva cobrada", movimiento: mov, reserva });
});

// POST /api/caja/cerrar { monto_declarado, observaciones? } (admin/cajero)
router.post("/cerrar", authMiddleware, hasRole(["admin", "cajero", "guardia"]), async (req, res) => {
  const caja = await cajaAbierta();
  if (!caja) return res.status(409).json({ message: "No hay una caja abierta" });

  const r = resumen(caja);
  const monto_declarado = Number(req.body.monto_declarado) || 0;
  const diferencia = monto_declarado - r.esperado_efectivo;

  await caja.update({
    estado: "cerrada",
    fecha_cierre: new Date(),
    cerrada_por_id: req.user.id,
    monto_esperado_efectivo: r.esperado_efectivo,
    monto_declarado,
    diferencia,
    observaciones: req.body.observaciones || null,
  });

  res.json({
    ok: true,
    message: "Caja cerrada",
    arqueo: {
      esperado_efectivo: r.esperado_efectivo,
      declarado: monto_declarado,
      diferencia,
      estado: diferencia === 0 ? "cuadra" : diferencia > 0 ? "sobrante" : "faltante",
    },
    resumen: r,
    caja,
  });
});

export default router;
