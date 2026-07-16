import { sequelize, DataTypes } from "../database.js";

// Feriados cargados por el admin (se corren según el año). Los sábados y domingos
// se detectan automáticamente; estas fechas son los feriados extra con recargo.
const Feriado = sequelize.define(
  "Feriado",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fecha: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
    descripcion: { type: DataTypes.STRING, allowNull: true },
  },
  { tableName: "feriados", freezeTableName: true, timestamps: true }
);

export default Feriado;
