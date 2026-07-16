import express from "express";
import Cliente from "../models/Cliente.js";
import Caja from "../models/Caja.js";
import MovimientoCaja from "../models/MovimientoCaja.js";
import { authMiddleware } from "./auth.js";
import { hasRole } from "../middlewares/authorization.js";
import { hoyLocal, generarQR, normalizarItems, crearReservaCompleta } from "../utils/reservas.js";

const router = express.Router();

// ── POST /api/puerta/venta ── (admin/cajero/guardia)
// Walk-in: registra al visitante, crea la reserva del día (ya pagada), genera el QR y cobra en caja.
// Body: { nombre, telefono?, email?, tipo | items[], cantidad_personas?, quincho_id?, ..., vehiculos?[], metodo_pago }
router.post("/venta", authMiddleware, hasRole(["admin", "cajero", "guardia"]), async (req, res) => {
  try {
    const { nombre, telefono = null, email = null, vehiculos = [], metodo_pago = "efectivo" } = req.body;
    if (!nombre) return res.status(400).json({ message: "Falta el nombre" });

    // Tiene que haber una caja abierta para cobrar
    const caja = await Caja.findOne({ where: { estado: "abierta" } });
    if (!caja) return res.status(409).json({ message: "Abrí la caja antes de cobrar en la puerta" });

    // Cliente: reusar por teléfono si existe; si no, crearlo (queda registrado)
    let cliente = telefono ? await Cliente.findOne({ where: { telefono } }) : null;
    if (!cliente) cliente = await Cliente.create({ nombre, telefono, email });

    const fecha = hoyLocal();
    const items = normalizarItems(req.body);
    const { reserva, prep } = await crearReservaCompleta({
      items, vehiculos, fecha, cliente_id: cliente.id,
      estado: "confirmada", estado_pago: "pagado", creado_por_id: req.user.id,
    });

    // QR (se escanea como cualquier reserva) — la venta en puerta ya está pagada
    const qr = await generarQR(reserva);

    // Cobro en la caja del turno
    await MovimientoCaja.create({
      caja_id: caja.id, tipo: "ingreso", concepto: `Venta puerta ${reserva.numero}`,
      metodo_pago, monto: reserva.monto, reserva_id: reserva.id, registrado_por_id: req.user.id,
    });

    res.status(201).json({
      reserva: { id: reserva.id, numero: reserva.numero, tipo: reserva.tipo, fecha, cupo: reserva.cupo, monto: reserva.monto },
      cliente: { id: cliente.id, nombre: cliente.nombre, telefono: cliente.telefono },
      zona: { nombre: prep.zonaPrimary.nombre, color: prep.zonaPrimary.color },
      qr: { token: qr.token, cupo_total: reserva.cupo },
    });
  } catch (err) {
    if (err && err.status) return res.status(err.status).json({ message: err.message });
    console.error("Error en venta de puerta:", err);
    res.status(500).json({ message: "Error al registrar la venta en puerta" });
  }
});

export default router;
