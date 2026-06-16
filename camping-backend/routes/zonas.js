import express from "express";
import Zona from "../models/Zona.js";
import { authMiddleware } from "./auth.js";
import { hasRole } from "../middlewares/authorization.js";

const router = express.Router();

// GET /api/zonas — lista todas (cualquier usuario autenticado)
router.get("/", authMiddleware, async (req, res) => {
  const zonas = await Zona.findAll({ order: [["nombre", "ASC"]] });
  res.json(zonas);
});

// POST /api/zonas — crear (solo admin)
router.post("/", authMiddleware, hasRole(["admin"]), async (req, res) => {
  try {
    const { nombre, color, aforo_max, activo } = req.body;
    if (!nombre || !color) return res.status(400).json({ message: "Faltan nombre o color" });
    const zona = await Zona.create({ nombre, color, aforo_max: aforo_max ?? 0, activo: activo ?? true });
    res.status(201).json(zona);
  } catch (err) {
    console.error("Error creando zona:", err);
    res.status(500).json({ message: "Error al crear la zona" });
  }
});

// PUT /api/zonas/:id — editar (solo admin)
router.put("/:id", authMiddleware, hasRole(["admin"]), async (req, res) => {
  const zona = await Zona.findByPk(req.params.id);
  if (!zona) return res.status(404).json({ message: "Zona no encontrada" });
  const { nombre, color, aforo_max, activo } = req.body;
  await zona.update({
    nombre: nombre ?? zona.nombre,
    color: color ?? zona.color,
    aforo_max: aforo_max ?? zona.aforo_max,
    activo: activo ?? zona.activo,
  });
  res.json(zona);
});

// DELETE /api/zonas/:id — desactivar (solo admin, baja lógica)
router.delete("/:id", authMiddleware, hasRole(["admin"]), async (req, res) => {
  const zona = await Zona.findByPk(req.params.id);
  if (!zona) return res.status(404).json({ message: "Zona no encontrada" });
  await zona.update({ activo: false });
  res.json({ ok: true, message: "Zona desactivada" });
});

export default router;
