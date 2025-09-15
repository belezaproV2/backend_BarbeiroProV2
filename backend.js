const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sequelize, Professional, Photo, Client } = require('./models');
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || "barberprosecret";
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = ['https://click-beatiful.netlify.app'];
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

/* ==============================
   Configuração do Multer
   ============================== */

// Storage para PROFISSIONAIS
const storageProfessional = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads', 'professionals', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// Storage para CLIENTES
const storageClient = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads', 'clients', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// Middlewares de upload
const uploadProfessionalProfile = multer({ 
  storage: storageProfessional, 
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

const uploadProfessionalPhotos = multer({ 
  storage: storageProfessional, 
  limits: { fileSize: 10 * 1024 * 1024, files: 6 }
});

const uploadClientProfile = multer({ 
  storage: storageClient, 
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

/* ==============================
   Middleware JWT
   ============================== */
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Token ausente" });
  const token = auth.split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

/* ==============================
   Rotas PROFISSIONAIS
   ============================== */

// GET /professionals (lista todos profissionais, exige token)
app.get('/professionals', authMiddleware, async (req, res) => {
  try {
    const professionals = await Professional.findAll({
      include: {
        model: Photo,
        as: 'photos',
        attributes: ['url']
      }
    });
    res.json(professionals.map(p => ({
      id: p.id,
      name: p.name,
      profession: p.profession,
      specialties: p.specialties,
      whatsapp: p.whatsapp,
      instagram: p.instagram,
      address: p.address,
      bio: p.bio,
      profilePhoto: p.profilePhoto,
      photos: (p.photos || []).map(photo => ({ url: photo.url }))
    })));
  } catch (err) {
    console.error("Erro ao buscar profissionais:", err);
    res.status(500).json({ error: 'Erro ao buscar profissionais.' });
  }
});

// GET /professionals/:id
app.get('/professionals/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const profissional = await Professional.findByPk(id, {
    include: { model: Photo, as: 'photos', attributes: ['url'] }
  });
  if (!profissional) return res.status(404).json({ error: "Profissional não encontrado" });
  res.json({
    id: profissional.id,
    name: profissional.name,
    profession: profissional.profession,
    specialties: profissional.specialties,
    whatsapp: profissional.whatsapp,
    instagram: profissional.instagram,
    address: profissional.address,
    bio: profissional.bio,
    profilePhoto: profissional.profilePhoto,
    photos: (profissional.photos || []).map(photo => ({ url: photo.url }))
  });
});

// POST /auth/register-professional
app.post('/auth/register-professional', async (req, res) => {
  const { name, profession, specialties, whatsapp, instagram, address, bio, email, password } = req.body;
  if (!name || !profession || !specialties || !whatsapp || !email || !password) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    const profissional = await Professional.create({
      name, profession, specialties, whatsapp, instagram, address, bio, email, password: hashed, updatedAt: new Date()
    });
    const token = jwt.sign({ id: profissional.id, type: 'professional' }, SECRET, { expiresIn: '2h' });
    res.json({ profissional, token });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'E-mail já cadastrado. Faça login ou use outro e-mail.' });
    }
    console.error("Erro ao cadastrar o profisional:", err);
    res.status(500).json({ error: 'Erro ao criar profissional.' });
  }
});

// Upload foto de perfil do profissional
app.post('/professionals/:id/profile-photo', authMiddleware, uploadProfessionalProfile.single('profilePhoto'), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'Nenhuma foto enviada.' });
  const url = `/uploads/professionals/${id}/${req.file.filename}`;
  await Professional.update({ profilePhoto: url }, { where: { id } });
  res.json({ profilePhoto: url });
});

// POST /auth/login-professional
app.post('/auth/login-professional', async (req, res) => {
  const { email, password } = req.body;
  const profissional = await Professional.findOne({ where: { email } });
  if (!profissional || !(await bcrypt.compare(password, profissional.password))) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }
  const token = jwt.sign({ id: profissional.id, type: 'professional' }, SECRET, { expiresIn: '2h' });
  res.json({ profissional, token });
});

// POST /professionals/:id/photos
app.post('/professionals/:id/photos', authMiddleware, uploadProfessionalPhotos.array('photos', 6), async (req, res) => {
  const { id } = req.params;
  try {
    const prof = await Professional.findByPk(id, { include: { model: Photo, as: 'photos' } });
    if (!prof) return res.status(404).json({ error: 'Profissional não encontrado.' });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhuma foto enviada.' });
    }
    const existingCount = await Photo.count({ where: { ProfessionalId: id } });
    if (existingCount + req.files.length > 6) {
      return res.status(400).json({ error: 'Máximo de 6 fotos por profissional.' });
    }
    const urls = req.files.map(f => `/uploads/professionals/${id}/${f.filename}`);
    await Promise.all(urls.map(url => Photo.create({ url, ProfessionalId: id })));
    const allPhotos = await Photo.findAll({ where: { ProfessionalId: id } });
    res.json({ photoUrls: allPhotos.map(photo => photo.url) });
  } catch (err) {
    console.error("Erro ao fazer uploads das fotos", err);
    res.status(500).json({ error: 'Erro ao fazer upload das fotos.' });
  }
});

/* ==============================
   Rotas CLIENTES
   ============================== */

// POST /auth/register-client
app.post('/auth/register-client', async (req, res) => {
  const { name, whatsapp, email, password } = req.body;
  if (!name || !whatsapp || !email || !password) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    const newClient = await Client.create({ name, whatsapp, email, password: hashed, updatedAt: new Date() });
    const token = jwt.sign({ id: newClient.id, type: 'client' }, SECRET, { expiresIn: '2h' });
    res.status(201).json({ cliente: newClient, token });
  } catch (err) {
    console.error("Erro ao criar cliente:", err);
    res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
  }
});

// Upload foto de perfil do cliente
app.post('/clients/:id/profile-photo', authMiddleware, uploadClientProfile.single('profilePhoto'), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'Nenhuma foto enviada.' });
  const url = `/uploads/clients/${id}/${req.file.filename}`;
  await Client.update({ profilePhoto: url }, { where: { id } });
  res.json({ profilePhoto: url });
});

// POST /auth/login-client
app.post('/auth/login-client', async (req, res) => {
  const { email, password } = req.body;
  const cliente = await Client.findOne({ where: { email } });
  if (!cliente || !(await bcrypt.compare(password, cliente.password))) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }
  const token = jwt.sign({ id: cliente.id, type: 'client' }, SECRET, { expiresIn: '2h' });
  res.json({ cliente, token });
});

// GET /clients/:id
app.get('/clients/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const cliente = await Client.findByPk(id);
  if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado.' });
  res.json({
    id: cliente.id,
    name: cliente.name,
    whatsapp: cliente.whatsapp,
    email: cliente.email,
    profilePhoto: cliente.profilePhoto
  });
});

/* ==============================
   Arquivos estáticos
   ============================== */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = process.env.PORT || 3000;
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
});
