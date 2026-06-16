import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Usuario from "../models/Usuario.js";

const router = express.Router();

// Middleware: valida el token JWT y carga req.user
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Falta el token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, nombre, rol }
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido o vencido" });
  }
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const usuario = await Usuario.findOne({ where: { email } });
    if (!usuario || !usuario.activo) {
      return res.status(400).json({ message: "Usuario o contraseña incorrectos" });
    }
    const ok = await bcrypt.compare(password, usuario.password);
    if (!ok) return res.status(400).json({ message: "Usuario o contraseña incorrectos" });

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );
    res.json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ message: "Error al iniciar sesión" });
  }
});

// GET /api/auth/me — datos del usuario logueado
router.get("/me", authMiddleware, async (req, res) => {
  const usuario = await Usuario.findByPk(req.user.id, {
    attributes: ["id", "nombre", "email", "rol"],
  });
  if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });
  res.json(usuario);
});

export default router;
