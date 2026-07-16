import express from "express";
import { Op } from "sequelize";
import Feriado from "../models/Feriado.js";
import { authMiddleware } from "./auth.js";
import { hasRole } from "../middlewares/authorization.js";

const router = express.Router();

// GET /api/feriados?anio=2026  (personal)
router.get("/", authMiddleware, async (req, res) => {
  const where = {};
  if (req.query.anio) {
    where.fecha = { [Op.between]: [`${req.query.anio}-01-01`, `${req.query.anio}-12-31`] };
  }
  const feriados = await Feriado.findAll({ where, order: [["fecha", "ASC"]] });
  res.json(feriados);
});

// POST /api/feriados  { fecha, descripcion }  (admin)
router.post("/", authMiddleware, hasRole(["admin"]), async (req, res) => {
  try {
    const { fecha, descripcion } = req.body;
    if (!fecha) return res.status(400).json({ message: "Falta la fecha" });
    const [feriado, creado] = await Feriado.findOrCreate({ where: { fecha }, defaults: { descripcion: descripcion || null } });
    if (!creado && descripcion) await feriado.update({ descripcion });
    res.status(creado ? 201 : 200).json(feriado);
  } catch (err) {
    console.error("Error creando feriado:", err);
    res.status(500).json({ message: "Error al guardar el feriado" });
  }
});

// DELETE /api/feriados/:id  (admin)
router.delete("/:id", authMiddleware, hasRole(["admin"]), async (req, res) => {
  const feriado = await Feriado.findByPk(req.params.id);
  if (!feriado) return res.status(404).json({ message: "Feriado no encontrado" });
  await feriado.destroy();
  res.json({ ok: true });
});

export default router;
