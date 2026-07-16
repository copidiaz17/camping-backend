import express from "express";
import Asador from "../models/Asador.js";
import { authMiddleware } from "./auth.js";

const router = express.Router();

// GET /api/asadores  (personal) — lista de asadores activos
router.get("/", authMiddleware, async (req, res) => {
  const asadores = await Asador.findAll({ where: { activo: true }, order: [["id", "ASC"]] });
  res.json(asadores);
});

export default router;
