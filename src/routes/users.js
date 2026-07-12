const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/leaderboard', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, username: true, kardPoints: true,
        _count: { select: { collection: true } }
      },
      orderBy: { kardPoints: 'desc' },
      take: 100
    });
    res.json(users.map((u, i) => ({ ...u, rank: i + 1 })));
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/:username', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        id: true, username: true, kardPoints: true, createdAt: true,
        _count: { select: { collection: true, tradesSent: true } }
      }
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
