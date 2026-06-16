import { sequelize, DataTypes } from "../database.js";

// Reserva con cupo. De acá salen los códigos QR (un cupo total que se reparte).
// estado:      pendiente | confirmada | cancelada
// estado_pago: pendiente | pagado
const Reserva = sequelize.define(
  "Reserva",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    numero: { type: DataTypes.STRING, allowNull: false, unique: true },
    tipo: {
      type: DataTypes.ENUM("pase_dia", "pase_pileta", "quincho", "acampe"),
      allowNull: false,
    },
    zona_id: { type: DataTypes.INTEGER, allowNull: false },
    quincho_id: { type: DataTypes.INTEGER, allowNull: true }, // solo si tipo = quincho
    cliente_id: { type: DataTypes.INTEGER, allowNull: false },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    cantidad_personas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    cupo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }, // lugares totales que admite la reserva
    monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    estado: {
      type: DataTypes.ENUM("pendiente", "confirmada", "cancelada"),
      allowNull: false,
      defaultValue: "pendiente",
    },
    estado_pago: {
      type: DataTypes.ENUM("pendiente", "pagado"),
      allowNull: false,
      defaultValue: "pendiente",
    },
    creado_por_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "reservas", freezeTableName: true, timestamps: true }
);

export default Reserva;
