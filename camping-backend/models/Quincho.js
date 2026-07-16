import { sequelize, DataTypes } from "../database.js";

// Cada quincho individual del camping (ej: "Quincho 1", capacidad 50).
const Quincho = sequelize.define(
  "Quincho",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING, allowNull: false },
    // grande (50 pers, $52.000) | mediano (30 pers, $36.400) — define el precio (tarifa quincho_<tamano>)
    tamano: { type: DataTypes.ENUM("grande", "mediano"), allowNull: false, defaultValue: "grande" },
    capacidad: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
    descripcion: { type: DataTypes.STRING, allowNull: true }, // ej: "parrilla, mesas, sombra"
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: "quinchos", freezeTableName: true, timestamps: true }
);

export default Quincho;
