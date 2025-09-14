CREATE DATABASE IF NOT EXISTS barberpro;
USE barberpro;

CREATE TABLE Professionals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    specialties VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(255) NOT NULL,
    instagram VARCHAR(255),
    address VARCHAR(255),
    bio TEXT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME NOT NULL
);

CREATE TABLE Clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME NOT NULL
);

CREATE TABLE Photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(255) NOT NULL,
    ProfessionalId INT,
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME NOT NULL,
    CONSTRAINT fk_professional FOREIGN KEY (ProfessionalId) REFERENCES Professionals(id) ON DELETE CASCADE
);

ALTER TABLE Professionals ADD COLUMN profession VARCHAR(255) NOT NULL;