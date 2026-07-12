const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const now = Date.now();
    const dailyNextIn  = user.lastDailyReward  ? Math.max(0, 86400 - (now - new Date(user.lastDailyReward).getTime()) / 1000)  : 0;
    const hourlyNextIn = user.lastHourlyReward ? Math.max(0, 3600  - (now - new Date(user.lastHourlyReward).getTime()) / 1000) : 0;
    res.json({ daily: { nextIn: dailyNextIn, streak: user.dailyStreak }, hourly: { nextIn: hourlyNextIn } });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/daily', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const now = Date.now();
    if (user.lastDailyReward && now - new Date(user.lastDailyReward).getTime() < 86400000)
      return res.status(400).json({ error: 'Pack quotidien déjà récupéré.' });

    const cards = await prisma.card.findMany({ where: { rarity: 'RARE' }, take: 20 });
    const drawn = [cards[Math.floor(Math.random() * cards.length)]];

    const newStreak = user.lastDailyReward && now - new Date(user.lastDailyReward).getTime() < 172800000 ? user.dailyStreak + 1 : 1;
    const streakBonus = newStreak % 7 === 0 ? 50 : 0;

    await prisma.user.update({
      where: { id: req.userId },
      data: { lastDailyReward: new Date(), dailyStreak: newStreak, kardPoints: { increment: 10 + streakBonus } }
    });

    for (const card of drawn) {
      await prisma.userCard.upsert({
        where: { userId_cardId: { userId: req.userId, cardId: card.id } },
        update: { quantity: { increment: 1 } },
        create: { userId: req.userId, cardId: card.id }
      });
    }

    res.json({ cards: drawn, streak: newStreak, streakBonus });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/hourly', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const now = Date.now();
    if (user.lastHourlyReward && now - new Date(user.lastHourlyReward).getTime() < 3600000)
      return res.status(400).json({ error: 'Pack horaire déjà récupéré.' });

    const cards = await prisma.card.findMany({ where: { rarity: 'COMMON' }, take: 20 });
    const drawn = [cards[Math.floor(Math.random() * cards.length)]];

    await prisma.user.update({
      where: { id: req.userId },
      data: { lastHourlyReward: new Date(), kardPoints: { increment: 2 } }
    });

    for (const card of drawn) {
      await prisma.userCard.upsert({
        where: { userId_cardId: { userId: req.userId, cardId: card.id } },
        update: { quantity: { increment: 1 } },
        create: { userId: req.userId, cardId: card.id }
      });
    }

    res.json({ cards: drawn });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
