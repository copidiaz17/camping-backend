import { sequelize, DataTypes } from "../database.js";

// Cada escaneo válido de un QR en la entrada del camping.
// Descuenta del cupo del código QR y queda registrado (quién entró, cuántos, cuándo, qué guardia).
const Ingreso = sequelize.define(
  "Ingreso",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reserva_id: { type: DataTypes.INTEGER, allowNull: false },
    codigo_qr_id: { type: DataTypes.INTEGER, allowNull: false },
    cantidad_personas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    registrado_por_id: { type: DataTypes.INTEGER, allowNull: true }, // guardia que escaneó
  },
  { tableName: "ingresos", freezeTableName: true, timestamps: true }
);

export default Ingreso;
