import { sequelize, DataTypes } from "../database.js";

// Vehículos (estacionamiento) sumados a una reserva. Puede haber varios por reserva.
// Guarda el precio congelado al momento de reservar (incluye recargo si corresponde).
const ReservaVehiculo = sequelize.define(
  "ReservaVehiculo",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reserva_id: { type: DataTypes.INTEGER, allowNull: false },
    tipo: { type: DataTypes.STRING(40), allowNull: false }, // clave de tarifa, ej: veh_automovil
    descripcion: { type: DataTypes.STRING, allowNull: false }, // ej: "Automóvil"
    precio: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }, // precio final aplicado (con recargo)
  },
  { tableName: "reservas_vehiculos", freezeTableName: true, timestamps: true }
);

export default ReservaVehiculo;
