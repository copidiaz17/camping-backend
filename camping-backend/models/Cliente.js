import { sequelize, DataTypes } from "../database.js";

// Visitante que hace la reserva. Datos mínimos para enviarle el QR.
const Cliente = sequelize.define(
  "Cliente",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING, allowNull: false },
    apellido: { type: DataTypes.STRING, allowNull: true },
    telefono: { type: DataTypes.STRING, allowNull: true }, // WhatsApp
    email: { type: DataTypes.STRING, allowNull: true },
    documento: { type: DataTypes.STRING, allowNull: true },
    // Cuenta de visitante (web pública). null = cliente cargado por el personal, sin login.
    password: { type: DataTypes.STRING, allowNull: true },
  },
  { tableName: "clientes", freezeTableName: true, timestamps: true }
);

export default Cliente;
