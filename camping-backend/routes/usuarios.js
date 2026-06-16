import express from "express";
import bcrypt from "bcryptjs";
import Usuario from "../models/Usuario.js";
import { authMiddleware } from "./auth.js";
import { hasRole } from "../middlewares/authorization.js";

const router = express.Router();

const ROLES = ["admin", "cajero", "guardia", "guardavidas", "municipalidad"];
const MIN_PASS = 6;

// Datos públicos del usuario (sin password)
const sinPass = (u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo });

// Todas las rutas: solo admin
router.use(authMiddleware, hasRole(["admin"]));

// GET /api/usuarios — lista del personal
router.get("/", async (req, res) => {
  const usuarios = await Usuario.findAll({ order: [["activo", "DESC"], ["nombre", "ASC"]] });
  res.json(usuarios.map(sinPass));
});

// POST /api/usuarios — crear personal
router.post("/", async (req, res) => {
  try {
    const { nombre, email, password, rol = "cajero" } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ message: "Faltan nombre, email o contraseña" });
    if (!ROLES.includes(rol)) return res.status(400).json({ message: "Rol inválido" });
    if (String(password).length < MIN_PASS) return res.status(400).json({ message: `La contraseña debe tener al menos ${MIN_PASS} caracteres` });

    const existe = await Usuario.findOne({ where: { email } });
    if (existe) return res.status(409).json({ message: "Ya existe un usuario con ese email" });

    const hash = await bcrypt.hash(String(password), 10);
    const usuario = await Usuario.create({ nombre, email, password: hash, rol });
    res.status(201).json(sinPass(usuario));
  } catch (err) {
    console.error("Error creando usuario:", err);
    res.status(500).json({ message: "Error al crear el usuario" });
  }
});

// PUT /api/usuarios/:id — editar (nombre, email, rol, activo; password opcional)
router.put("/:id", async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });

    const { nombre, email, rol, activo, password } = req.body;
    if (rol && !ROLES.includes(rol)) return res.status(400).json({ message: "Rol inválido" });

    // No permitir que el admin se quite a sí mismo el rol admin o se desactive
    if (usuario.id === req.user.id && (activo === false || (rol && rol !== "admin"))) {
      return res.status(400).json({ message: "No podés desactivarte ni quitarte el rol admin a vos mismo" });
    }

    if (email && email !== usuario.email) {
      const existe = await Usuario.findOne({ where: { email } });
      if (existe) return res.status(409).json({ message: "Ya existe un usuario con ese email" });
    }

    const cambios = {
      nombre: nombre ?? usuario.nombre,
      email: email ?? usuario.email,
      rol: rol ?? usuario.rol,
      activo: activo ?? usuario.activo,
    };
    if (password) {
      if (String(password).length < MIN_PASS) return res.status(400).json({ message: `La contraseña debe tener al menos ${MIN_PASS} caracteres` });
      cambios.password = await bcrypt.hash(String(password), 10);
    }
    await usuario.update(cambios);
    res.json(sinPass(usuario));
  } catch (err) {
    console.error("Error editando usuario:", err);
    res.status(500).json({ message: "Error al editar el usuario" });
  }
});

// DELETE /api/usuarios/:id — baja lógica (activo = false)
router.delete("/:id", async (req, res) => {
  const usuario = await Usuario.findByPk(req.params.id);
  if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });
  if (usuario.id === req.user.id) return res.status(400).json({ message: "No podés desactivarte a vos mismo" });
  await usuario.update({ activo: false });
  res.json({ ok: true, message: "Usuario desactivado" });
});

export default router;
