import { sequelize, DataTypes } from "../database.js";

// Cada cobro o egreso de un turno de caja.
// tipo: ingreso (entra plata) | egreso (sale plata)
// metodo_pago: efectivo | transferencia | mercadopago
const MovimientoCaja = sequelize.define(
  "MovimientoCaja",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    caja_id: { type: DataTypes.INTEGER, allowNull: false },
    tipo: { type: DataTypes.ENUM("ingreso", "egreso"), allowNull: false, defaultValue: "ingreso" },
    concepto: { type: DataTypes.STRING, allowNull: false },
    metodo_pago: {
      type: DataTypes.ENUM("efectivo", "transferencia", "mercadopago"),
      allowNull: false,
      defaultValue: "efectivo",
    },
    monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    reserva_id: { type: DataTypes.INTEGER, allowNull: true }, // si el cobro corresponde a una reserva
    registrado_por_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "movimientos_caja", freezeTableName: true, timestamps: true }
);

export default MovimientoCaja;
