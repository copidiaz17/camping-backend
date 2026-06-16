import express from "express";
import { Op } from "sequelize";
import Cliente from "../models/Cliente.js";
import { authMiddleware } from "./auth.js";
import { hasRole } from "../middlewares/authorization.js";

const router = express.Router();

// GET /api/clientes?buscar=texto
router.get("/", authMiddleware, async (req, res) => {
  const where = {};
  if (req.query.buscar) {
    const q = `%${req.query.buscar}%`;
    where[Op.or] = [
      { nombre: { [Op.like]: q } },
      { apellido: { [Op.like]: q } },
      { telefono: { [Op.like]: q } },
      { documento: { [Op.like]: q } },
    ];
  }
  const clientes = await Cliente.findAll({ where, order: [["apellido", "ASC"], ["nombre", "ASC"]], limit: 100 });
  res.json(clientes);
});

// GET /api/clientes/:id
router.get("/:id", authMiddleware, async (req, res) => {
  const cliente = await Cliente.findByPk(req.params.id);
  if (!cliente) return res.status(404).json({ message: "Cliente no encontrado" });
  res.json(cliente);
});

// POST /api/clientes (admin/cajero)
router.post("/", authMiddleware, hasRole(["admin", "cajero"]), async (req, res) => {
  try {
    const { nombre, apellido, telefono, email, documento } = req.body;
    if (!nombre) return res.status(400).json({ message: "Falta el nombre" });
    const cliente = await Cliente.create({ nombre, apellido, telefono, email, documento });
    res.status(201).json(cliente);
  } catch (err) {
    console.error("Error creando cliente:", err);
    res.status(500).json({ message: "Error al crear el cliente" });
  }
});

// PUT /api/clientes/:id (admin/cajero)
router.put("/:id", authMiddleware, hasRole(["admin", "cajero"]), async (req, res) => {
  const cliente = await Cliente.findByPk(req.params.id);
  if (!cliente) return res.status(404).json({ message: "Cliente no encontrado" });
  const { nombre, apellido, telefono, email, documento } = req.body;
  await cliente.update({
    nombre: nombre ?? cliente.nombre,
    apellido: apellido ?? cliente.apellido,
    telefono: telefono ?? cliente.telefono,
    email: email ?? cliente.email,
    documento: documento ?? cliente.documento,
  });
  res.json(cliente);
});

export default router;
