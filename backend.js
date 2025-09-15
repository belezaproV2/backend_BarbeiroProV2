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
    // Permite qualquer origem em produção, mas você pode restringir para domínios específicos:
    const allowedOrigins = ['https://click-beatiful.netlify.app'];
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Configuração do Multer para upload de fotos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let dir;
    if (req.baseUrl.includes("/clients")) {
      dir = path.join(__dirname, 'uploads', 'clients', req.params.id || 'temp');
    } else {
      dir = path.join(__dirname, 'uploads', req.params.id || 'temp');
    }
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const uploadProfile = multer({ 
  storage: storage, 
  limits: { fileSize: 10 * 1024 * 1024, files: 1 } // 10MB
});
const upload = multer({ 
  storage: storage, 
  limits: { fileSize: 10 * 1024 * 1024, files: 6 } // 10MB por arquivo
});

// Middleware JWT
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

// GET /professionals/:id (dados do profissional logado, exige token)
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

// POST /auth/register-professional (cadastro profissional)
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
app.post('/professionals/:id/profile-photo', authMiddleware, uploadProfile.single('profilePhoto'), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'Nenhuma foto enviada.' });
  const url = `/uploads/${id}/${req.file.filename}`;
  await Professional.update({ profilePhoto: url }, { where: { id } });
  res.json({ profilePhoto: url });
});

// POST /auth/login-professional (login profissional)
app.post('/auth/login-professional', async (req, res) => {
  const { email, password } = req.body;
  const profissional = await Professional.findOne({ where: { email } });
  if (!profissional || !(await bcrypt.compare(password, profissional.password))) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }
  const token = jwt.sign({ id: profissional.id, type: 'professional' }, SECRET, { expiresIn: '2h' });
  res.json({ profissional, token });
});

// POST /professionals/:id/photos (upload de fotos, exige token)
app.post('/professionals/:id/photos', authMiddleware, upload.array('photos', 6), async (req, res) => {
  const { id } = req.params;
  try {
    const prof = await Professional.findByPk(id, { include: { model: Photo, as: 'photos' } });
    if (!prof) return res.status(404).json({ error: 'Profissional não encontrado.' });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhuma foto enviada.' });
    }
    // Limitar a 6 fotos
    const existingCount = await Photo.count({ where: { ProfessionalId: id } });
    if (existingCount + req.files.length > 6) {
      return res.status(400).json({ error: 'Máximo de 6 fotos por profissional.' });
    }
    const urls = req.files.map(f => `/uploads/${id}/${f.filename}`);
    await Promise.all(urls.map(url => Photo.create({ url, ProfessionalId: id })));
    const allPhotos = await Photo.findAll({ where: { ProfessionalId: id } });
    res.json({ photoUrls: allPhotos.map(photo => photo.url) });
  } catch (err) {
    console.error("Erro ao fazer uploads das fotos", err);
    res.status(500).json({ error: 'Erro ao fazer upload das fotos.' });
  }
});

// POST /auth/register-client (cadastro cliente)
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
app.post('/clients/:id/profile-photo', authMiddleware, uploadProfile.single('profilePhoto'), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'Nenhuma foto enviada.' });
  const url = `/uploads/clients/${id}/${req.file.filename}`;
  await Client.update({ profilePhoto: url }, { where: { id } });
  res.json({ profilePhoto: url });
});

// POST /auth/login-client (login cliente)
app.post('/auth/login-client', async (req, res) => {
  const { email, password } = req.body;
  const cliente = await Client.findOne({ where: { email } });
  if (!cliente || !(await bcrypt.compare(password, cliente.password))) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }
  const token = jwt.sign({ id: cliente.id, type: 'client' }, SECRET, { expiresIn: '2h' });
  res.json({ cliente, token });
});

app.get('/clients/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const cliente = await Client.findByPk(id);
  if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado.' });
  res.json({
    id: cliente.id,
    name: cliente.name,
    whatsapp: cliente.whatsapp,
    email: cliente.email,
    profilePhoto: cliente.profilePhoto // retorna a foto de perfil
  });
});

// Servir arquivos de upload
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = process.env.PORT || 3000;
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
});