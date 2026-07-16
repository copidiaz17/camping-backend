import { sequelize, DataTypes } from "../database.js";

// Cada concepto dentro de una reserva (una reserva puede combinar varios: quincho + pileta, etc.).
// El CUPO se controla por ítem: cada concepto tiene su propio cupo que se descuenta al ingresar.
const ReservaItem = sequelize.define(
  "ReservaItem",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reserva_id: { type: DataTypes.INTEGER, allowNull: false },
    tipo: { type: DataTypes.STRING(20), allowNull: false }, // quincho | acampe | asador | pileta
    zona_id: { type: DataTypes.INTEGER, allowNull: false },
    quincho_id: { type: DataTypes.INTEGER, allowNull: true },
    asador_id: { type: DataTypes.INTEGER, allowNull: true },
    cantidad_personas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    cantidad_ninos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    cantidad_adultos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    cupo_total: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    cupo_usado: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    base_monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }, // sin recargo
    recargo: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }, // con recargo
  },
  { tableName: "reserva_items", freezeTableName: true, timestamps: true }
);

export default ReservaItem;
