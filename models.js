require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: process.env.DB_DIALECT,
    logging: false
  }
);

// Modelo Professional
const Professional = sequelize.define('Professional', {
  name: { type: DataTypes.STRING, allowNull: false },
  profession: { type: DataTypes.STRING, allowNull: false },
  specialties: { type: DataTypes.STRING, allowNull: false },
  whatsapp: { type: DataTypes.STRING, allowNull: false },
  instagram: { type: DataTypes.STRING },
  address: { type: DataTypes.STRING },
  bio: { type: DataTypes.TEXT },
  profilePhoto: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false }
}, { timestamps: true });

// Modelo Photo
const Photo = sequelize.define('Photo', {
  url: { type: DataTypes.STRING, allowNull: false }
}, { timestamps: true });

Professional.hasMany(Photo, { as: 'photos' });
Photo.belongsTo(Professional);

// Modelo Client
const Client = sequelize.define('Client', {
  name: { type: DataTypes.STRING, allowNull: false },
  whatsapp: { type: DataTypes.STRING, allowNull: false },
  profilePhoto: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false }
}, { timestamps: true });

module.exports = { sequelize, Professional, Photo, Client };