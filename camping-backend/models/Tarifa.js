import { sequelize, DataTypes } from "../database.js";

// Tarifas por tipo de pase, condición del visitante y temporada.
const Tarifa = sequelize.define(
  "Tarifa",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    // Clave del precio (catálogo). Ej: quincho_grande, quincho_mediano, acampe, asador,
    // pileta_nino, pileta_adulto, veh_camion, veh_automovil, ..., recargo_finde
    tipo: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    // Agrupa el precio para la UI/admin: reserva | vehiculo | recargo
    categoria: {
      type: DataTypes.ENUM("reserva", "vehiculo", "recargo"),
      allowNull: false,
      defaultValue: "reserva",
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
