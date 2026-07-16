// Relaciones entre modelos. Se importa una sola vez (desde server.js).
import Usuario from "./Usuario.js";
import Zona from "./Zona.js";
import Quincho from "./Quincho.js";
import Asador from "./Asador.js";
import Cliente from "./Cliente.js";
import Reserva from "./Reserva.js";
import ReservaItem from "./ReservaItem.js";
import ReservaVehiculo from "./ReservaVehiculo.js";
import CodigoQR from "./CodigoQR.js";
import Ingreso from "./Ingreso.js";
import Caja from "./Caja.js";
import MovimientoCaja from "./MovimientoCaja.js";

// Reserva ↔ Cliente
Cliente.hasMany(Reserva, { foreignKey: "cliente_id", as: "reservas" });
Reserva.belongsTo(Cliente, { foreignKey: "cliente_id", as: "cliente" });

// Reserva ↔ Zona
Zona.hasMany(Reserva, { foreignKey: "zona_id", as: "reservas" });
Reserva.belongsTo(Zona, { foreignKey: "zona_id", as: "zona" });

// Reserva ↔ Quincho (opcional)
Quincho.hasMany(Reserva, { foreignKey: "quincho_id", as: "reservas" });
Reserva.belongsTo(Quincho, { foreignKey: "quincho_id", as: "quincho" });

// Reserva ↔ Asador (opcional)
Asador.hasMany(Reserva, { foreignKey: "asador_id", as: "reservas" });
Reserva.belongsTo(Asador, { foreignKey: "asador_id", as: "asador" });

// Reserva ↔ ReservaVehiculo (estacionamiento, varios por reserva)
Reserva.hasMany(ReservaVehiculo, { foreignKey: "reserva_id", as: "vehiculos" });
ReservaVehiculo.belongsTo(Reserva, { foreignKey: "reserva_id", as: "reserva" });

// Reserva ↔ ReservaItem (conceptos: quincho + pileta + ...)
Reserva.hasMany(ReservaItem, { foreignKey: "reserva_id", as: "items" });
ReservaItem.belongsTo(Reserva, { foreignKey: "reserva_id", as: "reserva" });
ReservaItem.belongsTo(Zona, { foreignKey: "zona_id", as: "zona" });
ReservaItem.belongsTo(Quincho, { foreignKey: "quincho_id", as: "quincho" });
ReservaItem.belongsTo(Asador, { foreignKey: "asador_id", as: "asador" });

// Ingreso ↔ ReservaItem (a qué concepto se descontó el cupo)
ReservaItem.hasMany(Ingreso, { foreignKey: "reserva_item_id", as: "ingresos" });
Ingreso.belongsTo(ReservaItem, { foreignKey: "reserva_item_id", as: "item" });

// Reserva ↔ Usuario que la creó
Usuario.hasMany(Reserva, { foreignKey: "creado_por_id", as: "reservasCreadas" });
Reserva.belongsTo(Usuario, { foreignKey: "creado_por_id", as: "creadoPor" });

// Reserva ↔ CodigoQR (una reserva confirmada genera su QR)
Reserva.hasMany(CodigoQR, { foreignKey: "reserva_id", as: "codigosQR" });
CodigoQR.belongsTo(Reserva, { foreignKey: "reserva_id", as: "reserva" });

// CodigoQR ↔ Ingreso (cada escaneo descuenta del cupo del QR)
CodigoQR.hasMany(Ingreso, { foreignKey: "codigo_qr_id", as: "ingresos" });
Ingreso.belongsTo(CodigoQR, { foreignKey: "codigo_qr_id", as: "codigoQR" });

// Reserva ↔ Ingreso (los ingresos de una reserva)
Reserva.hasMany(Ingreso, { foreignKey: "reserva_id", as: "ingresos" });
Ingreso.belongsTo(Reserva, { foreignKey: "reserva_id", as: "reserva" });

// Ingreso ↔ Usuario que lo registró (guardia)
Usuario.hasMany(Ingreso, { foreignKey: "registrado_por_id", as: "ingresosRegistrados" });
Ingreso.belongsTo(Usuario, { foreignKey: "registrado_por_id", as: "registradoPor" });

// Caja ↔ MovimientoCaja
Caja.hasMany(MovimientoCaja, { foreignKey: "caja_id", as: "movimientos" });
MovimientoCaja.belongsTo(Caja, { foreignKey: "caja_id", as: "caja" });

// MovimientoCaja ↔ Reserva (opcional)
Reserva.hasMany(MovimientoCaja, { foreignKey: "reserva_id", as: "movimientos" });
MovimientoCaja.belongsTo(Reserva, { foreignKey: "reserva_id", as: "reserva" });

// Caja / MovimientoCaja ↔ Usuario
Usuario.hasMany(Caja, { foreignKey: "abierta_por_id", as: "cajasAbiertas" });
Caja.belongsTo(Usuario, { foreignKey: "abierta_por_id", as: "abiertaPor" });
Caja.belongsTo(Usuario, { foreignKey: "cerrada_por_id", as: "cerradaPor" });
MovimientoCaja.belongsTo(Usuario, { foreignKey: "registrado_por_id", as: "registradoPor" });

console.log("✅ Asociaciones definidas");

export { Usuario, Zona, Quincho, Asador, Cliente, Reserva, ReservaItem, ReservaVehiculo, CodigoQR, Ingreso, Caja, MovimientoCaja };
