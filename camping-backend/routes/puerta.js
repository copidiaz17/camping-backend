import express from "express";
import Cliente from "../models/Cliente.js";
import Reserva from "../models/Reserva.js";
import ReservaVehiculo from "../models/ReservaVehiculo.js";
import Zona from "../models/Zona.js";
import Quincho from "../models/Quincho.js";
import Asador from "../models/Asador.js";
import Caja from "../models/Caja.js";
import MovimientoCaja from "../models/MovimientoCaja.js";
import { authMiddleware } from "./auth.js";
import { hasRole } from "../middlewares/authorization.js";
import {
  ZONA_POR_TIPO, hoyLocal, siguienteNumero, quinchosLibres, quinchoEstaLibre,
  asadoresLibres, asadorEstaLibre, aforoUsado, generarQR, calcularMontoReserva,
} from "../utils/reservas.js";

const router = express.Router();

// ── POST /api/puerta/venta ── (admin/cajero/guardia)
// Walk-in: registra al visitante, crea la reserva del día, genera el QR y cobra en caja.
// Body: { nombre, telefono?, email?, tipo, cantidad_personas, quincho_id?, metodo_pago }
router.post("/venta", authMiddleware, hasRole(["admin", "cajero", "guardia"]), async (req, res) => {
  try {
    const {
      nombre, telefono = null, email = null, tipo, cantidad_personas = 1,
      cantidad_ninos = 0, cantidad_adultos = 0, quincho_id = null, asador_id = null,
      vehiculos = [], metodo_pago = "efectivo",
    } = req.body;
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

    let quinchoIdFinal = null;
    let asadorIdFinal = null;
    let quinchoSel = null;

    if (tipo === "quincho") {
      let quincho = quincho_id ? await Quincho.findByPk(quincho_id) : null;
      if (quincho && !(await quinchoEstaLibre(quincho.id, fecha)))
        return res.status(409).json({ message: `El ${quincho.nombre} ya está reservado para hoy` });
      if (!quincho) {
        const libres = (await quinchosLibres(fecha)).filter((q) => q.libre);
        if (!libres.length) return res.status(409).json({ message: "No hay quinchos disponibles para hoy" });
        quincho = await Quincho.findByPk(libres[0].id);
      }
      quinchoSel = quincho;
      quinchoIdFinal = quincho.id;
    } else if (tipo === "asador") {
      let asador = asador_id ? await Asador.findByPk(asador_id) : null;
      if (asador && !(await asadorEstaLibre(asador.id, fecha)))
        return res.status(409).json({ message: `El ${asador.nombre} ya está reservado para hoy` });
      if (!asador) {
        const libres = (await asadoresLibres(fecha)).filter((a) => a.libre);
        if (!libres.length) return res.status(409).json({ message: "No hay asadores disponibles para hoy" });
        asador = await Asador.findByPk(libres[0].id);
      }
      asadorIdFinal = asador.id;
    } else if (zona.aforo_max > 0) {
      const usado = await aforoUsado(zona.id, fecha);
      const personas = tipo === "pileta" ? (Number(cantidad_ninos) || 0) + (Number(cantidad_adultos) || 0) : (Number(cantidad_personas) || 1);
      if (usado + personas > zona.aforo_max)
        return res.status(409).json({ message: `No hay cupo en ${zona.nombre} para hoy (quedan ${Math.max(0, zona.aforo_max - usado)} lugares)` });
    }

    // Monto (única fuente de verdad, con recargo y estacionamiento)
    const calc = await calcularMontoReserva({ tipo, fecha, cantidad_personas, cantidad_ninos, cantidad_adultos, quincho: quinchoSel, vehiculos });

    const numero = await siguienteNumero();
    const reserva = await Reserva.create({
      numero, tipo, zona_id: zona.id, quincho_id: quinchoIdFinal, asador_id: asadorIdFinal, cliente_id: cliente.id,
      fecha,
      cantidad_personas: tipo === "pileta" ? (Number(cantidad_ninos) || 0) + (Number(cantidad_adultos) || 0) : (Number(cantidad_personas) || 1),
      cantidad_ninos: Number(cantidad_ninos) || 0, cantidad_adultos: Number(cantidad_adultos) || 0,
      cupo: calc.cupo, monto: calc.monto, recargo: calc.recargo, monto_estacionamiento: calc.monto_estacionamiento,
      estado: "confirmada", estado_pago: "pagado", creado_por_id: req.user.id,
    });

    for (const v of calc.vehiculosDetalle) {
      await ReservaVehiculo.create({ reserva_id: reserva.id, tipo: v.tipo, descripcion: v.descripcion, precio: v.precio });
    }

    // QR (se escanea como cualquier reserva) — la venta en puerta ya está pagada
    const qr = await generarQR(reserva);

    // Cobro en la caja del turno
    await MovimientoCaja.create({
      caja_id: caja.id, tipo: "ingreso", concepto: `Venta puerta ${numero}`,
      metodo_pago, monto: calc.monto, reserva_id: reserva.id, registrado_por_id: req.user.id,
    });

    res.status(201).json({
      reserva: { id: reserva.id, numero, tipo, fecha, cantidad_personas: reserva.cantidad_personas, cupo: calc.cupo, monto: calc.monto },
      cliente: { id: cliente.id, nombre: cliente.nombre, telefono: cliente.telefono },
      zona: { nombre: zona.nombre, color: zona.color },
      qr: { token: qr.token, cupo_total: calc.cupo },
    });
  } catch (err) {
    console.error("Error en venta de puerta:", err);
    res.status(500).json({ message: "Error al registrar la venta en puerta" });
  }
});

export default router;
