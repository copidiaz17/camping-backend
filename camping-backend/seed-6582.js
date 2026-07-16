// Seed de la Ordenanza N° 6582/25 (Art. 110) — Camping Las Casuarinas
// Uso: node seed-6582.js   (idempotente: se puede correr más de una vez)
import "dotenv/config";
import { sequelize } from "./database.js";
import "./models/Usuario.js";
import "./models/Zona.js";
import "./models/Quincho.js";
import "./models/Asador.js";
import "./models/Tarifa.js";
import "./models/Cliente.js";
import "./models/Reserva.js";
import "./models/ReservaVehiculo.js";
import "./models/Feriado.js";
import "./models/CodigoQR.js";
import "./models/Ingreso.js";
import "./models/Caja.js";
import "./models/MovimientoCaja.js";
import "./models/Associations.js";
import { seed6582 } from "./utils/seed6582.js";

async function run() {
  await sequelize.authenticate();
  console.log("✅ DB conectada:", process.env.DB_NAME, "@", process.env.DB_HOST);
  await sequelize.sync();
  await seed6582();
  console.log("🎉 Seed 6582 completo (tarifas, 10 quinchos, 16 asadores, zonas, feriados 2026)");
  await sequelize.close();
  process.exit(0);
}

run().catch((e) => {
  console.error("⛔ Error en seed:", e);
  process.exit(1);
});
