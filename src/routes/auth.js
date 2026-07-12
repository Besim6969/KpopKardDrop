const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password)
    return res.status(400).json({ error: 'Champs manquants.' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, username, password: hash, kkdCoins: 500, kardPoints: 100 }
    });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email, username, kkdCoins: 500, kardPoints: 100 } });
  } catch {
    res.status(400).json({ error: 'Email ou pseudo déjà utilisé.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !await bcrypt.compare(password, user.password))
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, username: user.username, kkdCoins: user.kkdCoins, kardPoints: user.kardPoints } });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id:true, email:true, username:true, kkdCoins:true, kardPoints:true, dailyStreak:true, createdAt:true }
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
