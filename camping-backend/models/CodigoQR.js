import { sequelize, DataTypes } from "../database.js";

// Código QR de una reserva. Token único, con cupo y vencimiento.
// El guardia lo escanea en la entrada; cada ingreso descuenta del cupo.
// estado: activo | agotado | vencido | anulado
const CodigoQR = sequelize.define(
  "CodigoQR",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reserva_id: { type: DataTypes.INTEGER, allowNull: false },
    token: { type: DataTypes.STRING, allowNull: false, unique: true },
    cupo_total: { type: DataTypes.INTEGER, allowNull: false },
    cupo_usado: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    vencimiento_fecha: { type: DataTypes.DATEONLY, allowNull: false },
    hora_desde: { type: DataTypes.TIME, allowNull: true }, // null = sin restricción horaria
    hora_hasta: { type: DataTypes.TIME, allowNull: true },
    estado: {
      type: DataTypes.ENUM("activo", "agotado", "vencido", "anulado"),
      allowNull: false,
      defaultValue: "activo",
    },
  },
  { tableName: "codigos_qr", freezeTableName: true, timestamps: true }
);

export default CodigoQR;
