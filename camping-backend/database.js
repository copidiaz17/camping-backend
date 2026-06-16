import { Sequelize, DataTypes } from "sequelize";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const isProduction = process.env.NODE_ENV === "production";

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    dialect: "mysql",
    logging: false,
    dialectOptions: isProduction
      ? { ssl: { require: true, rejectUnauthorized: false }, connectTimeout: 30000 }
      : { connectTimeout: 30000 },
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  }
);

export { sequelize, DataTypes };
