import express from "express";
import Quincho from "../models/Quincho.js";
import { authMiddleware } from "./auth.js";
import { hasRole } from "../middlewares/authorization.js";

const router = express.Router();

// GET /api/quinchos
router.get("/", authMiddleware, async (req, res) => {
  const quinchos = await Quincho.findAll({ order: [["nombre", "ASC"]] });
  res.json(quinchos);
});

// POST /api/quinchos (admin)
router.post("/", authMiddleware, hasRole(["admin"]), async (req, res) => {
  try {
    const { nombre, capacidad, descripcion, activo } = req.body;
    if (!nombre) return res.status(400).json({ message: "Falta el nombre" });
    const quincho = await Quincho.create({
      nombre,
      capacidad: capacidad ?? 50,
      descripcion: descripcion ?? null,
      activo: activo ?? true,
    });
    res.status(201).json(quincho);
  } catch (err) {
    console.error("Error creando quincho:", err);
    res.status(500).json({ message: "Error al crear el quincho" });
  }
});

// PUT /api/quinchos/:id (admin)
router.put("/:id", authMiddleware, hasRole(["admin"]), async (req, res) => {
  const quincho = await Quincho.findByPk(req.params.id);
  if (!quincho) return res.status(404).json({ message: "Quincho no encontrado" });
  const { nombre, capacidad, descripcion, activo } = req.body;
  await quincho.update({
    nombre: nombre ?? quincho.nombre,
    capacidad: capacidad ?? quincho.capacidad,
    descripcion: descripcion ?? quincho.descripcion,
    activo: activo ?? quincho.activo,
  });
  res.json(quincho);
});

// DELETE /api/quinchos/:id (admin, baja lógica)
router.delete("/:id", authMiddleware, hasRole(["admin"]), async (req, res) => {
  const quincho = await Quincho.findByPk(req.params.id);
  if (!quincho) return res.status(404).json({ message: "Quincho no encontrado" });
  await quincho.update({ activo: false });
  res.json({ ok: true, message: "Quincho desactivado" });
});

export default router;
