import express from "express";
import Cliente from "../models/Cliente.js";
import Reserva from "../models/Reserva.js";
import Zona from "../models/Zona.js";
import Quincho from "../models/Quincho.js";
import Tarifa from "../models/Tarifa.js";
import Caja from "../models/Caja.js";
import MovimientoCaja from "../models/MovimientoCaja.js";
import { authMiddleware } from "./auth.js";
import { hasRole } from "../middlewares/authorization.js";
import { ZONA_POR_TIPO, hoyLocal, siguienteNumero, quinchosLibres, quinchoEstaLibre, aforoUsado, generarQR } from "../utils/reservas.js";

const router = express.Router();

// ── POST /api/puerta/venta ── (admin/cajero/guardia)
// Walk-in: registra al visitante, crea la reserva del día, genera el QR y cobra en caja.
// Body: { nombre, telefono?, email?, tipo, cantidad_personas, quincho_id?, metodo_pago }
router.post("/venta", authMiddleware, hasRole(["admin", "cajero", "guardia"]), async (req, res) => {
  try {
    const { nombre, telefono = null, email = null, tipo, cantidad_personas = 1, quincho_id = null, metodo_pago = "efectivo", condicion = "general" } = req.body;
    if (!nombre || !tipo) return res.status(400).json({ message: "Faltan nombre o tipo" });
    if (!ZONA_POR_TIPO[tipo]) return res.status(400).json({ message: "Tipo inválido" });

    // Tiene que haber una caja abierta para cobrar
    const caja = await Caja.findOne({ where: { estado: "abierta" } });
    if (!caja) return res.status(409).json({ message: "Abrí la caja antes de cobrar en la puerta" });

    // Cliente: reusar por teléfono si existe; si no, crearlo (queda registrado)
    let cliente = telefono ? await Cliente.findOne({ where: { telefono } }) : null;
    if (!cliente) cliente = await Cliente.create({ nombre, telefono, email });

    const zona = await Zona.findOne({ where: { nombre: ZONA_POR_TIPO[tipo] } });
    if (!zona) return res.status(400).json({ message: `No existe la zona "${ZONA_POR_TIPO[tipo]}"` });

    const fecha = hoyLocal();

    // Cupo + quincho (sin doble-reserva) / aforo de la zona
    let cupo = Number(cantidad_personas) || 1;
    let quinchoIdFinal = null;
    if (tipo === "quincho") {
      let quincho = quincho_id ? await Quincho.findByPk(quincho_id) : null;
      if (quincho && !(await quinchoEstaLibre(quincho.id, fecha)))
        return res.status(409).json({ message: `El ${quincho.nombre} ya está reservado para hoy` });
      if (!quincho) {
        const libres = (await quinchosLibres(fecha)).filter((q) => q.libre);
        if (!libres.length) return res.status(409).json({ message: "No hay quinchos disponibles para hoy" });
        quincho = await Quincho.findByPk(libres[0].id);
      }
      cupo = quincho.capacidad;
      quinchoIdFinal = quincho.id;
    } else if (zona.aforo_max > 0) {
      const usado = await aforoUsado(zona.id, fecha);
      const personas = Number(cantidad_personas) || 1;
      if (usado + personas > zona.aforo_max)
        return res.status(409).json({ message: `No hay cupo en ${zona.nombre} para hoy (quedan ${Math.max(0, zona.aforo_max - usado)} lugares)` });
    }

    // Monto (con la condición elegida; si no existe, cae a general)
    const tarifa =
      (await Tarifa.findOne({ where: { tipo, condicion, activo: true } })) ||
      (await Tarifa.findOne({ where: { tipo, condicion: "general", activo: true } }));
    const precio = tarifa ? Number(tarifa.precio) : 0;
    const monto = tipo === "quincho" ? precio : precio * (Number(cantidad_personas) || 1);

    const numero = await siguienteNumero();
    const reserva = await Reserva.create({
      numero, tipo, zona_id: zona.id, quincho_id: quinchoIdFinal, cliente_id: cliente.id,
      fecha, cantidad_personas: Number(cantidad_personas) || 1, cupo, monto,
      estado: "confirmada", estado_pago: "pagado", creado_por_id: req.user.id,
    });

    // QR (se escanea como cualquier reserva) — la venta en puerta ya está pagada
    const qr = await generarQR(reserva);

    // Cobro en la caja del turno
    await MovimientoCaja.create({
      caja_id: caja.id, tipo: "ingreso", concepto: `Venta puerta ${numero}`,
      metodo_pago, monto, reserva_id: reserva.id, registrado_por_id: req.user.id,
    });

    res.status(201).json({
      reserva: { id: reserva.id, numero, tipo, fecha, cantidad_personas: reserva.cantidad_personas, cupo, monto },
      cliente: { id: cliente.id, nombre: cliente.nombre, telefono: cliente.telefono },
      zona: { nombre: zona.nombre, color: zona.color },
      qr: { token: qr.token, cupo_total: cupo },
    });
  } catch (err) {
    console.error("Error en venta de puerta:", err);
    res.status(500).json({ message: "Error al registrar la venta en puerta" });
  }
});

export default router;
