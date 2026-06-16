import { sequelize, DataTypes } from "../database.js";

// Tarifas por tipo de pase, condición del visitante y temporada.
const Tarifa = sequelize.define(
  "Tarifa",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tipo: {
      type: DataTypes.ENUM("pase_dia", "pase_pileta", "quincho", "acampe"),
      allowNull: false,
    },
    descripcion: { type: DataTypes.STRING, allowNull: false },
    precio: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    condicion: {
      type: DataTypes.ENUM("general", "residente", "jubilado"),
      allowNull: false,
      defaultValue: "general",
    },
    temporada: {
      type: DataTypes.ENUM("alta", "baja", "todo_el_anio"),
      allowNull: false,
      defaultValue: "todo_el_anio",
    },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: "tarifas", freezeTableName: true, timestamps: true }
);

export default Tarifa;
