const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const KP_CARD_PRICES = { COMMON:30, RARE:100, MYTHIC:280, LEGENDARY:700 };
const KP_PACK_PRICES = { standard:150, rare:400, mythic:900, legendary:2000 };

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { kardPoints:true, totalKpEarned:true, dailyStreak:true }
    });
    res.json({ balance: user.kardPoints, totalEarned: user.totalKpEarned, streak: user.dailyStreak });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/buy-card', authMiddleware, async (req, res) => {
  const { cardId } = req.body;
  try {
    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) return res.status(404).json({ error: 'Carte non trouvée.' });
    const cost = KP_CARD_PRICES[card.rarity];
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { kardPoints:true } });
    if (user.kardPoints < cost) return res.status(402).json({ error: 'Pas assez de KardPoints.' });
    await prisma.user.update({ where: { id: req.userId }, data: { kardPoints: { decrement: cost } } });
    await prisma.userCard.upsert({
      where:  { userId_cardId: { userId: req.userId, cardId } },
      update: { quantity: { increment: 1 } },
      create: { userId: req.userId, cardId }
    });
    const updated = await prisma.user.findUnique({ where: { id: req.userId }, select: { kardPoints:true } });
    res.json({ message: `✅ ${card.name} ajoutée !`, cost, newBalance: updated.kardPoints });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/buy-pack', authMiddleware, async (req, res) => {
  const { packType } = req.body;
  const cost = KP_PACK_PRICES[packType];
  if (!cost) return res.status(400).json({ error: 'Pack invalide.' });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { kardPoints:true } });
    if (user.kardPoints < cost) return res.status(402).json({ error: 'Pas assez de KardPoints.' });
    const packCoins = { standard:199, rare:399, mythic:799, legendary:1499 };
    await prisma.user.update({
      where: { id: req.userId },
      data: { kardPoints: { decrement: cost }, kkdCoins: { increment: packCoins[packType] } }
    });
    const updated = await prisma.user.findUnique({ where: { id: req.userId }, select: { kardPoints:true, kkdCoins:true } });
    res.json({ message: `🎴 Pack ${packType} crédité !`, newKpBalance: updated.kardPoints, newKkdBalance: updated.kkdCoins });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
