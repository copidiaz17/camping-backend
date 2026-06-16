import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sequelize } from "./database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Modelos (se importan para que Sequelize los registre)
import "./models/Usuario.js";
import "./models/Zona.js";
import "./models/Quincho.js";
import "./models/Tarifa.js";
import "./models/Cliente.js";
import "./models/Reserva.js";
import "./models/CodigoQR.js";
import "./models/Ingreso.js";
import "./models/Caja.js";
import "./models/MovimientoCaja.js";
import "./models/Associations.js"; // define las relaciones entre tablas

// Rutas
import authRoutes from "./routes/auth.js";
import zonasRoutes from "./routes/zonas.js";
import quinchosRoutes from "./routes/quinchos.js";
import tarifasRoutes from "./routes/tarifas.js";
import clientesRoutes from "./routes/clientes.js";
import reservasRoutes from "./routes/reservas.js";
import ingresosRoutes from "./routes/ingresos.js";
import qrRoutes from "./routes/qr.js";
import cajaRoutes from "./routes/caja.js";
import publicoRoutes from "./routes/publico.js";
import puertaRoutes from "./routes/puerta.js";
import usuariosRoutes from "./routes/usuarios.js";
import reportesRoutes from "./routes/reportes.js";

dotenv.config();
const app = express();

// ── Seguridad (helmet) ──
// CSP/COEP desactivados: el backend sirve la web y el panel con scripts inline + recursos externos (mapa, fuentes, CDN)
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// ── CORS ──
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (/^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
      if (origin === FRONTEND_URL) return cb(null, true);
      return cb(new Error(`CORS bloqueado para origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));

// Límite estricto contra fuerza bruta en login/registro (20 intentos por 15 min)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Demasiados intentos. Esperá unos minutos e intentá de nuevo." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/login", loginLimiter);
app.use("/api/publico/login", loginLimiter);
app.use("/api/publico/registro", loginLimiter);

// Healthcheck
app.get("/api/health", (req, res) => res.json({ ok: true, servicio: "camping-backend" }));

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/zonas", zonasRoutes);
app.use("/api/quinchos", quinchosRoutes);
app.use("/api/tarifas", tarifasRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/reservas", reservasRoutes);
app.use("/api/ingresos", ingresosRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/caja", cajaRoutes);
app.use("/api/publico", publicoRoutes);
app.use("/api/puerta", puertaRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/reportes", reportesRoutes);

// ── Frontends (monolito): el backend sirve la web pública y el panel interno ──
const webDir = path.join(__dirname, "../camping-web");
const panelDir = path.join(__dirname, "../camping-frontend/dist");

// Panel interno del personal en /panel (SPA Vue con history fallback)
app.use("/panel", express.static(panelDir));
app.get("/panel/*", (req, res) => res.sendFile(path.join(panelDir, "index.html")));

// Web pública en la raíz
app.use("/", express.static(webDir));

const PORT = process.env.PORT || 3002;

(async () => {
  try {
    console.log("🔍 Iniciando Camping Las Casuarinas — backend");
    console.log("   NODE_ENV:", process.env.NODE_ENV);
    console.log("   DB:", process.env.DB_NAME, "@", process.env.DB_HOST);

    await sequelize.authenticate();
    console.log("✅ Conexión a la base de datos OK");

    await sequelize.sync(); // crea/actualiza tablas
    console.log("✅ Tablas sincronizadas");

    app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
  } catch (err) {
    console.error("⛔ Error al iniciar:", err.message);
    process.exit(1);
  }
})();
