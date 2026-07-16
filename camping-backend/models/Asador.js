import { sequelize, DataTypes } from "../database.js";

// Cada asador individual del camping (16 en total). Reservable como tipo propio ($5.000).
const Asador = sequelize.define(
  "Asador",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING, allowNull: false }, // ej: "Asador 1"
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: "asadores", freezeTableName: true, timestamps: true }
);

export default Asador;
