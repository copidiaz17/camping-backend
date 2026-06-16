import { sequelize, DataTypes } from "../database.js";

// Turno de caja: se abre con un monto inicial y se cierra con arqueo.
// estado: abierta | cerrada
const Caja = sequelize.define(
  "Caja",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    monto_inicial: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    // Se completan al cerrar:
    monto_esperado_efectivo: { type: DataTypes.DECIMAL(12, 2), allowNull: true }, // lo que debería haber en efectivo
    monto_declarado: { type: DataTypes.DECIMAL(12, 2), allowNull: true }, // lo que el cajero contó
    diferencia: { type: DataTypes.DECIMAL(12, 2), allowNull: true }, // declarado - esperado
    estado: { type: DataTypes.ENUM("abierta", "cerrada"), allowNull: false, defaultValue: "abierta" },
    fecha_cierre: { type: DataTypes.DATE, allowNull: true },
    abierta_por_id: { type: DataTypes.INTEGER, allowNull: true },
    cerrada_por_id: { type: DataTypes.INTEGER, allowNull: true },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: "cajas", freezeTableName: true, timestamps: true }
);

export default Caja;
