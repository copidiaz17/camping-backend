import { sequelize, DataTypes } from "../database.js";

// Roles: admin | cajero | guardia | guardavidas | municipalidad (solo lectura)
const Usuario = sequelize.define(
  "Usuario",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    rol: {
      type: DataTypes.ENUM("admin", "cajero", "guardia", "guardavidas", "municipalidad"),
      allowNull: false,
      defaultValue: "cajero",
    },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: "usuarios", freezeTableName: true, timestamps: true }
);

export default Usuario;
