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
import "./models/Asador.js";
import "./models/Tarifa.js";
import "./models/Cliente.js";
import "./models/Reserva.js";
import "./models/ReservaItem.js";
import "./models/ReservaVehiculo.js";
import "./models/Feriado.js";
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
import feriadosRoutes from "./routes/feriados.js";
import asadoresRoutes from "./routes/asadores.js";

dotenv.config();

// Chequeo de arranque: sin JWT_SECRET no se pueden firmar sesiones de forma segura.
if (!process.env.JWT_SECRET) {
  console.error("⛔ Falta JWT_SECRET. Definí uno largo y aleatorio en el entorno.");
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 16) {
  console.warn("⚠️ JWT_SECRET es corto (<16 caracteres). Recomendado: cadena larga y aleatoria.");
}

const app = express();

// ── Seguridad (helmet) ──
// CSP/COEP desactivados: el backend sirve la web y el panel con scripts inline + recursos externos (mapa, fuentes, CDN)
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// ── CORS ──
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl / health / server-to-server
      if (/^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true); // dev
      if (origin === FRONTEND_URL) return cb(null, true);
      if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin)) return cb(null, true); // monolito en prod (web y API mismo dominio)
      return cb(null, false); // resto: sin headers CORS, pero NUNCA tirar 500
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300, // generoso: una demo con varias personas en la misma WiFi comparte IP
  message: { message: "Muchas solicitudes seguidas. Esperá unos segundos e intentá de nuevo." },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Límite estricto contra fuerza bruta en login/registro (60 intentos por 15 min)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60, // varias personas registrándose desde la misma red comparten IP
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
app.use("/api/feriados", feriadosRoutes);
app.use("/api/asadores", asadoresRoutes);

// ── Handler global de errores para /api: nunca devolver HTML, siempre JSON con el motivo ──
app.use("/api", (err, req, res, next) => {
  console.error("🔥 Error no controlado en", req.method, req.originalUrl, "->", err?.stack || err);
  if (res.headersSent) return next(err);
  const status = err?.status || 500;
  // No filtrar detalles internos al cliente: en 500 va mensaje genérico, el detalle queda en los logs.
  const message = status < 500 ? (err?.message || "Solicitud inválida") : "Error del servidor. Probá de nuevo en un momento.";
  res.status(status).json({ message });
});

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

    // ── Migraciones idempotentes (Ordenanza 6582/25): columnas nuevas y ENUM→VARCHAR ──
    const migraciones = [
      "ALTER TABLE tarifas MODIFY COLUMN tipo VARCHAR(40) NOT NULL",
      "ALTER TABLE tarifas ADD COLUMN categoria ENUM('reserva','vehiculo','recargo') NOT NULL DEFAULT 'reserva'",
      "ALTER TABLE reservas MODIFY COLUMN tipo VARCHAR(20) NOT NULL",
      "ALTER TABLE reservas ADD COLUMN asador_id INT NULL",
      "ALTER TABLE reservas ADD COLUMN cantidad_ninos INT NOT NULL DEFAULT 0",
      "ALTER TABLE reservas ADD COLUMN cantidad_adultos INT NOT NULL DEFAULT 0",
      "ALTER TABLE reservas ADD COLUMN recargo DECIMAL(12,2) NOT NULL DEFAULT 0",
      "ALTER TABLE reservas ADD COLUMN monto_estacionamiento DECIMAL(12,2) NOT NULL DEFAULT 0",
      "ALTER TABLE quinchos ADD COLUMN tamano ENUM('grande','mediano') NOT NULL DEFAULT 'grande'",
      "ALTER TABLE ingresos ADD COLUMN reserva_item_id INT NULL",
      // Desactiva tarifas viejas (pase_dia, pase_pileta, quincho suelto) que no son del cuadro 6582
      "UPDATE tarifas SET activo = 0 WHERE tipo NOT IN ('quincho_grande','quincho_mediano','acampe','asador','pileta_nino','pileta_adulto','veh_camion','veh_motorhome','veh_casa_rodante','veh_automovil','veh_motocicleta','veh_moto_agua','recargo_finde')",
    ];
    for (const sql of migraciones) {
      try {
        await sequelize.query(sql);
      } catch (e) {
        // Ignora si la columna ya existe (ER_DUP_FIELDNAME) — la migración ya corrió
        if (e.original?.errno !== 1060 && !/duplicate column/i.test(e.message)) {
          console.warn("⚠️ Migración:", sql.slice(0, 60), "→", e.message);
        }
      }
    }
    console.log("✅ Migraciones 6582 aplicadas");

    // ── Seed inicial 6582 (una sola vez, si los precios nuevos no existen todavía) ──
    try {
      const Tarifa = (await import("./models/Tarifa.js")).default;
      const yaCargado = await Tarifa.findOne({ where: { tipo: "quincho_grande" } });
      if (!yaCargado) {
        const { seed6582 } = await import("./utils/seed6582.js");
        await seed6582();
        console.log("✅ Seed 6582 inicial cargado (tarifas, quinchos, asadores, zonas, feriados)");
      }
    } catch (e) {
      console.warn("⚠️ Seed 6582 inicial:", e.message);
    }

    app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
  } catch (err) {
    console.error("⛔ Error al iniciar:", err.message);
    process.exit(1);
  }
})();
