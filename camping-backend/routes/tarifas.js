import express from "express";
import Tarifa from "../models/Tarifa.js";
import { authMiddleware } from "./auth.js";
import { hasRole } from "../middlewares/authorization.js";

const router = express.Router();

// GET /api/tarifas — filtros opcionales: ?tipo= &condicion= &temporada= &soloActivas=1
router.get("/", authMiddleware, async (req, res) => {
  const where = {};
  if (req.query.tipo) where.tipo = req.query.tipo;
  if (req.query.condicion) where.condicion = req.query.condicion;
  if (req.query.temporada) where.temporada = req.query.temporada;
  if (req.query.soloActivas === "1") where.activo = true;
  const tarifas = await Tarifa.findAll({ where, order: [["tipo", "ASC"], ["condicion", "ASC"]] });
  res.json(tarifas);
});

// POST /api/tarifas (admin)
router.post("/", authMiddleware, hasRole(["admin"]), async (req, res) => {
  try {
    const { tipo, descripcion, precio, condicion, temporada, activo } = req.body;
    if (!tipo || !descripcion) return res.status(400).json({ message: "Faltan tipo o descripción" });
    const tarifa = await Tarifa.create({
      tipo,
      descripcion,
      precio: precio ?? 0,
      condicion: condicion ?? "general",
      temporada: temporada ?? "todo_el_anio",
      activo: activo ?? true,
    });
    res.status(201).json(tarifa);
  } catch (err) {
    console.error("Error creando tarifa:", err);
    res.status(500).json({ message: "Error al crear la tarifa" });
  }
});

// PUT /api/tarifas/:id (admin)
router.put("/:id", authMiddleware, hasRole(["admin"]), async (req, res) => {
  const tarifa = await Tarifa.findByPk(req.params.id);
  if (!tarifa) return res.status(404).json({ message: "Tarifa no encontrada" });
  const { tipo, descripcion, precio, condicion, temporada, activo } = req.body;
  await tarifa.update({
    tipo: tipo ?? tarifa.tipo,
    descripcion: descripcion ?? tarifa.descripcion,
    precio: precio ?? tarifa.precio,
    condicion: condicion ?? tarifa.condicion,
    temporada: temporada ?? tarifa.temporada,
    activo: activo ?? tarifa.activo,
  });
  res.json(tarifa);
});

// DELETE /api/tarifas/:id (admin, baja lógica)
router.delete("/:id", authMiddleware, hasRole(["admin"]), async (req, res) => {
  const tarifa = await Tarifa.findByPk(req.params.id);
  if (!tarifa) return res.status(404).json({ message: "Tarifa no encontrada" });
  await tarifa.update({ activo: false });
  res.json({ ok: true, message: "Tarifa desactivada" });
});

export default router;
