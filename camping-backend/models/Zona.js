import { sequelize, DataTypes } from "../database.js";

// Zonas de control del predio. Cada una con su color de pulsera y aforo máximo.
// Ej: Quincho (rojo), Pileta (verde), Acampe (azul). El estacionamiento NO es zona de control.
const Zona = sequelize.define(
  "Zona",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING, allowNull: false },
    color: { type: DataTypes.STRING, allowNull: false }, // hex de la pulsera, ej: "#e23b3b"
    aforo_max: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // 0 = sin tope
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: "zonas", freezeTableName: true, timestamps: true }
);

export default Zona;
